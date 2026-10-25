"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Image as ImageIcon,
  Package,
  Receipt,
  FileBox,
  Download,
  Upload,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { apiFetch, formatDate } from "@/lib/api";

interface CrmData {
  files: Array<{
    id: string;
    name: string;
    category: string;
    sizeKb: number;
    createdAt: string;
    project: { name: string } | null;
  }>;
}

const CATEGORIES = [
  { id: "all", label: "All", icon: FileBox },
  { id: "CONTRACT", label: "Contracts", icon: FileText, color: "text-amber-500 bg-amber-500/10" },
  { id: "DESIGN", label: "Designs", icon: ImageIcon, color: "text-violet-500 bg-violet-500/10" },
  { id: "DELIVERABLE", label: "Deliverables", icon: Package, color: "text-emerald-500 bg-emerald-500/10" },
  { id: "INVOICE", label: "Invoices", icon: Receipt, color: "text-sky-500 bg-sky-500/10" },
];

function formatSize(kb: number): string {
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function FilesManager() {
  const { data, isLoading } = useQuery<CrmData>({
    queryKey: ["crm-files"],
    queryFn: () => apiFetch<CrmData>("/api/crm"),
  });
  const [cat, setCat] = React.useState("all");
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    const formData = new FormData();
    formData.append("files", fileList[0]);
    formData.append("category", cat === "all" ? "OTHER" : cat);
    try {
      const res = await fetch("/api/files/upload", { method: "POST", body: formData });
      if (res.ok) { toast.success(`${fileList[0].name} uploaded`); queryClient.invalidateQueries({ queryKey: ["crm-files"] }); }
      else { toast.error("Upload failed"); }
    } catch { toast.error("Upload failed"); }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const files = (data?.files ?? []).filter(
    (f) => cat === "all" || f.category === cat
  );

  return (
    <div className="space-y-4">
      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = cat === c.id;
          return (
            <Button
              key={c.id}
              variant={active ? "default" : "outline"}
              size="sm"
              className="gap-2"
              onClick={() => setCat(c.id)}
            >
              <Icon className="size-4" />
              {c.label}
            </Button>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto gap-2"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="size-4" />
          Upload
        </Button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : files.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            No files in this category.
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {files.map((f) => {
              const cat = CATEGORIES.find((c) => c.id === f.category);
              const Icon = cat?.icon ?? FileText;
              const color = cat?.color ?? "bg-muted text-muted-foreground";
              return (
                <li
                  key={f.id}
                  className="flex items-center gap-3 p-3 transition-colors hover:bg-muted/30"
                >
                  <div className={`grid size-10 shrink-0 place-items-center rounded-lg ${color}`}>
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{f.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {f.project?.name ?? "Unassigned"} · {formatSize(f.sizeKb)} · {formatDate(f.createdAt)}
                    </div>
                  </div>
                  <Badge variant="outline" className="hidden font-normal sm:inline-flex">
                    {f.category}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    onClick={() => window.open(`/api/files/${f.id}/download`, "_blank")}
                  >
                    <Download className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
