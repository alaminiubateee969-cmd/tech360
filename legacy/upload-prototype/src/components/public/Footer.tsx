"use client";

import { Mail, MessageCircle, Globe, Code2 } from "lucide-react";

const LEGAL_LINKS = [
  { label: "Terms & Conditions", slug: "terms-of-service" },
  { label: "Refund Policy", slug: "refund-cancellation" },
  { label: "Privacy Policy", slug: "privacy-policy" },
  { label: "Cookie Policy", slug: "cookie-policy" },
  { label: "Payment Terms", slug: "payment-terms" },
  { label: "Service Agreement", slug: "service-agreement" },
  { label: "IP Policy", slug: "intellectual-property" },
  { label: "Acceptable Use", slug: "acceptable-use" },
  { label: "Delivery Policy", slug: "delivery-project" },
  { label: "Maintenance & Support", slug: "maintenance-support" },
  { label: "Disclaimer", slug: "disclaimer" },
  { label: "SLA", slug: "sla" },
  { label: "Data Protection", slug: "data-protection" },
  { label: "Complaints", slug: "complaint-dispute" },
];

const SERVICE_LINKS = [
  { label: "Software Development", href: "#services" },
  { label: "CRM Systems", href: "#services" },
  { label: "Business Automation", href: "#services" },
  { label: "eCommerce", href: "#services" },
  { label: "Cloud Solutions", href: "#services" },
  { label: "Business Intelligence", href: "#services" },
];

const COMPANY_LINKS = [
  { label: "About", href: "#" },
  { label: "Services", href: "#services" },
  { label: "Industries", href: "#industries" },
  { label: "Portfolio", href: "#" },
  { label: "Contact", href: "#contact" },
];

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-card/40">
      <div className="mx-auto max-w-[1400px] px-4 py-12 md:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="grid size-9 place-items-center rounded-lg gradient-brand text-white">
                <span className="text-base font-black">T</span>
              </div>
              <div>
                <div className="font-semibold">TECH360</div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  Enterprise Technology
                </div>
              </div>
            </div>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              Custom software development, business automation, and digital transformation for growing businesses.
            </p>
            <div className="mt-3 text-xs text-muted-foreground">
              <div>TECH360 LLC</div>
              <div>117 S Lexington St, Ste 100</div>
              <div>Harrisonville, MO 64701, USA</div>
            </div>
            <div className="mt-5 flex items-center gap-2">
              {[
                { icon: MessageCircle, href: "https://wa.me/8801327100297", label: "WhatsApp" },
                { icon: Mail, href: "mailto:info@bdtech360.com", label: "Email" },
                { icon: Globe, href: "https://bdtech360.com", label: "Website" },
                { icon: Code2, href: "#services", label: "Services" },
              ].map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target={s.href.startsWith("http") ? "_blank" : undefined}
                  rel={s.href.startsWith("http") ? "noreferrer" : undefined}
                  aria-label={s.label}
                  className="grid size-9 place-items-center rounded-lg border border-border/60 text-muted-foreground transition-all hover:border-primary/40 hover:text-primary"
                >
                  <s.icon className="size-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-sm font-semibold">Company</h4>
            <ul className="mt-4 space-y-2.5">
              {COMPANY_LINKS.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-sm font-semibold">Services</h4>
            <ul className="mt-4 space-y-2.5">
              {SERVICE_LINKS.map((l) => (
                <li key={l.label}>
                  <a href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold">Legal</h4>
            <ul className="mt-4 grid grid-cols-1 gap-2.5">
              {LEGAL_LINKS.map((l) => (
                <li key={l.slug}>
                  <a
                    href={`#/legal/${l.slug}`}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} TECH360 LLC. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            bdtech360.com · +880 1327-100-297 · info@bdtech360.com
          </p>
        </div>
      </div>
    </footer>
  );
}
