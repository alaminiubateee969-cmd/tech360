"use client";

import { HelpCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQS } from "@/data/site";
import { PageHero } from "./PageHero";
import { CtaBand } from "./CtaBand";
import { Reveal } from "./Reveal";

export default function FaqView() {
  return (
    <main id="main-content">
      <PageHero
        eyebrow="FAQ"
        title="The questions serious clients ask first"
        description="Payment gates, source code ownership, revisions, timelines, confidentiality — answered the way we answer them in a first call: precisely and in writing."
        breadcrumb={[{ label: "FAQ" }]}
      />

      <section aria-labelledby="faq-heading" className="bg-[#F4FAFF]">
        <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <Reveal>
            <div className="mb-8 flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-lg bg-[#009FE3]/10 text-[#009FE3]">
                <HelpCircle className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 id="faq-heading" className="text-xl font-bold text-[#0B1F33]">
                  Frequently asked questions
                </h2>
                <p className="text-xs text-[#526173]">
                  {FAQS.length} answers · every one matches a published policy
                </p>
              </div>
            </div>
          </Reveal>

          <Accordion type="single" collapsible className="space-y-3">
            {FAQS.map((faq, i) => (
              <AccordionItem
                key={faq.q}
                value={`faq-${i}`}
                className="rounded-xl border border-[#E2E8F0] bg-white px-5 data-[state=open]:border-[#009FE3]/40 data-[state=open]:shadow-[0_8px_24px_rgba(6,59,143,0.06)]"
              >
                <AccordionTrigger className="min-h-11 py-4 text-left text-sm font-semibold text-[#0B1F33] hover:no-underline hover:text-[#009FE3] sm:text-base [&>svg]:text-[#009FE3]">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-[#526173] sm:text-base">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <Reveal className="mt-10">
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-center">
              <p className="text-sm leading-relaxed text-[#526173]">
                A question not covered here? Ask it directly — the answer comes
                back in writing, and if it belongs in a policy, it gets added.
              </p>
              <a
                href="#/contact"
                className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#009FE3] px-6 py-2.5 text-sm font-semibold text-white outline-none transition-colors hover:bg-[#0090CC] focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2"
              >
                Ask your question
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <CtaBand
        title="Convinced? Start with a scope, not a contract"
        description="One message about your project — written scope, HTML preview, milestone plan. Payment only after you approve what you see."
      />
    </main>
  );
}
