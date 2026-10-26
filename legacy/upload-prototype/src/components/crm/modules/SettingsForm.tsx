"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Loader2, Settings2, MessageCircle, Mail, Bot } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface SettingsList {
  settings: Array<{ key: string; value: string; category: string }>;
}

const TABS = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "smtp", label: "SMTP", icon: Mail },
  { id: "ai", label: "AI", icon: Bot },
] as const;

const FIELD_DEFS: Record<string, Array<{ key: string; label: string; type?: "text" | "switch" }>> = {
  general: [
    { key: "general.company_name", label: "Company name" },
    { key: "general.support_email", label: "Support email" },
    { key: "general.support_phone", label: "Support phone" },
    { key: "general.domain", label: "Domain" },
  ],
  whatsapp: [
    { key: "whatsapp.phone_number", label: "WhatsApp phone number" },
    { key: "whatsapp.api_token", label: "API token" },
    { key: "whatsapp.business_id", label: "Business ID" },
    { key: "whatsapp.auto_reply", label: "Auto-reply to inbound messages", type: "switch" },
  ],
  smtp: [
    { key: "smtp.host", label: "SMTP host" },
    { key: "smtp.port", label: "Port" },
    { key: "smtp.username", label: "Username" },
    { key: "smtp.from_email", label: "From email" },
  ],
  ai: [
    { key: "ai.model", label: "Default model" },
    { key: "ai.temperature", label: "Temperature" },
    { key: "ai.max_tokens", label: "Max tokens" },
    { key: "ai.skills_root", label: "AgentOS skills root" },
  ],
};

export function SettingsForm() {
  const { data, isLoading } = useQuery<SettingsList>({
    queryKey: ["settings"],
    queryFn: () => apiFetch<SettingsList>("/api/settings"),
  });
  const qc = useQueryClient();
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);

  // Hydrate draft from server.
  React.useEffect(() => {
    if (!data) return;
    const next: Record<string, string> = {};
    for (const s of data.settings) next[s.key] = s.value;
    setDraft(next);
  }, [data]);

  function setValue(key: string, value: string) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function onSave(category: string) {
    const fields = FIELD_DEFS[category];
    const payload = fields.map((f) => ({
      key: f.key,
      value: draft[f.key] ?? "",
      category,
    }));
    setSaving(true);
    try {
      await apiFetch("/api/settings", {
        method: "POST",
        body: JSON.stringify({ settings: payload }),
      });
      toast.success(`${category} settings saved.`);
      qc.invalidateQueries({ queryKey: ["settings"] });
    } catch {
      toast.error("Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return <Skeleton className="h-96 w-full rounded-xl" />;
  }

  return (
    <Tabs defaultValue="general">
      <TabsList className="flex w-full max-w-md flex-wrap">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <TabsTrigger key={t.id} value={t.id} className="gap-2">
              <Icon className="size-4" />
              {t.label}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {TABS.map((tab) => (
        <TabsContent key={tab.id} value={tab.id} className="mt-4">
          <Card className="p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {FIELD_DEFS[tab.id].map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <Label htmlFor={f.key}>{f.label}</Label>
                  {f.type === "switch" ? (
                    <div className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                      <Switch
                        id={f.key}
                        checked={(draft[f.key] ?? "false") === "true"}
                        onCheckedChange={(v) => setValue(f.key, v ? "true" : "false")}
                      />
                      <span className="text-sm text-muted-foreground">
                        {(draft[f.key] ?? "false") === "true" ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                  ) : (
                    <Input
                      id={f.key}
                      value={draft[f.key] ?? ""}
                      onChange={(e) => setValue(f.key, e.target.value)}
                    />
                  )}
                  <p className="font-mono text-[10px] text-muted-foreground">{f.key}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={() => onSave(tab.id)} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save {tab.label} settings
              </Button>
            </div>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}
