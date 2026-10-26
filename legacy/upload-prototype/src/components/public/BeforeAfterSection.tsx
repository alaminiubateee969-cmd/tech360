"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, CheckCircle2, XCircle, TrendingUp } from "lucide-react";

export function BeforeAfterSection() {
  return (
    <section id="automation" className="py-16 md:py-24">
      <div className="mx-auto max-w-[1400px] px-4 md:px-6">
        <div className="mb-10 text-center">
          <Badge variant="outline" className="mb-3 gap-1.5"><Zap className="h-3 w-3" /> Business Automation</Badge>
          <h2 className="text-3xl font-bold md:text-4xl">Before vs After Automation</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            See the transformation from manual chaos to automated efficiency.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Before */}
          <Card className="overflow-hidden border-red-500/20 p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="grid size-10 place-items-center rounded-full bg-red-500/10 text-red-500">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Before Automation</h3>
                <p className="text-xs text-muted-foreground">Manual, slow, error-prone</p>
              </div>
            </div>
            <div className="space-y-2">
              {["Manual lead entry into spreadsheets", "Manual follow-up calls and emails", "Inconsistent response times", "Missed inquiries after hours", "No visibility into pipeline", "Manual reporting takes hours"].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </Card>

          {/* After */}
          <Card className="overflow-hidden border-emerald-500/20 bg-emerald-500/5 p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="grid size-10 place-items-center rounded-full bg-emerald-500/10 text-emerald-500">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">After Automation</h3>
                <p className="text-xs text-muted-foreground">Automated, fast, reliable</p>
              </div>
            </div>
            {/* Automated flow */}
            <div className="space-y-2">
              {[
                { label: "Lead captured automatically", desc: "From WhatsApp, web, social" },
                { label: "CRM creates record", desc: "Instant lead entry" },
                { label: "System classifies lead", desc: "Business type detected" },
                { label: "Auto notification sent", desc: "Sales team alerted" },
                { label: "Follow-up automated", desc: "Reminders scheduled" },
                { label: "Real-time dashboard", desc: "Full pipeline visibility" },
              ].map((item, i) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div className="grid size-5 place-items-center rounded-full bg-emerald-500 text-white text-[9px] font-bold shrink-0">{i + 1}</div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{item.label}</div>
                    <div className="text-[10px] text-muted-foreground">{item.desc}</div>
                  </div>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 p-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-600">70% less manual work · 3x faster response</span>
            </div>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <Button size="lg" className="gap-2" asChild>
            <a href="#contact">Automate Your Business <ArrowRight className="h-4 w-4" /></a>
          </Button>
        </div>
      </div>
    </section>
  );
}
