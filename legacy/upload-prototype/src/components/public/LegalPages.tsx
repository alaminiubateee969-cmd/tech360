"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, Calendar, Hash } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiFetch, formatDate } from "@/lib/api";

interface BlogPostDetail {
  post: {
    id: string;
    slug: string;
    title: string;
    excerpt: string | null;
    content: string;
    author: string;
    category: string;
    tags: string;
    featuredImage: string | null;
    publishedAt: string;
  };
  related: Array<{
    slug: string;
    title: string;
    excerpt: string | null;
    featuredImage: string | null;
    publishedAt: string;
  }>;
}

const LEGAL_PAGES = [
  { slug: "privacy-policy", title: "Privacy Policy" },
  { slug: "terms-of-service", title: "Terms of Service" },
  { slug: "refund-policy", title: "Refund Policy" },
  { slug: "delivery-policy", title: "Delivery Policy" },
  { slug: "client-approval", title: "Client Approval" },
];

interface LegalPageData {
  page: {
    id: string;
    slug: string;
    title: string;
    content: string;
    version: number;
    updatedAt: string;
  };
  allPages: Array<{ slug: string; title: string }>;
}

function renderMarkdown(content: string): React.ReactNode {
  // Lightweight markdown renderer (paragraphs, headings, lists, bold)
  const lines = content.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: React.ReactNode[] = [];
  let para: string[] = [];

  const flushPara = () => {
    if (para.length > 0) {
      const text = para.join(" ");
      blocks.push(
        <p
          key={`p-${blocks.length}`}
          className="mt-3 text-sm leading-relaxed text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: inline(text) }}
        />
      );
      para = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      blocks.push(
        <ul key={`ul-${blocks.length}`} className="mt-3 space-y-1.5 pl-5 text-sm text-muted-foreground">
          {list}
        </ul>
      );
      list = [];
    }
  };

  function inline(s: string): string {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code class=\"rounded bg-muted px-1.5 py-0.5 text-xs\">$1</code>");
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("## ")) {
      flushPara();
      flushList();
      blocks.push(
        <h3 key={`h3-${blocks.length}`} className="mt-6 text-lg font-semibold">
          {trimmed.slice(3)}
        </h3>
      );
    } else if (trimmed.startsWith("# ")) {
      flushPara();
      flushList();
      blocks.push(
        <h2 key={`h2-${blocks.length}`} className="mt-6 text-xl font-bold">
          {trimmed.slice(2)}
        </h2>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      flushPara();
      list.push(
        <li key={`li-${blocks.length}-${list.length}`} dangerouslySetInnerHTML={{ __html: inline(trimmed.slice(2)) }} />
      );
    } else if (trimmed === "") {
      flushPara();
      flushList();
    } else {
      para.push(trimmed);
    }
  }
  flushPara();
  flushList();
  return blocks;
}

export function LegalPages({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery<LegalPageData>({
    queryKey: ["legal", slug],
    queryFn: () => apiFetch<LegalPageData>(`/api/legal/${slug}`),
    enabled: !!slug,
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.25 }}
          className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border/60 bg-background shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-center justify-between border-b border-border/60 p-5">
            <div className="flex items-center gap-3">
              <FileText className="size-5 text-primary" />
              <div>
                <div className="font-semibold">
                  {data?.page?.title ?? "Legal"}
                </div>
                {data?.page?.updatedAt && (
                  <div className="text-xs text-muted-foreground">
                    Last updated {formatDate(data.page.updatedAt)}
                    {data?.page?.version ? ` · v${data.page.version}` : ""}
                  </div>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </header>

          <ScrollArea className="flex-1 p-6">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : !data?.page ? (
              <p className="py-12 text-center text-muted-foreground">
                Legal page not found.
              </p>
            ) : (
              <article className="prose prose-sm max-w-none">
                {renderMarkdown(data.page.content)}
              </article>
            )}
          </ScrollArea>

          {/* Footer nav: other legal pages */}
          <footer className="border-t border-border/60 p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Hash className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Related:</span>
              {LEGAL_PAGES.filter((p) => p.slug !== slug).map((p) => (
                <a
                  key={p.slug}
                  href={`#${p.slug}`}
                  className="rounded-full bg-muted px-2.5 py-1 font-medium text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                >
                  {p.title}
                </a>
              ))}
            </div>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function BlogPostModal({
  slug,
  onClose,
}: {
  slug: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery<BlogPostDetail>({
    queryKey: ["blog-post", slug],
    queryFn: () => apiFetch<BlogPostDetail>(`/api/blog/${slug}`),
    enabled: !!slug,
  });

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.25 }}
          className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border/60 bg-background shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-start justify-between gap-3 border-b border-border/60 p-5">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {data?.post?.category && (
                  <Badge variant="secondary">{data.post.category}</Badge>
                )}
                {data?.post?.publishedAt && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="size-3" />
                    {formatDate(data.post.publishedAt)}
                  </span>
                )}
              </div>
              <h2 className="mt-2 line-clamp-2 text-xl font-bold">
                {data?.post?.title ?? "Loading post..."}
              </h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0">
              <X className="size-4" />
            </Button>
          </header>

          <ScrollArea className="flex-1 p-6">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : !data?.post ? (
              <p className="py-12 text-center text-muted-foreground">
                Post not found.
              </p>
            ) : (
              <article className="prose prose-sm max-w-none">
                <p className="text-base font-medium leading-relaxed">
                  {data.post.excerpt}
                </p>
                <div className="mt-4 space-y-3">
                  {renderMarkdown(data.post.content)}
                </div>
                <div className="mt-6 border-t border-border/60 pt-4 text-xs text-muted-foreground">
                  Written by {data.post.author} ·{" "}
                  {formatDate(data.post.publishedAt)}
                </div>

                {data.related.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-sm font-semibold">Related posts</h4>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {data.related.map((r) => (
                        <a
                          key={r.slug}
                          href={`#blog/${r.slug}`}
                          className="rounded-lg border border-border/60 p-3 text-xs transition-colors hover:border-primary/40"
                        >
                          <div className="line-clamp-2 font-medium">
                            {r.title}
                          </div>
                          <div className="mt-1 text-muted-foreground">
                            {formatDate(r.publishedAt)}
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            )}
          </ScrollArea>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
