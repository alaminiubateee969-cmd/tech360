// ------------------------------------------------------------
// Marketing idea -> multi-platform draft plan. Deterministic
// local builder: it produces review-ready drafts (prompts,
// platform copy, hashtags, video plan, WhatsApp reply) without
// inventing results, testimonials, or metrics. The API route may
// enhance copy with the content agent when a model is
// configured; drafts stay clearly labelled either way and a
// human approves before anything publishes.
// ------------------------------------------------------------
import type { SocialPlatform } from './platforms'

export interface MarketingIdeaInput {
  idea: string
  language?: 'EN' | 'BN' | 'BOTH'
  platforms?: SocialPlatform[]
  offer?: string
  audience?: string
}

export interface PlatformDraft {
  platform: SocialPlatform
  text: string
  hashtags: string[]
  mediaPrompt: string
  cta: string
}

export interface MarketingPlan {
  idea: string
  language: 'EN' | 'BN' | 'BOTH'
  headline: string
  angle: string
  imagePrompt: string
  videoPlan: { hook: string; shots: string[]; durationSec: number; aspect: '9:16' }
  drafts: PlatformDraft[]
  whatsappReply: string
  scheduleSuggestion: string
  source: 'local-draft'
}

const CTA_EN = 'Message us to get started today.'
const CTA_BN = 'শুরু করতে আজই আমাদের মেসেজ করুন।'

function hashtagsFor(idea: string): string[] {
  const words = idea.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3).slice(0, 3)
  const tags = ['#Tech360', '#DigitalGrowth', '#Automation', ...words.map((w) => `#${w.charAt(0).toUpperCase()}${w.slice(1)}`)]
  return [...new Set(tags)].slice(0, 8)
}

function shortForX(text: string, hashtags: string[]): string {
  const tags = hashtags.slice(0, 3).join(' ')
  const room = 280 - tags.length - 1
  const base = text.length <= room ? text : `${text.slice(0, Math.max(0, room - 1)).trimEnd()}…`
  return `${base} ${tags}`.trim()
}

export function buildMarketingPlan(input: MarketingIdeaInput): MarketingPlan {
  const idea = input.idea.trim()
  const language = input.language ?? 'EN'
  const platforms = input.platforms?.length ? input.platforms : (['FACEBOOK', 'INSTAGRAM', 'LINKEDIN', 'X'] as SocialPlatform[])
  const offer = input.offer?.trim()
  const audience = input.audience?.trim()
  const tags = hashtagsFor(idea)
  const bn = language !== 'EN'

  const headline = offer ? `${idea} — ${offer}` : idea
  const angle = audience
    ? `Built for ${audience}: show the problem, the simpler workflow, and one clear next step.`
    : 'Show the problem, the simpler workflow, and one clear next step. No unsupported claims.'

  const coreEn = `${headline}. ${angle} ${CTA_EN}`
  const coreBn = `${headline}। ${CTA_BN}`

  const draftFor = (platform: SocialPlatform): PlatformDraft => {
    switch (platform) {
      case 'FACEBOOK':
        return { platform, text: language === 'BN' ? coreBn : coreEn, hashtags: tags, mediaPrompt: `Facebook feed image (1:1 or 4:5): ${idea}, clean modern tech visuals, brand colours, space for headline text`, cta: CTA_EN }
      case 'INSTAGRAM':
        return { platform, text: language === 'BN' ? coreBn : coreEn, hashtags: tags, mediaPrompt: `Instagram reel cover + carousel (4:5): ${idea}, bold first slide with the hook, swipeable problem→solution frames`, cta: 'Save this post and DM us to start.' }
      case 'LINKEDIN':
        return { platform, text: `${headline}.\n\n${angle}\n\nWhat changes in practice:\n• Less manual follow-up\n• One place for the whole workflow\n• Clear reporting for decisions\n\n${CTA_EN}`, hashtags: tags.slice(0, 5), mediaPrompt: `LinkedIn image (1.91:1): professional workspace showing ${idea}, restrained corporate style`, cta: CTA_EN }
      case 'X':
        return { platform, text: shortForX(`${headline}. ${CTA_EN}`, tags), hashtags: [], mediaPrompt: `X image (16:9): single strong visual for ${idea}, minimal text`, cta: CTA_EN }
      case 'YOUTUBE':
        return { platform, text: `${headline} — full walkthrough. ${angle}`, hashtags: tags.slice(0, 5), mediaPrompt: `YouTube thumbnail (16:9): 3-word hook about ${idea}, high contrast, one face/object focus`, cta: 'Watch the full walkthrough and message us to start.' }
      case 'TIKTOK':
        return { platform, text: language === 'BN' ? coreBn : coreEn, hashtags: tags, mediaPrompt: `TikTok vertical video (9:16): hook in first 2 seconds about ${idea}, captions burned in`, cta: 'Follow for the next tip and DM to start.' }
    }
  }

  return {
    idea,
    language,
    headline,
    angle,
    imagePrompt: `Hero image prompt: ${idea} — modern digital workspace, people collaborating with dashboards, bright trustworthy lighting, photorealistic, no text artifacts, brand-safe`,
    videoPlan: {
      hook: `Stop doing this manually: ${idea}`,
      shots: [
        '0-3s HOOK: the manual pain point on screen with caption',
        `3-10s PROBLEM: show the old workflow for ${idea}`,
        '10-25s SOLUTION: the Tech360 workflow step by step (screen recording / b-roll)',
        '25-35s RESULT + CTA: dashboard overview and one clear next step',
      ],
      durationSec: 35,
      aspect: '9:16',
    },
    drafts: platforms.map(draftFor),
    whatsappReply: bn
      ? `ধন্যবাদ! "${idea}" সম্পর্কে বিস্তারিত পাঠাচ্ছি। কোন প্যাকেজটি দেখতে চান?`
      : `Thanks for asking! Here are the details on "${idea}". Would you like pricing or a quick demo first?`,
    scheduleSuggestion: 'Post the video first (Tue–Thu, 7–9 PM local), then the image post next day, then the LinkedIn version on a weekday morning. Review engagement after 48 hours before boosting.',
    source: 'local-draft',
  }
}
