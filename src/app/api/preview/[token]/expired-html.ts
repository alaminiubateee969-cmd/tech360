// Honest, brand-styled pages shown when a tokenized preview link is dead.
// Shared by the preview token routes so every outcome looks intentional.
const SHELL = (title: string, message: string, cta: string, tone: 'expired' | 'gone') => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${title} — Tech360</title>
<style>
  :root { color-scheme: light; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Inter, sans-serif;
    background: #F6F9FC;
    color: #0B1F33;
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .card {
    max-width: 520px; width: 100%;
    background: #fff;
    border: 1px solid #E2E8F0;
    border-radius: 18px;
    padding: 48px 40px;
    text-align: center;
    box-shadow: 0 20px 50px -30px rgba(6,59,143,0.25);
  }
  .badge {
    width: 64px; height: 64px; margin: 0 auto 24px;
    border-radius: 18px;
    display: flex; align-items: center; justify-content: center;
    background: ${tone === 'expired' ? '#FFF4E5' : '#FDECEC'};
  }
  .badge svg { width: 30px; height: 30px; }
  h1 { font-size: 24px; letter-spacing: -0.02em; margin-bottom: 12px; }
  p { font-size: 15px; line-height: 1.65; color: #526173; margin-bottom: 8px; }
  .meta { font-size: 12.5px; color: #94A3B8; margin-top: 4px; }
  .cta {
    display: inline-block; margin-top: 28px;
    padding: 13px 28px;
    background: #063B8F;
    color: #fff; font-weight: 600; font-size: 14px;
    text-decoration: none; border-radius: 10px;
  }
  .cta:hover { background: #0B52C7; }
  .identity { margin-top: 32px; padding-top: 20px; border-top: 1px solid #E2E8F0; font-size: 11.5px; color: #94A3B8; line-height: 1.7; }
</style>
</head>
<body>
  <main class="card" role="main">
    <div class="badge" aria-hidden="true">
      ${tone === 'expired'
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="#E11D48" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>'}
    </div>
    <h1>${title}</h1>
    <p>${message}</p>
    <p class="cta-row"><a class="cta" href="mailto:info@bdtech360.com?subject=Preview%20link%20request">${cta}</a></p>
    <div class="identity">
      TECH360 LLC · Missouri LC014737249 · EIN 98-1940053<br>
      117 S Lexington St Ste 100, Harrisonville, MO · info@bdtech360.com
    </div>
  </main>
</body>
</html>`

export function previewExpiredHtml(): string {
  return SHELL(
    'This preview link has expired',
    'Preview links are valid for a limited period for security. Your project details are safe with Tech360 — request a fresh link and we will re-issue it right away.',
    'Request a fresh preview link',
    'expired',
  )
}

export function previewGoneHtml(title: string, message: string): string {
  return SHELL(title, message, 'Contact Tech360', 'gone')
}
