// ============================================================
// TECH360 NOTIFY RELAY — real-time push for the admin console.
// Port: 3032.
//
// SECURITY MODEL (deliberate):
//   - Socket clients are NOT authenticated here. The only thing
//     this relay ever broadcasts is a "ping" — { kind, severity,
//     ts } — containing ZERO business data, zero titles, zero
//     client identifiers. It is a "refetch now" signal.
//   - The actual notification feed is fetched by the browser
//     from the platform's authenticated, CSRF-protected
//     /api/admin/notifications endpoint. A listening stranger
//     learns nothing but the fact that something happened.
//   - The POST /emit endpoint is for the PLATFORM ONLY and is
//     guarded by a shared token (NOTIFY_RELAY_TOKEN, default
//     dev token; Secret Manager supplies it in production).
//
// In production the relay and the platform run in the same
// Cloud Run service (side-by-side process) or the emit call is
// simply skipped — notification polling (60s) stays as the
// honest fallback in every deployment.
// ============================================================

import { createServer } from 'node:http'
import { Server, type Socket } from 'socket.io'

const PORT = 3032
const TOKEN = process.env.NOTIFY_RELAY_TOKEN ?? 'tech360-notify-dev-token'

const httpServer = createServer((req, res) => {
  // Tiny HTTP surface: health + emit.
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      ok: true,
      service: 'tech360-notify-relay',
      connections: io.engine.clientsCount,
      pings: state.pings,
      lastPingAt: state.lastPingAt,
      uptimeSec: Math.round(process.uptime()),
    }))
    return
  }

  if (req.method === 'POST' && url.pathname === '/emit') {
    const provided = req.headers['x-relay-token']
    if (provided !== TOKEN) {
      res.writeHead(401, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'unauthorized' }))
      return
    }
    let body = ''
    req.on('data', (c) => { body += c; if (body.length > 4096) req.destroy() })
    req.on('end', () => {
      let payload: Record<string, unknown> = {}
      try { payload = body ? JSON.parse(body) : {} } catch { /* ping with no body is fine */ }
      // Strip everything except the whitelisted ping shape.
      const ping = {
        kind: typeof payload.kind === 'string' ? payload.kind.slice(0, 40) : 'notify',
        severity: ['INFO', 'WARNING', 'CRITICAL'].includes(String(payload.severity)) ? String(payload.severity) : 'INFO',
        ts: new Date().toISOString(),
      }
      state.pings += 1
      state.lastPingAt = ping.ts
      io.emit('notify', ping) // broadcast to every connected console
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ ok: true, delivered: io.engine.clientsCount }))
    })
    return
  }

  res.writeHead(404, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: 'not found' }))
})

const io = new Server(httpServer, {
  cors: { origin: true, credentials: false },
  // path stays the default "/" so the Caddy gateway (XTransformPort) forwards cleanly.
})

const state = { pings: 0, lastPingAt: null as string | null }

io.on('connection', (socket: Socket) => {
  // Welcome ping so a freshly opened console knows the channel works.
  socket.emit('hello', { ok: true, ts: new Date().toISOString() })
})

httpServer.listen(PORT, () => {
  console.log(`[notify-relay] listening on :${PORT} — ping-only relay, no business data crosses this socket`)
})
