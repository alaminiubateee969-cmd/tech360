/**
 * Seed TECH360 LLC legal pages with the user's exact legal content.
 * Run: bunx tsx scripts/seed_tech360_legal.ts
 */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const COMPANY_INFO = `
## Company Information

**TECH360 LLC**
117 S Lexington St, Ste 100
Harrisonville, MO 64701
United States

Website: https://bdtech360.com
Email: info@bdtech360.com
WhatsApp: +880 1327-100-297`;

const CONTACT = `
## Contact

For questions regarding these Terms:

**TECH360 LLC**
117 S Lexington St, Ste 100
Harrisonville, MO 64701
United States

Email: info@bdtech360.com
WhatsApp: +880 1327-100-297`;

const PAGES = [
  { slug: "terms-of-service", title: "TECH360 LLC — Terms & Conditions", content: getTerms() },
  { slug: "refund-cancellation", title: "TECH360 LLC — Refund Policy", content: getRefund() },
];

async function main() {
  console.log("Seeding TECH360 LLC legal pages...");
  for (const p of PAGES) {
    // Delete existing slug and recreate to avoid slug conflicts
    await db.legalPage.deleteMany({ where: { slug: p.slug } }).catch(() => {});
    await db.legalPage.create({ data: { slug: p.slug, title: p.title, content: p.content, status: "ACTIVE" } });
    console.log(`  ✓ ${p.slug} (${p.content.length} chars)`);
  }

  // Also update the old "refund-policy" slug to point to the new content
  await db.legalPage.deleteMany({ where: { slug: "refund-policy" } }).catch(() => {});
  await db.legalPage.create({ data: { slug: "refund-policy", title: "TECH360 LLC — Refund Policy", content: getRefund(), status: "ACTIVE" } });
  console.log("  ✓ refund-policy (alias)");

  console.log(`\nDone! ${PAGES.length + 1} legal pages seeded.`);
}

function getTerms(): string {
  return `# TECH360 LLC — Terms & Conditions

**Effective Date: May 19, 2026**

## 1. Agreement

These Terms & Conditions govern the use of the TECH360 LLC website and the purchase of software development, website development, eCommerce, CRM, automation, AI, integration, consulting, maintenance, and related digital services.

By requesting a quotation, approving a Scope of Work, making a payment, or using a delivered service, the client agrees to these Terms, subject to applicable law and any project-specific written agreement.

${COMPANY_INFO}

## 3. Services

TECH360 LLC may provide:

- Custom software development
- Website development
- eCommerce development
- CRM systems
- Client portals
- Business dashboards
- AI solutions
- AI-assisted automation
- WhatsApp automation
- n8n workflow automation
- API integrations
- Database systems
- Cloud deployment
- Hosting and infrastructure services
- Maintenance and technical support
- Consulting and related technology services

The exact services included in a project are determined by the applicable Scope of Work, quotation, invoice, or written project agreement.

## 4. Scope of Work

Before a project proceeds, TECH360 may provide a Scope of Work describing:

- Project objectives
- Features
- Deliverables
- Exclusions
- Technology requirements
- Integrations
- Estimated timeline
- Client responsibilities
- Pricing
- Payment requirements
- Delivery requirements

The approved Scope of Work becomes the controlling project specification for the agreed project, subject to any applicable written project agreement.

## 5. HTML Preview Before Payment

Where applicable, TECH360 may provide an HTML, design, demonstration, or working preview before the client makes the applicable full project payment.

The preview may allow the client to review:

- Design
- Layout
- User interface
- Page structure
- Agreed functionality
- Project presentation

The HTML preview does not constitute final source-code or complete production handover unless expressly agreed in writing.

## 6. Client Approval

The client is responsible for reviewing the Scope of Work and applicable HTML preview before approval.

Approval may be provided through:

- Client portal
- Electronic approval
- Email
- WhatsApp
- Electronic signature
- Other documented communication

Once approved, the Scope of Work represents the client's acceptance of the agreed project requirements.

## 7. Payment After Approval

After approval of the Scope of Work and applicable HTML preview, the client must complete the applicable full project payment according to the agreed invoice, quotation, or project agreement.

Unless otherwise agreed in writing, TECH360 proceeds with final development, production implementation, source-code preparation, and final project handover after the required full payment has been received.

## 8. Source Code and Project Handover

Unless otherwise agreed in writing, final source code and agreed project files are released after applicable full payment.

Final handover may include, depending on the Scope of Work:

- Source code
- Website/application files
- Database export
- Documentation
- Deployment files
- Administrative access
- Deployment assistance
- Other specifically agreed deliverables

Third-party software and services remain subject to their own licenses and terms.

## 9. Changes After Scope Approval

Requests outside the approved Scope of Work may require:

- Additional fees
- Additional development time
- A change order
- Revised Scope of Work
- Separate quotation

Additional requests do not automatically create a refund right.

## 10. Client Responsibilities

The client must provide information and materials reasonably required to complete the project, including where applicable:

- Business information
- Content
- Logos
- Images
- Product information
- Domain access
- Hosting access
- API credentials
- Third-party account access
- Required approvals
- Timely feedback

Client delays may affect project timelines.

## 11. Project Timeline

Unless expressly guaranteed in writing, project timelines are estimates.

Delays may occur because of:

- Client delays
- Missing information
- Missing credentials
- Scope changes
- Third-party services
- API limitations
- Hosting issues
- DNS propagation
- Payment delays
- Infrastructure failures
- Other circumstances outside TECH360's reasonable control

## 12. Third-Party Services and Costs

Unless expressly included in the Scope of Work, the client may be responsible for third-party costs, including:

- Domains
- Hosting
- Cloud services
- WhatsApp/Meta services
- SMS
- Email services
- Payment gateways
- AI API usage
- Premium software
- Plugins
- Third-party APIs
- SaaS subscriptions

TECH360 does not control third-party pricing, availability, policies, or uptime.

## 13. Intellectual Property

Customer-provided materials, including trademarks, logos, content, and business information, remain the customer's property.

Unless otherwise agreed in writing, TECH360 retains rights in its pre-existing and reusable:

- Frameworks
- Libraries
- Generic components
- Templates
- Development tools
- Internal systems
- Know-how
- Reusable technology

Custom deliverables and source-code ownership are governed by the applicable Scope of Work or project agreement and payment status.

Third-party components remain subject to their respective licenses.

## 14. Security

TECH360 takes reasonable measures to protect project information and systems.

However, no internet-connected system can be guaranteed completely secure.

Risks may include:

- Cyberattacks
- Malware
- Unauthorized access
- Third-party failures
- Infrastructure outages
- API failures
- Data loss

After handover, the client is responsible for securing credentials and administrative access under its control.

## 15. Acceptable Use

Clients may not use TECH360 services for unlawful or malicious activities, including:

- Fraud
- Malware
- Phishing
- Unauthorized access
- Cyberattacks
- Illegal surveillance
- Intellectual-property infringement
- Other unlawful activity

TECH360 may suspend or terminate services where reasonably necessary and permitted by applicable law.

## 16. Communication and Records

TECH360 may communicate with clients through email, WhatsApp, telephone, CRM, client portals, meetings, or other agreed communication channels.

Project records may include:

- Requirements
- Scope versions
- Approvals
- Communications
- Payments
- Preview deliveries
- Revision requests
- Delivery records
- Project documentation

Such records may be maintained for project management, delivery verification, security, accounting, and dispute resolution, subject to applicable privacy requirements.

## 17. Termination

Either party may terminate a project where permitted by the applicable agreement or law.

Termination does not automatically create a refund right.

Amounts owed for completed work, approved project stages, committed third-party costs, or other applicable obligations remain subject to the applicable agreement and Refund Policy.

## 18. Disclaimer

Website information is provided for general informational and commercial purposes.

Specific project obligations are determined by the applicable Scope of Work, quotation, invoice, and project agreement.

TECH360 does not guarantee specific business results, revenue, rankings, customer acquisition, or other commercial outcomes unless expressly guaranteed in a written agreement.

## 19. Limitation of Liability

To the extent permitted by applicable law, TECH360 LLC will not be liable for indirect, incidental, consequential, special, or unforeseeable losses arising from circumstances including third-party services, client actions, infrastructure failures, or events outside TECH360's reasonable control.

Nothing in these Terms excludes liability that cannot legally be excluded.

## 20. Force Majeure

TECH360 will not be responsible for delays caused by circumstances beyond its reasonable control, including major infrastructure failures, natural disasters, government actions, widespread internet outages, third-party failures, war, or other extraordinary events.

## 21. Governing Law

TECH360 LLC is organized in the State of Missouri.

These Terms are subject to applicable laws of the State of Missouri and the United States, except where applicable law requires otherwise.

## 22. Changes to These Terms

TECH360 may update these Terms from time to time.

Updated versions will display an updated effective date.

${CONTACT}`;
}

function getRefund(): string {
  return `# TECH360 LLC — Refund Policy

**Effective Date: May 19, 2026**

## 1. General Policy

TECH360 LLC provides customized software, website, eCommerce, CRM, automation, AI, integration, consulting, and related digital services.

Because these services involve project-specific planning, design, development, resources, and customized deliverables, refunds are governed by the applicable Scope of Work, quotation, invoice, project agreement, and this Refund Policy.

## 2. Scope of Work and HTML Preview

Before full project payment, TECH360 may provide:

- A Scope of Work describing the proposed project; and
- An applicable HTML or project preview for client review.

The client has the opportunity to review the proposed scope and applicable preview before approving the project.

## 3. Scope Approval

When the client approves the Scope of Work, the client confirms that they have reviewed and accepted the applicable:

- Project requirements
- Deliverables
- Exclusions
- Pricing
- Timeline
- HTML preview
- Payment terms
- Delivery process

Approval may be recorded through the client portal, CRM, email, WhatsApp, electronic signature, or another documented method.

## 4. No Refund After Scope Approval

Once the client approves the Scope of Work, project payments are non-refundable, except where:

- A refund is required by applicable law;
- The applicable written project agreement expressly provides otherwise; or
- TECH360 LLC voluntarily agrees to a refund in writing.

Scope approval authorizes TECH360 to allocate resources, schedule work, prepare project infrastructure, and commit project-specific resources.

## 5. Before Scope Approval

If a payment has been made before Scope approval, refund eligibility will depend on:

- Work already performed
- Project-specific expenses
- The applicable quotation or agreement
- Third-party costs
- Applicable law

A refund is not automatically guaranteed simply because Scope approval has not yet occurred.

## 6. HTML Preview

The HTML preview is provided to allow the client to review the proposed project direction before the applicable full payment.

The preview may include:

- Layout
- Visual design
- Page structure
- Interface elements
- Sample functionality
- Approved project concepts

The HTML preview does not constitute final source-code delivery unless expressly agreed in writing.

## 7. Full Payment

After Scope of Work and applicable HTML preview approval, the client must complete the required full project payment.

After payment is confirmed, TECH360 may proceed with final development, production implementation, testing, and final project handover according to the approved Scope of Work.

## 8. Source Code

Unless otherwise agreed in writing, final source code and agreed project files are released after applicable full payment.

Third-party software, libraries, APIs, hosting, domains, subscriptions, and external services remain subject to their respective licenses and terms.

## 9. Changes After Approval

Changes outside the approved Scope of Work are not grounds for a refund.

Additional requirements may require:

- Additional fees
- Additional development time
- Change order
- Revised Scope of Work
- Separate quotation

## 10. Client Delays

A refund is not automatically available because of delays caused by the client, including failure to provide:

- Content
- Credentials
- Access
- Approvals
- Feedback
- Required information
- Third-party access

## 11. Third-Party Costs

Third-party payments may be non-refundable according to the third-party provider's terms.

Examples include:

- Domain registration
- Hosting
- Cloud services
- Meta/WhatsApp services
- SMS
- Email
- Payment gateways
- AI providers
- Premium software
- Plugins
- APIs
- External subscriptions

TECH360 cannot guarantee refunds from third-party providers.

## 12. TECH360 Failure to Deliver

If TECH360 materially fails to provide an expressly agreed deliverable included in the approved Scope of Work, the parties should first attempt to resolve the issue through:

- Correction
- Revision
- Replacement
- Additional delivery time
- Another mutually agreed remedy

If the issue cannot reasonably be corrected, any refund or other remedy will be determined according to the applicable agreement, circumstances, and applicable law.

## 13. Refund Requests

Refund requests should be submitted to:

**info@bdtech360.com**

The request should include:

- Client name
- Client ID, if applicable
- Project name
- Invoice/payment reference
- Payment date
- Reason for the request
- Supporting information

TECH360 may review the applicable Scope of Work, approvals, communications, payment records, preview records, and delivery records.

## 14. No Automatic Refund Through Silence

Failure to respond to a message, attend a meeting, or provide feedback does not automatically cancel the project or create a refund entitlement.

## 15. Promotional Services

Promotional offers may have additional terms.

Where a promotion contains specific refund or cancellation conditions, those conditions will apply to that promotion.

## 16. Legal Rights

Nothing in this Refund Policy is intended to remove or restrict any consumer or other legal rights that cannot legally be excluded or waived.

${CONTACT}`;
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1); });
