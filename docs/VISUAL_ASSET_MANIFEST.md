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
