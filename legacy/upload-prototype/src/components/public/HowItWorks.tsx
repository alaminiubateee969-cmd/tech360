"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Search, ClipboardList, Palette, Code2, Zap, TestTube, Rocket, LifeBuoy } from "lucide-react";

const STAGES = [
  { id: "discover", label: "Discover", icon: Search, desc: "We learn your business, goals, and challenges", color: "bg-blue-500" },
  { id: "plan", label: "Plan", icon: ClipboardList, desc: "Scope of work, timeline, and milestones defined", color: "bg-navy-500" },
  { id: "design", label: "Design", icon: Palette, desc: "UI/UX design and system architecture", color: "bg-teal-500" },
  { id: "build", label: "Build", icon: Code2, desc: "Development with regular previews", color: "bg-green-500" },
  { id: "automate", label: "Automate", icon: Zap, desc: "Workflows and integrations configured", color: "bg-purple-500" },
  { id: "test", label: "Test", icon: TestTube, desc: "QA testing across all features and devices", color: "bg-amber-500" },
  { id: "deploy", label: "Deploy", icon: Rocket, desc: "Production deployment and handover", color: "bg-pink-500" },
  { id: "support", label: "Support", icon: LifeBuoy, desc: "30-day support and ongoing maintenance", color: "bg-cyan-500" },
];

export function HowItWorks() {
  const [hovered, setHovered] = React.useState<string | null>(null);

  return (
    <section id="process" className="bg-muted/20 py-16 md:py-24">
      <div className="mx-auto max-w-[1400px] px-4 md:px-6">
        <div className="mb-10 text-center">
          <Badge variant="outline" className="mb-3">How We Work</Badge>
          <h2 className="text-3xl font-bold md:text-4xl">From Idea to Launch in 8 Stages</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            A structured, transparent process that keeps you informed at every step.
          </p>
        </div>

        {/* Desktop: horizontal flow */}
        <div className="hidden md:block">
          <div className="grid grid-cols-8 gap-2">
            {STAGES.map((stage, i) => {
              const Icon = stage.icon;
              const isHovered = hovered === stage.id;
              return (
                <div key={stage.id} className="relative">
                  <button
                    onMouseEnter={() => setHovered(stage.id)}
                    onMouseLeave={() => setHovered(null)}
                    className="group flex flex-col items-center gap-2"
                  >
                    <div className={`grid size-12 place-items-center rounded-xl ${stage.color} text-white shadow-md transition-transform group-hover:scale-110 ${isHovered ? "scale-110" : ""}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-semibold">{stage.label}</span>
                  </button>
                  {i < STAGES.length - 1 && (
                    <div className="absolute left-full top-6 h-px w-full bg-border">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/50 to-transparent" />
                    </div>
                  )}
                  {/* Hover preview */}
                  {isHovered && (
                    <div className="absolute left-1/2 top-full z-10 mt-2 w-48 -translate-x-1/2 rounded-lg border bg-card p-3 shadow-lg">
                      <div className="mb-1 text-xs font-bold">{stage.label}</div>
                      <p className="text-[11px] text-muted-foreground">{stage.desc}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Mobile: vertical flow */}
        <div className="space-y-3 md:hidden">
          {STAGES.map((stage, i) => {
            const Icon = stage.icon;
            return (
              <div key={stage.id} className="flex items-start gap-3">
                <div className={`grid size-10 shrink-0 place-items-center rounded-lg ${stage.color} text-white`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 pb-2">
                  <div className="text-sm font-semibold">{stage.label}</div>
                  <div className="text-xs text-muted-foreground">{stage.desc}</div>
                </div>
                {i < STAGES.length - 1 && <div className="absolute left-5 mt-10 h-8 w-px bg-border" />}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
