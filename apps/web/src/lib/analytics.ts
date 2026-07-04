import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

let initialized = false;

/** Initialise PostHog une seule fois, côté client. No-op si la clé est absente (dev). */
export function initAnalytics(): void {
  if (initialized || typeof window === "undefined" || !POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
  });
  initialized = true;
}

/** Events du funnel produit — un seul point d'entrée pour rester cohérent. */
export type AnalyticsEvent =
  | { name: "questionnaire_started" }
  | { name: "questionnaire_step_completed"; step: string; track?: string }
  | { name: "questionnaire_completed"; track?: string }
  | { name: "portrait_viewed" }
  | { name: "results_viewed" }
  | { name: "job_liked"; jobSlug: string }
  | { name: "job_disliked"; jobSlug: string }
  | { name: "refine_triggered" }
  | { name: "refine_completed" }
  | { name: "email_captured" }
  | { name: "paywall_viewed" }
  | { name: "payment_initiated" }
  | { name: "payment_completed" }
  | { name: "job_sheet_opened"; jobSlug: string };

export function track(event: AnalyticsEvent): void {
  if (typeof window === "undefined" || !POSTHOG_KEY) return;
  const { name, ...properties } = event;
  posthog.capture(name, properties);
}
