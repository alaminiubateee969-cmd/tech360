"use client";

import { motion } from "framer-motion";
import { TrendingUp, Clock, DollarSign, Repeat } from "lucide-react";
import { Card } from "@/components/ui/card";

const CASES = [
  {
    client: "Apex Realty",
    industry: "Real Estate",
    headline: "+340% lead conversion",
    body: "Replaced spreadsheets with a custom CRM + WhatsApp routing. Hot leads now auto-paged to senior reps within 90 seconds.",
    metrics: [
      { icon: TrendingUp, label: "Conversion", value: "+340%" },
      { icon: Clock, label: "Response time", value: "-67%" },
    ],
  },
  {
    client: "BrightPath",
    industry: "Education",
    headline: "-67% response time",
    body: "Headless marketing site with an automation studio. SEO program delivered page-one rankings for 28 priority terms.",
    metrics: [
      { icon: Clock, label: "Response time", value: "-67%" },
      { icon: TrendingUp, label: "Organic traffic", value: "+212%" },
    ],
  },
  {
    client: "VidyaCore",
    industry: "EdTech",
    headline: "3,000 students live in 10 weeks",
    body: "SCORM-compliant LMS with SIS integration. Reduced admin overhead by 45% via automated enrollments and grading.",
    metrics: [
      { icon: Repeat, label: "Admin overhead", value: "-45%" },
      { icon: Clock, label: "Time-to-launch", value: "10 wks" },
    ],
  },
  {
    client: "Lumiere Hotels",
    industry: "Hospitality",
    headline: "+28% direct bookings",
    body: "Guest experience app with smart concierge. Cut OTA commission dependency by routing guests to direct channels.",
    metrics: [
      { icon: TrendingUp, label: "Direct bookings", value: "+28%" },
      { icon: DollarSign, label: "OTA fees", value: "-$84k/yr" },
    ],
  },
  {
    client: "Studio Mira",
    industry: "Design",
    headline: "Brand launch in 4 weeks",
    body: "Full identity system + Webflow site + design tokens. Founder went from idea to launch-ready in under a month.",
    metrics: [
      { icon: Clock, label: "Time-to-launch", value: "4 wks" },
      { icon: TrendingUp, label: "Inbound leads", value: "+5x" },
    ],
  },
  {
    client: "Manufactron",
    industry: "Manufacturing",
    headline: "-$120k/yr in downtime",
    body: "IoT dashboard + anomaly alerts across 8 production lines. Mean-time-to-detect dropped from hours to under 4 minutes.",
    metrics: [
      { icon: DollarSign, label: "Downtime cost", value: "-$120k/yr" },
      { icon: Clock, label: "MTTD", value: "<4 min" },
    ],
  },
];

export function CaseStudies() {
  return (
    <section id="case-studies" className="border-y border-border/40 bg-card/30">
      <div className="mx-auto max-w-[1400px] px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
            Case studies
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Outcomes, not just deliverables
          </h2>
          <p className="mt-4 text-muted-foreground">
            Real numbers from real engagements. Every result is tied to a
            measurable business metric.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CASES.map((c, i) => (
            <motion.div
              key={c.client}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: (i % 3) * 0.05 }}
            >
              <Card className="group flex h-full flex-col gap-4 p-6 transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{c.client}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.industry}
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-500">
                    {c.headline}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{c.body}</p>
                <div className="mt-auto grid grid-cols-2 gap-2 border-t border-border/60 pt-4">
                  {c.metrics.map((m) => {
                    const Icon = m.icon;
                    return (
                      <div key={m.label} className="flex items-center gap-2">
                        <Icon className="size-4 text-primary" />
                        <div>
                          <div className="text-sm font-semibold">
                            {m.value}
                          </div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            {m.label}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
