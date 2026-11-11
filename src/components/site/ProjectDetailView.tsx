"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, Info, Sparkles } from "lucide-react";

import { WORK_EXAMPLES } from "@/data/work-examples";
import {
  FORBIDDEN_CLAIM_PATTERNS,
  PROJECT_DETAIL_NOTICE,
  getProjectDetail,
  relatedProjects,
} from "@/data/work-details";
import { getService, getIndustry } from "@/data/site";
import { assessSolution } from "@/data/industries/maturity";
import { MaturityBadge } from "./maturity-badge";

/**
 * Dedicated project detail page (Phase 4, sections A–T).
 *
 * The showcase projects are specifications, not delivered engagements. The page
 * therefore carries three honesty controls that a redesign must not remove:
 *
 *   1. `PROJECT_DETAIL_NOTICE` is rendered at the top, not buried in a footer.
 *   2. The maturity badge is evidence-derived, so it cannot say "Demo
 *      available" or "Implemented" for a showcase.
 *   3. The screen-gallery section states explicitly that no verified product
 *      screenshots exist for this concept, rather than presenting a generated
 *      visual as an application screenshot.
 */

const SECTION_LINKS: { id: string; label: string }[] = [
  { id: "problem", label: "Problem" },
  { id: "objectives", label: "Objectives" },
  { id: "overview", label: "Overview" },
  { id: "modules", label: "Modules" },
  { id: "screens", label: "Screens" },
  { id: "journey", label: "Journey" },
  { id: "roles", label: "Roles" },
  { id: "architecture", label: "Architecture" },
  { id: "data", label: "Data model" },
  { id: "integrations", label: "Integrations" },
  { id: "ai", label: "AI & automation" },
  { id: "security", label: "Security" },
  { id: "quality", label: "Quality" },
  { id: "deployment", label: "Deployment" },
  { id: "maintenance", label: "Maintenance" },
  { id: "advanced", label: "Advanced" },
];

function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-28">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#009FE3]">{eyebrow}</p>
      <h2 id={`${id}-heading`} className="mt-2 text-xl font-bold tracking-tight text-[#0B1F33] sm:text-2xl">
        {title}
      </h2>
      <div className="mt-4 text-sm leading-relaxed text-[#526173]">{children}</div>
    </section>
  );
}

function CheckList({ items, tone = "green" }: { items: string[]; tone?: "green" | "amber" }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2 rounded-xl border border-[#E2E8F0] bg-white p-3">
          {tone === "green" ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#18B83A]" aria-hidden="true" />
          ) : (
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-[#B4472A]" aria-hidden="true" />
          )}
          <span className="text-sm text-[#0B1F33]">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Table({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: [string, string];
  rows: [string, string][];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E2E8F0]">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-[#F4F8FC] text-xs uppercase tracking-wider text-[#526173]">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">{head[0]}</th>
            <th scope="col" className="px-4 py-3 font-semibold">{head[1]}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E8F0] bg-white">
          {rows.map(([left, right]) => (
            <tr key={left} className="align-top">
              <th scope="row" className="w-1/3 px-4 py-3 font-semibold text-[#0B1F33]">{left}</th>
              <td className="px-4 py-3 text-[#526173]">{right}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ProjectDetailView({ slug }: { slug: string }) {
  const example = WORK_EXAMPLES.find((item) => item.slug === slug);
  const detail = getProjectDetail(slug);

  if (!example || !detail) {
    return (
      <div className="grid min-h-[60vh] place-items-center bg-[#F7FAFC] px-5 py-20">
        <div className="w-full max-w-xl rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-[#009FE3]">404 · Project not found</p>
          <h1 className="mt-4 text-2xl font-bold text-[#0B1F33]">This project scenario does not exist.</h1>
          <p className="mt-3 text-sm text-[#526173]">Browse the published project scenarios instead.</p>
          <a href="#/work/projects" className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-[#063B8F] px-5 text-sm font-semibold text-white outline-none hover:bg-[#052f72] focus-visible:ring-2 focus-visible:ring-[#009FE3]">
            All projects
          </a>
        </div>
      </div>
    );
  }

  const assessment = assessSolution(`work/${slug}`);
  const industry = detail.industrySlug ? getIndustry(detail.industrySlug) : undefined;
  const related = relatedProjects(slug);

  return (
    <div>
      {/* A — Hero */}
      <section className="relative overflow-hidden bg-[#0B1F33]">
        <img
          src={example.image}
          alt={example.imageAlt}
          className="absolute inset-0 size-full object-cover opacity-40"
          loading="eager"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#0B1F33]/95 via-[#0B1F33]/80 to-[#063B8F]/50" />
        <div className="relative mx-auto w-full max-w-7xl px-4 py-16 pt-28 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <nav aria-label="Breadcrumb" className="mb-6">
            <ol className="flex flex-wrap items-center gap-1.5 text-sm text-white/60">
              <li><a href="#/" className="outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/60">Home</a></li>
              <li className="flex items-center gap-1.5"><ArrowRight className="size-3.5 opacity-50" aria-hidden="true" /><a href="#/work" className="outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/60">Work</a></li>
              <li className="flex items-center gap-1.5"><ArrowRight className="size-3.5 opacity-50" aria-hidden="true" /><a href="#/work/projects" className="outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/60">Projects</a></li>
              <li className="flex items-center gap-1.5"><ArrowRight className="size-3.5 opacity-50" aria-hidden="true" /><span aria-current="page" className="text-white/90">{example.name}</span></li>
            </ol>
          </nav>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8FD3F4]">
              {example.category}
            </span>
            <MaturityBadge assessment={assessment} />
          </div>

          <h1 className="mt-5 max-w-3xl text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            {example.name}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/80 sm:text-lg">{example.tagline}</p>

          <dl className="mt-8 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Modules", value: example.modules.length },
              { label: "Journey steps", value: detail.journey.length },
              { label: "Integrations", value: detail.integrations.length },
              { label: "Indicative build", value: example.deliveryWeeks },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/15 bg-white/5 px-4 py-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-white/60">{stat.label}</dt>
                <dd className="mt-1 text-lg font-bold text-white">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Honesty banner */}
      <div className="border-b border-[#F5B301]/30 bg-[#FFFBEB]">
        <div className="mx-auto flex w-full max-w-7xl items-start gap-2 px-4 py-3 text-xs leading-relaxed text-[#7A5B00] sm:px-6 lg:px-8">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p><strong>How to read this page:</strong> {PROJECT_DETAIL_NOTICE}</p>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:px-8 lg:py-16">
        {/* Section navigation */}
        <nav aria-label="Project sections" className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8A9AAB]">On this page</p>
          <ul className="mt-3 hidden flex-wrap gap-x-4 gap-y-1 lg:flex lg:flex-col">
            {SECTION_LINKS.map((link) => (
              <li key={link.id}>
                <a
                  href={`#${link.id}`}
                  className="inline-flex min-h-9 items-center rounded text-xs font-medium text-[#526173] outline-none transition-colors hover:text-[#009FE3] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-12">
          {/* B — Problem */}
          <Section id="problem" eyebrow="B · Problem & target users" title="What this system is designed to replace">
            <ul className="space-y-2">
              {detail.problem.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-[#B4472A]" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-4 font-semibold text-[#0B1F33]">Target users</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {detail.users.map((user) => (
                <li key={user} className="rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1 text-xs text-[#526173]">{user}</li>
              ))}
            </ul>
          </Section>

          {/* C — Objectives */}
          <Section id="objectives" eyebrow="C · Objectives & intended benefits" title="Design intent, not measured outcomes">
            <CheckList items={detail.objectives} />
            <p className="mt-3 text-xs text-[#8A9AAB]">
              These are goals the build is designed to serve. No efficiency, revenue or conversion result is claimed.
            </p>
          </Section>

          {/* D — Overview & platforms */}
          <Section id="overview" eyebrow="D · Product overview" title="What the system is, and where it runs">
            <p>{example.description}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {detail.platforms.map((platform) => (
                <div key={platform.name} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                  <p className="text-sm font-semibold text-[#0B1F33]">{platform.name}</p>
                  <p className="mt-1 text-xs text-[#526173]">{platform.detail}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-[#8A9AAB]">
              Platforms listed describe the intended build. A specific engagement may narrow or extend them after scope approval.
            </p>
          </Section>

          {/* E — Modules */}
          <Section id="modules" eyebrow="E · Module inventory" title="Modules in the specification">
            <CheckList items={example.modules} />
            <p className="mt-4 font-semibold text-[#0B1F33]">Capabilities the system is designed to provide</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              {example.capabilities.map((capability) => (
                <li key={capability}>{capability}</li>
              ))}
            </ul>
          </Section>

          {/* F — Screens */}
          <Section id="screens" eyebrow="F · Screen gallery" title="No verified product screenshots for this concept">
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
              <p>
                This project has not been built, so there are no application screenshots to show. The image on this page
                is a generated concept visual, not a capture of working software. Presenting it as a product screenshot
                would misrepresent the system, so this section says so explicitly.
              </p>
              <figure className="mt-4 overflow-hidden rounded-xl border border-[#E2E8F0]">
                <img src={example.image} alt={example.imageAlt} className="w-full" loading="lazy" />
                <figcaption className="bg-[#F8FBFD] px-4 py-3 text-xs text-[#526173]">
                  Generated concept visual — not a screenshot of a working application.
                </figcaption>
              </figure>
            </div>
          </Section>

          {/* G — Journey */}
          <Section id="journey" eyebrow="G · User journey" title="The intended path through the system">
            <ol className="grid gap-3 sm:grid-cols-2">
              {detail.journey.map((step, index) => (
                <li key={step.title} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                  <p className="text-xs font-bold text-[#009FE3]">Step {index + 1}</p>
                  <p className="mt-1 text-sm font-semibold text-[#0B1F33]">{step.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#526173]">{step.description}</p>
                </li>
              ))}
            </ol>
          </Section>

          {/* H — Roles */}
          <Section id="roles" eyebrow="H · Roles & permissions" title="Who can do what">
            <Table caption="Roles and their access boundary" head={["Role", "Access boundary"]} rows={detail.roles.map((role) => [role.role, role.access])} />
          </Section>

          {/* I — Architecture & API */}
          <Section id="architecture" eyebrow="I · Architecture & API" title="Service boundary and HTTP surface">
            <Table caption="API endpoints" head={["Endpoint", "Purpose"]} rows={detail.apiSurface.map((api) => [api.endpoint, api.purpose])} />
            <p className="mt-3 text-xs text-[#8A9AAB]">
              Endpoints are the intended contract. Authorisation is enforced server-side per role, never only in the interface.
            </p>
          </Section>

          {/* J — Data model */}
          <Section id="data" eyebrow="J · Data entities" title="Core entities and relationships">
            <Table caption="Data entities" head={["Entity", "Relationship"]} rows={detail.dataEntities.map((entity) => [entity.entity, entity.relation])} />
          </Section>

          {/* K — Integrations */}
          <Section id="integrations" eyebrow="K · External integrations" title="Provider-dependent integration points">
            <CheckList items={[...new Set([...example.integrations, ...detail.integrations])]} />
            <p className="mt-3 text-xs text-[#8A9AAB]">
              Each integration is configured and accepted against the specific provider account before go-live.
            </p>
          </Section>

          {/* L — AI */}
          <Section id="ai" eyebrow="L · AI & automation" title="Opportunities and their human gate">
            <div className="space-y-3">
              {detail.ai.map((item) => (
                <div key={item.opportunity} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                  <p className="flex items-start gap-2 text-sm font-medium text-[#0B1F33]">
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-[#009FE3]" aria-hidden="true" />
                    {item.opportunity}
                  </p>
                  <p className="mt-1 text-xs text-[#526173]"><strong className="text-[#0B1F33]">Human gate:</strong> {item.gate}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* M — Security */}
          <Section id="security" eyebrow="M · Security, privacy & accessibility" title="Controls the build is specified to enforce">
            <CheckList items={detail.security} />
            <p className="mt-3 text-xs text-[#8A9AAB]">
              Accessibility is treated as an acceptance criterion for keyboard, focus and contrast on every screen. No
              certification or audit result is implied.
            </p>
          </Section>

          {/* N — Quality */}
          <Section id="quality" eyebrow="N · Testing & quality assurance" title="What would have to be proven before handover">
            <CheckList items={detail.quality} />
          </Section>

          {/* O/P — Deployment & maintenance */}
          <Section id="deployment" eyebrow="O · Deployment & hosting" title="Where and how it would run">
            <CheckList items={detail.deployment} />
          </Section>
          <Section id="maintenance" eyebrow="P · Maintenance & scalability" title="Keeping it maintainable">
            <CheckList items={detail.maintenance} />
          </Section>

          {/* Q — Advanced */}
          <Section id="advanced" eyebrow="Q · Optional advanced features" title="Out of the initial scope, available later">
            <CheckList items={detail.advanced} />
          </Section>

          {/* R/S — Related + CTA */}
          <section aria-labelledby="next-heading" className="scroll-mt-28 rounded-2xl border border-[#E2E8F0] bg-white p-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#009FE3]">R · Related</p>
            <h2 id="next-heading" className="mt-2 text-xl font-bold text-[#0B1F33]">Related solutions and next step</h2>

            {industry ? (
              <p className="mt-3 text-sm text-[#526173]">
                Sector blueprint:{" "}
                <a href={`#/industries/${industry.slug}`} className="font-semibold text-[#063B8F] underline decoration-[#009FE3]/40 underline-offset-2 hover:text-[#009FE3]">
                  {industry.title} solutions
                </a>
              </p>
            ) : null}

            <ul className="mt-3 flex flex-wrap gap-2">
              {detail.relatedServices.map((serviceSlug) => {
                const service = getService(serviceSlug);
                if (!service) return null;
                return (
                  <li key={serviceSlug}>
                    <a href={`#/services/${serviceSlug}`} className="inline-flex min-h-9 items-center rounded-lg border border-[#E2E8F0] px-3 text-xs font-medium text-[#063B8F] outline-none hover:border-[#009FE3] focus-visible:ring-2 focus-visible:ring-[#009FE3]">
                      {service.title}
                    </a>
                  </li>
                );
              })}
            </ul>

            <ul className="mt-4 flex flex-wrap gap-2">
              {related.map((relatedSlug) => {
                const relatedExample = WORK_EXAMPLES.find((item) => item.slug === relatedSlug);
                if (!relatedExample) return null;
                return (
                  <li key={relatedSlug}>
                    <a href={`#/work/projects/${relatedSlug}`} className="inline-flex min-h-9 items-center rounded-lg bg-[#063B8F]/8 px-3 text-xs font-semibold text-[#063B8F] outline-none hover:bg-[#063B8F]/15 focus-visible:ring-2 focus-visible:ring-[#009FE3]">
                      {relatedExample.name}
                    </a>
                  </li>
                );
              })}
            </ul>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <a href="#/contact" id="request-quote" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#063B8F] px-5 text-sm font-semibold text-white outline-none hover:bg-[#052f72] focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2">
                Request a similar project
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
              <a href="#/work/projects" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#E2E8F0] px-5 text-sm font-semibold text-[#063B8F] outline-none hover:border-[#009FE3] focus-visible:ring-2 focus-visible:ring-[#009FE3]">
                <ArrowLeft className="size-4" aria-hidden="true" />
                All project scenarios
              </a>
            </div>

            <p className="mt-4 text-xs text-[#8A9AAB]">
              What this page does not claim: {example.outOfScope.join(" ")}
            </p>
          </section>

          <p className="text-xs leading-relaxed text-[#8A9AAB]">
            Claims policy: this page is checked against a forbidden-claim list ({FORBIDDEN_CLAIM_PATTERNS.length} patterns,
            including invented percentage results, &ldquo;case study&rdquo; and guarantee language) by the repository test suite.
          </p>
        </div>
      </div>
    </div>
  );
}
