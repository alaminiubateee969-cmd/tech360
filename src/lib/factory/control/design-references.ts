/**
 * Private design-reference registry for the BDTECH360 Software Factory.
 *
 * The 18 references supplied with the project are catalogued here and mapped to
 * the VERSIONED INDUSTRY TEMPLATES in `catalog.ts`. They are inspiration and
 * traceability — never a substitute for working functionality. Each mapped
 * template is a real composition of approved shared modules, navigation,
 * workflows, reports and design tokens that the single runtime consumes.
 *
 * A curated, compressed preview of each family is committed under
 * `public/factory/industry/` so operators can see the visual language inside
 * the private Template Library without shipping the 14 MB source attachments.
 */
export interface DesignReference {
  file: string
  title: string
  template: string
  family: string
  note: string
}

export const TEMPLATE_PREVIEWS: Record<string, { image: string; palette: [string, string]; label: string }> = {
  'school-website': { image: '/factory/industry/school-website.jpg', palette: ['#0B3B5B', '#2BA9E0'], label: 'Academy & admissions' },
  'fitness-platform': { image: '/factory/industry/fitness-platform.jpg', palette: ['#12123B', '#FF6B4A'], label: 'Training & members' },
  'doctor-consult': { image: '/factory/industry/doctor-consult.jpg', palette: ['#1D4ED8', '#14B8A6'], label: 'Appointments & care' },
  'travel-agency': { image: '/factory/industry/travel-agency.jpg', palette: ['#007F7B', '#FF7A2F'], label: 'Trips & itineraries' },
  'real-estate': { image: '/factory/industry/real-estate.jpg', palette: ['#5B4AE8', '#9B8CFF'], label: 'Listings & viewings' },
  'ecommerce-store': { image: '/factory/industry/ecommerce-store.jpg', palette: ['#111111', '#FF5A1F'], label: 'Products & orders' },
  'manufacturing-erp': { image: '/factory/industry/manufacturing-erp.jpg', palette: ['#1B3A57', '#F28C28'], label: 'Production & ERP' },
  'analytics-reports': { image: '/factory/industry/analytics-reports.jpg', palette: ['#0A2A43', '#2DBE9B'], label: 'Dashboards & insight' },
  'elearning-app': { image: '/factory/industry/elearning-app.jpg', palette: ['#6C4CF1', '#9AA8FF'], label: 'Courses & assessment' },
  'outdoor-gear': { image: '/factory/industry/outdoor-gear.jpg', palette: ['#14532D', '#84CC16'], label: 'Gear & community' },
  'it-services': { image: '/factory/industry/it-services.jpg', palette: ['#0A2A43', '#2DBE9B'], label: 'Services & delivery' },
}

export const DESIGN_REFERENCES: readonly DesignReference[] = [
  { file: '🎓 School Website Design Ideas 2026_ Modern School Website That Attracts More Admissions.png', title: 'Modern school website / admissions journey', template: 'school-website', family: 'Education', note: 'Program cards, campus facilities and a four-step admission journey became the Programs, Campus and Admissions pages.' },
  { file: '913527105660593740 (1).jpeg', title: 'Doctor’s Point mobile consultation kit', template: 'doctor-consult', family: 'Healthcare', note: 'Specialist search, appointment slots, notifications and messaging became the Appointments, Specialists and Messages pages.' },
  { file: 'Berlin Fitness App UI Kit — Interface Market.jpeg', title: 'Berlin fitness app UI kit', template: 'fitness-platform', family: 'Health & Fitness', note: 'Activity-first dashboard and session cards informed the Workouts and Progress pages.' },
  { file: 'Best IT Company in Pakistan_.jpeg', title: 'Corporate IT services website', template: 'it-services', family: 'Technology', note: 'Service catalogue, lead capture and delivery timeline became the Services, Leads and Delivery pages.' },
  { file: 'Education App UI Design Kit Figma Ui Kit.jpeg', title: 'Education app UI design kit', template: 'elearning-app', family: 'Education', note: 'Course cards, assessments and certificates became the Courses, Assessments and Certificates pages.' },
  { file: 'Expedia Vacation Deprivation Report - Manuel Bortoletti.png', title: 'Vacation-deprivation data report', template: 'analytics-reports', family: 'Analytics', note: 'Editorial data-report layout informed the Dashboards, Datasets and Insights pages.' },
  { file: 'Fitnex - Fitness Mobile App UI Kit.png', title: 'Fitnex fitness mobile UI kit', template: 'fitness-platform', family: 'Health & Fitness', note: 'High-energy accent palette and plan cards became the Plans page and the energy theme.' },
  { file: 'Goyto - Travel & Tourism Agency WordPress Theme.jpeg', title: 'Goyto travel agency website', template: 'travel-agency', family: 'Travel', note: 'Destination hero and itinerary structure became the Destinations and Itineraries pages.' },
  { file: 'Graceful Fitness App UI Kit Design Mobile App.jpeg', title: 'Graceful fitness app UI kit', template: 'fitness-platform', family: 'Health & Fitness', note: 'Clean progress indicators informed the Progress report page.' },
  { file: 'Hermes Fitness Mobile App UI Kit.jpeg', title: 'Hermes fitness mobile UI kit', template: 'fitness-platform', family: 'Health & Fitness', note: 'Workout library card system informed the Workouts gallery.' },
  { file: 'Infographic Template for Statistic Data Visualizat Stock Vector - Illustration of design, arrow_ 29884111.jpeg', title: 'Statistical infographic template', template: 'analytics-reports', family: 'Analytics', note: 'Statistic-card and flow-arrow language informed the live scoped report view.' },
  { file: 'Medical or Doctor Consultant Mobile App UI Design _.png', title: 'Doctor consultant mobile app', template: 'doctor-consult', family: 'Healthcare', note: 'Clinical blue/teal language became the clinical theme and appointment board.' },
  { file: 'Modern Luxury Real Estate Landing Page.jpeg', title: 'Luxury real estate landing page', template: 'real-estate', family: 'Property', note: 'Featured-property gallery and viewing journey became the Listings and Viewings pages.' },
  { file: 'Outdoor Adventure Gear Marketplace.png', title: 'Outdoor adventure gear marketplace', template: 'outdoor-gear', family: 'Commerce', note: 'Seasonal collections and expedition timeline became the Gear and Adventures pages.' },
  { file: 'Premium Online Store Website Design.png', title: 'Premium online store website', template: 'ecommerce-store', family: 'Commerce', note: 'Editorial product grid and collection campaigns became the Products and Campaigns pages.' },
  { file: 'Qvrenti Real Estate and Rental WordPress Theme - Valon Avdiu.jpeg', title: 'Qvrenti real estate & rental theme', template: 'real-estate', family: 'Property', note: 'Listing filters and client-facing records became the Clients page and listing pipeline.' },
  { file: 'Shopify Ecommerce Website Template @Fiverr.jpeg', title: 'Shopify ecommerce website template', template: 'ecommerce-store', family: 'Commerce', note: 'Order-status journey became the Orders board and fulfilment pipeline.' },
  { file: 'Smart ERP Software for Manufacturers_ Complete Process Flow.png', title: 'Smart manufacturing ERP process flow', template: 'manufacturing-erp', family: 'Manufacturing', note: 'Sales order → material → capacity → production → quality → dispatch became the six-stage ERP pipeline.' },
]

export const DESIGN_REFERENCE_COUNT = DESIGN_REFERENCES.length
export const INDUSTRY_TEMPLATE_COUNT = Object.keys(TEMPLATE_PREVIEWS).length
