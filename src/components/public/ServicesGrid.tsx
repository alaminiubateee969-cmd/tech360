"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DemoViewer, BrowserMockup, PhoneMockup, DashboardMockup, WorkflowNode, WorkflowConnector } from "./DemoViewer";
import {
  Globe, ShoppingCart, Users, MessageSquare, Brain, Workflow,
  BarChart3, Cloud, Zap, CheckCircle2, ArrowRight, Monitor, Smartphone,
  Package, CreditCard, Bell, FileText, TrendingUp, Database, Shield, Server,
} from "lucide-react";

interface ServiceCard {
  id: string;
  title: string;
  value: string;
  icon: React.ElementType;
  demoType: "workflow" | "browser" | "phone" | "dashboard" | "before-after";
  capabilities: string[];
  demoSteps?: Array<{ label: string; description?: string }>;
  visual: React.ReactNode;
}

const SERVICES: ServiceCard[] = [
  {
    id: "websites",
    title: "Custom Website Development",
    value: "Premium websites that convert visitors into customers",
    icon: Globe,
    demoType: "browser",
    capabilities: ["Responsive Design", "SEO Optimized", "Fast Loading", "CMS Integration"],
    visual: <WebsiteCardVisual />,
  },
  {
    id: "ecommerce",
    title: "eCommerce Platform",
    value: "Complete online store with inventory and payments",
    icon: ShoppingCart,
    demoType: "workflow",
    capabilities: ["Product Catalog", "Order Management", "Payment Gateway", "Inventory Sync", "Analytics"],
    demoSteps: [
      { label: "Product Added", description: "New product added to catalog" },
      { label: "Cart", description: "Customer adds items to cart" },
      { label: "Checkout", description: "Secure checkout process" },
      { label: "Payment", description: "Payment processed automatically" },
      { label: "Order Confirmed", description: "Customer receives confirmation" },
      { label: "Notification", description: "Admin and customer notified" },
    ],
    visual: <EcommerceCardVisual />,
  },
  {
    id: "crm",
    title: "CRM System",
    value: "Manage leads, customers, and sales pipeline in one place",
    icon: Users,
    demoType: "workflow",
    capabilities: ["Lead Management", "Pipeline Tracking", "Follow-up Automation", "Sales Reports", "Client Portal"],
    demoSteps: [
      { label: "Inquiry Received", description: "Lead arrives from Website, Social, or WhatsApp" },
      { label: "New Lead Created", description: "CRM automatically creates a lead record" },
      { label: "Lead Scoring", description: "System scores and categorizes the lead" },
      { label: "Employee Assigned", description: "Lead assigned to the right sales rep" },
      { label: "Follow-up Scheduled", description: "Automated follow-up reminders set" },
      { label: "Lead Converted", description: "Lead becomes a paying customer" },
    ],
    visual: <CRMCardVisual />,
  },
  {
    id: "whatsapp",
    title: "WhatsApp Automation",
    value: "Automate customer communication on WhatsApp",
    icon: MessageSquare,
    demoType: "phone",
    capabilities: ["Auto Replies", "Lead Capture", "Follow-up Reminders", "Broadcast Messages", "CRM Sync"],
    demoSteps: [
      { label: "Customer Sends Message", description: "Inquiry received on WhatsApp" },
      { label: "System Receives", description: "Automation captures the message" },
      { label: "CRM Creates Lead", description: "New lead record created automatically" },
      { label: "Auto Response Sent", description: "Instant reply sent to customer" },
      { label: "Follow-up Reminder", description: "Sales team gets notified" },
    ],
    visual: <WhatsAppCardVisual />,
  },
  {
    id: "ai",
    title: "Business Intelligence",
    value: "Data-driven insights and automated business workflows",
    icon: Brain,
    demoType: "workflow",
    capabilities: ["Data Analysis", "Business Detection", "Solution Design", "Scope Planning", "Quality Review"],
    demoSteps: [
      { label: "Customer Request", description: "Inquiry received and parsed" },
      { label: "System Analyzes", description: "System processes the request" },
      { label: "Business Type Detected", description: "System identifies industry" },
      { label: "Solution Recommended", description: "System suggests best approach" },
      { label: "Scope Generated", description: "Automated scope of work created" },
      { label: "Admin Review", description: "Human approval gate" },
    ],
    visual: <AICardVisual />,
  },
  {
    id: "workflows",
    title: "Business Workflow Automation",
    value: "Connect your tools and automate repetitive tasks",
    icon: Workflow,
    demoType: "workflow",
    capabilities: ["Lead Routing", "Task Assignment", "Notification Triggers", "Data Sync", "Scheduled Jobs"],
    demoSteps: [
      { label: "Lead", description: "New lead enters the system" },
      { label: "CRM", description: "Lead stored and organized" },
      { label: "Analysis", description: "System analyzes and recommends action" },
      { label: "WhatsApp", description: "Automated message sent" },
      { label: "Email", description: "Follow-up email dispatched" },
      { label: "Analytics", description: "Data flows to dashboard" },
    ],
    visual: <WorkflowCardVisual />,
  },
  {
    id: "dashboards",
    title: "Dashboard Development",
    value: "Real-time business intelligence dashboards",
    icon: BarChart3,
    demoType: "dashboard",
    capabilities: ["Revenue Tracking", "Lead Analytics", "Performance Metrics", "Custom Reports", "Real-time Updates"],
    visual: <DashboardCardVisual />,
  },
  {
    id: "cloud",
    title: "Cloud & Server Solutions",
    value: "Scalable cloud infrastructure for your business",
    icon: Cloud,
    demoType: "workflow",
    capabilities: ["Cloud Migration", "API Management", "Database Setup", "Monitoring", "Automated Backups"],
    demoSteps: [
      { label: "Website", description: "User request received" },
      { label: "API", description: "Application processes request" },
      { label: "Database", description: "Data retrieved securely" },
      { label: "Response", description: "Result sent back to user" },
      { label: "Backup", description: "Data backed up automatically" },
    ],
    visual: <CloudCardVisual />,
  },
  {
    id: "automation",
    title: "Business Process Automation",
    value: "Transform manual processes into automated workflows",
    icon: Zap,
    demoType: "before-after",
    capabilities: ["Lead Automation", "Task Automation", "Report Automation", "Notification Automation", "Escalation Rules"],
    visual: <BeforeAfterVisual />,
  },
];

export function ServicesGrid() {
  return (
    <section id="services" className="py-16 md:py-24">
      <div className="mx-auto max-w-[1400px] px-4 md:px-6">
        <div className="mb-10 text-center">
          <Badge variant="outline" className="mb-3 gap-1.5"><Zap className="h-3 w-3" /> What We Build</Badge>
          <h2 className="text-3xl font-bold md:text-4xl">Systems That Run Your Business</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Every service includes a visual product preview. See exactly what we build before you contact us.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <ServiceProductCard key={service.id} service={service} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ServiceProductCard({ service }: { service: ServiceCard }) {
  const Icon = service.icon;
  return (
    <Card className="flex min-h-[460px] flex-col overflow-hidden p-0 card-brand-shadow transition-shadow">
      {/* Visual area — 220px */}
      <div className="relative h-[220px] overflow-hidden border-b bg-muted/20">
        {service.visual}
      </div>

      {/* Content area — 240px minimum */}
      <div className="flex flex-1 flex-col p-7">
        <div className="mb-2 flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-lg gradient-brand text-white">
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="text-lg font-semibold">{service.title}</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">{service.value}</p>

        {/* Capabilities */}
        <div className="mb-4 flex-1 space-y-1.5">
          {service.capabilities.map((cap) => (
            <div key={cap} className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
              {cap}
            </div>
          ))}
        </div>

        {/* Demo CTA */}
        <DemoViewer
          type={service.demoType}
          title={service.title}
          description={service.value}
          steps={service.demoSteps}
          triggerLabel="See How It Works"
          triggerVariant="outline"
          ctaText="Get Started"
          ctaUrl="#contact"
        >
          {service.visual}
        </DemoViewer>
      </div>
    </Card>
  );
}

/* ---- Card Visuals (micro product previews) ---- */

function WebsiteCardVisual() {
  return (
    <BrowserMockup url="bdtech360.com">
      <div className="space-y-2">
        <div className="h-3 w-1/2 rounded bg-primary/20" />
        <div className="h-2 w-3/4 rounded bg-muted" />
        <div className="h-2 w-2/3 rounded bg-muted" />
        <div className="mt-3 flex gap-2">
          <div className="h-8 flex-1 rounded bg-primary/10" />
          <div className="h-8 flex-1 rounded bg-muted" />
          <div className="h-8 flex-1 rounded bg-muted" />
        </div>
        {/* Device transition indicator */}
        <div className="mt-2 flex items-center gap-1 text-[8px] text-muted-foreground">
          <Monitor className="h-2.5 w-2.5" /> → <Smartphone className="h-2.5 w-2.5" /> Responsive
        </div>
      </div>
    </BrowserMockup>
  );
}

function EcommerceCardVisual() {
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    const i = setInterval(() => setStep(p => (p + 1) % 4), 1500);
    return () => clearInterval(i);
  }, []);
  return (
    <DashboardMockup title="eCommerce">
      <div className="space-y-1.5">
        <div className="grid grid-cols-3 gap-1.5">
          <div className="rounded bg-blue-500/10 p-1.5 text-center">
            <Package className="mx-auto h-3 w-3 text-blue-500" />
            <div className="text-[8px] font-bold">142</div>
            <div className="text-[7px] text-muted-foreground">Products</div>
          </div>
          <div className="rounded bg-teal-500/10 p-1.5 text-center">
            <CreditCard className="mx-auto h-3 w-3 text-teal-500" />
            <div className="text-[8px] font-bold">38</div>
            <div className="text-[7px] text-muted-foreground">Orders</div>
          </div>
          <div className="rounded bg-green-500/10 p-1.5 text-center">
            <Bell className="mx-auto h-3 w-3 text-green-500" />
            <div className="text-[8px] font-bold">7</div>
            <div className="text-[7px] text-muted-foreground">Alerts</div>
          </div>
        </div>
        {/* Animated flow */}
        <div className="flex items-center gap-1 pt-1">
          {["Add", "Cart", "Pay", "Done"].map((s, i) => (
            <React.Fragment key={s}>
              <div className={`rounded px-1.5 py-0.5 text-[7px] font-medium transition-colors ${i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{s}</div>
              {i < 3 && <ArrowRight className="h-2 w-2 text-muted-foreground" />}
            </React.Fragment>
          ))}
        </div>
      </div>
    </DashboardMockup>
  );
}

function CRMCardVisual() {
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    const i = setInterval(() => setStep(p => (p + 1) % 6), 1200);
    return () => clearInterval(i);
  }, []);
  const sources = ["Website", "Social", "WhatsApp", "Referral", "Campaign"];
  const stages = ["New Lead", "Scoring", "Assigned", "Follow-up", "Converted"];
  return (
    <DashboardMockup title="CRM Dashboard">
      <div className="space-y-1.5">
        {/* Lead sources */}
        <div className="flex flex-wrap gap-1">
          {sources.map((s, i) => (
            <span key={s} className={`rounded px-1.5 py-0.5 text-[7px] ${step >= 1 ? "bg-blue-500/10 text-blue-600" : "bg-muted text-muted-foreground"}`}>{s}</span>
          ))}
        </div>
        {/* Pipeline */}
        <div className="space-y-0.5">
          {stages.map((s, i) => (
            <div key={s} className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[8px] transition-colors ${step === i + 1 ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"}`}>
              <div className={`size-1.5 rounded-full ${step >= i + 1 ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
              {s}
            </div>
          ))}
        </div>
      </div>
    </DashboardMockup>
  );
}

function WhatsAppCardVisual() {
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    const i = setInterval(() => setStep(p => (p + 1) % 4), 1500);
    return () => clearInterval(i);
  }, []);
  const messages = [
    { from: "them", text: "Hi, I need a website for my business" },
    { from: "bot", text: "Welcome! I've created a lead for you. Our team will follow up shortly." },
    { from: "them", text: "What's the pricing?" },
    { from: "bot", text: "I've sent you our pricing guide 📄" },
  ];
  return (
    <div className="flex h-full items-center justify-center gap-3 bg-slate-50 p-3">
      <PhoneMockup>
        <div className="space-y-1.5 p-2">
          <div className="border-b bg-emerald-500 px-2 py-1 text-[8px] font-bold text-white">WhatsApp</div>
          {messages.slice(0, step + 1).map((m, i) => (
            <div key={i} className={`max-w-[80%] rounded-lg px-2 py-1 text-[7px] ${m.from === "them" ? "bg-white text-slate-700" : "bg-emerald-100 text-slate-700 ml-auto"}`}>
              {m.text}
            </div>
          ))}
        </div>
      </PhoneMockup>
      <div className="space-y-1">
        {["Receive", "CRM", "Auto-reply", "Notify"].map((s, i) => (
          <div key={s} className={`rounded px-1.5 py-0.5 text-[7px] ${i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{s}</div>
        ))}
      </div>
    </div>
  );
}

function AICardVisual() {
  const [step, setStep] = React.useState(0);
  React.useEffect(() => {
    const i = setInterval(() => setStep(p => (p + 1) % 5), 1200);
    return () => clearInterval(i);
  }, []);
  return (
    <DashboardMockup title="Business Intelligence">
      <div className="space-y-1">
        {["Request", "Analyze", "Business Type", "Recommend", "Review"].map((s, i) => (
          <div key={s} className={`flex items-center gap-1.5 rounded px-1.5 py-1 text-[8px] transition-colors ${step === i ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"}`}>
            <div className={`size-1.5 rounded-full ${step === i ? "bg-primary animate-pulse" : step > i ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
            {s}
          </div>
        ))}
      </div>
    </DashboardMockup>
  );
}

function WorkflowCardVisual() {
  return (
    <div className="flex h-full items-center justify-center bg-slate-50 p-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Lead", icon: Users, color: "bg-blue-500" },
          { label: "CRM", icon: Database, color: "bg-navy-500" },
          { label: "AI", icon: Brain, color: "bg-teal-500" },
          { label: "WhatsApp", icon: MessageSquare, color: "bg-green-500" },
          { label: "Email", icon: FileText, color: "bg-blue-400" },
          { label: "Analytics", icon: BarChart3, color: "bg-purple-500" },
        ].map((n, i) => (
          <div key={n.label} className="flex flex-col items-center gap-1">
            <div className={`grid size-8 place-items-center rounded-lg ${n.color} text-white`}>
              <n.icon className="h-3.5 w-3.5" />
            </div>
            <span className="text-[7px] font-medium">{n.label}</span>
            {(i + 1) % 3 !== 0 && i < 5 && <ArrowRight className="absolute" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardCardVisual() {
  return (
    <DashboardMockup title="Analytics Dashboard">
      <div className="space-y-2">
        <div className="grid grid-cols-4 gap-1">
          {["$12K", "247", "38%", "92"].map((v, i) => (
            <div key={i} className="rounded bg-muted/50 p-1 text-center">
              <div className="text-[8px] font-bold">{v}</div>
            </div>
          ))}
        </div>
        {/* Mini chart */}
        <div className="flex h-12 items-end gap-0.5">
          {[40, 65, 50, 80, 60, 90, 75, 95].map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-primary/40 to-primary" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    </DashboardMockup>
  );
}

function CloudCardVisual() {
  return (
    <div className="flex h-full items-center justify-center bg-slate-50 p-3">
      <div className="space-y-1">
        {[
          { label: "Website", icon: Globe, color: "bg-blue-500" },
          { label: "API", icon: Server, color: "bg-navy-500" },
          { label: "Database", icon: Database, color: "bg-teal-500" },
          { label: "Storage", icon: Cloud, color: "bg-green-500" },
          { label: "Monitoring", icon: Shield, color: "bg-purple-500" },
        ].map((n, i) => (
          <React.Fragment key={n.label}>
            <div className="flex items-center gap-2">
              <div className={`grid size-6 place-items-center rounded ${n.color} text-white`}>
                <n.icon className="h-3 w-3" />
              </div>
              <span className="text-[8px] font-medium">{n.label}</span>
            </div>
            {i < 4 && <div className="ml-3 h-2 w-px bg-border" />}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function BeforeAfterVisual() {
  return (
    <div className="grid h-full grid-cols-2 gap-2 p-2">
      <div className="rounded border border-red-500/20 bg-red-500/5 p-2">
        <div className="mb-1 text-[8px] font-bold uppercase text-red-500">Before</div>
        <div className="space-y-0.5 text-[7px] text-muted-foreground">
          <div>Manual entry</div><div>Spreadsheets</div><div>Missed leads</div>
        </div>
      </div>
      <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-2">
        <div className="mb-1 text-[8px] font-bold uppercase text-emerald-500">After</div>
        <div className="space-y-0.5 text-[7px]">
          <div>Auto capture</div><div>CRM + AI</div><div>Dashboard</div>
        </div>
      </div>
    </div>
  );
}
