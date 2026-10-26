// ============================================================
// TECH360 CURATED IMAGE-PROMPT PATTERN LIBRARY
// (parity with songguoxs/gpt4o-image-prompts — a browsable,
// tag-filterable, copyable gallery of proven image prompts,
// adapted to THIS business: a web/software agency that markets
// itself and designs for clients.)
//
// How this is used:
//   - Staff browse/search/filter in the admin Prompt Library view
//     and copy a pattern with one click.
//   - Placeholders in {curly braces} are replaced before use —
//     the view lists every placeholder a pattern needs.
//   - Patterns work with any modern image model. They are PROMPTS,
//     not claims of generated output — the platform renders nothing
//     itself (the honest-provider principle).
// ============================================================

export type ImagePromptCategory =
  | 'Website & Landing'
  | 'Brand & Identity'
  | 'Social & Ads'
  | 'Content & Blog'
  | 'Data & Dashboard'
  | 'Product & Service'
  | 'Team & Culture'
  | 'Illustration Styles'

export interface ImagePromptPattern {
  id: string
  name: string
  category: ImagePromptCategory
  tags: string[]
  /** The prompt text. {placeholders} are filled per use. */
  prompt: string
  /** When this pattern is the right choice. */
  useCase: string
  /** One practical tip for best results. */
  tip: string
}

export const IMAGE_PROMPT_CATEGORIES: ImagePromptCategory[] = [
  'Website & Landing',
  'Brand & Identity',
  'Social & Ads',
  'Content & Blog',
  'Data & Dashboard',
  'Product & Service',
  'Team & Culture',
  'Illustration Styles',
]

export const IMAGE_PROMPTS: ImagePromptPattern[] = [
  // ── Website & Landing ─────────────────────────────────────────
  {
    id: 'hero-abstract-tech',
    name: 'Abstract tech hero background',
    category: 'Website & Landing',
    tags: ['hero', 'background', 'saas', 'gradient', 'web'],
    prompt:
      'Wide 16:9 abstract hero background for a {industry} technology company website. Deep navy (#063B8F) base with flowing cyan (#009FE3) light ribbons and subtle depth-of-field bokeh, soft glow accents, generous empty space on the {side} for headline text, no people, no text, no logos. Clean, premium, modern B2B feel, ultra-smooth gradients, 4K.',
    useCase: 'Landing-page hero sections where the headline sits over the art.',
    tip: 'Keep the empty-space side opposite your text column so contrast stays readable.',
  },
  {
    id: 'hero-split-product',
    name: 'Split-layout product hero scene',
    category: 'Website & Landing',
    tags: ['hero', 'product', 'split', 'web', 'saas'],
    prompt:
      'Photorealistic 16:9 hero image for a {product} website, right half only: the product ({product}) floating at a slight angle on a clean light-gray studio background, soft cyan rim light, subtle shadow, minimal props, generous negative space, no text, no UI screenshots, crisp commercial product photography style.',
    useCase: 'Hero rows with text on the left and a product visual on the right.',
    tip: 'Ask for one product only — multiple objects fight the headline for attention.',
  },
  {
    id: 'section-isometric-flow',
    name: 'Isometric process section art',
    category: 'Website & Landing',
    tags: ['isometric', 'process', 'section', 'diagram', 'web'],
    prompt:
      'Isometric 3D illustration of a {process} workflow for a {industry} company: three connected floating platforms showing {step1}, {step2}, {step3}, linked by glowing cyan arrows on a deep-navy background, soft shadows, matte clay materials, brand palette navy/cyan/green, no text labels, no people, clean vector-like finish, 16:9.',
    useCase: 'How-it-works or process sections without hand-drawing a diagram.',
    tip: 'Number of platforms = number of steps; keep it to 3–4 or it clutters.',
  },
  {
    id: 'cta-band-texture',
    name: 'CTA band background texture',
    category: 'Website & Landing',
    tags: ['cta', 'background', 'texture', 'web'],
    prompt:
      'Seamless abstract background texture for a call-to-action band on a {industry} website: dark navy with a very subtle topographic-line pattern and a faint cyan glow from the bottom-left, extremely low visual noise, flat lighting, no objects, no text, tileable, 21:9 ultra-wide.',
    useCase: 'Behind “Book a call” style bands where text must dominate.',
    tip: 'The busier the CTA copy, the quieter the texture should be.',
  },
  {
    id: 'coming-soon-page',
    name: 'Coming-soon teaser visual',
    category: 'Website & Landing',
    tags: ['teaser', 'launch', 'web', 'minimal'],
    prompt:
      'Minimal 16:9 teaser visual for an upcoming {product} launch: a single glowing cyan outline of a {shape} on a dark navy gradient, particles drifting upward, large central negative space, cinematic soft lighting, no text, no logos, elegant and mysterious.',
    useCase: 'Pre-launch landing pages and waitlist screens.',
    tip: 'One symbolic shape reads faster than a scene.',
  },

  // ── Brand & Identity ──────────────────────────────────────────
  {
    id: 'logo-concept-mark',
    name: 'Logo mark concept sheet',
    category: 'Brand & Identity',
    tags: ['logo', 'brand', 'identity', 'concept'],
    prompt:
      'Design concept sheet of a minimal geometric logo mark for a {business} company: a single abstract symbol combining {symbol1} and {symbol2}, flat vector style, solid navy on white, centered, generous margins, no gradients, no text, no letters, presented as one strong concept — not a grid of options.',
    useCase: 'First-round logo exploration to react to before vector work.',
    tip: 'Image models draft marks; the deliverable is always redrawn as real SVG.',
  },
  {
    id: 'brand-style-tile',
    name: 'Brand mood/style tile',
    category: 'Brand & Identity',
    tags: ['brand', 'moodboard', 'palette', 'style'],
    prompt:
      'Brand style tile for a {industry} brand: a composed flat-lay of textures and materials in a {palette} palette — paper, brushed metal, fabric swatch, a color chip strip, one plant leaf — soft daylight, top-down photography, cohesive premium mood, no text, no logos, square 1:1.',
    useCase: 'Moodboards for brand discovery workshops.',
    tip: 'Name the palette explicitly (e.g. “navy, cyan, warm gray”) to avoid random color.',
  },
  {
    id: 'business-card-mockup',
    name: 'Business card mockup',
    category: 'Brand & Identity',
    tags: ['mockup', 'print', 'brand', 'stationery'],
    prompt:
      'Photorealistic mockup of two business cards on a {surface} surface, card design in {palette} with a large blank area where a logo would sit (no text, no letters), soft window light from the left, shallow depth of field, premium stationery photography, 3:2.',
    useCase: 'Presenting brand directions without building print files first.',
    tip: 'Explicitly forbid text — models love inventing fake letterforms.',
  },
  {
    id: 'brand-pattern',
    name: 'Seamless brand pattern',
    category: 'Brand & Identity',
    tags: ['pattern', 'seamless', 'brand', 'background'],
    prompt:
      'Seamless repeating pattern built from abstract {motif} shapes in {palette}, evenly spaced, flat vector style, small scale, subtle and low-contrast so it can sit behind white text, tileable, no text, 1:1.',
    useCase: 'Section backgrounds, footer textures, packaging fills.',
    tip: 'Ask for “low-contrast” or the pattern overwhelms foreground UI.',
  },

  // ── Social & Ads ──────────────────────────────────────────────
  {
    id: 'linkedin-og-card',
    name: 'LinkedIn / OpenGraph card',
    category: 'Social & Ads',
    tags: ['og-image', 'linkedin', 'social', 'card'],
    prompt:
      'Professional 1.91:1 social share card background for a {industry} article: left two-thirds solid deep navy with a subtle diagonal cyan light streak, right third an abstract 3D glass shape in cyan and green, large clear space on the left for a headline overlay, no text, no people, crisp corporate modern style.',
    useCase: 'OG images and LinkedIn link cards with a text overlay added later.',
    tip: '1.91:1 is the OG standard; keep the safe area in the left 60%.',
  },
  {
    id: 'instagram-story-promo',
    name: 'Instagram story promo',
    category: 'Social & Ads',
    tags: ['instagram', 'story', '9:16', 'promo'],
    prompt:
      'Vertical 9:16 Instagram story background promoting a {service}: bold color-blocked gradient from navy to cyan, a large {object} rendered as soft 3D clay at the bottom third, clean space in the upper half for a headline, playful but professional, no text, no logos, high quality.',
    useCase: 'Story-format promos where copy is overlaid in the app or editor.',
    tip: 'Leave the top 250px clear — the app UI covers it.',
  },
  {
    id: 'facebook-ad-1x1',
    name: 'Square ad creative',
    category: 'Social & Ads',
    tags: ['ad', 'facebook', '1:1', 'campaign'],
    prompt:
      'Square 1:1 paid ad background for a {service} aimed at {audience}: split composition, top half deep navy with abstract connection lines, bottom half light surface with a soft shadowed 3D icon of {icon}, high contrast between halves, empty central band for a value-proposition overlay, no text, no brand marks, direct-response friendly.',
    useCase: 'Feed ads that need headline space baked in.',
    tip: 'Test the final crop at small sizes — ads render tiny in feeds.',
  },
  {
    id: 'twitter-header',
    name: 'Profile header banner',
    category: 'Social & Ads',
    tags: ['header', 'banner', 'social', '3:1'],
    prompt:
      'Wide 3:1 social profile header for a {business}: panoramic abstract landscape of layered navy hills with a rising cyan sun glow, tiny floating geometric particles, calm and confident mood, safe margins on all edges, no text, no logos.',
    useCase: 'X/LinkedIn company headers and YouTube banners.',
    tip: 'Keep key details centered — both platforms crop edges differently.',
  },
  {
    id: 'case-study-social',
    name: 'Case-study result card',
    category: 'Social & Ads',
    tags: ['case-study', 'results', 'social'],
    prompt:
      '16:9 social card visual celebrating a project result for a {industry} client: a stylized upward arrow made of glowing cyan data particles rising over a subtle grid, dark navy background, one celebratory accent in green (#18B83A), large clean space bottom-left for a metric overlay, no text, no numbers, no charts with axes.',
    useCase: '“+140% leads” style posts where the number is added as text.',
    tip: 'Never let the model render the metric — overlay real numbers for honesty.',
  },

  // ── Content & Blog ────────────────────────────────────────────
  {
    id: 'blog-cover-concept',
    name: 'Blog cover — concept metaphor',
    category: 'Content & Blog',
    tags: ['blog', 'cover', 'metaphor', 'editorial'],
    prompt:
      'Editorial 16:9 blog cover for an article about {topic}: a single clear metaphor — {metaphor} — photographed in a minimalist studio, navy and cyan lighting, lots of negative space at the top for the title, thoughtful and premium, no text, no letters.',
    useCase: 'Article covers that illustrate the idea instead of decorating it.',
    tip: 'One metaphor beats a collage; the title does the explaining.',
  },
  {
    id: 'blog-cover-abstract',
    name: 'Blog cover — abstract geometry',
    category: 'Content & Blog',
    tags: ['blog', 'cover', 'abstract', 'geometry'],
    prompt:
      '16:9 abstract blog cover about {topic}: intersecting translucent glass planes in cyan and navy with one green accent sphere, dark background, studio lighting, precise geometric composition with calm upper area for a headline overlay, no text, premium tech-editorial style.',
    useCase: 'Series-consistent covers for recurring column topics.',
    tip: 'Reuse the same prompt with one word changed for a consistent series look.',
  },
  {
    id: 'newsletter-header',
    name: 'Newsletter header strip',
    category: 'Content & Blog',
    tags: ['newsletter', 'email', 'header', 'banner'],
    prompt:
      'Ultra-wide 5:1 email newsletter header strip for a {industry} digest: a thin band of abstract flowing cyan light lines on deep navy, subtle and dark enough for white text overlay, minimal, no objects, no text, compresses well at small file size.',
    useCase: 'Recurring email header art that survives email-client rendering.',
    tip: 'Ask for low detail — email clients scale and compress aggressively.',
  },
  {
    id: 'thumbnail-high-ctr',
    name: 'Content thumbnail — high contrast',
    category: 'Content & Blog',
    tags: ['thumbnail', 'video', 'ctr', 'youtube'],
    prompt:
      '16:9 video thumbnail background about {topic}: dramatic side-lit 3D scene of {subject} on a deep navy stage with a strong cyan rim light, exaggerated perspective, high contrast, clear focal point on the right third, left third dark and empty for a big title overlay, no text, no faces, punchy and clickable.',
    useCase: 'YouTube/video thumbnails where the title text is added separately.',
    tip: 'Contrast beats detail — thumbnails are judged at 200px wide.',
  },

  // ── Data & Dashboard ─────────────────────────────────────────
  {
    id: 'dashboard-hero-abstract',
    name: 'Dashboard hero — abstract data',
    category: 'Data & Dashboard',
    tags: ['dashboard', 'data', 'hero', 'abstract'],
    prompt:
      '16:9 abstract visualization for a business-intelligence landing hero: translucent 3D bar and line shapes floating in dark navy space, cyan glowing edges with one green highlight, soft grid floor, sense of data without any readable numbers or axes, no text, premium enterprise feel.',
    useCase: 'Marketing pages for dashboard/CRM products — no fake screenshots.',
    tip: '“No readable numbers” keeps you honest — real screenshots come from the product.',
  },
  {
    id: 'crm-illustration',
    name: 'CRM pipeline illustration',
    category: 'Data & Dashboard',
    tags: ['crm', 'pipeline', 'illustration', 'funnel'],
    prompt:
      'Isometric illustration of a sales pipeline for a CRM marketing page: four rounded platforms at increasing heights connected by a glowing cyan path, small abstract blocks (not people) moving along it, navy background, matte 3D style, brand colors navy/cyan/green, no text, no numbers, 16:9.',
    useCase: 'Explaining pipeline stages visually next to real UI copy.',
    tip: 'Blocks instead of people avoids uncanny figures in isometric scenes.',
  },
  {
    id: 'analytics-report-cover',
    name: 'Analytics report cover',
    category: 'Data & Dashboard',
    tags: ['report', 'cover', 'analytics', 'document'],
    prompt:
      'A4 portrait cover background for a {period} analytics report: upper third a smooth navy-to-cyan gradient with faint concentric data rings, lower two-thirds clean white, one subtle green accent line, formal and calm, generous space for a title block, no text, no charts.',
    useCase: 'Client-facing PDF report covers that stay on-brand.',
    tip: 'Keep the lower area pure white so printed titles stay legible.',
  },
  {
    id: 'kpi-icon-set',
    name: 'KPI icon set',
    category: 'Data & Dashboard',
    tags: ['icons', 'kpi', 'set', 'ui'],
    prompt:
      'A set of four minimalist line icons on a single sheet — an upward trend arrow, a coin stack, a user with a checkmark, a clock — consistent 2px stroke weight, cyan on transparent-looking dark background, aligned to a grid, flat vector style, no text, no fills.',
    useCase: 'Quick KPI-card icon direction before commissioning a real icon set.',
    tip: 'Generate direction only; final icons are redrawn as SVG for crispness.',
  },

  // ── Product & Service ────────────────────────────────────────
  {
    id: 'service-photography',
    name: 'Service hero photography',
    category: 'Product & Service',
    tags: ['photography', 'service', 'hero', 'editorial'],
    prompt:
      'Editorial photograph representing {service} for a B2B agency website: a professional environment detail — {scene} — shallow depth of field, cool daylight with a cyan accent light, navy and gray tones, no recognizable faces, no text, no logos, premium and calm, 16:9.',
    useCase: 'Service pages that need human context without stock-photo clichés.',
    tip: '“Environment detail” avoids the fake-smiling-team photo trap.',
  },
  {
    id: 'product-lifestyle',
    name: 'Product lifestyle shot',
    category: 'Product & Service',
    tags: ['lifestyle', 'product', 'ecommerce'],
    prompt:
      'Lifestyle product photograph of {product} in a {context} setting, styled flat-lay or 45-degree angle, {palette} props, soft natural window light, muted background with room for a price/name overlay, no text, no hands, commercial e-commerce quality, square 1:1.',
    useCase: 'E-commerce and product-service landing visuals.',
    tip: 'Specify the angle — “flat-lay or 45°” — or you get awkward in-between shots.',
  },
  {
    id: 'before-after-stage',
    name: 'Transformation before/after stage',
    category: 'Product & Service',
    tags: ['transformation', 'before-after', 'service'],
    prompt:
      '16:9 conceptual before/after visual for a {service} page: left half in muted grayscale showing a tangled {object}, right half in vibrant navy/cyan showing the same {object} clean and structured, a subtle vertical divide in the center, no text, no people, balanced symmetrical composition.',
    useCase: '“We take messy X to clean Y” positioning statements.',
    tip: 'Same object on both sides — different states — reads instantly.',
  },
  {
    id: 'portal-device-mockup',
    name: 'Device mockup scene',
    category: 'Product & Service',
    tags: ['mockup', 'device', 'laptop', 'portal'],
    prompt:
      'Photorealistic laptop mockup on a clean desk showing a plain light-gray screen ready for a screenshot overlay (screen completely blank, slightly reflective), a phone beside it also with a blank screen, soft cyan ambient light, navy desk accessories blurred in the background, no text, no UI, 16:9.',
    useCase: 'Framing real product screenshots inside a polished scene.',
    tip: 'Demand a blank screen — the real screenshot is composited afterwards.',
  },

  // ── Team & Culture ───────────────────────────────────────────
  {
    id: 'about-page-craft',
    name: 'About-page craft detail',
    category: 'Team & Culture',
    tags: ['about', 'craft', 'detail', 'editorial'],
    prompt:
      'Close-up editorial photograph of {craft-detail} in a software studio — a mechanical keyboard, notebook sketches, a monitor glow — cool cyan-tinted lighting, shallow focus, authentic and unstyled, no faces, no text, no logos, 3:2.',
    useCase: 'About pages that show the work instead of staged team smiles.',
    tip: 'Details photograph honestly; staged “team laughing” photos never do.',
  },
  {
    id: 'careers-banner',
    name: 'Careers page banner',
    category: 'Team & Culture',
    tags: ['careers', 'banner', 'recruiting'],
    prompt:
      '16:9 careers-page banner for a technology company: an inviting modern workspace at dusk seen through glass, warm interior light mixed with cool blue evening tones, wide and cinematic, no people, no text, no logos, hopeful and calm mood.',
    useCase: 'Recruiting pages that feel real, not corporate-stock.',
    tip: 'Empty-space framing lets your real headline and CTA carry the message.',
  },
  {
    id: 'testimonial-ambient',
    name: 'Testimonial section ambience',
    category: 'Team & Culture',
    tags: ['testimonial', 'social-proof', 'background'],
    prompt:
      'Soft abstract background for a testimonials section: pale blue-gray paper texture with a very subtle cyan watercolor wash in one corner, extremely light and airy, suitable behind dark quote text, no objects, no text, 21:9.',
    useCase: 'Quote sections that need warmth without competing with the words.',
    tip: 'Light backgrounds keep long quotes readable — reserve dark art for heroes.',
  },

  // ── Illustration Styles ──────────────────────────────────────
  {
    id: 'style-isometric-clay',
    name: 'Style — matte clay isometric',
    category: 'Illustration Styles',
    tags: ['style', 'isometric', 'clay', '3d'],
    prompt:
      'Matte clay 3D illustration of {subject}, soft rounded forms, pastel navy and cyan materials with one green accent, gentle studio lighting with soft shadows, on a deep-navy background, no text, centered, generous margins, 16:9.',
    useCase: 'Friendly explainers for complex services.',
    tip: 'Clay softens technical topics — pair with precise copy.',
  },
  {
    id: 'style-line-art',
    name: 'Style — technical line art',
    category: 'Illustration Styles',
    tags: ['style', 'line-art', 'technical', 'blueprint'],
    prompt:
      'Precise technical line-art illustration of {subject} in the style of an engineering blueprint, thin cyan lines on deep navy, subtle grid background, one element highlighted in solid green, no text, no shading, elegant and exact, 16:9.',
    useCase: 'Engineering/precision positioning for technical services.',
    tip: 'Blueprint style signals rigor — use it where accuracy is the selling point.',
  },
  {
    id: 'style-gradient-mesh',
    name: 'Style — gradient mesh poster',
    category: 'Illustration Styles',
    tags: ['style', 'gradient', 'mesh', 'poster'],
    prompt:
      'Smooth gradient-mesh poster background in navy, cyan and a touch of green, organic flowing color fields like liquid glass, ultra-smooth transitions, no banding, no objects, no text, large scale, 4:5 portrait.',
    useCase: 'Modern poster/flyer backgrounds and slide covers.',
    tip: 'Add “no banding” — gradients often show ugly steps when compressed.',
  },
  {
    id: 'style-paper-cut',
    name: 'Style — layered paper cut',
    category: 'Illustration Styles',
    tags: ['style', 'paper', 'layers', 'craft'],
    prompt:
      'Layered paper-cut craft illustration of {subject}, multiple stacked paper layers creating depth, navy and cyan cardstock with white edges visible, soft even lighting casting gentle real shadows, no text, square 1:1.',
    useCase: 'Humanizing service pages with a handcrafted feel.',
    tip: 'Real shadows between layers are what sell the effect — keep lighting soft.',
  },
  {
    id: 'style-pixel-retro',
    name: 'Style — refined retro pixel',
    category: 'Illustration Styles',
    tags: ['style', 'pixel', 'retro', 'playful'],
    prompt:
      'Refined retro pixel-art scene of {subject} for a technology brand, limited palette of navy, cyan, white and green, 32-bit era detail with modern composition, subtle dithering, no text, 16:9.',
    useCase: 'Playful campaign accents for developer-facing audiences.',
    tip: 'Limit the palette explicitly or pixels turn muddy.',
  },
  {
    id: 'style-glass-3d',
    name: 'Style — frosted glass 3D',
    category: 'Illustration Styles',
    tags: ['style', 'glass', '3d', 'premium'],
    prompt:
      'Frosted-glass 3D render of {subject}, translucent smoky material with cyan light passing through, subtle internal refraction, floating on a deep navy background with a soft glow, studio product lighting, no text, premium and minimal, 1:1.',
    useCase: 'High-end feature highlights and iconography.',
    tip: 'One light color through glass keeps it premium; two makes it carnival.',
  },
]

/** Extract the {placeholders} a prompt needs, in order of appearance. */
export function promptPlaceholders(prompt: string): string[] {
  const out: string[] = []
  for (const m of prompt.matchAll(/\{([a-zA-Z0-9_-]+)\}/g)) {
    if (!out.includes(m[1])) out.push(m[1])
  }
  return out
}

/** All distinct tags across the library, alphabetical (for the filter chips). */
export function allPromptTags(): string[] {
  const tags = new Set<string>()
  for (const p of IMAGE_PROMPTS) for (const t of p.tags) tags.add(t)
  return [...tags].sort()
}
