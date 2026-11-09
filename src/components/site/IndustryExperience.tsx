"use client";

import { useState } from "react";
import { ArrowRight, Layers3, ShieldCheck } from "lucide-react";

type Concept = {
  eyebrow: string;
  title: string;
  description: string;
  roles: string;
  limitation: string;
  modules: { name: string; detail: string; steps: string[] }[];
};

const concepts: Record<string, Concept> = {
  "hospitals-clinics": {
    eyebrow: "Healthcare operations", title: "A clearer view of the patient journey",
    description: "Explore how connected operational modules could help teams coordinate care, from first contact to follow-up.",
    roles: "Reception · clinicians · pharmacy and lab staff · administrators",
    limitation: "Concept only. No real patient data, appointment availability or clinical compliance is represented. Clinical workflows and safeguards require project-specific review.",
    modules: [
      { name: "Patient intake", detail: "A structured starting point for registration and routing.", steps: ["Register patient", "Capture contact details", "Route to department"] },
      { name: "Appointments & queues", detail: "A shared view for coordinating schedules and the waiting queue.", steps: ["Review schedule", "Request appointment", "Manage queue"] },
      { name: "Billing & inventory", detail: "Bring administrative and stock workflows into the same operational picture.", steps: ["Prepare billing", "Review stock", "Coordinate pharmacy & lab"] },
      { name: "Access & reporting", detail: "Design role-specific access and audit visibility around sensitive information.", steps: ["Define roles", "Review access", "Monitor operations"] },
    ],
  },
  "travel-hospitality": {
    eyebrow: "Travel & hospitality", title: "From inspiration to itinerary",
    description: "Imagine a connected workspace for travellers and agency teams, from the first enquiry to the journey home.",
    roles: "Travellers · travel advisors · operations teams · administrators",
    limitation: "Concept only. Destinations, availability, booking confirmations and payments are not live. Provider integrations must be separately configured and verified.",
    modules: [
      { name: "Discover", detail: "Present destinations and packages that can be tailored to a traveller's interests.", steps: ["Explore destinations", "Compare packages", "Send an enquiry"] },
      { name: "Plan", detail: "Build an itinerary around preferences, dates and the services in scope.", steps: ["Discuss preferences", "Build itinerary", "Review proposal"] },
      { name: "Booking", detail: "Give the agency a structured way to track requests and changes.", steps: ["Review request", "Confirm with providers", "Track booking status"] },
      { name: "Travel portal", detail: "Organise trip documents and communication in one place.", steps: ["Share documents", "Coordinate updates", "Follow up after travel"] },
    ],
  },
  "schools-training": {
    eyebrow: "Education & learning", title: "A connected school community",
    description: "Explore a possible learning and administration experience for schools, students and families.",
    roles: "Admissions teams · teachers · students · guardians · administrators",
    limitation: "Concept only. Modules, integrations and protections for student information depend on the agreed scope and implementation.",
    modules: [
      { name: "Admissions", detail: "Guide families from an initial enquiry through application review.", steps: ["Submit enquiry", "Review application", "Coordinate admission"] },
      { name: "Classroom", detail: "Organise classes, attendance and learning activities for teachers and students.", steps: ["Plan classes", "Record attendance", "Share assignments"] },
      { name: "Progress", detail: "Bring examination and learning progress into a clearer view.", steps: ["Plan assessments", "Review results", "Share progress"] },
      { name: "School operations", detail: "Coordinate fees, notices and guardian communication.", steps: ["Review fees", "Prepare notices", "Connect with guardians"] },
    ],
  },
};

export default function IndustryExperience({ slug }: { slug: string }) {
  const concept = concepts[slug];
  const [selected, setSelected] = useState(0);
  if (!concept) return null;
  const active = concept.modules[selected] ?? concept.modules[0];

  return (
    <section aria-labelledby="experience-heading" className="bg-[#061d2b] text-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#70e0e5]">{concept.eyebrow} / Concept</p>
            <h2 id="experience-heading" className="mt-4 max-w-lg text-3xl font-semibold tracking-tight sm:text-4xl">{concept.title}</h2>
            <p className="mt-5 max-w-lg leading-relaxed text-slate-300">{concept.description}</p>
            <p className="mt-6 text-sm text-slate-300"><span className="font-semibold text-white">Designed for: </span>{concept.roles}</p>
            <a href="#/contact" className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#f9b85c] px-5 py-3 text-sm font-semibold text-[#102b38] outline-none hover:bg-[#ffd08a] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#061d2b]">Discuss your project <ArrowRight className="size-4" aria-hidden="true" /></a>
          </div>
          <div className="rounded-2xl border border-white/15 bg-[#0b3141] p-4 shadow-2xl sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2 text-sm font-semibold"><Layers3 className="size-4 text-[#70e0e5]" aria-hidden="true" /> Solution explorer</div>
              <span className="rounded-full border border-[#70e0e5]/30 bg-[#70e0e5]/10 px-3 py-1 text-xs text-[#b7f6f4]">Illustrative concept</span>
            </div>
            <p className="mt-5 text-sm text-slate-300">Select a module to explore a possible workflow.</p>
            <div className="mt-4 flex flex-wrap gap-2" aria-label="Concept modules">
              {concept.modules.map((module, index) => <button key={module.name} type="button" aria-pressed={selected === index} onClick={() => setSelected(index)} className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-white ${selected === index ? "border-[#70e0e5] bg-[#70e0e5] text-[#061d2b]" : "border-white/20 text-white hover:bg-white/10"}`}>{module.name}</button>)}
            </div>
            <div className="mt-5 rounded-xl border border-white/10 bg-[#082633] p-5" aria-live="polite">
              <p className="text-xs uppercase tracking-[0.18em] text-[#70e0e5]">Possible workflow</p>
              <h3 className="mt-2 text-xl font-semibold">{active.name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{active.detail}</p>
              <ol className="mt-6 grid gap-3 sm:grid-cols-3">{active.steps.map((step, index) => <li key={step} className="rounded-lg border border-white/10 bg-white/5 p-3"><span className="block text-xs font-semibold text-[#70e0e5]">0{index + 1}</span><span className="mt-2 block text-sm text-white">{step}</span></li>)}</ol>
            </div>
            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-300"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#70e0e5]" aria-hidden="true" />{concept.limitation}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
