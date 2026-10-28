"use client";

/**
 * Editorial diagram kit — data-driven SVG diagrams in the spirit of
 * cathrynlavery/diagram-design (MIT) and tt-a1i/archify (MIT):
 *
 *   · no drop shadows, hairline strokes, flat fills
 *   · ONE focal accent per diagram (the thing the reader must look at first)
 *   · mono "eyebrow" labels for types/protocols, sans for names
 *   · every label is real text; each diagram has <title>/<desc> and an
 *     aria-label that spells out the whole flow for screen readers
 *   · box widths follow a per-character width budget (0.6em/char + padding,
 *     rounded up to a multiple of 4) so labels never overflow their boxes
 *
 * Types provided: Sequence, Funnel, Swimlane. Instances for Tech360 are at the
 * bottom (portal OTP sign-in, lead-to-handover funnel, who-does-what swimlane).
 * Brand palette is kept (not the originals' tangerine) so it matches the site.
 */

import { useId } from "react";

const INK = "#0B1F33";
const MUTED = "#526173";
const SOFT = "#8392A5";
const RULE = "#D5DEE8";
const PAPER = "#FFFFFF";
const PAPER2 = "#F4FAFF";
const ACCENT = "#009FE3"; // the single focal colour
const ACCENT_TINT = "rgba(0,159,227,0.09)";
const SANS = "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif";
const MONO = "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace";

/** Width budget: 0.6em per character + horizontal padding, rounded up to a multiple of 4. */
export function textBudget(label: string, fontSize = 12, pad = 24): number {
  return Math.ceil((label.length * fontSize * 0.6 + pad) / 4) * 4;
}

function Frame({
  uid,
  title,
  desc,
  eyebrow,
  minWidth,
  viewBox,
  children,
}: {
  uid: string;
  title: string;
  desc: string;
  eyebrow: string;
  minWidth: number;
  viewBox: string;
  children: React.ReactNode;
}) {
  const id = uid;
  return (
    <figure className="w-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-white">
      <div className="overflow-x-auto">
        <svg
          viewBox={viewBox}
          role="img"
          aria-labelledby={`${id}-t ${id}-d`}
          style={{ minWidth, width: "100%", height: "auto", display: "block", background: PAPER }}
        >
          <title id={`${id}-t`}>{title}</title>
          <desc id={`${id}-d`}>{desc}</desc>
          <defs>
            <marker id={`${id}-ah`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,1 L9,5 L0,9 Z" fill={MUTED} />
            </marker>
            <marker id={`${id}-af`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,1 L9,5 L0,9 Z" fill={ACCENT} />
            </marker>
          </defs>
          <text x="24" y="28" fontFamily={MONO} fontSize="9" letterSpacing="1.6" fill={SOFT} style={{ textTransform: "uppercase" }}>
            {eyebrow}
          </text>
          <text x="24" y="52" fontFamily={SANS} fontSize="17" fontWeight="700" fill={INK}>
            {title}
          </text>
          <g>{children}</g>
        </svg>
      </div>
    </figure>
  );
}

/** Markers are per-instance ids; children need them — expose via a tiny helper. */
function markerIds(id: string) {
  return { plain: `url(#${id}-ah)`, focal: `url(#${id}-af)` };
}

/* ================================================================ */
/* SEQUENCE — messages over time between actors                      */
/* ================================================================ */

export type SequenceMessage = {
  from: number;
  to: number;
  label: string;
  /** mono sub-label: protocol, channel, field */
  note?: string;
  dashed?: boolean;
  focal?: boolean;
};

export function SequenceDiagram({
  title,
  eyebrow = "Sequence",
  actors,
  messages,
}: {
  title: string;
  eyebrow?: string;
  actors: { name: string; sub?: string }[];
  messages: SequenceMessage[];
}) {
  const uid = useId().replace(/:/g, "");
  const m = markerIds(uid);
  const colW = Math.max(180, 880 / actors.length);
  const left = 24 + colW / 2;
  const x = (i: number) => left + i * colW;
  const top = 76;
  const rowH = 52;
  const width = 48 + colW * actors.length;
  const height = top + 56 + messages.length * rowH + 24;
  const spoken = messages.map((s, i) => `${i + 1}. ${actors[s.from].name} to ${actors[s.to].name}: ${s.label}`).join(". ");

  return (
    <Frame
      uid={uid}
      title={title}
      eyebrow={eyebrow}
      desc={spoken}
      minWidth={Math.min(width, 720)}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* actor heads + lifelines */}
      {actors.map((a, i) => {
        const w = Math.max(textBudget(a.name, 12, 28), 112);
        return (
          <g key={a.name}>
            <rect x={x(i) - w / 2} y={top} width={w} height={40} rx="6" fill={PAPER2} stroke={RULE} />
            <text x={x(i)} y={top + 18} textAnchor="middle" fontFamily={SANS} fontSize="12" fontWeight="600" fill={INK}>{a.name}</text>
            {a.sub ? <text x={x(i)} y={top + 32} textAnchor="middle" fontFamily={MONO} fontSize="8" letterSpacing="0.6" fill={SOFT}>{a.sub}</text> : null}
            <line x1={x(i)} x2={x(i)} y1={top + 40} y2={height - 20} stroke={RULE} strokeDasharray="3 4" />
          </g>
        );
      })}
      {/* messages */}
      {messages.map((s, i) => {
        const y = top + 76 + i * rowH;
        const x1 = x(s.from);
        const x2 = x(s.to);
        const self = s.from === s.to;
        const color = s.focal ? ACCENT : MUTED;
        const marker = s.focal ? m.focal : m.plain;
        const mid = (x1 + x2) / 2;
        const w = Math.max(textBudget(s.label, 11, 14), s.note ? textBudget(s.note, 8, 14) : 0);
        return (
          <g key={`${s.label}-${i}`}>
            {self ? (
              <path d={`M${x1},${y} h36 v22 h-34`} fill="none" stroke={color} strokeWidth={s.focal ? 1.75 : 1.25} markerEnd={marker} strokeDasharray={s.dashed ? "5 4" : undefined} />
            ) : (
              <line x1={x1} y1={y} x2={x2 + (x2 > x1 ? -2 : 2)} y2={y} stroke={color} strokeWidth={s.focal ? 1.75 : 1.25} markerEnd={marker} strokeDasharray={s.dashed ? "5 4" : undefined} />
            )}
            <rect x={(self ? x1 + 44 : mid) - (self ? 0 : w / 2)} y={y - 22} width={w} height={s.note ? 28 : 18} fill={PAPER} />
            <text x={self ? x1 + 48 : mid} y={y - 9} textAnchor={self ? "start" : "middle"} fontFamily={SANS} fontSize="11" fontWeight={s.focal ? 700 : 500} fill={s.focal ? ACCENT : INK}>
              {i + 1}. {s.label}
            </text>
            {s.note ? (
              <text x={self ? x1 + 48 : mid} y={y + 2} textAnchor={self ? "start" : "middle"} fontFamily={MONO} fontSize="8" letterSpacing="0.5" fill={SOFT}>{s.note}</text>
            ) : null}
          </g>
        );
      })}
    </Frame>
  );
}

/* ================================================================ */
/* FUNNEL — ranked stages, drop-off from top to bottom               */
/* ================================================================ */

export function FunnelDiagram({
  title,
  eyebrow = "Funnel",
  stages,
  focal,
}: {
  title: string;
  eyebrow?: string;
  stages: { label: string; sub?: string }[];
  /** index of the one stage to emphasise */
  focal?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const width = 880;
  const top = 76;
  const rowH = 46;
  const gap = 4;
  const maxW = 640;
  const minW = 300;
  const cx = width / 2;
  const height = top + stages.length * (rowH + gap) + 28;
  const wAt = (i: number) => maxW - ((maxW - minW) * i) / Math.max(stages.length - 1, 1);

  return (
    <Frame
      uid={uid}
      title={title}
      eyebrow={eyebrow}
      desc={stages.map((s, i) => `Stage ${i + 1}: ${s.label}${s.sub ? `, ${s.sub}` : ""}`).join(". ")}
      minWidth={640}
      viewBox={`0 0 ${width} ${height}`}
    >
      {stages.map((s, i) => {
        const y = top + i * (rowH + gap);
        const w1 = wAt(i);
        const w2 = i === stages.length - 1 ? w1 - 28 : wAt(i + 1) + 0;
        const isFocal = focal === i;
        const pts = `${cx - w1 / 2},${y} ${cx + w1 / 2},${y} ${cx + w2 / 2},${y + rowH} ${cx - w2 / 2},${y + rowH}`;
        return (
          <g key={s.label}>
            <polygon points={pts} fill={isFocal ? ACCENT_TINT : PAPER2} stroke={isFocal ? ACCENT : RULE} strokeWidth={isFocal ? 1.5 : 1} />
            <text x={cx} y={y + (s.sub ? 19 : 27)} textAnchor="middle" fontFamily={SANS} fontSize="12.5" fontWeight={isFocal ? 700 : 600} fill={INK}>{s.label}</text>
            {s.sub ? <text x={cx} y={y + 34} textAnchor="middle" fontFamily={MONO} fontSize="8.5" letterSpacing="0.4" fill={MUTED}>{s.sub}</text> : null}
            <text x={cx - wAt(i) / 2 - 14} y={y + 27} textAnchor="end" fontFamily={MONO} fontSize="9" fill={SOFT}>{String(i + 1).padStart(2, "0")}</text>
          </g>
        );
      })}
    </Frame>
  );
}

/* ================================================================ */
/* SWIMLANE — who does what, in order                                */
/* ================================================================ */

export type SwimStep = { lane: number; col: number; label: string; focal?: boolean; gate?: boolean };

export function SwimlaneDiagram({
  title,
  eyebrow = "Swimlane",
  lanes,
  steps,
  cols,
}: {
  title: string;
  eyebrow?: string;
  lanes: string[];
  steps: SwimStep[];
  cols: number;
}) {
  const uid = useId().replace(/:/g, "");
  const m = markerIds(uid);
  const laneLabelW = 120;
  const colW = 140;
  const laneH = 76;
  const top = 72;
  const width = 24 + laneLabelW + cols * colW + 24;
  const height = top + lanes.length * laneH + 24;
  const bw = colW - 28;
  const pos = (s: SwimStep) => ({ x: 24 + laneLabelW + s.col * colW + 14, y: top + s.lane * laneH + 16 });

  const wrap = (label: string): string[] => {
    const max = Math.floor((bw - 16) / 6.4);
    const words = label.split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      if ((cur + " " + w).trim().length > max) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim();
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 3);
  };

  return (
    <Frame
      uid={uid}
      title={title}
      eyebrow={eyebrow}
      desc={steps
        .slice()
        .sort((a, b) => a.col - b.col)
        .map((s, i) => `${i + 1}. ${lanes[s.lane]}: ${s.label}${s.gate ? " (gate)" : ""}`)
        .join(". ")}
      minWidth={Math.min(width, 820)}
      viewBox={`0 0 ${width} ${height}`}
    >
      {lanes.map((l, i) => (
        <g key={l}>
          <rect x="24" y={top + i * laneH} width={width - 48} height={laneH} fill={i % 2 ? PAPER : PAPER2} stroke={RULE} />
          <text x="36" y={top + i * laneH + laneH / 2 + 4} fontFamily={MONO} fontSize="9.5" letterSpacing="1" fill={MUTED} style={{ textTransform: "uppercase" }}>{l}</text>
        </g>
      ))}
      <line x1={24 + laneLabelW} x2={24 + laneLabelW} y1={top} y2={top + lanes.length * laneH} stroke={RULE} />
      {steps.slice(0, -1).map((s, i) => {
        const n = steps[i + 1];
        const a = pos(s);
        const b = pos(n);
        const focal = n.focal || s.focal;
        const sx = a.x + bw;
        const sy = a.y + 22;
        const ex = b.x;
        const ey = b.y + 22;
        const mx = (sx + ex) / 2;
        return (
          <path key={`l${i}`} d={`M${sx},${sy} C${mx},${sy} ${mx},${ey} ${ex - 2},${ey}`} fill="none" stroke={focal ? ACCENT : SOFT} strokeWidth={focal ? 1.6 : 1.1} markerEnd={focal ? m.focal : m.plain} />
        );
      })}
      {steps.map((s, i) => {
        const { x, y } = pos(s);
        const lines = wrap(s.label);
        return (
          <g key={`${s.label}-${i}`}>
            <rect x={x} y={y} width={bw} height="44" rx={s.gate ? 22 : 6} fill={s.focal ? ACCENT_TINT : PAPER} stroke={s.focal ? ACCENT : INK} strokeWidth={s.focal ? 1.6 : 1} />
            {lines.map((ln, k) => (
              <text key={k} x={x + bw / 2} y={y + (lines.length === 1 ? 26 : lines.length === 2 ? 20 + k * 13 : 15 + k * 12)} textAnchor="middle" fontFamily={SANS} fontSize="11" fontWeight={s.focal ? 700 : 500} fill={INK}>{ln}</text>
            ))}
          </g>
        );
      })}
    </Frame>
  );
}

/* ================================================================ */
/* Tech360 instances                                                 */
/* ================================================================ */

export function PortalSignInSequence() {
  return (
    <SequenceDiagram
      eyebrow="Security · Sequence"
      title="Client portal sign-in with a one-time code"
      actors={[
        { name: "Client", sub: "BROWSER" },
        { name: "Tech360 Portal", sub: "NEXT.JS API" },
        { name: "Message channel", sub: "EMAIL · WHATSAPP · SMS" },
      ]}
      messages={[
        { from: 0, to: 1, label: "Client ID + email or phone", note: "POST /api/portal/login" },
        { from: 1, to: 1, label: "Match record, rate-limit" },
        { from: 1, to: 2, label: "Send 6-digit code", note: "to the contact on file", focal: true },
        { from: 2, to: 0, label: "Code arrives (valid 10 min)", dashed: true, focal: true },
        { from: 0, to: 1, label: "Enter the code", note: "signed challenge + code" },
        { from: 1, to: 0, label: "Secure session cookie", note: "HttpOnly · SameSite", dashed: true },
      ]}
    />
  );
}

export function LeadFunnel() {
  return (
    <FunnelDiagram
      eyebrow="Pipeline · Funnel"
      title="From first message to handover"
      focal={3}
      stages={[
        { label: "First message", sub: "any channel → Client ID" },
        { label: "Scope & questions", sub: "business detection · plan" },
        { label: "Approved scope", sub: "admin + client approval" },
        { label: "HTML preview", sub: "shown BEFORE any payment" },
        { label: "Verified payment", sub: "milestones confirmed by finance" },
        { label: "Build & review", sub: "tasks · testing · client review" },
        { label: "Final payment", sub: "gate to source release" },
        { label: "Handover", sub: "source package · credentials · support" },
      ]}
    />
  );
}

export function ProjectSwimlane() {
  return (
    <SwimlaneDiagram
      eyebrow="Delivery · Swimlane"
      title="Who does what, in order"
      lanes={["Client", "AI workforce", "Tech360 team"]}
      cols={7}
      steps={[
        { lane: 0, col: 0, label: "Sends first message" },
        { lane: 1, col: 1, label: "Creates Client ID, drafts scope" },
        { lane: 2, col: 2, label: "Reviews & approves scope", gate: true },
        { lane: 1, col: 3, label: "Builds HTML preview" },
        { lane: 0, col: 4, label: "Reviews preview, approves", focal: true, gate: true },
        { lane: 2, col: 5, label: "Verifies payment, starts build" },
        { lane: 2, col: 6, label: "Delivers & hands over source" },
      ]}
    />
  );
}
