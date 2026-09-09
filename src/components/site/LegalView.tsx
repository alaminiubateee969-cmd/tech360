"use client";

import { FileCheck, ShieldCheck } from "lucide-react";
import { LEGAL_DOCS, getLegalDoc, COMPANY } from "@/data/site";
import { PageHero } from "./PageHero";
import { Reveal } from "./Reveal";
import { cn } from "@/lib/utils";

export default function LegalView({ slug }: { slug: string }) {
  const doc = getLegalDoc(slug);

  return (
    <main id="main-content">
      <PageHero
        eyebrow="Legal & policies"
        title={doc ? doc.title : "Policy not found"}
        description={
          doc
            ? doc.summary
            : "The document you requested does not exist. The sidebar below lists every published policy — select one to read it."
        }
        breadcrumb={[
          { label: "Legal", href: "#/legal/terms" },
          { label: doc ? doc.title : "Not found" },
        ]}
      />

      <section aria-label="Legal document content" className="bg-white">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:gap-14 lg:px-8 lg:py-20">
          {/* Sidebar navigation */}
          <nav aria-label="Legal documents" className="lg:col-span-4 xl:col-span-3">
            <div className="lg:sticky lg:top-24">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#526173]">
                All policies
              </h2>
              <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
                {LEGAL_DOCS.map((d) => {
                  const isActive = doc !== undefined && d.slug === doc.slug;
                  return (
                    <li key={d.slug} className="shrink-0 lg:shrink">
                      <a
                        href={`#/legal/${d.slug}`}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex min-h-11 items-center gap-2.5 rounded-lg border px-4 text-sm font-medium outline-none transition-colors lg:border-transparent lg:bg-transparent",
                          isActive
                            ? "border-[#009FE3]/40 bg-[#F4FAFF] text-[#009FE3] lg:border-l-2 lg:border-l-[#009FE3] lg:bg-[#F4FAFF]"
                            : "border-[#E2E8F0] bg-white text-[#0B1F33] hover:border-[#009FE3]/40 hover:text-[#009FE3] lg:border-l-2 lg:border-l-[#E2E8F0]"
                        )}
                      >
                        <FileCheck
                          className={cn(
                            "hidden size-4 lg:block",
                            isActive ? "text-[#009FE3]" : "text-[#94A3B8]"
                          )}
                          aria-hidden="true"
                        />
                        {d.title}
                      </a>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-6 hidden rounded-xl border border-[#E2E8F0] bg-[#F4FAFF] p-4 lg:block">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-[#063B8F]" aria-hidden="true" />
                  <h3 className="text-xs font-semibold text-[#0B1F33]">Legal identity</h3>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#526173]">
                  {COMPANY.legalName} · Missouri LLC {COMPANY.missouriLLC} · EIN{" "}
                  {COMPANY.ein}
                  <br />
                  {COMPANY.address}
                  <br />
                  {COMPANY.email}
                </p>
              </div>
            </div>
          </nav>

          {/* Document body */}
          <article className="min-w-0 lg:col-span-8 xl:col-span-9">
            {doc ? (
              <Reveal>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-md bg-[#009FE3]/10 px-2.5 py-1 text-xs font-semibold text-[#0079AC]">
                    Updated {doc.updated}
                  </span>
                  <span className="text-xs text-[#526173]">
                    Applies as written; a signed engagement agreement prevails where it differs.
                  </span>
                </div>
                <h1 className="mt-4 text-3xl font-bold tracking-tight text-[#0B1F33] sm:text-4xl">
                  {doc.title}
                </h1>
                <p className="mt-3 max-w-2xl text-base leading-relaxed text-[#526173]">
                  {doc.summary}
                </p>
                <div className="my-8 h-px w-full bg-[#E2E8F0]" role="separator" />
                <div className="space-y-8">
                  {doc.sections.map((section) => (
                    <section key={section.heading} aria-labelledby={`sec-${section.heading.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`}>
                      <h2
                        id={`sec-${section.heading.replace(/[^a-z0-9]/gi, "-").toLowerCase()}`}
                        className="text-lg font-semibold text-[#0B1F33] sm:text-xl"
                      >
                        {section.heading}
                      </h2>
                      <div className="mt-3 space-y-4">
                        {section.body.map((paragraph, i) => (
                          <p key={i} className="text-sm leading-relaxed text-[#526173] sm:text-base">
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>

                <div className="mt-10 rounded-xl border border-[#063B8F]/20 bg-[#F4FAFF] p-6">
                  <h2 className="text-sm font-semibold text-[#0B1F33]">Questions about this policy?</h2>
                  <p className="mt-2 text-sm leading-relaxed text-[#526173]">
                    Write to{" "}
                    <a
                      href={`mailto:${COMPANY.email}`}
                      className="font-medium text-[#009FE3] underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-[#009FE3] rounded-sm outline-none"
                    >
                      {COMPANY.email}
                    </a>{" "}
                    or message{" "}
                    <a
                      href={COMPANY.whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-[#009FE3] underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-[#009FE3] rounded-sm outline-none"
                    >
                      {COMPANY.whatsappDisplay}
                    </a>{" "}
                    with your Client ID. Policy questions are answered by the
                    team that wrote the policy.
                  </p>
                </div>
              </Reveal>
            ) : (
              <Reveal>
                <h1 className="text-3xl font-bold tracking-tight text-[#0B1F33] sm:text-4xl">
                  No such policy document
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#526173]">
                  The address <code className="rounded bg-[#F4FAFF] px-1.5 py-0.5 text-sm">#/legal/{slug}</code>{" "}
                  does not match any published document. Every policy we
                  operate under is listed in the sidebar — start with the
                  Terms &amp; Conditions for the framework, or the Source Code
                  Handover Policy for how ownership transfers at completion.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <a
                    href="#/legal/terms"
                    className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#009FE3] px-5 py-2.5 text-sm font-semibold text-white outline-none transition-colors hover:bg-[#0090CC] focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2"
                  >
                    Read the Terms &amp; Conditions
                  </a>
                  <a
                    href="#/faq"
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-[#063B8F]/20 bg-white px-5 py-2.5 text-sm font-semibold text-[#063B8F] outline-none transition-colors hover:border-[#009FE3] hover:text-[#009FE3] focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2"
                  >
                    Common questions instead
                  </a>
                </div>
              </Reveal>
            )}
          </article>
        </div>
      </section>
    </main>
  );
}
