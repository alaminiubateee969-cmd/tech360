/**
 * Prints the portfolio media manifest consumed by build_portfolio_videos.py.
 *
 *   npx tsx scripts/media/export-portfolio-manifest.ts > /tmp/portfolio-manifest.json
 *   python3 scripts/media/build_portfolio_videos.py /tmp/portfolio-manifest.json [slug...]
 *   node scripts/media/hash-portfolio-media.mjs   # refresh ?v= content hashes afterwards
 */
import { KIND_LABEL, PORTFOLIO, mediaFilePath } from '../../src/data/portfolio'

// File paths only: the `?v=` cache-busting query is a URL concern, not a path on disk.
const file = (url: string | null | undefined) => (url ? mediaFilePath(url) : null)

const manifest = PORTFOLIO.map((entry) => ({
  slug: entry.slug,
  kind: entry.kind,
  kindLabel: KIND_LABEL[entry.kind].singular,
  title: entry.title,
  industry: entry.industry,
  stages: entry.stages.slice(0, 4),
  cover: file(entry.cover.src),
  diagram: entry.gallery.find((image) => image.provenance === 'architecture-diagram')?.src ?? null,
  video: file(entry.video?.src),
  poster: file(entry.video?.poster),
  durationSeconds: entry.video?.durationSeconds ?? 12,
}))

process.stdout.write(JSON.stringify(manifest, null, 2))
