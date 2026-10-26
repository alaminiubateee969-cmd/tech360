"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, BookOpen, Eye, Tag } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, formatDate } from "@/lib/api";

interface CrmData {
  knowledge: Array<{
    id: string;
    title: string;
    slug: string;
    category: string;
    content: string;
    tags: string;
    views: number;
    createdAt: string;
  }>;
}

export function KnowledgeList() {
  const { data, isLoading } = useQuery<CrmData>({
    queryKey: ["crm-kb"],
    queryFn: () => apiFetch<CrmData>("/api/crm"),
  });
  const [q, setQ] = React.useState("");
  const [cat, setCat] = React.useState<string>("all");

  const all = data?.knowledge ?? [];
  const categories = Array.from(new Set(all.map((a) => a.category)));
  const filtered = all.filter((a) => {
    const matchesQ =
      q === "" ||
      a.title.toLowerCase().includes(q.toLowerCase()) ||
      a.content.toLowerCase().includes(q.toLowerCase()) ||
      a.tags.toLowerCase().includes(q.toLowerCase());
    const matchesCat = cat === "all" || a.category === cat;
    return matchesQ && matchesCat;
  });

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search articles, tags, content..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setCat("all")}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                cat === "all"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCat(c)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  cat === c
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 w-full rounded-xl" />
            ))
          : filtered.map((a) => {
              const tags = a.tags.split("|").filter(Boolean);
              return (
                <Card key={a.id} className="group flex flex-col p-5 transition-all hover:border-primary/40 hover:shadow-md">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <BookOpen className="size-3.5" />
                    {a.category}
                  </div>
                  <h3 className="mt-2 line-clamp-2 font-semibold leading-tight">
                    {a.title}
                  </h3>
                  <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">
                    {a.content}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
                    <div className="flex flex-wrap items-center gap-1">
                      <Tag className="size-3 text-muted-foreground" />
                      {tags.slice(0, 2).map((t) => (
                        <span
                          key={t}
                          className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Eye className="size-3" />
                      {a.views}
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-muted-foreground">
                    Updated {formatDate(a.createdAt)}
                  </div>
                </Card>
              );
            })}
        {!isLoading && filtered.length === 0 && (
          <Card className="col-span-full p-12 text-center text-sm text-muted-foreground">
            No articles match your search.
          </Card>
        )}
      </div>
    </div>
  );
}
