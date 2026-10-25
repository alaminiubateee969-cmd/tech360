"use client";

import * as React from "react";
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  MessagesSquare,
  FileText,
  CreditCard,
  CheckSquare,
  FolderOpen,
  UserCog,
  BookOpen,
  BarChart3,
  ScrollText,
  Settings,
  X,
} from "lucide-react";
import { useAppStore, type CrmModule } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV: Array<{ id: CrmModule; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "leads", label: "Leads", icon: Users },
  { id: "clients", label: "Clients", icon: Users },
  { id: "projects", label: "Projects", icon: KanbanSquare },
  { id: "communications", label: "Communications", icon: MessagesSquare },
  { id: "scopes", label: "Scopes", icon: FileText },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "approvals", label: "Approvals", icon: CheckSquare },
  { id: "files", label: "Files", icon: FolderOpen },
  { id: "staff", label: "Staff", icon: UserCog },
  { id: "knowledge", label: "Knowledge Base", icon: BookOpen },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "audit", label: "Audit Trail", icon: ScrollText },
  { id: "settings", label: "Settings", icon: Settings },
];

export function DashboardSidebar() {
  const { crmActiveModule, setCrmActiveModule, crmSidebarOpen, setCrmSidebarOpen } =
    useAppStore();

  return (
    <>
      {/* Mobile overlay */}
      {crmSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setCrmSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border/60 bg-sidebar text-sidebar-foreground transition-transform lg:sticky lg:top-16 lg:z-0 lg:h-[calc(100vh-4rem)] lg:translate-x-0",
          crmSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between border-b border-sidebar-border/60 p-4 lg:hidden">
          <span className="text-sm font-semibold">CRM navigation</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCrmSidebarOpen(false)}
          >
            <X className="size-4" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin p-3">
          <div className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Operations
          </div>
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = crmActiveModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCrmActiveModule(item.id);
                  setCrmSidebarOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                  active
                    ? "bg-primary/12 text-primary"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border/60 p-4">
          <div className="rounded-lg bg-sidebar-accent/60 p-3">
            <div className="text-xs font-medium">Logged in as</div>
            <div className="mt-1 text-sm font-semibold">Tariq Aziz</div>
            <div className="text-xs text-muted-foreground">SUPER_ADMIN</div>
          </div>
        </div>
      </aside>
    </>
  );
}
