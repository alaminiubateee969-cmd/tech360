"use client";

/**
 * Hand-coded UI concept mockups (browser-frame wireframes) — replacing
 * AI-generated raster screenshots with crisp, English-only HTML mockups.
 * Every element is real markup: sharp at any DPI and honest about being
 * a concept representation, not a claimed client screenshot.
 */

import { Lock } from "lucide-react";

function BrowserFrame({
  address,
  children,
  label,
}: {
  address: string;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <figure
      role="img"
      aria-label={label}
      className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_18px_44px_rgba(6,59,143,0.08)]"
    >
      <div className="flex items-center gap-3 border-b border-[#E2E8F0] bg-[#F4FAFF] px-4 py-2.5">
        <span className="flex shrink-0 gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-[#B4472A]/70" />
          <span className="size-2.5 rounded-full bg-amber-400/80" />
          <span className="size-2.5 rounded-full bg-[#18B83A]/70" />
        </span>
        <span className="mx-auto flex min-w-0 items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-white px-3 py-1 text-[11px] font-medium text-[#526173]">
          <Lock className="size-3 shrink-0 text-[#18B83A]" aria-hidden="true" />
          <span className="truncate">{address}</span>
        </span>
        <span className="hidden w-14 shrink-0 sm:block" aria-hidden="true" />
      </div>
      {children}
    </figure>
  );
}

/* -------------------------------------------------------------- */
/* Website concept — hero + services grid + trust strip            */
/* -------------------------------------------------------------- */
export function WebsiteConceptMockup() {
  return (
    <BrowserFrame
      address="bdtech360.com — concept preview"
      label="Illustrative website design concept: hero section with bold headline, services grid, and trust strip in the Tech360 brand style"
    >
      <div className="bg-white">
        {/* Hero */}
        <div className="bg-gradient-to-br from-[#0B1F33] via-[#08296B] to-[#063B8F] px-6 py-8 sm:px-10 sm:py-12">
          <div className="h-2 w-20 rounded-full bg-[#009FE3]/60" />
          <div className="mt-4 h-4 w-3/4 rounded bg-white/90 sm:h-5" />
          <div className="mt-2 h-4 w-2/3 rounded bg-[#009FE3]/80 sm:h-5" />
          <div className="mt-3 h-2.5 w-1/2 rounded bg-white/30" />
          <div className="mt-5 flex gap-2">
            <div className="h-6 w-24 rounded bg-[#009FE3]" />
            <div className="h-6 w-20 rounded border border-white/40" />
          </div>
        </div>
        {/* Services grid */}
        <div className="px-6 py-6 sm:px-10">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#063B8F]">What we do</div>
          <div className="mt-3 grid grid-cols-3 gap-2.5">
            {["Websites", "CRM", "Automation"].map((s, i) => (
              <div key={s} className="rounded-lg border border-[#E2E8F0] bg-[#F8FCFF] p-3">
                <div
                  className="size-5 rounded"
                  style={{ background: ["#009FE3", "#063B8F", "#18B83A"][i] }}
                  aria-hidden="true"
                />
                <div className="mt-2 text-[10px] font-bold text-[#0B1F33]">{s}</div>
                <div className="mt-1 h-1.5 w-full rounded bg-[#E2E8F0]" />
                <div className="mt-1 h-1.5 w-2/3 rounded bg-[#E2E8F0]" />
              </div>
            ))}
          </div>
          {/* Trust strip */}
          <div className="mt-4 flex items-center justify-between rounded-lg bg-[#063B8F] px-4 py-2.5">
            {["Preview first", "Milestone payments", "Full handover"].map((t) => (
              <span key={t} className="text-[9px] font-semibold text-white/90">
                ✓ {t}
              </span>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="border-t border-[#E2E8F0] bg-white px-4 py-3 text-xs leading-relaxed text-[#526173] sm:px-5">
        <span className="font-semibold text-[#0B1F33]">Illustrative design concept.</span>{" "}
        Representative of the calibre of website we deliver — real client work ships under NDA,
        so we show labelled concepts rather than client screenshots.
      </figcaption>
    </BrowserFrame>
  );
}

/* -------------------------------------------------------------- */
/* CRM console concept — pipeline + client record                 */
/* -------------------------------------------------------------- */
export function CrmConsoleConcept() {
  const stages = ["New", "Contacted", "Scoped", "Won"];
  return (
    <BrowserFrame
      address="app.bdtech360.com — CRM console (concept)"
      label="Illustrative CRM interface concept: KPI cards, pipeline columns with deal cards, and a client timeline"
    >
      <div className="bg-[#F4FAFF] p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <div className="h-3 w-24 rounded bg-[#063B8F]" />
          <div className="ml-auto h-3 w-16 rounded bg-[#E2E8F0]" />
        </div>
        {/* KPI cards */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { l: "Leads", v: "128", c: "#009FE3" },
            { l: "Pipeline", v: "$42k", c: "#063B8F" },
            { l: "Clients", v: "36", c: "#18B83A" },
            { l: "Won", v: "18", c: "#526173" },
          ].map((k) => (
            <div key={k.l} className="rounded-lg border border-[#E2E8F0] bg-white p-2.5">
              <div className="text-[8px] font-bold uppercase tracking-wider text-[#526173]">{k.l}</div>
              <div className="mt-0.5 text-sm font-black" style={{ color: k.c }}>
                {k.v}
              </div>
            </div>
          ))}
        </div>
        {/* Pipeline */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {stages.map((s, i) => (
            <div key={s} className="rounded-lg border border-[#E2E8F0] bg-white p-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-[#0B1F33]">{s}</span>
                <span className="rounded bg-[#009FE3]/10 px-1.5 text-[8px] font-bold text-[#009FE3]">
                  {[4, 3, 2, 2][i]}
                </span>
              </div>
              <div className="mt-1.5 space-y-1.5">
                {[0, 1].map((c) => (
                  <div key={c} className="rounded border border-[#E2E8F0] bg-[#F8FCFF] p-1.5">
                    <div className="h-1.5 w-3/4 rounded bg-[#063B8F]/30" />
                    <div className="mt-1 h-1.5 w-1/2 rounded bg-[#009FE3]/40" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* Timeline */}
        <div className="mt-3 rounded-lg border border-[#E2E8F0] bg-white p-3">
          <div className="text-[9px] font-bold text-[#0B1F33]">Client timeline — TECH-2026-000001</div>
          <div className="mt-2 space-y-1.5">
            {[
              ["Enquiry received", "#009FE3"],
              ["Scope approved", "#063B8F"],
              ["Milestone 1 paid", "#18B83A"],
            ].map(([t, c]) => (
              <div key={t} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full" style={{ background: c }} aria-hidden="true" />
                <div className="h-1.5 w-24 rounded bg-[#E2E8F0]" />
                <span className="text-[8px] font-medium text-[#526173]">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="border-t border-[#E2E8F0] bg-white px-4 py-3 text-xs leading-relaxed text-[#526173] sm:px-5">
        <span className="font-semibold text-[#0B1F33]">Illustrative concept.</span>{" "}
        Every lead, message, approval, payment and file linked to one Client ID — this
        concept shows the shape of the console we build around your pipeline.
      </figcaption>
    </BrowserFrame>
  );
}

/* -------------------------------------------------------------- */
/* Operations dashboard concept — KPIs + charts + monitor          */
/* -------------------------------------------------------------- */
export function AdminDashboardConcept() {
  const bars = [40, 65, 45, 80, 55, 70, 90];
  return (
    <BrowserFrame
      address="app.bdtech360.com — operations dashboard (concept)"
      label="Illustrative analytics dashboard concept: KPI cards, a revenue trend chart, and an operations monitor panel"
    >
      <div className="bg-[#F4FAFF] p-4 sm:p-6">
        <div className="h-3 w-32 rounded bg-[#063B8F]" />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { l: "Active projects", v: "12", c: "#009FE3" },
            { l: "Revenue (30d)", v: "$18.4k", c: "#18B83A" },
            { l: "Open tickets", v: "5", c: "#063B8F" },
            { l: "Agent runs", v: "1,455", c: "#526173" },
          ].map((k) => (
            <div key={k.l} className="rounded-lg border border-[#E2E8F0] bg-white p-2.5">
              <div className="text-[8px] font-bold uppercase tracking-wider text-[#526173]">{k.l}</div>
              <div className="mt-0.5 text-sm font-black" style={{ color: k.c }}>
                {k.v}
              </div>
              <div className="mt-1 h-1 w-full rounded bg-[#F1F5F9]">
                <div className="h-1 rounded" style={{ width: `${40 + (k.v.length * 12) % 55}%`, background: k.c }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {/* Chart */}
          <div className="col-span-3 rounded-lg border border-[#E2E8F0] bg-white p-3">
            <div className="text-[9px] font-bold text-[#0B1F33]">Revenue trend</div>
            <div className="mt-2 flex h-20 items-end gap-1.5">
              {bars.map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t"
                  style={{ height: `${h}%`, background: i === bars.length - 1 ? "#18B83A" : "#009FE3", opacity: i === bars.length - 1 ? 1 : 0.75 }}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
          {/* Monitor */}
          <div className="col-span-2 rounded-lg border border-[#E2E8F0] bg-white p-3">
            <div className="flex items-center gap-1.5">
              <span className="size-1.5 animate-pulse rounded-full bg-[#18B83A]" aria-hidden="true" />
              <span className="text-[9px] font-bold text-[#0B1F33]">Ops monitor</span>
            </div>
            <div className="mt-2 space-y-1.5">
              {[
                ["Follow-ups sent", "#18B83A"],
                ["Triaged errors", "#B4472A"],
                ["Approvals pending", "#D97706"],
                ["Executions OK", "#009FE3"],
              ].map(([t, c]) => (
                <div key={t} className="flex items-center justify-between">
                  <div className="h-1.5 w-16 rounded bg-[#E2E8F0]" />
                  <span className="size-1.5 rounded-full" style={{ background: c }} aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <figcaption className="border-t border-[#E2E8F0] bg-white px-4 py-3 text-xs leading-relaxed text-[#526173] sm:px-5">
        <span className="font-semibold text-[#0B1F33]">Illustrative concept.</span>{" "}
        KPIs, trends and operational signals in one view — the kind of dashboard we
        assemble from your real business data.
      </figcaption>
    </BrowserFrame>
  );
}
