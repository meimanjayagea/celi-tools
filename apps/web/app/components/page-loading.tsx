"use client";

import { useEffect, useRef } from "react";
import { useLanguage } from "./language-provider";

/** Show a non-blocking indicator until the client has hydrated the page. */
export function HydrationProgress() {
  const indicator = useRef<HTMLDivElement>(null);
  useEffect(() => { if (indicator.current) indicator.current.hidden = true; }, []);
  return <div className="hydration-progress" ref={indicator} aria-hidden="true"><span /></div>;
}

/** Show only while Next.js is waiting for a route segment to render. */
export function PageLoading() {
  const { t } = useLanguage();
  return <div className="page-loading" role="status"><span className="page-loading-mark" aria-hidden="true"/><span>{t("Memuat…")}</span></div>;
}
