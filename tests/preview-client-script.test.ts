import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { runInNewContext } from 'node:vm'
import { PREVIEW_CLIENT_SCRIPT, upgradeLegacyPreviewHandler } from '../src/lib/preview-client-script'

type Button = { parentNode: { appendChild: (node: unknown) => void }; setAttribute: (name: string, value: string) => void; addEventListener: (name: string, fn: (event: { preventDefault: () => void }) => void) => void }

function browser(action: () => Promise<unknown>) {
  const listeners: Record<string, (event: { preventDefault: () => void }) => void> = {}
  const attributes: Record<string, string> = {}
  const status = { textContent: '', id: '', setAttribute() {} }
  const parent = { appendChild() {} }
  const button = (id: string): Button => ({
    parentNode: parent,
    setAttribute(name, value) { attributes[`${id}:${name}`] = value },
    addEventListener(_name, fn) { listeners[id] = fn },
  })
  const buttons = { approveBtn: button('approveBtn'), reviseBtn: button('reviseBtn') }
  let actions = 0
  const fetch = (url: string) => url.endsWith('/view') ? Promise.resolve({}) : (actions++, action())
  runInNewContext(PREVIEW_CLIENT_SCRIPT.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''), {
    document: { getElementById: (id: string) => buttons[id as keyof typeof buttons] ?? null, createElement: () => status },
    location: { pathname: '/api/preview/abc123' }, fetch, encodeURIComponent, prompt: () => 'Please update this preview',
  })
  return { click: (id: string) => listeners[id]({ preventDefault() {} }), status, attributes, actionCount: () => actions }
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve))

describe('preview decision client', () => {
  it('shows pending, sends only once while pending and shows server-confirmed success', async () => {
    let resolve!: (value: unknown) => void
    const pending = new Promise((r) => { resolve = r })
    const page = browser(() => pending)
    page.click('approveBtn')
    page.click('approveBtn')
    assert.match(page.status.textContent, /Recording/)
    assert.equal(page.actionCount(), 1)
    resolve({ ok: true, json: async () => ({ ok: true, message: 'Approval recorded.' }) })
    await tick()
    assert.equal(page.status.textContent, 'Approval recorded.')
    page.click('reviseBtn')
    assert.equal(page.actionCount(), 1)
    assert.equal(page.attributes['approveBtn:aria-disabled'], 'true')
  })

  it('shows API errors for both decisions and never treats them as success', async () => {
    for (const button of ['approveBtn', 'reviseBtn']) {
      const page = browser(async () => ({ ok: false, json: async () => ({ error: 'This preview is expired.' }) }))
      page.click(button)
      await tick()
      assert.equal(page.status.textContent, 'This preview is expired.')
      assert.equal(page.attributes['approveBtn:aria-disabled'], 'false')
    }
  })

  it('reports invalid JSON, invalid success payloads, and network uncertainty', async () => {
    const responses = [
      async () => ({ ok: true, json: async () => { throw new Error('bad json') } }),
      async () => ({ ok: true, json: async () => ({ ok: false, message: 'not recorded' }) }),
      async () => { throw new Error('network') },
    ]
    for (const response of responses) {
      const page = browser(response)
      page.click('approveBtn')
      await tick()
      assert.match(page.status.textContent, /could not confirm|may already have been recorded/i)
      assert.doesNotMatch(page.status.textContent, /not recorded/)
    }
  })

  it('only replaces the known legacy script when serving old previews', () => {
    const legacy = `<html><script>
(function(){
  var t = location.pathname.split('/').pop();
  function act(decision){
    fetch('/api/preview/' + t + '/action', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision:decision})})
      .then(function(r){return r.json()}).then(function(d){
        alert(decision==='APPROVED' ? 'Thank you! Your approval was recorded. Team Tech360 will continue with payment instructions.' : 'Thank you! Your change request was recorded. Team Tech360 will review it.');
      }).catch(function(){ alert('Could not record — please contact info@bdtech360.com'); });
  }
  var a=document.getElementById('approveBtn'); if(a) a.addEventListener('click',function(e){e.preventDefault();act('APPROVED');});
  var r=document.getElementById('reviseBtn'); if(r) r.addEventListener('click',function(e){e.preventDefault();var n=prompt('Please describe your change requests:'); if(n) fetch('/api/preview/'+t+'/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision:'REVISION_REQUESTED',notes:n})}).then(function(){alert('Change request recorded. Thank you!');});});
  fetch('/api/preview/' + t + '/view', {method:'POST'}).catch(function(){});
})();
</script></html>`
    assert.equal(upgradeLegacyPreviewHandler(legacy), `<html>${PREVIEW_CLIENT_SCRIPT}</html>`)
    assert.equal(upgradeLegacyPreviewHandler('<script>custom()</script>'), '<script>custom()</script>')
    assert.equal(upgradeLegacyPreviewHandler(PREVIEW_CLIENT_SCRIPT), PREVIEW_CLIENT_SCRIPT)
  })
})
