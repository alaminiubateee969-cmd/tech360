// ------------------------------------------------------------
// Social platform connection definitions for the Marketing
// Dashboard (Super Admin). Connections use official OAuth / API
// tokens ONLY — never account passwords. That is deliberate:
// OAuth access tokens keep working after the owner changes the
// account password, and stop only if the app is revoked in the
// platform's settings. Secrets live in host environment
// variables; only their NAMES are known to this code, and status
// checks report presence/absence — never values.
// ------------------------------------------------------------

export type SocialPlatform = 'FACEBOOK' | 'INSTAGRAM' | 'LINKEDIN' | 'X' | 'YOUTUBE' | 'TIKTOK'

export interface PlatformDef {
  platform: SocialPlatform
  label: string
  developerPortal: string
  requiredEnv: string[]
  optionalEnv?: string[]
  permissions: string[]
  setupSteps: string[]
  postingNotes: string
}

export const PLATFORM_DEFS: PlatformDef[] = [
  {
    platform: 'FACEBOOK',
    label: 'Facebook Page',
    developerPortal: 'https://developers.facebook.com/apps/',
    requiredEnv: ['META_APP_ID', 'META_APP_SECRET', 'META_PAGE_ID', 'META_PAGE_ACCESS_TOKEN'],
    optionalEnv: ['META_BUSINESS_ID'],
    permissions: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'pages_messaging (only if Messenger automation is wanted)'],
    setupSteps: [
      'Meta for Developers → My Apps → Create App → type: Business.',
      'Add the Facebook Login / Graph API products and request the permissions listed here.',
      'Connect the company Facebook Page and generate a Page access token for that Page.',
      'Set META_PAGE_ID and META_PAGE_ACCESS_TOKEN in the HOST environment (never in chat, never in the repo).',
      'Use Verify here — the dashboard calls the Graph API and confirms the Page identity.',
    ],
    postingNotes: 'Publishes to the Page feed via the Graph API; add a public image URL to publish a photo post.',
  },
  {
    platform: 'INSTAGRAM',
    label: 'Instagram Business/Creator',
    developerPortal: 'https://developers.facebook.com/apps/',
    requiredEnv: ['META_APP_ID', 'META_APP_SECRET', 'META_PAGE_ID', 'META_PAGE_ACCESS_TOKEN', 'INSTAGRAM_BUSINESS_ACCOUNT_ID'],
    permissions: ['instagram_basic', 'instagram_content_publish', 'pages_show_list', 'pages_read_engagement'],
    setupSteps: [
      'Convert the Instagram account to Business or Creator and connect it to the company Facebook Page.',
      'In the same Meta app, request instagram_basic and instagram_content_publish.',
      'Find the Instagram Business Account ID via the connected Page (Graph API: /{page-id}?fields=instagram_business_account).',
      'Set INSTAGRAM_BUSINESS_ACCOUNT_ID plus the Meta variables in the HOST environment.',
      'Verify here, then publish with a public image/video URL (Instagram requires hosted media).',
    ],
    postingNotes: 'Two-step Graph API flow: create a media container, then publish it. Requires a publicly reachable media URL.',
  },
  {
    platform: 'LINKEDIN',
    label: 'LinkedIn Company Page',
    developerPortal: 'https://www.linkedin.com/developers/apps',
    requiredEnv: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'LINKEDIN_ORGANIZATION_ID', 'LINKEDIN_ACCESS_TOKEN'],
    permissions: ['Share on LinkedIn / Community Management API (approval required)', 'Marketing Developer Platform (only for ads)'],
    setupSteps: [
      'LinkedIn Developer Portal → Create app and associate it with the Company Page.',
      'Products tab: request Community Management API / Share on LinkedIn and wait for LinkedIn approval.',
      'Complete OAuth 2.0 as a Page admin and obtain a user access token with organization posting scope.',
      'Set the LINKEDIN_* variables, including the numeric organization ID, in the HOST environment.',
      'Verify here — approval by LinkedIn is a gatekeeper step and can take time.',
    ],
    postingNotes: 'Publishes a text/image post to the organization via the LinkedIn posts API.',
  },
  {
    platform: 'X',
    label: 'X (Twitter)',
    developerPortal: 'https://developer.x.com/en/portal/dashboard',
    requiredEnv: ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET'],
    optionalEnv: ['X_BEARER_TOKEN', 'X_CLIENT_ID', 'X_CLIENT_SECRET'],
    permissions: ['App permissions: Read and Write', 'OAuth 1.0a user context for posting'],
    setupSteps: [
      'X Developer Console → create a Project and App.',
      'Set app permissions to Read and Write, then regenerate the user Access Token + Secret.',
      'Set the four X_* credential variables in the HOST environment.',
      'Verify here — the dashboard checks the authenticated account identity.',
    ],
    postingNotes: 'Posts via the X API v2 tweets endpoint signed with OAuth 1.0a user context (280-character limit enforced in drafts).',
  },
  {
    platform: 'YOUTUBE',
    label: 'YouTube',
    developerPortal: 'https://console.cloud.google.com/apis/credentials',
    requiredEnv: ['YOUTUBE_ACCESS_TOKEN', 'YOUTUBE_CHANNEL_ID'],
    permissions: ['youtube.upload (OAuth consent as the channel owner)'],
    setupSteps: [
      'Google Cloud Console → enable YouTube Data API v3 → OAuth client.',
      'Authorize as the channel owner and store the resulting access token on the host.',
      'Video publishing is queued through Media Studio renders; metadata drafts are prepared here.',
    ],
    postingNotes: 'Upload adapter is credential-gated; until verified, posts stay NOT_CONFIGURED and nothing is claimed uploaded.',
  },
  {
    platform: 'TIKTOK',
    label: 'TikTok',
    developerPortal: 'https://developers.tiktok.com/',
    requiredEnv: ['TIKTOK_ACCESS_TOKEN', 'TIKTOK_OPEN_ID'],
    permissions: ['video.publish (Content Posting API, app review required)'],
    setupSteps: [
      'TikTok for Developers → create app → request Content Posting API access and pass review.',
      'Authorize the company account and store the access token on the host.',
    ],
    postingNotes: 'Posting adapter is credential-gated; until verified, posts stay NOT_CONFIGURED and nothing is claimed posted.',
  },
]

export type ConnectionState = 'CONNECTED' | 'NOT_CONFIGURED' | 'PARTIAL'

export interface PlatformStatus {
  platform: SocialPlatform
  label: string
  state: ConnectionState
  presentEnv: string[]
  missingEnv: string[]
  developerPortal: string
  permissions: string[]
  setupSteps: string[]
  postingNotes: string
}

/** Presence-only credential check. Values are never read into
 *  responses, logs, or the database. */
export function platformStatus(platform: SocialPlatform, env: Record<string, string | undefined> = process.env): PlatformStatus {
  const def = PLATFORM_DEFS.find((d) => d.platform === platform)!
  const presentEnv = def.requiredEnv.filter((k) => Boolean(env[k]?.trim()))
  const missingEnv = def.requiredEnv.filter((k) => !env[k]?.trim())
  return {
    platform,
    label: def.label,
    state: missingEnv.length === 0 ? 'CONNECTED' : presentEnv.length === 0 ? 'NOT_CONFIGURED' : 'PARTIAL',
    presentEnv,
    missingEnv,
    developerPortal: def.developerPortal,
    permissions: def.permissions,
    setupSteps: def.setupSteps,
    postingNotes: def.postingNotes,
  }
}

export function allPlatformStatuses(env: Record<string, string | undefined> = process.env): PlatformStatus[] {
  return PLATFORM_DEFS.map((d) => platformStatus(d.platform, env))
}

/** The answer to "will posting survive a password change?" —
 *  shown in the dashboard so the owner understands the design. */
export const OAUTH_CONTINUITY_NOTE =
  'Accounts connect with official OAuth/API tokens, never passwords. Changing an account password does NOT break posting; tokens stop only if the app is revoked inside the platform, the token itself expires (Meta long-lived/LinkedIn tokens need periodic re-authorization), or the platform suspends the app. If that happens the dashboard shows the account as failed verification — reconnect by generating a fresh token on the host, never by sharing a password.'
