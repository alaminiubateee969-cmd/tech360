import { getDefaultBranding, getDocumentBranding } from '@/lib/document-branding'

export const dynamic = 'force-dynamic'

/** Publicly safe subset used to render company letterhead on public legal pages. */
export async function GET() {
  const branding = await getDocumentBranding()
  const defaults = getDefaultBranding()
  const publicAsset = (asset: string, fallback: string) => /^\/brand\/[A-Za-z0-9._-]+$/.test(asset) ? asset : fallback
  return Response.json({
    branding: {
      letterheadAsset: publicAsset(branding.letterheadAsset, defaults.letterheadAsset),
      logoAsset: publicAsset(branding.logoAsset, defaults.logoAsset),
      legalName: branding.legalName,
      email: branding.email,
      domain: branding.domain,
      tagline: branding.tagline,
      servicesLine: branding.servicesLine,
    },
  }, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } })
}
