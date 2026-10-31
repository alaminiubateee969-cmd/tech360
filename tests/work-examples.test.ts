import assert from 'node:assert/strict'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

import {
  WORK_CATEGORIES,
  WORK_EXAMPLES,
  WORK_EXAMPLE_NOTICE,
  filterWorkExamples,
  getWorkExample,
} from '../src/data/work-examples'

const ROOT = path.join(import.meta.dirname, '..')

describe('work examples — required set', () => {
  it('ships exactly the twelve requested systems', () => {
    assert.equal(WORK_EXAMPLES.length, 12)
    const required = [
      'eCommerce Storefront',
      'Education CRM',
      'School ERP',
      'Clinic System',
      'Real Estate CRM',
      'Agency Portal',
      'AI Automation',
      'WhatsApp Sales Funnel',
      'Social Automation',
      'Lead Management',
      'Client Portal',
      'Custom Dashboard',
    ]
    const names = WORK_EXAMPLES.map((example) => example.name)
    for (const name of required) assert.ok(names.includes(name), `missing example: ${name}`)
  })

  it('has unique slugs and unique images', () => {
    const slugs = WORK_EXAMPLES.map((example) => example.slug)
    assert.equal(new Set(slugs).size, slugs.length)
    const images = WORK_EXAMPLES.map((example) => example.image)
    assert.equal(new Set(images).size, images.length)
  })

  it('serves every image from a local, existing public asset', () => {
    for (const example of WORK_EXAMPLES) {
      assert.ok(example.image.startsWith('/images/work/'), `${example.slug} must use a self-hosted image`)
      const diskPath = path.join(ROOT, 'public', example.image.replace(/^\//, ''))
      assert.ok(existsSync(diskPath), `missing image file: ${example.image}`)
      assert.ok(statSync(diskPath).size > 10_000, `image too small to be real: ${example.image}`)
    }
  })

  it('writes descriptive alt text and never leaves required copy empty', () => {
    for (const example of WORK_EXAMPLES) {
      assert.ok(example.imageAlt.length >= 40, `${example.slug} needs descriptive alt text`)
      assert.ok(example.tagline.length > 20)
      assert.ok(example.description.length > 60)
      assert.ok(example.modules.length >= 4)
      assert.ok(example.capabilities.length >= 3)
      assert.ok(example.outOfScope.length >= 1, `${example.slug} must state what it does not claim`)
    }
  })

  it('makes no invented performance or revenue claim', () => {
    const banned = [/\b\d+\s?%\b/, /\b\d+x\b/i, /\bguarantee/i, /\bproven\b/i, /\baward/i]
    const corpus = WORK_EXAMPLES.map((example) =>
      [example.tagline, example.description, ...example.capabilities, ...example.modules].join(' '),
    ).join(' ')
    for (const pattern of banned) {
      assert.equal(pattern.test(corpus), false, `unsubstantiated claim matched ${pattern}`)
    }
  })

  it('exposes a honesty notice that names the limitation', () => {
    assert.match(WORK_EXAMPLE_NOTICE, /not delivered client projects/i)
    assert.match(WORK_EXAMPLE_NOTICE, /concept/i)
  })
})

describe('work examples — filtering and lookup', () => {
  it('"All" returns every example', () => {
    assert.equal(filterWorkExamples('All').length, WORK_EXAMPLES.length)
    assert.equal(filterWorkExamples('').length, WORK_EXAMPLES.length)
  })

  it('each advertised category matches at least one example', () => {
    for (const category of WORK_CATEGORIES) {
      if (category === 'All') continue
      assert.ok(filterWorkExamples(category).length > 0, `empty category chip: ${category}`)
    }
  })

  it('looks up by slug and returns undefined for unknown slugs', () => {
    assert.equal(getWorkExample('clinic-system')?.name, 'Clinic System')
    assert.equal(getWorkExample('does-not-exist'), undefined)
  })
})
