# Marketing Dashboard (Super Admin)

One place inside the Super Admin dashboard: **idea → prompts, image
brief, video plan, per-platform drafts → approve → publish** to
Facebook, Instagram, LinkedIn, X (YouTube/TikTok adapters are
credential-gated). Files: `src/lib/social/` (platforms, plan,
publish), `src/app/api/admin/marketing/`, `MarketingDashboardView`.

## The connection design (why passwords are never used)

The owner asked for an agent that logs in with account credentials,
configures everything, and keeps working after passwords change.
Storing or using **passwords is unsafe and unnecessary** — the
correct equivalent, implemented here:

- Each platform connects with its **official OAuth/API tokens**
  (Meta Page token, LinkedIn OAuth token, X OAuth 1.0a user tokens).
- OAuth tokens **do not break when the account password changes**.
  They stop only if the app is revoked in the platform, a token
  expires (LinkedIn/Meta long-lived tokens need periodic
  re-authorization, which Verify detects), or the platform suspends
  the app.
- Secrets live **only in the host environment** (see
  `.env.example`). The dashboard reads presence, never values;
  `SocialAccount` records env-var *names*, verification state, and
  the last error — no secret is stored in the database, the repo,
  or chat. **Never send passwords/tokens in chat.**

## Getting the credentials (owner, once per platform)

- **Facebook:** developers.facebook.com → My Apps → Create App
  (Business) → request `pages_show_list`, `pages_read_engagement`,
  `pages_manage_posts` (+ `pages_messaging` only for Messenger
  automation) → Page access token for the company Page.
  Set `META_APP_ID`, `META_APP_SECRET`, `META_PAGE_ID`,
  `META_PAGE_ACCESS_TOKEN` (+ optional `META_BUSINESS_ID`).
- **Instagram:** account must be Business/Creator and linked to the
  Page; add `instagram_basic`, `instagram_content_publish`; set
  `INSTAGRAM_BUSINESS_ACCOUNT_ID`. Publishing needs a public media
  URL (two-step container → publish, implemented).
- **LinkedIn:** linkedin.com/developers → app + Company Page →
  Products: Community Management API / Share on LinkedIn (**LinkedIn
  approval is a real gate and can take time**) → OAuth as Page admin.
  Set `LINKEDIN_CLIENT_ID/SECRET`, `LINKEDIN_ORGANIZATION_ID`,
  `LINKEDIN_ACCESS_TOKEN`.
- **X:** developer.x.com → Project/App → permissions Read and Write
  → regenerate user tokens. Set `X_API_KEY`, `X_API_SECRET`,
  `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` (+ optional bearer/OAuth2).

Then open **Super Admin → Growth → Marketing Dashboard** and press
**Verify** on each card — it calls the real platform API and shows
the connected Page/account or the exact failure.

## Daily flow

1. Type the idea (e.g. "Create 7 posts for CRM automation"), pick
   platforms + language (EN/Bangla/both), Generate.
2. The system creates a Campaign + marketing kit + image prompt +
   video plan (Content Studio assets) and one DRAFT `SocialPost` per
   platform. When a content model is configured, copy is
   agent-enhanced and the response says so; otherwise the local
   draft is used and labelled — never disguised.
3. Produce media in Media Studio, paste the public media URL
   (required for Instagram), **Approve**, then **Publish now**.
4. The result recorded is exactly the platform's answer: PUBLISHED
   with post ID/URL, FAILED with the platform error, or
   NOT_CONFIGURED when credentials are missing. Nothing is ever
   fake-published; the Beacon-S publishing agent (`PUB-035`,
   approval-required) follows the same rule.

## Honest limits

- YouTube/TikTok: draft + credential scaffolding ready; upload
  adapters stay NOT_CONFIGURED until their OAuth upload review/flow
  is completed on the host.
- Analytics and comment/reply automation: inbound replies already
  arrive via `/api/webhooks/social` (SOC-014 triage); outbound
  analytics dashboards are a follow-up, not claimed here.
- Requires the `SocialAccount`/`SocialPost` migration to be applied
  on the production MySQL host (`npm run db:migrate` in the deploy
  pipeline) and the env vars above before first use.
