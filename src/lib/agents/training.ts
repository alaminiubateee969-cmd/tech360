// ------------------------------------------------------------
// Agent TRAINING curriculum — internal only (never public; see
// docs/AI_VISIBILITY_POLICY.md).
//
// Owner order: we already have our own agents/employees. Every
// external reference the owner supplied is a BACKUP training
// source: agents study the pattern, fill their own gaps against
// it, and each department climbs a 3-month maturity roadmap.
//
// Honesty rules:
//  - "Learning" here = knowledge ingestion (Knowledge Base),
//    memory, prompt/tool refinement and evaluated executions.
//    It is NOT weights fine-tuning; a fine-tune is a Month-3
//    decision gate requiring a dataset + provider budget.
//  - Progress is computed from EVIDENCE (execution records,
//    approved knowledge, memory), never from the calendar.
//  - A department is "AI MODEL" grade only when its agents pass
//    the Month-3 exit criteria below on real executions.
// ------------------------------------------------------------

export interface TrainingSource {
  name: string
  url: string
  /** Pattern the agents take from this source. */
  teaches: string
}

export interface MonthPlan {
  month: 1 | 2 | 3
  title: string
  focus: string
  exitCriteria: string
}

export interface LearningTrack {
  category: string
  /** Skills this category must hold (discrete skill entities). */
  skills: string[]
  /** Known gaps the training closes (from docs/AI_WORKFORCE_AUDIT.md). */
  gaps: string[]
  sources: TrainingSource[]
  months: MonthPlan[]
}

const M = (month: 1 | 2 | 3, title: string, focus: string, exitCriteria: string): MonthPlan => ({ month, title, focus, exitCriteria })

const COMMON_MONTHS: MonthPlan[] = [
  M(1, 'Learn', 'Ingest the track sources into the Knowledge Base (scan → classify → approve), distil them into agent memory + prompt notes, run supervised executions on real work.', 'Sources approved in Knowledge; ≥10 recorded executions per agent with reviewed outputs.'),
  M(2, 'Practice & fill gaps', 'Target the listed gaps with tool grants, workflow definitions (n8n) and failure review; every failed execution gets a recorded cause and a prompt/tool fix.', '≥30 executions per agent; success rate ≥80%; zero unresolved repeat failures.'),
  M(3, 'Operate & qualify', 'Agents run the department pipeline end-to-end under approval gates; Super Admin/Admin audits a sample and signs the qualification (or orders a fine-tune decision with real execution data).', '≥50 executions; success ≥90%; audit sample passed; privileged actions still approval-gated.'),
]

const S = (name: string, url: string, teaches: string): TrainingSource => ({ name, url, teaches })

export const LEARNING_TRACKS: LearningTrack[] = [
  {
    category: 'EXECUTIVE',
    skills: ['executive-synthesis', 'daily-reporting', 'decision-escalation', 'governance-oversight'],
    gaps: ['No discrete skill records (audit: Skills PARTIAL)', 'Cross-department priority arbitration is prompt-only'],
    sources: [
      S('MetaGPT (FoundationAgents)', 'https://github.com/FoundationAgents/MetaGPT', 'Multi-agent software-company structure: roles, SOPs, handoffs between agents'),
      S('ruflo (ruvnet)', 'https://github.com/ruvnet/ruflo', 'Autonomous operations loop with heartbeat and action evidence'),
      S('timesfm (google-research)', 'https://github.com/google-research/timesfm', 'Time-series forecasting pattern for pipeline/revenue outlooks'),
    ],
    months: COMMON_MONTHS,
  },
  {
    category: 'REVENUE',
    skills: ['lead-intake-extraction', 'business-classification', 'plan-recommendation', 'scope-questioning', 'proposal-drafting', 'crm-hygiene', 'follow-up-sequencing'],
    gaps: ['Lead scoring calibration is heuristic', 'No per-source conversion feedback loop'],
    sources: [
      S('Twenty CRM', 'https://github.com/twentyhq/twenty', 'Modern CRM object model, pipeline views, activity timeline'),
      S('Frappe CRM', 'https://github.com/frappe/crm', 'Lead-to-deal lifecycle and assignment discipline'),
      S('wacrm (ArnasDon)', 'https://github.com/ArnasDon/wacrm', 'WhatsApp-first CRM conversation handling'),
      S('Ai-Markting-crm (owner)', 'https://github.com/engralaminn-collab/Ai-Markting-crm', 'AI marketing CRM campaign patterns (owner project, backup)'),
      S('market-intelligence-radar (guifav)', 'https://github.com/guifav/market-intelligence-radar', 'Research dossier shape: fit, budget, risks, priority'),
      S('OpenProspector (clawnify)', 'https://github.com/clawnify/OpenProspector', 'Outbound prospecting and follow-up recommendations'),
    ],
    months: COMMON_MONTHS,
  },
  {
    category: 'DELIVERY',
    skills: ['requirements-engineering', 'project-planning', 'qa-planning', 'preview-generation', 'handover-preparation', 'client-training-material'],
    gaps: ['Generated-app QA is blueprint-level, not browser-verified per app', 'Effort estimation lacks historical calibration data'],
    sources: [
      S('MetaGPT (FoundationAgents)', 'https://github.com/FoundationAgents/MetaGPT', 'SOP-driven delivery: PRD → design → tasks → code → QA'),
      S('ToolJet', 'https://github.com/ToolJet/ToolJet', 'Internal-tool generation platform patterns (admin surfaces clients ask for)'),
      S('archify (tt-a1i)', 'https://github.com/tt-a1i/archify', 'Architecture diagram generation discipline'),
      S('Hatchable', 'https://hatchable.com', 'Model/platform separation: generated app + real DB/auth/hosting expectations'),
    ],
    months: COMMON_MONTHS,
  },
  {
    category: 'TECHNOLOGY',
    skills: ['architecture-review', 'integration-design', 'security-scan', 'deployment-planning', 'observability'],
    gaps: ['No live external uptime evidence inside the platform', 'Secrets handling depends on operator discipline'],
    sources: [
      S('omarchy (omacom)', 'https://github.com/omacom/omarchy', 'Declarative, reproducible environment setup'),
      S('Vaultwarden (dani-garcia)', 'https://github.com/dani-garcia/vaultwarden', 'Self-hosted secrets handling expectations (pattern only)'),
      S('Nextcloud server', 'https://github.com/nextcloud/server', 'Files, sharing and access-control at scale'),
      S('HetrixTools', 'https://hetrixtools.com', 'External uptime/blacklist monitoring (free tier, operator add-on)'),
      S('bugcrowd_university', 'https://github.com/bugcrowd/bugcrowd_university', 'Security practice curriculum for review checklists'),
    ],
    months: COMMON_MONTHS,
  },
  {
    category: 'CONTENT',
    skills: ['content-drafting', 'brand-voice-review', 'seo-audit', 'marketing-kit-generation', 'video-shot-planning', 'captioning', 'newsletter-production'],
    gaps: ['No real media rendering (plans only, RENDER_NOT_CONFIGURED)', 'Image/music generation is provider-gated'],
    sources: [
      S('marketingskills (coreyhaines31)', 'https://github.com/coreyhaines31/marketingskills', 'Marketing kit structures: briefs, campaigns, calendars'),
      S('humanizer (blader)', 'https://github.com/blader/humanizer', 'Human-sounding rewrite pass with brand rules'),
      S('open-seo (every-app)', 'https://github.com/every-app/open-seo', 'Deterministic on-page/technical SEO checks'),
      S('diagram-design (cathrynlavery)', 'https://github.com/cathrynlavery/diagram-design', 'Diagram + button design tokens (also live in #/design-kit)'),
      S('MoneyPrinterTurbo (harry0703)', 'https://github.com/harry0703/MoneyPrinterTurbo', 'Topic → shots → narration → captions video pipeline shape'),
      S('VideoCaptioner (WEIFENG2333)', 'https://github.com/WEIFENG2333/VideoCaptioner', 'Subtitle/caption generation workflow'),
      S('gpt4o-image-prompts (songguoxs)', 'https://github.com/songguoxs/gpt4o-image-prompts', 'Image prompt library for media briefs'),
      S('Mureka', 'https://www.mureka.ai', 'Music generation provider pattern (brief until keyed)'),
      S('Buffer', 'https://buffer.com', 'Social scheduling: draft → approve → publish queue'),
    ],
    months: COMMON_MONTHS,
  },
  {
    category: 'OPERATIONS',
    skills: ['workflow-automation', 'feed-ingestion', 'ops-loop-triage', 'memory-curation', 'knowledge-indexing'],
    gaps: ['Memory has no automatic forgetting/consolidation policy', 'Feed-to-content conversion is manual'],
    sources: [
      S('ai-memory (akitaonrails)', 'https://github.com/akitaonrails/ai-memory', 'Scoped persistent memory: company / agent / client'),
      S('llm_wiki (nashsu)', 'https://github.com/nashsu/llm_wiki', 'Knowledge documents with classification before indexing'),
      S('RSSHub (DIYgod)', 'https://github.com/DIYgod/RSSHub', 'Feed source coverage and parsing edge cases'),
      S('docGPT-langchain (Lin-jun-xiang)', 'https://github.com/Lin-jun-xiang/docGPT-langchain', 'Chat-with-documents retrieval shape (PDF/Word/CSV/TXT)'),
      S('context-mode (mksglu)', 'https://github.com/mksglu/context-mode', 'Context budget + per-agent tool grant discipline'),
      S('siyuan (siyuan-note)', 'https://github.com/siyuan-note/siyuan', 'Block-level knowledge organisation (pattern; editor not shipped)'),
    ],
    months: COMMON_MONTHS,
  },
  {
    category: 'GOVERNANCE',
    skills: ['approval-adjudication', 'policy-enforcement', 'audit-review', 'risk-escalation', 'verification'],
    gaps: ['Verification is single-pass (no independent second reviewer on outputs)', 'Agent version/cost records are not formalised'],
    sources: [
      S('Refine', 'https://www.refine.ink', 'Verify-before-trust: multiple reviewers + deterministic checkers'),
      S('ai-workforce-policy (internal)', 'https://github.com/engralaminn-collab/tech360', 'Least-privilege tools, tenant isolation, approval gates (this repo)'),
      S('scientific-agent-skills (K-Dense-AI)', 'https://github.com/K-Dense-AI/scientific-agent-skills', 'Skill packaging format for specialist agent capabilities'),
    ],
    months: COMMON_MONTHS,
  },
  {
    category: 'SUPPORT',
    skills: ['conversation-triage', 'client-communication', 'review-requests', 'referral-requests', 'meeting-scheduling'],
    gaps: ['Voice-note intake is not transcribed', 'Multilingual quality is unmeasured'],
    sources: [
      S('Chatwoot', 'https://github.com/chatwoot/chatwoot', 'Shared inbox discipline: assignment, status, conversation history'),
      S('DeskcommCRM (melgarafael)', 'https://github.com/melgarafael/DeskcommCRM', 'Communication-centric CRM record keeping'),
      S('httpsms (NdoleStudio)', 'https://github.com/NdoleStudio/httpsms', 'Phone-as-SMS-gateway pattern for the Calls & SMS centre'),
      S('AiPraktor', 'https://www.aipraktor.com', 'Bengali-first Messenger/WhatsApp commerce conversation flow'),
      S('LiveTalk (GAIR-NLP)', 'https://github.com/GAIR-NLP/LiveTalk', 'Real-time talk interaction patterns (research backup)'),
    ],
    months: COMMON_MONTHS,
  },
]

export type Maturity = 'FOUNDATION' | 'OPERATIONAL' | 'AI_MODEL_QUALIFIED'

/** Evidence-based maturity — never calendar-based. */
export function maturityFor(evidence: { executions: number; successRate: number }): Maturity {
  if (evidence.executions >= 50 && evidence.successRate >= 0.9) return 'AI_MODEL_QUALIFIED'
  if (evidence.executions >= 10 && evidence.successRate >= 0.8) return 'OPERATIONAL'
  return 'FOUNDATION'
}

export function trackForCategory(category: string | null | undefined): LearningTrack {
  return (
    LEARNING_TRACKS.find((t) => t.category === (category ?? '').toUpperCase()) ??
    LEARNING_TRACKS.find((t) => t.category === 'OPERATIONS')!
  )
}

export const TRAINING_SOURCE_COUNT = LEARNING_TRACKS.reduce((n, t) => n + t.sources.length, 0)
