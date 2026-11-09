"use client";

import { ArrowDownRight, ArrowRight } from "lucide-react";
import { EDUCATION_SOLUTIONS } from "@/data/education-solutions";
import { ImageView } from "./ImageView";

export default function EducationSolutions() {
  return (
    <section aria-labelledby="education-solutions-heading" className="bg-[#f6f9fc]">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr] lg:items-end">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#007ba9]">Education / solutions</p>
            <h2 id="education-solutions-heading" className="mt-3 max-w-2xl text-3xl font-bold tracking-tight text-[#0b1f33] sm:text-4xl">A clearer digital experience for every learning community.</h2></div>
          <p className="max-w-xl text-base leading-relaxed text-slate-600">From institutional profiles to admissions and day-to-day operations, explore the building blocks that can be tailored to your organisation.</p>
        </div>
        <p className="mt-6 rounded-lg border border-[#bdd9e7] bg-white px-4 py-3 text-sm leading-relaxed text-slate-600">Illustrative solution scopes, not live institution profiles or verified product features. Programmes, facilities and workflows must be supplied and approved by each institution.</p>
        <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {EDUCATION_SOLUTIONS.map((item) => (
            <button type="button" onClick={() => document.getElementById(`education-${item.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })} key={item.id} className="group text-left overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009fe3]">
              <ImageView src={item.image} alt="" aspect="16/10" imgClassName="transition-transform duration-500 group-hover:scale-105" />
              <div className="p-5"><p className="text-xs font-semibold uppercase tracking-wider text-[#007ba9]">Education</p><div className="mt-2 flex items-start justify-between gap-3"><h3 className="text-lg font-semibold text-[#0b1f33]">{item.name}</h3><ArrowDownRight className="size-5 shrink-0 text-[#009fe3]" aria-hidden="true" /></div><p className="mt-2 text-sm leading-relaxed text-slate-600">{item.summary}</p><span className="mt-4 block text-sm font-semibold text-[#006d9b]">Explore the scope</span></div>
            </button>
          ))}
        </div>
        <div className="mt-16 space-y-6">
          {EDUCATION_SOLUTIONS.map((item, index) => (
            <article id={`education-${item.id}`} key={item.id} className="scroll-mt-24 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="grid lg:grid-cols-[0.72fr_1.28fr]"><div className="relative min-h-60 bg-[#0b1f33]"><ImageView src={item.image} alt="" className="absolute inset-0" /><div className="absolute inset-0 bg-gradient-to-t from-[#061d2b]/95 via-[#061d2b]/35 to-transparent" /><div className="absolute inset-x-0 bottom-0 p-6 text-white"><p className="text-xs font-semibold uppercase tracking-widest text-[#8ce5f1]">Solution 0{index + 1}</p><h3 className="mt-2 text-2xl font-bold">{item.name}</h3><p className="mt-2 text-sm text-white/85">{item.audience}</p></div></div>
                <div className="p-6 sm:p-8"><p className="text-sm leading-relaxed text-slate-600">{item.summary}</p><dl className="mt-6 grid gap-5 sm:grid-cols-2">{[['Academic programmes & services', item.programs], ['Organisation & governance', item.structure], ['Facilities & distinctive features', item.facilities], ['Illustrative workflow', item.workflow]].map(([title, text]) => <div key={title}><dt className="text-sm font-semibold text-[#0b1f33]">{title}</dt><dd className="mt-1.5 text-sm leading-relaxed text-slate-600">{text}</dd></div>)}</dl><a href="#/contact" className="mt-7 inline-flex min-h-11 items-center gap-2 font-semibold text-[#006d9b] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009fe3]">Discuss your requirements <ArrowRight className="size-4" aria-hidden="true" /></a></div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
