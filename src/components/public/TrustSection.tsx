"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Shield, Clock, FileText, GitBranch, Headphones, Lock, CheckCircle2, Award } from "lucide-react";

const TRUST_ITEMS = [
  { icon: Shield, title: "Security First", desc: "RBAC, encryption, audit logging, and approval gates on every action" },
  { icon: Clock, title: "Reliable Delivery", desc: "Clear timelines, milestone-based delivery, transparent progress tracking" },
  { icon: FileText, title: "Clear Scope", desc: "Detailed scope of work approved before any development begins" },
  { icon: GitBranch, title: "Structured Process", desc: "8-stage workflow from discovery to support — no surprises" },
  { icon: Headphones, title: "Responsive Support", desc: "30-day post-launch support included with every project" },
  { icon: Lock, title: "Secure Handover", desc: "Source code, credentials, and documentation transferred securely" },
  { icon: CheckCircle2, title: "Transparent Delivery", desc: "HTML preview before payment, testing before delivery" },
  { icon: Award, title: "Professional Process", desc: "Documentation, audit trails, and structured project management" },
];

export function TrustSection() {
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-[1400px] px-4 md:px-6">
        <div className="mb-10 text-center">
          <Badge variant="outline" className="mb-3">Why Trust Us</Badge>
          <h2 className="text-3xl font-bold md:text-4xl">Built on Trust, Not Promises</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            We don't use fake testimonials or inflated statistics. Here's what we actually deliver.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {TRUST_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.title} className="p-5 card-brand-shadow transition-shadow">
                <div className="mb-3 grid size-10 place-items-center rounded-lg gradient-brand-soft">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-1 text-sm font-semibold">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
