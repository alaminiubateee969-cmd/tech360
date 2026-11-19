import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parsePublicReviews, type PublicReview } from '../src/lib/public-review-contract'

const review: PublicReview = {
  id: 'synthetic-consented-review', name: 'Synthetic Reviewer', businessName: null,
  country: null, projectName: 'Synthetic completed project', serviceType: null,
  rating: 4, content: 'A real-shaped synthetic fixture, not a published testimonial.', date: '2026-11-18T00:00:00.000Z',
}

describe('public review API and homepage shared DTO', () => {
  it('retains the actual endpoint fields without inventing author/headline/comment aliases', () => {
    assert.deepEqual(parsePublicReviews({ reviews: [review], honest: true, count: 1 }), [review])
  })
  it('preserves an honest empty public feed', () => { assert.deepEqual(parsePublicReviews({ reviews: [] }), []) })
  it('does not invent a star rating or content when a stored review has nulls', () => {
    assert.deepEqual(parsePublicReviews({ reviews: [{ ...review, rating: null, content: null }] }), [{ ...review, rating: null, content: null }])
  })
  for (const [name, invalid] of [
    ['missing list', {}],
    ['wrong list shape', { reviews: {} }],
    ['legacy frontend-only aliases', { reviews: [{ id: 'x', authorName: 'Not the API shape', rating: 5, comment: 'x' }] }],
    ['out-of-range rating', { reviews: [{ ...review, rating: 6 }] }],
    ['non-integer rating', { reviews: [{ ...review, rating: 4.5 }] }],
    ['invalid date', { reviews: [{ ...review, date: 'not-a-date' }] }],
    ['invalid identity', { reviews: [{ ...review, name: null }] }],
    ['wrong optional field type', { reviews: [{ ...review, businessName: 12 }] }],
  ] as const) {
    it(`rejects ${name} rather than silently calling a broken feed empty`, () => {
      assert.throws(() => parsePublicReviews(invalid), /invalid/i)
    })
  }
})
