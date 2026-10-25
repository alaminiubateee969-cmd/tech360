"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Network, Users, Activity, ShieldCheck, BarChart3, Cpu, Sparkles } from "lucide-react";
import { useAppStore, type AiWorkforceTab } from "@/lib/store";
import { cn } from "@/lib/utils";
import { AgentRegistry } from "./AgentRegistry";
import { ExecutionsList } from "./ExecutionsList";
import { ApprovalsQueue } from "./ApprovalsQueue";
import { Monitoring } from "./Monitoring";
import { ModelsPanel } from "./ModelsPanel";
import { SkillsBrowser } from "./SkillsBrowser";

const TABS: Array<{ id: AiWorkforceTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "registry", label: "Agent Registry", icon: Users },
  { id: "executions", label: "Executions", icon: Activity },
  { id: "approvals", label: "Approvals", icon: ShieldCheck },
  { id: "monitoring", label: "Monitoring", icon: BarChart3 },
  { id: "models", label: "Models & Routing", icon: Cpu },
  { id: "skills", label: "Skills", icon: Sparkles },
];

export function AiWorkforceView() {
  const activeTab = useAppStore((s) => s.aiWorkforceActiveTab);
  const setTab = useAppStore((s) => s.setAiWorkforceActiveTab);

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col">
      {/* Hero strip */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-emerald-500/5" />
        <div className="relative mx-auto max-w-[1400px] px-4 py-8 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/8 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <Network className="size-3.5" />
              2,000 agents · 100 departments · AgentOS taxonomy
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
              AI Workforce System
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              A production-grade agent registry, execution engine, permissions system, memory &amp; RAG
              store, and evaluation framework — generated from the real AgentOS skill manifest.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Sub-tabs */}
      <div className="sticky top-16 z-30 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-2 md:px-6">
          <nav className="flex gap-1 overflow-x-auto py-2 scrollbar-thin">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="size-4" />
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 md:px-6">
        {activeTab === "registry" && <AgentRegistry />}
        {activeTab === "executions" && <ExecutionsList />}
        {activeTab === "approvals" && <ApprovalsQueue />}
        {activeTab === "monitoring" && <Monitoring />}
        {activeTab === "models" && <ModelsPanel />}
        {activeTab === "skills" && <SkillsBrowser />}
      </main>
    </div>
  );
}
