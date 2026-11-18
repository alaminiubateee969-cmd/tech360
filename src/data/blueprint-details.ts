/**
 * Delivery blueprint detail records — one per `CASE_STUDIES` entry.
 *
 * HONESTY CONTRACT
 * ----------------
 * A blueprint is an *illustrative* problem → architecture → intended-outcome
 * scenario. It is not a delivered client engagement and carries no measured
 * result. Where international portfolio pages show a "Results" block, these
 * pages show a **measurement plan** instead: the baselines and signals that
 * would have to be captured during a real engagement before any result could
 * be claimed. `tests/portfolio.test.ts` enforces the forbidden-claim list
 * against every record in this file.
 */

export interface BlueprintStage {
  title: string;
  description: string;
}

export interface BlueprintDetail {
  /** Must match a `CASE_STUDIES[].slug`. */
  slug: string;
  /** Short sector context paragraph shown under the hero. */
  context: string;
  /** Four-stage operational flow (mirrors the architecture diagram). */
  stages: BlueprintStage[];
  /** What would be measured — never a claimed result. */
  measurementPlan: string[];
  /** Assumptions and dependencies the scenario relies on. */
  assumptions: string[];
  /** Matching sector page under /industries. */
  industrySlug: string;
  /** Related published services. */
  relatedServices: string[];
  /** Closest system scenario under /work/projects. */
  relatedProject: string;
}

const DETAILS: BlueprintDetail[] = [
  {
    slug: "fashion-retail-store-launch",
    context:
      "Social-commerce sellers often start in chat inboxes. The blueprint shows how the same team could move to a structured storefront without losing the conversational channel customers already use.",
    stages: [
      { title: "Catalogue", description: "Products, sizes and stock are maintained once and published to the storefront." },
      { title: "Checkout", description: "Cart, delivery option and local payment are captured with server-side pricing." },
      { title: "Confirmation", description: "The order is recorded against a customer profile and a confirmation is sent." },
      { title: "Fulfilment", description: "Dispatch status is updated in one queue and shared with the customer." },
    ],
    measurementPlan: [
      "Baseline the current time from customer message to confirmed order before go-live.",
      "Count orders that need manual payment reconciliation per week, before and after.",
      "Track the share of status enquiries answered by the automated update rather than staff.",
    ],
    assumptions: [
      "A payment provider account is approved and tested for the business.",
      "Product data (sizes, stock, photos) is supplied or migrated before launch.",
    ],
    industrySlug: "ecommerce",
    relatedServices: ["ecommerce-platforms", "whatsapp-automation", "n8n-workflow-automation"],
    relatedProject: "ecommerce-storefront",
  },
  {
    slug: "clinic-appointment-automation",
    context:
      "Front-desk teams in busy clinics balance walk-ins, phone calls and reminders. The blueprint moves reminder work into a configured workflow while keeping staff in control of the daily schedule.",
    stages: [
      { title: "Booking", description: "Patients choose a doctor and slot online; the desk can also book on their behalf." },
      { title: "SMS reminder", description: "Configured reminders go out before the appointment from an approved sender." },
      { title: "Patient reply", description: "Confirmations and reschedule requests are logged against the appointment." },
      { title: "Clinic queue", description: "The daily schedule view shows confirmed, pending and rescheduled visits." },
    ],
    measurementPlan: [
      "Record the current no-show rate for a defined period before the pilot.",
      "Log the staff time spent on reminder calls per day, before and after.",
      "Measure the share of reminders that receive a patient reply.",
    ],
    assumptions: [
      "The clinic confirms its own health-data obligations and preferred hosting region.",
      "An SMS sender identity is registered and approved with the gateway.",
    ],
    industrySlug: "hospitals-clinics",
    relatedServices: ["custom-software-development", "sms-automation", "maintenance-support"],
    relatedProject: "clinic-system",
  },
  {
    slug: "school-enquiry-pipeline",
    context:
      "Admissions enquiries peak in the evenings and at weekends. The blueprint gives counsellors a shared queue so that every enquiry has an owner and a next step.",
    stages: [
      { title: "Enquiry", description: "Website, chat and phone enquiries create one record with a Client ID." },
      { title: "First reply", description: "An approved template acknowledges the enquiry and asks qualifying questions." },
      { title: "Batch match", description: "Counsellors match the student to a batch or programme with available seats." },
      { title: "Enrolled", description: "Enrolment, guardian contact and fee schedule are recorded on the student record." },
    ],
    measurementPlan: [
      "Baseline median time to first reply across channels before go-live.",
      "Track the share of enquiries with an assigned counsellor and due date.",
      "Report stage conversion from enquiry to enrolment using first-party data only.",
    ],
    assumptions: [
      "Messaging templates are approved before automated first replies are enabled.",
      "Batch and seat data is maintained by the institution.",
    ],
    industrySlug: "education",
    relatedServices: ["custom-crm-development", "whatsapp-ai-sales-crm", "n8n-workflow-automation"],
    relatedProject: "education-crm",
  },
  {
    slug: "developer-sales-crm",
    context:
      "Property sales run over months, across agents, site visits and instalments. The blueprint keeps the full buyer journey on one timeline so that handovers between agents lose nothing.",
    stages: [
      { title: "Lead capture", description: "Project enquiries are captured with source and assigned to an agent." },
      { title: "Site visit", description: "Visits are scheduled, attended and logged with buyer feedback." },
      { title: "Reservation", description: "A unit is reserved against the buyer, with documents stored in the vault." },
      { title: "Instalments", description: "Instalment schedule, invoices and receipts are reconciled on the timeline." },
    ],
    measurementPlan: [
      "Baseline how long a manager needs to compile a weekly pipeline report today.",
      "Track follow-ups completed on or before their due date.",
      "Count unit-availability conflicts reported per month, before and after.",
    ],
    assumptions: [
      "Unit inventory and pricing are supplied by the developer and kept current.",
      "Accounting export format is agreed with the finance team.",
    ],
    industrySlug: "real-estate",
    relatedServices: ["custom-crm-development", "client-portals", "business-dashboards"],
    relatedProject: "real-estate-crm",
  },
  {
    slug: "restaurant-order-pipeline",
    context:
      "Restaurants take orders through chat, phone, marketplaces and the counter. The blueprint routes every channel into one kitchen-facing queue with clear status for staff and customers.",
    stages: [
      { title: "Order intake", description: "Orders from each channel are normalised into a single order record." },
      { title: "Kitchen prep", description: "The kitchen display shows queued, in-progress and ready orders." },
      { title: "Courier", description: "Delivery orders are handed to a rider with an address and contact." },
      { title: "Delivered", description: "Completion is recorded and the customer receives a status update." },
    ],
    measurementPlan: [
      "Baseline order-to-ready time per channel for a defined service period.",
      "Count orders re-keyed manually between systems per shift.",
      "Track order-status enquiries handled by staff, before and after.",
    ],
    assumptions: [
      "Marketplace integrations depend on the partner API access available to the restaurant.",
      "Kitchen display hardware is provided on site.",
    ],
    industrySlug: "restaurants-food",
    relatedServices: ["whatsapp-automation", "api-integrations", "business-dashboards"],
    relatedProject: "whatsapp-sales-funnel",
  },
  {
    slug: "logistics-live-tracking",
    context:
      "Courier teams spend significant time answering “where is my parcel?”. The blueprint shares configured milestones through a tracking link while dispatch keeps one operational view.",
    stages: [
      { title: "Manifest", description: "Shipments are created or imported with recipient and service level." },
      { title: "Dispatch", description: "Shipments are assigned to routes and riders in the planning view." },
      { title: "Live tracking", description: "Customers follow configured milestones through a private tracking link." },
      { title: "POD verified", description: "Proof of delivery is captured and attached to the shipment record." },
    ],
    measurementPlan: [
      "Baseline inbound status enquiries per 100 shipments before launch.",
      "Track the share of deliveries with proof of delivery attached.",
      "Measure the delay between a milestone event and the customer notification.",
    ],
    assumptions: [
      "Rider devices can record milestone events reliably in the operating area.",
      "Notification channels (SMS or email) are approved for transactional use.",
    ],
    industrySlug: "logistics",
    relatedServices: ["custom-software-development", "sms-automation", "api-integrations"],
    relatedProject: "client-portal",
  },
  {
    slug: "agency-client-portal",
    context:
      "Agencies collect approvals through email threads and forwarded chats. The blueprint gives each client a private workspace where versions, comments and approvals are recorded.",
    stages: [
      { title: "Brief", description: "The client workspace opens with scope, milestones and the agreed brief." },
      { title: "Review", description: "Deliverables are uploaded as versions for client review and comment." },
      { title: "Approval", description: "Explicit approvals are recorded with timestamp and approver." },
      { title: "Handover", description: "Final assets, invoices and receipts are available in one place." },
    ],
    measurementPlan: [
      "Count revision rounds per deliverable for a baseline set of projects.",
      "Track the share of deliverables with a recorded approval before release.",
      "Measure time from upload to client decision.",
    ],
    assumptions: [
      "Clients accept portal sign-in as the approval channel in their contract.",
      "Large media files are stored in configured cloud storage.",
    ],
    industrySlug: "agencies",
    relatedServices: ["client-portals", "custom-crm-development", "email-automation"],
    relatedProject: "agency-portal",
  },
  {
    slug: "firm-intake-automation",
    context:
      "Accounting and legal practices receive documents through personal inboxes and track deadlines in separate files. The blueprint centralises intake and deadlines behind role-based access.",
    stages: [
      { title: "Secure intake", description: "Clients upload documents to a private portal instead of personal email." },
      { title: "Checklist", description: "Each engagement has a document checklist showing what is still missing." },
      { title: "Deadlines", description: "Filing and review deadlines trigger reminders to the responsible staff." },
      { title: "Sign-off", description: "Approvals and final documents are stored with an audit trail." },
    ],
    measurementPlan: [
      "Baseline the number of documents received outside the agreed channel per month.",
      "Track deadlines met with reminders versus without.",
      "Measure time from engagement start to complete document set.",
    ],
    assumptions: [
      "The practice defines retention and confidentiality rules for its jurisdiction.",
      "Staff roles and approval responsibilities are agreed before configuration.",
    ],
    industrySlug: "professional-services",
    relatedServices: ["client-portals", "email-automation", "database-systems"],
    relatedProject: "lead-management",
  },
];

export const BLUEPRINT_DETAILS: readonly BlueprintDetail[] = DETAILS;

export function getBlueprintDetail(slug: string): BlueprintDetail | undefined {
  return DETAILS.find((detail) => detail.slug === slug);
}

export const BLUEPRINT_DETAIL_NOTICE =
  "Illustrative delivery blueprint: this page describes how TECH360 would approach a common operational problem. It is not a named client engagement, and no measured outcome is claimed — the measurement plan lists what a real engagement would have to baseline first.";
