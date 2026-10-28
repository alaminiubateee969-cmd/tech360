"use client";

import { useState, useSyncExternalStore } from "react";
import { Bot, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NAV_LINKS, COMPANY } from "@/data/site";
import { hashSection } from "./nav";

/* External-store subscriptions (hash + scroll) — no effects, no setState races. */

function subscribeHash(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}

function getHashSnapshot(): string {
  return window.location.hash || "#/";
}

function subscribeScroll(callback: () => void) {
  window.addEventListener("scroll", callback, { passive: true });
  return () => window.removeEventListener("scroll", callback);
}

function getScrolledSnapshot(): boolean {
  return window.scrollY > 24;
}

/**
 * Public site header. Transparent over the dark hero, solid after scroll.
 * `currentHash` may be provided by the router; when absent the component
 * tracks hashchange itself via useSyncExternalStore.
 */
export default function SiteHeader({ currentHash }: { currentHash?: string }) {
  const internalHash = useSyncExternalStore(
    subscribeHash,
    getHashSnapshot,
    () => "#/"
  );
  const scrolled = useSyncExternalStore(
    subscribeScroll,
    getScrolledSnapshot,
    () => false
  );
  const [menuOpen, setMenuOpen] = useState(false);

  const hash = currentHash ?? internalHash;
  const activeSection = hashSection(hash);

  const solid = scrolled;
  const closeMenu = () => setMenuOpen(false);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        solid
          ? "border-b border-[#E2E8F0] bg-white/95 shadow-[0_2px_16px_rgba(11,31,51,0.06)] backdrop-blur"
          : "bg-transparent"
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:h-[4.5rem] sm:px-6 lg:px-8">
        {/* Logo — sits on a light plate while the header is transparent */}
        <a
          href="#/"
          aria-label="Tech360 home"
          className={cn(
            "flex shrink-0 items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3]",
            solid ? "p-1" : "bg-white/95 px-2.5 py-2 shadow-sm"
          )}
        >
          <img
            src="/brand/tech360-logo-original.jpg"
            alt="Tech360 logo"
            className="h-9 w-auto rounded-md object-contain sm:h-10"
            width={40}
            height={40}
          />
        </a>

        {/* Desktop navigation */}
        <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
          {NAV_LINKS.map((link) => {
            const linkSection = hashSection(link.href);
            const isActive =
              activeSection === linkSection ||
              (linkSection === "" && activeSection === "");
            return (
              <a
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative inline-flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#009FE3]",
                  solid
                    ? isActive
                      ? "text-[#009FE3]"
                      : "text-[#0B1F33]/80 hover:text-[#009FE3]"
                    : isActive
                      ? "text-white"
                      : "text-white/80 hover:text-white"
                )}
              >
                {link.label}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-x-3 bottom-1.5 h-0.5 rounded-full transition-opacity",
                    isActive ? "bg-[#009FE3] opacity-100" : "opacity-0",
                    !solid && isActive ? "bg-white/90" : ""
                  )}
                />
              </a>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("tech360:open-chat"))}
            aria-label="Chat with the Tech360 AI assistant"
            className={cn(
              "hidden min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#009FE3] xl:inline-flex",
              solid ? "text-[#063B8F] hover:text-[#009FE3]" : "text-white/85 hover:text-white"
            )}
          >
            <Bot className="size-4" aria-hidden="true" />
            AI Assistant
          </button>
          <Button
            asChild
            className="hidden min-h-11 rounded-lg bg-[#009FE3] px-5 text-sm font-semibold text-white shadow-[0_1px_2px_rgba(6,59,143,0.25)] hover:bg-[#0090CC] sm:inline-flex"
          >
            <a href="#/contact" className="focus-visible:outline-none">
              Start Your Project
            </a>
          </Button>

          {/* Mobile menu trigger */}
          <Button
            variant="outline"
            size="icon"
            aria-label="Open navigation menu"
            onClick={() => setMenuOpen(true)}
            className={cn(
              "size-11 rounded-lg lg:hidden",
              solid
                ? "border-[#E2E8F0] bg-white text-[#0B1F33]"
                : "border-white/25 bg-white/10 text-white backdrop-blur hover:bg-white/20"
            )}
          >
            <Menu className="size-5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Mobile navigation */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="right" className="w-80 max-w-[85vw] overflow-y-auto p-0">
          <SheetHeader className="border-b border-[#E2E8F0] p-4">
            <SheetTitle asChild>
              <a href="#/" className="inline-flex items-center" aria-label="Tech360 home">
                <img
                  src="/brand/tech360-logo-original.jpg"
                  alt="Tech360 logo"
                  className="h-9 w-auto rounded-md object-contain"
                />
              </a>
            </SheetTitle>
            <SheetDescription className="text-xs text-[#526173]">
              {COMPANY.legalName} · {COMPANY.tagline}
            </SheetDescription>
          </SheetHeader>
          <nav aria-label="Mobile" className="flex flex-col gap-1 p-3">
            {NAV_LINKS.map((link) => {
              const linkSection = hashSection(link.href);
              const isActive = activeSection === linkSection;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={closeMenu}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center rounded-lg px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#009FE3]",
                    isActive
                      ? "bg-[#F4FAFF] text-[#009FE3]"
                      : "text-[#0B1F33] hover:bg-[#F4FAFF] hover:text-[#009FE3]"
                  )}
                >
                  {link.label}
                </a>
              );
            })}
          </nav>
          <div className="mt-auto flex flex-col gap-2 border-t border-[#E2E8F0] p-4">
            <Button
              asChild
              className="min-h-11 rounded-lg bg-[#009FE3] text-sm font-semibold text-white hover:bg-[#0090CC]"
            >
              <a href="#/contact" className="focus-visible:outline-none">
                Start Your Project
              </a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="min-h-11 rounded-lg border-[#18B83A]/40 text-sm font-semibold text-[#158029] hover:bg-[#18B83A]/10 hover:text-[#128025]"
            >
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("tech360:open-chat"))}
                className="focus-visible:outline-none"
              >
                Chat with our AI assistant
              </button>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
