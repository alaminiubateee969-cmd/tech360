import Link from 'next/link';

const STEPS = [
  { n: 1, title: 'Initial Contact', desc: 'You contact us via WhatsApp, email, or the project brief form. We log your enquiry with full attribution.' },
  { n: 2, title: 'Business Understanding', desc: 'We learn about your business — what you do, who you serve, what problems you face. No jargon, no assumptions.' },
  { n: 3, title: 'Requirement Discovery', desc: 'A structured conversation to understand exact features, integrations, and outcomes you need. We document everything.' },
  { n: 4, title: 'Scope of Work', desc: 'We prepare a formal Scope of Work document with milestones, deliverables, pricing, and timeline. No vague estimates.' },
  { n: 5, title: 'Scope Review', desc: 'You review the scope. You can request changes. We iterate until you are satisfied. No obligation until you approve.' },
  { n: 6, title: 'Project Plan', desc: 'Once scope is approved, we create a detailed project plan with task breakdown, dependencies, and delivery dates.' },
  { n: 7, title: 'HTML Preview', desc: 'Where applicable, we provide an HTML or staging preview of the proposed work. You see what you are paying for BEFORE payment.' },
  { n: 8, title: 'Client Approval', desc: 'You sign 5 acknowledgements: scope reviewed, preview reviewed, terms accepted, refund policy acknowledged, non-refundable acknowledged.' },
  { n: 9, title: 'Development', desc: 'Development begins. Source code is gated — you cannot access it until all delivery gates pass.' },
  { n: 10, title: 'Testing', desc: 'Quality assurance: code review, security scan, performance test. Every issue is logged and fixed before launch.' },
  { n: 11, title: 'Launch', desc: 'We deploy to production. You receive staging access to verify the final build.' },
  { n: 12, title: 'Final Delivery', desc: 'After full payment verification, admin approval, and password rotation — source code is released to you.' },
  { n: 13, title: 'Support', desc: '30-day post-delivery bug-fix support included. New features are billed as separate engagements.' },
];

export default function HowWeWorkPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="bg-gradient-to-br from-blue-50 to-green-50 py-20">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold text-slate-900 mb-6">
            How <span className="bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">We Work</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            A transparent, 13-step process from first contact to final delivery. No surprises. No hidden costs. No work begins before you approve the scope.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4">
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-6 mb-12 text-center">
            <strong className="text-amber-900 text-lg">Legal Commitment:</strong>
            <p className="text-amber-800 mt-2">HTML Preview Before Payment. Final source code and applicable final project files are released after required/full payment according to the approved agreement.</p>
          </div>

          <div className="space-y-6">
            {STEPS.map((step) => (
              <div key={step.n} className="flex gap-6 items-start">
                <div className="bg-gradient-to-br from-blue-600 to-cyan-500 text-white w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl flex-shrink-0">
                  {step.n}
                </div>
                <div className="flex-1 bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-slate-600">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link href="/project-brief" className="inline-block bg-gradient-to-r from-blue-600 via-cyan-500 to-green-500 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:shadow-xl transition-shadow">
              🚀 Start a Project
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
