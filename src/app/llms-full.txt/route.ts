import { llmsFullMarkdown } from '@/lib/agent-content'

export const dynamic = 'force-static'

// ---------------------------------------------------------------------
// GET /llms-full.txt
//
// Extended, machine-readable index of the whole public surface. Generated from
// the same registries as the HTML pages and as `public/llms.txt`, so the three
// representations cannot contradict each other.
//
// Public only: no customer records, credentials, private endpoints or
// unverified claims. This route exists so the Link headers and llms.txt can
// advertise a document that actually returns 200.
// ---------------------------------------------------------------------

export async function GET() {
  return new Response(llmsFullMarkdown(), {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
      'Content-Signal': 'search=yes, ai-train=no',
    },
  })
}
