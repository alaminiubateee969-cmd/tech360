import { db } from "../src/lib/db";

async function main() {
  console.log("Seeding legal pages...");
  const legalPages = [
    { slug: "privacy-policy", title: "Privacy Policy", content: "# Privacy Policy\n\nTech360 respects your privacy. We collect only necessary data, encrypt it with AES-256, and never sell it. Contact: privacy@bdtech360.com" },
    { slug: "terms-of-service", title: "Terms of Service", content: "# Terms of Service\n\n50% advance, 30% milestone, 20% handover. Source code transfers on full payment. Contact: legal@bdtech360.com" },
    { slug: "refund-policy", title: "Refund Policy", content: "# Refund Policy\n\nAdvance non-refundable once work starts. 80% refund if cancelled before. Contact: billing@bdtech360.com" },
    { slug: "delivery-policy", title: "Delivery Policy", content: "# Delivery Policy\n\nAll deliverables tested. Handover includes source code + 30-day support. Contact: delivery@bdtech360.com" },
    { slug: "client-approval", title: "Client Approval", content: "# Client Approval\n\nScope must be approved. HTML preview before payment. Password change required. Contact: approvals@bdtech360.com" },
  ];
  for (const lp of legalPages) { await db.legalPage.upsert({ where: { slug: lp.slug }, create: { ...lp, status: "ACTIVE" }, update: { ...lp, status: "ACTIVE" } }); }
  console.log(`  ✓ ${legalPages.length} legal pages`);

  console.log("Seeding blog posts...");
  const posts = [
    { slug: "ai-crm-revolution", title: "How AI is Revolutionizing CRM", excerpt: "340% more lead conversion with AI-powered CRM.", content: "AI transforms CRM with automated scoring, routing, and follow-ups.", category: "AI", tags: '["AI","CRM"]' },
    { slug: "whatsapp-automation", title: "WhatsApp Business Automation", excerpt: "98% open rate. Automate WhatsApp for business.", content: "WhatsApp Cloud API enables automated lead intake and reminders.", category: "Automation", tags: '["WhatsApp"]' },
    { slug: "nextjs-production", title: "Next.js 16 in Production", excerpt: "Scalable web apps with Next.js 16.", content: "App Router, TypeScript, Tailwind, Prisma, Cloud Run.", category: "Technology", tags: '["Next.js"]' },
    { slug: "enterprise-ai-workforce", title: "The Enterprise AI Workforce", excerpt: "2,000 agents across 100 departments.", content: "DCC certification, constitutional rules, 8-step safety pipeline.", category: "AI", tags: '["AI","Enterprise"]' },
    { slug: "digital-bangladesh", title: "Digital Transformation in Bangladesh", excerpt: "130M+ internet users. Huge opportunity.", content: "Key sectors: e-commerce, EdTech, FinTech, HealthTech.", category: "Business", tags: '["Bangladesh"]' },
  ];
  for (const p of posts) { await db.blogPost.upsert({ where: { slug: p.slug }, create: { ...p, author: "Tech360 Team", status: "PUBLISHED" }, update: { ...p, status: "PUBLISHED" } }); }
  console.log(`  ✓ ${posts.length} blog posts`);

  console.log("Seeding reviews...");
  const reviews = [
    { rating: 5, title: "Transformed our business", content: "CRM + WhatsApp automation cut response time by 70%.", authorName: "Imran Khan", authorRole: "CEO", isPublic: true, isApproved: true },
    { rating: 5, title: "Professional and reliable", content: "Delivered on time with all features working.", authorName: "Helena Ortiz", authorRole: "Founder", isPublic: true, isApproved: true },
    { rating: 5, title: "Best investment", content: "AI Command Center saves 30+ hours per week.", authorName: "Marcus Lee", authorRole: "COO", isPublic: true, isApproved: true },
    { rating: 5, title: "Exceeded expectations", content: "They built an operating system, not just software.", authorName: "Lena Petrova", authorRole: "Marketing Director", isPublic: true, isApproved: true },
    { rating: 5, title: "Seamless experience", content: "Every step tracked from first message to delivery.", authorName: "Sara Mitchell", authorRole: "Operations Manager", isPublic: true, isApproved: true },
  ];
  for (const r of reviews) { await db.review.create({ data: r }); }
  console.log(`  ✓ ${reviews.length} reviews`);
  console.log("Done!");
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) });
