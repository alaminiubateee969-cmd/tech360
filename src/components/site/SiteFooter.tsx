"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2, Mail, MessageCircle, ShieldCheck, UserCheck } from "lucide-react";
import { COMPANY, LEGAL_DOCS } from "@/data/site";
import { BrandMark } from "./BrandMark";
import { ChatButton, PrimaryButton, PrimaryLink } from "./buttons";

const FOOTER_SOLUTIONS = [
  { label: "AI Agent Systems", href: "#/services/ai-agent-systems" },
  { label: "AI Business Automation", href: "#/services/ai-business-automation" },
  { label: "WhatsApp-First AI Sales CRM", href: "#/services/whatsapp-ai-sales-crm" },
  { label: "Custom CRM Development", href: "#/services/custom-crm-development" },
  { label: "Client Portals", href: "#/services/client-portals" },
  { label: "eCommerce Platforms", href: "#/services/ecommerce-platforms" },
  { label: "Enterprise Websites", href: "#/services/enterprise-websites" },
  { label: "n8n Workflow Automation", href: "#/services/n8n-workflow-automation" },
  { label: "Cloud Deployment (Google Cloud)", href: "#/services/cloud-deployment-google-cloud" },
  { label: "Company-in-a-Box Platform", href: "#/platform" },
];

const FOOTER_INDUSTRIES = [
  { label: "Manufacturing", href: "#/industries/manufacturing" },
  { label: "Healthcare", href: "#/industries/healthcare" },
  { label: "Hospitals & Clinics", href: "#/industries/hospitals-clinics" },
  { label: "Education", href: "#/industries/education" },
  { label: "eCommerce", href: "#/industries/ecommerce" },
  { label: "Retail", href: "#/industries/retail" },
  { label: "Real Estate", href: "#/industries/real-estate" },
  { label: "Finance", href: "#/industries/finance" },
  { label: "Logistics", href: "#/industries/logistics" },
  { label: "Technology Companies", href: "#/industries/technology-companies" },
];

const FOOTER_RESOURCES = [
  { label: "Portfolio Overview", href: "#/work" },
  { label: "System Scenarios", href: "#/work/projects" },
  { label: "Case Study Blueprints", href: "#/work/case-studies" },
  { label: "Delivery Process", href: "#/process" },
  { label: "Technologies & Stack", href: "#/technologies" },
  { label: "Blog & Engineering Notes", href: "#/blog" },
  { label: "Frequently Asked Questions", href: "#/faq" },
];

const FOOTER_COMPANY = [
  { label: "About TECH360", href: "#/about" },
  { label: "Careers", href: "#/careers" },
  { label: "Contact", href: "#/contact" },
  { label: "Client Portal", href: "#/portal" },
];

export function SiteFooter() {
  const [email, setEmail] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [err, setErr] = useState("");

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    if (!marketingConsent) {
      setState("error");
      setErr("Please confirm email updates consent before subscribing.");
      return;
    }
    setState("sending");
    setErr("");
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Marketing consent is a SEPARATE purpose from any enquiry consent:
        // the API stores it as its own auditable record with a version stamp.
        body: JSON.stringify({ email: email.trim(), source: "FOOTER", consent: true }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not subscribe right now");
      }
      setState("done");
      setEmail("");
      setMarketingConsent(false);
    } catch (er) {
      setState("error");
      setErr(er instanceof Error ? er.message : "Could not subscribe right now");
    }
  }

  return (
    <footer className="border-t border-slate-800 bg-[#0B1F33] text-slate-300">
      {/* Top Conversion Strip */}
      <div className="border-b border-white/10 bg-[#081726]">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:px-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#009FE3]">
              Ready to Scope Your System
            </p>
            <h2 className="mt-1.5 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
              Written Scope of Work. HTML Preview where agreed. Full Source Handover after verified payment.
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <PrimaryLink href="#/contact" size="md">
              Start a Project
            </PrimaryLink>
            <ChatButton size="md" variant="onDark" label="Live Support" />
          </div>
        </div>
      </div>

      {/* Main Footer Grid */}
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-12">
          {/* Column 1: Brand + Contact + Newsletter */}
          <div className="lg:col-span-4">
            <a href="#/" className="inline-flex items-center gap-2.5 text-white">
              <BrandMark className="h-9 w-9" />
              <span className="text-lg font-extrabold tracking-tight">
                TECH<span className="text-[#009FE3]">360</span>
              </span>
            </a>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">
              {COMPANY.legalName} designs and builds custom websites, CRM systems, client portals,
              eCommerce platforms, and business workflow automation for organizations worldwide.
            </p>

            <div className="mt-5 space-y-2 text-sm">
              <a
                href={`mailto:${COMPANY.email}`}
                className="inline-flex items-center gap-2 text-slate-200 transition hover:text-[#009FE3]"
              >
                <Mail className="h-4 w-4 text-[#009FE3]" aria-hidden="true" />
                {COMPANY.email}
              </a>
              <div>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent("tech360:open-chat"))}
                  className="inline-flex items-center gap-2 text-slate-200 transition hover:text-[#009FE3] outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3] rounded-sm"
                >
                  <MessageCircle className="h-4 w-4 text-[#18B83A]" aria-hidden="true" />
                  Live support chat
                </button>
              </div>
              <div>
                <a
                  href="#/portal"
                  className="inline-flex items-center gap-2 text-slate-300 transition hover:text-white"
                >
                  <UserCheck className="h-4 w-4 text-[#18B83A]" aria-hidden="true" />
                  Client Portal Sign In
                </a>
              </div>
            </div>

            <form
              onSubmit={subscribe}
              className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-4"
            >
              <label
                htmlFor="footer-newsletter"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-200"
              >
                Engineering &amp; Product Notes
              </label>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Occasional architecture write-ups and release notes. Unsubscribe anytime.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  id="footer-newsletter"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-[#009FE3] focus:outline-none"
                />
                <PrimaryButton type="submit" size="sm" disabled={state === "sending"}>
                  {state === "sending" ? "Joining…" : "Subscribe"}
                </PrimaryButton>
              </div>
              <label
                htmlFor="footer-newsletter-consent"
                className="mt-2.5 flex items-start gap-2 text-xs leading-5 text-slate-400"
              >
                <input
                  id="footer-newsletter-consent"
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(e) => setMarketingConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-white/25 bg-white/10 text-[#009FE3]"
                />
                <span>
                  I agree to receive TECH360 engineering updates in accordance with the{" "}
                  <a href="#/legal/privacy" className="text-slate-200 underline hover:text-white">
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
              {state === "done" && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Subscribed. Thank you for joining.
                </p>
              )}
              {state === "error" && <p className="mt-2 text-xs text-rose-400">{err}</p>}
            </form>
          </div>

          {/* Column 2: Solutions */}
          <div className="sm:col-span-6 lg:col-span-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-white">Solutions</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {FOOTER_SOLUTIONS.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="text-slate-400 transition hover:text-white">
                    {item.label}
                  </a>
                </li>
              ))}
              <li className="pt-1">
                <a
                  href="#/services"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#009FE3] hover:text-white"
                >
                  All 21 solutions
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Industries */}
          <div className="sm:col-span-6 lg:col-span-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-white">Industries</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {FOOTER_INDUSTRIES.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="text-slate-400 transition hover:text-white">
                    {item.label}
                  </a>
                </li>
              ))}
              <li className="pt-1">
                <a
                  href="#/industries"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#009FE3] hover:text-white"
                >
                  All 20 industries
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Work & Resources */}
          <div className="sm:col-span-6 lg:col-span-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-white">
              Work &amp; Resources
            </h3>
            <ul className="mt-4 space-y-2 text-sm">
              {FOOTER_RESOURCES.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="text-slate-400 transition hover:text-white">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 5: Company & Legal */}
          <div className="sm:col-span-6 lg:col-span-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-white">Company</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {FOOTER_COMPANY.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="text-slate-400 transition hover:text-white">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>

            <h3 className="mt-6 text-xs font-bold uppercase tracking-[0.16em] text-white">
              Legal &amp; Policies
            </h3>
            <ul className="mt-3 space-y-1.5 text-xs">
              {LEGAL_DOCS.map((doc) => (
                <li key={doc.slug}>
                  <a
                    href={`#/legal/${doc.slug}`}
                    className="text-slate-400 transition hover:text-white"
                  >
                    {doc.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Legal & Entity Bar */}
        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-slate-400 lg:flex-row lg:items-center lg:justify-between">
          <p>
            © {new Date().getFullYear()} {COMPANY.legalName} (Missouri LLC {COMPANY.missouriLLC} ·{" "}
            {COMPANY.address}). Serving clients worldwide.
          </p>
          <p className="inline-flex items-center gap-1.5 text-slate-300">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#18B83A]" aria-hidden="true" />
            <span>
              Deliverables, previews, payment milestones, and handover are governed by each
              project&apos;s approved Scope of Work.
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default SiteFooter;
