/** Browser-side decision handler shared by newly generated and legacy previews. */
export const PREVIEW_CLIENT_SCRIPT = `<script data-tech360-preview-handler="v2">
(function(){
  var token = location.pathname.split('/').pop();
  var approve = document.getElementById('approveBtn');
  var revise = document.getElementById('reviseBtn');
  var status = document.getElementById('previewDecisionStatus');
  if (!status) {
    status = document.createElement('p');
    status.id = 'previewDecisionStatus';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    var parent = approve && approve.parentNode;
    if (parent) parent.appendChild(status);
  }
  var busy = false;
  var completed = false;
  function setStatus(message) { status.textContent = message; }
  function setDisabled(value) {
    [approve, revise].forEach(function(button) {
      if (button) button.setAttribute('aria-disabled', value ? 'true' : 'false');
    });
  }
  async function submit(decision, notes) {
    if (busy || completed) return;
    busy = true;
    setDisabled(true);
    setStatus('Recording your response…');
    try {
      var response = await fetch('/api/preview/' + encodeURIComponent(token) + '/action', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({decision: decision, notes: notes || ''})
      });
      var data;
      try { data = await response.json(); } catch (_) { data = null; }
      if (!response.ok || !data || data.ok !== true || typeof data.message !== 'string') {
        var error = data && typeof data.error === 'string' ? data.error : 'We could not confirm your response. Please contact info@bdtech360.com before trying again.';
        setStatus(error);
        return;
      }
      completed = true;
      setStatus(data.message);
    } catch (_) {
      setStatus('Connection interrupted. Your response may already have been recorded; check with info@bdtech360.com before trying again.');
    } finally {
      busy = false;
      if (!completed) setDisabled(false);
    }
  }
  if (approve) approve.addEventListener('click', function(event) { event.preventDefault(); void submit('APPROVED', ''); });
  if (revise) revise.addEventListener('click', function(event) {
    event.preventDefault();
    if (busy || completed) return;
    var notes = prompt('Please describe your change requests:');
    if (notes === null) return;
    if (notes.trim().length < 5) { setStatus('Please describe your change requests using at least 5 characters.'); return; }
    void submit('REVISION_REQUESTED', notes);
  });
  fetch('/api/preview/' + encodeURIComponent(token) + '/view', {method:'POST'}).catch(function(){});
})();
</script>`

/**
 * Upgrade only the known, first-party legacy handler while serving saved HTML.
 * Unknown customer content is returned unchanged; nothing is written to the DB.
 */
export function upgradeLegacyPreviewHandler(html: string): string {
  if (html.includes('data-tech360-preview-handler="v2"')) return html
  return html.replace(/<script>\s*\(function\(\)\{(?=(?:(?!<\/script>)[\s\S])*?var a=document\.getElementById\('approveBtn'\);)(?=(?:(?!<\/script>)[\s\S])*?var r=document\.getElementById\('reviseBtn'\);)(?=(?:(?!<\/script>)[\s\S])*?fetch\('\/api\/preview\/')(?:(?!<\/script>)[\s\S])*?<\/script>/, PREVIEW_CLIENT_SCRIPT)
}
