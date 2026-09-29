"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, CircleAlert, Clock, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CtaBand } from "./CtaBand";
import { Reveal } from "./Reveal";

interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  author: string;
  publishedAt: string;
  views?: number;
}

/* ------------------------------------------------------------------ */
/* Reading progress — rAF-driven, fixed brand bar, zero re-renders    */
/* ------------------------------------------------------------------ */

function ReadingProgress() {
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      const pct = scrollable > 0 ? Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100)) : 0;
      bar.style.width = `${pct.toFixed(1)}%`;
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] h-[3px] bg-transparent print:hidden"
      role="progressbar"
      aria-label="Article reading progress"
    >
      <div
        ref={barRef}
        className="h-full w-0 bg-gradient-to-r from-[#009FE3] via-[#18B83A] to-[#009FE3] transition-[width] duration-75 ease-linear"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lightweight markdown renderer (headings, bold, lists, paragraphs)    */
/* ------------------------------------------------------------------ */

type Block =
  | { kind: "h2" | "h3" | "h4"; text: string }
  | { kind: "p"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] };

function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const lines = markdown.split(/\r?\n/);
  let list: { kind: "ul" | "ol"; items: string[] } | null = null;

  const flushList = () => {
    if (list) {
      blocks.push({ ...list });
      list = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushList();
      continue;
    }
    if (line.startsWith("### ")) {
      flushList();
      blocks.push({ kind: "h4", text: line.slice(4) });
    } else if (line.startsWith("## ")) {
      flushList();
      blocks.push({ kind: "h3", text: line.slice(3) });
    } else if (line.startsWith("# ")) {
      flushList();
      blocks.push({ kind: "h2", text: line.slice(2) });
    } else if (line.startsWith("- ")) {
      if (!list || list.kind !== "ul") {
        flushList();
        list = { kind: "ul", items: [] };
      }
      list.items.push(line.slice(2));
    } else if (/^\d+\.\s/.test(line)) {
      if (!list || list.kind !== "ol") {
        flushList();
        list = { kind: "ol", items: [] };
      }
      list.items.push(line.replace(/^\d+\.\s/, ""));
    } else {
      flushList();
      blocks.push({ kind: "p", text: line });
    }
  }
  flushList();
  return blocks;
}

/** Renders **bold** inline; everything else stays plain text. */
function InlineText({ text }: { text: string }) {
  const parts = useMemo(() => text.split(/\*\*(.+?)\*\*/g), [text]);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-[#0B1F33]">
            {part}
          </strong>
        ) : (
          part
        )
      )}
    </>
  );
}

function MarkdownBody({ content }: { content: string }) {
  const blocks = useMemo(() => parseBlocks(content), [content]);
  return (
    <div className="space-y-5">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "h2":
            return (
              <h2 key={i} className="pt-4 text-2xl font-bold tracking-tight text-[#0B1F33]">
                <InlineText text={block.text} />
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className="pt-2 text-xl font-semibold tracking-tight text-[#0B1F33]">
                <InlineText text={block.text} />
              </h3>
            );
          case "h4":
            return (
              <h4 key={i} className="pt-1 text-lg font-semibold text-[#0B1F33]">
                <InlineText text={block.text} />
              </h4>
            );
          case "ul":
            return (
              <ul key={i} className="space-y-2.5">
                {block.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-base leading-relaxed text-[#526173]">
                    <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-[#009FE3]" />
                    <span>
                      <InlineText text={item} />
                    </span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="space-y-2.5">
                {block.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-3 text-base leading-relaxed text-[#526173]">
                    <span
                      aria-hidden="true"
                      className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-[#009FE3]/10 text-xs font-bold text-[#009FE3]"
                    >
                      {j + 1}
                    </span>
                    <span>
                      <InlineText text={item} />
                    </span>
                  </li>
                ))}
              </ol>
            );
          default:
            return (
              <p key={i} className="text-base leading-relaxed text-[#526173]">
                <InlineText text={block.text} />
              </p>
            );
        }
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

function formatDate(value: string) {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return value;
  }
}

export default function BlogPostView({ slug }: { slug: string }) {
  // Derived-loading pattern: the cache records which slug it belongs to, so
  // "loading" is computed by comparing slugs — no setState in the effect body.
  const [cache, setCache] = useState<{
    slug: string;
    post: BlogPost | null;
    notFound: boolean;
    error: string | null;
  }>({ slug: "", post: null, notFound: false, error: null });

  const fresh = cache.slug === slug;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/blog/${encodeURIComponent(slug)}`)
      .then(async (res) => {
        if (res.status === 404) {
          if (!cancelled)
            setCache({ slug, post: null, notFound: true, error: null });
          return;
        }
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = (await res.json()) as { post?: BlogPost };
        if (!cancelled)
          setCache(
            data.post
              ? { slug, post: data.post, notFound: false, error: null }
              : { slug, post: null, notFound: true, error: null }
          );
      })
      .catch(() => {
        if (!cancelled)
          setCache({
            slug,
            post: null,
            notFound: false,
            error: "This article could not be loaded right now.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const post = fresh ? cache.post : null;
  const notFound = fresh && cache.notFound;
  const error = fresh ? cache.error : null;

  const readingMinutes = useMemo(() => {
    if (!post) return 0;
    const words = post.content.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  }, [post]);

  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    const url =
      typeof window !== "undefined"
        ? window.location.href
        : "https://bdtech360.com/#/blog";
    try {
      await navigator.clipboard.writeText(`${post?.title ?? "Tech360 article"} — ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — the link remains visible in the address bar.
    }
  };

  const header = (
    <nav aria-label="Breadcrumb" className="mb-8">
      <a
        href="#/blog"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[#009FE3] outline-none transition-colors hover:text-[#063B8F] focus-visible:ring-2 focus-visible:ring-[#009FE3] rounded-sm"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to all articles
      </a>
    </nav>
  );

  return (
    <main id="main-content">
      {notFound ? (
        <section className="bg-[#F4FAFF]">
          <div className="mx-auto w-full max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
            {header}
            <h1 className="text-3xl font-bold tracking-tight text-[#0B1F33]">
              Article not found
            </h1>
            <p className="mt-4 text-base leading-relaxed text-[#526173]">
              This article may have been moved or the link is outdated. Browse
              the full list for the latest engineering notes.
            </p>
          </div>
        </section>
      ) : error ? (
        <section className="bg-[#F4FAFF]">
          <div className="mx-auto w-full max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
            {header}
            <Card className="border-[#E2E8F0] bg-white">
              <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
                <CircleAlert className="size-8 text-[#B4472A]" aria-hidden="true" />
                <p className="text-sm text-[#526173]">{error}</p>
                <Button variant="outline" className="min-h-11 rounded-lg" asChild>
                  <a href="#/blog" className="focus-visible:outline-none">
                    Back to all articles
                  </a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      ) : !post ? (
        <section className="bg-[#F4FAFF]" aria-busy="true" aria-label="Loading article">
          <div className="mx-auto w-full max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
            {header}
            <Skeleton className="h-5 w-28 rounded-md" />
            <Skeleton className="mt-6 h-10 w-full rounded-lg" />
            <Skeleton className="mt-3 h-10 w-4/5 rounded-lg" />
            <Skeleton className="mt-8 h-4 w-full" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-3 h-4 w-5/6" />
            <Skeleton className="mt-8 h-6 w-40 rounded-md" />
            <Skeleton className="mt-4 h-4 w-full" />
            <Skeleton className="mt-3 h-4 w-full" />
            <Skeleton className="mt-3 h-4 w-3/4" />
          </div>
        </section>
      ) : (
        <article className="bg-white">
          <ReadingProgress />
          <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            {header}
            <Reveal>
              <div className="flex flex-wrap items-center gap-3">
                <Badge className="rounded-md bg-[#009FE3]/10 text-xs font-medium text-[#0079AC] hover:bg-[#009FE3]/10">
                  {post.category}
                </Badge>
                <time className="text-xs text-[#526173]">
                  {formatDate(post.publishedAt)}
                </time>
                <span className="flex items-center gap-1.5 text-xs text-[#526173]">
                  <Clock className="size-3.5" aria-hidden="true" />
                  {readingMinutes} min read
                </span>
                {post.author ? (
                  <span className="text-xs text-[#526173]">· {post.author}</span>
                ) : null}
              </div>
              <h1 className="mt-5 text-3xl font-bold leading-tight tracking-tight text-[#0B1F33] sm:text-4xl">
                {post.title}
              </h1>
              <p className="mt-4 text-lg leading-relaxed text-[#526173]">
                {post.excerpt}
              </p>
            </Reveal>
            <div className="my-10 h-px w-full bg-[#E2E8F0]" role="separator" />
            <MarkdownBody content={post.content} />
            <div className="mt-12 rounded-xl border border-[#E2E8F0] bg-[#F4FAFF] p-6">
              <p className="text-sm font-semibold text-[#0B1F33]">
                Found this useful? Share it with someone building a business.
              </p>
              <button
                type="button"
                onClick={copyLink}
                aria-label="Copy the article link to your clipboard"
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#063B8F] px-4 py-2.5 text-sm font-semibold text-white outline-none transition-colors hover:bg-[#0B1F33] focus-visible:ring-2 focus-visible:ring-[#063B8F] focus-visible:ring-offset-2"
              >
                {copied ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <Link2 className="size-4" aria-hidden="true" />
                )}
                {copied ? "Link copied" : "Copy article link"}
              </button>
            </div>
          </div>
        </article>
      )}

      <CtaBand
        title="Turn the idea into a system"
        description="Every article on this site reflects how we actually deliver. If one of these problems is yours, start the conversation — scope and preview first, payment after."
      />
    </main>
  );
}
