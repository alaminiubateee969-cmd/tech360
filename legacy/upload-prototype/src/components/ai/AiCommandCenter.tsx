"use client";

import { motion } from "framer-motion";
import { Bot, Terminal as TerminalIcon, Cpu } from "lucide-react";
import { AgentGrid } from "./AgentGrid";
import { AgentChatPanel } from "./AgentChatPanel";
import { AITerminal } from "./AITerminal";
import { SkillResolver } from "./SkillResolver";

export function AiCommandCenter() {
  return (
    <div className="relative">
      {/* Hero strip */}
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 gradient-hero opacity-50" />
        <div className="relative mx-auto max-w-[1400px] px-4 py-10 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/8 px-3 py-1 text-xs font-medium text-violet-500">
              <Cpu className="size-3.5" />
              AgentOS · 20 agents on duty
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
              AI Command Center
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              Twenty specialized agents orchestrated by the AgentOS skill resolver.
              Click any agent to chat, or type a natural-language command into the terminal.
            </p>
          </motion.div>
        </div>
      </section>

      <main className="mx-auto max-w-[1400px] space-y-6 px-4 py-8 md:px-6">
        <AgentGrid />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <TerminalIcon className="size-4 text-emerald-500" />
              Natural-language terminal
            </div>
            <AITerminal />
          </div>
          <div>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Bot className="size-4 text-violet-500" />
              Skill catalog
            </div>
            <SkillResolver />
          </div>
        </div>
      </main>

      {/* Slide-in chat */}
      <AgentChatPanel />
    </div>
  );
}
