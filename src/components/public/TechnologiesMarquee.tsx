"use client";

const TECHS = [
  "Next.js 16", "TypeScript", "Tailwind 4", "Prisma", "PostgreSQL", "Redis",
  "OpenAI GPT-4o", "Anthropic Claude", "LangChain", "WhatsApp Business API",
  "n8n", "Socket.IO", "Vercel", "AWS", "Stripe", "Figma",
];

export function TechnologiesMarquee() {
  return (
    <section className="overflow-hidden border-b border-border/40 bg-background">
      <div className="mx-auto max-w-[1400px] px-4 py-12 md:px-6">
        <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Modern, battle-tested stack
        </p>
      </div>
      <div className="relative flex overflow-hidden">
        <div className="flex shrink-0 animate-marquee gap-3 pr-3">
          {[...TECHS, ...TECHS].map((t, i) => (
            <span
              key={`${t}-${i}`}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-border/60 bg-card px-4 py-2 text-sm font-medium text-muted-foreground"
            >
              <span className="size-1.5 rounded-full bg-primary/60" />
              {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
