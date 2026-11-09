"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Layers,
  Menu,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import { BrandMark } from "./BrandMark";
import { PrimaryLink } from "./buttons";
import {
  HEADER_UTILITY_LINKS,
  PRIMARY_NAV_GROUPS,
  type PrimaryNavGroup,
  type PrimaryNavKey,
} from "./nav-structure";

function getActiveGroupKey(currentPath: string): PrimaryNavKey | null {
  const first = currentPath.split("/")[0] || "";
  if (first === "services" || first === "platform") return "solutions";
  if (first === "industries") return "industries";
  if (first === "work") return "work";
  if (first === "blog" || first === "faq" || first === "technologies" || first === "process") {
    return "resources";
  }
  if (first === "about" || first === "careers" || first === "contact" || first === "legal") {
    return "company";
  }
  return null;
}

export function SiteHeader({
  currentPath,
  currentHash,
}: {
  currentPath?: string;
  currentHash?: string;
}) {
  const resolvedPath = (currentPath ?? currentHash ?? "").replace(/^#?\/?/, "");
  const [openDesktopGroup, setOpenDesktopGroup] = useState<PrimaryNavKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<PrimaryNavKey | null>("solutions");
  const [industryQuery, setIndustryQuery] = useState("");
  const headerRef = useRef<HTMLElement | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const closeTimerRef = useRef<number | null>(null);

  const activeGroup = useMemo(() => getActiveGroupKey(resolvedPath), [resolvedPath]);

  const cancelScheduledClose = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    cancelScheduledClose();
    closeTimerRef.current = window.setTimeout(() => {
      setOpenDesktopGroup(null);
    }, 140);
  };

  useEffect(() => {
    return () => cancelScheduledClose();
  }, []);

  // Close menus on Escape or outside click
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (openDesktopGroup) {
          const prev = openDesktopGroup;
          setOpenDesktopGroup(null);
          triggerRefs.current[prev]?.focus();
        }
        if (mobileOpen) {
          setMobileOpen(false);
        }
      }
    };
    const onPointerDown = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpenDesktopGroup(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [openDesktopGroup, mobileOpen]);

  // Lock body scroll while mobile drawer is open
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const focusFirstMenuLink = (key: PrimaryNavKey) => {
    window.requestAnimationFrame(() => {
      const panel = panelRefs.current[key];
      const firstFocusable = panel?.querySelector<HTMLElement>("input, a, button");
      firstFocusable?.focus();
    });
  };

  const closeAllMenus = () => {
    cancelScheduledClose();
    setOpenDesktopGroup(null);
    setMobileOpen(false);
  };

  const filteredIndustryColumns = useMemo(() => {
    const group = PRIMARY_NAV_GROUPS.find((g) => g.key === "industries")!;
    const q = industryQuery.trim().toLowerCase();
    if (!q) return group.columns;
    return group.columns
      .map((col) => ({
        ...col,
        items: col.items.filter(
          (item) =>
            item.label.toLowerCase().includes(q) ||
            (item.description ?? "").toLowerCase().includes(q) ||
            col.heading.toLowerCase().includes(q),
        ),
      }))
      .filter((col) => col.items.length > 0);
  }, [industryQuery]);

  const activeDesktopGroupObj: PrimaryNavGroup | undefined = openDesktopGroup
    ? PRIMARY_NAV_GROUPS.find((g) => g.key === openDesktopGroup)
    : undefined;

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur-md"
      onBlur={(e) => {
        if (!headerRef.current?.contains(e.relatedTarget as Node | null)) {
          setOpenDesktopGroup(null);
        }
      }}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <a
          href="/"
          onClick={closeAllMenus}
          aria-label="TECH360 Home"
          className="flex shrink-0 items-center gap-2.5 rounded-lg py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#063B8F]"
        >
          <BrandMark className="h-9 w-9 shrink-0" />
          <div className="flex flex-col leading-none">
            <span className="text-lg font-extrabold tracking-tight text-[#0B1F33]">
              TECH<span className="text-[#009FE3]">360</span>
            </span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 xl:block">
              Enterprise Software
            </span>
          </div>
        </a>

        {/* Primary Desktop Navigation — Strictly 5 Top-Level Groups */}
        <nav aria-label="Primary navigation" className="hidden items-center gap-1 lg:flex">
          {PRIMARY_NAV_GROUPS.map((group) => {
            const isOpen = openDesktopGroup === group.key;
            const isActive = activeGroup === group.key;
            const panelId = `desktop-nav-panel-${group.key}`;
            return (
              <div
                key={group.key}
                className="relative"
                onMouseEnter={() => {
                  cancelScheduledClose();
                  setOpenDesktopGroup(group.key);
                }}
                onMouseLeave={scheduleClose}
              >
                <button
                  ref={(el) => {
                    triggerRefs.current[group.key] = el;
                  }}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  aria-haspopup="true"
                  onClick={() => {
                    cancelScheduledClose();
                    setOpenDesktopGroup((prev) => (prev === group.key ? null : group.key));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setOpenDesktopGroup(group.key);
                      focusFirstMenuLink(group.key);
                    }
                  }}
                  className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#063B8F] ${
                    isOpen || isActive
                      ? "bg-[#063B8F]/8 text-[#063B8F]"
                      : "text-slate-700 hover:bg-slate-100/80 hover:text-[#0B1F33]"
                  }`}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-150 ${
                      isOpen ? "rotate-180 text-[#009FE3]" : "text-slate-400"
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {/* Compact Dropdown for Work / Resources / Company */}
                {group.kind === "dropdown" && isOpen && (
                  <div
                    id={panelId}
                    ref={(el) => {
                      panelRefs.current[group.key] = el;
                    }}
                    role="region"
                    aria-label={`${group.label} navigation menu`}
                    onMouseEnter={cancelScheduledClose}
                    onMouseLeave={scheduleClose}
                    className="absolute left-0 top-full z-50 mt-2 hidden w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl lg:block border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/10"
                  >
                    <p className="px-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#063B8F]">
                      {group.columns[0]?.heading}
                    </p>
                    <div className="mt-2 space-y-1">
                      {group.columns[0]?.items.map((item) => (
                        <a
                          key={item.href}
                          href={item.href}
                          onClick={closeAllMenus}
                          className="group flex items-start justify-between gap-3 rounded-xl p-2.5 transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#063B8F]"
                        >
                          <div>
                            <div className="text-sm font-semibold text-[#0B1F33] group-hover:text-[#063B8F]">
                              {item.label}
                            </div>
                            {item.description && (
                              <p className="mt-0.5 text-xs leading-5 text-slate-500">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <ArrowRight
                            className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-[#009FE3]"
                            aria-hidden="true"
                          />
                        </a>
                      ))}
                    </div>
                    {group.footerLink && (
                      <div className="mt-3 border-t border-slate-100 pt-2.5">
                        <a
                          href={group.footerLink.href}
                          onClick={closeAllMenus}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-[#063B8F] hover:text-[#009FE3]"
                        >
                          {group.footerLink.label}
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Right-side Desktop Actions: Secondary Utility (Client Portal) + Primary CTA (Start a Project) */}
        <div className="hidden items-center gap-3 lg:flex">
          <a
            href={HEADER_UTILITY_LINKS.clientPortal.href}
            onClick={closeAllMenus}
            className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#063B8F] ${
              resolvedPath === "portal"
                ? "bg-slate-100 text-[#063B8F]"
                : "text-slate-600 hover:bg-slate-100 hover:text-[#0B1F33]"
            }`}
          >
            <UserCheck className="h-4 w-4 text-[#063B8F]" aria-hidden="true" />
            {HEADER_UTILITY_LINKS.clientPortal.label}
          </a>
          <PrimaryLink href={HEADER_UTILITY_LINKS.primaryCta.href} size="sm" onClick={closeAllMenus}>
            {HEADER_UTILITY_LINKS.primaryCta.label}
          </PrimaryLink>
        </div>

        {/* Mobile / Tablet Actions */}
        <div className="flex items-center gap-2 lg:hidden">
          <a
            href={HEADER_UTILITY_LINKS.primaryCta.href}
            onClick={closeAllMenus}
            className="hidden min-h-[38px] items-center rounded-lg bg-[#063B8F] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#052f73] sm:inline-flex"
          >
            {HEADER_UTILITY_LINKS.primaryCta.label}
          </a>
          <button
            type="button"
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-site-drawer"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#063B8F]"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Full-Width Enterprise Mega-Menu Panel for Solutions & Industries */}
      {activeDesktopGroupObj &&
        (activeDesktopGroupObj.kind === "mega-solutions" ||
          activeDesktopGroupObj.kind === "mega-industries") && (
          <div
            id={`desktop-nav-panel-${activeDesktopGroupObj.key}`}
            ref={(el) => {
              panelRefs.current[activeDesktopGroupObj.key] = el;
            }}
            role="region"
            aria-label={`${activeDesktopGroupObj.label} mega menu`}
            onMouseEnter={cancelScheduledClose}
            onMouseLeave={scheduleClose}
            className="hidden border-t border-slate-200/90 bg-white shadow-2xl shadow-slate-900/10 lg:block"
          >
            <div className="mx-auto max-w-7xl px-6 py-6 lg:px-8">
              {activeDesktopGroupObj.kind === "mega-solutions" ? (
                <>
                  <div className="grid gap-6 lg:grid-cols-4">
                    {activeDesktopGroupObj.columns.map((col) => (
                      <div key={col.id} className="flex flex-col">
                        <div className="border-b border-slate-100 pb-2.5">
                          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#063B8F]">
                            {col.heading}
                          </p>
                          {col.description && (
                            <p className="mt-1 text-xs leading-4 text-slate-500">
                              {col.description}
                            </p>
                          )}
                        </div>
                        <ul className="mt-2.5 space-y-1">
                          {col.items.map((item) => (
                            <li key={item.href}>
                              <a
                                href={item.href}
                                onClick={closeAllMenus}
                                className="group block rounded-lg px-2.5 py-2 transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#063B8F]"
                              >
                                <div className="text-sm font-semibold text-[#0B1F33] group-hover:text-[#063B8F]">
                                  {item.label}
                                </div>
                                {item.description && (
                                  <p className="mt-0.5 text-xs leading-4 text-slate-500">
                                    {item.description}
                                  </p>
                                )}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  {/* Mega-Menu Bottom Utility Bar */}
                  <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-slate-50/90 px-4 py-3">
                    <div className="flex flex-wrap items-center gap-5">
                      {activeDesktopGroupObj.footerLink && (
                        <a
                          href={activeDesktopGroupObj.footerLink.href}
                          onClick={closeAllMenus}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#063B8F] hover:text-[#009FE3]"
                        >
                          {activeDesktopGroupObj.footerLink.label}
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </a>
                      )}
                      {activeDesktopGroupObj.secondaryFooterLink && (
                        <a
                          href={activeDesktopGroupObj.secondaryFooterLink.href}
                          onClick={closeAllMenus}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0B1F33] hover:text-[#063B8F]"
                        >
                          <Layers className="h-4 w-4 text-[#009FE3]" aria-hidden="true" />
                          {activeDesktopGroupObj.secondaryFooterLink.label}
                        </a>
                      )}
                    </div>
                    <a
                      href="/process"
                      onClick={closeAllMenus}
                      className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-[#063B8F]"
                    >
                      <ShieldCheck className="h-4 w-4 text-[#18B83A]" aria-hidden="true" />
                      HTML Preview Before Payment (where included in approved SOW) · Source Code After Verified Full Payment
                    </a>
                  </div>
                </>
              ) : (
                <>
                  {/* Industries Mega-Menu Header + Live Filter */}
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#063B8F]">
                        20 Vertical Operating Blueprints
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Domain-specific modules, workflows, RBAC roles, integrations, and security controls.
                      </p>
                    </div>
                    <div className="relative w-full max-w-xs">
                      <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        type="search"
                        value={industryQuery}
                        onChange={(e) => setIndustryQuery(e.target.value)}
                        placeholder="Filter 20 industries…"
                        aria-label="Filter industries in navigation"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm text-[#0B1F33] placeholder:text-slate-400 focus:border-[#063B8F] focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>

                  {filteredIndustryColumns.length === 0 ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-600">
                      No industries match &ldquo;{industryQuery}&rdquo;.{" "}
                      <button
                        type="button"
                        onClick={() => setIndustryQuery("")}
                        className="font-semibold text-[#063B8F] underline"
                      >
                        Reset filter
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-5 lg:grid-cols-5">
                      {filteredIndustryColumns.map((col) => (
                        <div key={col.id}>
                          <p className="border-b border-slate-100 pb-2 text-xs font-bold uppercase tracking-[0.14em] text-[#063B8F]">
                            {col.heading}
                          </p>
                          <ul className="mt-2 space-y-1">
                            {col.items.map((item) => (
                              <li key={item.href}>
                                <a
                                  href={item.href}
                                  onClick={closeAllMenus}
                                  className="group block rounded-lg px-2 py-1.5 transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#063B8F]"
                                >
                                  <div className="text-sm font-semibold text-[#0B1F33] group-hover:text-[#063B8F]">
                                    {item.label}
                                  </div>
                                  {item.description && (
                                    <p className="text-[11px] leading-4 text-slate-500">
                                      {item.description}
                                    </p>
                                  )}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-slate-50/90 px-4 py-2.5">
                    {activeDesktopGroupObj.footerLink && (
                      <a
                        href={activeDesktopGroupObj.footerLink.href}
                        onClick={closeAllMenus}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#063B8F] hover:text-[#009FE3]"
                      >
                        {activeDesktopGroupObj.footerLink.label}
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </a>
                    )}
                    <a
                      href="/contact"
                      onClick={closeAllMenus}
                      className="text-xs font-semibold text-slate-700 hover:text-[#063B8F]"
                    >
                      Need a custom multi-industry workflow? Start a project scope →
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

      {/* Mobile & Tablet Navigation Drawer */}
      {mobileOpen && (
        <div
          id="mobile-site-drawer"
          aria-label="Mobile navigation"
          className="max-h-[calc(100dvh-65px)] overflow-y-auto border-t border-slate-200 bg-white px-4 py-4 shadow-xl lg:hidden"
        >
          <div className="mx-auto max-w-xl space-y-2">
            {PRIMARY_NAV_GROUPS.map((group) => {
              const expanded = mobileExpanded === group.key;
              return (
                <div
                  key={group.key}
                  className="overflow-hidden rounded-xl border border-slate-200/90 bg-slate-50/50"
                >
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() =>
                      setMobileExpanded((prev) => (prev === group.key ? null : group.key))
                    }
                    className="flex min-h-[46px] w-full items-center justify-between px-4 py-2.5 text-left text-sm font-bold text-[#0B1F33]"
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-slate-500 transition-transform ${
                        expanded ? "rotate-180 text-[#063B8F]" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {expanded && (
                    <div className="space-y-4 border-t border-slate-200/80 bg-white px-4 py-3.5">
                      {group.columns.map((col) => (
                        <div key={col.id}>
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#063B8F]">
                            {col.heading}
                          </p>
                          <ul className="mt-1.5 space-y-1">
                            {col.items.map((item) => (
                              <li key={item.href}>
                                <a
                                  href={item.href}
                                  onClick={closeAllMenus}
                                  className="block rounded-lg px-2 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-[#063B8F]"
                                >
                                  {item.label}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                      {group.footerLink && (
                        <a
                          href={group.footerLink.href}
                          onClick={closeAllMenus}
                          className="inline-flex items-center gap-1.5 pt-1 text-xs font-semibold text-[#063B8F]"
                        >
                          {group.footerLink.label}
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="mt-4 grid gap-2.5 pt-2 sm:grid-cols-2">
              <a
                href={HEADER_UTILITY_LINKS.clientPortal.href}
                onClick={closeAllMenus}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#0B1F33] hover:bg-slate-50"
              >
                <UserCheck className="h-4 w-4 text-[#063B8F]" aria-hidden="true" />
                {HEADER_UTILITY_LINKS.clientPortal.label}
              </a>
              <PrimaryLink
                href={HEADER_UTILITY_LINKS.primaryCta.href}
                size="md"
                onClick={closeAllMenus}
                className="w-full"
              >
                {HEADER_UTILITY_LINKS.primaryCta.label}
              </PrimaryLink>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default SiteHeader;
