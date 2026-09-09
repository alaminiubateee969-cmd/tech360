"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHero } from "./PageHero";
import { CtaBand } from "./CtaBand";
import { RevealList, RevealItem } from "./Reveal";

interface BlogListPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  publishedAt: string;
  coverImage?: string;
}

function formatDate(value: string) {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return value;
  }
}

export default function BlogView() {
  // Derived-loading pattern: the cache records which request it belongs to,
  // so "loading" is computed by comparing keys — no setState in the effect body.
  const [tick, setTick] = useState(0);
  const [cache, setCache] = useState<{
    key: number;
    posts: BlogListPost[] | null;
    error: string | null;
  }>({ key: -1, posts: null, error: null });

  const requestKey = tick;
  const fresh = cache.key === requestKey;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/blog")
      .then(async (res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = (await res.json()) as { posts?: BlogListPost[] };
        if (!cancelled)
          setCache({
            key: requestKey,
            posts: Array.isArray(data.posts) ? data.posts : [],
            error: null,
          });
      })
      .catch(() => {
        if (!cancelled)
          setCache({
            key: requestKey,
            posts: null,
            error: "Articles could not be loaded right now.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey]);

  const posts = fresh ? cache.posts : null;
  const error = fresh ? cache.error : null;
  const reload = () => setTick((t) => t + 1);

  return (
    <main id="main-content">
      <PageHero
        eyebrow="Insights"
        title="Engineering notes and delivery thinking"
        description="How we build: trust mechanics, automation discipline, architecture choices and the lessons behind our policies."
        breadcrumb={[{ label: "Blog" }]}
      />

      <section aria-labelledby="articles-heading" className="bg-[#F4FAFF]">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <h2 id="articles-heading" className="sr-only">Article list</h2>

          {posts === null && !error ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <Card key={i} className="border-[#E2E8F0] bg-white">
                  <CardContent className="space-y-4 p-6">
                    <Skeleton className="h-5 w-24 rounded-md" />
                    <Skeleton className="h-6 w-full rounded-md" />
                    <Skeleton className="h-6 w-4/5 rounded-md" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-5/6" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}

          {error ? (
            <Card className="mx-auto max-w-2xl border-[#E2E8F0] bg-white">
              <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
                <CircleAlert className="size-8 text-[#B4472A]" aria-hidden="true" />
                <p className="max-w-md text-sm text-[#526173]">{error}</p>
                <Button
                  variant="outline"
                  className="min-h-11 rounded-lg"
                  onClick={reload}
                >
                  Try again
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {posts && posts.length === 0 && !error ? (
            <p className="col-span-full py-10 text-center text-sm text-[#526173]">
              No articles published yet. New engineering notes are on the way.
            </p>
          ) : null}

          {posts && posts.length > 0 ? (
            <RevealList className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {posts.map((post) => (
                  <RevealItem key={post.slug} className="h-full">
                    <a
                      href={`#/blog/${post.slug}`}
                      className="group flex h-full flex-col rounded-xl border border-[#E2E8F0] bg-white p-6 outline-none transition-all duration-300 hover:-translate-y-1 hover:border-[#009FE3]/40 hover:shadow-[0_12px_32px_rgba(6,59,143,0.1)] focus-visible:ring-2 focus-visible:ring-[#009FE3]"
                    >
                      <div className="flex items-center gap-3">
                        <Badge className="rounded-md bg-[#009FE3]/10 text-xs font-medium text-[#0079AC] hover:bg-[#009FE3]/10">
                          {post.category}
                        </Badge>
                        <time className="text-xs text-[#526173]">
                          {formatDate(post.publishedAt)}
                        </time>
                      </div>
                      <h3 className="mt-4 text-lg font-semibold leading-snug text-[#0B1F33] group-hover:text-[#063B8F]">
                        {post.title}
                      </h3>
                      <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-[#526173]">
                        {post.excerpt}
                      </p>
                      <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#009FE3]">
                        Read article
                        <ArrowRight
                          className="size-3.5 transition-transform group-hover:translate-x-1"
                          aria-hidden="true"
                        />
                      </span>
                    </a>
                  </RevealItem>
                ))}
            </RevealList>
          ) : null}
        </div>
      </section>

      <CtaBand
        title="Reading is good — building is better"
        description="If any of these ideas apply to your business, the next step is a written scope. One message starts it."
      />
    </main>
  );
}
