/**
 * TECH360 — Centralized Public Service, Platform & Blueprint Image Manifest
 *
 * Every service card, individual service detail hero, platform capability card,
 * and delivery blueprint scenario maps to its own dedicated, high-resolution
 * (1600×1000, 16:10) WebP visual asset under `public/images/`.
 *
 * Validated automatically by `scripts/verify-service-images.mjs` and
 * `tests/service-images-visual-system.test.ts` to guarantee:
 *   - zero missing files on disk,
 *   - zero duplicate image paths across unrelated services,
 *   - 100% coverage of all 21 services, 6 platform modules, and 8 case studies,
 *   - non-empty contextual alt text and valid destination routes,
 *   - verified 1600×1000 (16:10) pixel dimensions.
 */

export interface ServiceImageEntry {
  /** Canonical service slug matching `SERVICES` in `src/data/site.ts`. */
  slug: string;
  /** Public WebP path under `public/images/services/`. */
  src: string;
  /** Intrinsic pixel width (1600). */
  width: number;
  /** Intrinsic pixel height (1000). */
  height: number;
  /** Standardized grid & hero aspect ratio. */
  aspect: "16/10";
  /** Solution pillar label used on cards and filters. */
  category:
    | "AI Solutions"
    | "Software Products"
    | "CRM & Business Automation"
    | "Web, Cloud & Engineering";
  /** Canonical service detail destination URL. */
  href: string;
  /** Descriptive, screen-reader-friendly alt text for card grids. */
  alt: string;
  /** Extended contextual alt text for the individual service detail hero. */
  heroAlt: string;
  /** Documented visual art-direction summary. */
  concept: string;
}

export interface ShowcaseImageEntry {
  key: string;
  src: string;
  width: number;
  height: number;
  aspect: "16/10" | "16/9";
  alt: string;
  href: string;
  concept: string;
}

export const SERVICE_IMAGES: Record<string, ServiceImageEntry> = {
  /* ---------------- Pillar 1: AI Solutions (3) ---------------- */
  "ai-agent-systems": {
    slug: "ai-agent-systems",
    src: "/images/services/ai-agent-systems.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    category: "AI Solutions",
    href: "/services/ai-agent-systems",
    alt: "AI Agent Systems command center illustration showing coordinated digital assistants, enterprise system connections, and a human approval checkpoint gate",
    heroAlt: "Illustrative enterprise AI operations command center with a central coordinator core, three specialized agent nodes, connected system consoles, and an emerald human-approval gate",
    concept: "Enterprise AI operations command center with coordinated digital agents, decision pathways, and human approval checkpoints",
  },
  "ai-business-automation": {
    slug: "ai-business-automation",
    src: "/images/services/ai-business-automation.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    category: "AI Solutions",
    href: "/services/ai-business-automation",
    alt: "AI Business Automation workflow illustration showing structured document triage, optical classification lanes, task routing, and human-verified checkmarks",
    heroAlt: "Illustrative document processing and business automation pipeline sorting incoming records through a classification prism into human-verified enterprise routing lanes",
    concept: "Document triage, classification prism, multi-lane task routing, and human verification checkpoints",
  },
  "whatsapp-ai-sales-crm": {
    slug: "whatsapp-ai-sales-crm",
    src: "/images/services/whatsapp-ai-sales-crm.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    category: "AI Solutions",
    href: "/services/whatsapp-ai-sales-crm",
    alt: "Conversational messaging sales CRM illustration connecting mobile chat threads to a shared team inbox, multi-stage sales pipeline kanban, and engagement analytics",
    heroAlt: "Illustrative messaging-first sales CRM workspace pairing mobile customer conversations with a shared desktop team inbox, qualification stages, and pipeline analytics",
    concept: "Smartphone conversational threads synced to a shared inbox, lead qualification board, and sales pipeline analytics",
  },

  /* ---------------- Pillar 2: Software Products (5) ---------------- */
  "ecommerce-platforms": {
    slug: "ecommerce-platforms",
    src: "/images/services/ecommerce-platforms.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    category: "Software Products",
    href: "/services/ecommerce-platforms",
    alt: "eCommerce Platforms illustration featuring product showcase cards, streamlined digital payment checkout, inventory cubes, and order fulfillment routing",
    heroAlt: "Illustrative conversion-engineered online storefront connecting product catalogue cards to multi-method checkout verification, stock tracking, and parcel dispatch",
    concept: "Product catalogue cards flowing into verified checkout, inventory management cubes, and fulfillment tracking",
  },
  "client-portals": {
    slug: "client-portals",
    src: "/images/services/client-portals.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    category: "Software Products",
    href: "/services/client-portals",
    alt: "Client Portals illustration showing key-shield authentication, milestone progress tracking, organized document folders, invoices, and client approval badges",
    heroAlt: "Illustrative authenticated client self-service portal displaying a security key-shield, project milestone track, controlled document vault, and approval records",
    concept: "Authenticated customer workspace with security key-shield, milestone timeline, document vault, and approval badges",
  },
  "business-dashboards": {
    slug: "business-dashboards",
    src: "/images/services/business-dashboards.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    category: "Software Products",
    href: "/services/business-dashboards",
    alt: "Business Dashboards illustration displaying unified multi-source data streams, executive area trends, radial KPI gauges, and comparative performance bars",
    heroAlt: "Illustrative executive business intelligence dashboard consolidating data pipelines into live trend curves, KPI target rings, and role-based operational charts",
    concept: "Executive glass analytics display with multi-series area charts, radial KPI rings, and comparative column metrics",
  },
  "custom-software-development": {
    slug: "custom-software-development",
    src: "/images/services/custom-software-development.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    category: "Software Products",
    href: "/services/custom-software-development",
    alt: "Custom Software Development illustration showing interlocking modular application blocks, tailored workflow gears, and multi-role operational screens",
    heroAlt: "Illustrative bespoke software architecture assembling custom domain modules, precision workflow gears, and multi-role enterprise interfaces on an engineering blueprint",
    concept: "Precision modular application blocks and workflow gears assembling on an architectural engineering grid",
  },
  "database-systems": {
    slug: "database-systems",
    src: "/images/services/database-systems.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    category: "Software Products",
    href: "/services/database-systems",
    alt: "Database Systems illustration showing normalized relational data cylinders, foreign-key schema tables, an emerald integrity padlock shield, and an off-site backup vault",
    heroAlt: "Illustrative relational database architecture linking normalized schema tables to redundant storage cylinders protected by referential integrity controls and point-in-time backup",
    concept: "Relational database cylinders, normalized table schemas, referential integrity lock, and point-in-time recovery vault",
  },

  /* ---------------- Pillar 3: CRM & Business Automation (6) ---------------- */
  "custom-crm-development": {
    slug: "custom-crm-development",
    src: "/images/services/custom-crm-development.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    category: "CRM & Business Automation",
    href: "/services/custom-crm-development",
    alt: "Custom CRM Development illustration showing a central Client ID profile linked along a chronological timeline to messages, files, invoices, and pipeline stages",
    heroAlt: "Illustrative custom CRM workspace connecting a single Client ID record across communications, documents, approvals, and Contact-to-Won pipeline columns",
    concept: "Unified Client ID record connected along a timeline to communications, files, invoices, and deal pipeline columns",
  },
  "whatsapp-automation": {
    slug: "whatsapp-automation",
    src: "/images/services/whatsapp-automation.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    category: "CRM & Business Automation",
    href: "/services/whatsapp-automation",
    alt: "Conversational messaging automation illustration connecting mobile chat sequences to appointment scheduling, parcel dispatch updates, receipts, and human operator handoff",
    heroAlt: "Illustrative automated business messaging flow linking mobile customer replies to booking calendars, order status updates, payment receipts, and live staff escalation",
    concept: "Automated mobile chat sequences connected to booking slots, order status updates, receipts, and human operator handoff",
  },
  "whatsapp-cloud-api-integration": {
    slug: "whatsapp-cloud-api-integration",
    src: "/images/services/whatsapp-cloud-api-integration.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    category: "CRM & Business Automation",
    href: "/services/whatsapp-cloud-api-integration",
    alt: "Official Cloud API Integration diagram showing verified message templates, a TLS-secured HMAC webhook gateway, and real-time delivery receipt telemetry",
    heroAlt: "Illustrative official Cloud API architecture bridging approved transactional message templates through an HMAC-verified TLS gateway to delivery telemetry logs",
    concept: "Verified message templates routed through an HMAC/TLS Cloud API gateway to webhook delivery telemetry",
  },
  "email-automation": {
    slug: "email-automation",
    src: "/images/services/email-automation.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    category: "CRM & Business Automation",
    href: "/services/email-automation",
    alt: "Email Automation architecture illustration showing SPF, DKIM, and DMARC domain authentication routing into enquiry, invoice, and milestone email sequences",
    heroAlt: "Illustrative authenticated email automation engine verifying SPF, DKIM, and DMARC alignment before dispatching event-triggered transactional and lifecycle sequences",
    concept: "SPF/DKIM/DMARC domain authentication ring feeding event-triggered transactional and lifecycle email lanes",
  },
  "sms-automation": {
    slug: "sms-automation",
    src: "/images/services/sms-automation.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    category: "CRM & Business Automation",
    href: "/services/sms-automation",
    alt: "SMS Automation gateway illustration dispatching OTP verification codes, appointment reminders, and dispatch alerts to mobile handsets with delivery confirmation",
    heroAlt: "Illustrative transactional SMS gateway with Secret Manager credential protection and retry logging dispatching OTP, reminder, and dispatch alerts to mobile devices",
    concept: "High-reliability SMS gateway relay dispatching OTP, reminder, and dispatch alerts with delivery confirmation",
  },
  "n8n-workflow-automation": {
    slug: "n8n-workflow-automation",
    src: "/images/services/n8n-workflow-automation.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    category: "CRM & Business Automation",
    href: "/services/n8n-workflow-automation",
    alt: "n8n Workflow Automation canvas showing a webhook trigger, idempotent policy router, CRM database sync, retry audit loop, and completed run telemetry",
    heroAlt: "Illustrative self-hosted n8n workflow orchestration graph connecting webhook triggers, schema validation, encrypted CRM sync, and retry/audit logging",
    concept: "Self-hosted visual node graph with webhook trigger, policy router, CRM sync, retry loop, and execution log bar",
  },

  /* ---------------- Pillar 4: Web, Cloud & Engineering (7) ---------------- */
  "premium-business-websites": {
    slug: "premium-business-websites",
    src: "/images/services/premium-business-websites.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    category: "Web, Cloud & Engineering",
    href: "/services/premium-business-websites",
    alt: "Premium Business Websites illustration showing a bespoke desktop and mobile responsive layout, conversion structure, SEO schema, and high Core Web Vitals score",
    heroAlt: "Illustrative flagship corporate website across desktop and mobile viewports engineered with a custom design system, structured SEO metadata, and fast Core Web Vitals",
    concept: "Desktop and mobile responsive web viewports showcasing bespoke layout structure, SEO schema, and Core Web Vitals",
  },
  "enterprise-websites": {
    slug: "enterprise-websites",
    src: "/images/services/enterprise-websites.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    category: "Web, Cloud & Engineering",
    href: "/services/enterprise-websites",
    alt: "Enterprise Websites architecture diagram showing multi-region locales, role-based departmental authoring, a staging QA approval gate, and global production observability",
    heroAlt: "Illustrative enterprise web publishing platform governing multi-region content across authoring, staging approval gates, shared design tokens, and production monitoring",
    concept: "Multi-region enterprise web governance across RBAC authoring, staging approval gates, and monitored production",
  },
  "api-integrations": {
    slug: "api-integrations",
    src: "/images/services/api-integrations.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    category: "Web, Cloud & Engineering",
    href: "/services/api-integrations",
    alt: "API Integrations hub diagram connecting payments, ERP inventory, CRM Client IDs, courier dispatch, accounting, and messaging through an idempotent webhook bridge",
    heroAlt: "Illustrative event-driven API integration bridge synchronizing payments, ERP stock, CRM records, couriers, accounting, and notifications with retry and audit controls",
    concept: "Central hexagonal API and webhook bridge connecting six enterprise systems with retry and idempotency controls",
  },
  "cloud-deployment-google-cloud": {
    slug: "cloud-deployment-google-cloud",
    src: "/images/services/cloud-deployment-google-cloud.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    category: "Web, Cloud & Engineering",
    href: "/services/cloud-deployment-google-cloud",
    alt: "Google Cloud deployment topology showing a global HTTPS load balancer, three auto-scaling Cloud Run containers, Cloud SQL failover, Secret Manager, and Cloud Logging",
    heroAlt: "Illustrative managed Google Cloud architecture routing TLS traffic across auto-scaling Cloud Run containers backed by HA Cloud SQL, Secret Manager, and Cloud Logging",
    concept: "Global TLS load balancer, auto-scaling Cloud Run container pods, HA Cloud SQL, Secret Manager, and observability",
  },
  "cpanel-stackcp-deployment": {
    slug: "cpanel-stackcp-deployment",
    src: "/images/services/cpanel-stackcp-deployment.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    category: "Web, Cloud & Engineering",
    href: "/services/cpanel-stackcp-deployment",
    alt: "cPanel and StackCP deployment illustration showing hardened server racks, Git-to-staging-to-production release gates, TLS security, and verified off-site backups",
    heroAlt: "Illustrative hardened shared and VPS hosting pipeline separating Git commits, isolated staging verification, live production cutover, and tested off-site backups",
    concept: "Hardened hosting rack paired with Git-controlled staging/production promotion and verified off-site backup drills",
  },
  "maintenance-support": {
    slug: "maintenance-support",
    src: "/images/services/maintenance-support.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    category: "Web, Cloud & Engineering",
    href: "/services/maintenance-support",
    alt: "Maintenance and Support telemetry console showing live uptime monitoring, security patch verification, backup restore checks, and monthly health reporting",
    heroAlt: "Illustrative software maintenance and SLA monitoring console tracking live uptime pulses, dependency and TLS patching, backup drills, and monthly engineering reports",
    concept: "Live uptime heartbeat console, dependency security shield, verified backup checks, and monthly SLA health reporting",
  },
  "digital-transformation-consulting": {
    slug: "digital-transformation-consulting",
    src: "/images/services/digital-transformation-consulting.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    category: "Web, Cloud & Engineering",
    href: "/services/digital-transformation-consulting",
    alt: "Digital Transformation Consulting roadmap illustration bridging current-state process silos through an ROI prioritization compass to a connected target architecture",
    heroAlt: "Illustrative executive transformation roadmap auditing fragmented legacy silos and sequencing phased, ROI-ranked modernization into a connected target architecture",
    concept: "Current-state process audit transitioning via a strategic ROI compass into a phased connected target architecture",
  },
};

/* ---------------- 6 Platform Capability Visuals ---------------- */
export const PLATFORM_SHOWCASE_IMAGES: Record<string, ShowcaseImageEntry> = {
  "client-portal": {
    key: "client-portal",
    src: "/images/platform/platform-client-portal.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    href: "/portal",
    alt: "Tech360 Client Portal workspace illustration showing milestone progress, scope approval, invoice receipts, and source-package handover",
    concept: "Signed-in client portal view with milestone tracker, scope approval, invoices, and handover package",
  },
  "crm-operations": {
    key: "crm-operations",
    src: "/images/platform/platform-crm-operations.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    href: "/technologies",
    alt: "CRM and Business Operations workspace illustration showing Intake, Scoped, In Build, and Delivered stages under one Client ID",
    concept: "Connected CRM kanban board tracking leads, scopes, builds, and deliveries under a single Client ID",
  },
  "automation-workflows": {
    key: "automation-workflows",
    src: "/images/platform/platform-automation-workflows.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    href: "/services/n8n-workflow-automation",
    alt: "Automation Workflows orchestration illustration connecting event queues, sync nodes, human approval gates, and audit notifications",
    concept: "Event queue, sync enrichment, approval gate, and audit notification workflow graph",
  },
  "marketing-operations": {
    key: "marketing-operations",
    src: "/images/platform/platform-marketing-operations.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    href: "/services/email-automation",
    alt: "Marketing Operations studio illustration showing an editorial campaign calendar paired with a human review and publish approval gate",
    concept: "Editorial content calendar paired with an approve-first human review gate",
  },
  "analytics-reporting": {
    key: "analytics-reporting",
    src: "/images/platform/platform-analytics-reporting.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    href: "/services/business-dashboards",
    alt: "Analytics and Reporting console illustration showing funnel conversion trend lines, radial completion ring, and scheduled KPI bars",
    concept: "Operational analytics console with trend curves, radial KPI gauge, and comparative bar charts",
  },
  "developer-tooling": {
    key: "developer-tooling",
    src: "/images/platform/platform-developer-tooling.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    href: "/platform",
    alt: "Platform and Developer Tooling illustration showing modular application scaffolds, staged environment releases, and SHA-256 verified source handover",
    concept: "Modular application scaffolds, staged deployment checks, and SHA-256 verified source handover",
  },
};

/* ---------------- 8 Case-Study Delivery Blueprint Visuals ---------------- */
export const CASE_STUDY_IMAGES: Record<string, ShowcaseImageEntry> = {
  "fashion-retail-store-launch": {
    key: "fashion-retail-store-launch",
    src: "/images/case-studies/fashion-retail-store-launch.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    href: "/work/case-studies",
    alt: "Illustrative eCommerce delivery blueprint showing Catalogue, Checkout, Confirmation, and Fulfillment stages",
    concept: "Four-stage social-commerce to structured storefront blueprint",
  },
  "clinic-appointment-automation": {
    key: "clinic-appointment-automation",
    src: "/images/case-studies/clinic-appointment-automation.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    href: "/work/case-studies",
    alt: "Illustrative healthcare clinic blueprint showing Booking, SMS Reminder, Patient Reply, and Clinic Queue stages",
    concept: "Four-stage clinic online booking and automated SMS reminder workflow",
  },
  "school-enquiry-pipeline": {
    key: "school-enquiry-pipeline",
    src: "/images/case-studies/school-enquiry-pipeline.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    href: "/work/case-studies",
    alt: "Illustrative education admissions blueprint showing Enquiry, First Reply, Batch Match, and Enrolled stages",
    concept: "Four-stage admissions enquiry CRM and guardian update workflow",
  },
  "developer-sales-crm": {
    key: "developer-sales-crm",
    src: "/images/case-studies/developer-sales-crm.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    href: "/work/case-studies",
    alt: "Illustrative real estate CRM blueprint showing Lead Capture, Site Visit, Reservation, and Installments stages",
    concept: "Unified property buyer timeline from enquiry to installment tracking",
  },
  "restaurant-order-pipeline": {
    key: "restaurant-order-pipeline",
    src: "/images/case-studies/restaurant-order-pipeline.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    href: "/work/case-studies",
    alt: "Illustrative restaurant order blueprint showing Order Intake, Kitchen Prep, Courier, and Delivered stages",
    concept: "Multi-channel restaurant order intake, kitchen prep, and delivery queue",
  },
  "logistics-live-tracking": {
    key: "logistics-live-tracking",
    src: "/images/case-studies/logistics-live-tracking.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    href: "/work/case-studies",
    alt: "Illustrative logistics tracking blueprint showing Manifest, Dispatch, Live Tracking, and POD Verified stages",
    concept: "Shipment record, customer tracking link, and proof-of-delivery pipeline",
  },
  "agency-client-portal": {
    key: "agency-client-portal",
    src: "/images/case-studies/agency-client-portal.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    href: "/work/case-studies",
    alt: "Illustrative agency client portal blueprint showing Draft Upload, Client Review, Revision Log, and Approved stages",
    concept: "Deliverable review, revision audit trail, and client sign-off portal",
  },
  "firm-intake-automation": {
    key: "firm-intake-automation",
    src: "/images/case-studies/firm-intake-automation.webp",
    width: 1600,
    height: 1000,
    aspect: "16/10",
    href: "/work/case-studies",
    alt: "Illustrative professional practice blueprint showing Secure Upload, Classification, Deadline SLA, and Completed stages",
    concept: "Secure client document intake and engagement deadline workflow",
  },
};

/* ---------------- 6 Produced Industry Systems (`/platform`) ---------------- */
export const PRODUCED_SYSTEM_IMAGES: Record<string, ShowcaseImageEntry> = {
  "education-campus-os": {
    key: "education-campus-os",
    src: "/images/industries/education-hero.png",
    width: 1600,
    height: 900,
    aspect: "16/9",
    href: "/industries/education",
    alt: "Campus OS education operating-system diagram — illustrative enquiry, admission, academic, and guardian portal architecture",
    concept: "Intentional cross-link to the dedicated Education sector architecture hero",
  },
  "healthcare-clinic-flow": {
    key: "healthcare-clinic-flow",
    src: "/images/industries/healthcare-hero.png",
    width: 1600,
    height: 900,
    aspect: "16/9",
    href: "/industries/healthcare",
    alt: "Clinic Flow healthcare system diagram — illustrative appointment, clinical record, and patient recall architecture",
    concept: "Intentional cross-link to the dedicated Healthcare sector architecture hero",
  },
  "hospitality-stay-suite": {
    key: "hospitality-stay-suite",
    src: "/images/industries/travel-hospitality-hero.png",
    width: 1600,
    height: 900,
    aspect: "16/9",
    href: "/industries/travel-hospitality",
    alt: "Stay Suite hospitality system diagram — illustrative booking, guest messaging, housekeeping, and folio architecture",
    concept: "Intentional cross-link to the dedicated Travel & Hospitality sector architecture hero",
  },
  "property-deal-desk": {
    key: "property-deal-desk",
    src: "/images/industries/real-estate-hero.png",
    width: 1600,
    height: 900,
    aspect: "16/9",
    href: "/industries/real-estate",
    alt: "Deal Desk real-estate system diagram — illustrative listing, lead response, site visit, and installment architecture",
    concept: "Intentional cross-link to the dedicated Real Estate sector architecture hero",
  },
  "commerce-command": {
    key: "commerce-command",
    src: "/images/industries/ecommerce-hero.png",
    width: 1600,
    height: 900,
    aspect: "16/9",
    href: "/industries/ecommerce",
    alt: "Commerce Command retail system diagram — illustrative catalogue, checkout, inventory, and fulfillment architecture",
    concept: "Intentional cross-link to the dedicated eCommerce sector architecture hero",
  },
  "field-ops-hub": {
    key: "field-ops-hub",
    src: "/images/industries/manufacturing-hero.png",
    width: 1600,
    height: 900,
    aspect: "16/9",
    href: "/industries/manufacturing",
    alt: "Field Ops Hub industrial operations diagram — illustrative job dispatch, crew, inventory, and finance architecture",
    concept: "Intentional cross-link to the dedicated Manufacturing & Operations sector architecture hero",
  },
};

/**
 * Documented intentional shared brand assets (logos, video poster).
 * Never used as substitutes for distinct service cards.
 */
export const DOCUMENTED_SHARED_ASSETS = [
  {
    path: "/tech360-logo.png",
    justification: "Official TECH360 LLC brand mark used in Organization JSON-LD and header/footer identity",
  },
  {
    path: "/videos/hero-poster.jpg",
    justification: "Homepage hero background video poster frame (LCP fallback when reduced-motion is active)",
  },
] as const;

export function getServiceImage(slug: string): ServiceImageEntry | undefined {
  return SERVICE_IMAGES[slug];
}

export function serviceImageSrc(slug: string): string | undefined {
  return SERVICE_IMAGES[slug]?.src;
}

export function serviceImageAlt(slug: string, fallbackTitle?: string): string {
  return (
    SERVICE_IMAGES[slug]?.alt ??
    `${fallbackTitle ?? slug} — illustrative service architecture visual`
  );
}

export function serviceHeroImageAlt(slug: string, fallbackTitle?: string): string {
  return (
    SERVICE_IMAGES[slug]?.heroAlt ??
    `${fallbackTitle ?? slug} — illustrative service overview visual`
  );
}

export function getPlatformShowcaseImage(key: string): ShowcaseImageEntry | undefined {
  return PLATFORM_SHOWCASE_IMAGES[key];
}

export function getCaseStudyImage(slug: string): ShowcaseImageEntry | undefined {
  return CASE_STUDY_IMAGES[slug];
}

export function getProducedSystemImage(slug: string): ShowcaseImageEntry | undefined {
  return PRODUCED_SYSTEM_IMAGES[slug];
}
