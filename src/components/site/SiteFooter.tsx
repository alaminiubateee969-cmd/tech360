"use client";

import { Mail, MapPin, Phone } from "lucide-react";
import { COMPANY, SERVICES, INDUSTRIES, LEGAL_DOCS } from "@/data/site";

/**
 * Public site footer: identity, sitemap columns, contact details and
 * registration line. No social icons — we publish none we cannot verify.
 */
export default function SiteFooter() {
  const year = 2026;

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
                src="/images/tech360-logo-web.png"
                srcSet="/images/tech360-logo@2x.png 2x"
                alt="Tech360 logo"
                className="h-7 w-auto object-contain"
                width={132}
                height={32}
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
              <a
                href={COMPANY.whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2.5 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-[#009FE3] rounded-sm"
              >
                <Phone className="size-4 shrink-0 text-[#18B83A]" aria-hidden="true" />
                WhatsApp {COMPANY.whatsappDisplay}
              </a>
              <address className="inline-flex items-start gap-2.5 not-italic">
                <MapPin className="mt-0.5 size-4 shrink-0 text-[#009FE3]" aria-hidden="true" />
                <span>{COMPANY.address}</span>
              </address>
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
