// ------------------------------------------------------------
// Social publishing adapters — official platform APIs only.
// Every adapter is honest: missing credentials -> NOT_CONFIGURED,
// platform rejection -> FAILED with the platform's error, success
// only when the platform returns a post id. Nothing here ever
// claims "published" without API confirmation. fetch is
// injectable for unit tests.
// ------------------------------------------------------------
import { createHmac, randomUUID } from 'node:crypto'
import { platformStatus, type SocialPlatform } from './platforms'

export interface PublishInput {
  platform: SocialPlatform
  text: string
  mediaUrl?: string
}

export interface PublishResult {
  status: 'PUBLISHED' | 'NOT_CONFIGURED' | 'FAILED'
  externalId?: string
  externalUrl?: string
  error?: string
}

type FetchFn = typeof fetch
const GRAPH = 'https://graph.facebook.com/v21.0'

function oauth1Header(method: string, url: string, creds: { key: string; secret: string; token: string; tokenSecret: string }): string {
  const params: Record<string, string> = {
    oauth_consumer_key: creds.key,
    oauth_nonce: randomUUID().replace(/-/g, ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.token,
    oauth_version: '1.0',
  }
  const enc = (s: string) => encodeURIComponent(s).replace(/[!*'()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  const paramString = Object.keys(params).sort().map((k) => `${enc(k)}=${enc(params[k])}`).join('&')
  const base = [method.toUpperCase(), enc(url), enc(paramString)].join('&')
  const signingKey = `${enc(creds.secret)}&${enc(creds.tokenSecret)}`
  const signature = createHmac('sha1', signingKey).update(base).digest('base64')
  return `OAuth ${Object.entries({ ...params, oauth_signature: signature }).map(([k, v]) => `${enc(k)}="${enc(v)}"`).join(', ')}`
}

async function json(fetchFn: FetchFn, url: string, init: RequestInit): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetchFn(url, init)
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { ok: res.ok, status: res.status, data }
}

export async function publishPost(
  input: PublishInput,
  env: Record<string, string | undefined> = process.env,
  fetchFn: FetchFn = fetch,
): Promise<PublishResult> {
  const status = platformStatus(input.platform, env)
  if (status.state !== 'CONNECTED') {
    return { status: 'NOT_CONFIGURED', error: `Missing credentials: ${status.missingEnv.join(', ')}` }
  }
  try {
    switch (input.platform) {
      case 'FACEBOOK': {
        const pageId = env.META_PAGE_ID!
        const token = env.META_PAGE_ACCESS_TOKEN!
        const endpoint = input.mediaUrl ? `${GRAPH}/${pageId}/photos` : `${GRAPH}/${pageId}/feed`
        const body = input.mediaUrl
          ? { url: input.mediaUrl, caption: input.text, access_token: token }
          : { message: input.text, access_token: token }
        const r = await json(fetchFn, endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        const id = (r.data.id ?? r.data.post_id) as string | undefined
        if (!r.ok || !id) return { status: 'FAILED', error: `Facebook API ${r.status}: ${JSON.stringify(r.data.error ?? r.data).slice(0, 300)}` }
        return { status: 'PUBLISHED', externalId: String(id), externalUrl: `https://www.facebook.com/${id}` }
      }
      case 'INSTAGRAM': {
        if (!input.mediaUrl) return { status: 'FAILED', error: 'Instagram publishing requires a publicly reachable media URL' }
        const igId = env.INSTAGRAM_BUSINESS_ACCOUNT_ID!
        const token = env.META_PAGE_ACCESS_TOKEN!
        const isVideo = /\.(mp4|mov)(\?|$)/i.test(input.mediaUrl)
        const container = await json(fetchFn, `${GRAPH}/${igId}/media`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(isVideo
            ? { media_type: 'REELS', video_url: input.mediaUrl, caption: input.text, access_token: token }
            : { image_url: input.mediaUrl, caption: input.text, access_token: token }),
        })
        if (!container.ok || !container.data.id) return { status: 'FAILED', error: `Instagram container ${container.status}: ${JSON.stringify(container.data.error ?? container.data).slice(0, 300)}` }
        const publish = await json(fetchFn, `${GRAPH}/${igId}/media_publish`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creation_id: container.data.id, access_token: token }),
        })
        if (!publish.ok || !publish.data.id) return { status: 'FAILED', error: `Instagram publish ${publish.status}: ${JSON.stringify(publish.data.error ?? publish.data).slice(0, 300)}` }
        return { status: 'PUBLISHED', externalId: String(publish.data.id), externalUrl: `https://www.instagram.com/p/${publish.data.id}/` }
      }
      case 'LINKEDIN': {
        const org = env.LINKEDIN_ORGANIZATION_ID!
        const token = env.LINKEDIN_ACCESS_TOKEN!
        const r = await json(fetchFn, 'https://api.linkedin.com/v2/ugcPosts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Restli-Protocol-Version': '2.0.0' },
          body: JSON.stringify({
            author: `urn:li:organization:${org}`,
            lifecycleState: 'PUBLISHED',
            specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: input.text }, shareMediaCategory: 'NONE' } },
            visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
          }),
        })
        const id = r.data.id as string | undefined
        if (!r.ok || !id) return { status: 'FAILED', error: `LinkedIn API ${r.status}: ${JSON.stringify(r.data.message ?? r.data).slice(0, 300)}` }
        return { status: 'PUBLISHED', externalId: id, externalUrl: `https://www.linkedin.com/feed/update/${id}/` }
      }
      case 'X': {
        const url = 'https://api.twitter.com/2/tweets'
        const auth = oauth1Header('POST', url, { key: env.X_API_KEY!, secret: env.X_API_SECRET!, token: env.X_ACCESS_TOKEN!, tokenSecret: env.X_ACCESS_TOKEN_SECRET! })
        const r = await json(fetchFn, url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: auth },
          body: JSON.stringify({ text: input.text.slice(0, 280) }),
        })
        const data = r.data.data as { id?: string } | undefined
        if (!r.ok || !data?.id) return { status: 'FAILED', error: `X API ${r.status}: ${JSON.stringify(r.data.detail ?? r.data.title ?? r.data).slice(0, 300)}` }
        return { status: 'PUBLISHED', externalId: data.id, externalUrl: `https://x.com/i/web/status/${data.id}` }
      }
      default:
        return { status: 'NOT_CONFIGURED', error: `${input.platform} upload adapter requires verified OAuth upload credentials; draft kept, nothing claimed published` }
    }
  } catch (error) {
    return { status: 'FAILED', error: error instanceof Error ? error.message : 'Network error while publishing' }
  }
}

/** Read-only identity check used by "Verify connection". */
export async function verifyPlatform(
  platform: SocialPlatform,
  env: Record<string, string | undefined> = process.env,
  fetchFn: FetchFn = fetch,
): Promise<{ ok: boolean; detail: string }> {
  const status = platformStatus(platform, env)
  if (status.state !== 'CONNECTED') return { ok: false, detail: `Missing: ${status.missingEnv.join(', ')}` }
  try {
    switch (platform) {
      case 'FACEBOOK':
      case 'INSTAGRAM': {
        const r = await json(fetchFn, `${GRAPH}/${env.META_PAGE_ID}?fields=name,instagram_business_account&access_token=${env.META_PAGE_ACCESS_TOKEN}`, {})
        if (!r.ok) return { ok: false, detail: `Graph API ${r.status}` }
        return { ok: true, detail: `Page: ${String(r.data.name ?? env.META_PAGE_ID)}` }
      }
      case 'LINKEDIN': {
        const r = await json(fetchFn, `https://api.linkedin.com/v2/organizations/${env.LINKEDIN_ORGANIZATION_ID}`, { headers: { Authorization: `Bearer ${env.LINKEDIN_ACCESS_TOKEN}` } })
        return r.ok ? { ok: true, detail: `Organization: ${String((r.data.localizedName as string) ?? env.LINKEDIN_ORGANIZATION_ID)}` } : { ok: false, detail: `LinkedIn API ${r.status} (token may need re-authorization)` }
      }
      case 'X': {
        const url = 'https://api.twitter.com/2/users/me'
        const auth = oauth1Header('GET', url, { key: env.X_API_KEY!, secret: env.X_API_SECRET!, token: env.X_ACCESS_TOKEN!, tokenSecret: env.X_ACCESS_TOKEN_SECRET! })
        const r = await json(fetchFn, url, { headers: { Authorization: auth } })
        const data = r.data.data as { username?: string } | undefined
        return r.ok && data?.username ? { ok: true, detail: `@${data.username}` } : { ok: false, detail: `X API ${r.status}` }
      }
      default:
        return { ok: false, detail: `${platform} verification requires the platform upload OAuth flow; not yet verified` }
    }
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : 'Network error' }
  }
}
