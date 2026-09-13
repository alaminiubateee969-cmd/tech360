"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CircleAlert, Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
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

  // search + category filter (client-side over the real post list)
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const categories = useMemo(
    () => Array.from(new Set((posts ?? []).map((p) => p.category).filter(Boolean))).sort(),
    [posts],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (posts ?? []).filter((p) => {
      if (category && p.category !== category) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.excerpt.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [posts, query, category]);

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

          {/* search + category filter */}
          {posts && posts.length > 0 ? (
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center" role="search" aria-label="Filter articles">
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#7A8CA0]" aria-hidden="true" />
                <Input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search articles…"
                  aria-label="Search articles by title or topic"
                  className="h-11 rounded-lg border-[#E2E8F0] bg-white pl-10 text-sm text-[#0B1F33] placeholder:text-[#7A8CA0] focus-visible:border-[#009FE3] focus-visible:ring-2 focus-visible:ring-[#009FE3]/25"
                />
              </div>
              {categories.length > 1 ? (
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by category">
                  <button
                    type="button"
                    onClick={() => setCategory(null)}
                    aria-pressed={category === null}
                    className={cn(
                      "min-h-9 rounded-full border px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3]/40",
                      category === null
                        ? "border-[#009FE3]/60 bg-[#009FE3]/10 text-[#0079AC]"
                        : "border-[#E2E8F0] bg-white text-[#526173] hover:border-[#009FE3]/40 hover:text-[#0B1F33]",
                    )}
                  >
                    All topics
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(category === c ? null : c)}
                      aria-pressed={category === c}
                      className={cn(
                        "min-h-9 rounded-full border px-3.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3]/40",
                        category === c
                          ? "border-[#009FE3]/60 bg-[#009FE3]/10 text-[#0079AC]"
                          : "border-[#E2E8F0] bg-white text-[#526173] hover:border-[#009FE3]/40 hover:text-[#0B1F33]",
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              ) : null}
              <p className="text-xs text-[#7A8CA0] lg:ml-auto" aria-live="polite">
                {filtered.length} of {posts.length} article{posts.length === 1 ? "" : "s"}
              </p>
            </div>
          ) : null}

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

          {posts && posts.length > 0 && filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[#E2E8F0] bg-white px-6 py-14 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-[#009FE3]/10" aria-hidden="true">
                <SearchX className="size-5 text-[#009FE3]" />
              </span>
              <p className="text-sm font-semibold text-[#0B1F33]">No articles match your search</p>
              <p className="max-w-sm text-xs leading-relaxed text-[#526173]">
                Try a different keyword, or clear the filters to see every published article.
              </p>
              <Button
                variant="outline"
                className="mt-1 min-h-11 rounded-lg"
                onClick={() => {
                  setQuery("");
                  setCategory(null);
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : null}

          {posts && filtered.length > 0 ? (
            <RevealList className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((post) => (
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
