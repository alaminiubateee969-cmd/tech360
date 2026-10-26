"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  TrendingUp,
  Clock,
  DollarSign,
  Repeat,
  Quote,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface CaseStudy {
  client: string;
  industry: string;
  headline: string;
  body: string;
  challenge: string;
  solution: string;
  metrics: Array<{ icon: React.ComponentType<{ className?: string }>; label: string; value: string }>;
  testimonial?: { quote: string; author: string; role: string };
  screenshots?: string[];
  duration: string;
  team: string;
}

const CASE_DETAILS: Record<string, CaseStudy> = {
  "Apex Realty": {
    client: "Apex Realty",
    industry: "Real Estate",
    headline: "+340% lead conversion",
    body: "Replaced spreadsheets with a custom CRM + WhatsApp routing. Hot leads now auto-paged to senior reps within 90 seconds.",
    challenge: "Apex Realty was losing 60% of inbound WhatsApp leads to slow response times. Their 12 agents used a shared spreadsheet that nobody owned, and leads were often contacted 4+ hours after the first message — by which time the prospect had already signed with a competitor.",
    solution: "We deployed a Tech360 CRM with WhatsApp Cloud API integration, AI lead-scoring (hot/warm/cold), and n8n routing rules. Hot leads now page the closest available senior agent within 90 seconds, day or night. The CRM also auto-records every conversation and produces a weekly conversion report.",
    metrics: [
      { icon: TrendingUp, label: "Conversion", value: "+340%" },
      { icon: Clock, label: "Response time", value: "-67%" },
      { icon: Repeat, label: "Lead retention", value: "+92%" },
    ],
    testimonial: {
      quote: "Tech360 didn't just give us software — they gave us an operating system. We close 3x more deals with the same headcount.",
      author: "Imran Hossain",
      role: "Managing Director, Apex Realty",
    },
    duration: "10 weeks",
    team: "1 strategist + 2 engineers + 1 designer",
  },
  "BrightPath": {
    client: "BrightPath",
    industry: "Education",
    headline: "-67% response time",
    body: "Headless marketing site with an AI content studio. SEO program delivered page-one rankings for 28 priority terms.",
    challenge: "BrightPath's marketing site was a 6-year-old WordPress install with 4-second load times and zero content pipeline. Their admissions team was answering the same 12 questions on WhatsApp every single day.",
    solution: "We rebuilt the site as a Next.js headless frontend with a Sanity CMS, an AI content studio that drafts weekly SEO articles, and a WhatsApp chatbot that handles the 12 repetitive questions. Admissions now only sees warm leads who have already been pre-qualified.",
    metrics: [
      { icon: Clock, label: "Response time", value: "-67%" },
      { icon: TrendingUp, label: "Organic traffic", value: "+212%" },
      { icon: DollarSign, label: "Cost per lead", value: "-44%" },
    ],
    testimonial: {
      quote: "Our admissions team finally spends their time on human conversations, not copy-pasting answers. Tech360 understood the education business from day one.",
      author: "Sarah Mitchell",
      role: "Director of Admissions, BrightPath",
    },
    duration: "8 weeks",
    team: "1 strategist + 2 engineers + 1 designer",
  },
  "Manufactron": {
    client: "Manufactron",
    industry: "Manufacturing",
    headline: "-$120k/yr in downtime",
    body: "IoT dashboard + anomaly alerts across 8 production lines. Mean-time-to-detect dropped from hours to under 4 minutes.",
    challenge: "Manufactron's 8 production lines had unscheduled downtime events that cost an average of $14,000 per incident. Their maintenance team typically found out about failures 2-3 hours after they started — when production had already missed quota.",
    solution: "We instrumented every line with IoT sensors feeding into a custom Next.js dashboard. An AI anomaly-detection agent watches the stream 24/7 and pages the on-call mechanic within 4 minutes of any deviation. The full incident timeline is preserved in the CRM for post-mortems.",
    metrics: [
      { icon: DollarSign, label: "Downtime cost", value: "-$120k/yr" },
      { icon: Clock, label: "MTTD", value: "<4 min" },
      { icon: TrendingUp, label: "OEE", value: "+11%" },
    ],
    testimonial: {
      quote: "We went from reactive to predictive in one quarter. The ROI was visible in the first month.",
      author: "Karim Soltani",
      role: "VP Operations, Manufactron",
    },
    duration: "16 weeks",
    team: "1 strategist + 3 engineers + 1 IoT specialist",
  },
};

export function PortfolioDetail({
  clientName,
  onClose,
}: {
  clientName: string | null;
  onClose: () => void;
}) {
  const detail = clientName ? CASE_DETAILS[clientName] : null;

  return (
    <AnimatePresence>
      {detail && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.3 }}
            className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border/60 bg-background shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-start justify-between gap-3 border-b border-border/60 bg-card/40 p-6">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{detail.industry}</Badge>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                    {detail.headline}
                  </span>
                </div>
                <h2 className="mt-3 text-2xl font-bold">{detail.client}</h2>
                <div className="mt-1 text-sm text-muted-foreground">
                  {detail.duration} · {detail.team}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
                <X className="size-4" />
              </Button>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Hero stats */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {detail.metrics.map((m) => {
                  const Icon = m.icon;
                  return (
                    <Card key={m.label} className="border-primary/30 bg-primary/5 p-4">
                      <Icon className="size-5 text-primary" />
                      <div className="mt-2 text-2xl font-bold">{m.value}</div>
                      <div className="text-xs text-muted-foreground">{m.label}</div>
                    </Card>
                  );
                })}
              </div>

              {/* Challenge */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                  Challenge
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {detail.challenge}
                </p>
              </div>

              {/* Solution */}
              <div className="mt-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                  Solution
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {detail.solution}
                </p>
              </div>

              {/* Testimonial */}
              {detail.testimonial && (
                <div className="mt-8">
                  <Card className="border-primary/20 bg-card/40 p-6">
                    <Quote className="size-6 text-primary/40" />
                    <p className="mt-3 text-lg font-medium italic leading-relaxed">
                      “{detail.testimonial.quote}”
                    </p>
                    <div className="mt-4">
                      <div className="font-semibold">{detail.testimonial.author}</div>
                      <div className="text-xs text-muted-foreground">
                        {detail.testimonial.role}
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
