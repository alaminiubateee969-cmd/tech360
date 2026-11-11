"use client";

import { BarChart3, BriefcaseBusiness, FileLock2, Headphones, Link2, MessagesSquare, ShieldCheck, UsersRound } from "lucide-react";
import { PRODUCED_SYSTEMS } from "@/data/site";
import { PageHero } from "./PageHero";
import { CtaBand } from "./CtaBand";

const benefits = [
  { icon: BriefcaseBusiness, title: "Connected operations", text: "Bring important business processes together around your team's needs." },
  { icon: MessagesSquare, title: "Customer relationships", text: "Organize enquiries, customer information, and follow-up workflows." },
  { icon: UsersRound, title: "Portals and team workflows", text: "Give customers and team members a clearer way to collaborate and access information." },
  { icon: BarChart3, title: "Business reporting", text: "Bring the information you need into useful views for day-to-day decisions." },
  { icon: FileLock2, title: "Document management", text: "Discuss document access and safeguards appropriate to your business and its requirements." },
  { icon: Link2, title: "Integrations", text: "Connect supported systems where feasible, subject to provider access and the agreed scope." },
  { icon: Headphones, title: "Continuity and support", text: "Agree on support, maintenance, backup, and recovery responsibilities for your project." },
  { icon: ShieldCheck, title: "Ownership and handover", text: "Data ownership, deliverables, and handover terms are documented in your agreement." },
];

export default function PlatformView() {
  return (
    <div>
      <PageHero
        eyebrow="Company-in-a-Box"
        title="Your Business. One Connected Platform. Complete Control."
        description="Connect the people, information, and workflows that help your business move forward. We work with you to define a solution around your goals and an agreed scope."
        breadcrumb={[{ label: "Platform" }]}
      >
        <div className="flex flex-wrap gap-3">
          <a href="#templates" className="inline-flex min-h-11 items-center rounded-lg bg-[#009FE3] px-6 text-sm font-semibold text-white hover:bg-[#0090CC] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Explore the possibilities</a>
          <a href="/contact" className="inline-flex min-h-11 items-center rounded-lg border border-white/30 px-6 text-sm font-semibold text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Discuss your needs</a>
        </div>
      </PageHero>

      <section id="templates" aria-labelledby="benefits-title" className="bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#063B8F]">Built around your business</p>
            <h2 id="benefits-title" className="mt-3 text-3xl font-bold tracking-tight text-[#0B1F33] sm:text-4xl">A clearer view of the work that matters</h2>
            <p className="mt-4 text-base leading-7 text-[#526173]">From first enquiry to everyday operations, a connected solution can reduce friction and help your people work together. Capabilities are selected and agreed for each engagement.</p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map(({ icon: Icon, title, text }) => (
              <article key={title} className="rounded-2xl border border-slate-200 bg-[#F8FBFD] p-6">
                <div className="flex size-11 items-center justify-center rounded-xl bg-[#E4F3FC] text-[#063B8F]"><Icon className="size-5" aria-hidden="true" /></div>
                <h3 className="mt-5 text-lg font-bold text-[#0B1F33]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#526173]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="messenger" aria-labelledby="collaboration-title" className="bg-[#0B1F33] py-16 text-white sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#7FD4FF]">Connected communication</p>
            <h2 id="collaboration-title" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Keep conversations and work moving</h2>
            <p className="mt-4 max-w-xl leading-7 text-slate-300">Customer communication and team workflows can be brought together where appropriate. Channels, integrations, privacy requirements, and support depend on your project and provider availability.</p>
            <a href="/process" className="mt-6 inline-flex min-h-11 items-center font-semibold text-[#7FD4FF] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">See how delivery works</a>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/5 p-7 sm:p-9">
            <p className="text-sm font-semibold text-[#7FD4FF]">Your project, clearly defined</p>
            <ul className="mt-5 space-y-4 text-sm leading-6 text-slate-200">
              <li>Understand the workflows and systems you want to connect.</li>
              <li>Agree on deliverables, security considerations, and responsibilities.</li>
              <li>Plan support and handover in your written scope of work.</li>
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="scenarios-title" className="bg-[#F5F9FC] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#063B8F]">Industry possibilities</p>
          <h2 id="scenarios-title" className="mt-3 text-3xl font-bold tracking-tight text-[#0B1F33] sm:text-4xl">Designed for different ways of working</h2>
          <p className="mt-4 max-w-3xl leading-7 text-[#526173]">These are illustrative concepts, not verified customer projects or a promise of ready-to-use products. Features and delivery depend on the agreed scope.</p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCED_SYSTEMS.map((system) => (
              <article id={system.slug} key={system.slug} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wider text-[#063B8F]">{system.category} · Illustrative concept</p>
                <h3 className="mt-3 text-lg font-bold text-[#0B1F33]">{system.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#526173]">{system.whatYouGet}</p>
              </article>
            ))}
          </div>
          <a href="/industries" className="mt-8 inline-flex min-h-11 items-center font-semibold text-[#063B8F] underline underline-offset-4">Explore industries</a>
        </div>
      </section>
      <CtaBand title="Let's connect your business" description="Tell us about your goals. We can discuss the capabilities, integrations, support, and handover terms that fit your project." />
    </div>
  );
}
