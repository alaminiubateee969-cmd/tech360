"use client";

import { Building2, GitBranch, Layers, Puzzle, Rocket, MessageCircle, Shield, Workflow, Package, Globe, Users, Check } from "lucide-react";
import { COMPANY, PLATFORM_PILLARS, PRODUCED_SYSTEMS, AI_NATIVE_MESSENGER } from "@/data/site";
import { PageHero } from "./PageHero";
import { CtaBand } from "./CtaBand";
import { Reveal, RevealList, RevealItem } from "./Reveal";

const pillarIcons: Record<string, typeof Layers> = {
  "template-library": Layers,
  "module-engine": Puzzle,
  "company-provisioning": Building2,
  "version-control": GitBranch,
  "deployment-recovery": Rocket,
};

export default function PlatformView() {
  return (
    <main id="main-content">
      <PageHero
        eyebrow="Platform"
        title="Company-in-a-Box. Software Factory."
        description="A complete, private, self-controlled platform for businesses that need to own their software, their data, and their future. Five pillars — Template Library, Module Engine, Company Provisioning, Version Control, Deployment & Recovery — engineered for worldwide operations with no country lock-in."
        breadcrumb={[{ label: "Platform" }]}
        actions={[
          { label: "Explore Templates", href: "#templates", variant: "primary" },
          { label: "See AI Messenger", href: "#messenger", variant: "secondary" },
        ]}
      />

      {/* AI-Native Messenger — Teamily.ai inspired */}
      <section id="messenger" className="bg-gradient-to-b from-[#0B1220] to-[#0F172A] py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#18B83A]">{AI_NATIVE_MESSENGER.eyebrow}</p>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{AI_NATIVE_MESSENGER.title}</h2>
              <p className="mt-4 text-base leading-7 text-slate-300">{AI_NATIVE_MESSENGER.description}</p>
              <div className="mt-8 grid gap-4">
                {AI_NATIVE_MESSENGER.capabilities.map((c) => (
                  <div key={c.title} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#009FE3]">
                      <MessageCircle className="h-5 w-5 text-white" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{c.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-slate-400">{c.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#/contact" className="inline-flex min-h-11 items-center rounded-lg bg-[#009FE3] px-6 text-sm font-semibold text-white hover:bg-[#0090CC]">Start with Messenger</a>
                <a href="#/pipeline" className="inline-flex min-h-11 items-center rounded-lg border border-white/20 bg-transparent px-6 text-sm font-semibold text-white hover:bg-white/10">View Pipeline</a>
              </div>
            </div>
            <div className="relative">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-6 backdrop-blur">
                <div className="space-y-3">
                  <div className="rounded-xl bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#009FE3]">First SMS — Email Gate</p>
                    <p className="mt-2 text-sm leading-relaxed text-[#0B1F33]">Thanks for reaching out to TECH360. To create your Client ID and keep your project securely on file, please share your email address.</p>
                    <p className="mt-2 text-[11px] text-slate-400">→ Visitor replies: sarah@company.com</p>
                  </div>
                  <div className="rounded-xl bg-[#0B1F33] p-4 text-white">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#18B83A]">Auto-created</p>
                    <p className="mt-2 text-sm">Client ID: <span className="font-mono font-bold text-white">TECH-2026-000042</span></p>
                    <p className="mt-1 text-xs text-slate-300">Your project is now tracked worldwide — services, scopes, payments and deliveries all under this ID.</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-[#009FE3] p-3 text-center">
                      <Globe className="mx-auto h-5 w-5 text-white" />
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white">Worldwide</p>
                    </div>
                    <div className="rounded-lg bg-[#063B8F] p-3 text-center">
                      <Shield className="mx-auto h-5 w-5 text-white" />
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white">Private</p>
                    </div>
                    <div className="rounded-lg bg-[#18B83A] p-3 text-center">
                      <Workflow className="mx-auto h-5 w-5 text-white" />
                      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white">Self-Controlled</p>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-slate-500">No country lock-in. Your company, your data, worldwide.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Company-in-a-Box — 5 Pillars */}
      <section className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#009FE3]">Company-in-a-Box</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0B1F33] sm:text-4xl">Five pillars. One private platform.</h2>
            <p className="mt-4 text-base leading-7 text-[#526173]">Every industry system we deliver is built from the same factory. Not assembled from scattered tools — engineered as a complete, private platform you control.</p>
          </div>

          <RevealList className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PLATFORM_PILLARS.map((p) => {
              const Icon = pillarIcons[p.key] ?? Layers;
              return (
                <RevealItem key={p.key} className="flex flex-col rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm transition hover:shadow-md">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B1F33] text-white">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-[#0B1F33]">{p.title}</h3>
                  <p className="mt-1 text-sm font-medium text-[#009FE3]">{p.tagline}</p>
                  <p className="mt-3 text-sm leading-relaxed text-[#526173]">{p.description}</p>
                  <div className="mt-4 rounded-xl bg-[#F4FAFF] p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#063B8F]">What you get</p>
                    <ul className="mt-2 space-y-1.5">
                      {p.provides.map((it) => (
                        <li key={it} className="flex gap-2 text-xs leading-relaxed text-[#526173]">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#18B83A]" aria-hidden="true" />
                          {it}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <p className="mt-4 border-t border-slate-100 pt-4 text-xs italic leading-relaxed text-slate-500">Why used: {p.whyUsed}</p>
                </RevealItem>
              );
            })}
          </RevealList>

          <div className="mt-10 rounded-2xl bg-[#0B1F33] p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <h3 className="text-xl font-bold text-white">Private. Self-controlled. Yours.</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">Unlike SaaS that holds your data hostage, your Company-in-a-Box is provisioned as an isolated environment with explicit grants, versioned templates and one-click recovery — engineered for businesses that must own their operations.</p>
              </div>
              <div className="flex shrink-0 gap-3">
                <div className="rounded-xl bg-white/10 px-5 py-3 text-center">
                  <p className="text-2xl font-extrabold text-white">12+</p>
                  <p className="text-xs text-slate-400">Templates</p>
                </div>
                <div className="rounded-xl bg-white/10 px-5 py-3 text-center">
                  <p className="text-2xl font-extrabold text-white">8</p>
                  <p className="text-xs text-slate-400">Core Modules</p>
                </div>
                <div className="rounded-xl bg-white/10 px-5 py-3 text-center">
                  <p className="text-2xl font-extrabold text-white">∞</p>
                  <p className="text-xs text-slate-400">Companies</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Produced Systems — What you get per industry */}
      <section id="templates" className="bg-[#F4FAFF] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#009FE3]">Produced Systems</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-[#0B1F33] sm:text-4xl">Industry systems, produced — not promised.</h2>
            <p className="mt-4 text-base leading-7 text-[#526173]">Each produced system is a live application template — not a mockup. Provision it, brand it, launch it. Every industry reference below maps to a real module composition.</p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCED_SYSTEMS.map((s) => (
              <div key={s.slug} className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
                <p className="text-xs font-bold uppercase tracking-wide text-[#009FE3]">{s.category}</p>
                <h3 className="mt-2 text-lg font-bold text-[#0B1F33]">{s.title}</h3>
                <p className="mt-1 text-xs text-slate-400">Design ref: {s.imageRef}</p>
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl bg-[#0B1F33] p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#18B83A]">What you get from us</p>
                    <p className="mt-1 text-sm leading-relaxed text-white">{s.whatYouGet}</p>
                  </div>
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#063B8F]">Why this industry uses it</p>
                    <p className="mt-1 text-sm leading-relaxed text-[#526173]">{s.whyIndustry}</p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#F4FAFF] px-3 py-1 text-xs font-medium text-[#063B8F]"><Package className="h-3.5 w-3.5" /> Template</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#F4FAFF] px-3 py-1 text-xs font-medium text-[#063B8F]"><Puzzle className="h-3.5 w-3.5" /> Modules</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 rounded-2xl border border-[#009FE3]/20 bg-white p-6 sm:p-8">
            <h3 className="text-lg font-bold text-[#0B1F33]">How every produced system is built</h3>
            <div className="mt-6 grid gap-4 sm:grid-cols-5">
              {[
                { step: "01", title: "Template", desc: "Choose industry template" },
                { step: "02", title: "Modules", desc: "Compose capabilities" },
                { step: "03", title: "Provision", desc: "Create isolated company" },
                { step: "04", title: "Version", desc: "Stage & approve" },
                { step: "05", title: "Deploy", desc: "Launch & monitor" },
              ].map((s) => (
                <div key={s.step} className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#0B1F33] text-sm font-bold text-white">{s.step}</div>
                  <p className="mt-3 text-sm font-semibold text-[#0B1F33]">{s.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{s.desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-xs text-slate-500">Template Library → Module Engine → Company Provisioning → Version Control → Deployment & Recovery</p>
          </div>
        </div>
      </section>

      {/* Global promise */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-gradient-to-r from-[#009FE3] to-[#063B8F] p-8 text-white sm:p-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                  <Globe className="h-4 w-4" /> Worldwide Service — No Country Lock-in
                </div>
                <h2 className="mt-4 text-2xl font-extrabold sm:text-3xl">We build for industries, not geographies.</h2>
                <p className="mt-3 text-sm leading-relaxed text-white/90">Whether you run a school, clinic, hotel, store or factory — your system is provisioned privately, operates globally and remains fully under your control. No data residency surprises. No vendor hold.</p>
              </div>
              <div className="grid shrink-0 grid-cols-2 gap-3">
                <div className="rounded-xl bg-white p-4 text-center">
                  <Users className="mx-auto h-6 w-6 text-[#009FE3]" />
                  <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[#0B1F33]">Human + AI</p>
                  <p className="mt-1 text-[11px] text-slate-500">Teams together</p>
                </div>
                <div className="rounded-xl bg-white p-4 text-center">
                  <Shield className="mx-auto h-6 w-6 text-[#18B83A]" />
                  <p className="mt-2 text-xs font-bold uppercase tracking-wide text-[#0B1F33]">Private</p>
                  <p className="mt-1 text-[11px] text-slate-500">Self-controlled</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Reveal>
        <CtaBand
          title="Build your Company-in-a-Box"
          description="Tell us your industry and what you need to run — we will provision your private system from proven templates and stay with you from setup to scale."
        />
      </Reveal>
    </main>
  );
}
