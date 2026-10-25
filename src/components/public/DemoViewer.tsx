"use client";

import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, RotateCcw, X, Play, Eye, Monitor, Smartphone, Globe } from "lucide-react";

export type DemoType = "workflow" | "before-after" | "browser" | "phone" | "dashboard" | "video";

export interface DemoStep {
  label: string;
  description?: string;
  icon?: React.ElementType;
}

export interface DemoViewerProps {
  type: DemoType;
  title: string;
  description?: string;
  steps?: DemoStep[];
  ctaText?: string;
  ctaUrl?: string;
  videoUrl?: string;
  posterUrl?: string;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
  children?: React.ReactNode;
}

export function DemoViewer({
  type, title, description, steps = [], ctaText, ctaUrl,
  videoUrl, posterUrl, triggerLabel = "View Demo", triggerVariant = "outline",
  children,
}: DemoViewerProps) {
  const [open, setOpen] = React.useState(false);
  const [currentStep, setCurrentStep] = React.useState(0);

  const triggerIcon = type === "video" ? Play : type === "browser" ? Monitor : type === "phone" ? Smartphone : Eye;

  return (
    <>
      <Button
        variant={triggerVariant as any}
        size="sm"
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        {React.createElement(triggerIcon, { className: "h-3.5 w-3.5" })}
        {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto p-0">
          <DialogHeader className="border-b p-4">
            <DialogTitle className="flex items-center gap-2 text-lg">
              {title}
              <Badge variant="outline" className="text-[10px] uppercase">
                {type === "workflow" ? "See How It Works" : type === "before-after" ? "Product Preview" : type === "video" ? "Watch Demo" : "Product Preview"}
              </Badge>
            </DialogTitle>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </DialogHeader>

          <div className="p-6">
            {/* Demo content area */}
            <div className="mb-6 min-h-[300px] rounded-xl border bg-muted/20 p-4">
              {children ? children : <DefaultDemoVisual type={type} steps={steps} currentStep={currentStep} />}
            </div>

            {/* Step navigation for workflow demos */}
            {steps.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">Step {currentStep + 1} of {steps.length}</Badge>
                    <span className="text-sm font-medium">{steps[currentStep]?.label}</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={currentStep === 0} onClick={() => setCurrentStep(p => Math.max(0, p - 1))}>
                      <ChevronLeft className="h-3 w-3" /> Prev
                    </Button>
                    <Button size="sm" variant="outline" disabled={currentStep === steps.length - 1} onClick={() => setCurrentStep(p => Math.min(steps.length - 1, p + 1))}>
                      Next <ChevronRight className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setCurrentStep(0)}>
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {/* Step indicators */}
                <div className="flex gap-1.5">
                  {steps.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentStep(i)}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${i <= currentStep ? "bg-primary" : "bg-muted"}`}
                    />
                  ))}
                </div>
                {steps[currentStep]?.description && (
                  <p className="text-sm text-muted-foreground">{steps[currentStep].description}</p>
                )}
              </div>
            )}

            {/* CTA */}
            {ctaText && ctaUrl && (
              <div className="mt-4 flex justify-end">
                <Button asChild>
                  <a href={ctaUrl}>{ctaText}</a>
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DefaultDemoVisual({ type, steps, currentStep }: { type: DemoType; steps: DemoStep[]; currentStep: number }) {
  if (type === "workflow" && steps.length > 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8">
        {steps.map((s, i) => {
          const Icon = s.icon || ChevronRight;
          const active = i === currentStep;
          const done = i < currentStep;
          return (
            <React.Fragment key={i}>
              <div className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${active ? "border-primary bg-primary/5 scale-105 shadow-md" : done ? "border-emerald-500/30 bg-emerald-500/5 opacity-60" : "border-border opacity-40"}`}>
                <div className={`grid size-8 place-items-center rounded-full ${active ? "bg-primary text-primary-foreground" : done ? "bg-emerald-500 text-white" : "bg-muted"}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className="h-4 w-px bg-border" />}
            </React.Fragment>
          );
        })}
      </div>
    );
  }
  if (type === "before-after") {
    return (
      <div className="grid grid-cols-2 gap-4 py-4">
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <div className="mb-2 text-xs font-bold uppercase text-red-500">Before</div>
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div>Manual lead entry</div><div>Manual follow-up</div><div>Spreadsheets</div><div>Missed inquiries</div>
          </div>
        </div>
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="mb-2 text-xs font-bold uppercase text-emerald-500">After</div>
          <div className="space-y-1.5 text-xs">
            <div>Lead captured automatically</div><div>CRM + smart classification</div><div>Auto notifications</div><div>Real-time dashboard</div>
          </div>
        </div>
      </div>
    );
  }
  return <div className="grid place-items-center py-12 text-sm text-muted-foreground">Demo preview</div>;
}

/* ---- Reusable visual mockups ---- */

export function BrowserMockup({ url = "bdtech360.com", children }: { url?: string; children?: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-lg">
      <div className="flex items-center gap-2 border-b bg-muted/50 px-3 py-2">
        <div className="flex gap-1.5">
          <div className="size-2.5 rounded-full bg-red-400" />
          <div className="size-2.5 rounded-full bg-amber-400" />
          <div className="size-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="flex-1 rounded bg-background px-2 py-1 text-[10px] text-muted-foreground">{url}</div>
      </div>
      <div className="min-h-[180px] p-3">{children}</div>
    </div>
  );
}

export function PhoneMockup({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mx-auto w-[180px] rounded-[2rem] border-4 border-slate-800 bg-slate-900 p-2 shadow-xl">
      <div className="mb-1 h-1 w-12 rounded-full bg-slate-700 mx-auto" />
      <div className="min-h-[280px] overflow-hidden rounded-[1.5rem] bg-white">{children}</div>
    </div>
  );
}

export function DashboardMockup({ title = "Dashboard", children }: { title?: string; children?: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-lg">
      <div className="flex items-center gap-3 border-b bg-slate-50 px-3 py-2">
        <div className="flex gap-1">
          <div className="grid size-5 place-items-center rounded bg-primary text-[8px] font-bold text-primary-foreground">B</div>
        </div>
        <span className="text-xs font-semibold">{title}</span>
        <div className="ml-auto flex gap-1">
          <div className="size-1.5 rounded-full bg-muted-foreground/30" />
          <div className="size-1.5 rounded-full bg-muted-foreground/30" />
        </div>
      </div>
      <div className="flex">
        <div className="w-12 border-r bg-slate-50 p-1.5 space-y-1.5">
          <div className="h-4 rounded bg-primary/20" />
          <div className="h-4 rounded bg-muted" />
          <div className="h-4 rounded bg-muted" />
          <div className="h-4 rounded bg-muted" />
        </div>
        <div className="flex-1 p-2.5">{children}</div>
      </div>
    </div>
  );
}

export function WorkflowNode({ label, icon: Icon, active, color = "primary" }: { label: string; icon?: React.ElementType; active?: boolean; color?: string }) {
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-all ${active ? "border-primary bg-primary/5 shadow-md scale-105" : "border-border bg-card"}`}>
      {Icon && <Icon className="h-3.5 w-3.5 text-primary" />}
      <span className="text-xs font-medium">{label}</span>
      {active && <div className="ml-auto size-1.5 rounded-full bg-emerald-500 animate-pulse" />}
    </div>
  );
}

export function WorkflowConnector({ active }: { active?: boolean }) {
  return (
    <div className="relative mx-auto h-6 w-px">
      <div className="absolute inset-0 bg-border" />
      {active && <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 h-2 w-1 -translate-x-1/2 rounded-full bg-primary animate-flow-down" />
      </div>}
    </div>
  );
}
