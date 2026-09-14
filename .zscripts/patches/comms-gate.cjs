const fs = require('fs')
const f = 'src/lib/comms.ts'
let src = fs.readFileSync(f, 'utf8')

const old = `  let result: SendResult
  switch (entry.channel) {
    case 'WHATSAPP':
      result = await sendWhatsApp(entry.to ?? '', entry.body)
      break`

const replacement = `  // ---- Super Admin channel switches (REAL backend enforcement) ----
  // When a channel is switched OFF, the send attempt is refused honestly
  // (the Communication record is still kept, status DISABLED_BY_ADMIN) —
  // records stay for the audit trail, but nothing is ever sent.
  const channelFlag: Record<string, 'whatsapp' | 'email' | 'sms'> = { WHATSAPP: 'whatsapp', EMAIL: 'email', SMS: 'sms' }
  const flag = channelFlag[entry.channel]
  if (flag) {
    const { featureEnabled } = await import('@/lib/features')
    if (!(await featureEnabled(flag))) {
      const disabled: SendResult = { ok: false, status: 'DISABLED_BY_ADMIN', error: entry.channel + ' channel is switched OFF by Super Admin — send refused (record kept)' }
      await db.communication.update({ where: { id: comm.id }, data: { status: disabled.status, error: disabled.error ?? null, sentAt: null } })
      return { communicationId: comm.id, result: disabled }
    }
  }

  let result: SendResult
  switch (entry.channel) {
    case 'WHATSAPP':
      result = await sendWhatsApp(entry.to ?? '', entry.body)
      break`

if (!src.includes(old)) {
  console.error('PATTERN NOT FOUND')
  process.exit(1)
}
src = src.replace(old, replacement)
fs.writeFileSync(f, src)
console.log('comms gated')
