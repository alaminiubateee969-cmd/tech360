// ---------------------------------------------------------------------------
// TECH360 — deterministic post poster renderer (SVG)
// ---------------------------------------------------------------------------
// Every post in the marketing review grid shows a CLEAR image: real, crisp
// vector text rendered from the post's own words — not an AI-generated picture
// with scrambled lettering. The renderer is pure and offline, so the same post
// always produces the same poster, and nothing has to be uploaded anywhere.
//
// Boundaries that must stay true:
//   - The poster is a layout of the drafted copy. It is a preview/asset, not a
//     platform-published image, and it carries the post's real status.
//   - All user text is XML-escaped; the output is inert SVG (no script, no
//     external fonts, no remote references).
// ---------------------------------------------------------------------------

export const POSTER_FORMATS = ['SQUARE', 'STORY', 'LANDSCAPE'] as const
export type PosterFormat = (typeof POSTER_FORMATS)[number]

export const POSTER_SIZES: Record<PosterFormat, { width: number; height: number }> = {
  SQUARE: { width: 1080, height: 1080 },
  STORY: { width: 1080, height: 1350 },
  LANDSCAPE: { width: 1200, height: 675 },
}

type Brand = { from: string; to: string; ink: string; accent: string }

const BRANDS: Record<string, Brand> = {
  FACEBOOK: { from: '#0B2A5B', to: '#1877F2', ink: '#F5F9FF', accent: '#8CC4FF' },
  INSTAGRAM: { from: '#26123A', to: '#E1306C', ink: '#FFF7FB', accent: '#FFC2D6' },
  LINKEDIN: { from: '#04223C', to: '#0A66C2', ink: '#F2FAFF', accent: '#8FD3FF' },
  X: { from: '#0B0F14', to: '#28313B', ink: '#FFFFFF', accent: '#9BA9B8' },
  YOUTUBE: { from: '#1A0A0A', to: '#B31217', ink: '#FFF6F6', accent: '#FFB3B3' },
  TIKTOK: { from: '#0A0A0A', to: '#2B2B2B', ink: '#FFFFFF', accent: '#25F4EE' },
  DEFAULT: { from: '#0B2545', to: '#009FE3', ink: '#F4FBFF', accent: '#9BD9F5' },
}

export function brandFor(platform: string): Brand {
  return BRANDS[platform.toUpperCase()] ?? BRANDS.DEFAULT
}

/** Escape every character that could break out of SVG text or attributes. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
}

/**
 * Greedy word wrap with a hard character budget per line and a line cap.
 * The last line gets an ellipsis when content was dropped — the poster never
 * silently swallows the end of a sentence without saying so.
 */
export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = String(text ?? '').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (words.length === 0) return []
  const lines: string[] = []
  let current = ''
  let index = 0
  for (; index < words.length; index += 1) {
    const word = words[index]
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxChars) {
      current = candidate
      continue
    }
    if (!current) {
      // A single word longer than the line: hard-split it.
      lines.push(`${word.slice(0, maxChars - 1)}…`)
      current = ''
      if (lines.length === maxLines) return lines
      continue
    }
    lines.push(current)
    current = word
    if (lines.length === maxLines) {
      lines[lines.length - 1] = `${lines[lines.length - 1].replace(/…$/, '')}…`
      return lines
    }
  }
  if (current && lines.length < maxLines) lines.push(current)
  if (index < words.length && lines.length === maxLines) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/…$/, '')}…`
  }
  return lines
}

export type PosterInput = {
  headline: string
  body?: string
  platform: string
  status?: string
  hashtags?: string[]
  brandLabel?: string
  format?: PosterFormat
  /** Deterministic footer code shown on the poster (e.g. post id prefix). */
  reference?: string
}

const STATUS_COLOR: Record<string, string> = {
  DRAFT: '#F4C95D',
  APPROVED: '#6FD3A2',
  PUBLISHED: '#7BC8FF',
  FAILED: '#FF9A9A',
  NOT_CONFIGURED: '#C8D2DC',
}

/** Render the poster. Pure, deterministic, ~4 KB of inert SVG. */
export function renderPosterSvg(input: PosterInput): string {
  const format = input.format && POSTER_FORMATS.includes(input.format) ? input.format : 'SQUARE'
  const { width, height } = POSTER_SIZES[format]
  const brand = brandFor(input.platform)
  const pad = Math.round(width * 0.075)
  const platform = escapeXml(input.platform.toUpperCase())
  const status = escapeXml((input.status ?? 'DRAFT').toUpperCase())
  const statusColor = STATUS_COLOR[(input.status ?? 'DRAFT').toUpperCase()] ?? '#C8D2DC'

  const headlineSize = format === 'LANDSCAPE' ? 66 : 74
  const headlineLines = wrapText(input.headline, format === 'LANDSCAPE' ? 26 : 20, format === 'STORY' ? 5 : 4)
  const bodySize = format === 'LANDSCAPE' ? 28 : 32
  const bodyLines = wrapText(input.body ?? '', format === 'LANDSCAPE' ? 62 : 44, 3)
  const tagText = (input.hashtags ?? []).slice(0, 3).join('  ')

  const headlineTop = Math.round(height * (format === 'STORY' ? 0.34 : 0.36))
  const headlineStep = Math.round(headlineSize * 1.16)
  const bodyTop = headlineTop + headlineLines.length * headlineStep + Math.round(headlineSize * 0.5)

  const headlineTspans = headlineLines
    .map((line, i) => `<tspan x="${pad}" dy="${i === 0 ? 0 : headlineStep}">${escapeXml(line)}</tspan>`)
    .join('')
  const bodyTspans = bodyLines
    .map((line, i) => `<tspan x="${pad}" dy="${i === 0 ? 0 : Math.round(bodySize * 1.45)}">${escapeXml(line)}</tspan>`)
    .join('')

  const footerY = height - Math.round(pad * 0.9)
  const reference = input.reference ? ` · ${escapeXml(input.reference)}` : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(input.headline).slice(0, 140)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${brand.from}"/>
      <stop offset="100%" stop-color="${brand.to}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.82" cy="0.16" r="0.6">
      <stop offset="0%" stop-color="${brand.accent}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${brand.accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <rect width="${width}" height="${height}" fill="url(#glow)"/>
  <g opacity="0.16" fill="none" stroke="${brand.ink}" stroke-width="2">
    <circle cx="${width - pad}" cy="${Math.round(height * 0.18)}" r="${Math.round(width * 0.19)}"/>
    <circle cx="${width - pad}" cy="${Math.round(height * 0.18)}" r="${Math.round(width * 0.27)}"/>
  </g>
  <text x="${pad}" y="${pad + 26}" font-family="Inter, 'Helvetica Neue', Arial, sans-serif" font-size="${Math.round(width * 0.021)}" font-weight="700" letter-spacing="4" fill="${brand.accent}">BDTECH360 · ${platform}</text>
  <g>
    <rect x="${width - pad - 168}" y="${pad}" rx="16" ry="16" width="168" height="42" fill="${statusColor}" opacity="0.18"/>
    <text x="${width - pad - 84}" y="${pad + 29}" text-anchor="middle" font-family="Inter, 'Helvetica Neue', Arial, sans-serif" font-size="22" font-weight="700" letter-spacing="2" fill="${statusColor}">${status}</text>
  </g>
  <text font-family="Inter, 'Helvetica Neue', Arial, sans-serif" font-size="${headlineSize}" font-weight="800" fill="${brand.ink}" letter-spacing="-1">
    <tspan x="${pad}" y="${headlineTop}">${headlineTspans}</tspan>
  </text>
  ${bodyLines.length > 0 ? `<text font-family="Inter, 'Helvetica Neue', Arial, sans-serif" font-size="${bodySize}" font-weight="400" fill="${brand.ink}" opacity="0.86"><tspan x="${pad}" y="${bodyTop}">${bodyTspans}</tspan></text>` : ''}
  ${tagText ? `<text x="${pad}" y="${footerY - 52}" font-family="Inter, 'Helvetica Neue', Arial, sans-serif" font-size="${Math.round(width * 0.024)}" fill="${brand.accent}">${escapeXml(tagText)}</text>` : ''}
  <rect x="${pad}" y="${footerY - 26}" width="${Math.round(width * 0.11)}" height="4" fill="${brand.accent}"/>
  <text x="${pad}" y="${footerY}" font-family="Inter, 'Helvetica Neue', Arial, sans-serif" font-size="${Math.round(width * 0.019)}" fill="${brand.ink}" opacity="0.7">${escapeXml(input.brandLabel ?? 'TECH360 — private marketing workspace')}${reference}</text>
</svg>`
}

/** True when a format string is usable (the API rejects anything else). */
export function isPosterFormat(value: unknown): value is PosterFormat {
  return typeof value === 'string' && (POSTER_FORMATS as readonly string[]).includes(value)
}
