/**
 * Deterministic output screen for AI-written customer replies.
 *
 * The prompt tells the model not to quote prices, confirm payments, approve
 * refunds or contracts, release source code, or claim work is complete. A
 * prompt is not a control, so a reply that asserts any of these is withheld and
 * the visitor gets the honest human-escalation fallback instead.
 *
 * The patterns are intentionally narrow: ordinary wording such as "we will
 * prepare a quote after review" must pass. A withheld reply is logged by reason
 * category only, never by text.
 */

export type AiReplyGuardReason =
  | 'PRICE_QUOTE'
  | 'PAYMENT_CONFIRMATION'
  | 'REFUND_DECISION'
  | 'CONTRACT_APPROVAL'
  | 'SOURCE_CODE_RELEASE'
  | 'COMPLETION_CLAIM'

const RULES: Array<{ reason: AiReplyGuardReason; pattern: RegExp }> = [
  // Currency symbol or code followed by an amount: "$500", "USD 1,200", "BDT 50000", "৳ 20,000", "Tk 5000".
  { reason: 'PRICE_QUOTE', pattern: /(?:\$|৳|\b(?:USD|BDT|Tk\.?)\s?)\s?\d[\d,.]*/i },
  { reason: 'PRICE_QUOTE', pattern: /\b\d[\d,.]*\s?(?:USD|BDT|taka|dollars)\b/i },
  { reason: 'PAYMENT_CONFIRMATION', pattern: /\b(?:payment|invoice|deposit|transaction)\b[^.!?\n]{0,40}\b(?:has been|have been|is|was|were)\s+(?:confirmed|received|verified|processed|completed|cleared)\b/i },
  { reason: 'REFUND_DECISION', pattern: /\brefund\w*\b[^.!?\n]{0,40}\b(?:approved|issued|processed|granted|will be (?:issued|processed|paid))\b/i },
  { reason: 'CONTRACT_APPROVAL', pattern: /\b(?:contract|scope(?: of work)?|sow|proposal)\b[^.!?\n]{0,40}\b(?:is|has been|was|have been)\s+(?:approved|signed|accepted|finalised|finalized)\b/i },
  { reason: 'SOURCE_CODE_RELEASE', pattern: /\bsource code\b[^.!?\n]{0,40}\b(?:released|sent|attached|shared|provided|delivered|handed over)\b/i },
  { reason: 'COMPLETION_CLAIM', pattern: /\b(?:project|website|system|app|platform)\b[^.!?\n]{0,30}\b(?:is|has been|was)\s+(?:completed|delivered|launched|live now|finished)\b/i },
]

export function screenAiReply(text: string): { ok: true } | { ok: false; reason: AiReplyGuardReason } {
  for (const rule of RULES) {
    if (rule.pattern.test(text)) return { ok: false, reason: rule.reason }
  }
  return { ok: true }
}
