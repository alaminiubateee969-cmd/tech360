"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight, Play, Users, MessageSquare, Brain, BarChart3, Globe, Zap } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-background">
      {/* Gradient background */}
      <div className="absolute inset-0 gradient-hero" />
      <div className="absolute inset-0 grid-pattern opacity-30" />

      <div className="relative mx-auto max-w-[1400px] px-4 py-16 md:px-6 md:py-24">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          {/* Left: Content */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="h-3 w-3" />
              Enterprise Digital Platform
            </div>
            <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-6xl">
              Build the <span className="text-gradient-brand">Operating System</span> Your Business Deserves
            </h1>
            <p className="max-w-lg text-base text-muted-foreground md:text-lg">
              TECH360 builds websites, business systems, and workflow automation & social channels, trusted by growing businesses worldwide.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="gap-2" asChild>
                <a href="#contact"><Sparkles className="h-4 w-4" /> Get Started</a>
              </Button>
              <Button size="lg" variant="outline" className="gap-2" asChild>
                <a href="#process"><Play className="h-4 w-4" /> Watch Demo</a>
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><div className="size-1.5 rounded-full bg-emerald-500" /> Professional Process</span>
              <span className="flex items-center gap-1.5"><div className="size-1.5 rounded-full bg-blue-500" /> Custom Systems</span>
              <span className="flex items-center gap-1.5"><div className="size-1.5 rounded-full bg-teal-500" /> Trusted Delivery</span>
            </div>
          </div>

          {/* Right: Animated workflow ecosystem */}
          <HeroWorkflowVisual />
        </div>
      </div>
    </section>
  );
}

function HeroWorkflowVisual() {
  const [activeStep, setActiveStep] = React.useState(0);
  const steps = [
    { label: "New Lead", icon: Users, color: "bg-blue-500" },
    { label: "CRM", icon: Globe, color: "bg-navy-500" },
    { label: "Smart Routing", icon: Brain, color: "bg-teal-500" },
    { label: "WhatsApp", icon: MessageSquare, color: "bg-green-500" },
    { label: "Email", icon: MessageSquare, color: "bg-blue-400" },
    { label: "Analytics", icon: BarChart3, color: "bg-purple-500" },
  ];

  React.useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep(p => (p + 1) % steps.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative">
      {/* Glass card container */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 glass p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid size-6 place-items-center rounded-md gradient-brand text-[10px] font-bold text-white">B</div>
            <span className="text-xs font-semibold">TECH360 Platform</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
          </div>
        </div>

        {/* Workflow nodes */}
        <div className="space-y-1">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const active = i === activeStep;
            const done = i < activeStep;
            return (
              <React.Fragment key={i}>
                <div className={`flex items-center gap-3 rounded-lg border p-2.5 transition-all duration-300 ${active ? "border-primary bg-primary/10 scale-[1.02] shadow-md" : done ? "border-emerald-500/30 bg-emerald-500/5" : "border-border bg-card/50"}`}>
                  <div className={`grid size-8 place-items-center rounded-lg ${active ? s.color + " text-white" : done ? "bg-emerald-500/20 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-medium">{s.label}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {active ? "Processing..." : done ? "Completed" : "Waiting"}
                    </div>
                  </div>
                  {active && <Zap className="h-3 w-3 text-primary animate-pulse" />}
                  {done && <div className="text-[10px] text-emerald-500">✓</div>}
                </div>
                {i < steps.length - 1 && (
                  <div className="relative mx-4 h-3 w-px">
                    <div className="absolute inset-0 bg-border" />
                    {(active || done) && (
                      <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute left-1/2 h-2 w-0.5 -translate-x-1/2 rounded-full bg-primary animate-flow-down" />
                      </div>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Mini metrics bar */}
        <div className="mt-4 grid grid-cols-3 gap-2 border-t pt-3">
          <div className="text-center">
            <div className="text-sm font-bold text-blue-600">247</div>
            <div className="text-[9px] text-muted-foreground">Leads Today</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-teal-600">94%</div>
            <div className="text-[9px] text-muted-foreground">Auto-resolved</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-green-600">1.2s</div>
            <div className="text-[9px] text-muted-foreground">Avg Response</div>
          </div>
        </div>
      </div>

      {/* Floating badge */}
      <div className="absolute -right-2 -top-2 rounded-lg border border-border/60 glass px-3 py-1.5 text-[10px] shadow-lg">
        <span className="font-semibold text-primary">Enterprise-Grade</span>
      </div>
    </div>
  );
}
