"use client";

const LOGOS = [
  "Apex Realty",
  "BrightPath",
  "Dhaka Eats",
  "VidyaCore",
  "Manufactron",
  "Studio Mira",
  "Lumiere Hotels",
  "Skyline Infra",
  "FinSecure",
  "Casa Paz",
  "Legacy Law",
  "Aoyama Retail",
];

export function TrustBar() {
  return (
    <section className="border-y border-border/40 bg-card/30">
      <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-6">
        <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Trusted by 50+ growing companies
        </p>
        <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
          {LOGOS.slice(0, 6).map((name) => (
            <div
              key={name}
              className="text-center text-sm font-semibold text-muted-foreground/80 transition-colors hover:text-foreground"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
