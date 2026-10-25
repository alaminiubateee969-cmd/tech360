"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DemoViewer, DashboardMockup } from "./DemoViewer";
import { ShoppingCart, GraduationCap, Heart, Building2, Utensils, Briefcase, School, Users, ArrowRight } from "lucide-react";

interface Industry {
  id: string;
  name: string;
  icon: React.ElementType;
  modules: string[];
  visual: React.ReactNode;
}

const INDUSTRIES: Industry[] = [
  {
    id: "ecommerce",
    name: "eCommerce",
    icon: ShoppingCart,
    modules: ["Products", "Orders", "Customers", "Inventory", "Payments"],
    visual: <IndustryDashboard title="eCommerce" stats={[{ label: "Products", value: "142" }, { label: "Orders", value: "38" }, { label: "Revenue", value: "$12K" }]} />,
  },
  {
    id: "education",
    name: "Education",
    icon: GraduationCap,
    modules: ["Students", "Applications", "Counselors", "Documents", "Follow-ups"],
    visual: <IndustryDashboard title="Education" stats={[{ label: "Students", value: "523" }, { label: "Apps", value: "89" }, { label: "Active", value: "47" }]} />,
  },
  {
    id: "healthcare",
    name: "Healthcare",
    icon: Heart,
    modules: ["Appointments", "Patients", "Doctors", "Notifications", "Records"],
    visual: <IndustryDashboard title="Clinic" stats={[{ label: "Patients", value: "1.2K" }, { label: "Appts", value: "64" }, { label: "Doctors", value: "12" }]} />,
  },
  {
    id: "realestate",
    name: "Real Estate",
    icon: Building2,
    modules: ["Properties", "Listings", "Inquiries", "Agents", "Contracts"],
    visual: <IndustryDashboard title="Properties" stats={[{ label: "Listings", value: "87" }, { label: "Inquiries", value: "23" }, { label: "Agents", value: "8" }]} />,
  },
  {
    id: "restaurant",
    name: "Restaurant",
    icon: Utensils,
    modules: ["Orders", "Menu", "Tables", "Delivery", "Feedback"],
    visual: <IndustryDashboard title="Restaurant" stats={[{ label: "Orders", value: "156" }, { label: "Tables", value: "24" }, { label: "Rating", value: "4.8" }]} />,
  },
  {
    id: "agency",
    name: "Agency",
    icon: Briefcase,
    modules: ["Clients", "Projects", "Tasks", "Invoices", "Reports"],
    visual: <IndustryDashboard title="Agency" stats={[{ label: "Clients", value: "34" }, { label: "Projects", value: "18" }, { label: "Tasks", value: "92" }]} />,
  },
  {
    id: "school",
    name: "School / Training",
    icon: School,
    modules: ["Students", "Courses", "Attendance", "Grades", "Parents"],
    visual: <IndustryDashboard title="School" stats={[{ label: "Students", value: "890" }, { label: "Courses", value: "24" }, { label: "Teachers", value: "32" }]} />,
  },
  {
    id: "professional",
    name: "Professional Services",
    icon: Users,
    modules: ["Clients", "Appointments", "Billing", "Documents", "Reports"],
    visual: <IndustryDashboard title="Services" stats={[{ label: "Clients", value: "67" }, { label: "Appts", value: "41" }, { label: "Revenue", value: "$8K" }]} />,
  },
];

export function IndustriesSection() {
  return (
    <section id="industries" className="bg-muted/20 py-16 md:py-24">
      <div className="mx-auto max-w-[1400px] px-4 md:px-6">
        <div className="mb-10 text-center">
          <Badge variant="outline" className="mb-3">Industry Solutions</Badge>
          <h2 className="text-3xl font-bold md:text-4xl">Built for Your Industry</h2>
          <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
            Each industry gets a customized system with the modules that matter most.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {INDUSTRIES.map((industry) => (
            <IndustryCard key={industry.id} industry={industry} />
          ))}
        </div>
      </div>
    </section>
  );
}

function IndustryCard({ industry }: { industry: Industry }) {
  const Icon = industry.icon;
  return (
    <Card className="flex min-h-[460px] flex-col overflow-hidden p-0 card-brand-shadow transition-shadow">
      {/* Visual area — 220px */}
      <div className="relative h-[220px] overflow-hidden border-b bg-slate-50 p-3">
        {industry.visual}
      </div>

      {/* Content area */}
      <div className="flex flex-1 flex-col p-7">
        <div className="mb-3 flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-lg gradient-brand text-white">
            <Icon className="h-4 w-4" />
          </div>
          <h3 className="text-lg font-semibold">{industry.name}</h3>
        </div>

        {/* Module list */}
        <div className="mb-4 flex-1 flex flex-wrap gap-1.5">
          {industry.modules.map((m) => (
            <span key={m} className="rounded-full bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary">
              {m}
            </span>
          ))}
        </div>

        <DemoViewer
          type="dashboard"
          title={`${industry.name} System`}
          description={`See how a ${industry.name.toLowerCase()} dashboard works`}
          triggerLabel="Product Preview"
          triggerVariant="outline"
          ctaText="Get Started"
          ctaUrl="#contact"
        >
          {industry.visual}
        </DemoViewer>
      </div>
    </Card>
  );
}

function IndustryDashboard({ title, stats }: { title: string; stats: Array<{ label: string; value: string }> }) {
  return (
    <DashboardMockup title={title}>
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-1.5">
          {stats.map((s) => (
            <div key={s.label} className="rounded bg-muted/50 p-1.5 text-center">
              <div className="text-[10px] font-bold text-primary">{s.value}</div>
              <div className="text-[7px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
        {/* Mini bar chart */}
        <div className="flex h-10 items-end gap-0.5">
          {[50, 70, 45, 85, 60, 90, 75].map((h, i) => (
            <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-primary/30 to-primary/80" style={{ height: `${h}%` }} />
          ))}
        </div>
        {/* Module list */}
        <div className="space-y-0.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="size-1.5 rounded-full bg-emerald-500" />
              <div className="h-1.5 flex-1 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </DashboardMockup>
  );
}
