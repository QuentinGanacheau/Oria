"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";
import { saveSession, type StoredPortrait } from "@/lib/storage";
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
type NextResponse = { complete: boolean; question: Question | null; progress: Progress };
type StartResponse = { sessionId: string; complete: boolean; question: Question | null; progress: Progress };
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
  const [progress, setProgress] = useState<Progress>({ answered: 0, total: null });
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // Map optionId → label pour les chips sélectionnés (SUGGESTIONS_WITH_TEXT)
  const [selectedSuggestions, setSelectedSuggestions] = useState<Map<string, string>>(new Map());
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
  const [postFlowStep, setPostFlowStep] = useState<"email" | "portrait" | "done">("email");
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
        const data = await apiPost<NextResponse>("/v1/questionnaire/next", payload);
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
        if (data.complete) {
          if (finishLock.current) return;
          finishLock.current = true;
          try {
            const matchData = await apiPost<MatchResponse>("/v1/questionnaire/match", {
              sessionId: payload.sessionId,
            });
            // On ne redirige plus directement : on affiche l'écran de capture
            // email entre le match et l'arrivée sur /resultats.
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
        await apiPost(`/v1/questionnaire/${sessionId}/back`, { questionKey: currentKey });
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
      setProgress((p) => ({ answered: Math.max(0, p.answered - 1), total: p.total }));
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
      const matchData = await apiPost<MatchResponse>("/v1/questionnaire/match", {
        sessionId: aiError,
      });
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
    setPostFlowStep("portrait");
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur réseau");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const onChoose = (optionId: string, optionLabel: string) => {
    const currentQuestion = currentQuestionRef.current;
    if (!currentQuestion || !sessionId || loading) return;
    void fetchNext(
      { sessionId, questionKey: currentQuestion.id, optionKey: optionId },
      optionLabel,
      { draft: "", suggestions: new Map() },
    );
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
  const progressPct = total !== null ? Math.round((answered / total) * 100) : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
        {/* ── Navigation + compteur ────────────────────────────────────── */}
        <div className="flex items-center justify-between text-sm">
          <Link href="/" className="text-indigo-600 hover:underline dark:text-indigo-400">
            ← Accueil
          </Link>
          {(question || complete) && (
            <span className="tabular-nums text-slate-500 dark:text-slate-400">
              {complete
                ? "Terminé ✓"
                : total !== null
                  ? `${currentNum} / ${total}`
                  : `Question ${currentNum}`}
            </span>
          )}
        </div>

        {/* ── Barre de progression ─────────────────────────────────────── */}
        {(question || complete) && (
          <div className="space-y-1.5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-500 ease-out"
                style={{ width: `${complete ? 100 : (progressPct ?? 0)}%` }}
              />
            </div>
            {!complete && progressPct !== null && (
              <p className="text-right text-xs text-slate-400 dark:text-slate-500">
                {progressPct}% complété
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}

        {loading && !question && !complete && !aiError && (
          <p className="text-center text-slate-500">Chargement du questionnaire…</p>
        )}

        {/* Erreur IA : calcul des résultats impossible — propose de réessayer */}
        {aiError && !loading && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900 dark:bg-amber-950/30">
            <p className="text-2xl">⏳</p>
            <h2 className="mt-3 text-lg font-semibold text-amber-900 dark:text-amber-100">
              Notre moteur est momentanément surchargé
            </h2>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
              Tes réponses sont bien enregistrées. Le calcul de tes résultats
              nécessite notre IA, qui est temporairement indisponible. Réessaie
              dans quelques minutes — pas besoin de refaire le questionnaire.
            </p>
            <button
              type="button"
              disabled={loading}
              onClick={() => void retryMatch()}
              className="mt-5 rounded-full bg-amber-600 px-6 py-3 text-sm font-medium text-white shadow hover:bg-amber-500 disabled:opacity-60"
            >
              {loading ? "Calcul en cours…" : "Réessayer →"}
            </button>
          </div>
        )}

        {/* Post-flow : EmailGate puis PortraitScreen, dans l'ordre. */}
        {pendingMatch && !aiError && postFlowStep === "email" && (
          <EmailGate
            sessionId={pendingMatch.sessionId}
            matchCount={pendingMatch.matches.length}
            onComplete={onEmailComplete}
          />
        )}

        {pendingMatch && !aiError && postFlowStep === "portrait" && (
          <PortraitScreen
            portrait={pendingMatch.portrait}
            onComplete={onPortraitComplete}
          />
        )}

        {question && !complete && (
          <>
          {history.length > 0 && !pendingMatch && !aiError && (
            <button
              type="button"
              disabled={loading}
              onClick={() => void goBack()}
              className="w-fit text-sm text-slate-500 hover:text-slate-700 disabled:opacity-40 dark:text-slate-400 dark:hover:text-slate-200"
            >
              ← Précédent
            </button>
          )}
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h1 className="text-xl font-semibold leading-snug">{question.text}</h1>
            {question.helperText && (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {question.helperText}
              </p>
            )}

            {question.type === "SUGGESTIONS_WITH_TEXT" ? (
              <div className="mt-6 flex flex-col gap-4">
                <div className="flex flex-wrap gap-2">
                  {question.options.map((opt) => {
                    const selected = selectedSuggestions.has(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={loading}
                        onClick={() => toggleSuggestion(opt.id, opt.label)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                          selected
                            ? "border-indigo-400 bg-indigo-100 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-900/40 dark:text-indigo-300"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-indigo-700"
                        }`}
                      >
                        {selected ? "✓ " : ""}{opt.label}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={question.placeholder ?? "Précise si tu veux…"}
                  rows={3}
                  maxLength={2000}
                  disabled={loading}
                  className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed outline-none transition focus:border-indigo-400 focus:bg-white disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-indigo-500 dark:focus:bg-slate-900"
                />
                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    disabled={loading || (selectedSuggestions.size === 0 && draft.trim().length === 0)}
                    onClick={onSubmitSuggestions}
                    className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Continuer
                  </button>
                </div>
              </div>
            ) : question.type === "FREE_TEXT" ? (
              <div className="mt-6 flex flex-col gap-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={question.placeholder ?? "Ta réponse…"}
                  rows={6}
                  maxLength={2000}
                  disabled={loading}
                  className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base leading-relaxed outline-none transition focus:border-indigo-400 focus:bg-white disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:focus:border-indigo-500 dark:focus:bg-slate-900"
                />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{draft.length} / 2000</span>
                  <button
                    type="button"
                    disabled={loading || draft.trim().length < 3}
                    onClick={onSubmitFreeText}
                    className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Continuer
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-8 flex flex-col gap-3">
                {question.options.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={loading}
                    onClick={() => onChoose(opt.id, opt.label)}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-left text-base font-medium transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/40"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          </>
        )}

        {loading && question && (
          <p className="text-center text-sm text-slate-500">Enregistrement…</p>
        )}
      </div>
    </div>
  );
}
