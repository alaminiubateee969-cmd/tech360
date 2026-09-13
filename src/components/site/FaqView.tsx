"use client";

import { useMemo, useState } from "react";
import { HelpCircle, Search, SearchX } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FAQS } from "@/data/site";
import { PageHero } from "./PageHero";
import { CtaBand } from "./CtaBand";
import { Reveal } from "./Reveal";

export default function FaqView() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | undefined>(undefined);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQS;
    return FAQS.filter(
      (faq) =>
        faq.q.toLowerCase().includes(q) || faq.a.toLowerCase().includes(q),
    );
  }, [query]);

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
            <div className="mb-6 flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-lg bg-[#009FE3]/10 text-[#009FE3]">
                <HelpCircle className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h2 id="faq-heading" className="text-xl font-bold text-[#0B1F33]">
                  Frequently asked questions
                </h2>
                <p className="text-xs text-[#526173]" aria-live="polite">
                  {filtered.length === FAQS.length
                    ? `${FAQS.length} answers · every one matches a published policy`
                    : `${filtered.length} of ${FAQS.length} answers shown`}
                </p>
              </div>
            </div>
          </Reveal>

          <Reveal className="mb-6">
            <div className="relative" role="search" aria-label="Search the FAQ">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#7A8CA0]" aria-hidden="true" />
              <Input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(undefined);
                }}
                placeholder="Search the FAQ — payments, source code, revisions…"
                aria-label="Search frequently asked questions"
                className="h-11 rounded-lg border-[#E2E8F0] bg-white pl-10 text-sm text-[#0B1F33] placeholder:text-[#7A8CA0] focus-visible:border-[#009FE3] focus-visible:ring-2 focus-visible:ring-[#009FE3]/25"
              />
            </div>
          </Reveal>

          {filtered.length > 0 ? (
            <Accordion
              type="single"
              collapsible
              value={open}
              onValueChange={setOpen}
              className="space-y-3"
            >
              {filtered.map((faq, i) => (
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
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#E2E8F0] bg-white px-6 py-12 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-[#009FE3]/10" aria-hidden="true">
                <SearchX className="size-5 text-[#009FE3]" />
              </span>
              <p className="text-sm font-semibold text-[#0B1F33]">No answers match “{query.trim()}”</p>
              <p className="max-w-sm text-xs leading-relaxed text-[#526173]">
                The answer may still exist — ask us directly and it comes back in writing.
              </p>
              <Button
                variant="outline"
                className="mt-1 min-h-11 rounded-lg"
                onClick={() => setQuery("")}
              >
                Show all questions
              </Button>
            </div>
          )}

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
