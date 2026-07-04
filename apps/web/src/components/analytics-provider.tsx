"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";

/** Monté une seule fois à la racine — initialise PostHog côté client. */
export function AnalyticsProvider() {
  useEffect(() => {
    initAnalytics();
  }, []);

  return null;
}
