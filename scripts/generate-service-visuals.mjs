#!/usr/bin/env node
/**
 * TECH360 — Bespoke 1600×1000 (16:10) Enterprise Visual Generator
 *
 * Generates distinct, high-resolution dark-sapphire glassmorphic visuals in WebP
 * for:
 *   1. The 11 remaining services under `public/images/services/<slug>.webp`
 *      (complementing the 10 AI-rendered 3D dark-sapphire visuals so all 21
 *      canonical services share one unified visual language).
 *   2. All 6 Platform showcase modules under `public/images/platform/<key>.webp`.
 *   3. All 8 Case-Study delivery blueprints under `public/images/case-studies/<slug>.webp`.
 *
 * Every asset is rendered natively at 1600×1000 (16:10) sRGB WebP with zero
 * watermarks, zero stock reuse, and crisp vector/glassmorphic geometry.
 */

import { mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const W = 1600
const H = 1000

const FONT = 'DejaVu Sans, Liberation Sans, Helvetica, Arial, sans-serif'
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function baseDefs(accentA = '#009FE3', accentB = '#18B83A', glowX = 50, glowY = 46) {
  return `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#030B17"/>
      <stop offset="52%" stop-color="#071930"/>
      <stop offset="100%" stop-color="#041022"/>
    </linearGradient>
    <radialGradient id="ambientA" cx="${glowX}%" cy="${glowY}%" r="54%">
      <stop offset="0%" stop-color="${accentA}" stop-opacity="0.26"/>
      <stop offset="55%" stop-color="#063B8F" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#030B17" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ambientB" cx="${100 - glowX}%" cy="${100 - glowY + 10}%" r="46%">
      <stop offset="0%" stop-color="${accentB}" stop-opacity="0.19"/>
      <stop offset="100%" stop-color="#030B17" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#112C4E" stop-opacity="0.88"/>
      <stop offset="100%" stop-color="#08182E" stop-opacity="0.92"/>
    </linearGradient>
    <linearGradient id="glassBright" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#173D6B" stop-opacity="0.92"/>
      <stop offset="100%" stop-color="#0A1F3B" stop-opacity="0.94"/>
    </linearGradient>
    <linearGradient id="strokeCyan" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#6FE3FF" stop-opacity="0.85"/>
      <stop offset="55%" stop-color="#009FE3" stop-opacity="0.40"/>
      <stop offset="100%" stop-color="#18B83A" stop-opacity="0.65"/>
    </linearGradient>
    <linearGradient id="pipeCyan" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#009FE3"/>
      <stop offset="100%" stop-color="#3AE8FF"/>
    </linearGradient>
    <linearGradient id="pipeGreen" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#009FE3"/>
      <stop offset="100%" stop-color="#18B83A"/>
    </linearGradient>
    <linearGradient id="emeraldFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2CE558"/>
      <stop offset="100%" stop-color="#118F2E"/>
    </linearGradient>
    <linearGradient id="cyanFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#3CD0FF"/>
      <stop offset="100%" stop-color="#007BB8"/>
    </linearGradient>
    <filter id="glow" filterUnits="userSpaceOnUse" x="-120" y="-120" width="1840" height="1240">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="softShadow" x="-15%" y="-15%" width="130%" height="135%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#01060E" flood-opacity="0.65"/>
    </filter>
  </defs>`
}

function stageGrid(seed = 0) {
  const lines = []
  for (let x = -300; x <= 1900; x += 110) {
    lines.push(`<line x1="${x}" y1="1000" x2="${800 + (x - 800) * 0.42}" y2="260" stroke="#1A4472" stroke-opacity="0.22" stroke-width="1"/>`)
  }
  for (let y = 320; y <= 980; y += 72) {
    lines.push(`<line x1="0" y1="${y}" x2="1600" y2="${y}" stroke="#1A4472" stroke-opacity="0.16" stroke-width="1"/>`)
  }
  const dots = [
    [168, 148, 3], [1420, 162, 3.5], [1310, 820, 2.5], [240, 845, 3],
    [780 + (seed % 5) * 24, 112, 2.5], [1465, 510, 3], [118, 520, 2.5],
  ].map(([cx, cy, r], i) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${i % 2 === 0 ? '#3CD0FF' : '#2CE558'}" opacity="0.55"/>`)
  return `<rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#ambientA)"/>
  <rect width="${W}" height="${H}" fill="url(#ambientB)"/>
  <g>${lines.join('')}${dots.join('')}</g>`
}

function card(x, y, w, h, { r = 24, bright = false, stroke = 'url(#strokeCyan)', sw = 1.8 } = {}) {
  return `<g filter="url(#softShadow)">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${bright ? 'url(#glassBright)' : 'url(#glass)'}" stroke="${stroke}" stroke-width="${sw}"/>
    <line x1="${x + r}" y1="${y + 1.5}" x2="${x + w - r}" y2="${y + 1.5}" stroke="#9BEBFF" stroke-opacity="0.45" stroke-width="1.5"/>
  </g>`
}

function windowDots(x, y) {
  return `<circle cx="${x}" cy="${y}" r="5.5" fill="#FF5F56" opacity="0.85"/>
    <circle cx="${x + 18}" cy="${y}" r="5.5" fill="#FFBD2E" opacity="0.85"/>
    <circle cx="${x + 36}" cy="${y}" r="5.5" fill="#27C93F" opacity="0.85"/>`
}

function bar(x, y, w, h = 10, fill = '#235180', r = 5, opacity = 1) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" opacity="${opacity}"/>`
}

function pill(x, y, label, { bg = '#0B3559', border = '#009FE3', color = '#8FE6FF', size = 13, h = 28 } = {}) {
  const w = Math.round(label.length * size * 0.72 + 34)
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="${bg}" stroke="${border}" stroke-opacity="0.65" stroke-width="1.2"/>
    <text x="${x + w / 2}" y="${y + h / 2 + size * 0.35}" font-family="${FONT}" font-size="${size}" font-weight="700" fill="${color}" text-anchor="middle" letter-spacing="0.4">${esc(label)}</text>
  </g>`
}

function txt(x, y, s, { size = 16, weight = 600, fill = '#E6F4FF', anchor = 'start', opacity = 1 } = {}) {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" opacity="${opacity}">${esc(s)}</text>`
}

function checkBadge(cx, cy, r = 26) {
  return `<g filter="url(#glow)">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#emeraldFill)" stroke="#95FFB0" stroke-width="2"/>
    <path d="M${cx - r * 0.38} ${cy + 1} L${cx - r * 0.1} ${cy + r * 0.3} L${cx + r * 0.42} ${cy - r * 0.28}" fill="none" stroke="#FFFFFF" stroke-width="${Math.max(3, r * 0.16)}" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`
}

function shieldLock(cx, cy, s = 54, stroke = '#3CD0FF', fill = '#0B365C') {
  return `<g filter="url(#glow)">
    <path d="M${cx} ${cy - s} L${cx + s * 0.82} ${cy - s * 0.62} V${cy + s * 0.08} C${cx + s * 0.82} ${cy + s * 0.62} ${cx + s * 0.36} ${cy + s * 0.96} ${cx} ${cy + s * 1.12} C${cx - s * 0.36} ${cy + s * 0.96} ${cx - s * 0.82} ${cy + s * 0.62} ${cx - s * 0.82} ${cy + s * 0.08} V${cy - s * 0.62} Z" fill="${fill}" stroke="${stroke}" stroke-width="3"/>
    <rect x="${cx - s * 0.28}" y="${cy - s * 0.05}" width="${s * 0.56}" height="${s * 0.46}" rx="6" fill="${stroke}"/>
    <path d="M${cx - s * 0.18} ${cy - s * 0.05} V${cy - s * 0.24} A${s * 0.18} ${s * 0.18} 0 0 1 ${cx + s * 0.18} ${cy - s * 0.24} V${cy - s * 0.05}" fill="none" stroke="${stroke}" stroke-width="4" stroke-linecap="round"/>
  </g>`
}

function glowPipe(d, color = '#2AD4FF', w = 4) {
  return `<g filter="url(#glow)">
    <path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>
  </g>`
}

/* ================================================================== */
/* 11 REMAINING SERVICE SCENES                                        */
/* ================================================================== */

const SERVICE_SCENES = {
  'whatsapp-cloud-api-integration': () => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${baseDefs('#009FE3', '#18B83A', 50, 48)}${stageGrid(1)}
    <!-- Left: Approved Template Cards -->
    ${card(96, 175, 360, 650)}
    ${windowDots(132, 212)}
    ${pill(210, 198, 'VERIFIED TEMPLATES', { size: 11, h: 24 })}
    ${[0, 1, 2].map((i) => {
      const y = 258 + i * 182
      const labels = ['ORDER_STATUS_V2', 'APPOINTMENT_CONFIRM', 'INVOICE_RECEIPT']
      return `<rect x="128" y="${y}" width="296" height="154" rx="16" fill="#0B223E" stroke="#1E4D7B" stroke-width="1.5"/>
        ${pill(148, y + 18, labels[i], { bg: '#0E395E', border: '#2CE558', color: '#8CFFA8', size: 11, h: 24 })}
        ${bar(148, y + 60, 230, 10, '#3CD0FF', 5, 0.75)}
        ${bar(148, y + 82, 185, 9, '#25527E')}
        ${bar(148, y + 102, 210, 9, '#25527E')}
        ${checkBadge(392, y + 30, 14)}`
    }).join('')}
    <!-- Center: Official Cloud API Gateway + TLS Shield -->
    ${glowPipe('M456 335 C540 335, 560 440, 635 465', '#2AD4FF', 4)}
    ${glowPipe('M456 517 L635 500', '#2CE558', 4)}
    ${glowPipe('M456 700 C540 700, 560 560, 635 535', '#2AD4FF', 4)}
    ${card(625, 290, 350, 420, { bright: true, r: 30 })}
    <circle cx="800" cy="455" r="96" fill="#072544" stroke="#3CD0FF" stroke-width="2.5" filter="url(#glow)"/>
    ${shieldLock(800, 452, 46, '#3CD0FF', '#0A335C')}
    ${txt(800, 594, 'OFFICIAL CLOUD API GATEWAY', { size: 15, weight: 700, fill: '#9BEBFF', anchor: 'middle' })}
    ${pill(686, 622, 'HMAC SHA-256 · TLS 1.3', { bg: '#0A3B2E', border: '#2CE558', color: '#9CFFB4', size: 12, h: 28 })}
    <!-- Right: Webhook Event Stream & Delivery Receipts -->
    ${glowPipe('M975 450 C1050 450, 1065 320, 1140 320', '#2AD4FF', 4)}
    ${glowPipe('M975 500 L1140 500', '#2CE558', 4)}
    ${glowPipe('M975 550 C1050 550, 1065 685, 1140 685', '#2AD4FF', 4)}
    ${card(1140, 175, 364, 650)}
    ${windowDots(1176, 212)}
    ${pill(1255, 198, 'WEBHOOK TELEMETRY', { size: 11, h: 24 })}
    ${[
      ['200 OK · DELIVERED', '#2CE558', 268],
      ['200 OK · READ RECEIPT', '#3CD0FF', 432],
      ['RATE QUALITY · HIGH', '#2CE558', 596],
    ].map(([label, col, y]) => `<rect x="1172" y="${y}" width="300" height="134" rx="16" fill="#0B223E" stroke="${col}" stroke-opacity="0.55" stroke-width="1.5"/>
      ${txt(1196, y + 36, label, { size: 13, weight: 700, fill: col })}
      ${bar(1196, y + 58, 240, 10, col, 5, 0.65)}
      ${bar(1196, y + 80, 190, 9, '#234E78')}
      ${bar(1196, y + 100, 150, 9, '#234E78')}`).join('')}
  </svg>`,

  'email-automation': () => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${baseDefs('#009FE3', '#18B83A', 42, 46)}${stageGrid(2)}
    <!-- Left: Authenticated Domain Ring (SPF / DKIM / DMARC) -->
    ${card(95, 225, 420, 550, { bright: true })}
    <circle cx="305" cy="445" r="132" fill="none" stroke="#1E568A" stroke-width="2" stroke-dasharray="8 8"/>
    <circle cx="305" cy="445" r="100" fill="#07223F" stroke="#3CD0FF" stroke-width="2.5" filter="url(#glow)"/>
    <!-- Crisp envelope icon -->
    <rect x="243" y="403" width="124" height="84" rx="12" fill="#0E3B68" stroke="#7CE8FF" stroke-width="3"/>
    <path d="M247 411 L305 454 L363 411" fill="none" stroke="#7CE8FF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${checkBadge(356, 404, 18)}
    ${pill(142, 265, 'SPF · PASS', { bg: '#0A3B2E', border: '#2CE558', color: '#9CFFB4', size: 12 })}
    ${pill(265, 265, 'DKIM · SIGNED', { bg: '#0B3559', border: '#3CD0FF', color: '#9BEBFF', size: 12 })}
    ${pill(205, 622, 'DMARC ALIGNED', { bg: '#0A3B2E', border: '#2CE558', color: '#9CFFB4', size: 13, h: 30 })}
    ${bar(155, 678, 300, 10, '#255585')}
    ${bar(185, 700, 240, 10, '#1B4168')}
    <!-- Branching Sequence Flows -->
    ${glowPipe('M515 415 C635 415, 650 250, 770 250', '#3CD0FF', 4.5)}
    ${glowPipe('M515 475 L770 495', '#2CE558', 4.5)}
    ${glowPipe('M515 535 C635 535, 650 740, 770 740', '#3CD0FF', 4.5)}
    <!-- Right: 3 Triggered Lifecycle Lanes -->
    ${[
      { y: 155, tag: 'TRIGGER · ENQUIRY RECEIVED', sub: 'Instant Client ID & Intake Summary', accent: '#3CD0FF' },
      { y: 405, tag: 'TRIGGER · SCOPE & INVOICE', sub: 'Transactional PDF & Approval Record', accent: '#2CE558' },
      { y: 655, tag: 'TRIGGER · MILESTONE UPDATE', sub: 'Logged Against CRM Client Timeline', accent: '#3CD0FF' },
    ].map((lane) => `
      ${card(770, lane.y, 730, 190)}
      ${pill(806, lane.y + 26, lane.tag, { bg: '#0C3358', border: lane.accent, color: '#B4F2FF', size: 12 })}
      ${txt(806, lane.y + 84, lane.sub, { size: 18, weight: 700, fill: '#F0F8FF' })}
      ${bar(806, lane.y + 108, 430, 11, lane.accent, 5.5, 0.72)}
      ${bar(806, lane.y + 132, 320, 9, '#234F7C')}
      ${checkBadge(1432, lane.y + 95, 26)}
    `).join('')}
  </svg>`,

  'sms-automation': () => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${baseDefs('#009FE3', '#18B83A', 35, 50)}${stageGrid(3)}
    <!-- Left: High-availability SMS Gateway Relay -->
    ${card(96, 210, 430, 580, { bright: true })}
    ${windowDots(132, 248)}
    ${pill(212, 234, 'TRANSACTIONAL SMS GATEWAY', { size: 11, h: 24 })}
    <!-- Signal tower & wave rings -->
    <circle cx="311" cy="445" r="120" fill="none" stroke="#3CD0FF" stroke-opacity="0.28" stroke-width="2.5"/>
    <circle cx="311" cy="445" r="82" fill="none" stroke="#3CD0FF" stroke-opacity="0.55" stroke-width="2.5"/>
    <circle cx="311" cy="445" r="44" fill="#0B3B66" stroke="#3CD0FF" stroke-width="3" filter="url(#glow)"/>
    <path d="M311 425 L293 525 H329 Z" fill="#7CE8FF"/>
    <circle cx="311" cy="422" r="10" fill="#2CE558" filter="url(#glow)"/>
    ${pill(156, 610, 'SECRET MANAGER CREDENTIALS', { bg: '#0B3559', border: '#3CD0FF', color: '#9BEBFF', size: 11 })}
    ${pill(184, 650, 'AUTO-RETRY & DLT LOGGING', { bg: '#0A3B2E', border: '#2CE558', color: '#9CFFB4', size: 11 })}
    ${bar(156, 708, 310, 10, '#27598B')}
    <!-- Signal beams to 3 mobile devices -->
    ${glowPipe('M526 390 C620 390, 630 280, 710 280', '#3CD0FF', 4)}
    ${glowPipe('M526 465 L985 465', '#2CE558', 4)}
    ${glowPipe('M526 540 C620 540, 630 660, 1260 660', '#3CD0FF', 4)}
    <!-- Three Sleek Mobile Handsets -->
    ${[
      { x: 675, y: 170, tag: 'OTP VERIFY', accent: '#3CD0FF' },
      { x: 965, y: 225, tag: 'REMINDER', accent: '#2CE558' },
      { x: 1255, y: 170, tag: 'DISPATCH ALERT', accent: '#3CD0FF' },
    ].map((m) => `
      ${card(m.x, m.y, 255, 595, { r: 34 })}
      <rect x="${m.x + 82}" y="${m.y + 18}" width="90" height="8" rx="4" fill="#1D446B"/>
      <rect x="${m.x + 22}" y="${m.y + 52}" width="211" height="495" rx="20" fill="#061528" stroke="#183C63" stroke-width="1.5"/>
      ${pill(m.x + 40, m.y + 84, m.tag, { bg: '#0D3559', border: m.accent, color: '#B4F2FF', size: 11, h: 26 })}
      <rect x="${m.x + 38}" y="${m.y + 134}" width="179" height="122" rx="14" fill="#0D2C4D" stroke="${m.accent}" stroke-opacity="0.65" stroke-width="1.5"/>
      ${bar(m.x + 56, m.y + 162, 132, 10, m.accent, 5, 0.85)}
      ${bar(m.x + 56, m.y + 184, 108, 9, '#2A5B8A')}
      ${bar(m.x + 56, m.y + 206, 142, 9, '#2A5B8A')}
      ${checkBadge(m.x + 127, m.y + 340, 30)}
      ${pill(m.x + 58, m.y + 392, 'DELIVERED', { bg: '#0A3B2E', border: '#2CE558', color: '#9CFFB4', size: 11, h: 26 })}
      ${bar(m.x + 52, m.y + 450, 150, 8, '#1E466E')}
      ${bar(m.x + 68, m.y + 470, 118, 8, '#1E466E')}
    `).join('')}
  </svg>`,

  'n8n-workflow-automation': () => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${baseDefs('#009FE3', '#18B83A', 52, 48)}${stageGrid(4)}
    <!-- Main Orchestration Canvas -->
    ${card(84, 110, 1432, 780, { r: 28 })}
    ${windowDots(124, 150)}
    ${pill(205, 135, 'SELF-HOSTED WORKFLOW ENGINE · VERSIONED & LOGGED', { size: 12, h: 26 })}
    ${pill(1255, 135, 'EXECUTION · HEALTHY', { bg: '#0A3B2E', border: '#2CE558', color: '#9CFFB4', size: 12, h: 26 })}
    <!-- Bezier Node Connections -->
    ${glowPipe('M360 470 L535 470', '#3CD0FF', 4.5)}
    ${glowPipe('M765 440 C855 440, 865 295, 960 295', '#3CD0FF', 4.5)}
    ${glowPipe('M765 500 C855 500, 865 645, 960 645', '#2CE558', 4.5)}
    ${glowPipe('M1190 295 C1255 295, 1260 440, 1300 455', '#3CD0FF', 4)}
    ${glowPipe('M1190 645 C1255 645, 1260 500, 1300 485', '#2CE558', 4)}
    <!-- Trigger Node -->
    ${card(140, 380, 220, 180, { bright: true, r: 22 })}
    <circle cx="250" cy="444" r="28" fill="#0B3B68" stroke="#3CD0FF" stroke-width="2.5" filter="url(#glow)"/>
    <path d="M254 428 L239 448 H252 L246 462 L263 441 H250 Z" fill="#6FE3FF"/>
    ${txt(250, 504, 'WEBHOOK TRIGGER', { size: 13, weight: 700, fill: '#B4F2FF', anchor: 'middle' })}
    ${bar(185, 522, 130, 8, '#295D8E')}
    <!-- Validation & Router Node -->
    ${card(535, 365, 230, 210, { bright: true, r: 22 })}
    <rect x="622" y="405" width="56" height="56" rx="12" transform="rotate(45 650 433)" fill="#0D3C68" stroke="#3CD0FF" stroke-width="2.5" filter="url(#glow)"/>
    ${txt(650, 512, 'SCHEMA & POLICY', { size: 13, weight: 700, fill: '#E6F4FF', anchor: 'middle' })}
    ${pill(582, 528, 'IDEMPOTENT', { size: 11, h: 24 })}
    <!-- Top Branch: CRM + Secret Vault -->
    ${card(960, 205, 230, 180, { r: 22 })}
    ${shieldLock(1075, 268, 26, '#3CD0FF', '#0B3559')}
    ${txt(1075, 328, 'CRM & DB SYNC', { size: 13, weight: 700, fill: '#B4F2FF', anchor: 'middle' })}
    ${bar(1005, 346, 140, 8, '#295D8E')}
    <!-- Bottom Branch: Retry + Human Escalation -->
    ${card(960, 555, 230, 180, { r: 22 })}
    <circle cx="1075" cy="620" r="28" fill="#0A3B2E" stroke="#2CE558" stroke-width="2.5"/>
    <path d="M1062 615 A15 15 0 1 1 1064 632" fill="none" stroke="#8CFFA8" stroke-width="3" stroke-linecap="round"/>
    ${txt(1075, 678, 'RETRY & AUDIT LOG', { size: 13, weight: 700, fill: '#9CFFB4', anchor: 'middle' })}
    ${bar(1005, 696, 140, 8, '#1E5B45')}
    <!-- Final Verified Output Node -->
    ${card(1290, 380, 180, 180, { bright: true, r: 22 })}
    ${checkBadge(1380, 446, 30)}
    ${txt(1380, 510, 'COMPLETED', { size: 13, weight: 700, fill: '#9CFFB4', anchor: 'middle' })}
    ${bar(1325, 528, 110, 8, '#2CE558', 4, 0.7)}
    <!-- Bottom Execution Telemetry Bar -->
    <rect x="140" y="785" width="1330" height="64" rx="14" fill="#061629" stroke="#183D66" stroke-width="1.5"/>
    ${pill(165, 803, 'RUN #0482 · 142ms', { bg: '#0A3B2E', border: '#2CE558', color: '#9CFFB4', size: 11, h: 28 })}
    ${bar(370, 812, 620, 10, 'url(#pipeGreen)', 5)}
    ${txt(1440, 823, 'ZERO SILENT DROPS', { size: 12, weight: 700, fill: '#8FE6FF', anchor: 'end' })}
  </svg>`,

  'premium-business-websites': () => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${baseDefs('#009FE3', '#18B83A', 48, 45)}${stageGrid(5)}
    <!-- Desktop Flagship Browser Window -->
    ${card(130, 120, 1060, 680, { bright: true, r: 26 })}
    ${windowDots(170, 158)}
    <rect x="240" y="144" width="460" height="28" rx="14" fill="#071B34" stroke="#1E4D7A" stroke-width="1.2"/>
    ${txt(268, 163, 'https://yourcompany.com', { size: 12, weight: 600, fill: '#7FD4FF' })}
    ${pill(985, 144, 'CORE WEB VITALS · 99', { bg: '#0A3B2E', border: '#2CE558', color: '#9CFFB4', size: 11, h: 28 })}
    <!-- Inner Hero Canvas -->
    <rect x="166" y="196" width="988" height="285" rx="18" fill="url(#bg)" stroke="#215587" stroke-width="1.5"/>
    ${pill(204, 230, 'BESPOKE DESIGN SYSTEM', { size: 11, h: 24 })}
    ${bar(204, 276, 460, 22, '#EAF6FF', 8)}
    ${bar(204, 312, 370, 22, '#3CD0FF', 8)}
    ${bar(204, 354, 420, 11, '#4C7BA8', 5.5)}
    ${bar(204, 376, 340, 11, '#36618A', 5.5)}
    <rect x="204" y="410" width="156" height="42" rx="10" fill="url(#cyanFill)"/>
    <rect x="376" y="410" width="140" height="42" rx="10" fill="#0D2C4E" stroke="#3CD0FF" stroke-width="1.5"/>
    <!-- Right visual inside hero -->
    <rect x="740" y="226" width="376" height="225" rx="16" fill="#0B2748" stroke="#2D6CA6" stroke-width="1.5"/>
    <circle cx="845" cy="338" r="58" fill="none" stroke="#2CE558" stroke-width="10" filter="url(#glow)"/>
    ${txt(845, 345, 'A+', { size: 26, weight: 800, fill: '#9CFFB4', anchor: 'middle' })}
    ${bar(932, 286, 150, 12, '#3CD0FF', 6)}
    ${bar(932, 314, 126, 10, '#295D8E', 5)}
    ${bar(932, 340, 142, 10, '#2CE558', 5)}
    ${bar(932, 366, 110, 10, '#295D8E', 5)}
    <!-- 3 Feature Cards inside Browser -->
    ${[0, 1, 2].map((i) => {
      const x = 166 + i * 338
      return `<rect x="${x}" y="508" width="312" height="252" rx="16" fill="#091E38" stroke="#1E4B78" stroke-width="1.5"/>
        <rect x="${x + 24}" y="534" width="48" height="48" rx="12" fill="#0E3963" stroke="#3CD0FF" stroke-width="1.5"/>
        ${bar(x + 24, 604, 210, 14, '#D9EEFF', 6)}
        ${bar(x + 24, 634, 260, 10, '#2E5D8A', 5)}
        ${bar(x + 24, 654, 230, 10, '#244B73', 5)}
        ${bar(x + 24, 674, 190, 10, '#244B73', 5)}
        ${bar(x + 24, 716, 110, 10, '#3CD0FF', 5)}`
    }).join('')}
    <!-- Overlapping Mobile Responsive Viewport -->
    ${card(1110, 290, 360, 585, { bright: true, r: 38 })}
    <rect x="1240" y="314" width="100" height="8" rx="4" fill="#234F7C"/>
    <rect x="1138" y="344" width="304" height="498" rx="22" fill="#061529" stroke="#24588A" stroke-width="1.5"/>
    ${pill(1162, 372, 'MOBILE FIRST · SEO SCHEMA', { size: 10, h: 24 })}
    ${bar(1162, 418, 220, 18, '#EAF6FF', 6)}
    ${bar(1162, 446, 175, 18, '#3CD0FF', 6)}
    <rect x="1162" y="486" width="256" height="145" rx="14" fill="#0C2A4C" stroke="#2A659C" stroke-width="1.5"/>
    ${checkBadge(1290, 558, 28)}
    ${bar(1162, 658, 256, 12, '#2B5B88', 6)}
    ${bar(1162, 682, 210, 10, '#1F456B', 5)}
    <rect x="1162" y="768" width="256" height="46" rx="12" fill="url(#emeraldFill)"/>
  </svg>`,

  'enterprise-websites': () => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${baseDefs('#009FE3', '#18B83A', 50, 42)}${stageGrid(6)}
    <!-- Top Multi-Region Governance Header -->
    ${card(110, 110, 1380, 155, { bright: true, r: 22 })}
    ${pill(148, 142, 'ENTERPRISE GOVERNANCE · MULTI-REGION · RBAC', { size: 12, h: 28 })}
    ${pill(1225, 142, 'AUDIT TRAIL ACTIVE', { bg: '#0A3B2E', border: '#2CE558', color: '#9CFFB4', size: 12, h: 28 })}
    ${['AMERICAS · EN/ES', 'EUROPE · EN/DE/FR', 'APAC · MULTI-LOCALE', 'DESIGN TOKENS v4'].map((r, i) => `
      <rect x="${148 + i * 332}" y="188" width="308" height="52" rx="12" fill="#081C35" stroke="#245788" stroke-width="1.4"/>
      <circle cx="${174 + i * 332}" cy="214" r="6" fill="${i === 3 ? '#2CE558' : '#3CD0FF'}"/>
      ${txt(192 + i * 332, 219, r, { size: 13, weight: 700, fill: '#DDF2FF' })}
    `).join('')}
    <!-- 3 Environment Release Pipeline Columns: DEV -> STAGING -> PRODUCTION -->
    ${glowPipe('M525 565 L605 565', '#3CD0FF', 5)}
    ${glowPipe('M995 565 L1075 565', '#2CE558', 5)}
    ${[
      { x: 110, title: 'AUTHORING & RBAC', pillTxt: '6 DEPARTMENTS', col: '#3CD0FF' },
      { x: 605, title: 'STAGING & QA GATE', pillTxt: 'APPROVAL REQUIRED', col: '#3CD0FF' },
      { x: 1100, title: 'GLOBAL PRODUCTION', pillTxt: '99.9% OBSERVABILITY', col: '#2CE558' },
    ].map((env, idx) => `
      ${card(env.x, 315, 390, 555, { bright: idx === 2, r: 24 })}
      ${pill(env.x + 32, 350, env.pillTxt, { bg: idx === 2 ? '#0A3B2E' : '#0B3559', border: env.col, color: idx === 2 ? '#9CFFB4' : '#9BEBFF', size: 11 })}
      ${txt(env.x + 32, 412, env.title, { size: 18, weight: 800, fill: '#FFFFFF' })}
      ${[0, 1, 2].map((k) => `
        <rect x="${env.x + 32}" y="${445 + k * 126}" width="326" height="104" rx="14" fill="#081C36" stroke="#1E4B78" stroke-width="1.4"/>
        ${bar(env.x + 56, 472 + k * 126, 210, 12, env.col, 6, 0.8)}
        ${bar(env.x + 56, 496 + k * 126, 260, 9, '#275480')}
        ${bar(env.x + 56, 516 + k * 126, 180, 9, '#1F446A')}
        ${idx === 2 ? checkBadge(env.x + 324, 497 + k * 126, 16) : ''}
      `).join('')}
    `).join('')}
  </svg>`,

  'api-integrations': () => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${baseDefs('#009FE3', '#18B83A', 50, 50)}${stageGrid(7)}
    <!-- Spokes from 6 Satellite Systems to Central Event Hub -->
    ${[
      [300, 230], [1300, 230], [240, 500], [1360, 500], [300, 770], [1300, 770],
    ].map(([sx, sy], i) => glowPipe(`M${sx} ${sy} L800 500`, i % 2 === 0 ? '#3CD0FF' : '#2CE558', 4)).join('')}
    <!-- Central Hexagonal API Router -->
    ${card(610, 315, 380, 370, { bright: true, r: 34 })}
    <polygon points="800,365 895,420 895,530 800,585 705,530 705,420" fill="#082748" stroke="#3CD0FF" stroke-width="3.5" filter="url(#glow)"/>
    <circle cx="800" cy="475" r="42" fill="url(#cyanFill)"/>
    <path d="M782 475 H818 M800 457 V493" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"/>
    ${txt(800, 628, 'API & WEBHOOK BRIDGE', { size: 15, weight: 800, fill: '#B4F2FF', anchor: 'middle' })}
    ${pill(682, 644, 'RETRY · IDEMPOTENCY · LOGS', { bg: '#0A3B2E', border: '#2CE558', color: '#9CFFB4', size: 11, h: 26 })}
    <!-- 6 Connected Enterprise Satellite Modules -->
    ${[
      { x: 110, y: 145, name: 'PAYMENTS & STRIPE', sub: 'Verified Webhook Sync', c: '#2CE558' },
      { x: 1130, y: 145, name: 'ERP & INVENTORY', sub: 'Real-Time Stock Ledger', c: '#3CD0FF' },
      { x: 80, y: 420, name: 'CRM & CLIENT ID', sub: 'Unified Contact Record', c: '#3CD0FF' },
      { x: 1160, y: 420, name: 'COURIER & DISPATCH', sub: 'Live Parcel Tracking', c: '#2CE558' },
      { x: 110, y: 695, name: 'ACCOUNTING & TAX', sub: 'Reconciled Entries', c: '#2CE558' },
      { x: 1130, y: 695, name: 'MESSAGING & EMAIL', sub: 'Event Notifications', c: '#3CD0FF' },
    ].map((m) => `
      ${card(m.x, m.y, 360, 165, { r: 20 })}
      <circle cx="${m.x + 36}" cy="${m.y + 44}" r="9" fill="${m.c}" filter="url(#glow)"/>
      ${txt(m.x + 58, m.y + 50, m.name, { size: 15, weight: 800, fill: '#FFFFFF' })}
      ${txt(m.x + 36, m.y + 84, m.sub, { size: 13, weight: 500, fill: '#8AB8E6' })}
      ${bar(m.x + 36, m.y + 112, 260, 10, m.c, 5, 0.7)}
      ${bar(m.x + 36, m.y + 132, 180, 8, '#234F7C')}
    `).join('')}
  </svg>`,

  'cloud-deployment-google-cloud': () => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${baseDefs('#009FE3', '#18B83A', 50, 44)}${stageGrid(8)}
    <!-- Top HTTPS Edge Load Balancer -->
    ${card(520, 95, 560, 130, { bright: true, r: 22 })}
    ${pill(556, 122, 'GLOBAL HTTPS LOAD BALANCER · TLS', { size: 12, h: 26 })}
    ${checkBadge(1032, 160, 22)}
    ${txt(556, 184, 'Zero-Downtime Staged Revisions & Traffic Splitting', { size: 15, weight: 600, fill: '#D9F0FF' })}
    ${glowPipe('M800 225 V310', '#3CD0FF', 5)}
    ${glowPipe('M800 275 C520 275, 360 285, 310 330', '#3CD0FF', 4)}
    ${glowPipe('M800 275 C1080 275, 1240 285, 1290 330', '#3CD0FF', 4)}
    <!-- Middle Auto-Scaling Cloud Run Container Pods -->
    ${[0, 1, 2].map((i) => {
      const x = 120 + i * 480
      return `${card(x, 320, 400, 250, { bright: i === 1, r: 22 })}
        ${pill(x + 28, 350, `CLOUD RUN · CONTAINER 0${i + 1}`, { size: 11, h: 25 })}
        <rect x="${x + 28}" y="396" width="344" height="84" rx="14" fill="#071B34" stroke="#225585" stroke-width="1.5"/>
        ${bar(x + 50, 422, 240, 12, '#3CD0FF', 6)}
        ${bar(x + 50, 448, 185, 10, '#2CE558', 5)}
        ${txt(x + 28, 524, 'Auto-Scaling · Isolated Runtime', { size: 14, weight: 600, fill: '#9CC8F0' })}
        ${bar(x + 28, 540, 300, 8, '#234F7C')}`
    }).join('')}
    <!-- Bottom Managed Backing Services: Cloud SQL, Secret Manager, Cloud Logging -->
    ${glowPipe('M320 570 V665', '#2CE558', 4)}
    ${glowPipe('M800 570 V665', '#3CD0FF', 4)}
    ${glowPipe('M1280 570 V665', '#2CE558', 4)}
    ${[
      { x: 120, title: 'CLOUD SQL · HA FAILOVER', sub: 'Automated Point-in-Time Backups', c: '#2CE558' },
      { x: 600, title: 'SECRET MANAGER VAULT', sub: 'Encrypted Runtime Credentials', c: '#3CD0FF' },
      { x: 1080, title: 'CLOUD LOGGING & ALERTS', sub: 'Real-Time Latency & Error Budgets', c: '#2CE558' },
    ].map((b) => `
      ${card(b.x, 665, 400, 220, { r: 22 })}
      <circle cx="${b.x + 40}" cy="716" r="10" fill="${b.c}" filter="url(#glow)"/>
      ${txt(b.x + 64, 722, b.title, { size: 15, weight: 800, fill: '#FFFFFF' })}
      ${txt(b.x + 40, 760, b.sub, { size: 13, weight: 500, fill: '#8AB8E6' })}
      ${bar(b.x + 40, 795, 310, 12, b.c, 6, 0.72)}
      ${bar(b.x + 40, 822, 230, 10, '#234F7C')}
    `).join('')}
  </svg>`,

  'cpanel-stackcp-deployment': () => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${baseDefs('#009FE3', '#18B83A', 40, 50)}${stageGrid(9)}
    <!-- Left: Hardened Server Rack -->
    ${card(100, 155, 420, 690, { bright: true, r: 26 })}
    ${pill(138, 192, 'HARDENED HOSTING ENVIRONMENT', { size: 11, h: 26 })}
    ${[0, 1, 2, 3].map((i) => {
      const y = 248 + i * 136
      return `<rect x="138" y="${y}" width="344" height="110" rx="16" fill="#07192F" stroke="#24588A" stroke-width="1.8"/>
        <circle cx="174" cy="${y + 40}" r="7" fill="#2CE558" filter="url(#glow)"/>
        <circle cx="198" cy="${y + 40}" r="7" fill="#3CD0FF"/>
        ${bar(226, y + 34, 220, 12, '#3CD0FF', 6, 0.8)}
        ${bar(168, y + 68, 280, 10, '#234F7C', 5)}`
    }).join('')}
    <!-- Center-Right: Git Release -> Staging -> Production + Offsite Backup -->
    ${glowPipe('M520 350 L640 350', '#3CD0FF', 4.5)}
    ${glowPipe('M520 650 L640 650', '#2CE558', 4.5)}
    ${card(640, 155, 860, 325, { r: 24 })}
    ${windowDots(680, 194)}
    ${pill(760, 180, 'VERSION-CONTROLLED RELEASE PIPELINE', { size: 11, h: 25 })}
    ${[
      { x: 680, label: 'GIT COMMIT', c: '#3CD0FF' },
      { x: 950, label: 'ISOLATED STAGING', c: '#3CD0FF' },
      { x: 1220, label: 'LIVE PRODUCTION', c: '#2CE558' },
    ].map((s, idx) => `
      <rect x="${s.x}" y="236" width="235" height="198" rx="16" fill="#091E38" stroke="${s.c}" stroke-opacity="0.65" stroke-width="1.5"/>
      ${txt(s.x + 24, 276, s.label, { size: 13, weight: 800, fill: s.c })}
      ${bar(s.x + 24, 304, 180, 10, s.c, 5, 0.75)}
      ${bar(s.x + 24, 328, 150, 9, '#25527F')}
      ${bar(s.x + 24, 350, 165, 9, '#25527F')}
      ${idx === 2 ? checkBadge(s.x + 190, 392, 20) : ''}
    `).join('')}
    <!-- Bottom Card: SSL, Permission Hygiene & Verified Restore Backups -->
    ${card(640, 520, 860, 325, { r: 24 })}
    ${shieldLock(748, 678, 44, '#2CE558', '#0A3B2E')}
    ${pill(845, 565, 'TLS / SSL · CRON · OFF-SITE BACKUP DRILLS', { bg: '#0A3B2E', border: '#2CE558', color: '#9CFFB4', size: 12, h: 28 })}
    ${txt(845, 628, 'Repeatable Deployment & Documented Runbook', { size: 20, weight: 700, fill: '#FFFFFF' })}
    ${bar(845, 660, 560, 12, '#3CD0FF', 6, 0.78)}
    ${bar(845, 688, 480, 10, '#275684', 5)}
    ${bar(845, 714, 520, 10, '#275684', 5)}
    ${pill(845, 756, 'RESTORE VERIFIED', { size: 11, h: 26 })}
    ${pill(1035, 756, 'ZERO FTP DRIFT', { size: 11, h: 26 })}
  </svg>`,

  'maintenance-support': () => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${baseDefs('#009FE3', '#18B83A', 52, 46)}${stageGrid(10)}
    <!-- Main Reliability & Uptime Telemetry Console -->
    ${card(96, 130, 920, 740, { bright: true, r: 26 })}
    ${windowDots(138, 170)}
    ${pill(220, 155, 'PROACTIVE UPTIME & SECURITY MONITORING', { size: 11, h: 26 })}
    ${pill(815, 155, 'SLA HEALTH · OPTIMAL', { bg: '#0A3B2E', border: '#2CE558', color: '#9CFFB4', size: 11, h: 26 })}
    <!-- Live Heartbeat Waveform -->
    <rect x="136" y="212" width="840" height="270" rx="18" fill="#06162A" stroke="#1E4D7B" stroke-width="1.5"/>
    <path d="M166 365 L310 365 L348 280 L392 420 L438 255 L482 390 L525 345 L690 345 L732 270 L774 405 L816 320 L946 320" fill="none" stroke="#2CE558" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#glow)"/>
    ${[0, 1, 2].map((i) => {
      const x = 136 + i * 288
      const labels = ['SECURITY PATCHING', 'BACKUP VERIFICATION', 'MONTHLY HEALTH REPORT']
      return `<rect x="${x}" y="514" width="264" height="310" rx="18" fill="#081D36" stroke="#215180" stroke-width="1.5"/>
        ${checkBadge(x + 48, 566, 22)}
        ${txt(x + 28, 624, labels[i], { size: 14, weight: 800, fill: '#E8F6FF' })}
        ${bar(x + 28, 652, 204, 11, i === 1 ? '#2CE558' : '#3CD0FF', 5.5, 0.8)}
        ${bar(x + 28, 680, 176, 9, '#275582')}
        ${bar(x + 28, 704, 192, 9, '#275582')}
        ${bar(x + 28, 728, 148, 9, '#1F446A')}
        ${pill(x + 28, 766, 'VERIFIED', { bg: '#0A3B2E', border: '#2CE558', color: '#9CFFB4', size: 11, h: 26 })}`
    }).join('')}
    <!-- Right Protective Security Shield Tower -->
    ${card(1060, 130, 444, 740, { r: 26 })}
    <circle cx="1282" cy="375" r="138" fill="#07223F" stroke="#3CD0FF" stroke-width="2.5" filter="url(#glow)"/>
    ${shieldLock(1282, 372, 62, '#2CE558', '#0A3B2E')}
    ${txt(1282, 566, 'DEPENDENCY & TLS HYGIENE', { size: 16, weight: 800, fill: '#FFFFFF', anchor: 'middle' })}
    ${bar(1122, 608, 320, 12, '#3CD0FF', 6, 0.8)}
    ${bar(1122, 638, 280, 10, '#2CE558', 5, 0.8)}
    ${bar(1122, 668, 300, 10, '#275582', 5)}
    ${pill(1162, 735, 'DEFINED TURNAROUND SLA', { size: 12, h: 30 })}
  </svg>`,

  'digital-transformation-consulting': () => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${baseDefs('#009FE3', '#18B83A', 50, 48)}${stageGrid(11)}
    <!-- Left: Fragmented Legacy Silos -->
    ${card(92, 185, 360, 630, { r: 24 })}
    ${pill(128, 220, 'CURRENT STATE · AUDIT', { size: 11, h: 26 })}
    ${[0, 1, 2, 3].map((i) => `
      <rect x="128" y="${276 + i * 124}" width="288" height="98" rx="14" fill="#091E38" stroke="#275480" stroke-width="1.5"/>
      ${bar(154, 304 + i * 124, 180, 11, '#5889B8', 5.5)}
      ${bar(154, 328 + i * 124, 225, 9, '#244A70')}
      ${bar(154, 348 + i * 124, 145, 9, '#1D3D5E')}
    `).join('')}
    <!-- Center: Strategic Compass & ROI Prioritization Matrix -->
    ${glowPipe('M452 500 L565 500', '#3CD0FF', 5)}
    ${glowPipe('M1035 500 L1148 500', '#2CE558', 5)}
    ${card(565, 140, 470, 720, { bright: true, r: 28 })}
    <circle cx="800" cy="355" r="118" fill="#07223F" stroke="#3CD0FF" stroke-width="3" filter="url(#glow)"/>
    <circle cx="800" cy="355" r="82" fill="none" stroke="#2CE558" stroke-width="1.8" stroke-dasharray="6 6"/>
    <!-- Compass needle -->
    <polygon points="800,262 826,355 800,336 774,355" fill="#2CE558"/>
    <polygon points="800,448 826,355 800,374 774,355" fill="#3CD0FF"/>
    ${txt(800, 522, 'SEQUENCED ROI ROADMAP', { size: 17, weight: 800, fill: '#FFFFFF', anchor: 'middle' })}
    ${[
      ['PHASE 01 · QUICK PAYBACK', 340, '#2CE558'],
      ['PHASE 02 · CORE PLATFORM', 290, '#3CD0FF'],
      ['PHASE 03 · SCALE & AI', 240, '#3CD0FF'],
    ].map(([label, bw, col], idx) => `
      <rect x="615" y="${560 + idx * 86}" width="370" height="68" rx="14" fill="#081C35" stroke="${col}" stroke-opacity="0.6" stroke-width="1.4"/>
      ${txt(638, 588 + idx * 86, label, { size: 12, weight: 700, fill: col })}
      ${bar(638, 602 + idx * 86, bw, 10, col, 5, 0.8)}
    `).join('')}
    <!-- Right: Target Connected Architecture -->
    ${card(1148, 185, 360, 630, { r: 24 })}
    ${pill(1184, 220, 'TARGET ARCHITECTURE', { bg: '#0A3B2E', border: '#2CE558', color: '#9CFFB4', size: 11, h: 26 })}
    ${[0, 1, 2].map((i) => `
      <rect x="1184" y="${282 + i * 168}" width="288" height="140" rx="16" fill="#09233E" stroke="#2CE558" stroke-opacity="0.55" stroke-width="1.5"/>
      ${checkBadge(1434, 316 + i * 168, 18)}
      ${bar(1210, 314 + i * 168, 180, 12, '#3CD0FF', 6)}
      ${bar(1210, 342 + i * 168, 228, 10, '#2CE558', 5, 0.75)}
      ${bar(1210, 366 + i * 168, 195, 9, '#275684')}
    `).join('')}
  </svg>`,
}

/* ================================================================== */
/* 6 PLATFORM SHOWCASE SCENES (`public/images/platform/*.webp`)        */
/* ================================================================== */

function platformScene(variant) {
  const configs = {
    'platform-client-portal': {
      badge: 'CLIENT WORKSPACE',
      title: 'Milestones, Previews, Invoices & Handover',
      accent: '#3CD0FF',
      mode: 'portal',
    },
    'platform-crm-operations': {
      badge: 'CONNECTED OPERATIONS',
      title: 'Single Client ID Across Leads, Tasks & Delivery',
      accent: '#2CE558',
      mode: 'kanban',
    },
    'platform-automation-workflows': {
      badge: 'WORKFLOW ORCHESTRATION',
      title: 'Scheduled Jobs, Webhooks & Auditable Retries',
      accent: '#3CD0FF',
      mode: 'nodes',
    },
    'platform-marketing-operations': {
      badge: 'EDITORIAL & CAMPAIGNS',
      title: 'Content Studio, Media Planning & Approve-First Publishing',
      accent: '#2CE558',
      mode: 'calendar',
    },
    'platform-analytics-reporting': {
      badge: 'OPERATIONAL INTELLIGENCE',
      title: 'Unified KPIs, Funnel Conversion & Scheduled Reports',
      accent: '#3CD0FF',
      mode: 'charts',
    },
    'platform-developer-tooling': {
      badge: 'MODULAR ARCHITECTURE',
      title: 'Staged Releases, Integrity Checks & Source Handover',
      accent: '#2CE558',
      mode: 'modules',
    },
  }
  const cfg = configs[variant]
  let body = ''
  if (cfg.mode === 'portal') {
    body = `
      <rect x="170" y="290" width="1260" height="92" rx="16" fill="#081E38" stroke="#24588A" stroke-width="1.5"/>
      ${[0, 1, 2, 3, 4].map((s) => `
        <circle cx="${260 + s * 270}" cy="336" r="18" fill="${s < 4 ? '#2CE558' : '#3CD0FF'}"/>
        ${s < 4 ? `<line x1="${278 + s * 270}" y1="336" x2="${512 + s * 270}" y2="336" stroke="#2CE558" stroke-width="3"/>` : ''}
      `).join('')}
      ${[0, 1, 2].map((i) => `
        <rect x="${170 + i * 432}" y="416" width="396" height="390" rx="20" fill="#081D36" stroke="#215383" stroke-width="1.5"/>
        ${pill(198 + i * 432, 446, ['SCOPE APPROVED', 'INVOICE & RECEIPT', 'SOURCE PACKAGE'][i], { bg: '#0B3559', border: cfg.accent, color: '#B4F2FF', size: 11 })}
        ${bar(198 + i * 432, 504, 310, 14, '#E8F6FF', 6)}
        ${bar(198 + i * 432, 536, 260, 10, '#3CD0FF', 5, 0.75)}
        ${bar(198 + i * 432, 562, 290, 10, '#275684', 5)}
        <rect x="${198 + i * 432}" y="610" width="340" height="120" rx="14" fill="#061528" stroke="#1C4670"/>
        ${checkBadge(502 + i * 432, 670, 22)}
        ${bar(222 + i * 432, 652, 210, 12, '#2CE558', 6, 0.8)}
        ${bar(222 + i * 432, 678, 170, 10, '#275684', 5)}
      `).join('')}`
  } else if (cfg.mode === 'kanban') {
    body = [0, 1, 2, 3].map((col) => `
      <rect x="${170 + col * 322}" y="290" width="294" height="516" rx="18" fill="#081D36" stroke="#215383" stroke-width="1.5"/>
      ${pill(194 + col * 322, 316, ['INTAKE', 'SCOPED', 'IN BUILD', 'DELIVERED'][col], { bg: col === 3 ? '#0A3B2E' : '#0B3559', border: col === 3 ? '#2CE558' : '#3CD0FF', color: '#C6F6FF', size: 11 })}
      ${[0, 1, 2].map((r) => `
        <rect x="${194 + col * 322}" y="${366 + r * 140}" width="246" height="118" rx="14" fill="#0C2747" stroke="#285E91" stroke-width="1.3"/>
        ${bar(214 + col * 322, 392 + r * 140, 165, 11, col === 3 ? '#2CE558' : '#3CD0FF', 5.5)}
        ${bar(214 + col * 322, 416 + r * 140, 195, 9, '#2A5B8A')}
        ${bar(214 + col * 322, 438 + r * 140, 130, 9, '#21486F')}
      `).join('')}
    `).join('')
  } else if (cfg.mode === 'nodes') {
    body = `
      ${glowPipe('M330 545 L620 390', '#3CD0FF', 4.5)}
      ${glowPipe('M330 545 L620 700', '#2CE558', 4.5)}
      ${glowPipe('M940 390 L1240 545', '#3CD0FF', 4.5)}
      ${glowPipe('M940 700 L1240 545', '#2CE558', 4.5)}
      ${[
        [180, 455, 'EVENT QUEUE', '#3CD0FF'],
        [620, 300, 'SYNC & ENRICH', '#3CD0FF'],
        [620, 610, 'APPROVAL GATE', '#2CE558'],
        [1130, 455, 'AUDIT & NOTIFY', '#2CE558'],
      ].map(([x, y, l, c]) => `
        <rect x="${x}" y="${y}" width="290" height="180" rx="22" fill="#0A2544" stroke="${c}" stroke-width="2"/>
        ${txt(x + 145, y + 78, l, { size: 16, weight: 800, fill: '#FFFFFF', anchor: 'middle' })}
        ${bar(x + 55, y + 106, 180, 11, c, 5.5, 0.8)}
        ${bar(x + 75, y + 130, 140, 9, '#295B8A')}
      `).join('')}`
  } else if (cfg.mode === 'calendar') {
    body = `
      <rect x="170" y="295" width="780" height="510" rx="20" fill="#081D36" stroke="#215383" stroke-width="1.5"/>
      ${Array.from({ length: 12 }, (_, idx) => {
        const cx = 202 + (idx % 4) * 182
        const cy = 332 + Math.floor(idx / 4) * 152
        const active = idx === 2 || idx === 5 || idx === 9
        return `<rect x="${cx}" y="${cy}" width="160" height="128" rx="14" fill="${active ? '#0E355B' : '#0A223E'}" stroke="${active ? '#2CE558' : '#1E4A75'}" stroke-width="1.5"/>
          ${bar(cx + 18, cy + 24, 105, 10, active ? '#2CE558' : '#3CD0FF', 5)}
          ${bar(cx + 18, cy + 48, 124, 8, '#285785')}
          ${active ? checkBadge(cx + 130, cy + 96, 15) : ''}`
      }).join('')}
      <rect x="985" y="295" width="445" height="510" rx="20" fill="#092341" stroke="#2CE558" stroke-opacity="0.6" stroke-width="1.6"/>
      ${pill(1020, 330, 'HUMAN REVIEW GATE', { bg: '#0A3B2E', border: '#2CE558', color: '#9CFFB4', size: 12 })}
      ${bar(1020, 392, 360, 16, '#FFFFFF', 7, 0.9)}
      ${bar(1020, 426, 310, 11, '#3CD0FF', 5.5)}
      <rect x="1020" y="472" width="375" height="210" rx="16" fill="#06162A" stroke="#225382"/>
      ${checkBadge(1208, 576, 34)}
      <rect x="1020" y="716" width="375" height="52" rx="12" fill="url(#emeraldFill)"/>`
  } else if (cfg.mode === 'charts') {
    body = `
      <rect x="170" y="295" width="800" height="510" rx="20" fill="#081D36" stroke="#215383" stroke-width="1.5"/>
      <path d="M215 710 L345 615 L470 645 L605 495 L745 520 L915 370" fill="none" stroke="#3CD0FF" stroke-width="5" stroke-linecap="round" filter="url(#glow)"/>
      <path d="M215 745 L345 690 L470 675 L605 590 L745 565 L915 455" fill="none" stroke="#2CE558" stroke-width="4" stroke-linecap="round"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${[215, 345, 470, 605, 745, 915][i]}" cy="${[710, 615, 645, 495, 520, 370][i]}" r="7" fill="#7CE8FF"/>`).join('')}
      <rect x="1005" y="295" width="425" height="240" rx="20" fill="#081D36" stroke="#215383" stroke-width="1.5"/>
      <circle cx="1135" cy="415" r="72" fill="none" stroke="#1E4B78" stroke-width="16"/>
      <circle cx="1135" cy="415" r="72" fill="none" stroke="#2CE558" stroke-width="16" stroke-dasharray="330 460" filter="url(#glow)"/>
      ${bar(1245, 365, 145, 14, '#3CD0FF', 6)}
      ${bar(1245, 398, 120, 11, '#2CE558', 5)}
      ${bar(1245, 428, 135, 11, '#275684', 5)}
      <rect x="1005" y="565" width="425" height="240" rx="20" fill="#081D36" stroke="#215383" stroke-width="1.5"/>
      ${[0, 1, 2, 3, 4, 5].map((b) => {
        const bh = [95, 130, 110, 155, 140, 178][b]
        return `<rect x="${1048 + b * 58}" y="${768 - bh}" width="34" height="${bh}" rx="8" fill="${b % 2 === 0 ? 'url(#cyanFill)' : 'url(#emeraldFill)'}"/>`
      }).join('')}`
  } else {
    body = `
      ${[0, 1, 2].map((i) => `
        <rect x="${170 + i * 432}" y="295" width="396" height="510" rx="22" fill="#081D36" stroke="#24588A" stroke-width="1.6"/>
        ${pill(200 + i * 432, 330, ['MODULE SCAFFOLD', 'STAGED RELEASE', 'SHA-256 HANDOVER'][i], { size: 11 })}
        <rect x="${200 + i * 432}" y="384" width="336" height="210" rx="16" fill="#061528" stroke="#1D4973"/>
        ${i === 2 ? shieldLock(368 + i * 432, 488, 42, '#2CE558', '#0A3B2E') : checkBadge(368 + i * 432, 488, 34)}
        ${bar(200 + i * 432, 632, 290, 13, '#3CD0FF', 6)}
        ${bar(200 + i * 432, 662, 240, 10, '#2CE558', 5)}
        ${bar(200 + i * 432, 690, 270, 10, '#275684', 5)}
        ${bar(200 + i * 432, 718, 190, 10, '#275684', 5)}
      `).join('')}`
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${baseDefs('#009FE3', '#18B83A', 48, 46)}${stageGrid(20)}
    ${card(120, 120, 1360, 760, { bright: true, r: 28 })}
    ${windowDots(164, 162)}
    ${pill(244, 146, cfg.badge, { size: 12, h: 28 })}
    ${txt(170, 238, cfg.title, { size: 26, weight: 800, fill: '#FFFFFF' })}
    ${body}
  </svg>`
}

/* ================================================================== */
/* 8 CASE-STUDY BLUEPRINT SCENES (`public/images/case-studies/*.webp`) */
/* ================================================================== */

const CASE_STUDY_META = {
  'fashion-retail-store-launch': {
    sector: 'ECOMMERCE BLUEPRINT',
    title: 'Storefront, Local Checkout & Order Status Flow',
    steps: ['CATALOGUE', 'CHECKOUT', 'CONFIRMATION', 'FULFILLMENT'],
    accent: '#3CD0FF',
  },
  'clinic-appointment-automation': {
    sector: 'HEALTHCARE BLUEPRINT',
    title: 'Online Booking, SMS Reminders & Daily Schedule',
    steps: ['BOOKING', 'SMS REMINDER', 'PATIENT REPLY', 'CLINIC QUEUE'],
    accent: '#2CE558',
  },
  'school-enquiry-pipeline': {
    sector: 'EDUCATION BLUEPRINT',
    title: 'Admissions Enquiry Queue & Guardian Follow-Up',
    steps: ['ENQUIRY', 'FIRST REPLY', 'BATCH MATCH', 'ENROLLED'],
    accent: '#3CD0FF',
  },
  'developer-sales-crm': {
    sector: 'REAL ESTATE BLUEPRINT',
    title: 'Unified Buyer Timeline, Site Visits & Installments',
    steps: ['LEAD CAPTURE', 'SITE VISIT', 'RESERVATION', 'INSTALLMENTS'],
    accent: '#2CE558',
  },
  'restaurant-order-pipeline': {
    sector: 'HOSPITALITY BLUEPRINT',
    title: 'Multi-Channel Order Queue, Kitchen & Dispatch',
    steps: ['ORDER INTAKE', 'KITCHEN PREP', 'COURIER', 'DELIVERED'],
    accent: '#3CD0FF',
  },
  'logistics-live-tracking': {
    sector: 'LOGISTICS BLUEPRINT',
    title: 'Shipment Records, Tracking Links & Fleet Dispatch',
    steps: ['MANIFEST', 'DISPATCH', 'LIVE TRACKING', 'POD VERIFIED'],
    accent: '#2CE558',
  },
  'agency-client-portal': {
    sector: 'AGENCY BLUEPRINT',
    title: 'Deliverable Review, Version History & Sign-Off',
    steps: ['DRAFT UPLOAD', 'CLIENT REVIEW', 'REVISION LOG', 'APPROVED'],
    accent: '#3CD0FF',
  },
  'firm-intake-automation': {
    sector: 'PROFESSIONAL SERVICES BLUEPRINT',
    title: 'Secure Document Intake & Matter Deadline Tracking',
    steps: ['SECURE UPLOAD', 'CLASSIFICATION', 'DEADLINE SLA', 'COMPLETED'],
    accent: '#2CE558',
  },
}

function caseStudyScene(slug, idx) {
  const m = CASE_STUDY_META[slug]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${baseDefs('#009FE3', '#18B83A', 35 + idx * 4, 48)}${stageGrid(30 + idx)}
    ${card(105, 125, 1390, 750, { bright: true, r: 28 })}
    ${windowDots(148, 166)}
    ${pill(230, 150, `${m.sector} · ILLUSTRATIVE ARCHITECTURE`, { size: 11, h: 26 })}
    ${txt(155, 240, m.title, { size: 26, weight: 800, fill: '#FFFFFF' })}
    <!-- 4-Stage Architecture Flow -->
    ${glowPipe('M430 435 L505 435', '#3CD0FF', 4)}
    ${glowPipe('M775 435 L850 435', '#2CE558', 4)}
    ${glowPipe('M1120 435 L1195 435', '#3CD0FF', 4)}
    ${m.steps.map((st, sIdx) => {
      const x = 155 + sIdx * 345
      const isLast = sIdx === 3
      return `<rect x="${x}" y="300" width="275" height="270" rx="20" fill="#081E38" stroke="${isLast ? '#2CE558' : '#255B8E'}" stroke-width="1.8"/>
        <circle cx="${x + 42}" cy="348" r="18" fill="${isLast ? 'url(#emeraldFill)' : 'url(#cyanFill)'}"/>
        ${txt(x + 42, 354, `0${sIdx + 1}`, { size: 13, weight: 800, fill: '#FFFFFF', anchor: 'middle' })}
        ${txt(x + 28, 408, st, { size: 15, weight: 800, fill: '#E8F6FF' })}
        ${bar(x + 28, 438, 210, 11, isLast ? '#2CE558' : '#3CD0FF', 5.5, 0.8)}
        ${bar(x + 28, 464, 175, 9, '#285785')}
        ${bar(x + 28, 488, 195, 9, '#21486E')}
        ${isLast ? checkBadge(x + 230, 526, 18) : ''}`
    }).join('')}
    <!-- Bottom Telemetry & Stack Strip -->
    <rect x="155" y="615" width="1290" height="205" rx="20" fill="#07192F" stroke="#1F4E7C" stroke-width="1.5"/>
    ${pill(190, 648, 'SCOPED SOW GATE', { size: 11, h: 26 })}
    ${pill(375, 648, 'AUDIT TRAIL LOGGED', { bg: '#0A3B2E', border: '#2CE558', color: '#9CFFB4', size: 11, h: 26 })}
    ${pill(585, 648, 'CLIENT DATA OWNERSHIP', { size: 11, h: 26 })}
    ${bar(190, 706, 760, 14, 'url(#pipeGreen)', 7)}
    ${bar(190, 738, 580, 10, '#285888', 5)}
    ${bar(190, 764, 650, 10, '#1E456B', 5)}
    <!-- Mini metric bars on right -->
    ${[0, 1, 2, 3, 4].map((k) => {
      const h = [68, 96, 84, 122, 142][k]
      return `<rect x="${1090 + k * 58}" y="${788 - h}" width="34" height="${h}" rx="7" fill="${k % 2 === 0 ? 'url(#cyanFill)' : 'url(#emeraldFill)'}"/>`
    }).join('')}
  </svg>`
}

async function renderSvgToWebp(svgString, outPath) {
  mkdirSync(dirname(outPath), { recursive: true })
  await sharp(Buffer.from(svgString), { density: 144 })
    .resize(W, H, { fit: 'cover' })
    .webp({ quality: 88, effort: 6, smartSubsample: true })
    .toFile(outPath)
  const kb = Math.round(statSync(outPath).size / 1024)
  console.log(`✓ ${outPath.replace(ROOT + '/', '')} (${W}x${H} WebP, ${kb} KB)`)
}

async function main() {
  for (const [slug, fn] of Object.entries(SERVICE_SCENES)) {
    await renderSvgToWebp(fn(), join(ROOT, 'public', 'images', 'services', `${slug}.webp`))
  }
  for (const key of [
    'platform-client-portal',
    'platform-crm-operations',
    'platform-automation-workflows',
    'platform-marketing-operations',
    'platform-analytics-reporting',
    'platform-developer-tooling',
  ]) {
    await renderSvgToWebp(platformScene(key), join(ROOT, 'public', 'images', 'platform', `${key}.webp`))
  }
  const caseSlugs = Object.keys(CASE_STUDY_META)
  for (let i = 0; i < caseSlugs.length; i++) {
    await renderSvgToWebp(
      caseStudyScene(caseSlugs[i], i),
      join(ROOT, 'public', 'images', 'case-studies', `${caseSlugs[i]}.webp`),
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
