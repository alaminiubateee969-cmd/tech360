import Link from 'next/link';

const SOLUTIONS = [
  { title: 'Website + CRM', icon: '🌐', color: 'from-blue-500 to-cyan-500', outcome: 'Every website visitor becomes a tracked lead. No lead falls through the cracks. Every form submission creates a CRM record automatically.' },
  { title: 'eCommerce + CRM', icon: '🛒', color: 'from-green-500 to-emerald-500', outcome: 'Customer purchases sync to CRM. Order history, repeat purchase patterns, and abandoned cart recovery — all in one system.' },
  { title: 'Website + WhatsApp', icon: '💬', color: 'from-green-500 to-teal-500', outcome: 'Visitors click to chat on WhatsApp with a pre-filled enquiry message. Click tracking attributes the lead source.' },
  { title: 'CRM + WhatsApp + Email', icon: '📧', color: 'from-cyan-500 to-blue-500', outcome: 'Multi-channel follow-up automation. Lead assigned → WhatsApp message → email sequence → meeting booked.' },
  { title: 'Lead Generation + CRM', icon: '🎯', color: 'from-blue-600 to-indigo-600', outcome: 'Targeted landing pages with UTM attribution. Every lead source, campaign, and conversion is tracked end-to-end.' },
  { title: 'CRM + n8n Workflow', icon: '⚙️', color: 'from-blue-500 to-purple-500', outcome: 'Visual workflow automation. Trigger on CRM events, connect 400+ apps, automate repetitive tasks without code.' },
  { title: 'Website + CRM + Automation', icon: '🔧', color: 'from-cyan-500 to-teal-500', outcome: 'Complete digital operating system. Website captures leads, CRM tracks them, automation nurtures them — 24/7.' },
  { title: 'eCommerce + Payment + CRM', icon: '💳', color: 'from-green-500 to-blue-500', outcome: 'Secure checkout (Stripe/PayPal), HMAC-verified webhooks, customer sync to CRM, audit-logged transactions.' },
  { title: 'Business Dashboard + Automation', icon: '📊', color: 'from-blue-600 to-cyan-600', outcome: 'Real-time KPIs from your database. Auto-refresh, scheduled reports, alerts when metrics cross thresholds.' },
  { title: 'Custom Software + Cloud', icon: '☁️', color: 'from-blue-500 to-sky-500', outcome: 'Custom-built applications deployed on cloud infrastructure. Full source code handover, documentation, deployment guide.' },
];

export default function SolutionsPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="bg-gradient-to-br from-blue-50 to-green-50 py-20">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold text-slate-900 mb-6">
            Integrated <span className="bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">Business Solutions</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            We don't just build websites. We combine platforms into integrated solutions that solve real business problems — from lead generation to delivery to support.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {SOLUTIONS.map((sol) => (
              <div key={sol.title} className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm hover:shadow-xl transition-shadow">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${sol.color} flex items-center justify-center text-2xl mb-5`}>
                  {sol.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{sol.title}</h3>
                <p className="text-slate-600 mb-5">{sol.outcome}</p>
                <Link href="/project-brief" className="inline-flex items-center gap-2 text-blue-600 font-semibold hover:gap-3 transition-all">
                  Discuss This Solution →
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
