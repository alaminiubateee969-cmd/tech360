// Runtime smoke-import of every REBUILD-B module (mirrors worklog round 2-b verification)
async function tryImport(p: string) {
  try {
    await import(p)
    console.log('OK  ', p)
  } catch (e) {
    console.log('FAIL', p, '→', e instanceof Error ? e.message : String(e))
    process.exitCode = 1
  }
}
await tryImport('../src/lib/newsletter')
await tryImport('../src/components/admin/NewsletterView')
await tryImport('../src/components/admin/AnalyticsView')
await tryImport('../src/components/admin/LeadsView')
await tryImport('../src/components/site/SiteFooter')
