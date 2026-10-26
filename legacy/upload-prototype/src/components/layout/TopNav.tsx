"use client";
import * as React from "react";
import { useSession } from "next-auth/react";
import { Globe, LayoutDashboard, Bot, Workflow, Network, Shield, Menu, X } from "lucide-react";
import { useAppStore, type AppView } from "@/lib/store";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/auth/UserMenu";
import { LoginDialog } from "@/components/auth/LoginDialog";

const NAV: Array<{ id: AppView; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "public", label: "Platform", icon: Globe },
  { id: "crm", label: "CRM", icon: LayoutDashboard },
  { id: "ai", label: "AI Center", icon: Bot },
  { id: "automation", label: "Automation", icon: Workflow },
  { id: "ai-workforce", label: "AI Workforce", icon: Network },
  { id: "super-admin", label: "Super Admin", icon: Shield },
];

export function TopNav() {
  const { activeView, setActiveView } = useAppStore();
  const { data: session, status } = useSession();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [loginOpen, setLoginOpen] = React.useState(false);
  const go = (v: AppView) => { setActiveView(v); setMobileOpen(false); };

  // Only show internal tabs to authenticated users
  const isAuthenticated = status === "authenticated";
  const visibleNav = NAV.filter(item => item.id === "public" || isAuthenticated);
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 glass">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 md:px-6">
        <button onClick={() => go("public")} className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <div className="grid size-9 place-items-center rounded-lg gradient-amber text-black shadow-md"><span className="text-base font-black">T</span></div>
          <div className="hidden text-left sm:block"><div className="text-base font-semibold leading-tight">TECH360</div><div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Business OS</div></div>
        </button>
        <nav className="hidden items-center gap-1 md:flex">
          {visibleNav.map((item) => { const Icon = item.icon; const active = activeView === item.id; return (
            <Button key={item.id} variant="ghost" onClick={() => go(item.id)} className={cn("h-9 gap-2 rounded-full px-4 text-sm font-medium", active && "bg-primary/12 text-primary hover:bg-primary/20")}><Icon className="size-4" />{item.label}</Button>
          ); })}
        </nav>
        <div className="flex items-center gap-1.5">
          <a href="https://wa.me/8801327100297" target="_blank" rel="noreferrer" className="hidden lg:block"><Button variant="outline" size="sm" className="rounded-full gap-2"><span className="size-2 rounded-full bg-emerald-500 animate-pulse" />+880 1327-100297</Button></a>
          <ThemeToggle />
          {status === "authenticated" ? <UserMenu /> : <Button variant="outline" size="sm" className="rounded-full gap-2" onClick={() => setLoginOpen(true)}><Shield className="size-3.5" /> Sign in</Button>}
          <Button variant="ghost" size="icon" className="md:hidden rounded-full" aria-label="Open menu" onClick={() => setMobileOpen((v) => !v)}>{mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}</Button>
        </div>
      </div>
      {mobileOpen && (
        <nav className="border-t border-border/60 bg-background px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {visibleNav.map((item) => { const Icon = item.icon; const active = activeView === item.id; return (
              <Button key={item.id} variant="ghost" onClick={() => go(item.id)} className={cn("h-11 justify-start gap-3 rounded-lg px-3 text-sm", active && "bg-primary/12 text-primary")}><Icon className="size-4" />{item.label}</Button>
            ); })}
          </div>
        </nav>
      )}
      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </header>
  );
}
