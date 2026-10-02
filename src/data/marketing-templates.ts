// ============================================================
// Tech360 marketing kit — ready-to-edit templates for the admin team.
// Frameworks and principles adapted from coreyhaines31/marketingskills (MIT):
// lead with the reader's world, one idea per message, one low-friction ask,
// specific over vague, every follow-up adds something new.
// Copy below is original Tech360 wording. Placeholders use {{name}}.
// Compliance: outbound messages must respect the recipient's consent and the
// platform's approval gates; templates never promise results we can't verify.
// ============================================================

export type TemplateField = { key: string; label: string; placeholder: string; default?: string }

export type MarketingTemplate = {
  id: string
  category: 'Outreach' | 'WhatsApp & SMS' | 'Website copy' | 'Social' | 'Ads' | 'Retention' | 'SEO'
  title: string
  channel: 'Email' | 'WhatsApp' | 'SMS' | 'LinkedIn' | 'Facebook' | 'Web' | 'Meta Ads' | 'Search'
  framework: string
  when: string
  subject?: string
  body: string
}

export const COMMON_FIELDS: TemplateField[] = [
  { key: 'firstName', label: 'Recipient first name', placeholder: 'Rahim' },
  { key: 'businessName', label: 'Their business', placeholder: 'Rahim Fashion House' },
  { key: 'industry', label: 'Industry', placeholder: 'fashion retail' },
  { key: 'observation', label: 'Specific thing you noticed', placeholder: 'orders come in only through Facebook messages' },
  { key: 'painPoint', label: 'Problem it causes', placeholder: 'replies get missed after 9pm and sales are lost' },
  { key: 'result', label: 'Outcome we deliver', placeholder: 'a store with online checkout and automatic order confirmation' },
  { key: 'proof', label: 'Proof point (real only)', placeholder: 'a similar retailer we built for' },
  { key: 'link', label: 'Link', placeholder: 'https://bdtech360.com/#/contact' },
  { key: 'senderName', label: 'Your name', placeholder: 'Alamin', default: 'Team Tech360' },
]

export const MARKETING_TEMPLATES: MarketingTemplate[] = [
  {
    id: 'cold-email-observation',
    title: 'Cold email — first touch',
    category: 'Outreach', channel: 'Email', framework: 'Observation → Problem → Proof → Ask',
    when: 'First touch to a business whose public presence shows a clear gap.',
    subject: 'quick question, {{businessName}}',
    body: `Hi {{firstName}},

I noticed {{observation}}. For {{industry}} businesses that usually means {{painPoint}}.

We recently helped {{proof}} get {{result}}.

Worth a quick look? We can send an HTML preview of what it could look like for {{businessName}} before any payment.

{{senderName}}`,
  },
  {
    id: 'cold-email-followup-2',
    title: 'Cold email — follow-up #2',
    category: 'Outreach', channel: 'Email', framework: 'New angle (never “just checking in”)',
    when: '3–4 days after the first email with no reply. Add a fresh angle, not a nudge.',
    subject: 're: quick question, {{businessName}}',
    body: `{{firstName}} — one more thought. A lot of {{industry}} owners tell us the hardest part isn't the website, it's {{painPoint}}.

Here is a two-minute look at how we handle that: {{link}}

If it's not a priority right now, no problem at all.

{{senderName}}`,
  },
  {
    id: 'cold-email-breakup',
    title: 'Cold email — breakup',
    category: 'Outreach', channel: 'Email', framework: 'Breakup (last touch — honour it)',
    when: 'Final email in a sequence, about 7 days after the second follow-up.',
    subject: 'closing the loop',
    body: `Hi {{firstName}},

I'll stop here so I don't clutter your inbox. If {{painPoint}} becomes something you want solved, the HTML preview offer for {{businessName}} stands: {{link}}

All the best,
{{senderName}}`,
  },
  {
    id: 'whatsapp-first-touch',
    title: 'WhatsApp — first message',
    category: 'WhatsApp & SMS', channel: 'WhatsApp', framework: 'Context → value → one question',
    when: 'Only to people who contacted you or opted in. Keep under 400 characters.',
    body: `Assalamu alaikum {{firstName}}, this is {{senderName}} from Tech360. You asked about {{observation}}. We can show you {{result}} as a free HTML preview before you pay anything. Shall I send a short list of questions so we can start?`,
  },
  {
    id: 'sms-otp-notice',
    title: 'SMS — sign-in code (preview)',
    category: 'WhatsApp & SMS', channel: 'SMS', framework: 'Plain, no links, no urgency tricks',
    when: 'Preview of what clients receive when the portal sends a sign-in code (sent for real by the platform).',
    body: `Your Tech360 portal sign-in code is 123456. It expires in 10 minutes. Never share this code — Tech360 staff will never ask for it.`,
  },
  {
    id: 'landing-pas',
    title: 'Landing page hero (PAS)',
    category: 'Website copy', channel: 'Web', framework: 'Problem → Agitate → Solution (clarity over cleverness)',
    when: 'Hero + first section of a service landing page.',
    body: `# {{result}} — without paying until you've seen it

{{industry}} businesses lose customers when {{painPoint}}.

Every day that continues is revenue you don't get back.

Tech360 builds {{result}}. You review a working HTML preview first. Payment starts only after you approve it, and you receive the full source code after final payment.

[Start with a free preview →]({{link}})

**How it works:** 1. Tell us about {{businessName}} · 2. Approve the scope · 3. Review your preview · 4. Pay only when you're happy`,
  },
  {
    id: 'case-study',
    title: 'Case study page',
    category: 'Website copy', channel: 'Web', framework: 'Situation → Approach → Result (real numbers only)',
    when: 'After a client approves publishing their story. Never invent metrics.',
    body: `## {{businessName}}: {{result}}

**The situation.** {{businessName}} is a {{industry}} business. Before working with us, {{painPoint}}.

**What we built.** {{observation}} — so we designed and shipped {{result}}, previewed in HTML before any payment.

**The outcome.** [Add the real, measured result and the date range here.]

> "[Client quote, with written permission]" — {{firstName}}, {{businessName}}

[Talk to us about a similar project →]({{link}})`,
  },
  {
    id: 'linkedin-insight',
    title: 'LinkedIn insight post',
    category: 'Social', channel: 'LinkedIn', framework: 'Hook → insight → takeaway → soft CTA',
    when: 'Weekly authority post. One idea only.',
    body: `Most {{industry}} websites don't have a traffic problem. They have a "{{painPoint}}" problem.

Three things we check first:
1. Can a visitor take the next step in under 10 seconds?
2. Do we reply while the customer is still online?
3. Do we know which channel the sale came from?

If any answer is "not sure", start there — before redesigning anything.

(We build a free HTML preview before you pay. {{link}})`,
  },
  {
    id: 'facebook-offer',
    title: 'Facebook offer post',
    category: 'Social', channel: 'Facebook', framework: 'Offer + proof + single action',
    when: 'Facebook page or group post for local businesses.',
    body: `{{industry}} owners: still taking orders by inbox only?

We build {{result}} — and you see a working preview before you pay a taka.

Send us a message with the word PREVIEW and we'll reply with 5 quick questions.
{{link}}`,
  },
  {
    id: 'meta-ad',
    title: 'Meta ad set',
    category: 'Ads', channel: 'Meta Ads', framework: 'Hook → benefit → proof → CTA (3 headline variants)',
    when: 'Meta/Instagram ad copy. Test one variable at a time.',
    body: `Primary text:
{{painPoint}}? Get {{result}}. See a free HTML preview before you pay.

Headlines (test each):
- See your new site before you pay
- {{industry}} websites that take orders for you
- Preview first. Pay later.

Description: Free HTML preview · Source code after final payment
CTA button: Send Message
Link: {{link}}`,
  },
  {
    id: 'proposal-followup',
    title: 'Proposal follow-up',
    category: 'Retention', channel: 'Email', framework: 'Recap → remove friction → date',
    when: '2–3 days after sending a scope of work with no decision.',
    subject: 'your scope of work, {{businessName}}',
    body: `Hi {{firstName}},

Following up on the scope we sent for {{businessName}}. The goal: {{result}}.

If anything is unclear — price, timeline or what's included — reply with the question and I'll answer today. If it looks right, reply APPROVED and we'll prepare your preview.

{{senderName}}`,
  },
  {
    id: 'review-request',
    title: 'Review request',
    category: 'Retention', channel: 'Email', framework: 'Specific ask, easy path',
    when: 'After delivery is confirmed. Ask once; honour a no.',
    subject: 'how did we do, {{firstName}}?',
    body: `Hi {{firstName}},

It was a pleasure delivering {{result}} for {{businessName}}. If you have 2 minutes, a short honest review in your client portal helps other businesses decide: {{link}}

Thank you,
{{senderName}}`,
  },
  {
    id: 'referral-ask',
    title: 'Referral ask',
    category: 'Retention', channel: 'WhatsApp', framework: 'Gratitude → specific ask',
    when: 'Two to four weeks after delivery, to clients who were happy.',
    body: `Hi {{firstName}}, glad {{businessName}} is running well. If you know another {{industry}} owner struggling with {{painPoint}}, I'd be grateful for an introduction. You can also submit a referral from your portal: {{link}}`,
  },
  {
    id: 'seo-meta',
    title: 'SEO title + meta description',
    category: 'SEO', channel: 'Search', framework: 'Keyword first, benefit, CTA',
    when: 'Title and meta description for a service page. Check lengths in SEO Audit.',
    body: `Title (30–60 chars):
{{industry}} Website Development | Tech360

Meta description (70–160 chars):
Get {{result}}. See a free HTML preview before you pay. Source code delivered after final payment. Start with Tech360.

H1: {{industry}} websites that win customers online`,
  },
]

/** Replace {{key}} placeholders. Unknown/empty keys stay visible as [key] so nothing ships half-filled by accident. */
export function fillTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => (values[k]?.trim() ? values[k].trim() : `[${k}]`))
}

export function unfilledKeys(text: string, values: Record<string, string>): string[] {
  return Array.from(new Set(Array.from(text.matchAll(/\{\{(\w+)\}\}/g)).map((m) => m[1]))).filter((k) => !values[k]?.trim())
}
