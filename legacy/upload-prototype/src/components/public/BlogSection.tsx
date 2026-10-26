"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { apiFetch, formatDate } from "@/lib/api";

interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  author: string;
  category: string;
  tags: string;
  featuredImage: string | null;
  publishedAt: string;
}

interface BlogList {
  posts: BlogPost[];
  categories: Array<{ name: string; count: number }>;
}

export function BlogSection() {
  const [category, setCategory] = React.useState<string>("all");

  const { data, isLoading } = useQuery<BlogList>({
    queryKey: ["blog", category],
    queryFn: () => {
      const params = new URLSearchParams({ limit: "6" });
      if (category !== "all") params.set("category", category);
      return apiFetch<BlogList>(`/api/blog?${params.toString()}`);
    },
  });

  const posts = data?.posts ?? [];
  const categories = data?.categories ?? [];
  const featured = posts[0];
  const recent = posts.slice(1, 5);

  return (
    <section id="blog" className="border-y border-border/40 bg-card/30">
      <div className="mx-auto max-w-[1400px] px-4 py-16 md:px-6 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">
            Insights
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            From the Tech360 blog
          </h2>
          <p className="mt-4 text-muted-foreground">
            Field notes on AI, automation, CRM architecture, and the
            operating-system mindset that runs ambitious businesses.
          </p>
        </div>

        {/* Category filter */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          <button
            onClick={() => setCategory("all")}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              category === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c.name}
              onClick={() => setCategory(c.name)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                category === c.name
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {c.name} ({c.count})
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-xl" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <Card className="mt-10 p-12 text-center text-muted-foreground">
            No posts published yet. Check back soon.
          </Card>
        ) : (
          <>
            {/* Featured */}
            {featured && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
                className="mt-10"
              >
                <Card className="group grid grid-cols-1 overflow-hidden md:grid-cols-2">
                  <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-primary/15 via-primary/5 to-background md:aspect-auto">
                    {featured.featuredImage ? (
                      <img
                        src={featured.featuredImage}
                        alt={featured.title}
                        className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid size-full place-items-center">
                        <div className="text-7xl font-black text-primary/15">
                          T360
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col justify-between p-6 md:p-8">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{featured.category}</Badge>
                        <Badge variant="outline">Featured</Badge>
                      </div>
                      <h3 className="mt-3 text-2xl font-bold leading-snug">
                        {featured.title}
                      </h3>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {featured.excerpt ?? "Read this post on the Tech360 blog."}
                      </p>
                    </div>
                    <div className="mt-6 flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        <div>{featured.author}</div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="size-3" />
                          {formatDate(featured.publishedAt)}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => {
                          window.location.hash = `#blog/${featured.slug}`;
                        }}
                      >
                        Read post <ArrowRight className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Recent */}
            {recent.length > 0 && (
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {recent.map((post, i) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                  >
                    <Card
                      className="group flex h-full cursor-pointer flex-col gap-3 p-5 transition-all hover:border-primary/40 hover:shadow-lg"
                      onClick={() => {
                        window.location.hash = `#blog/${post.slug}`;
                      }}
                    >
                      <Badge variant="secondary" className="w-fit text-xs">
                        {post.category}
                      </Badge>
                      <h4 className="line-clamp-2 font-semibold leading-snug">
                        {post.title}
                      </h4>
                      <p className="line-clamp-3 text-xs text-muted-foreground">
                        {post.excerpt ?? "Read more on the Tech360 blog."}
                      </p>
                      <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{post.author}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {formatDate(post.publishedAt)}
                        </span>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
