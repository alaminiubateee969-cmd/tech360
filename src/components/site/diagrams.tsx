"use client";

/**
 * Hand-coded diagram components (diagram-design parity) — replacing raster
 * images with vector-crisp, English-only, brand-styled diagrams.
 * Every label is real text: sharp at any DPI, accessible to screen readers
 * (aria-labels), and honest — no AI-generated pseudo-screens.
 */

const NAVY = "#0B1F33";
const BLUE = "#063B8F";
const CYAN = "#009FE3";
const GREEN = "#18B83A";
const SLATE = "#526173";
const LINE = "#E2E8F0";
const BG = "#F4FAFF";

function Wrap({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`w-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-white ${className}`}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------- */
/* 1. Development lifecycle — 7-phase pipeline with feedback loop  */
/* -------------------------------------------------------------- */
export function DevLifecycleDiagram() {
  const phases = [
    { n: "01", t: "Discovery", d: "Requirements & business context" },
    { n: "02", t: "Scope", d: "Written scope, milestone plan" },
    { n: "03", t: "Design", d: "Architecture & data model" },
    { n: "04", t: "Build", d: "Version-controlled sprints" },
    { n: "05", t: "Review", d: "Preview approval gate" },
    { n: "06", t: "Verify", d: "Quality & security checks" },
    { n: "07", t: "Release", d: "Deploy, hand over, support" },
  ];
  return (
    <Wrap label="Development lifecycle diagram: seven phases from discovery to release, with a feedback loop from verification back to build">
      <div className="bg-white p-5 sm:p-7">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
          {phases.map((p, i) => (
            <div
              key={p.n}
              className="relative rounded-lg border border-[#E2E8F0] bg-[#F8FCFF] p-3"
            >
              <div
                className="text-[10px] font-black tracking-widest"
                style={{ color: i === 4 ? GREEN : CYAN }}
              >
                {p.n}
              </div>
              <div className="mt-1 text-xs font-bold text-[#0B1F33]">{p.t}</div>
              <div className="mt-1 text-[10px] leading-snug text-[#526173]">{p.d}</div>
              {i < phases.length - 1 && (
                <svg
                  viewBox="0 0 24 12"
                  className="absolute -right-3 top-1/2 hidden h-2.5 w-6 -translate-y-1/2 lg:block"
                  aria-hidden="true"
                >
                  <path d="M0 6h18m0 0-4-4m4 4-4 4" stroke={CYAN} strokeWidth="2" fill="none" />
                </svg>
              )}
            </div>
          ))}
        </div>
        <svg viewBox="0 0 800 34" className="mt-2 h-8 w-full" aria-hidden="true">
          <path
            d="M720 4 C720 26 80 26 80 8"
            stroke={GREEN}
            strokeWidth="2"
            strokeDasharray="6 4"
            fill="none"
          />
          <path d="M80 8 76 16m4-8 8 2" stroke={GREEN} strokeWidth="2" fill="none" />
          <text x="400" y="22" textAnchor="middle" fontSize="10" fontWeight="600" fill={GREEN}>
            feedback loops — findings flow back before release
          </text>
        </svg>
      </div>
    </Wrap>
  );
}

/* -------------------------------------------------------------- */
/* 2. Quality checklist — the delivery gate                       */
/* -------------------------------------------------------------- */
export function QualityChecklistDiagram() {
  const groups = [
    {
      h: "Functional",
      color: CYAN,
      items: ["Feature walk-through vs scope", "Cross-browser pass", "Forms & flows E2E", "Client UAT sign-off"],
    },
    {
      h: "Performance",
      color: BLUE,
      items: ["Page-load budget", "Database query review", "Asset optimization", "Uptime probe"],
    },
    {
      h: "Security",
      color: GREEN,
      items: ["Auth & RBAC checks", "CSRF & rate limits", "Dependency audit", "Secret scan"],
    },
    {
      h: "Delivery",
      color: NAVY,
      items: ["Docs & credentials pack", "Source handover", "Runbook & support plan", "Post-launch monitor"],
    },
  ];
  return (
    <Wrap label="Quality checklist diagram: functional, performance, security and delivery gates verified together before sign-off">
      <div className="bg-white p-5 sm:p-7">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {groups.map((g) => (
            <div key={g.h} className="rounded-lg border border-[#E2E8F0] p-4">
              <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-2.5">
                <span className="size-2.5 rounded-full" style={{ background: g.color }} aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: g.color }}>
                  {g.h}
                </span>
              </div>
              <ul className="mt-2.5 space-y-2">
                {g.items.map((it) => (
                  <li key={it} className="flex items-start gap-2">
                    <svg viewBox="0 0 16 16" className="mt-0.5 size-3.5 shrink-0" aria-hidden="true">
                      <circle cx="8" cy="8" r="7" fill={g.color} opacity="0.12" />
                      <path
                        d="m4.5 8.2 2.2 2.2 4.8-4.8"
                        stroke={g.color}
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                    <span className="text-[11px] leading-snug text-[#526173]">{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-[#F2FBF4] px-4 py-2.5">
          <span className="size-2 rounded-full bg-[#18B83A]" aria-hidden="true" />
          <span className="text-[11px] font-semibold text-[#158029]">
            All four groups pass — together — before anything ships
          </span>
        </div>
      </div>
    </Wrap>
  );
}

/* -------------------------------------------------------------- */
/* 3. Technology stack — layered                                  */
/* -------------------------------------------------------------- */
export function TechStackDiagram() {
  const layers = [
    { t: "Interface", tech: "Next.js · TypeScript · Tailwind CSS · shadcn/ui", c: CYAN },
    { t: "Application", tech: "Node.js · Laravel · Python · REST & webhook APIs", c: BLUE },
    { t: "Data", tech: "PostgreSQL · MySQL · Prisma ORM · Redis cache", c: NAVY },
    { t: "Infrastructure", tech: "Google Cloud Run · Cloud SQL · Secret Manager", c: GREEN },
    { t: "Automation", tech: "n8n · WhatsApp Cloud API · LLM agent runtime", c: SLATE },
  ];
  return (
    <Wrap label="Technology stack diagram: interface, application, data, infrastructure and automation layers">
      <div className="space-y-2 bg-white p-5 sm:p-7">
        {layers.map((l, i) => (
          <div key={l.t} className="flex items-stretch gap-3">
            <div
              className="flex w-8 items-center justify-center rounded-lg text-[10px] font-black text-white sm:w-11 sm:text-xs"
              style={{ background: l.c }}
              aria-hidden="true"
            >
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="flex flex-1 flex-col justify-center rounded-lg border border-[#E2E8F0] bg-[#F8FCFF] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm font-bold text-[#0B1F33]">{l.t}</span>
              <span className="mt-1 text-[11px] font-medium text-[#526173] sm:mt-0">{l.tech}</span>
            </div>
          </div>
        ))}
      </div>
    </Wrap>
  );
}

/* -------------------------------------------------------------- */
/* 4. Cloud architecture — deployment topology                    */
/* -------------------------------------------------------------- */
function CloudBox({
  title,
  sub,
  accent = "#063B8F",
}: {
  title: string;
  sub: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2.5 text-center">
      <div className="text-[11px] font-bold" style={{ color: accent }}>
        {title}
      </div>
      <div className="mt-0.5 text-[10px] leading-snug text-[#526173]">{sub}</div>
    </div>
  );
}

export function CloudArchitectureDiagram() {
  return (
    <Wrap label="Cloud architecture diagram: users connect through a CDN and load balancer to Google Cloud Run services, backed by Cloud SQL, Secret Manager and monitoring">
      <div className="bg-white p-5 sm:p-7">
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-[#F8FCFF] px-4 py-2">
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
              <circle cx="12" cy="8" r="3.5" fill={CYAN} />
              <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke={CYAN} strokeWidth="2.4" fill="none" strokeLinecap="round" />
            </svg>
            <span className="text-xs font-bold text-[#0B1F33]">Users — web, mobile, portals</span>
          </div>
        </div>
        <svg viewBox="0 0 400 26" className="mx-auto h-6 w-full max-w-sm" aria-hidden="true">
          <path d="M200 2v18" stroke={CYAN} strokeWidth="2" strokeDasharray="5 4" />
          <path d="m195 16 5 6 5-6" stroke={CYAN} strokeWidth="2" fill="none" />
        </svg>
        <div className="rounded-xl border-2 border-dashed border-[#009FE3]/40 bg-[#F8FCFF] p-4">
          <div className="mb-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-[#063B8F]">
            Google Cloud — project
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <CloudBox title="Cloud Run" sub="App container, autoscaled" accent={CYAN} />
            <CloudBox title="Cloud SQL" sub="Managed database" accent={BLUE} />
            <CloudBox title="Secret Manager" sub="Credentials & keys" accent={GREEN} />
            <CloudBox title="Monitoring" sub="Logs, alerts, uptime" accent={NAVY} />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <CloudBox title="CI/CD pipeline" sub="Build · test · deploy on push" accent={CYAN} />
            <CloudBox title="Object storage" sub="Documents & assets" accent={BLUE} />
            <CloudBox title="Scheduled jobs" sub="Ops loop & maintenance" accent={SLATE} />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-medium text-[#526173]">
          <span className="size-1.5 rounded-full bg-[#18B83A]" aria-hidden="true" />
          Encrypted in transit (TLS) and at rest
        </div>
      </div>
    </Wrap>
  );
}

/* -------------------------------------------------------------- */
/* 5. Security architecture — defense in depth                    */
/* -------------------------------------------------------------- */
export function SecurityArchitectureDiagram() {
  const rings = [
    { t: "Identity", d: "Passwords (scrypt) · TOTP 2FA · session revocation", w: "90%", c: CYAN },
    { t: "Access control", d: "Role-based permissions · ownership checks on every record", w: "78%", c: BLUE },
    { t: "Request defenses", d: "CSRF double-submit · rate limiting · input sanitization", w: "66%", c: GREEN },
    { t: "Data protection", d: "HTTP-only cookies · HMAC tokens · encrypted transport", w: "54%", c: NAVY },
    { t: "Audit & recovery", d: "Immutable audit trail · error logs · backups · CI secret scan", w: "42%", c: SLATE },
  ];
  return (
    <Wrap label="Security architecture diagram: five concentric defense layers — identity, access control, request defenses, data protection, audit and recovery">
      <div className="space-y-2 bg-white p-5 sm:p-7">
        {rings.map((r) => (
          <div key={r.t} className="flex items-center gap-3">
            <div className="w-36 shrink-0 text-right sm:w-44">
              <span className="text-xs font-bold text-[#0B1F33]">{r.t}</span>
            </div>
            <div
              className="flex min-w-0 flex-1 items-center overflow-hidden rounded-lg px-3 py-2"
              style={{ background: `${r.c}14`, borderLeft: `3px solid ${r.c}` }}
            >
              <span className="truncate text-[10px] font-medium text-[#526173] sm:text-[11px]">{r.d}</span>
            </div>
          </div>
        ))}
      </div>
    </Wrap>
  );
}

/* -------------------------------------------------------------- */
/* 6. Automation workflow — trigger to verified outcome           */
/* -------------------------------------------------------------- */
export function AutomationWorkflowDiagram() {
  const steps = [
    { t: "Trigger", d: "Event, schedule or form" },
    { t: "AI agent", d: "Classify, draft, decide" },
    { t: "Guardrails", d: "Approvals, quotas, RBAC" },
    { t: "Channel", d: "Email, SMS, chat, web" },
    { t: "Record", d: "Logged to the Client ID" },
  ];
  return (
    <Wrap label="Automation workflow diagram: trigger, AI agent, guardrails, channel and record — every run is logged and verified">
      <div className="bg-white p-5 sm:p-7">
        <div className="flex flex-col items-stretch gap-2 lg:flex-row lg:items-center">
          {steps.map((s, i) => (
            <div key={s.t} className="flex flex-1 flex-col items-center lg:flex-row">
              <div className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FCFF] px-4 py-3 text-center lg:w-auto lg:flex-1">
                <div className="text-xs font-bold" style={{ color: i === 1 ? CYAN : BLUE }}>
                  {s.t}
                </div>
                <div className="mt-0.5 text-[10px] leading-snug text-[#526173]">{s.d}</div>
              </div>
              {i < steps.length - 1 && (
                <svg
                  viewBox="0 0 24 24"
                  className="mx-1 hidden size-4 shrink-0 rotate-90 lg:rotate-0"
                  aria-hidden="true"
                >
                  <path d="M4 12h14m0 0-5-5m5 5-5 5" stroke={CYAN} strokeWidth="2" fill="none" strokeLinecap="round" />
                </svg>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            ["Every run logged", "Execution records with inputs and outputs"],
            ["Failures honest", "Errors surface — nothing silently skipped"],
            ["Human gate", "High-impact actions require approval"],
          ].map(([h, d]) => (
            <div key={h} className="rounded-lg bg-[#F2FBF4] px-3.5 py-2.5">
              <div className="text-[11px] font-bold text-[#158029]">{h}</div>
              <div className="mt-0.5 text-[10px] leading-snug text-[#526173]">{d}</div>
            </div>
          ))}
        </div>
      </div>
    </Wrap>
  );
}

/* -------------------------------------------------------------- */
/* 7. Features & modules — one platform, connected modules        */
/* -------------------------------------------------------------- */
export function FeaturesModulesDiagram() {
  const modules = [
    { t: "Website", d: "Public presence & content" },
    { t: "CRM", d: "Leads, clients, pipeline" },
    { t: "Automation", d: "Workflows & AI agents" },
    { t: "Payments", d: "Invoices & milestones" },
    { t: "Portal", d: "Client self-service" },
    { t: "Analytics", d: "Reports & dashboards" },
  ];
  return (
    <Wrap label="Platform modules diagram: six connected modules — website, CRM, automation, payments, portal and analytics — all linked to one Client ID">
      <div className="bg-white p-5 sm:p-7">
        <div className="mx-auto mb-3 flex w-fit items-center gap-2 rounded-lg bg-[#063B8F] px-5 py-2.5">
          <svg viewBox="0 0 24 24" className="size-4 text-[#7FD4FF]" aria-hidden="true">
            <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" stroke="currentColor" strokeWidth="1.8" fill="none" />
            <circle cx="12" cy="12" r="2.4" fill="currentColor" />
          </svg>
          <span className="text-xs font-bold text-white">One Client ID — every module linked</span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {modules.map((m) => (
            <div
              key={m.t}
              className="rounded-lg border border-[#E2E8F0] bg-[#F8FCFF] px-4 py-3 transition-colors hover:border-[#009FE3]/40"
            >
              <div className="text-xs font-bold text-[#0B1F33]">{m.t}</div>
              <div className="mt-0.5 text-[10px] leading-snug text-[#526173]">{m.d}</div>
            </div>
          ))}
        </div>
        <svg viewBox="0 0 600 26" className="mx-auto h-6 w-full" aria-hidden="true">
          <line x1="40" y1="13" x2="560" y2="13" stroke={CYAN} strokeWidth="1.6" strokeDasharray="4 4" />
          {modules.map((_, i) => (
            <circle key={i} cx={40 + (520 / 5) * i} cy="13" r="3.4" fill={CYAN} />
          ))}
        </svg>
        <p className="text-center text-[10px] font-medium text-[#526173]">
          Services you pick combine into one platform — not separate tools
        </p>
      </div>
    </Wrap>
  );
}

/* -------------------------------------------------------------- */
/* 8. Delivery & handover — what changes hands                    */
/* -------------------------------------------------------------- */
export function DeliveryHandoverDiagram() {
  const items = [
    { t: "Source code", d: "Full repository history", icon: "code" },
    { t: "Credentials", d: "Accounts & secrets, transferred securely", icon: "key" },
    { t: "Documentation", d: "Architecture, runbook, API notes", icon: "doc" },
    { t: "Roadmap", d: "What comes next, prioritized", icon: "map" },
  ];
  const icons: Record<string, React.ReactNode> = {
    code: (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path d="m8 6-5 6 5 6M16 6l5 6-5 6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    ),
    key: (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <circle cx="8" cy="14" r="4" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="m11 11 8-8m-3 3 3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    doc: (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path d="M7 3h7l4 4v14H7V3Z" stroke="currentColor" strokeWidth="2" fill="none" />
        <path d="M10 12h6M10 16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    map: (
      <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
        <path d="M5 19V5l7 2 7-2v14l-7 2-7-2Z" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="12" cy="11" r="1.6" fill="currentColor" />
      </svg>
    ),
  };
  return (
    <Wrap label="Delivery and handover diagram: source code, credentials, documentation and roadmap transferred to the client as a structured event">
      <div className="bg-white p-5 sm:p-7">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {items.map((it) => (
            <div key={it.t} className="flex items-start gap-3 rounded-lg border border-[#E2E8F0] bg-[#F8FCFF] p-4">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#063B8F]/10 text-[#063B8F]">
                {icons[it.icon]}
              </span>
              <div>
                <div className="text-xs font-bold text-[#0B1F33]">{it.t}</div>
                <div className="mt-0.5 text-[10px] leading-snug text-[#526173]">{it.d}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-[#063B8F] px-4 py-3">
          <span className="text-[11px] font-semibold text-white">TECH360 delivers</span>
          <svg viewBox="0 0 60 12" className="h-3 w-14" aria-hidden="true">
            <path d="M0 6h50m0 0-5-5m5 5-5 5" stroke="#7FD4FF" strokeWidth="2" fill="none" strokeLinecap="round" />
          </svg>
          <span className="text-[11px] font-semibold text-white">You own everything</span>
        </div>
      </div>
    </Wrap>
  );
}
