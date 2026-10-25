const CATEGORIES = [
  { title: 'Frontend', icon: '🎨', techs: ['HTML5', 'CSS3', 'JavaScript (Vanilla)', 'React / Next.js', 'Tailwind CSS', 'Responsive Design', 'WCAG Accessibility'] },
  { title: 'Backend', icon: '⚙️', techs: ['Node.js 22', 'Next.js 16 API Routes', 'Prisma ORM', 'TypeScript', 'Bun Runtime', 'RESTful API Design'] },
  { title: 'Database', icon: '🗄️', techs: ['MySQL 8', 'Prisma Schema', 'Database Migrations', 'Query Optimization', 'Indexing Strategy'] },
  { title: 'Cloud', icon: '☁️', techs: ['Hostinger VPS', 'Linux Hosting', 'SSL / HTTPS', 'Cron Scheduling', 'Backup Strategy', 'CDN'] },
  { title: 'Automation', icon: '🔧', techs: ['n8n Workflow', 'Cron Jobs', 'Webhook Automation', 'Event-Driven Architecture', 'API Integrations'] },
  { title: 'APIs', icon: '🔌', techs: ['REST API Design', 'HMAC Signature Verification', 'Rate Limiting', 'Webhook Handling', 'OAuth / JWT'] },
  { title: 'Communication', icon: '💬', techs: ['WhatsApp Business API', 'SMTP Email (Hostinger)', 'SMS Notifications', 'In-App Messaging'] },
  { title: 'Analytics', icon: '📊', techs: ['First-Party Visitor Tracking', 'UTM Attribution', 'Google Tag Manager', 'Meta Pixel', 'Custom Event Tracking'] },
  { title: 'Security', icon: '🛡️', techs: ['CSRF Protection', 'HMAC Webhook Verification', 'Rate Limiting', 'Encrypted Sessions', 'RBAC Authorization', 'Audit Logging', 'No-Delete Policy'] },
  { title: 'AI Integration', icon: '🤖', techs: ['OpenAI API', 'DeepSeek API', 'Z.AI API', 'Ollama (local)', 'UnoRouter / OpenRouter', 'AI Agent Platform', 'Approval-Based Execution'] },
];

export default function TechnologiesPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="bg-gradient-to-br from-blue-50 to-green-50 py-20">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold text-slate-900 mb-6">
            Our <span className="bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">Technology Stack</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            Only technologies we actually use in production. No inflated claims, no fake certifications, no partnerships we don't have.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {CATEGORIES.map((cat) => (
              <div key={cat.title} className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm hover:shadow-xl transition-shadow">
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-2xl">
                    {cat.icon}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">{cat.title}</h3>
                </div>
                <ul className="space-y-2">
                  {cat.techs.map((tech) => (
                    <li key={tech} className="flex items-center gap-2 text-slate-600 py-1.5 border-b border-slate-100 last:border-0">
                      <span className="text-green-500">✓</span>
                      {tech}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
