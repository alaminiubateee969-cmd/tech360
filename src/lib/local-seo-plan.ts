export type LocalSeoInput = {
  businessName: string
  businessType: string
  primaryLocation: string
  serviceAreas: string[]
  services: string[]
  website?: string
  language: 'BN' | 'EN' | 'BOTH'
}

export type LocalSeoPlan = {
  generatedAt: string
  business: { name: string; type: string; primaryLocation: string; website: string | null; language: string }
  mapMarkers: Array<{ location: string; markerType: 'BUSINESS_LOCATION_TO_VERIFY' | 'SERVICE_AREA_TO_VERIFY'; instruction: string }>
  keywordClusters: Array<{ area: string; service: string; suggestions: string[] }>
  freeSetup: string[]
  landingPages: string[]
  contentIdeas: string[]
  measurement: string[]
  guardrails: string[]
  aiEnhanced: false
}

const clean = (value: string, max = 120) => value.replace(/[<>\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

export function splitLocalSeoList(value: string, limit = 12): string[] {
  const result: string[] = []
  const seen = new Set<string>()
  for (const raw of value.split(/[\n,;|]+/)) {
    const item = clean(raw, 100)
    const key = item.toLocaleLowerCase()
    if (item && !seen.has(key)) {
      seen.add(key)
      result.push(item)
    }
    if (result.length >= limit) break
  }
  return result
}

/**
 * Generate a free, offline-first local-search plan. It never geocodes or
 * fabricates map coordinates: a person must verify every real business pin.
 */
export function buildLocalSeoPlan(input: LocalSeoInput, now = new Date()): LocalSeoPlan {
  const businessName = clean(input.businessName, 120)
  const businessType = clean(input.businessType, 100)
  const primaryLocation = clean(input.primaryLocation, 120)
  const areas = Array.from(new Set([primaryLocation, ...input.serviceAreas.map((x) => clean(x, 100))].filter(Boolean))).slice(0, 12)
  const services = input.services.map((x) => clean(x, 100)).filter(Boolean).slice(0, 12)
  const serviceList = services.length ? services : [businessType || 'main product or service']
  const mapMarkers = areas.length
    ? areas.map((location) => {
        const isPrimaryAddress = Boolean(primaryLocation) && location === primaryLocation
        return {
          location,
          markerType: isPrimaryAddress ? 'BUSINESS_LOCATION_TO_VERIFY' as const : 'SERVICE_AREA_TO_VERIFY' as const,
          instruction: isPrimaryAddress
            ? 'Use only the real staffed customer-facing address. Confirm the pin in the official Google Business Profile; do not move it to a keyword target.'
            : 'Do not create a fake branch/pin. Add as a service area only if the business genuinely serves this area and the profile category allows it.',
        }
      })
    : [{
        location: 'Business address / service area required',
        markerType: 'VERIFIED_BUSINESS_LOCATION' as const,
        instruction: 'No coordinates or map marker were generated. Supply and verify the real customer-facing location in Google Business Profile.',
      }]

  const keywordClusters = areas.flatMap((area) => serviceList.map((service) => ({
    area,
    service,
    suggestions: input.language === 'BN'
      ? [`${area}-এ ${service}`, `${area} ${businessType || service} দাম`, `${area} ${service} near me`]
      : input.language === 'BOTH'
        ? [`${service} in ${area}`, `${area} ${businessType || service} price`, `${area}-এ ${service}`, `${service} near me`]
        : [`${service} in ${area}`, `${area} ${businessType || service} price`, `${service} near me`],
  }))).slice(0, 36)

  const landingPages = areas.length
    ? areas.map((area) => `${serviceList[0]} in ${area} — publish only if you can add genuinely useful, unique local details, proof of service, hours and contact information.`)
    : ['Create a location/service page only after supplying a verified address or genuine service area.']

  return {
    generatedAt: now.toISOString(),
    business: { name: businessName, type: businessType, primaryLocation, website: input.website ? clean(input.website, 200) : null, language: input.language },
    mapMarkers,
    keywordClusters,
    freeSetup: [
      'Claim or update the free Google Business Profile. Use the accurate primary category, business name, real address or eligible service area, hours, phone, website and service list.',
      'Verify ownership of the Business Profile using Google’s current verification method; upload real exterior/interior/product photos and keep hours and holiday hours current.',
      'Add a free Google Search Console property and submit the website sitemap; check indexing and search queries after verification.',
      'Use Google Maps to verify the visible business pin and directions. This planner does not call Google Maps APIs or create pins.',
      'Request genuine customer reviews after completed work, and reply helpfully. Never buy, gate or fabricate reviews.',
    ],
    landingPages,
    contentIdeas: [
      `${businessName || businessType}: answer one real customer question in ${input.language === 'BN' ? 'Bangla' : input.language === 'BOTH' ? 'Bangla and English' : 'English'}; include verified price/availability only.`,
      `Create a comparison or buying guide for ${serviceList.slice(0, 3).join(', ')} with current, checked product details.`,
      `Publish one service-area update featuring a real job/photo and customer-approved location details.`,
      'Post an accurate opening-hours, seasonal service or stock update to the Business Profile; review every draft before publishing.',
      'Use the existing Marketing Dashboard to draft organic Bangla/English social posts from verified services and offers; the operator reviews each draft, and publishing requires connected official accounts. Organic posts do not require ad spend.'
    ],
    measurement: [
      'Record a baseline: Google Business Profile calls, website clicks, direction requests, Search Console impressions/clicks and qualified enquiries.',
      'Use consistent UTM tags on the Business Profile website link so CRM leads can be attributed; do not treat views as sales.',
      'Review weekly by area/service and adjust based on actual customer enquiries and completed sales.',
    ],
    guardrails: [
      'Google Business Profile, Search Console and ordinary on-page work can be used without paid SEO software; domain, hosting, SMS, ads and some integrations may still cost money.',
      'No one can guarantee Google rankings, map-pack placement, calls, leads or sales. This is a draft strategy, not a ranking promise.',
      'Only the real staffed location may be a storefront marker. Service areas are not separate map pins; never invent addresses, coordinates, branches or reviews.',
      'Location pages must have unique value. Do not publish doorway pages, keyword-stuffed names, false offers or unverified stock/prices.',
      'Discounts and free marketing/SEO deliverables are subject to a separately approved written offer and scope; no discount is implied by this plan.',
    ],
    aiEnhanced: false,
  }
}
