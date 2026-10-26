"use client";

import { useAppStore, type CrmModule } from "@/lib/store";
import { DashboardSidebar } from "./DashboardSidebar";
import { Dashboard } from "./modules/Dashboard";
import { LeadsTable } from "./modules/LeadsTable";
import { ClientsList } from "./modules/ClientsList";
import { ProjectsKanban } from "./modules/ProjectsKanban";
import { CommunicationsTimeline } from "./modules/CommunicationsTimeline";
import { ScopesList } from "./modules/ScopesList";
import { PaymentsTable } from "./modules/PaymentsTable";
import { ApprovalsQueue } from "./modules/ApprovalsQueue";
import { FilesManager } from "./modules/FilesManager";
import { StaffList } from "./modules/StaffList";
import { KnowledgeList } from "./modules/KnowledgeList";
import { AnalyticsCharts } from "./modules/AnalyticsCharts";
import { AuditTrail } from "./modules/AuditTrail";
import { SettingsForm } from "./modules/SettingsForm";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

const TITLES: Record<CrmModule, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Your business at a glance" },
  leads: { title: "Leads", subtitle: "Pipeline and lead intelligence" },
  clients: { title: "Clients", subtitle: "Client roster and 23-step journey tracker" },
  projects: { title: "Projects", subtitle: "Active engagements and delivery" },
  communications: { title: "Communications", subtitle: "Every client touchpoint, unified" },
  scopes: { title: "Scopes", subtitle: "Statements of work and approvals" },
  payments: { title: "Payments", subtitle: "Invoices, reconciliation, and verification" },
  approvals: { title: "Approvals", subtitle: "Pending queue across scope, payment, and content" },
  files: { title: "Files", subtitle: "Contracts, designs, deliverables, invoices" },
  staff: { title: "Staff", subtitle: "Team, roles, and permissions" },
  knowledge: { title: "Knowledge Base", subtitle: "Indexed, agent-ready playbooks" },
  analytics: { title: "Analytics", subtitle: "Trends, sources, and agent performance" },
  audit: { title: "Audit Trail", subtitle: "Every action, attributed and timestamped" },
  settings: { title: "Settings", subtitle: "General, WhatsApp, SMTP, and AI configuration" },
};

export function CrmView() {
  const { crmActiveModule, setCrmSidebarOpen } = useAppStore();
  const meta = TITLES[crmActiveModule];

  return (
    <div className="flex min-h-[calc(100vh-4rem)] bg-background">
      <DashboardSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Module header */}
        <header className="sticky top-16 z-20 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex items-center justify-between gap-4 px-4 py-4 md:px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setCrmSidebarOpen(true)}
                >
                  <Menu className="size-5" />
                </Button>
                <div>
                  <h1 className="truncate text-xl font-semibold tracking-tight md:text-2xl">
                    {meta.title}
                  </h1>
                  <p className="truncate text-sm text-muted-foreground">
                    {meta.subtitle}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          {crmActiveModule === "dashboard" && <Dashboard />}
          {crmActiveModule === "leads" && <LeadsTable />}
          {crmActiveModule === "clients" && <ClientsList />}
          {crmActiveModule === "projects" && <ProjectsKanban />}
          {crmActiveModule === "communications" && <CommunicationsTimeline />}
          {crmActiveModule === "scopes" && <ScopesList />}
          {crmActiveModule === "payments" && <PaymentsTable />}
          {crmActiveModule === "approvals" && <ApprovalsQueue />}
          {crmActiveModule === "files" && <FilesManager />}
          {crmActiveModule === "staff" && <StaffList />}
          {crmActiveModule === "knowledge" && <KnowledgeList />}
          {crmActiveModule === "analytics" && <AnalyticsCharts />}
          {crmActiveModule === "audit" && <AuditTrail />}
          {crmActiveModule === "settings" && <SettingsForm />}
        </main>
      </div>
    </div>
  );
}
