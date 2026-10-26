"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FolderTree, FileCode2, ChevronRight, Cpu, Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

interface SkillCatalog {
  totalSkills: number;
  totalCategories: number;
  catalog: Array<{
    category: string;
    path: string;
    count: number;
    sample: string;
    description: string;
  }>;
}

export function SkillResolverBadge({ skillPath }: { skillPath?: string }) {
  if (!skillPath) return null;
  return (
    <div className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-1 font-mono text-[10px] text-muted-foreground">
      <Cpu className="size-3 text-violet-500" />
      {skillPath}
    </div>
  );
}

export function SkillResolver() {
  const { data, isLoading } = useQuery<SkillCatalog>({
    queryKey: ["skills"],
    queryFn: () => apiFetch<SkillCatalog>("/api/skills"),
  });

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-lg bg-violet-500/12 text-violet-500">
              <Layers className="size-5" />
            </div>
            <div>
              <h3 className="font-semibold">AgentOS Skill Resolver</h3>
              <p className="text-xs text-muted-foreground">
                Catalog of SKILL.md manifests the agents resolve against
              </p>
            </div>
          </div>
        </div>
        {data && (
          <div className="text-right">
            <div className="text-xl font-bold">{data.totalSkills.toLocaleString()}</div>
            <div className="text-[10px] text-muted-foreground">skills · {data.totalCategories} categories</div>
          </div>
        )}
      </div>

      <div className="mt-4 space-y-1.5">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))
          : data?.catalog.map((c, i) => (
              <motion.div
                key={c.category}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="group rounded-lg border border-border/60 bg-background/40 p-3 transition-colors hover:border-violet-500/40"
              >
                <div className="flex items-center gap-2">
                  <FolderTree className="size-4 shrink-0 text-violet-500" />
                  <span className="font-mono text-xs font-medium">{c.path}</span>
                  <Badge variant="secondary" className="ml-auto font-mono text-[10px]">
                    {c.count}
                  </Badge>
                </div>
                <p className="mt-1.5 pl-6 text-xs text-muted-foreground">{c.description}</p>
                <div className="mt-2 flex items-center gap-1.5 pl-6 text-[10px] text-muted-foreground">
                  <FileCode2 className="size-3" />
                  <code className="truncate">{c.sample}</code>
                  <ChevronRight className="ml-auto size-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </motion.div>
            ))}
      </div>
    </Card>
  );
}
