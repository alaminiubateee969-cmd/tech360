/**
 * Seed all 14 legal pages with real production content.
 * Run: bunx tsx scripts/seed_legal.ts
 */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const COMPANY = "BDTECH360";
const DOMAIN = "bdtech360.com";
const EMAIL = "info@bdtech360.com";
const WHATSAPP = "+880 1327-100297";

const DISCLAIMER = `\n\n## Legal Notice\n\nThis is a general business policy provided by ${COMPANY}. It is not legal advice. These terms should be reviewed by qualified legal counsel before being relied upon for a specific jurisdiction. If there is a conflict between this policy and a signed agreement, the signed agreement prevails.\n\n**Contact:** ${EMAIL} | ${WHATSAPP} | ${DOMAIN}`;

const PAGES = [
  { slug: "terms-of-service", title: "Terms & Conditions", content: getTerms() },
  { slug: "refund-cancellation", title: "Refund & Cancellation Policy", content: getRefund() },
  { slug: "privacy-policy", title: "Privacy Policy", content: getPrivacy() },
  { slug: "cookie-policy", title: "Cookie Policy", content: getCookie() },
  { slug: "payment-terms", title: "Payment Terms", content: getPayment() },
  { slug: "service-agreement", title: "Service Agreement", content: getServiceAgreement() },
  { slug: "intellectual-property", title: "Intellectual Property Policy", content: getIP() },
  { slug: "acceptable-use", title: "Acceptable Use Policy", content: getAUP() },
  { slug: "delivery-project", title: "Delivery & Project Policy", content: getDelivery() },
  { slug: "maintenance-support", title: "Maintenance & Support Policy", content: getMaintenance() },
  { slug: "disclaimer", title: "Disclaimer", content: getDisclaimer() },
  { slug: "sla", title: "SLA / Service Level Policy", content: getSLA() },
  { slug: "data-protection", title: "Data Processing & Data Protection Policy", content: getDataProtection() },
  { slug: "complaint-dispute", title: "Complaint & Dispute Policy", content: getDispute() },
];

async function main() {
  console.log("Seeding 14 legal pages...");
  for (const p of PAGES) {
    await db.legalPage.upsert({
      where: { slug: p.slug },
      create: { slug: p.slug, title: p.title, content: p.content, status: "ACTIVE" },
      update: { title: p.title, content: p.content, status: "ACTIVE" },
    });
    console.log(`  ✓ ${p.slug}`);
  }
  console.log(`\nDone! ${PAGES.length} legal pages seeded.`);
}

function getTerms(): string {
  return `# Terms & Conditions

**Last updated: August 2026**

These Terms & Conditions govern the use of ${COMPANY} services and the website at ${DOMAIN}.

## 1. Acceptance of Terms
By engaging ${COMPANY} for services or using this website, you agree to these terms.

## 2. Services
${COMPANY} provides custom software development, web application development, eCommerce development, CRM development, business automation, AI automation, WhatsApp automation, business intelligence, dashboard development, API development, cloud and server solutions, database solutions, workflow automation, and digital transformation consulting.

## 3. Project Scope
All work is governed by a Scope of Work (SOW) document approved by both parties. Any changes must be documented and approved in writing.

## 4. Payment Terms
Payment terms are defined in the approved SOW. Typically:
- Small projects: 100% before source-code release
- Medium projects: 40% start, 40% milestone, 20% final delivery
- Large projects: 30% discovery, 30% core development, 25% UAT, 15% final handover

Final 15-20% payment is required before source-code, repository, and admin credential handover.

## 5. Intellectual Property
Custom deliverables ownership follows the applicable project agreement and payment status. Pre-existing ${COMPANY} frameworks, libraries, and internal tools remain owned by ${COMPANY} unless otherwise agreed in writing.

## 6. Confidentiality
Both parties agree to maintain confidentiality of all proprietary information shared during the engagement.

## 7. Limitation of Liability
${COMPANY}'s liability is limited to the total project value, except where required by applicable law.

## 8. Termination
Either party may terminate with 30 days written notice. Work completed up to termination is billable.

## 9. Governing Law
These terms are governed by the laws of Bangladesh unless otherwise specified in a signed agreement.

## 10. Changes
We may update these terms. Changes will be posted on this page.${DISCLAIMER}`;
}

function getRefund(): string {
  return `# Refund & Cancellation Policy

**Last updated: August 2026**

## A. Consultation / Discovery
If a consultation or discovery fee is charged, the refundability depends on the agreed terms:
- If the consultation fee is stated as non-refundable, no refund is available.
- If cancellation is requested before the consultation takes place, a refund may be available minus administrative costs.
- If the consultation has already been completed, the fee is non-refundable.

## B. Custom Software Projects
Custom development work is **not automatically refundable** once work has started.

- **Discovery fees**: Non-refundable once discovery work has commenced.
- **Planning fees**: Non-refundable once planning documents have been delivered.
- **Design fees**: Non-refundable once design has been delivered and/or approved.
- **Development fees**: Payment for completed milestones is non-refundable once the milestone has been approved or delivered.
- **Deposits**: Deposits are non-refundable once work has commenced, as they cover resource allocation.

## C. Undelivered Work
If ${COMPANY} has received payment for work that has not started and the customer requests cancellation:
- ${COMPANY} will process a refund after deducting any clearly disclosed non-refundable costs (e.g., committed resources, third-party expenses).
- Refund processing time: 14 business days from approval.

## D. Third-Party Costs
Fees paid to third parties are **non-refundable** where the third party does not provide a refund. This includes:
- Domain registration
- Hosting and cloud services
- Paid APIs and SaaS subscriptions
- Licenses
- Payment gateway fees
- SMS/WhatsApp fees
- External software
- Advertising spend

## E. Refund Request Process
To request a refund, contact ${EMAIL} with:
1. Customer name
2. Invoice/order number
3. Service or project name
4. Reason for refund request
5. Payment date
6. Requested resolution

${COMPANY} will review the request and respond within 7 business days. Refunds are not automatic — they follow the applicable policy, contract, invoice, and applicable law.${DISCLAIMER}`;
}

function getPrivacy(): string {
  return `# Privacy Policy

**Last updated: August 2026**

${COMPANY} respects your privacy and is committed to protecting your personal data.

## 1. Information We Collect
- **Account information**: name, email, password (hashed)
- **Contact information**: phone, company, WhatsApp number
- **Project information**: scope documents, files, communications
- **Payment information**: invoice records, payment status (we do not store full card numbers)
- **Technical information**: IP address, browser type, usage logs

## 2. How We Use Your Information
- To provide and manage our services
- To communicate about projects and proposals
- To process payments and issue invoices
- To improve our services and customer experience
- To comply with legal obligations

## 3. Cookies
We use essential cookies for authentication and session management. See our Cookie Policy for details.

## 4. Data Security
We implement the following controls:
- Password hashing (bcrypt)
- HTTPS encryption in transit
- Role-based access control (RBAC)
- Protected API endpoints
- Environment-based secret management
- Audit logging

We do not claim "bank-level security," "military-grade encryption," or "100% secure" systems.

## 5. Data Retention
Personal data is retained for the duration of the business relationship and for 7 years thereafter for legal compliance, unless you request earlier deletion.

## 6. Your Rights
You have the right to:
- Access your personal data
- Request correction or deletion
- Object to processing
- Data portability
- Withdraw consent

Contact ${EMAIL} to exercise these rights.

## 7. Service Providers
We may use third-party service providers (hosting, email, payment processing) who have access to limited personal data to perform services on our behalf.

## 8. International Transfers
Your data may be processed in countries other than your own. We take reasonable steps to ensure appropriate data protection.

## 9. Children's Privacy
Our services are not directed to children under 16. We do not knowingly collect data from children.

## 10. Policy Updates
We may update this policy. Changes will be posted on this page.${DISCLAIMER}`;
}

function getCookie(): string {
  return `# Cookie Policy

**Last updated: August 2026**

## Cookies Used by ${DOMAIN}

### Essential Cookies
- **Authentication session**: Required for login functionality. Deleted when you log out.
- **CSRF token**: Protects against cross-site request forgery.

### Preference Cookies
- **Theme preference**: Remembers your light/dark mode choice.

### Analytics Cookies
We do not currently use third-party analytics cookies. If we add analytics in the future, this policy will be updated.

### Marketing Cookies
We do not use marketing or advertising cookies.

## Managing Cookies
You can manage cookies through your browser settings:
- **Chrome**: Settings → Privacy and security → Cookies
- **Firefox**: Settings → Privacy & Security → Cookies
- **Safari**: Preferences → Privacy → Cookies
- **Edge**: Settings → Cookies and site permissions

Disabling essential cookies will prevent login and authenticated functionality.${DISCLAIMER}`;
}

function getPayment(): string {
  return `# Payment Terms

**Last updated: August 2026**

## Project Deposits
- Small projects: 100% before source-code release
- Medium projects: 40% start, 40% milestone, 20% final delivery
- Large projects: 30% discovery, 30% core development, 25% UAT, 15% final handover

## Milestone Payments
Milestone payments are due upon milestone delivery and approval. Each milestone invoice includes:
- Description of work completed
- Hours and rate breakdown
- Payment due date (7 days from invoice)

## Recurring Subscriptions
If a recurring subscription is purchased:
- Billing cycle: monthly or annual as specified
- Cancellation: 30 days notice required
- Refunds: governed by the Refund & Cancellation Policy

## Invoices
- All invoices are issued by ${COMPANY}
- Currency: USD unless otherwise stated
- Payment methods: bank transfer, or other methods as specified in the invoice

## Payment Deadlines
- Standard: 7 days from invoice date
- Overdue: Reminders sent at 7, 14, and 30 days
- Suspension: Services may be suspended after 30 days overdue

## Taxes
- Prices exclude applicable taxes unless stated otherwise
- Taxes are the responsibility of the customer where applicable

## Third-Party Costs
Third-party costs (domain, hosting, APIs, licenses) are billed at cost plus applicable handling fees unless otherwise agreed.

## Payment Confirmation
Payment is confirmed when:
- Bank transfer is received and verified
- Payment gateway webhook confirms successful transaction

Client screenshots are not accepted as payment confirmation.${DISCLAIMER}`;
}

function getServiceAgreement(): string {
  return `# Service Agreement

**Last updated: August 2026**

## 1. Discovery
Requirements gathering, technical planning, and feasibility analysis. Output: requirements document and project plan.

## 2. Design
UI/UX design and design approval. Output: design mockups and design system specification.

## 3. Development
Engineering and implementation of the approved design and requirements. Output: working software.

## 4. Testing
Quality assurance, functional testing, and customer acceptance testing. Output: test report and acceptance sign-off.

## 5. Deployment
Production deployment after required approvals and payments are completed. Output: live application.

## 6. Acceptance
Customer must accept or request revisions within 7 days of delivery. Failure to respond constitutes acceptance.

## 7. Change Requests
Changes outside the approved SOW may require:
- Additional cost estimation
- Additional timeline
- Written approval from both parties

No unlimited development is promised or implied.

## 8. Source Code Delivery
Source code delivery is governed by the project agreement and payment status. See the Intellectual Property Policy for details.${DISCLAIMER}`;
}

function getIP(): string {
  return `# Intellectual Property Policy

**Last updated: August 2026**

## 1. Customer-Owned Materials
Customer data, logos, trademarks, documents, and content provided to ${COMPANY} remain the customer's property. ${COMPANY} does not claim ownership of customer-provided materials.

## 2. ${COMPANY} Pre-Existing Materials
Reusable frameworks, libraries, templates, generic components, development tools, internal systems, know-how, and pre-existing intellectual property remain owned by ${COMPANY} unless otherwise agreed in writing.

## 3. Custom Deliverables
Ownership and licensing of custom deliverables follow the applicable project agreement and payment status:
- Full source-code ownership transfers only when all agreed invoices are paid
- Third-party licenses remain applicable regardless of payment status
- ${COMPANY} retains the right to showcase completed work in its portfolio

## 4. Third-Party Software
Third-party libraries, frameworks, and services used in the project remain subject to their respective licenses and terms. ${COMPANY} is not responsible for third-party license compliance beyond reasonable diligence.

## 5. Source Code Delivery
For custom software projects where full source-code ownership is included:
- All agreed invoices must be paid
- Agreed deliverables must be completed
- Source code is delivered via secure, signed URL with 24-hour expiry
- Third-party licenses and credentials are NOT included

Source-code delivery is not provided for hosted subscription services unless the contract explicitly states otherwise.${DISCLAIMER}`;
}

function getAUP(): string {
  return `# Acceptable Use Policy

**Last updated: August 2026**

## Prohibited Uses
${COMPANY} services and infrastructure may not be used for:

1. Illegal activities of any kind
2. Fraud or deceptive practices
3. Malware distribution, including viruses, trojans, and ransomware
4. Phishing or social engineering attacks
5. Unauthorized access to systems or data
6. Abuse, harassment, or threats
7. Illegal surveillance or monitoring
8. Intellectual property infringement
9. Spam or unsolicited mass communications
10. Distribution of harmful or malicious content
11. Activities that violate applicable laws or regulations

## Enforcement
${COMPANY} may suspend or terminate services where:
- A violation of this policy is identified
- Required by applicable law
- Permitted by the applicable contract

Customers are responsible for the content and activities conducted through their projects.${DISCLAIMER}`;
}

function getDelivery(): string {
  return `# Delivery & Project Policy

**Last updated: August 2026**

## Delivery Process
1. **Approved Scope**: SOW approved by both parties
2. **Development**: Work proceeds per the SOW timeline
3. **Testing**: QA testing across all features
4. **Preview**: HTML preview provided before final payment
5. **Payment**: Final payment verified
6. **Admin Approval**: ${COMPANY} admin approves delivery release
7. **Source-Code Handover**: Signed URL with 24-hour expiry
8. **Password Rotation**: Customer changes all credentials
9. **Confirmation**: Delivery confirmed in CRM
10. **Support**: Post-delivery support period begins

## HTML Preview Before Payment
Customers receive an HTML preview of the deliverable to verify functionality and design before final payment. The preview is:
- Time-limited (expires after 7 days)
- Password-protected
- Does not include source code or backend access

## Source Code Access
Source code is **blocked** until:
- Payment status = VERIFIED
- Admin approval = APPROVED
- Password rotation checklist = COMPLETE

## Final Delivery Package
- Source code (ZIP)
- Database schema
- Deployment documentation
- Admin documentation
- Environment variable template
- Third-party license notices
- Handover document

**Actual secrets (API keys, passwords, credentials) are NOT included.** The customer configures their own credentials.${DISCLAIMER}`;
}

function getMaintenance(): string {
  return `# Maintenance & Support Policy

**Last updated: August 2026**

## Included Support
Only support explicitly included in the customer's plan or project agreement is provided at no additional cost. This typically includes:
- Bug fixes for functionality that worked at delivery
- Critical security patches
- 30-day post-delivery support period (for custom projects)

## Paid Maintenance
The following are chargeable and not included in standard support:
- Bug fixes outside the support period
- Software updates and version upgrades
- Performance optimizations
- Configuration changes
- Server maintenance
- Database maintenance

## New Features
New functionality is **not** automatically considered a bug fix. Feature requests are quoted separately as change requests.

## Emergency Support
Emergency response may have separate pricing and availability. Contact ${EMAIL} for emergency support arrangements.

## Bug Definition
A bug is defined as functionality that does not match the approved SOW specification. Issues caused by:
- Customer-provided content or data
- Third-party service changes
- Server or hosting environment changes
- Browser or device incompatibility not specified in the SOW

...are not considered bugs.${DISCLAIMER}`;
}

function getDisclaimer(): string {
  return `# Disclaimer

**Last updated: August 2026**

## General Information
The information on this website is general information provided by ${COMPANY}. It is not legal, financial, or technical advice.

## Service Availability
Service availability may vary due to maintenance, updates, or factors outside ${COMPANY}'s control. ${COMPANY} does not guarantee uninterrupted availability unless a separate SLA applies.

## Technology Results
Technology results depend on project requirements, third-party systems, and customer cooperation. Past results do not guarantee future performance.

## Third-Party Systems
${COMPANY} relies on third-party infrastructure (hosting, APIs, payment gateways, etc.) which may affect functionality. ${COMPANY} is not responsible for third-party outages or changes.

## Estimated Timelines
Project timelines are estimates unless contractually guaranteed. Delays caused by:
- Customer feedback or revision cycles
- Customer-provided content delays
- Third-party dependencies
- Force majeure events

...may extend the project timeline.

## Business Outcomes
${COMPANY} builds technology systems. Business outcomes (revenue, growth, conversion rates) depend on many factors beyond the software itself and are not guaranteed.

## Customer Responsibility
Customers are responsible for:
- Providing accurate requirements
- Providing lawful content
- Providing necessary access and credentials
- Reviewing and approving deliverables in a timely manner
- Maintaining their own credentials after handover${DISCLAIMER}`;
}

function getSLA(): string {
  return `# SLA / Service Level Policy

**Last updated: August 2026**

## Standard Services
Unless a separate written SLA applies, services are provided **without a guaranteed uptime commitment**.

${COMPANY} does not invent uptime numbers or availability guarantees that are not technically backed.

## Custom SLA
For enterprise or managed service customers, a custom SLA may be negotiated as part of the project agreement. A custom SLA may include:
- Response time commitments
- Resolution time commitments
- Uptime targets
- Escalation procedures
- Credit policies for missed targets

## Support Response Times (General Guidelines)
- **Standard support**: Best-effort response within 1 business day
- **Priority support**: Best-effort response within 4 hours (business hours)
- **Emergency support**: Subject to separate arrangement

These are general guidelines, not contractual commitments, unless specified in a signed agreement.${DISCLAIMER}`;
}

function getDataProtection(): string {
  return `# Data Processing & Data Protection Policy

**Last updated: August 2026**

## Data We Process
- Customer account data (name, email, phone)
- Project data (scope documents, files, communications)
- Payment records (invoice numbers, payment status)
- Technical data (IP addresses, access logs)
- Communication records (WhatsApp, email, social messages)

## Data Security Controls
${COMPANY} implements the following data protection controls:
- **Authentication**: NextAuth with JWT sessions
- **Password hashing**: bcrypt with salt
- **Authorization**: Role-based access control (RBAC)
- **API protection**: All sensitive APIs require authentication
- **HTTPS**: Encrypted communication in transit
- **Database access control**: Private network, no public access
- **Environment secrets**: Secrets stored in environment variables, never in source code
- **Audit logging**: All sensitive actions are logged
- **File access**: Authenticated, signed URLs for file downloads

${COMPANY} does not claim compliance certifications (GDPR, CCPA, SOC2, ISO27001) that it does not hold.

## Data Retention
- Active data: Retained for the duration of the business relationship
- Archived data: Retained for 7 years for legal compliance
- Deletion requests: Honored within 30 days where legally permissible

## Data Subject Rights
Contact ${EMAIL} to:
- Access your data
- Request correction
- Request deletion
- Object to processing
- Request data portability

## Breach Notification
In the event of a data breach, ${COMPANY} will notify affected customers within 72 hours of discovery, in accordance with applicable law.${DISCLAIMER}`;
}

function getDispute(): string {
  return `# Complaint & Dispute Policy

**Last updated: August 2026**

## Complaint Process
If you have a complaint about ${COMPANY} services:

### Step 1: Contact Us
Email ${EMAIL} or WhatsApp ${WHATSAPP} with:
1. Your name and contact details
2. Order/invoice/project reference
3. Description of the issue
4. Requested resolution

### Step 2: Review
${COMPANY} will review the matter and respond within 7 business days.

### Step 3: Resolution Attempt
${COMPANY} will attempt reasonable resolution, which may include:
- Service correction or rework
- Partial refund where applicable
- Timeline adjustment
- Alternative resolution

### Step 4: Escalation
If the matter cannot be resolved through standard support:
- Escalate to management: ${EMAIL}
- The dispute will be handled according to the applicable agreement and law
- Arbitration or legal proceedings may be pursued where necessary

## Good Faith
Both parties agree to act in good faith to resolve disputes before pursuing formal legal action.

## Governing Law
Disputes are governed by the laws of Bangladesh unless otherwise specified in a signed agreement.${DISCLAIMER}`;
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
