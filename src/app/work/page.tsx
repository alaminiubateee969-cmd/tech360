import Link from 'next/link';

const CATEGORIES: Record<string, { title: string; desc: string }[]> = {
  'eCommerce': [
    { title: 'Multi-Vendor Marketplace', desc: 'Vendor onboarding, product catalog, commission tracking, Stripe Connect payouts, dispute resolution.' },
    { title: 'Subscription eCommerce', desc: 'Recurring billing, customer portal, delivery scheduling, WhatsApp order confirmations.' },
  ],
  'CRM': [
    { title: 'Sales Pipeline CRM', desc: 'Lead scoring, deal stages, automated follow-ups, WhatsApp integration, pipeline analytics.' },
    { title: 'Customer Service CRM', desc: 'Ticket management, SLA tracking, knowledge base, agent assignment, satisfaction surveys.' },
  ],
  'Education': [
    { title: 'School Management System', desc: 'Student enrollment, attendance, gradebook, parent portal, fee collection, report cards.' },
    { title: 'Online Course Platform', desc: 'Course catalog, video lessons, quizzes, certificates, progress tracking, instructor dashboard.' },
  ],
  'Healthcare': [
    { title: 'Clinic Management System', desc: 'Patient records, appointment scheduling, prescription management, billing, lab integration.' },
    { title: 'Telemedicine Platform', desc: 'Video consultations, secure messaging, e-prescriptions, patient history, payment processing.' },
  ],
  'Real Estate': [
    { title: 'Property Listing Platform', desc: 'Property search, agent profiles, virtual tours, inquiry management, mortgage calculator.' },
    { title: 'Agent CRM + WhatsApp', desc: 'Lead capture from listings, WhatsApp follow-up, viewing scheduling, deal tracking.' },
  ],
  'Restaurant': [
    { title: 'Online Ordering System', desc: 'Menu management, online ordering, table reservations, WhatsApp notifications, POS integration.' },
    { title: 'Restaurant Dashboard', desc: 'Sales analytics, inventory tracking, staff scheduling, customer feedback, daily reports.' },
  ],
  'Agency': [
    { title: 'Project Management Tool', desc: 'Task tracking, time logging, client portal, invoicing, team collaboration, file sharing.' },
    { title: 'Client Onboarding Workflow', desc: 'Automated onboarding sequence, contract signing, kickoff scheduling, checklists.' },
  ],
  'Automation': [
    { title: 'Lead Nurturing Workflow', desc: 'Lead capture → CRM → email sequence → WhatsApp follow-up → meeting booked — fully automated.' },
    { title: 'Invoice Automation', desc: 'Auto-generate invoices from CRM deals, email delivery, payment tracking, overdue reminders.' },
  ],
  'Communication': [
    { title: 'WhatsApp Business Bot', desc: 'Auto-reply, menu navigation, lead qualification, CRM sync, human handoff for complex queries.' },
    { title: 'Multi-Channel Notification Hub', desc: 'Email + SMS + WhatsApp notifications from one dashboard, triggered by business events.' },
  ],
  'Business Dashboard': [
    { title: 'Executive KPI Dashboard', desc: 'Real-time revenue, customer acquisition, sales pipeline, project profitability — from live database.' },
    { title: 'Operations Dashboard', desc: 'Order status, inventory levels, staff productivity, delivery tracking, exception alerts.' },
  ],
};

export default function WorkPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="bg-gradient-to-br from-blue-50 to-green-50 py-20">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold text-slate-900 mb-6">
            Our <span className="bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">Work</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            Representative solutions showing how we approach common business problems. These are example projects — not real client names — to illustrate capability without breaking confidentiality.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-12">
            <strong>ℹ️ Transparency Note:</strong> The projects below are labeled "Representative Solution". We do not invent client names, revenue figures, or testimonials. When you become a client, your project may be featured here only with your explicit written consent.
          </div>

          {Object.entries(CATEGORIES).map(([category, projects]) => (
            <div key={category} className="mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-6">{category}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {projects.map((project) => (
                  <div key={project.title} className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm hover:shadow-xl transition-shadow">
                    <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">Representative Solution</span>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">{project.title}</h3>
                    <p className="text-slate-600 mb-5">{project.desc}</p>
                    <Link href="/project-brief" className="inline-flex items-center gap-2 text-blue-600 font-semibold hover:gap-3 transition-all">
                      Request Similar Solution →
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
