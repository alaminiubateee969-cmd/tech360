/**
 * Service detail content — ideal customer profile, industry cross-links and
 * service-specific FAQs for all 21 public services.
 *
 * Why a separate module: these strings are buyer-facing claims, so they are
 * pinned by tests (`tests/service-detail-content.test.ts`) and reusable by the
 * agent content generator. Nothing here is a price, a timeline, or a measured
 * outcome — every client-visible number stays inside the approved Scope of
 * Work.
 *
 * Pure data + pure functions: safe in any runtime, no imports from views.
 */

export type ServiceFaq = { q: string; a: string };

/** Who this service is actually for — one honest sentence per service. */
export const SERVICE_IDEAL_CUSTOMER: Record<string, string> = {
  "premium-business-websites":
    "Established businesses whose website is judged against competitors in the same search result — and whose current site is quietly losing enquiries it never hears about.",
  "enterprise-websites":
    "Organisations with several teams, regions or brands that all publish through one site and need staging, approval and access control rather than a single editing login.",
  "ecommerce-platforms":
    "Sellers who have outgrown a hosted template: they need their own catalogue logic, checkout rules, order operations and a storefront tied to their real inventory.",
  "custom-crm-development":
    "Teams running sales and delivery out of spreadsheets, inboxes and group chats, where no single record explains what was promised, by whom, and when.",
  "whatsapp-ai-sales-crm":
    "Businesses whose enquiries arrive mostly on WhatsApp, where several staff answer from personal handsets and nothing is logged against a customer record.",
  "client-portals":
    "Service businesses that repeatedly answer the same questions — where is my file, what stage is this at, what do I owe — and want the answer self-served.",
  "business-dashboards":
    "Operators who export the same reports every week to answer the same questions, and need those numbers available to the people who act on them.",
  "whatsapp-automation":
    "Businesses already fielding legitimate, opted-in WhatsApp volume — order updates, booking reminders, milestone notices — that is still sent one message at a time.",
  "whatsapp-cloud-api-integration":
    "Companies that need the official Meta Cloud API rather than a shared third-party gateway, with templates, webhooks and delivery receipts wired into a system.",
  "email-automation":
    "Teams whose transactional email and onboarding sequences are either missing, inconsistent or land in spam — and who need deliverability handled properly.",
  "sms-automation":
    "Services where a message is time-critical: an OTP, an appointment reminder, a schedule change, and where a missed SMS has a real operational cost.",
  "n8n-workflow-automation":
    "Operations teams moving data between tools by hand, where one missed step causes a late invoice, a duplicate order or an unassigned ticket.",
  "ai-agent-systems":
    "Organisations that want AI doing bounded, logged work — triage, drafting, lookup, routing — with a named human approving anything that leaves the system.",
  "ai-business-automation":
    "Back-office processes with clear inputs and rules — invoice handling, document intake, approval routing — that consume hours of skilled staff time each week.",
  "api-integrations":
    "Businesses whose systems each hold a slice of the truth: payments in one place, fulfilment in another, accounting in a third, reconciled by hand.",
  "database-systems":
    "Teams whose data has outgrown spreadsheets or an unmanaged database, and who need schema ownership, migrations, auditability and tested backups.",
  "cloud-deployment-google-cloud":
    "Products that need production hosting with managed secrets, TLS, logging and a repeatable deploy path — not a server someone SSH'd into once.",
  "cpanel-stackcp-deployment":
    "Smaller operations that need a pragmatic, well-configured shared or VPS hosting setup — SSL, cron, domains, email — without enterprise overhead or cost.",
  "custom-software-development":
    "Businesses with a process that is genuinely their advantage, where no off-the-shelf product fits without the business bending around the software.",
  "maintenance-support":
    "Teams running a live system that needs patching, monitoring, backups and defined response times — without hiring an internal engineer for it.",
  "digital-transformation-consulting":
    "Leadership teams that know the current tooling is the constraint but not what to buy, build, retire or sequence first.",
};

/**
 * Industry cross-links. Every service maps to 2–4 of the 20 preserved industry
 * slugs (asserted against the registry by `tests/service-detail-content.test.ts`).
 */
export const SERVICE_INDUSTRIES: Record<string, string[]> = {
  "premium-business-websites": ["agencies", "professional-services", "local-businesses", "legal-services"],
  "enterprise-websites": ["manufacturing", "finance", "logistics"],
  "ecommerce-platforms": ["ecommerce", "retail", "restaurants-food"],
  "custom-crm-development": ["agencies", "real-estate", "professional-services"],
  "whatsapp-ai-sales-crm": ["ecommerce", "real-estate", "restaurants-food"],
  "client-portals": ["professional-services", "legal-services", "schools-training"],
  "business-dashboards": ["finance", "logistics", "manufacturing"],
  "whatsapp-automation": ["ecommerce", "retail", "travel-hospitality"],
  "whatsapp-cloud-api-integration": ["ecommerce", "healthcare", "marketing-agencies"],
  "email-automation": ["marketing-agencies", "ecommerce", "education"],
  "sms-automation": ["healthcare", "hospitals-clinics", "travel-hospitality"],
  "n8n-workflow-automation": ["logistics", "manufacturing", "agencies"],
  "ai-agent-systems": ["technology-companies", "finance", "professional-services"],
  "ai-business-automation": ["logistics", "manufacturing", "healthcare"],
  "api-integrations": ["finance", "logistics", "ecommerce"],
  "database-systems": ["healthcare", "manufacturing", "finance"],
  "cloud-deployment-google-cloud": ["technology-companies", "international-smes", "agencies"],
  "cpanel-stackcp-deployment": ["local-businesses", "restaurants-food", "schools-training"],
  "custom-software-development": ["manufacturing", "logistics", "professional-services"],
  "maintenance-support": ["hospitals-clinics", "schools-training", "retail"],
  "digital-transformation-consulting": ["construction", "manufacturing", "international-smes"],
};

/**
 * The four questions every service page answers, in the same order, with the
 * commercial wording governed by `src/lib/public-journey.ts`. The service title
 * is interpolated so each page reads specifically rather than generically.
 */
export function serviceFaqs(service: {
  slug: string;
  title: string;
  features: readonly string[];
  tech: readonly string[];
}): ServiceFaq[] {
  const featureCount = service.features.length;
  const techSample = service.tech.slice(0, 3).join(", ");
  return [
    {
      q: `What is actually included in ${service.title}?`,
      a: `The service is built to ${featureCount} published standards. Which of them apply to you, and to what depth, is written into the approved Scope of Work before work starts${
        techSample ? ` — along with the technology decisions (typically ${techSample})` : ""
      }. Anything not named there is out of scope by default.`,
    },
    {
      q: "How long does it take and what does it cost?",
      a: "Schedule and price are set per engagement and stated in the written proposal. They depend on scope, the number of integrations, how much content and data already exists, and how quickly approvals come back. No figure on this page is a quote, and nothing starts before you approve the Scope of Work.",
    },
    {
      q: "What do I see before I pay?",
      a: "Where the agreed process includes an HTML preview, you review the visual design and the elements actually shown before the applicable payment step. A preview is a design review — it is not proof that backend systems, integrations or data migration are complete.",
    },
    {
      q: "When do I receive the source code?",
      a: "Source code and agreed project files are handed over after all required payments have been received and cleared, unless the Scope of Work says otherwise. Handover includes the documentation needed to run the system.",
    },
  ];
}

/** Total mapped services — asserted by tests to equal the public catalogue (21). */
export const SERVICE_DETAIL_COVERAGE = {
  idealCustomer: Object.keys(SERVICE_IDEAL_CUSTOMER).length,
  industries: Object.keys(SERVICE_INDUSTRIES).length,
} as const;
