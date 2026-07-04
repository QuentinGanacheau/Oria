"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Clock, Loader2, Sparkles, X } from "lucide-react";
import { apiPost } from "@/lib/api";
import { saveSession, type StoredPortrait } from "@/lib/storage";
import { track } from "@/lib/analytics";
import ThemeToggle from "@/components/theme-toggle";
import EmailGate from "./email-gate";
import PortraitScreen from "./portrait-screen";

type Option = { id: string; label: string };
type Question = {
  id: string;
  text: string;
  type: "SINGLE_CHOICE" | "FREE_TEXT" | "SUGGESTIONS_WITH_TEXT";
  placeholder?: string;
  helperText?: string;
  options: Option[];
};

type Progress = { answered: number; total: number | null };
type NextResponse = {
  complete: boolean;
  question: Question | null;
  progress: Progress;
};
type StartResponse = {
  sessionId: string;
  complete: boolean;
  question: Question | null;
  progress: Progress;
};
type MatchResponse = {
  sessionId: string;
  matches: {
    job: {
      slug: string;
      title: string;
      tagline: string;
      summary: string;
      missions: string[];
      skills: string[];
      formations: string[];
      salaryRangeHint: string;
      workContext: string;
    };
    score: number;
    scorePercent: number;
    rationale?: string | null;
  }[];
  /** Portrait IA — null si l'IA n'a pas pu le générer (Phase 2). */
  portrait: StoredPortrait | null;
};

type AnswerPayload = {
  sessionId: string;
  questionKey: string;
  optionKey?: string;
  freeText?: string;
};

type HistoryEntry = {
  question: Question;
  prefilledDraft: string;
  prefilledSuggestions: Map<string, string>;
};

export default function QuestionnairePage() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [progress, setProgress] = useState<Progress>({
    answered: 0,
    total: null,
  });
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // Map optionId → label pour les chips sélectionnés (SUGGESTIONS_WITH_TEXT)
  const [selectedSuggestions, setSelectedSuggestions] = useState<
    Map<string, string>
  >(new Map());
  // Choix en attente d'auto-avance (SINGLE_CHOICE) — donne le feedback visuel
  // de sélection ~260 ms avant de charger la question suivante.
  const [pendingChoice, setPendingChoice] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  /**
   * Stocke les matches en attente d'affichage de l'écran EmailGate.
   * Quand non null, on affiche le formulaire de capture email à la place
   * de la dernière question. Le redirect vers /resultats ne se fait qu'après
   * que l'utilisateur ait soumis ou skippé l'écran.
   */
  const [pendingMatch, setPendingMatch] = useState<MatchResponse | null>(null);
  /**
   * État du flow post-questionnaire :
   *   "email"    → on affiche EmailGate
   *   "portrait" → on affiche PortraitScreen (après EmailGate)
   *   "done"     → on redirige vers /resultats
   * Permet de séquencer les deux écrans intermédiaires.
   */
  const [postFlowStep, setPostFlowStep] = useState<
    "email" | "portrait" | "done"
  >("email");
  /** Cache du flag hasEmail entre les deux écrans (capture vs skip). */
  const hasEmailRef = useRef(false);
  const finishLock = useRef(false);
  const currentQuestionRef = useRef<Question | null>(null);
  // Empêche le useEffect de vider draft/suggestions lors d'un goBack (pré-remplissage).
  const skipClearOnQuestionChange = useRef(false);
  useEffect(() => {
    currentQuestionRef.current = question;
    if (skipClearOnQuestionChange.current) {
      skipClearOnQuestionChange.current = false;
      return;
    }
    setDraft("");
    setSelectedSuggestions(new Map());
    setPendingChoice(null);
  }, [question]);

  const fetchNext = useCallback(
    async (
      payload: AnswerPayload,
      humanValue: string,
      prefill: { draft: string; suggestions: Map<string, string> },
    ) => {
      setLoading(true);
      setError(null);
      const questionAtSubmit = currentQuestionRef.current;
      try {
        const data = await apiPost<NextResponse>(
          "/v1/questionnaire/next",
          payload,
        );
        const nextAnswers = { ...answers, [payload.questionKey]: humanValue };
        setAnswers(nextAnswers);
        if (questionAtSubmit) {
          setHistory((prev) => [
            ...prev,
            {
              question: questionAtSubmit,
              prefilledDraft: prefill.draft,
              prefilledSuggestions: prefill.suggestions,
            },
          ]);
        }
        setComplete(data.complete);
        setQuestion(data.question);
        setProgress(data.progress);
        track({ name: "questionnaire_step_completed", step: payload.questionKey });
        if (data.complete) {
          if (finishLock.current) return;
          finishLock.current = true;
          try {
            const matchData = await apiPost<MatchResponse>(
              "/v1/questionnaire/match",
              {
                sessionId: payload.sessionId,
              },
            );
            // On ne redirige plus directement : on affiche l'écran de capture
            // email entre le match et l'arrivée sur /resultats.
            track({
              name: "questionnaire_completed",
              track: nextAnswers.situation,
            });
            setPendingMatch(matchData);
          } catch (matchErr) {
            // Le matching a échoué (IA indisponible) — on reste sur la page
            // avec un message clair et un bouton pour réessayer.
            finishLock.current = false;
            setComplete(false);
            setQuestion(null);
            setAiError(payload.sessionId);
            setError(
              matchErr instanceof Error
                ? matchErr.message
                : "Erreur lors du calcul de tes résultats.",
            );
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur réseau");
      } finally {
        setLoading(false);
      }
    },
    [answers, router],
  );

  const goBack = useCallback(async () => {
    if (!sessionId || !question || loading || history.length === 0) return;
    const currentKey = question.id;
    const prevEntry = history[history.length - 1];
    setLoading(true);
    setError(null);
    try {
      // Si la question courante a déjà été répondue (retour multiple),
      // supprimer sa réponse en DB ainsi que toutes les suivantes.
      if (answers[currentKey] !== undefined) {
        await apiPost(`/v1/questionnaire/${sessionId}/back`, {
          questionKey: currentKey,
        });
        setAnswers((prev) => {
          const next = { ...prev };
          delete next[currentKey];
          return next;
        });
      }
      setHistory((h) => h.slice(0, -1));
      skipClearOnQuestionChange.current = true;
      setQuestion(prevEntry.question);
      setDraft(prevEntry.prefilledDraft);
      setSelectedSuggestions(prevEntry.prefilledSuggestions);
      setProgress((p) => ({
        answered: Math.max(0, p.answered - 1),
        total: p.total,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, [sessionId, question, loading, history, answers]);

  const retryMatch = useCallback(async () => {
    if (!aiError) return;
    setLoading(true);
    setError(null);
    try {
      const matchData = await apiPost<MatchResponse>(
        "/v1/questionnaire/match",
        {
          sessionId: aiError,
        },
      );
      // Même flow que la complétion normale : on passe par l'EmailGate.
      setAiError(null);
      setPendingMatch(matchData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur réseau");
    } finally {
      setLoading(false);
    }
  }, [aiError]);

  /**
   * Étape 1 du post-flow : déclenchée à la fin de EmailGate.
   * Mémorise le flag hasEmail, passe à l'écran PortraitScreen.
   *
   * @param hasEmail true si l'email a bien été capturé, false si skipé.
   */
  const onEmailComplete = useCallback((hasEmail: boolean) => {
    hasEmailRef.current = hasEmail;
    if (hasEmail) track({ name: "email_captured" });
    setPostFlowStep("portrait");
    track({ name: "portrait_viewed" });
  }, []);

  /**
   * Étape 2 du post-flow : déclenchée à la fin de PortraitScreen.
   * Persiste la session en localStorage et redirige vers /resultats.
   * Si le portrait était null (IA indisponible), PortraitScreen aura
   * appelé cette fonction immédiatement → skip transparent.
   */
  const onPortraitComplete = useCallback(() => {
    if (!pendingMatch) return;
    saveSession({
      sessionId: pendingMatch.sessionId,
      answers,
      matches: pendingMatch.matches,
      hasEmail: hasEmailRef.current,
      portrait: pendingMatch.portrait,
      ratings: {},
      refinedMatches: null,
      refineInsight: null,
    });
    setPostFlowStep("done");
    router.push("/resultats");
  }, [pendingMatch, answers, router]);

  const started = useRef(false);

  /**
   * Détecte un retour sur la page depuis le cache Next.js Router.
   *
   * Next.js conserve l'état des composants clients ~30 secondes (SPA navigation).
   * Si l'utilisateur a eu une erreur IA puis est revenu sur cette page,
   * `started.current` serait encore `true` et la session expirée resterait
   * affichée. Ce premier effect s'exécute avant le second et remet à zéro
   * l'état obsolète, permettant à l'effect de démarrage de relancer proprement.
   *
   * Note: la mutation de `started.current` est synchrone et visible par
   * les autres effects du même cycle de rendu.
   */
  useEffect(() => {
    if (!started.current) return;
    // Composant en cache avec un état périmé — on remet à zéro.
    started.current = false;
    setAiError(null);
    setError(null);
    setPendingMatch(null);
    setComplete(false);
    setQuestion(null);
    setAnswers({});
    setHistory([]);
    setSessionId(null);
    setProgress({ answered: 0, total: null });
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      setLoading(true);
      try {
        const start = await apiPost<StartResponse>("/v1/questionnaire/start", {
          metadata: { client: "web" },
        });
        setSessionId(start.sessionId);
        setComplete(start.complete);
        setQuestion(start.question);
        setProgress(start.progress);
        track({ name: "questionnaire_started" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur réseau");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onChoose = (optionId: string, optionLabel: string) => {
    const currentQuestion = currentQuestionRef.current;
    if (!currentQuestion || !sessionId || loading || pendingChoice) return;
    // Feedback visuel immédiat puis auto-avance ~260 ms plus tard.
    setPendingChoice(optionId);
    const sid = sessionId;
    const key = currentQuestion.id;
    setTimeout(() => {
      void fetchNext(
        { sessionId: sid, questionKey: key, optionKey: optionId },
        optionLabel,
        { draft: "", suggestions: new Map() },
      );
    }, 260);
  };

  const onSubmitFreeText = () => {
    const currentQuestion = currentQuestionRef.current;
    if (!currentQuestion || !sessionId || loading) return;
    const text = draft.trim();
    if (text.length < 3) {
      setError("Merci d'écrire au moins quelques mots.");
      return;
    }
    void fetchNext(
      { sessionId, questionKey: currentQuestion.id, freeText: text },
      text,
      { draft: text, suggestions: new Map() },
    );
  };

  const toggleSuggestion = (optionId: string, optionLabel: string) => {
    setSelectedSuggestions((prev) => {
      const next = new Map(prev);
      if (next.has(optionId)) {
        next.delete(optionId);
      } else {
        next.set(optionId, optionLabel);
      }
      return next;
    });
  };

  const onSubmitSuggestions = () => {
    const currentQuestion = currentQuestionRef.current;
    if (!currentQuestion || !sessionId || loading) return;
    const chips = Array.from(selectedSuggestions.values());
    const parts = [...chips, draft.trim()].filter(Boolean);
    if (parts.length === 0) {
      setError("Sélectionne au moins une suggestion ou écris quelques mots.");
      return;
    }
    const composed = parts.join(". ");
    void fetchNext(
      { sessionId, questionKey: currentQuestion.id, freeText: composed },
      composed,
      { draft: draft.trim(), suggestions: new Map(selectedSuggestions) },
    );
  };

  // Barre de progression — alimentée par l'API qui connaît le total exact
  // selon le track (A = 16 questions, B = 17 questions).
  // Avant que la situation soit connue (Q1), total est null → pas de %.
  const { answered, total } = progress;
  const currentNum = answered + 1;
  const progressPct =
    total !== null ? Math.round((answered / total) * 100) : null;

  const showChrome = (question || complete) && !pendingMatch;

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      {/* ── Topbar : accueil · thème · compteur ──────────────────────────── */}
      <div className="sticky top-0 z-30 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto max-w-[760px] px-6 pt-6">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[15px] font-medium text-accent-ink transition-opacity hover:opacity-75"
            >
              <ArrowLeft className="size-4" /> Accueil
            </Link>
            <div className="flex items-center gap-3.5">
              <ThemeToggle />
              {showChrome && (
                <span className="text-sm tabular-nums text-muted">
                  {complete ? (
                    "Terminé"
                  ) : total !== null ? (
                    <>
                      <b className="font-semibold text-ink">{currentNum}</b> /{" "}
                      {total}
                    </>
                  ) : (
                    <>
                      Question{" "}
                      <b className="font-semibold text-ink">{currentNum}</b>
                    </>
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Barre de progression */}
        {showChrome && (
          <div className="mx-auto mt-4 max-w-[760px] px-6">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
                style={{ width: `${complete ? 100 : (progressPct ?? 0)}%` }}
              />
            </div>
            <div className="mt-2 flex justify-end text-[13px] text-muted">
              {complete
                ? "Terminé"
                : progressPct !== null
                  ? `${progressPct}% complété`
                  : ""}
            </div>
          </div>
        )}
      </div>

      {/* Lien Précédent */}
      <div className="mx-auto mt-4 min-h-6 w-full max-w-[760px] px-6">
        {question &&
          !complete &&
          history.length > 0 &&
          !pendingMatch &&
          !aiError && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void goBack()}
              className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-accent-ink disabled:opacity-40"
            >
              <ArrowLeft className="size-4" /> Précédent
            </button>
          )}
      </div>

      {/* ── Scène ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 items-start justify-center px-6 pb-20 pt-5">
        <div className="w-full max-w-[760px]">
          {error && (
            <p className="mb-5 rounded-2xl border border-no/40 bg-no/10 px-4 py-3 text-sm text-no">
              {error}
            </p>
          )}

          {loading && !question && !complete && !aiError && (
            <p className="text-center text-muted">
              Chargement du questionnaire…
            </p>
          )}

          {/* Erreur IA : calcul des résultats impossible — propose de réessayer */}
          {aiError && !loading && (
            <div className="rounded-3xl border border-warn/40 bg-warn/10 p-8 text-center">
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-warn/15">
                <Clock className="size-8 text-warn" strokeWidth={1.8} />
              </div>
              <h2 className="mt-4 font-serif text-2xl text-ink">
                Notre moteur est momentanément surchargé
              </h2>
              <p className="mt-2 text-sm text-ink-soft">
                Tes réponses sont bien enregistrées. Le calcul de tes résultats
                nécessite notre IA, qui est temporairement indisponible.
                Réessaie dans quelques minutes — pas besoin de refaire le
                questionnaire.
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={() => void retryMatch()}
                className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper transition hover:bg-accent hover:text-white disabled:opacity-60"
              >
                {loading ? "Calcul en cours…" : "Réessayer"}
                <ArrowRight className="size-4" />
              </button>
            </div>
          )}

          {/* Génération des résultats : le questionnaire est fini (complete),
              le POST /match tourne (matching IA + portrait, quelques secondes)
              mais pendingMatch n'est pas encore arrivé. Sans cet écran,
              l'utilisateur reste sur une page vide pendant le calcul. */}
          {complete && !pendingMatch && !aiError && (
            <div className="rounded-3xl border border-line bg-surface p-8 text-center shadow-[0_30px_60px_-38px_rgba(20,40,25,.28)] sm:p-12">
              <div className="relative mx-auto grid size-16 place-items-center">
                {/* Halo qui pulse derrière l'icône — signal "ça travaille". */}
                <span className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
                <span className="relative grid size-16 place-items-center rounded-full bg-accent-soft">
                  <Sparkles className="size-8 text-accent-ink" strokeWidth={1.8} />
                </span>
              </div>
              <h2 className="mt-6 font-serif text-2xl text-ink">
                On analyse tes réponses…
              </h2>
              <p className="mx-auto mt-2 max-w-[42ch] text-sm text-ink-soft">
                Notre IA construit ton portrait et sélectionne les métiers qui
                te correspondent le mieux. Encore quelques secondes.
              </p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm text-muted">
                <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                Génération en cours
              </div>
            </div>
          )}

          {/* Post-flow : EmailGate puis PortraitScreen, dans l'ordre. */}
          {pendingMatch && !aiError && postFlowStep === "email" && (
            <EmailGate
              sessionId={pendingMatch.sessionId}
              onComplete={onEmailComplete}
            />
          )}

          {pendingMatch && !aiError && postFlowStep === "portrait" && (
            <PortraitScreen
              portrait={pendingMatch.portrait}
              onComplete={onPortraitComplete}
            />
          )}

          {question && !complete && !pendingMatch && !aiError && (
            <div className="rounded-3xl border border-line bg-surface p-7 shadow-[0_30px_60px_-38px_rgba(20,40,25,.28)] sm:p-12">
              <AnimatePresence mode="wait">
                <motion.div
                  key={question.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                >
                  <h1 className="font-serif text-[clamp(26px,3.4vw,38px)] leading-[1.06] tracking-tight">
                    {question.text}
                  </h1>
                  {question.helperText && (
                    <p className="mt-3 max-w-[44ch] text-base text-muted">
                      {question.helperText}
                    </p>
                  )}

                  {question.type === "SUGGESTIONS_WITH_TEXT" ? (
                    <div className="mt-7 flex flex-col gap-5">
                      <div className="flex flex-wrap gap-2.5">
                        {question.options.map((opt) => {
                          const selected = selectedSuggestions.has(opt.id);
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={loading}
                              onClick={() =>
                                toggleSuggestion(opt.id, opt.label)
                              }
                              className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[15px] transition disabled:opacity-50 ${
                                selected
                                  ? "border-accent bg-accent text-white"
                                  : "border-line-strong bg-surface text-ink-soft hover:border-accent hover:text-accent-ink"
                              }`}
                            >
                              {opt.label}
                              {selected && (
                                <X className="size-[15px]" strokeWidth={2.2} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder={
                          question.placeholder ?? "Précise si tu veux…"
                        }
                        rows={4}
                        maxLength={2000}
                        disabled={loading}
                        className="w-full resize-y rounded-2xl border-[1.5px] border-line bg-surface-2 px-[18px] py-4 text-base leading-relaxed outline-none transition focus:border-accent focus:bg-surface disabled:opacity-50"
                      />
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          disabled={
                            loading ||
                            (selectedSuggestions.size === 0 &&
                              draft.trim().length === 0)
                          }
                          onClick={onSubmitSuggestions}
                          className="group inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-[15px] font-semibold text-paper transition hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-surface disabled:hover:bg-line-strong"
                        >
                          Continuer
                          <ArrowRight className="size-4 transition-transform group-enabled:group-hover:translate-x-0.5" />
                        </button>
                      </div>
                    </div>
                  ) : question.type === "FREE_TEXT" ? (
                    <div className="mt-7 flex flex-col gap-3">
                      <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        placeholder={question.placeholder ?? "Ta réponse…"}
                        rows={6}
                        maxLength={2000}
                        disabled={loading}
                        className="w-full resize-y rounded-2xl border-[1.5px] border-line bg-surface-2 px-[18px] py-4 text-base leading-relaxed outline-none transition focus:border-accent focus:bg-surface disabled:opacity-50"
                      />
                      <div className="flex items-center justify-between text-[13px] text-muted">
                        <span className="tabular-nums">
                          {draft.length} / 2000
                        </span>
                        <button
                          type="button"
                          disabled={loading || draft.trim().length < 3}
                          onClick={onSubmitFreeText}
                          className="group inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-[15px] font-semibold text-paper transition hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:bg-line-strong disabled:text-surface disabled:hover:bg-line-strong"
                        >
                          Continuer
                          <ArrowRight className="size-4 transition-transform group-enabled:group-hover:translate-x-0.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-8 flex flex-col gap-3">
                      {question.options.map((opt) => {
                        const selected = pendingChoice === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={loading || pendingChoice !== null}
                            onClick={() => onChoose(opt.id, opt.label)}
                            className={`flex w-full items-center gap-4 rounded-2xl border-[1.5px] px-[22px] py-5 text-left text-[16.5px] transition active:scale-[.992] disabled:cursor-default ${
                              selected
                                ? "border-accent bg-accent-soft"
                                : "border-line bg-surface-2 hover:border-accent/45 hover:bg-surface"
                            } ${loading && !selected ? "opacity-50" : ""}`}
                          >
                            <span
                              className={`grid size-6 flex-none place-items-center rounded-full border-2 transition ${
                                selected
                                  ? "border-accent bg-accent"
                                  : "border-line-strong"
                              }`}
                            >
                              <Check
                                className={`size-[13px] text-white transition ${selected ? "opacity-100" : "opacity-0"}`}
                                strokeWidth={2.6}
                              />
                            </span>
                            <span className="flex-1">{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          )}

          {loading && question && !pendingMatch && (
            <p className="mt-4 text-center text-sm text-muted">
              Enregistrement…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
