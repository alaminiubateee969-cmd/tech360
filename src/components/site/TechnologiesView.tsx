"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TECHNOLOGY_GROUPS } from "@/data/site";
import { PageHero } from "./PageHero";
import { CtaBand } from "./CtaBand";
import { Icon } from "./icons";
import { Reveal, RevealList, RevealItem } from "./Reveal";
import { SectionHeading } from "./SectionHeading";
import { PortalSignInSequence } from "./diagram-kit";
import {
  AutomationWorkflowDiagram,
  CloudArchitectureDiagram,
  SecurityArchitectureDiagram,
  TechStackDiagram,
} from "./diagrams";

export default function TechnologiesView() {
  return (
    <main id="main-content">
      <PageHero
        eyebrow="Technologies"
        title="A deliberate stack — boring in the best way"
        description="We choose technology for maintainability, hiring depth and long-term support — not novelty. Every tool below is one we run in production and can hand over with documentation."
        breadcrumb={[{ label: "Technologies" }]}
      />

      {/* Stack imagery + philosophy */}
      <section aria-labelledby="philosophy-heading" className="bg-white">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-20">
          <Reveal>
            <TechStackDiagram />
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#009FE3]">
              Selection principles
            </p>
            <h2 id="philosophy-heading" className="text-3xl font-bold tracking-tight text-[#0B1F33] sm:text-4xl">
              The stack is chosen for your handover, not our resume
            </h2>
            <div className="mt-6 space-y-4 text-base leading-relaxed text-[#526173]">
              <p>
                You will receive the source code at completion. That single fact
                shapes every technology decision: we use mainstream, well-documented
                tools that any competent developer can maintain — long after our
                engagement ends.
              </p>
              <p>
                Managed infrastructure over hand-rolled servers. Typed code over
                dynamic shortcuts. Official APIs over unofficial gateways. Logged
                automation over silent scripts. Each choice trades a little speed
                for a lot of reliability.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Groups */}
      <section aria-labelledby="groups-heading" className="bg-[#F4FAFF]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <SectionHeading
            id="groups-heading"
            eyebrow="The stack"
            title="What we build with, layer by layer"
          />
          <RevealList className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {TECHNOLOGY_GROUPS.map((group) => (
              <RevealItem key={group.name} className="h-full">
                <Card className="h-full border-[#E2E8F0] bg-white">
                  <CardContent className="p-6 sm:p-7">
                    <div className="flex items-center gap-4">
                      <span className="flex size-12 items-center justify-center rounded-xl bg-[#063B8F] text-white">
                        <Icon name={group.icon} className="size-6" />
                      </span>
                      <div>
                        <h3 className="text-lg font-semibold text-[#0B1F33]">{group.name}</h3>
                        <p className="mt-0.5 text-xs leading-relaxed text-[#526173]">
                          {group.blurb}
                        </p>
                      </div>
                    </div>
                    <ul className="mt-6 flex flex-wrap gap-2">
                      {group.items.map((item) => (
                        <li
                          key={item}
                          className="rounded-lg border border-[#E2E8F0] bg-[#F4FAFF] px-3 py-1.5 text-sm font-medium text-[#063B8F]"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </RevealItem>
            ))}
          </RevealList>
        </div>
      </section>

      {/* Architecture imagery row */}
      <section aria-labelledby="architecture-heading" className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <SectionHeading
            id="architecture-heading"
            eyebrow="Infrastructure"
            title="Two deployment paths, one standard"
            description="Cloud-native for platforms that scale; hardened shared hosting for applications that do not need a platform team. Both get the same release, backup and handover discipline."
          />
          <RevealList className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <RevealItem className="h-full">
              <Card className="h-full overflow-hidden border-[#E2E8F0] bg-white">
                <div className="overflow-hidden">
                  <CloudArchitectureDiagram />
                </div>
                <CardContent className="p-5">
                  <h3 className="text-base font-semibold text-[#0B1F33]">Cloud-native deployment</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#526173]">
                    Cloud Run containers, managed database, secret management and
                    observability — near-zero ops overhead.
                  </p>
                </CardContent>
              </Card>
            </RevealItem>
            <RevealItem className="h-full">
              <Card className="h-full overflow-hidden border-[#E2E8F0] bg-white">
                <div className="overflow-hidden">
                  <SecurityArchitectureDiagram />
                </div>
                <CardContent className="p-5">
                  <h3 className="text-base font-semibold text-[#0B1F33]">Security model</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#526173]">
                    Role-restricted access, encrypted secret storage, audit logging
                    and verified backups across every system.
                  </p>
                </CardContent>
              </Card>
            </RevealItem>
            <RevealItem className="h-full">
              <Card className="h-full overflow-hidden border-[#E2E8F0] bg-white">
                <div className="overflow-hidden">
                  <AutomationWorkflowDiagram />
                </div>
                <CardContent className="p-5">
                  <h3 className="text-base font-semibold text-[#0B1F33]">Automation backbone</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#526173]">
                    Every workflow versioned, every run logged, every failure retried
                    and escalated — no silent drops.
                  </p>
                </CardContent>
              </Card>
            </RevealItem>
          </RevealList>
        </div>
      </section>

      <section aria-labelledby="signin-heading" className="bg-white">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <SectionHeading
            id="signin-heading"
            eyebrow="Security in practice"
            title="Sign-in that proves it is really you"
            description="Knowing a Client ID is not enough. Portal access needs a one-time code delivered to the contact we hold on file — email, WhatsApp or SMS — so a guessed ID alone gets nobody in."
          />
          <div className="mt-10">
            <PortalSignInSequence />
          </div>
        </div>
      </section>

      <CtaBand
        title="Want this stack working for your business?"
        description="We will recommend the right subset — or tell you honestly when something simpler serves you better. Written scope first, preview second, payment last."
      />
    </main>
  );
}
