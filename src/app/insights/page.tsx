import { db } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function InsightsPage() {
  let posts: { id: string; title: string; slug: string; content: string; category: string; createdAt: Date }[] = [];

  try {
    posts = await db.knowledgeArticle.findMany({
      orderBy: { createdAt: 'desc' },
      take: 9,
      select: { id: true, title: true, slug: true, content: true, category: true, createdAt: true },
    });
  } catch {
    // If table doesn't exist yet, show empty state
  }

  return (
    <div className="min-h-screen bg-white">
      <section className="bg-gradient-to-br from-blue-50 to-green-50 py-20">
        <div className="max-w-5xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold text-slate-900 mb-6">
            Tech360 <span className="bg-gradient-to-r from-blue-600 to-green-500 bg-clip-text text-transparent">Insights</span>
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            Analysis, perspectives, and practical guides on software engineering, automation, and building digital systems that last.
          </p>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          {posts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {posts.map((post) => (
                <div key={post.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-shadow">
                  <div className="p-6">
                    <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-3">
                      {post.category}
                    </span>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{post.title}</h3>
                    <p className="text-slate-600 text-sm mb-4">
                      {post.content.substring(0, 120)}...
                    </p>
                    <Link href={`/insights/${post.slug}`} className="text-blue-600 font-semibold hover:underline">
                      Read More →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <div className="text-5xl mb-4">📰</div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">No Articles Yet</h3>
              <p className="text-slate-600 mb-6">We're preparing our first articles. Check back soon.</p>
              <Link href="/contact" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700">
                Contact Us with Questions
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
