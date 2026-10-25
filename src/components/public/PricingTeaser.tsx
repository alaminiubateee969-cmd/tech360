"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const TIERS = [
  {
    name: "Starter",
    price: "From $750",
    blurb: "Business websites and landing pages.",
    features: [
      "Responsive design",
      "SEO optimization",
      "Contact form integration",
      "1–2 week delivery",
      "30-day support",
    ],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Professional",
    price: "From $2,500",
    blurb: "Premium corporate websites with custom features.",
    features: [
      "Custom UI/UX design",
      "CMS integration",
      "Analytics dashboard",
      "Performance optimization",
      "2–4 week delivery",
      "30-day support",
    ],
    cta: "Get Started",
    highlight: true,
  },
  {
    name: "Business Systems",
    price: "From $5,000",
    blurb: "CRM, automation, and business management platforms.",
    features: [
      "Custom CRM development",
      "Workflow automation",
      "Multi-channel integration",
      "Admin dashboard",
      "4–8 week delivery",
      "60-day support",
    ],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Custom Software",
    price: "From $10,000",
    blurb: "Enterprise applications and custom platforms.",
    features: [
      "Full-stack development",
      "API integrations",
      "Database architecture",
      "Cloud deployment",
      "8–16 week delivery",
      "90-day support",
    ],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Enterprise / Automation",
    price: "Custom Estimate",
    blurb: "Large-scale systems with advanced requirements.",
    features: [
      "Solution architecture",
      "Dedicated team",
      "Custom integrations",
      "SLA & priority support",
      "Flexible timeline",
      "Ongoing maintenance",
    ],
    cta: "Talk to Us",
    highlight: false,
  },
];

export function PricingTeaser() {
  return (
    <section id="pricing" className="bg-muted/20 py-16 md:py-24">
      <div className="mx-auto max-w-[1400px] px-4 md:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
            Pricing Approach
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Transparent Project Pricing
          </h2>
          <p className="mt-4 text-muted-foreground">
            Final pricing is based on approved scope, estimated engineering hours, integrations, third-party services and delivery requirements.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {TIERS.slice(0, 3).map((t, i) => (
            <PricingCard key={t.name} tier={t} index={i} />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {TIERS.slice(3).map((t, i) => (
            <PricingCard key={t.name} tier={t} index={i + 3} />
          ))}
        </div>

        <div className="mt-8 rounded-xl border bg-card p-5 text-center">
          <p className="text-sm text-muted-foreground">
            Need a custom quote? Every project starts with a free consultation and detailed scope of work.
          </p>
          <Button className="mt-4 gap-2" asChild>
            <a href="#contact">Request a Quote <Sparkles className="h-4 w-4" /></a>
          </Button>
        </div>
      </div>
    </section>
  );
}

function PricingCard({ tier, index }: { tier: typeof TIERS[0]; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
    >
      <Card
        className={
          "relative flex h-full flex-col p-6 transition-all " +
          (tier.highlight
            ? "border-primary/50 shadow-xl shadow-primary/10 ring-1 ring-primary/30"
            : "hover:border-primary/30 card-brand-shadow")
        }
      >
        {tier.highlight && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
            Most Popular
          </span>
        )}
        <h3 className="text-lg font-semibold">{tier.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{tier.blurb}</p>
        <div className="mt-5">
          <span className="text-3xl font-bold tracking-tight">{tier.price}</span>
        </div>
        <ul className="mt-6 flex-1 space-y-2.5">
          {tier.features.map((f) => (
            <li key={f} className="flex items-start gap-2.5 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
              <span className="text-foreground/85">{f}</span>
            </li>
          ))}
        </ul>
        <Button
          className="mt-6 w-full"
          variant={tier.highlight ? "default" : "outline"}
          asChild
        >
          <a href="#contact">{tier.cta}</a>
        </Button>
      </Card>
    </motion.div>
  );
}
