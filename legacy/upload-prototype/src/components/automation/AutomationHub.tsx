"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { MessageCircle, Share2, Workflow, Webhook, Cpu } from "lucide-react";
import { useAppStore, type AutomationTab } from "@/lib/store";
import { WhatsAppInbox } from "./WhatsAppInbox";
import { SocialInbox } from "./SocialInbox";
import { WorkflowsList } from "./WorkflowsList";
import { WebhooksList } from "./WebhooksList";

const TABS: Array<{ id: AutomationTab; label: string; icon: React.ComponentType<{ className?: string }>; description: string }> = [
  { id: "whatsapp", label: "WhatsApp Inbox", icon: MessageCircle, description: "3-pane live chat with quick replies" },
  { id: "social", label: "Social Inbox", icon: Share2, description: "Facebook · Instagram · LinkedIn · X" },
  { id: "workflows", label: "Workflows", icon: Workflow, description: "Automation flows with agent nodes" },
  { id: "webhooks", label: "Webhooks", icon: Webhook, description: "Registered endpoints and last-fired status" },
];

export function AutomationHub() {
  const { automationActiveTab, setAutomationActiveTab } = useAppStore();
  const active = TABS.find((t) => t.id === automationActiveTab) ?? TABS[0];

  return (
    <div className="relative">
      <section className="relative overflow-hidden border-b border-border/60">
        <div className="pointer-events-none absolute inset-0 gradient-hero opacity-50" />
        <div className="relative mx-auto max-w-[1400px] px-4 py-10 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/8 px-3 py-1 text-xs font-medium text-emerald-500">
              <Cpu className="size-3.5" />
              Automation Hub · always-on
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight md:text-3xl">
              Every channel, every workflow, one control room
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              Inbound WhatsApp, social DMs, automation flows, and webhooks — unified and observable.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Tab nav */}
      <div className="border-b border-border/60 bg-card/30">
        <div className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-4 md:px-6">
          {TABS.map((t) => {
            const Icon = t.icon;
            const on = automationActiveTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setAutomationActiveTab(t.id)}
                className={
                  "flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors " +
                  (on
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground")
                }
              >
                <Icon className="size-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <active.icon className="size-3.5" />
          {active.description}
        </div>

        {automationActiveTab === "whatsapp" && <WhatsAppInbox />}
        {automationActiveTab === "social" && <SocialInbox />}
        {automationActiveTab === "workflows" && <WorkflowsList />}
        {automationActiveTab === "webhooks" && <WebhooksList />}
      </main>
    </div>
  );
}
