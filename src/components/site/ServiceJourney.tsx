"use client";

import { useState } from "react";
import { ArrowRight, Check, Layers3, ShieldCheck } from "lucide-react";

type Journey = { label: string; title: string; description: string; outcome: string; steps: string[] };
const JOURNEYS: Record<string, { eyebrow: string; heading: string; intro: string; items: Journey[] }> = {
  "custom-crm-development": {
    eyebrow: "CRM / Solution walkthrough", heading: "A clearer path from enquiry to relationship.",
    intro: "Explore a possible CRM workflow tailored to the way your team sells and serves.",
    items: [
      { label: "Capture", title: "Bring enquiries into one view", description: "Structure customer and enquiry information around the fields your team needs.", outcome: "Give staff a clearer starting point for follow-up.", steps: ["Capture enquiry", "Create client record", "Assign an owner"] },
      { label: "Organise", title: "Make the pipeline visible", description: "Design stages and activities around your actual sales and delivery process.", outcome: "Help the team see what needs attention next.", steps: ["Define stages", "Track activity", "Review next steps"] },
      { label: "Collaborate", title: "Keep the context together", description: "Connect relevant notes, documents and approvals within an agreed client workflow.", outcome: "Reduce the need to reconstruct context across disconnected tools.", steps: ["Review history", "Coordinate tasks", "Record decisions"] },
      { label: "Understand", title: "Turn activity into insight", description: "Choose reporting views based on the questions your team needs to answer.", outcome: "Support more informed decisions with relevant data.", steps: ["Choose measures", "Review reports", "Refine the process"] },
    ],
  },
  "ai-business-automation": {
    eyebrow: "Automation / Solution walkthrough", heading: "Move routine work forward, with people in control.",
    intro: "See how a proposed automation can connect a business event to an actionable, reviewed workflow.",
    items: [
      { label: "Identify", title: "Start with the process", description: "Map the event, the information involved and the people responsible for each decision.", outcome: "Make the automation's boundaries clear before implementation.", steps: ["Identify trigger", "Map inputs", "Define owner"] },
      { label: "Design", title: "Connect the right steps", description: "Design the rules, validation and integrations needed for the agreed workflow.", outcome: "Give the team a consistent way to handle routine work.", steps: ["Validate input", "Apply rules", "Prepare action"] },
      { label: "Review", title: "Keep decisions accountable", description: "Set human approval points for actions that need oversight, including external communication.", outcome: "Keep consequential decisions with authorised people.", steps: ["Prepare draft", "Review details", "Approve or reject"] },
      { label: "Improve", title: "Learn from the workflow", description: "Review outcomes and exceptions with the people who operate the process.", outcome: "Identify where the process needs refinement.", steps: ["Review activity", "Investigate issues", "Adjust rules"] },
    ],
  },
};
JOURNEYS["n8n-workflow-automation"] = JOURNEYS["ai-business-automation"];

export default function ServiceJourney({ slug }: { slug: string }) {
  const [selected, setSelected] = useState(0);
  const journey = JOURNEYS[slug];
  if (!journey) return null;
  const active = journey.items[selected] ?? journey.items[0];
  return (
    <section aria-labelledby="journey-heading" className="overflow-hidden bg-[#071e2e] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:px-8 lg:py-24">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#79dce9]">{journey.eyebrow}</p><h2 id="journey-heading" className="mt-4 max-w-lg text-3xl font-semibold tracking-tight sm:text-4xl">{journey.heading}</h2><p className="mt-5 max-w-md leading-relaxed text-slate-300">{journey.intro}</p><a href="#/contact" className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#b4f1ee] px-5 py-3 text-sm font-semibold text-[#082532] outline-none hover:bg-white focus-visible:ring-2 focus-visible:ring-white">Discuss your workflow <ArrowRight className="size-4" aria-hidden="true" /></a></div>
        <div className="rounded-3xl border border-white/15 bg-[#103444] p-4 shadow-2xl sm:p-6"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-4"><span className="flex items-center gap-2 text-sm font-semibold"><Layers3 className="size-4 text-[#8be5e8]" aria-hidden="true" /> Workflow explorer</span><span className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-200">Illustrative concept</span></div><div className="mt-5 flex flex-wrap gap-2" aria-label="Workflow steps">{journey.items.map((item, index) => <button key={item.label} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)} className={`min-h-11 rounded-lg border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${selected === index ? "border-[#a9efea] bg-[#a9efea] text-[#082532]" : "border-white/20 text-white hover:bg-white/10"}`}>{item.label}</button>)}</div><div aria-live="polite" className="mt-5 rounded-2xl border border-white/10 bg-[#092735] p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-widest text-[#79dce9]">Possible approach</p><h3 className="mt-3 text-xl font-semibold">{active.title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-300">{active.description}</p><ol className="mt-6 grid gap-2 sm:grid-cols-3">{active.steps.map((step, index) => <li key={step} className="rounded-xl border border-white/10 bg-white/5 p-3"><span className="text-xs font-bold text-[#79dce9]">0{index + 1}</span><span className="mt-2 block text-sm">{step}</span></li>)}</ol><p className="mt-5 flex items-start gap-2 text-sm text-[#c7f3eb]"><Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> Intended benefit: {active.outcome}</p></div><p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-300"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#79dce9]" aria-hidden="true" />Illustrative workflow, not a live product demo. Features, integrations and outcomes depend on the agreed scope and verification.</p></div>
      </div>
    </section>
  );
}
