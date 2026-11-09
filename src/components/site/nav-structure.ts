/**
 * Reconstructed Enterprise Public Navigation & Footer IA for TECH360.
 *
 * Primary Navigation (strictly 5 top-level groups):
 *   1. Solutions  (4 pillars covering all 21 services + Company-in-a-Box Platform)
 *   2. Industries (5 sector groups covering all 20 industries + quick search)
 *   3. Work       (Portfolio, Projects / System Scenarios, Case Studies / Blueprints)
 *   4. Resources  (Blog, FAQ, Technologies, Delivery Process)
 *   5. Company    (About, Careers, Contact, Legal & Policies)
 *
 * Primary CTA:   Start a Project (#/contact)
 * Secondary CTA: Client Portal   (#/portal)
 *
 * Internal surfaces (/pipeline, /design-kit, /admin, /super-admin) are
 * intentionally excluded from all public navigation and footer chrome.
 */

export interface NavItemLink {
  label: string;
  href: string;
  description?: string;
  badge?: string;
}

export interface NavColumnGroup {
  id: string;
  heading: string;
  description?: string;
  items: NavItemLink[];
}

export type PrimaryNavKey = "solutions" | "industries" | "work" | "resources" | "company";

export interface PrimaryNavGroup {
  key: PrimaryNavKey;
  label: string;
  defaultHref: string;
  kind: "mega-solutions" | "mega-industries" | "dropdown";
  summary: string;
  columns: NavColumnGroup[];
  footerLink?: { label: string; href: string };
  secondaryFooterLink?: { label: string; href: string };
}

export const SOLUTIONS_MEGA_COLUMNS: NavColumnGroup[] = [
  {
    id: "ai-solutions",
    heading: "AI Solutions",
    description: "Scoped, human-governed AI workflows & conversational revenue systems.",
    items: [
      {
        label: "AI Agent Systems",
        href: "#/services/ai-agent-systems",
        description: "Scoped customer & operational assistants with approval guardrails",
      },
      {
        label: "AI Business Automation",
        href: "#/services/ai-business-automation",
        description: "Document triage, routing, classification & human-verified actions",
      },
      {
        label: "WhatsApp-First AI Sales CRM",
        href: "#/services/whatsapp-ai-sales-crm",
        description: "Shared conversational inbox, qualification & sales pipeline",
      },
    ],
  },
  {
    id: "software-products",
    heading: "Software Products",
    description: "Dedicated web platforms, portals & operational systems you own.",
    items: [
      {
        label: "eCommerce Platforms",
        href: "#/services/ecommerce-platforms",
        description: "High-conversion storefronts, checkout, inventory & order tracking",
      },
      {
        label: "Client Portals",
        href: "#/services/client-portals",
        description: "Authenticated customer workspaces for approvals, files & billing",
      },
      {
        label: "Business Dashboards",
        href: "#/services/business-dashboards",
        description: "Role-scoped executive KPIs, finance & live operations reporting",
      },
      {
        label: "Custom Software Development",
        href: "#/services/custom-software-development",
        description: "Bespoke multi-role web applications tailored to your domain",
      },
      {
        label: "Database Systems",
        href: "#/services/database-systems",
        description: "Relational data modeling, migrations, auditability & backups",
      },
    ],
  },
  {
    id: "crm-automation",
    heading: "CRM & Business Automation",
    description: "Unified Client ID records and event-driven communication flows.",
    items: [
      {
        label: "Custom CRM Development",
        href: "#/services/custom-crm-development",
        description: "Pipeline, approvals, invoices & history under one Client ID",
      },
      {
        label: "WhatsApp Automation",
        href: "#/services/whatsapp-automation",
        description: "Automated order, booking & milestone updates with opt-in control",
      },
      {
        label: "WhatsApp Cloud API Integration",
        href: "#/services/whatsapp-cloud-api-integration",
        description: "Official Meta Cloud API webhooks, templates & shared inbox sync",
      },
      {
        label: "Email Automation",
        href: "#/services/email-automation",
        description: "Transactional receipts, onboarding sequences & deliverability setup",
      },
      {
        label: "SMS Automation",
        href: "#/services/sms-automation",
        description: "OTP verification, appointment reminders & time-critical alerts",
      },
      {
        label: "n8n Workflow Automation",
        href: "#/services/n8n-workflow-automation",
        description: "Self-hosted multi-system orchestration with retry & error logs",
      },
    ],
  },
  {
    id: "engineering-services",
    heading: "Services",
    description: "Web engineering, integrations, cloud deployment & ongoing care.",
    items: [
      {
        label: "Premium Business Websites",
        href: "#/services/premium-business-websites",
        description: "Fast, conversion-architected corporate sites with clean SEO",
      },
      {
        label: "Enterprise Websites",
        href: "#/services/enterprise-websites",
        description: "Multi-team governance, staging workflows & multi-region scale",
      },
      {
        label: "API Integrations",
        href: "#/services/api-integrations",
        description: "Payment gateways, ERPs, couriers & third-party webhook bridges",
      },
      {
        label: "Cloud Deployment (Google Cloud)",
        href: "#/services/cloud-deployment-google-cloud",
        description: "Cloud Run, managed SQL, Secret Manager, TLS & observability",
      },
      {
        label: "cPanel / StackCP Deployment",
        href: "#/services/cpanel-stackcp-deployment",
        description: "Pragmatic shared/VPS hosting setup, SSL, cron & domain cutover",
      },
      {
        label: "Maintenance & Support",
        href: "#/services/maintenance-support",
        description: "Scoped SLA patching, monitoring, backups & post-launch updates",
      },
      {
        label: "Digital Transformation Consulting",
        href: "#/services/digital-transformation-consulting",
        description: "Process audit, architecture roadmap & phased SOW planning",
      },
    ],
  },
];

export const INDUSTRIES_MEGA_COLUMNS: NavColumnGroup[] = [
  {
    id: "commerce-hospitality",
    heading: "Commerce & Hospitality",
    items: [
      { label: "eCommerce", href: "#/industries/ecommerce", description: "Storefronts, fulfillment & retention" },
      { label: "Retail", href: "#/industries/retail", description: "POS sync, multi-store stock & loyalty" },
      { label: "Restaurants & Food", href: "#/industries/restaurants-food", description: "Direct ordering, kitchen & dispatch" },
      { label: "Travel & Hospitality", href: "#/industries/travel-hospitality", description: "Direct bookings, guest ops & Folios" },
    ],
  },
  {
    id: "healthcare-education",
    heading: "Healthcare & Education",
    items: [
      { label: "Healthcare", href: "#/industries/healthcare", description: "Patient intake, scheduling & portals" },
      { label: "Hospitals & Clinics", href: "#/industries/hospitals-clinics", description: "Multi-department OPD, EMR & billing" },
      { label: "Education", href: "#/industries/education", description: "Admissions CRM, LMS & student lifecycle" },
      { label: "Schools & Training", href: "#/industries/schools-training", description: "Batch scheduling, fees & guardian apps" },
    ],
  },
  {
    id: "industrial-built-logistics",
    heading: "Industrial, Built & Logistics",
    items: [
      { label: "Manufacturing", href: "#/industries/manufacturing", description: "MRP, shop-floor MES, QA & dealer portals" },
      { label: "Construction", href: "#/industries/construction", description: "BOQ, subcontractor, RFI & site progress" },
      { label: "Real Estate", href: "#/industries/real-estate", description: "Lead-to-site-visit CRM & payment schedules" },
      { label: "Logistics", href: "#/industries/logistics", description: "Dispatch, fleet tracking, POD & COD settlement" },
    ],
  },
  {
    id: "finance-legal-professional",
    heading: "Finance, Legal & Enterprise",
    items: [
      { label: "Finance", href: "#/industries/finance", description: "KYC onboarding, audit trails & reporting" },
      { label: "Legal Services", href: "#/industries/legal-services", description: "Conflict checks, matter portals & billing" },
      { label: "Professional Services", href: "#/industries/professional-services", description: "Proposals, milestones & retainer ops" },
      { label: "International SMEs", href: "#/industries/international-smes", description: "Multi-currency & cross-border operations" },
    ],
  },
  {
    id: "technology-agencies-local",
    heading: "Tech, Agencies & Growth",
    items: [
      { label: "Technology Companies", href: "#/industries/technology-companies", description: "SaaS control planes, billing & docs" },
      { label: "Agencies", href: "#/industries/agencies", description: "Client workspaces, approvals & retainers" },
      { label: "Marketing Agencies", href: "#/industries/marketing-agencies", description: "Lead attribution, reporting & campaign ops" },
      { label: "Local Businesses", href: "#/industries/local-businesses", description: "Bookings, reviews, invoicing & repeat sales" },
    ],
  },
];

export const PRIMARY_NAV_GROUPS: PrimaryNavGroup[] = [
  {
    key: "solutions",
    label: "Solutions",
    defaultHref: "#/services",
    kind: "mega-solutions",
    summary: "21 custom software, CRM, AI, web, and cloud capabilities — scoped in writing and built for full client ownership.",
    columns: SOLUTIONS_MEGA_COLUMNS,
    footerLink: { label: "View all 21 solutions", href: "#/services" },
    secondaryFooterLink: { label: "Company-in-a-Box Platform", href: "#/platform" },
  },
  {
    key: "industries",
    label: "Industries",
    defaultHref: "#/industries",
    kind: "mega-industries",
    summary: "20 sector-specific operating blueprints with domain workflows, role permissions, integrations, and compliance guardrails.",
    columns: INDUSTRIES_MEGA_COLUMNS,
    footerLink: { label: "Explore all 20 industries", href: "#/industries" },
  },
  {
    key: "work",
    label: "Work",
    defaultHref: "#/work",
    kind: "dropdown",
    summary: "Representative software architectures, system scenarios, and delivery blueprints.",
    columns: [
      {
        id: "work-links",
        heading: "Selected Work & Scenarios",
        items: [
          {
            label: "Portfolio",
            href: "#/work",
            description: "Capabilities showcase across web, CRM, portals & automation",
          },
          {
            label: "Projects",
            href: "#/work/projects",
            description: "12 illustrative system scenarios & architecture breakdowns",
          },
          {
            label: "Case Studies",
            href: "#/work/case-studies",
            description: "Problem-to-architecture delivery blueprints by sector",
          },
        ],
      },
    ],
    footerLink: { label: "Browse all work & scenarios", href: "#/work" },
  },
  {
    key: "resources",
    label: "Resources",
    defaultHref: "#/blog",
    kind: "dropdown",
    summary: "Engineering notes, technology choices, delivery governance, and answers before you commit.",
    columns: [
      {
        id: "resources-links",
        heading: "Knowledge & Documentation",
        items: [
          {
            label: "Blog",
            href: "#/blog",
            description: "Architecture, CRM design, cloud deployment & automation articles",
          },
          {
            label: "FAQ",
            href: "#/faq",
            description: "Clear answers on HTML previews, SOW scope, payments & handover",
          },
          {
            label: "Technologies",
            href: "#/technologies",
            description: "Next.js, TypeScript, PostgreSQL, Google Cloud & n8n stack",
          },
          {
            label: "Delivery Process",
            href: "#/process",
            description: "Our 7-step customer journey from enquiry to source handover",
          },
        ],
      },
    ],
  },
  {
    key: "company",
    label: "Company",
    defaultHref: "#/about",
    kind: "dropdown",
    summary: "Who we are, how TECH360 LLC operates globally, open roles, and binding project policies.",
    columns: [
      {
        id: "company-links",
        heading: "TECH360 LLC",
        items: [
          {
            label: "About",
            href: "#/about",
            description: "Company background, engineering principles & global delivery",
          },
          {
            label: "Careers",
            href: "#/careers",
            description: "Open engineering, product & operations positions",
          },
          {
            label: "Contact",
            href: "#/contact",
            description: "Start a written project scope or speak with our team",
          },
          {
            label: "Legal & Policies",
            href: "#/legal",
            description: "Terms, Privacy, Refund, Delivery, Payment & Handover policies",
          },
        ],
      },
    ],
  },
];

export const HEADER_UTILITY_LINKS = {
  clientPortal: { label: "Client Portal", href: "#/portal" },
  primaryCta: { label: "Start a Project", href: "#/contact" },
} as const;

/**
 * Helper used to map a service slug to one of the 4 Solutions pillars.
 */
export function getSolutionGroupForService(slug: string): string {
  for (const col of SOLUTIONS_MEGA_COLUMNS) {
    if (col.items.some((i) => i.href === `#/services/${slug}`)) {
      return col.heading;
    }
  }
  return "Services";
}

/**
 * Helper used to map an industry slug to one of the 5 Industry sector groups.
 */
export function getSectorGroupForIndustry(slug: string): string {
  for (const col of INDUSTRIES_MEGA_COLUMNS) {
    if (col.items.some((i) => i.href === `#/industries/${slug}`)) {
      return col.heading;
    }
  }
  return "Enterprise Sectors";
}
