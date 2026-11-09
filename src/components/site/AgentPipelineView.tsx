"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight, AtSign, Bot, Briefcase, Check, CheckCircle2, ChevronRight, Clock,
  Code2, Copy, CreditCard, Database, Eye, Facebook, FileText, Globe, Instagram,
  Linkedin, ListChecks, Lock, Mail, MessageCircle, MessageSquare, PackageCheck,
  Send, ShieldCheck, Smartphone, Sparkles, Star, Twitter, UserCog, Users, Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHero } from "./PageHero";
import { SectionHeading } from "./SectionHeading";
import { CtaBand } from "./CtaBand";
import { Reveal, RevealList, RevealItem } from "./Reveal";
import { PrimaryLink, OutlineLink, AIAssistantLink } from "./buttons";
import {
  AI_ADMIN_APPROVAL, AI_ALWAYS_SAVE, AI_AUTO_SEND, CLIENT_ID_FORMAT, CLIENT_ID_PATTERN,
  CRM_PROFILE_FIELDS, FINAL_RULES, PIPELINE_BRAND, PIPELINE_CORE_RULE, PIPELINE_DOMAIN,
  PIPELINE_EMAIL, PIPELINE_WEBCHAT, SPEC_CHANNELS, SPEC_GROUP_TITLES, SPEC_STAGES,
  SPEC_STAGE_GROUPS, type SpecStage,
} from "@/lib/pipeline/spec-copy";

/* ------------------------------------------------------------------ */
/* Shared micro-components                                             */
/* ------------------------------------------------------------------ */

const CHANNEL_ICONS: Record<string, LucideIcon> = {
  WHATSAPP: MessageCircle,
  SMS: Smartphone,
  EMAIL: Mail,
  WEB: Globe,
  FACEBOOK: Facebook,
  MESSENGER: MessageSquare,
  INSTAGRAM: Instagram,
  LINKEDIN: Linkedin,
  X: Twitter,
  ADMIN: UserCog,
};

function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <p className={cn("mb-3 text-xs font-semibold uppercase tracking-[0.22em]", dark ? "text-[#7FD4FF]" : "text-[#009FE3]")}>
      {children}
    </p>
  );
}

function InfoPill({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/[0.07] px-4 py-3 backdrop-blur-sm">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#009FE3]/20 text-[#7FD4FF]">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold uppercase tracking-wider text-white/50">{label}</span>
        <span className="block truncate text-sm font-semibold text-white">{value}</span>
      </span>
    </div>
  );
}

function GateBadge({ gate }: { gate: SpecStage["gate"] }) {
  const admin = gate === "ADMIN_APPROVAL_REQUIRED";
  return (
    <Badge
      className={cn(
        "gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold",
        admin
          ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50"
          : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50"
      )}
    >
      {admin ? <Lock className="size-3" aria-hidden="true" /> : <CheckCircle2 className="size-3" aria-hidden="true" />}
      {admin ? "Admin approval required" : "AI may auto-send"}
    </Badge>
  );
}

function CopyBlock({
  label, text, copyKey, copied, onCopy, tone = "light",
}: {
  label: string;
  text: string;
  copyKey: string;
  copied: string | null;
  onCopy: (text: string, key: string) => void;
  tone?: "light" | "dark";
}) {
  const isCopied = copied === copyKey;
  return (
    <div className={cn(
      "overflow-hidden rounded-xl border",
      tone === "dark" ? "border-white/10 bg-[#07162B]" : "border-[#E2E8F0] bg-[#F8FBFF]"
    )}>
      <div className={cn(
        "flex items-center justify-between gap-2 border-b px-4 py-2.5",
        tone === "dark" ? "border-white/10 bg-white/[0.03]" : "border-[#E2E8F0] bg-white"
      )}>
        <span className={cn("text-xs font-semibold", tone === "dark" ? "text-white/70" : "text-[#526173]")}>{label}</span>
        <button
          type="button"
          onClick={() => onCopy(text, copyKey)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#009FE3]",
            tone === "dark" ? "text-white/60 hover:bg-white/10 hover:text-white" : "text-[#063B8F] hover:bg-[#009FE3]/10"
          )}
          aria-label={`Copy ${label}`}
        >
          {isCopied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
          {isCopied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className={cn(
        "max-h-80 overflow-auto whitespace-pre-wrap px-4 py-4 text-[12.5px] leading-relaxed",
        tone === "dark" ? "text-[#CBDDFF]" : "text-[#0B1F33]"
      )}>{text}</pre>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Brand + core rule                                                */
/* ------------------------------------------------------------------ */

function BrandStrip() {
  return (
    <section className="border-b border-[#E2E8F0] bg-white" aria-labelledby="brand-strip-title">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <Reveal>
          <Eyebrow>One identity · one record</Eyebrow>
          <h2 id="brand-strip-title" className="text-2xl font-bold tracking-tight text-[#0B1F33] sm:text-3xl">
            Every conversation begins with the same verified identity.
          </h2>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-[#526173]">
            The AI agent creates a Client ID, opens a client profile and attaches every message to it —
            from the first SMS to the final review request. Nothing lives in an inbox that the CRM cannot see.
          </p>
        </Reveal>
        <RevealList className="mt-9 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Globe, label: "Website", value: PIPELINE_DOMAIN.replace("https://", "") },
            { icon: AtSign, label: "Official email", value: PIPELINE_EMAIL },
            { icon: Bot, label: "Public webchat", value: PIPELINE_WEBCHAT },
            { icon: Database, label: "Client ID format", value: CLIENT_ID_PATTERN },
          ].map((item) => (
            <RevealItem key={item.label}>
              <div className="flex h-full items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FBFF] p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#009FE3]/10 text-[#0079AC]">
                  <item.icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#526173]">{item.label}</span>
                  <span className="block truncate text-sm font-bold text-[#0B1F33]">{item.value}</span>
                </span>
              </div>
            </RevealItem>
          ))}
        </RevealList>

        <Reveal className="mt-6">
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#063B8F] via-[#07448F] to-[#009FE3] p-6 sm:p-8">
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-white/10 blur-3xl" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9FE2FF]">The non-negotiable rule</p>
                <p className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">{PIPELINE_CORE_RULE}</p>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">
                  An HTML/demo preview is for review. Final source code, full files, admin access and deployment
                  handover are released only after payment is confirmed and an admin approves the handover.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-3 text-white backdrop-blur-sm">
                <Lock className="size-5 text-[#9FE2FF]" aria-hidden="true" />
                <span className="text-sm font-semibold">Enforced in code, not just words</span>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Omnichannel intake                                               */
/* ------------------------------------------------------------------ */

function ChannelsSection() {
  return (
    <section className="bg-[#F4FAFF] py-16 sm:py-20" aria-labelledby="channels-title">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Omnichannel intake"
          title="Ten channels. One client profile."
          description="Every WhatsApp, SMS, email, website form, Facebook, Instagram, LinkedIn, X, Messenger and manual admin message is saved under the client profile and its Client ID."
          id="channels-title"
        />
        <RevealList className="mt-11 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" stagger={0.05}>
          {SPEC_CHANNELS.map((channel) => {
            const Icon = CHANNEL_ICONS[channel.key] ?? MessageCircle;
            return (
              <RevealItem key={channel.key} className="h-full">
                <div className="group flex h-full flex-col rounded-xl border border-[#E2E8F0] bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:border-[#009FE3]/40 hover:shadow-[0_12px_30px_rgba(6,59,143,0.10)]">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-[#063B8F]/5 text-[#063B8F] transition-colors group-hover:bg-[#009FE3]/10 group-hover:text-[#0079AC]">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-sm font-bold text-[#0B1F33]">{channel.label}</h3>
                  <p className="mt-1.5 flex-1 text-xs leading-relaxed text-[#526173]">{channel.detail}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-[#009FE3]">
                    <Database className="size-3" aria-hidden="true" /> Saved in CRM
                  </span>
                </div>
              </RevealItem>
            );
          })}
        </RevealList>
        <Reveal className="mt-8">
          <div className="flex flex-col items-start gap-4 rounded-xl border border-[#009FE3]/20 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Workflow className="mt-0.5 size-5 shrink-0 text-[#009FE3]" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-[#526173]">
                <span className="font-semibold text-[#0B1F33]">Source detection → Client ID → saved inbound → first reply.</span>{" "}
                Webhooks are fail-closed and idempotent; unverified identity claims are never merged into an existing client.
              </p>
            </div>
            <OutlineLink href="#/process" className="shrink-0">See our process <ArrowRight className="size-4" aria-hidden="true" /></OutlineLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 3. CRM contract                                                     */
/* ------------------------------------------------------------------ */

function CrmSection() {
  return (
    <section className="bg-white py-16 sm:py-20" aria-labelledby="crm-title">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="The always-save contract"
          title="The AI creates the profile — and never stops writing to it."
          description="Incoming and outgoing messages, all channel bodies, the Client ID, every status change and timestamp, admin approvals, payment proof and delivery proof."
          id="crm-title"
        />
        <div className="mt-11 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-2xl border border-[#E2E8F0] bg-[#F8FBFF] p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-[#009FE3]/10 text-[#0079AC]">
                  <Briefcase className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-[#0B1F33]">The client profile</h3>
                  <p className="text-xs text-[#526173]">Created at first contact · keyed by {CLIENT_ID_FORMAT}</p>
                </div>
              </div>
              <ul className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {CRM_PROFILE_FIELDS.map((field) => (
                  <li key={field} className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F33]">
                    <CheckCircle2 className="size-3.5 shrink-0 text-[#18B83A]" aria-hidden="true" />
                    {field}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="flex h-full flex-col rounded-2xl border border-[#063B8F]/15 bg-gradient-to-br from-[#063B8F] to-[#0B1F33] p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-white/10 text-[#7FD4FF]">
                  <ListChecks className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-white">AI must always save</h3>
                  <p className="text-xs text-white/60">No message without a record, no record without a timestamp</p>
                </div>
              </div>
              <ol className="mt-6 grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                {AI_ALWAYS_SAVE.map((item, i) => (
                  <li key={item} className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-sm text-white/90">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#009FE3]/25 text-[10px] font-bold text-[#9FE2FF]">{i + 1}</span>
                    {item}
                  </li>
                ))}
              </ol>
              <p className="mt-5 text-xs leading-relaxed text-white/50">
                The client profile is private. This public page shows the contract, never a real client record.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 4. Stage explorer — all 11 stages / 13 exact message variants       */
/* ------------------------------------------------------------------ */

function StageExplorer() {
  const [activeGroup, setActiveGroup] = useState(1);
  const [activeBranch, setActiveBranch] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);

  const group = SPEC_STAGE_GROUPS[activeGroup - 1];
  const entry = group.entries[Math.min(activeBranch, group.entries.length - 1)];
  const activeKey = `${activeGroup}-${activeBranch}`;

  const selectGroup = (n: number) => {
    setActiveGroup(n);
    setActiveBranch(0);
    setCopied(null);
  };

  const onCopy = (text: string, key: string) => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(key);
        window.setTimeout(() => setCopied(null), 1800);
      } catch {
        setCopied(null);
      }
    })();
  };

  const stageGates = useMemo(
    () => SPEC_STAGES.map((s) => ({ id: s.id, gate: s.gate })),
    []
  );

  return (
    <section id="pipeline-stages" className="scroll-mt-4 bg-[#F4FAFF] py-16 sm:py-20" aria-labelledby="stages-title">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="The 11-stage journey"
          title="Read the exact message for every stage."
          description="Select a stage to see the AI's action, its WhatsApp/SMS reply, the email subject and body, the CRM fields it saves, and whether an admin must approve it first."
          id="stages-title"
        />

        <div className="mt-11 grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          {/* Stage rail */}
          <Reveal className="lg:sticky lg:top-4 lg:self-start">
            <nav aria-label="Pipeline stages" className="rounded-2xl border border-[#E2E8F0] bg-white p-3 shadow-[0_8px_30px_rgba(6,59,143,0.06)]">
              <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-1">
                {SPEC_STAGE_GROUPS.map((g) => {
                  const active = g.number === activeGroup;
                  const hasAdmin = g.entries.some((e) => e.gate === "ADMIN_APPROVAL_REQUIRED");
                  return (
                    <li key={g.number}>
                      <button
                        type="button"
                        onClick={() => selectGroup(g.number)}
                        aria-current={active ? "step" : undefined}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left outline-none transition-all focus-visible:ring-2 focus-visible:ring-[#009FE3]",
                          active ? "bg-[#063B8F] text-white shadow-[0_4px_14px_rgba(6,59,143,0.25)]" : "text-[#526173] hover:bg-[#F4FAFF] hover:text-[#063B8F]"
                        )}
                      >
                        <span className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                          active ? "bg-white/15 text-white" : "bg-[#009FE3]/10 text-[#0079AC]"
                        )}>{g.number}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold leading-tight">{g.title}</span>
                          <span className={cn("mt-0.5 block text-[10px]", active ? "text-white/60" : "text-[#526173]/70")}>
                            {g.entries.length > 1 ? `${g.entries.length} branches` : hasAdmin ? "Admin gate" : "Auto-send"}
                          </span>
                        </span>
                        {active ? <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-3 border-t border-[#E2E8F0] px-2.5 pt-3 text-[11px] leading-relaxed text-[#526173]">
                {SPEC_STAGES.length} exact message variants across {SPEC_GROUP_TITLES.length} stages.{" "}
                {stageGates.filter((s) => s.gate === "ADMIN_APPROVAL_REQUIRED").length} require admin approval.
              </div>
            </nav>
          </Reveal>

          {/* Stage detail */}
          <div className="min-w-0">
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_8px_30px_rgba(6,59,143,0.06)] sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#063B8F] to-[#009FE3] text-base font-bold text-white">
                    {entry.stageNumber}{entry.branch ?? ""}
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[#009FE3]">Stage {entry.stageNumber}{entry.branch ?? ""} · {entry.id.replace(/_/g, " ")}</p>
                    <h3 className="mt-1 text-xl font-bold leading-snug text-[#0B1F33] sm:text-2xl">{entry.title}</h3>
                  </div>
                </div>
                <GateBadge gate={entry.gate} />
              </div>

              {group.entries.length > 1 ? (
                <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label={`Stage ${entry.stageNumber} branches`}>
                  {group.entries.map((b, i) => (
                    <button
                      key={b.id}
                      type="button"
                      role="tab"
                      aria-selected={i === activeBranch}
                      onClick={() => { setActiveBranch(i); setCopied(null); }}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#009FE3]",
                        i === activeBranch ? "border-[#009FE3] bg-[#009FE3]/10 text-[#063B8F]" : "border-[#E2E8F0] bg-white text-[#526173] hover:border-[#009FE3]/40"
                      )}
                    >
                      {b.branch} · {b.title.replace(/^\d+[AB] · /, "")}
                    </button>
                  ))}
                </div>
              ) : null}

              {/* AI action */}
              <div className="mt-6 rounded-xl border border-[#009FE3]/20 bg-[#F4FAFF] p-4">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#063B8F]">
                  <Bot className="size-4" aria-hidden="true" /> AI action
                </p>
                <ul className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {entry.aiAction.map((action) => (
                    <li key={action} className="flex items-start gap-2 text-sm leading-relaxed text-[#0B1F33]">
                      <Check className="mt-1 size-3.5 shrink-0 text-[#18B83A]" aria-hidden="true" /> {action}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Exact copy */}
              <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <CopyBlock
                  label="WhatsApp / SMS reply"
                  text={entry.whatsapp}
                  copyKey={`${activeKey}-wa`}
                  copied={copied}
                  onCopy={onCopy}
                />
                <CopyBlock
                  label={`Email · ${entry.emailSubject}`}
                  text={`Subject: ${entry.emailSubject}\n\n${entry.emailBody}`}
                  copyKey={`${activeKey}-email`}
                  copied={copied}
                  onCopy={onCopy}
                  tone="dark"
                />
              </div>

              {/* CRM saves */}
              <div className="mt-6">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#063B8F]">
                  <Database className="size-4" aria-hidden="true" /> CRM saves
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {entry.crmSave.map((field) => (
                    <span key={field} className="rounded-md border border-[#E2E8F0] bg-[#F8FBFF] px-2.5 py-1 font-mono text-[11px] text-[#0B1F33]">
                      {field}
                    </span>
                  ))}
                </div>
              </div>

              {entry.operatorNote ? (
                <p className="mt-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {entry.operatorNote}
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => selectGroup(Math.max(1, activeGroup - 1))}
                disabled={activeGroup === 1}
                className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#526173] outline-none transition-colors hover:border-[#009FE3]/40 hover:text-[#063B8F] focus-visible:ring-2 focus-visible:ring-[#009FE3] disabled:opacity-40"
              >
                ← Previous stage
              </button>
              <span className="text-xs text-[#526173]">Stage {activeGroup} of {SPEC_STAGE_GROUPS.length}</span>
              <button
                type="button"
                onClick={() => selectGroup(Math.min(SPEC_STAGE_GROUPS.length, activeGroup + 1))}
                disabled={activeGroup === SPEC_STAGE_GROUPS.length}
                className="rounded-lg bg-[#063B8F] px-3 py-2 text-xs font-semibold text-white outline-none transition-colors hover:bg-[#009FE3] focus-visible:ring-2 focus-visible:ring-[#009FE3] disabled:opacity-40"
              >
                Next stage →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 5. Gates and final rules                                            */
/* ------------------------------------------------------------------ */

function GatesSection() {
  return (
    <section className="bg-white py-16 sm:py-20" aria-labelledby="gates-title">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Auto-send vs admin approval"
          title="The AI is helpful — and deliberately not authorised to do everything."
          description="Auto-send is an allowlist. Everything else fails closed: an unknown stage or an amount, invoice, legal, dispute or delivery-link marker requires an admin decision first."
          id="gates-title"
        />
        <div className="mt-11 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><Send className="size-5" aria-hidden="true" /></span>
                <div>
                  <h3 className="text-lg font-bold text-[#0B1F33]">AI can auto-send</h3>
                  <p className="text-xs text-[#526173]">{AI_AUTO_SEND.length} explicitly allowed messages</p>
                </div>
              </div>
              <ol className="mt-6 space-y-2">
                {AI_AUTO_SEND.map((item, i) => (
                  <li key={item} className="flex items-center gap-3 rounded-lg border border-emerald-100 bg-white px-3 py-2.5 text-sm text-[#0B1F33]">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-700">{i + 1}</span>
                    {item}
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="h-full rounded-2xl border border-amber-200 bg-amber-50/50 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg bg-amber-100 text-amber-800"><Lock className="size-5" aria-hidden="true" /></span>
                <div>
                  <h3 className="text-lg font-bold text-[#0B1F33]">Admin approval required</h3>
                  <p className="text-xs text-[#526173]">{AI_ADMIN_APPROVAL.length} hard gates before anything is sent</p>
                </div>
              </div>
              <ul className="mt-6 space-y-2">
                {AI_ADMIN_APPROVAL.map((item) => (
                  <li key={item} className="flex items-center gap-3 rounded-lg border border-amber-100 bg-white px-3 py-2.5 text-sm text-[#0B1F33]">
                    <ShieldCheck className="size-4 shrink-0 text-amber-700" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <Reveal className="mt-6">
          <div className="rounded-2xl bg-gradient-to-br from-[#063B8F] to-[#0B1F33] p-6 sm:p-8">
            <Eyebrow dark>Final rules</Eyebrow>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FINAL_RULES.map((rule) => (
                <li key={rule} className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-3 text-sm text-white/90">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#7FD4FF]" aria-hidden="true" />
                  {rule}
                </li>
              ))}
            </ul>
            <p className="mt-5 text-xs leading-relaxed text-white/50">
              The sender refuses to release source code before confirmed payment, never publishes sensitive files in
              client-facing content, redacts phone numbers from AI-generated copy, and records an audit event for
              every status change and approval decision.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 6. The two policies                                                 */
/* ------------------------------------------------------------------ */

function PolicySection() {
  const policies = [
    {
      icon: Eye,
      step: "01",
      title: "HTML Preview Before Payment",
      body: "After the Scope of Work is approved, an HTML/demo preview is shared so you can review the design, structure and project direction. A preview link is harmless: it contains no source code, no credentials and no deployable files. The client replies Approved, Need revision or Need meeting.",
      note: "Preview notification is auto-sent · tracked with preview_sent_date",
    },
    {
      icon: Code2,
      step: "02",
      title: "Source Code After Full Payment",
      body: "Payment is confirmed and recorded, then final delivery is prepared. The delivery notice is sent, but the actual file links, source code, admin access and deployment handover are released only after an admin approves the handover. After delivery the client confirms receipt and a password change.",
      note: "admin_approval_required_for_file_release = yes · delivery proof saved",
    },
  ];
  return (
    <section className="bg-[#F4FAFF] py-16 sm:py-20" aria-labelledby="policy-title">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="The delivery promise"
          title="Two gates, in this order. No exceptions."
          description="The rule is visible on the website, present in every relevant message, enforced by the send layer and re-checked before any file is released."
          id="policy-title"
        />
        <RevealList className="mt-11 grid grid-cols-1 gap-6 lg:grid-cols-2" stagger={0.1}>
          {policies.map((p) => (
            <RevealItem key={p.title} className="h-full">
              <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white p-6 sm:p-8">
                <span aria-hidden="true" className="pointer-events-none absolute -right-4 -top-8 text-[8rem] font-black leading-none text-[#009FE3]/[0.06]">{p.step}</span>
                <span className="relative flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#063B8F] to-[#009FE3] text-white">
                  <p.icon className="size-6" aria-hidden="true" />
                </span>
                <h3 className="relative mt-5 text-xl font-bold text-[#0B1F33]">{p.title}</h3>
                <p className="relative mt-3 flex-1 text-sm leading-relaxed text-[#526173]">{p.body}</p>
                <p className="relative mt-5 rounded-lg border border-[#009FE3]/20 bg-[#F4FAFF] px-3 py-2.5 font-mono text-[11px] text-[#063B8F]">{p.note}</p>
              </div>
            </RevealItem>
          ))}
        </RevealList>
        <Reveal className="mt-6">
          <div className="flex flex-col items-start gap-4 rounded-xl border border-[#063B8F]/15 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <CreditCard className="mt-0.5 size-5 shrink-0 text-[#009FE3]" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-[#526173]">
                <span className="font-semibold text-[#0B1F33]">Payment-specific messages are never improvised.</span>{" "}
                An amount, invoice or payment instruction is created by an admin-approved action; the AI only
                acknowledges a payment that has already been recorded.
              </p>
            </div>
            <OutlineLink href="#/legal/terms" className="shrink-0">Read the terms <ArrowRight className="size-4" aria-hidden="true" /></OutlineLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 7. Start a project — real, consent-gated intake form                */
/* ------------------------------------------------------------------ */

type IntakeForm = {
  name: string;
  email: string;
  businessName: string;
  businessType: string;
  details: string;
  consent: boolean;
};

const EMPTY_FORM: IntakeForm = {
  name: "", email: "", businessName: "", businessType: "", details: "", consent: false,
};

function StartProjectSection() {
  const [form, setForm] = useState<IntakeForm>(EMPTY_FORM);
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [result, setResult] = useState<{ clientId?: string; message?: string } | null>(null);

  const set = (key: keyof IntakeForm, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const canSubmit = form.name.trim().length > 1 && /\S+@\S+\.\S+/.test(form.email) &&
    form.details.trim().length >= 20 && form.consent;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit || status === "submitting") return;
    setStatus("submitting");
    setResult(null);
    const requestId = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}0`;
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          name: form.name.trim(),
          email: form.email.trim(),
          businessName: form.businessName.trim(),
          businessType: form.businessType.trim(),
          details: form.details.trim(),
          preferredContact: "Email",
          consent: true,
          tracking: { utm_source: "AI_AGENT_PIPELINE_PAGE", utm_medium: "website_form", landingPath: "/pipeline" },
        }),
      });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      const message = typeof data.error === "string" ? data.error
        : typeof data.message === "string" ? data.message
        : "We could not save your enquiry. Please try again or email us.";
      if (!res.ok || data.ok === false) {
        // A 202 reviewPending is honest, not a fake success: the enquiry is
        // saved but a Client ID needs operator verification of contact ownership.
        setStatus(data.reviewPending === true ? "success" : "error");
        setResult({ message });
        return;
      }
      setStatus("success");
      setResult({
        clientId: typeof data.clientId === "string" ? data.clientId : undefined,
        message: typeof data.message === "string" ? data.message : "Your enquiry was saved. Our AI agent will reply with your Client ID and next steps.",
      });
      setForm(EMPTY_FORM);
    } catch {
      setStatus("error");
      setResult({ message: "The request could not reach the server. Please try again in a moment." });
    }
  };

  const inputClass = "w-full rounded-lg border border-[#E2E8F0] bg-white px-3.5 py-2.5 text-sm text-[#0B1F33] outline-none transition-colors placeholder:text-[#94A3B8] focus:border-[#009FE3] focus:ring-2 focus:ring-[#009FE3]/20";
  const labelClass = "mb-1.5 block text-xs font-semibold text-[#0B1F33]";

  return (
    <section id="pipeline-start" className="scroll-mt-4 bg-white py-16 sm:py-20" aria-labelledby="start-title">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <Reveal>
            <Eyebrow>Start at stage one</Eyebrow>
            <h2 id="start-title" className="text-3xl font-bold tracking-tight text-[#0B1F33] sm:text-4xl">
              Send the first message. Watch the whole pipeline begin.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-[#526173]">
              This form posts to the real consent-gated intake API. On success the CRM creates your Client ID
              and stores the enquiry; the AI agent follows up with the exact Stage 1 reply shown above.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                { icon: ShieldCheck, text: "Explicit consent and a request ID are required — no silent opt-ins." },
                { icon: Database, text: "Your message is saved under a new Client ID, never merged on an unverified claim." },
                { icon: Clock, text: "No payment is due at this stage. Scope, preview and pricing come later." },
                { icon: Lock, text: "Never send passwords, API keys or payment-card codes through this form." },
              ].map((item) => (
                <li key={item.text} className="flex items-start gap-3 text-sm leading-relaxed text-[#526173]">
                  <item.icon className="mt-0.5 size-4 shrink-0 text-[#009FE3]" aria-hidden="true" />
                  {item.text}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryLink href="#/portal">Track an existing project <ArrowRight className="size-4" aria-hidden="true" /></PrimaryLink>
              <AIAssistantLink label="Chat with the AI agent" />
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FBFF] p-5 shadow-[0_12px_40px_rgba(6,59,143,0.08)] sm:p-7">
              {status === "success" ? (
                <div className="flex min-h-[420px] flex-col items-center justify-center text-center" aria-live="polite">
                  <span className="flex size-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="size-8" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-2xl font-bold text-[#0B1F33]">Enquiry saved</h3>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-[#526173]">{result?.message}</p>
                  {result?.clientId ? (
                    <p className="mt-4 rounded-lg border border-[#009FE3]/20 bg-white px-4 py-2.5 font-mono text-sm font-bold text-[#063B8F]">
                      {result.clientId}
                    </p>
                  ) : (
                    <p className="mt-4 rounded-lg border border-[#E2E8F0] bg-white px-4 py-2.5 font-mono text-xs text-[#526173]">
                      Client ID format: {CLIENT_ID_FORMAT}
                    </p>
                  )}
                  <p className="mt-4 text-xs text-[#526173]">Keep this ID handy — our AI agent will reference it in the first reply.</p>
                  <Button type="button" variant="outline" className="mt-6" onClick={() => { setStatus("idle"); setResult(null); }}>
                    Send another enquiry
                  </Button>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="pl-name" className={labelClass}>Your name *</label>
                      <input id="pl-name" name="name" required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Ayesha Rahman" className={inputClass} />
                    </div>
                    <div>
                      <label htmlFor="pl-email" className={labelClass}>Email *</label>
                      <input id="pl-email" name="email" type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@company.com" className={inputClass} />
                    </div>
                    <div>
                      <label htmlFor="pl-company" className={labelClass}>Business name</label>
                      <input id="pl-company" name="company" value={form.businessName} onChange={(e) => set("businessName", e.target.value)} placeholder="e.g. Sunrise Trading" className={inputClass} />
                    </div>
                    <div>
                      <label htmlFor="pl-type" className={labelClass}>Business type</label>
                      <input id="pl-type" name="businessType" value={form.businessType} onChange={(e) => set("businessType", e.target.value)} placeholder="e.g. Retail / eCommerce" className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="pl-details" className={labelClass}>What do you need? * <span className="font-normal text-[#526173]">(at least 20 characters)</span></label>
                    <textarea
                      id="pl-details" name="message" required minLength={20} rows={5}
                      value={form.details} onChange={(e) => set("details", e.target.value)}
                      placeholder="Tell us about the problem you want to solve, the system you need, and your expected timeline."
                      className={cn(inputClass, "resize-y")}
                    />
                    <p className="mt-1 text-right text-[11px] text-[#526173]">{form.details.trim().length}/20 minimum</p>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#E2E8F0] bg-white p-3">
                    <input
                      type="checkbox" required checked={form.consent}
                      onChange={(e) => set("consent", e.target.checked)}
                      className="mt-0.5 size-4 shrink-0 accent-[#009FE3]"
                    />
                    <span className="text-xs leading-relaxed text-[#526173]">
                      I consent to Tech360 storing this enquiry, creating a Client ID and contacting me about my project.
                      I understand the <a href="#/legal/privacy" className="font-semibold text-[#063B8F] underline">privacy policy</a> applies.
                    </span>
                  </label>
                  {status === "error" && result?.message ? (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800" role="alert">{result.message}</p>
                  ) : null}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button type="submit" disabled={!canSubmit || status === "submitting"} className="min-h-11 bg-[#009FE3] px-6 text-sm font-semibold text-white hover:bg-[#0090CC]">
                      {status === "submitting" ? "Saving…" : "Send my enquiry"} <Send className="ml-2 size-4" aria-hidden="true" />
                    </Button>
                    <p className="text-[11px] text-[#526173]">Or email <a href={`mailto:${PIPELINE_EMAIL}`} className="font-semibold text-[#063B8F] underline">{PIPELINE_EMAIL}</a></p>
                  </div>
                </form>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 8. Closing coordination                                            */
/* ------------------------------------------------------------------ */

function CoordinationSection() {
  const links = [
    { icon: PackageCheck, title: "Client portal", body: "Sign in with your Client ID to see status, approvals and delivery history.", href: "#/portal" },
    { icon: Workflow, title: "How we work", body: "The seven-phase production process behind every approved Scope of Work.", href: "#/process" },
    { icon: FileText, title: "Scope & policy", body: "Read the terms, privacy policy and payment/handover terms in one place.", href: "#/legal/terms" },
    { icon: Star, title: "Reviews & referrals", body: "Stage 11 closes the project with a review request and an optional recommendation.", href: "#/contact" },
  ];
  return (
    <section className="border-t border-[#E2E8F0] bg-white py-16 sm:py-20" aria-labelledby="coordination-title">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Everything connected" title="One pipeline, one website, one source of truth." id="coordination-title" />
        <RevealList className="mt-11 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" stagger={0.07}>
          {links.map((link) => (
            <RevealItem key={link.title} className="h-full">
              <a href={link.href} className="group flex h-full flex-col rounded-xl border border-[#E2E8F0] bg-[#F8FBFF] p-5 outline-none transition-all hover:-translate-y-1 hover:border-[#009FE3]/40 hover:shadow-[0_12px_30px_rgba(6,59,143,0.10)] focus-visible:ring-2 focus-visible:ring-[#009FE3]">
                <span className="flex size-10 items-center justify-center rounded-lg bg-[#009FE3]/10 text-[#0079AC]"><link.icon className="size-5" aria-hidden="true" /></span>
                <h3 className="mt-4 text-sm font-bold text-[#0B1F33]">{link.title}</h3>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-[#526173]">{link.body}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#009FE3]">Open <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span>
              </a>
            </RevealItem>
          ))}
        </RevealList>
        <Reveal className="mt-8">
          <p className="rounded-xl border border-[#E2E8F0] bg-[#F8FBFF] px-4 py-3 text-xs leading-relaxed text-[#526173]">
            <span className="font-semibold text-[#0B1F33]">About this copy:</span> this page shows the approved master wording.
            The live sender adds consent and legal clarifications to the same messages, and the enforced auto-send / admin
            gates are checked before anything leaves the CRM. The read-only API at{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[#063B8F]">/api/pipeline/public</code>{" "}
            exposes this same contract without any client data.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function AgentPipelineView() {
  return (
    <div>
      <PageHero
        eyebrow="AI Agent Communication Pipeline"
        title="From the first SMS to final delivery — on record, every step."
        description={`${PIPELINE_BRAND} runs one transparent, eleven-stage journey: Client ID, exact replies, saved messages, admin gates, HTML preview, confirmed payment and a documented handover. You always know what happens next.`}
        breadcrumb={[{ label: "AI Agent Pipeline" }]}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <InfoPill icon={Globe} label="Brand" value={PIPELINE_BRAND} />
          <InfoPill icon={Bot} label="Public webchat" value={PIPELINE_WEBCHAT} />
          <InfoPill icon={Database} label="Client ID" value={CLIENT_ID_FORMAT} />
          <InfoPill icon={Users} label="Channels saved" value={`${SPEC_CHANNELS.length} channels`} />
        </div>
        <div className="mt-7 flex flex-wrap gap-3">
          <PrimaryLink
            href="#/pipeline"
            onClick={(e) => { e.preventDefault(); document.getElementById("pipeline-start")?.scrollIntoView({ behavior: "smooth" }); }}
          >
            Start your project <ArrowRight className="size-4" aria-hidden="true" />
          </PrimaryLink>
          <OutlineLink
            href="#/pipeline"
            dark
            onClick={(e) => { e.preventDefault(); document.getElementById("pipeline-stages")?.scrollIntoView({ behavior: "smooth" }); }}
          >
            Explore all 11 stages <ChevronRight className="size-4" aria-hidden="true" />
          </OutlineLink>
          <AIAssistantLink label="Chat with the AI agent" />
        </div>
        <p className="mt-5 flex items-center gap-2 text-xs text-white/60">
          <Sparkles className="size-3.5 text-[#7FD4FF]" aria-hidden="true" />
          {PIPELINE_CORE_RULE}
        </p>
      </PageHero>

      <BrandStrip />
      <ChannelsSection />
      <CrmSection />
      <StageExplorer />
      <GatesSection />
      <PolicySection />
      <StartProjectSection />
      <CoordinationSection />
      <CtaBand
        title="Ready to start at stage one?"
        description="Send one enquiry. We will create your Client ID, save every message, share a preview before payment and hand over source code only after full payment."
        primaryLabel="Start Your Project"
        primaryHref="#/contact"
      />
    </div>
  );
}
