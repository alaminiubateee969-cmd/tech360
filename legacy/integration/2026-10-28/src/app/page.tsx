"use client";
import { TopNav } from "@/components/layout/TopNav";
import { PublicSite } from "@/components/public/PublicSite";
import { CrmView } from "@/components/crm/CrmView";
import { AiCommandCenter } from "@/components/ai/AiCommandCenter";
import { AutomationHub } from "@/components/automation/AutomationHub";
import { AiWorkforceView } from "@/components/ai-workforce/AiWorkforceView";
import { SuperAdminCommandCenter } from "@/components/super-admin/SuperAdminCommandCenter";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAppStore } from "@/lib/store";

export default function Home() {
  const activeView = useAppStore((s) => s.activeView);
  const isProtected = activeView === "crm" || activeView === "ai" || activeView === "automation" || activeView === "ai-workforce" || activeView === "super-admin";
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav />
      <div className="flex-1">
        {activeView === "public" && <PublicSite />}
        {isProtected && (
          <AuthGate>
            {activeView === "crm" && <CrmView />}
            {activeView === "ai" && <AiCommandCenter />}
            {activeView === "automation" && <AutomationHub />}
            {activeView === "ai-workforce" && <AiWorkforceView />}
            {activeView === "super-admin" && <SuperAdminCommandCenter />}
          </AuthGate>
        )}
      </div>
    </div>
  );
}
