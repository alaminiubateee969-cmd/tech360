# TECH360 Visual, Video & 3D Asset Manifest

This manifest documents the production visual assets, ambient video media, and interactive 3D architecture components integrated across the TECH360 platform (`https://bdtech360.com`).

Verification command:
```bash
npm run check:assets
```

---

## 1. Interactive 3D & Video Hero Assets

| Asset / Component | Path | Format | Dimensions / Duration | Creation / Source | License / Ownership | Optimization | Pages Used |
|---|---|---|---|---|---|---|---|
| Homepage Ambient Hero Video | `/public/videos/hero.mp4` | MP4 (H.264) | 1920×1080 (loop, muted) | First-party TECH360 motion reel | TECH360 LLC Owned | `preload="metadata"`, `muted`, `playsInline`, paused on `prefers-reduced-motion: reduce` | `/` (`HomeView.tsx`) |
| Homepage Video Poster | `/public/videos/hero-poster.jpg` | JPEG | 1920×1080 | First-party TECH360 still frame | TECH360 LLC Owned | Compressed JPEG poster fallback | `/` (`HomeView.tsx`) |
| 3D Global Ecosystem & Digital Globe (`Hero3dArchitectureShowcase`) | `src/components/site/HomeView.tsx` | CSS 3D (`perspective: 1100px`, `preserve-3d`) + SVG Wireframe Globe | Responsive vector & 4-layer Z-depth stack | First-party engineered component | TECH360 LLC Owned | GPU-composited transforms, zero external WebGL bundle weight, reduced-motion safe | `/` (`HomeView.tsx`) |

---

## 2. Service Visual Library (21 Services — 1600×1000 WebP)

| Service Slug | Asset Path | Format | Dimensions | Source / Method | License / Ownership | Optimization | Pages Used |
|---|---|---|---|---|---|---|---|
| `ai-agent-systems` | `/images/services/ai-agent-systems.webp` | WebP | 1600×1000 | First-party generated & curated | TECH360 LLC Owned | Lossy/lossless WebP, `loading="lazy"` | `/`, `/services`, `/services/ai-agent-systems` |
| `ai-business-automation` | `/images/services/ai-business-automation.webp` | WebP | 1600×1000 | First-party generated & curated | TECH360 LLC Owned | WebP 1600×1000, `loading="lazy"` | `/`, `/services`, `/services/ai-business-automation` |
| `whatsapp-ai-sales-crm` | `/images/services/whatsapp-ai-sales-crm.webp` | WebP | 1600×1000 | First-party generated & curated | TECH360 LLC Owned | WebP 1600×1000, `loading="lazy"` | `/`, `/services`, `/services/whatsapp-ai-sales-crm` |
| `ecommerce-platforms` | `/images/services/ecommerce-platforms.webp` | WebP | 1600×1000 | First-party generated & curated | TECH360 LLC Owned | WebP 1600×1000, `loading="lazy"` | `/`, `/services`, `/services/ecommerce-platforms` |
| `client-portals` | `/images/services/client-portals.webp` | WebP | 1600×1000 | First-party generated & curated | TECH360 LLC Owned | WebP 1600×1000, `loading="lazy"` | `/`, `/services`, `/services/client-portals` |
| `business-dashboards` | `/images/services/business-dashboards.webp` | WebP | 1600×1000 | First-party generated & curated | TECH360 LLC Owned | WebP 1600×1000, `loading="lazy"` | `/`, `/services`, `/services/business-dashboards` |
| `custom-software-development` | `/images/services/custom-software-development.webp` | WebP | 1600×1000 | First-party generated & curated | TECH360 LLC Owned | WebP 1600×1000, `loading="lazy"` | `/`, `/services`, `/services/custom-software-development` |
| `database-systems` | `/images/services/database-systems.webp` | WebP | 1600×1000 | First-party generated & curated | TECH360 LLC Owned | WebP 1600×1000, `loading="lazy"` | `/services`, `/services/database-systems` |
| `custom-crm-development` | `/images/services/custom-crm-development.webp` | WebP | 1600×1000 | First-party generated & curated | TECH360 LLC Owned | WebP 1600×1000, `loading="lazy"` | `/`, `/services`, `/services/custom-crm-development` |
| `whatsapp-automation` | `/images/services/whatsapp-automation.webp` | WebP | 1600×1000 | First-party generated & curated | TECH360 LLC Owned | WebP 1600×1000, `loading="lazy"` | `/services`, `/services/whatsapp-automation` |
| `whatsapp-cloud-api-integration` | `/images/services/whatsapp-cloud-api-integration.webp` | WebP | 1600×1000 | First-party generated & curated | TECH360 LLC Owned | WebP 1600×1000, `loading="lazy"` | `/services`, `/services/whatsapp-cloud-api-integration` |
| `omnichannel-messaging-systems` | `/images/services/omnichannel-messaging-systems.webp` | WebP | 1600×1000 | First-party generated & curated | TECH360 LLC Owned | WebP 1600×1000, `loading="lazy"` | `/services`, `/services/omnichannel-messaging-systems` |
| `lead-capture-automation` | `/images/services/lead-capture-automation.webp` | WebP | 1600×1000 | First-party generated & curated | TECH360 LLC Owned | WebP 1600×1000, `loading="lazy"` | `/services`, `/services/lead-capture-automation` |
| `email-automation-systems` | `/images/services/email-automation-systems.webp` | WebP | 1600×1000 | First-party generated & curated | TECH360 LLC Owned | WebP 1600×1000, `loading="lazy"` | `/services`, `/services/email-automation-systems` |
| `sms-automation-systems` | `/images/services/sms-automation-systems.webp` | WebP | 1600×1000 | First-party generated & curated | TECH360 LLC Owned | WebP 1600×1000, `loading="lazy"` | `/services`, `/services/sms-automation-systems` |
| `payment-gateway-integration` | `/images/services/payment-gateway-integration.webp` | WebP | 1600×1000 | First-party generated & curated | TECH360 LLC Owned | WebP 1600×1000, `loading="lazy"` | `/services`, `/services/payment-gateway-integration` |
| `api-development-integration` | `/images/services/api-development-integration.webp` | WebP | 1600×1000 | First-party generated & curated | TECH360 LLC Owned | WebP 1600×1000, `loading="lazy"` | `/services`, `/services/api-development-integration` |
| `cloud-hosting-deployment` | `/images/services/cloud-hosting-deployment.webp` | WebP | 1600×1000 | First-party generated & curated | TECH360 LLC Owned | WebP 1600×1000, `loading="lazy"` | `/services`, `/services/cloud-hosting-deployment` |
| `website-optimization` | `/images/services/website-optimization.webp` | WebP | 1600×1000 | First-party generated & curated | TECH360 LLC Owned | WebP 1600×1000, `loading="lazy"` | `/services`, `/services/website-optimization` |
| `technical-seo` | `/images/services/technical-seo.webp` | WebP | 1600×1000 | First-party generated & curated | TECH360 LLC Owned | WebP 1600×1000, `loading="lazy"` | `/services`, `/services/technical-seo` |
| `maintenance-support` | `/images/services/maintenance-support.webp` | WebP | 1600×1000 | First-party generated & curated | TECH360 LLC Owned | WebP 1600×1000, `loading="lazy"` | `/services`, `/services/maintenance-support` |

---

## 3. Connected Platform & Blueprint Visuals (1600×1000 WebP)

- **Platform Modules (6 assets)**: `/images/platform/crm-pipeline.webp`, `/images/platform/client-portal.webp`, `/images/platform/ai-workforce.webp`, `/images/platform/omnichannel-inbox.webp`, `/images/platform/billing-governance.webp`, `/images/platform/executive-analytics.webp` — used on `/` and `/platform`.
- **Delivery Blueprints (8 assets)**: `/images/blueprints/*` — used on `/` (`SelectedWork`) and `/work/case-studies`.
- **Sector Operating Systems (6 assets)**: `/images/systems/*` — used on `/platform` (`PRODUCED_SYSTEMS`).
- **Showcase Projects (12 assets)**: `/images/work/*` — used on `/work`, `/work/projects`, and `/work/projects/[slug]`.
- **Industry Hero Photographs (20 assets)**: `/images/industries/*` — verified across all 20 industry routes (`/industries/[slug]`).

## 4. Portfolio Media System (Work section — added 2026-11-18)

Single source of truth: `src/data/portfolio.ts` (20 entries = 12 system scenarios + 8 delivery blueprints).
Every image and video carries a `provenance` value that is rendered as a visible badge and explained by
`EvidenceLegend` on `/work`:

| Provenance | Meaning | Used by |
|---|---|---|
| `concept-artwork` | Original AI-generated scene for illustration. Not a client photo or product screenshot. | 8 blueprint covers, 12 system renders |
| `architecture-diagram` | TECH360-drawn system diagram. | 8 blueprint diagrams (gallery image 2) |
| `motion-preview` | Silent explainer assembled from the artwork + published workflow stages. Not a recording of software. | 20 MP4s |
| `client-evidence` | **Reserved.** Only for material a client has authorised in writing. Currently unused; `tests/portfolio.test.ts` fails if it appears. | — |

### 4.1 Blueprint concept covers
`public/images/case-studies/covers/<slug>.webp` (1600×1000) + `<slug>-800.webp` (card size).
Original generated scenes (no logos, no real people identified, no readable fake UI text). They are
deliberately **not** registered in `CASE_STUDY_IMAGES` / the 35-asset WebP registry, which still covers the
8 architecture diagrams.

### 4.2 System card variants
`public/images/work/sm/<file>-800.webp` — 800px WebP derivatives of the 12 existing work JPGs for cards and
the explorer grid (detail pages keep the full JPG).

### 4.3 Concept motion previews
`public/videos/work/<slug>.mp4` + `public/videos/work/posters/<slug>.webp` — 20 files each.

- 1280×720, 25 fps, 12 s, H.264 High@4.0, yuv420p, CRF 27, `+faststart`, **no audio track** (so no captions
  are required; the `<figcaption>` beneath every player is the text alternative).
- ~0.55–0.8 MB each, ~13 MB total. `preload="none"` everywhere except the one autoplaying spotlight player.
- Storyboard: cover with kind/industry/title (0–4.6 s) → the entry's 4 published workflow stages revealed in
  order (4.6–9.8 s) → TECH360 mark + contact end card (9.8–12 s). A permanent
  "CONCEPT PREVIEW · NOT A PRODUCT RECORDING" badge is burned into every frame.
- Posters: 1280×720 WebP (quality 80, method 6), 1.52 MiB total for 20 posters (the JPEG set was 2.75 MiB,
  45 % smaller; worst-case PSNR against the JPEG source 37.6 dB). The build script writes WebP directly.
- Autoplay only when `prefers-reduced-motion` is off; hover-play on cards only for fine pointers; every
  player has a visible play/pause control.
- **Offscreen behaviour** (`src/lib/portfolio/visibility-playback.ts`): the autoplaying spotlight pauses
  when less than 35 % of it is on screen or the tab is hidden. It resumes only when visible again **and**
  autoplay is still allowed (no reduced motion). Pressing Pause, or a pause from media keys or the browser,
  is a manual pause and is never overridden. Pressing Play gives the same pause-offscreen/resume-on-return
  behaviour. All autoplaying players share one `IntersectionObserver`, disconnected when the last one
  unmounts. Click-to-play players register no observer.
- Regenerate:
  ```bash
  npx tsx scripts/media/export-portfolio-manifest.ts > /tmp/pm.json
  python3 scripts/media/build_portfolio_videos.py /tmp/pm.json            # all
  python3 scripts/media/build_portfolio_videos.py /tmp/pm.json <slug>...  # selected
  node scripts/media/hash-portfolio-media.mjs                              # refresh ?v= hashes (§4.4)
  ```
  Requires Pillow + an ffmpeg binary (`pip install imageio-ffmpeg pillow` provides one) and DejaVu fonts.
- `VideoObject.uploadDate` comes from `PORTFOLIO_MEDIA_PRODUCED_ON` — bump it when re-rendering.

### 4.4 Caching policy (portfolio media only)
Portfolio media filenames are slug-based and **replaceable**: re-rendering overwrites `<slug>.mp4`. Long-lived
immutable caching is therefore tied to the content, not the filename:

- `src/data/portfolio-media-versions.ts` (generated by `scripts/media/hash-portfolio-media.mjs`) holds a
  12-hex SHA-256 prefix for every file in `videos/work/`, `videos/work/posters/`,
  `images/case-studies/covers/` and `images/work/sm/`. `mediaUrl()` in `src/data/portfolio.ts` turns
  paths into `…?v=<hash>`. `tests/portfolio-media-cache.test.ts` fails if any hash is stale.
- `next.config.ts` → `headers()`, scoped to those directories only:

  | Request | Cache-Control |
  |---|---|
  | `?v=<12 hex>` (content-versioned) | `public, max-age=31536000, immutable` |
  | no `?v=` (old links, direct hits) | `public, max-age=3600, stale-while-revalidate=86400` |

  A `?v=` value that is not 12 hex characters matches neither rule and keeps the framework default.
- Out of scope, on purpose: HTML documents, `/api/*`, `/_next/image` (portfolio images are plain `<img>`, not
  `next/image`), and every other file in `public/`. The only other `Cache-Control` rules in the config are the
  pre-existing `no-store` ones (`/factory`, `/api/factory`).
- Next.js still serves the files, so the MIME type (`video/mp4`, `image/webp`, `image/jpeg`) and byte-range
  support (`Accept-Ranges: bytes`, `206 Partial Content` for video seeking) are unchanged. This was verified
  with curl against the dev server.
- After replacing any portfolio media file, run `node scripts/media/hash-portfolio-media.mjs`. Otherwise
  visitors keep the cached old bytes, and the test fails.

### 4.5 Filter URLs and history (`/work`, `/work/projects`, `/work/case-studies`)
Logic: `src/lib/portfolio/explorer-url.ts` (tests: `tests/portfolio-filter-history.test.ts`).

- The URL always reflects the filters: `type`, `industry`, `capability`, `q`, `sort`, in that order. Defaults
  are omitted, so the unfiltered page keeps a clean URL. Both URL forms work: `/work?industry=…` and in-app
  `…#/work?industry=…`.
- Each discrete change (type chip, industry, capability, sort, Clear, "Browse by industry") **pushes one
  history entry**. Back returns to the previous filter, Forward re-applies it, and Back from the first filter
  returns to the unfiltered view before leaving the page.
- Search typing pushes one entry when a typing burst starts, then replaces it while typing continues (a pause
  over 1.2 s starts a new burst). There is no entry per keystroke.
- A change that leaves the URL unchanged writes nothing, so there are no duplicate entries. Back/Forward
  restores state from the URL without writing history, so there is no sync loop.
- Reload and deep links read the URL. Unknown industries or capabilities, bad `type`/`sort` values and
  over-long `q` (more than 80 characters) fall back to defaults, and the URL is cleaned with `replaceState`
  (no new entry).
- Router support (`src/app/page.tsx`):
  - Query-only hash changes on the same route (Back between `#/work?…` entries) do not scroll to the top,
    re-render the route or log a `page_view`.
  - In-app links keep their query (`/work?capability=…`).
  - Legacy `/#/route?query` bookmarks are canonicalised to `/route?query` and render that route.

