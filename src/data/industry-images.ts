/** AI-generated representative imagery, not images of customers or institutions. */
export const INDUSTRY_IMAGES: Record<string, string> = {
  ecommerce: '/images/industry-commerce.jpg',
  education: '/images/education-campus.jpg',
  'schools-training': '/images/education-school.jpg',
  healthcare: '/images/industry-healthcare.jpg',
  'hospitals-clinics': '/images/industry-healthcare.jpg',
  'real-estate': '/images/industry-built.jpg',
  'restaurants-food': '/images/industry-food.jpg',
  agencies: '/images/industry-business.jpg',
  'professional-services': '/images/industry-business.jpg',
  'marketing-agencies': '/images/industry-business.jpg',
  'local-businesses': '/images/industry-commerce.jpg',
  'international-smes': '/images/industry-business.jpg',
  finance: '/images/industry-finance.jpg',
  retail: '/images/industry-commerce.jpg',
  logistics: '/images/industry-logistics.jpg',
  'travel-hospitality': '/images/industry-travel.jpg',
  construction: '/images/industry-built.jpg',
  manufacturing: '/images/industry-manufacturing.jpg',
  'legal-services': '/images/industry-business.jpg',
  'technology-companies': '/images/industry-technology.jpg',
};

export function industryImage(slug: string): string | undefined {
  return INDUSTRY_IMAGES[slug];
}
