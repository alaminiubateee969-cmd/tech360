import { createHmac } from 'crypto'
import { signUnsubToken, verifyUnsubToken } from '../src/lib/newsletter'
const email = 'curl.test+probe@example.com'
const t = signUnsubToken(email)
console.log('TOKEN=' + t)
console.log('verify roundtrip:', verifyUnsubToken(t))
console.log('verify garbage:', verifyUnsubToken('newsletter-unsub.eCurl.test.9999.deadbeef'))
const enc = Buffer.from(email).toString('base64url')
const expiredSig = createHmac('sha256', 'tech360-newsletter-dev-secret').update(`newsletter-unsub.${enc}.1000`).digest('hex')
console.log('verify expired (proper sig):', verifyUnsubToken(`newsletter-unsub.${enc}.1000.${expiredSig}`))
console.log('verify tampered:', verifyUnsubToken(t.slice(0, -2) + 'ff'))
