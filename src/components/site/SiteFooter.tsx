"use client";

import { useState } from "react";
import { Bot, Loader2, Mail, MapPin } from "lucide-react";
import { COMPANY, SERVICES, INDUSTRIES, LEGAL_DOCS } from "@/data/site";

/**
 * Public site footer: identity, sitemap columns, contact details and
 * registration line. No social icons — we publish none we cannot verify.
 */
export default function SiteFooter() {
  const year = 2026;

  // Newsletter signup — writes the real subscriber via POST /api/newsletter.
  const [email, setEmail] = useState("");
  const [subBusy, setSubBusy] = useState(false);
  const [subResult, setSubResult] = useState<
    { ok: true; message: string } | { ok: false; message: string } | null
  >(null);

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (subBusy || !email.trim()) return;
    setSubBusy(true);
    setSubResult(null);
    try {
      const res = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
      };
      if (res.ok && data.ok) {
        setSubResult({ ok: true, message: "Subscribed ✓" });
        setEmail("");
      } else {
        setSubResult({ ok: false, message: data.error ?? "Subscription failed — please try again." });
      }
    } catch {
      setSubResult({ ok: false, message: "Network error — please try again." });
    } finally {
      setSubBusy(false);
    }
  }

  const companyLinks = [
    { label: "About", href: "#/about" },
    { label: "Work", href: "#/work" },
    { label: "Process", href: "#/process" },
    { label: "Client Portal", href: "#/portal" },
    { label: "Careers", href: "#/careers" },
    { label: "Blog", href: "#/blog" },
    { label: "FAQ", href: "#/faq" },
  ];

  const serviceLinks = SERVICES.slice(0, 6).map((s) => ({
    label: s.title,
    href: `#/services/${s.slug}`,
  }));

  const industryLinks = INDUSTRIES.slice(0, 6).map((i) => ({
    label: i.title,
    href: `#/industries/${i.slug}`,
  }));

  const legalLinks = LEGAL_DOCS.map((d) => ({
    label: d.title,
    href: `#/legal/${d.slug}`,
  }));

  return (
    <footer className="mt-auto bg-[#0B1F33] text-white/75">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-12">
          {/* Identity */}
          <div className="lg:col-span-4">
            <a
              href="#/"
              aria-label="Tech360 home"
              className="inline-flex items-center rounded-lg bg-white/95 px-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3]"
            >
              <img
                src="/brand/tech360-logo-original.jpg"
                alt="Tech360 logo"
                className="h-10 w-auto rounded-md object-contain"
                width={40}
                height={40}
              />
            </a>
            <p className="mt-5 max-w-sm text-sm leading-relaxed">
              Enterprise-grade websites, platforms and automation for ambitious
              businesses — engineered by a US-registered team delivering
              worldwide. Preview before payment. Source code on completion.
            </p>
            <div className="mt-6 flex flex-col gap-3 text-sm">
              <a
                href={`mailto:${COMPANY.email}`}
                className="inline-flex min-h-11 items-center gap-2.5 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-[#009FE3] rounded-sm"
              >
                <Mail className="size-4 shrink-0 text-[#009FE3]" aria-hidden="true" />
                {COMPANY.email}
              </a>
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("tech360:open-chat"))}
                aria-label="Chat with the Tech360 AI assistant"
                className="inline-flex min-h-11 items-center gap-2.5 text-left outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-[#009FE3] rounded-sm"
              >
                <Bot className="size-4 shrink-0 text-[#18B83A]" aria-hidden="true" />
                AI assistant — 24/7 chat
              </button>
              <address className="inline-flex items-start gap-2.5 not-italic">
                <MapPin className="mt-0.5 size-4 shrink-0 text-[#009FE3]" aria-hidden="true" />
                <span>{COMPANY.address}</span>
              </address>
            </div>

            {/* Newsletter signup */}
            <div className="mt-7 rounded-lg border border-white/10 bg-white/5 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                TECH360 insights
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-white/70">
                Occasional engineering notes — no spam, unsubscribe anytime.
              </p>
              <form onSubmit={subscribe} className="mt-3 flex flex-col gap-2 sm:flex-row">
                <label htmlFor="footer-newsletter-email" className="sr-only">
                  Email address for the TECH360 newsletter
                </label>
                <input
                  id="footer-newsletter-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  aria-label="Email address for the TECH360 newsletter"
                  className="min-h-11 w-full rounded-lg border border-white/15 bg-[#0B1F33] px-3.5 text-sm text-white placeholder:text-white/40 outline-none transition-colors focus-visible:border-[#009FE3] focus-visible:ring-2 focus-visible:ring-[#009FE3]/50"
                />
                <button
                  type="submit"
                  disabled={subBusy || !email.trim()}
                  aria-label="Subscribe to the TECH360 newsletter"
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#009FE3] px-5 text-sm font-semibold text-white transition hover:bg-[#063B8F] focus-visible:ring-2 focus-visible:ring-[#009FE3] disabled:opacity-60"
                >
                  {subBusy ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : null}
                  Subscribe
                </button>
              </form>
              {subResult ? (
                <p
                  role="status"
                  className={`mt-2.5 text-xs leading-relaxed ${subResult.ok ? "text-[#18B83A]" : "text-amber-300"}`}
                >
                  {subResult.message}
                </p>
              ) : null}
            </div>
          </div>

          {/* Sitemap columns */}
          <nav aria-label="Company links" className="lg:col-span-2">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
              Company
            </h2>
            <ul className="flex flex-col gap-1">
              {companyLinks.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="inline-flex min-h-9 items-center rounded-sm text-sm outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Services links" className="lg:col-span-2">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
              Services
            </h2>
            <ul className="flex flex-col gap-1">
              {serviceLinks.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="inline-flex min-h-9 items-center rounded-sm text-sm outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="#/services"
                  className="inline-flex min-h-9 items-center rounded-sm text-sm font-medium text-[#009FE3] outline-none transition-colors hover:text-[#7FD4FF] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                >
                  All 20 services
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-label="Industries links" className="lg:col-span-2">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
              Industries
            </h2>
            <ul className="flex flex-col gap-1">
              {industryLinks.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="inline-flex min-h-9 items-center rounded-sm text-sm outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
              <li>
                <a
                  href="#/industries"
                  className="inline-flex min-h-9 items-center rounded-sm text-sm font-medium text-[#009FE3] outline-none transition-colors hover:text-[#7FD4FF] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                >
                  All 20 industries
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-label="Legal links" className="lg:col-span-2">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
              Legal & Policies
            </h2>
            <ul className="flex flex-col gap-1">
              {legalLinks.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    className="inline-flex min-h-9 items-center rounded-sm text-sm outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6">
          <div className="flex flex-col gap-3 text-xs text-white/55 sm:flex-row sm:items-center sm:justify-between">
            <p>
              © {year} {COMPANY.legalName}. All rights reserved.
            </p>
            <p>Registered Missouri LLC {COMPANY.missouriLLC} · EIN {COMPANY.ein}</p>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-white/65">
            {COMPANY.legalName} ({COMPANY.brand}, {COMPANY.domain}) ·{" "}
            {COMPANY.address} · {COMPANY.email}
          </p>
        </div>
      </div>
    </footer>
  );
}
