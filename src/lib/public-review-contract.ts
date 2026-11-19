/** JSON fields exposed by the consented, approved public review endpoint. */
export type PublicReview = {
  id: string
  name: string
  businessName: string | null
  country: string | null
  projectName: string | null
  serviceType: string | null
  rating: number | null
  content: string | null
  date: string
}

export function parsePublicReviews(payload: unknown): PublicReview[] {
  if (!payload || typeof payload !== 'object' || !('reviews' in payload) || !Array.isArray(payload.reviews)) {
    throw new Error('Public review response is invalid')
  }
  for (const review of payload.reviews) {
    if (!review || typeof review !== 'object' || typeof review.id !== 'string' || typeof review.name !== 'string'
      || typeof review.date !== 'string' || !Number.isFinite(Date.parse(review.date))
      || !(review.content === null || typeof review.content === 'string')
      || !(review.rating === null || Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5)
      || !['businessName', 'country', 'projectName', 'serviceType'].every((key) => review[key] === null || typeof review[key] === 'string')) {
      throw new Error('Public review response contains an invalid record')
    }
  }
  return payload.reviews as PublicReview[]
}
