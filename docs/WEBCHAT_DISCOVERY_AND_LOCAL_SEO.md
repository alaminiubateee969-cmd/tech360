# Webchat discovery, proposals and Bangladesh local SEO

## Customer journey

1. A website visitor starts in webchat and describes their business. The intake records consent and lets the visitor choose **SMS first** or **email first** for the initial service reply; email is required for email-first, while a valid mobile number is required for SMS-first. Email is optional if SMS is selected.
2. SMS is sent only when SMS is selected, a valid phone number is supplied, consent is recorded, and an SMS provider accepts the request. If no gateway is configured or the provider rejects it, the enquiry stays in webchat; the system does not silently switch channels. Marketing SMS needs separate opt-in. Configure the existing SMS integration in admin Settings / Calls & SMS (for example the configured httpSMS gateway).
3. The agent asks one discovery question at a time and stores the answers in the CRM lead requirements. For retail and service businesses these cover business goal, staff/users, website/features, products and catalogue size, units sold and on-hand stock, upcoming items, employee tasks, marketing/customer sources, real shop/service locations, integrations, timing, budget and content assets.
4. Discovery also asks about the customer's domain, registrar/DNS manager, exact hosting provider and plan, and supported runtime/database. A domain mentioned in chat is stored as a customer claim—not proof of ownership, availability, DNS control, or hosting compatibility. A bare domain does not complete the hosting-fit question.
5. The preliminary proposal states the intended framework and where the web app, data, files and any scoped automation/AI components would run; host-fit assumptions and unverified facts; recurring costs; DNS/SSL and existing email-record precautions; backup/security, QA and rollback; and safer alternatives if shared hosting cannot support the stack. TECH360's internal agent workforce is never placed on a client's shared hosting. See [Domain and Hosting Delivery Playbook](DOMAIN_HOSTING_DELIVERY_PLAYBOOK.md).
6. Once discovery is complete, webchat sends a **non-binding preliminary solution proposal** and asks for client feedback. A client can approve the proposal direction or request revisions. This is not the final Scope of Work and is not a payment request.
7. After the client’s feedback, the team prepares a detailed Scope of Work for explicit review/approval. The existing project/payment gates remain in force: payment is requested only after final scope approval and authorized workflow steps.
8. Discounts or free SEO work are optional, human-reviewed offers. They are not promised unless the written approved proposal/scope states the exact deliverable and terms.

## Free Local SEO planner

Admin → **SEO & Local Discovery** contains the existing technical URL audit and a local SEO planner. The base planner is deterministic and uses no paid SEO-data API, map scraping, geocoding or automatic publication. It generates Bangla/English keyword clusters from the business’s actual services and areas, a Business Profile/Search Console checklist, content/page ideas, and measurement steps. The optional SEO & Discovery AI enhancement uses the configured agent provider and may have separate provider costs; it is off unless an operator enables it.

Location markers are advice only: a supplied real main address is identified for verification, and service areas are not represented as separate storefront pins. If no main address is supplied, no location is fabricated. Verify the real pin and eligibility in Google Business Profile before use.

The planner does not guarantee Maps placement, rankings, calls, leads or revenue. It avoids false addresses/branches, keyword-stuffed profiles, fake reviews, fabricated stock/prices and doorway pages. Domain, hosting, advertising, SMS and some integrations may still have costs even when the SEO work and Google’s eligible tools are free.
