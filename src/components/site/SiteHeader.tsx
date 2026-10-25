"use client";

import { useState, useSyncExternalStore } from "react";
import {
  ArrowRight, BarChart3, Bot, BookOpen, Briefcase, ChevronDown, GraduationCap,
  HeartPulse, Home, Layers, LifeBuoy, Mail, Menu, MessageCircle, MonitorSmartphone,
  Newspaper, PanelsTopLeft, ShoppingBag, Sparkles, UserRound, Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { COMPANY } from "@/data/site";
import { hashSection } from "./nav";

/* External-store subscriptions (hash + scroll) — no effects, no setState races. */
function subscribeHash(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
function getHashSnapshot(): string {
  return window.location.hash || "#/";
}
function subscribeScroll(callback: () => void) {
  window.addEventListener("scroll", callback, { passive: true });
  return () => window.removeEventListener("scroll", callback);
}
function getScrolledSnapshot(): boolean {
  return window.scrollY > 24;
}

interface NavItem { label: string; href: string; desc: string; icon: React.ElementType }
interface NavGroup { label: string; section: string; items: NavItem[] }

/** Grouped navigation — every href is a real route of this app. */
const NAV_GROUPS: NavGroup[] = [
  {
    label: "AI Solutions",
    section: "services",
    items: [
      { label: "AI Agent Systems", href: "#/services/ai-agent-systems", desc: "Specialized assistants for research, operations and service", icon: Bot },
      { label: "AI Business Automation", href: "#/services/ai-business-automation", desc: "Connected workflows that remove repetitive manual work", icon: Workflow },
      { label: "Customer Messaging Automation", href: "#/services/whatsapp-automation", desc: "Multichannel customer conversations with human oversight", icon: MessageCircle },
      { label: "Business Dashboards & BI", href: "#/services/business-dashboards", desc: "KPIs, reports and decisions from one screen", icon: BarChart3 },
      { label: "Workflow Automation (n8n)", href: "#/services/n8n-workflow-automation", desc: "Integrations and automations across your existing tools", icon: Sparkles },
      { label: "All services", href: "#/services", desc: "The complete service catalogue", icon: Layers },
    ],
  },
  {
    label: "Products",
    section: "technologies",
    items: [
      { label: "Platform & Technologies", href: "#/technologies", desc: "The stack and modules the platform is built from", icon: MonitorSmartphone },
      { label: "Client Portal", href: "#/portal", desc: "Sign in to projects, files, invoices and updates", icon: UserRound },
      { label: "Design Kit", href: "#/design-kit", desc: "Live diagrams, buttons and interface components", icon: PanelsTopLeft },
      { label: "Selected Work", href: "#/work", desc: "Representative engagements and deliverables", icon: Briefcase },
    ],
  },
  {
    label: "Industries",
    section: "industries",
    items: [
      { label: "E-commerce & Retail", href: "#/industries/ecommerce", desc: "Stores, catalogues, orders and customer follow-up", icon: ShoppingBag },
      { label: "Education & Training", href: "#/industries/education", desc: "Admissions, courses and learner communication", icon: GraduationCap },
      { label: "Healthcare", href: "#/industries/healthcare", desc: "Appointments, patient communication and records flow", icon: HeartPulse },
      { label: "All industries", href: "#/industries", desc: "Every vertical we build for", icon: Layers },
    ],
  },
  {
    label: "Resources",
    section: "blog",
    items: [
      { label: "Blog & Insights", href: "#/blog", desc: "Engineering notes and practical guides", icon: Newspaper },
      { label: "How We Work", href: "#/process", desc: "Seven phases, two gates, zero surprises", icon: BookOpen },
      { label: "FAQs", href: "#/faq", desc: "Answers on scope, pricing model and delivery", icon: LifeBuoy },
      { label: "Careers", href: "#/careers", desc: "Open roles and how to apply", icon: Briefcase },
    ],
  },
];

const linkCls = (active: boolean, solid: boolean) => cn(
  "relative inline-flex min-h-11 items-center gap-1 rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#009FE3]",
  solid
    ? active ? "text-[#009FE3]" : "text-[#0B1F33]/80 hover:text-[#009FE3]"
    : active ? "text-white" : "text-white/80 hover:text-white",
);

function NavDropdown({ group, activeSection, solid }: { group: NavGroup; activeSection: string; solid: boolean }) {
  const [open, setOpen] = useState(false);
  const active = activeSection === group.section;
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false); }}
      onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
    >
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        className={linkCls(active, solid)}
      >
        {group.label}
        <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden="true" />
        <span aria-hidden="true" className={cn("absolute inset-x-3 bottom-1.5 h-0.5 rounded-full bg-[#009FE3] transition-opacity", active ? "opacity-100" : "opacity-0", !solid && active && "bg-white/90")} />
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-50 w-[22rem] -translate-x-1/2 pt-1">
          <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_18px_50px_rgba(11,31,51,0.16)]" role="menu" aria-label={group.label}>
            {group.items.map((item) => (
              <a key={item.href} href={item.href} role="menuitem" onClick={() => setOpen(false)}
                className="flex gap-3 px-4 py-3 outline-none transition-colors hover:bg-[#F4FAFF] focus-visible:bg-[#F4FAFF] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#009FE3]">
                <item.icon className="mt-0.5 size-5 shrink-0 text-[#009FE3]" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-semibold text-[#0B1F33]">{item.label}</span>
                  <span className="block text-xs leading-5 text-[#526173]">{item.desc}</span>
                </span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Public site header. Transparent over the dark hero, solid after scroll.
 * Grouped mega-menu navigation with keyboard (focus/Escape) support.
 */
export default function SiteHeader({ currentHash }: { currentHash?: string }) {
  const internalHash = useSyncExternalStore(subscribeHash, getHashSnapshot, () => "#/");
  const scrolled = useSyncExternalStore(subscribeScroll, getScrolledSnapshot, () => false);
  const [menuOpen, setMenuOpen] = useState(false);

  const hash = currentHash ?? internalHash;
  const activeSection = hashSection(hash);
  const solid = scrolled;

  return (
    <header className={cn(
      "fixed inset-x-0 top-0 z-50 transition-all duration-300",
      solid ? "border-b border-[#E2E8F0] bg-white/95 shadow-[0_2px_16px_rgba(11,31,51,0.06)] backdrop-blur" : "bg-transparent",
    )}>
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:h-[4.5rem] sm:px-6 lg:px-8">
        <a href="#/" aria-label="Tech360 home"
          className={cn("flex shrink-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3]", solid ? "p-1" : "bg-white/95 px-2.5 py-2 shadow-sm")}>
          <img src="/brand/tech360-logo-original.jpg" alt="Tech360 logo" className="h-9 w-auto rounded-md object-contain sm:h-10" width={40} height={40} />
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
          <a href="#/" aria-current={activeSection === "" ? "page" : undefined} className={linkCls(activeSection === "", solid)}>
            <Home className="size-4" aria-hidden="true" /> Home
          </a>
          <NavDropdown group={NAV_GROUPS[0]} activeSection={activeSection} solid={solid} />
          <NavDropdown group={NAV_GROUPS[1]} activeSection={activeSection} solid={solid} />
          <NavDropdown group={NAV_GROUPS[2]} activeSection={activeSection} solid={solid} />
          <a href="#/services" aria-current={activeSection === "services" ? "page" : undefined} className={linkCls(activeSection === "services", solid)}>Services</a>
          <NavDropdown group={NAV_GROUPS[3]} activeSection={activeSection} solid={solid} />
          <a href="#/about" aria-current={activeSection === "about" ? "page" : undefined} className={linkCls(activeSection === "about", solid)}>About Us</a>
          <a href="#/contact" aria-current={activeSection === "contact" ? "page" : undefined} className={linkCls(activeSection === "contact", solid)}>Contact</a>
        </nav>

        <div className="flex items-center gap-2">
          <a href="#/portal"
            className={cn("hidden min-h-11 items-center rounded-lg px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#009FE3] md:inline-flex", solid ? "text-[#063B8F] hover:text-[#009FE3]" : "text-white/90 hover:text-white")}>
            Sign In
          </a>
          <Button asChild className="hidden min-h-11 rounded-lg bg-[#009FE3] px-5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(6,59,143,0.25)] hover:bg-[#0090CC] sm:inline-flex">
            <a href="#/contact" className="focus-visible:outline-none">Book a Demo <ArrowRight className="size-4" aria-hidden="true" /></a>
          </Button>
          <Button variant="outline" size="icon" aria-label="Open navigation menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}
            className={cn("size-11 rounded-lg lg:hidden", solid ? "border-[#E2E8F0] bg-white text-[#0B1F33]" : "border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20")}>
            <Menu className="size-5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="w-80 max-w-[85vw] overflow-y-auto p-0">
          <SheetHeader className="border-b border-[#E2E8F0] p-4">
            <SheetTitle asChild>
              <a href="#/" className="inline-flex items-center" aria-label="Tech360 home">
                <img src="/brand/tech360-logo-original.jpg" alt="Tech360 logo" className="h-9 w-auto rounded-md object-contain" />
              </a>
            </SheetTitle>
            <SheetDescription className="text-xs text-[#526173]">{COMPANY.legalName} · {COMPANY.tagline}</SheetDescription>
          </SheetHeader>
          <nav aria-label="Mobile" className="flex flex-col gap-1 p-3">
            <MobileLink href="#/" label="Home" active={activeSection === ""} onClick={() => setMenuOpen(false)} />
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="mt-2">
                <p className="px-4 pb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#526173]">{group.label}</p>
                {group.items.map((item) => (
                  <MobileLink key={item.href} href={item.href} label={item.label} active={false} onClick={() => setMenuOpen(false)} />
                ))}
              </div>
            ))}
            <div className="mt-2">
              <p className="px-4 pb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#526173]">Company</p>
              <MobileLink href="#/services" label="Services" active={activeSection === "services"} onClick={() => setMenuOpen(false)} />
              <MobileLink href="#/about" label="About Us" active={activeSection === "about"} onClick={() => setMenuOpen(false)} />
              <MobileLink href="#/contact" label="Contact" active={activeSection === "contact"} onClick={() => setMenuOpen(false)} />
              <MobileLink href="#/portal" label="Sign In" active={activeSection === "portal"} onClick={() => setMenuOpen(false)} />
            </div>
            <a href="#/contact" onClick={() => setMenuOpen(false)}
              className="mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#009FE3] px-5 text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3]">
              Book a Demo <ArrowRight className="size-4" aria-hidden="true" />
            </a>
            <p className="mt-3 flex items-center gap-2 px-4 text-xs text-[#526173]"><Mail className="size-3.5" aria-hidden="true" /> {COMPANY.email}</p>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}

function MobileLink({ href, label, active, onClick }: { href: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <a href={href} onClick={onClick} aria-current={active ? "page" : undefined}
      className={cn("flex min-h-11 items-center rounded-lg px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#009FE3]",
        active ? "bg-[#F4FAFF] text-[#009FE3]" : "text-[#0B1F33] hover:bg-[#F4FAFF] hover:text-[#009FE3]")}>
      {label}
    </a>
  );
}
