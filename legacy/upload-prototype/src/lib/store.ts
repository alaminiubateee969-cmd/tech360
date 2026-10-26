"use client";

import { create } from "zustand";

export type AppView = "public" | "crm" | "ai" | "automation" | "ai-workforce" | "super-admin";
export type CrmModule =
  | "dashboard"
  | "leads"
  | "clients"
  | "projects"
  | "communications"
  | "scopes"
  | "payments"
  | "approvals"
  | "files"
  | "staff"
  | "knowledge"
  | "analytics"
  | "audit"
  | "settings";
export type AutomationTab = "whatsapp" | "social" | "workflows" | "webhooks";
export type AiWorkforceTab =
  | "registry"
  | "executions"
  | "approvals"
  | "monitoring"
  | "models"
  | "skills";

interface AppState {
  // Top-level navigation
  activeView: AppView;
  setActiveView: (v: AppView) => void;

  // CRM sub-navigation
  crmActiveModule: CrmModule;
  setCrmActiveModule: (m: CrmModule) => void;

  // AI Command Center
  aiSelectedAgentId: string | null;
  setAiSelectedAgentId: (id: string | null) => void;

  // Automation Hub
  automationActiveTab: AutomationTab;
  setAutomationActiveTab: (t: AutomationTab) => void;

  // AI Workforce
  aiWorkforceActiveTab: AiWorkforceTab;
  setAiWorkforceActiveTab: (t: AiWorkforceTab) => void;
  aiWorkforceSelectedAgentSlug: string | null;
  setAiWorkforceSelectedAgentSlug: (s: string | null) => void;

  // CRM mobile sidebar toggle
  crmSidebarOpen: boolean;
  setCrmSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeView: "public",
  setActiveView: (v) => set({ activeView: v }),

  crmActiveModule: "dashboard",
  setCrmActiveModule: (m) => set({ crmActiveModule: m }),

  aiSelectedAgentId: null,
  setAiSelectedAgentId: (id) => set({ aiSelectedAgentId: id }),

  automationActiveTab: "whatsapp",
  setAutomationActiveTab: (t) => set({ automationActiveTab: t }),

  aiWorkforceActiveTab: "registry",
  setAiWorkforceActiveTab: (t) => set({ aiWorkforceActiveTab: t }),
  aiWorkforceSelectedAgentSlug: null,
  setAiWorkforceSelectedAgentSlug: (s) => set({ aiWorkforceSelectedAgentSlug: s }),

  crmSidebarOpen: false,
  setCrmSidebarOpen: (open) => set({ crmSidebarOpen: open }),
}));
