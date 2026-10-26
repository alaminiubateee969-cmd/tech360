"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Search, PencilRuler, Rocket, Trophy } from "lucide-react";

const PHASES = [
  {
    icon: Search,
    name: "Discover",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    steps: [
      "Intake brief + business goals",
      "Stakeholder interviews",
      "Competitive landscape audit",
      "Tech stack inventory",
      "Success metrics defined",
    ],
  },
  {
    icon: PencilRuler,
    name: "Design",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    steps: [
      "Information architecture",
      "Brand & visual system",
      "UX flows + wireframes",
      "Agent & workflow blueprints",
      "Scope of work drafted",
    ],
  },
  {
    icon: Rocket,
    name: "Deploy",
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    steps: [
      "Sprint plan + milestones",
      "Build in 2-week increments",
      "Agents configured & tuned",
      "Workflows wired to channels",
      "Internal QA + load test",
    ],
  },
  {
    icon: Trophy,
    name: "Deliver",
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    steps: [
      "Client UAT + approvals",
      "Evidence package assembled",
      "Training & documentation",
      "Go-live + monitoring",
      "30-day optimization sprint",
    ],
  },
];

export function ProcessSection() {
  return (
    <section id="process" className="relative">
      <div className="mx-auto max-w-[1400px] px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
            How we work
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            An 18-step process, distilled into 4 phases
          </h2>
          <p className="mt-4 text-muted-foreground">
            Every engagement runs through the same disciplined pipeline — with
            automation handling the busywork between phases.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {PHASES.map((phase, i) => {
            const Icon = phase.icon;
            return (
              <motion.div
                key={phase.name}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="relative"
              >
                <div className="rounded-2xl border border-border/60 bg-card p-6">
                  <div className="flex items-center gap-3">
                    <div className={`grid size-11 place-items-center rounded-xl ${phase.bg} ${phase.color}`}>
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Phase 0{i + 1}
                      </div>
                      <div className="text-lg font-semibold">{phase.name}</div>
                    </div>
                  </div>

                  <ul className="mt-5 space-y-2.5">
                    {phase.steps.map((s, idx) => (
                      <li key={s} className="flex items-start gap-2.5 text-sm">
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                          {i * 5 + idx + 1}
                        </span>
                        <span className="text-foreground/80">{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Connector */}
                {i < PHASES.length - 1 && (
                  <div className="absolute -right-2 top-1/2 hidden -translate-y-1/2 text-muted-foreground/40 lg:block">
                    →
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
