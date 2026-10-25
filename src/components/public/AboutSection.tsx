"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Compass,
  Eye,
  Heart,
  Zap,
  ShieldCheck,
  Target,
  Users,
  Award,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const VALUES = [
  {
    icon: Compass,
    title: "Strategy first",
    body: "Every project starts with a discovery sprint. We don't write a line of code until we understand your business model and growth levers.",
  },
  {
    icon: Zap,
    title: "Automation native",
    body: "We embed AI agents and n8n workflows into every delivery — so your business runs while you sleep, not just while you click.",
  },
  {
    icon: Eye,
    title: "Radical transparency",
    body: "You get the same CRM view we use. Every task, every payment, every communication — attributed and timestamped.",
  },
  {
    icon: Heart,
    title: "Outcomes over output",
    body: "We measure success in revenue lifted, hours saved, and conversion gained — not deliverables shipped.",
  },
];

const TEAM = [
  {
    name: "Tariq Aziz",
    role: "Founder & Principal Consultant",
    bio: "15+ years architecting CRM and automation systems for SMBs across South Asia, MENA, and North America.",
    initials: "TA",
  },
  {
    name: "AI Workforce",
    role: "20 Specialist Agents",
    bio: "Always-on agents for lead intake, scope writing, content, finance, and ops — supervised by human managers.",
    initials: "AI",
  },
  {
    name: "Engineering Pod",
    role: "Senior Full-Stack Engineers",
    bio: "Next.js, Prisma, MySQL, and Cloud Run specialists. Shipped 50+ production deployments in 2025.",
    initials: "EP",
  },
  {
    name: "Design Studio",
    role: "Brand & Product Designers",
    bio: "Identity systems, Webflow, and design tokens. From idea to launch-ready in under a month.",
    initials: "DS",
  },
];

const STATS = [
  { icon: Users, value: "120+", label: "Clients served" },
  { icon: Award, value: "98%", label: "Client retention" },
  { icon: Target, value: "$4.2M", label: "Revenue lifted" },
  { icon: ShieldCheck, value: "SOC2-ready", label: "Audit trail" },
];

export function AboutSection() {
  return (
    <section id="about" className="border-y border-border/40 bg-card/30">
      <div className="mx-auto max-w-[1400px] px-4 py-16 md:px-6 md:py-24">
        {/* Story */}
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
              About Tech360
            </p>
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="mt-3 text-3xl font-bold tracking-tight md:text-4xl"
            >
              The operating system your business deserves
            </motion.h2>
            <div className="mt-6 space-y-4 text-muted-foreground">
              <p>
                Tech360 was founded in 2023 with a single conviction: small
                and mid-sized businesses deserve the same operational
                sophistication that Fortune 500s pay millions for — without
                the enterprise price tag or the 18-month implementation cycle.
              </p>
              <p>
                We build every client a unified business operating system:
                a Next.js CRM that captures every lead, AI agents that draft
                scopes and content, n8n workflows that route WhatsApp and
                social messages, and a 23-step client journey that turns a
                cold lead into a delivered, paid, and reviewed project —
                automatically.
              </p>
              <p>
                Today we run a 20-agent AI workforce alongside a senior
                human pod, serving 120+ active clients across e-commerce,
                education, healthcare, real estate, and hospitality.
              </p>
            </div>

            {/* Stats */}
            <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
              {STATS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                  >
                    <Card className="p-4">
                      <Icon className="size-5 text-primary" />
                      <div className="mt-2 text-2xl font-bold">{s.value}</div>
                      <div className="text-xs text-muted-foreground">{s.label}</div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Mission + Values */}
          <div>
            <Card className="border-primary/30 bg-primary/5 p-6">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                Our mission
              </h3>
              <p className="mt-3 text-lg font-medium leading-snug">
                To make enterprise-grade operational excellence accessible to
                every ambitious business — by combining senior human craft
                with an always-on AI workforce.
              </p>
            </Card>

            <h3 className="mt-8 text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Values we operate by
            </h3>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {VALUES.map((v) => {
                const Icon = v.icon;
                return (
                  <Card key={v.title} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary">
                        <Icon className="size-4" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{v.title}</div>
                        <p className="mt-1 text-xs text-muted-foreground">{v.body}</p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>

        {/* Team */}
        <div className="mt-16">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
              The team
            </p>
            <h3 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
              Senior humans + an always-on AI workforce
            </h3>
            <p className="mt-4 text-muted-foreground">
              We blend 15+ years of operator experience with a 20-agent AI
              workforce — so you get senior judgment and 24/7 execution in the
              same engagement.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((member, i) => (
              <motion.div
                key={member.name}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: (i % 4) * 0.05 }}
              >
                <Card className="flex h-full flex-col gap-3 p-5">
                  <div className="grid size-12 place-items-center rounded-xl gradient-amber text-base font-black text-black">
                    {member.initials}
                  </div>
                  <div>
                    <div className="font-semibold">{member.name}</div>
                    <Badge variant="secondary" className="mt-1 font-normal">
                      {member.role}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{member.bio}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
