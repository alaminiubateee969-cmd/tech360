'use client'

import { BarChart3, Layers, Palette, Ruler, Type as TypeIcon } from 'lucide-react'

import { LeadFunnel, PortalSignInSequence, ProjectSwimlane } from './diagram-kit'
import {
  AIAssistantLink,
  ButtonGroup,
  CardLinkAffordance,
  GhostLink,
  LinkArrow,
  OutlineLink,
  PrimaryLink,
  SecondaryLink,
  WhatsAppLink,
} from './buttons'
import {
  CloudArchitectureDiagram,
  DevLifecycleDiagram,
  QualityChecklistDiagram,
  SecurityArchitectureDiagram,
} from './diagrams'
import { AdminDashboardConcept, CrmConsoleConcept, WebsiteConceptMockup } from './concepts'

// Public Design Kit — the production design system, shown with the real
// components the website uses (not screenshots). Every button, diagram and
// mockup below is the same code that ships on the site pages.

const TOKENS = [
  { name: 'Brand blue', value: '#063B8F', use: 'Primary actions, headings, footer' },
  { name: 'Accent cyan', value: '#009FE3', use: 'Focus rings, links, highlights' },
  { name: 'Success green', value: '#18B83A', use: 'Confirmations, delivered states' },
  { name: 'Warning amber', value: '#F59E0B', use: 'Pending / needs attention' },
  { name: 'Danger red', value: '#EF4444', use: 'Failures, refusals, destructive' },
  { name: 'Ink', value: '#0B1F33', use: 'Body copy on light surfaces' },
  { name: 'Surface', value: '#F7FAFC', use: 'Page background' },
  { name: 'Console ink', value: '#0B1220', use: 'Admin console background' },
]

const SPACING = [
  { step: '4px', use: 'Icon gaps' },
  { step: '8px', use: 'Inline spacing' },
  { step: '12px', use: 'Button padding' },
  { step: '16px', use: 'Card padding (mobile)' },
  { step: '24px', use: 'Card padding (desktop)' },
  { step: '32–48px', use: 'Section rhythm' },
]

function Section({ id, title, description, children, numbered }: { id: string; title: string; description: string; children: React.ReactNode; numbered: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="border-t border-slate-200 py-12 first:border-t-0">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#009FE3]">{numbered}</p>
      <h2 id={`${id}-heading`} className="mt-2 text-2xl font-bold tracking-tight text-[#0B1F33] sm:text-3xl">{title}</h2>
      <p className="mt-3 max-w-3xl leading-7 text-slate-600">{description}</p>
      <div className="mt-8 space-y-8">{children}</div>
    </section>
  )
}

function Showcase({ label, children, note }: { label: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      {note ? <p className="mt-1 text-xs text-slate-500">{note}</p> : null}
      <div className="mt-4 flex flex-wrap items-center gap-3">{children}</div>
    </div>
  )
}

export default function DesignKitView() {
  return (
    <main id="main-content" className="bg-[#F7FAFC] px-5 pb-20 pt-28 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="max-w-3xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#009FE3]">Design system</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#0B1F33] sm:text-4xl">
            The Tech360 design kit
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Every diagram, button, infographic and interface mockup the website and the client platforms use — rendered
            live from the production components, so what you review here is exactly what ships. The set covers accessible
            sequence, funnel and swimlane diagrams, eight infographic layouts, and the three product surfaces
            (website, CRM console, admin dashboard).
          </p>
        </header>

        <Section
          id="buttons"
          numbered="01 · Actions"
          title="Buttons and link affordances"
          description="One primary action per screen, outlined and secondary actions beside it, and a visible focus ring on every control. All buttons meet a 44px minimum touch target."
        >
          <Showcase label="Primary · one per screen" note="Used for the single most important action.">
            <PrimaryLink href="#/contact">Start a project</PrimaryLink>
            <PrimaryLink href="#/work" onClick={(e) => e.preventDefault()}>See our work</PrimaryLink>
          </Showcase>
          <Showcase label="Secondary · supporting actions">
            <SecondaryLink href="#/services">Explore services</SecondaryLink>
            <OutlineLink href="#/process">How we work</OutlineLink>
            <GhostLink href="#/faq">Read the FAQ</GhostLink>
          </Showcase>
          <Showcase label="Grouped actions" note="Stacked on mobile, inline from the small breakpoint.">
            <ButtonGroup>
              <PrimaryLink href="#/contact">Book a consultation</PrimaryLink>
              <OutlineLink href="#/legal/privacy">Privacy policy</OutlineLink>
              <AIAssistantLink compact />
            </ButtonGroup>
          </Showcase>
          <Showcase label="Embedded and progressive affordances" note="Card-level links and inline “learn more” arrows.">
            <CardLinkAffordance>
              <span className="text-sm font-semibold text-[#0B1F33]">Industry pages</span>
              <span className="block text-xs text-slate-500">20 verticals with their own intake flow</span>
            </CardLinkAffordance>
            <LinkArrow href="#/process">Read the delivery process</LinkArrow>
          </Showcase>
          <Showcase
            label="Honest-by-default components"
            note="The WhatsApp action renders nothing at all unless a number is supplied — the owner removed the public WhatsApp route, so no dead button is shown."
          >
            <WhatsAppLink number="" />
            <span className="text-xs text-slate-500">Rendered output: nothing (component returns null while unconfigured).</span>
          </Showcase>
        </Section>

        <Section
          id="diagrams"
          numbered="02 · Diagrams"
          title="Accessible diagram set"
          description="Diagrams are drawn as real SVG with a text alternative, a title band, numbered steps and a legend — readable by screen readers and legible in print. Each one carries a border, a surface and a caption, never colour alone."
        >
          <Showcase label="Sequence · portal sign-in">
            <div className="w-full"><PortalSignInSequence /></div>
          </Showcase>
          <Showcase label="Funnel · pipeline to handover">
            <div className="w-full"><LeadFunnel /></div>
          </Showcase>
          <Showcase label="Swimlane · who does what, in order">
            <div className="w-full"><ProjectSwimlane /></div>
          </Showcase>
          <Showcase label="Infographic · delivery lifecycle">
            <div className="w-full"><DevLifecycleDiagram /></div>
          </Showcase>
          <Showcase label="Infographic · quality checklist">
            <div className="w-full"><QualityChecklistDiagram /></div>
          </Showcase>
          <Showcase label="Infographic · cloud architecture">
            <div className="w-full"><CloudArchitectureDiagram /></div>
          </Showcase>
          <Showcase label="Infographic · security architecture">
            <div className="w-full"><SecurityArchitectureDiagram /></div>
          </Showcase>
        </Section>

        <Section
          id="mockups"
          numbered="03 · Product surfaces"
          title="Interface concept mockups"
          description="Concept mockups of the three surfaces the platform delivers: the public website, the client CRM workspace and the admin dashboard. All three are drawn with the same tokens as the live product."
        >
          <Showcase label="Website concept"><div className="w-full"><WebsiteConceptMockup /></div></Showcase>
          <Showcase label="CRM workspace concept"><div className="w-full"><CrmConsoleConcept /></div></Showcase>
          <Showcase label="Admin dashboard concept"><div className="w-full"><AdminDashboardConcept /></div></Showcase>
        </Section>

        <Section
          id="tokens"
          numbered="04 · Foundations"
          title="Colour, type and spacing tokens"
          description="Tokens are shared between the marketing site and the client platforms so a generated application inherits the same visual language the day it is handed over."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TOKENS.map((t) => (
              <div key={t.name} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="h-14 w-full rounded-lg border border-slate-200" style={{ backgroundColor: t.value }} aria-hidden="true" />
                <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-[#0B1F33]"><Palette className="size-3.5 text-slate-400" />{t.name}</p>
                <p className="text-xs text-slate-500">{t.value}</p>
                <p className="mt-1 text-xs text-slate-500">{t.use}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#0B1F33]"><TypeIcon className="size-4 text-slate-400" />Type scale</p>
              <div className="mt-4 space-y-3">
                <p className="text-3xl font-bold tracking-tight text-[#0B1F33]">Display · 30–36px</p>
                <p className="text-xl font-semibold text-[#0B1F33]">Section heading · 20–24px</p>
                <p className="text-base text-slate-700">Body · 16px with 1.75 line height for long-form reading.</p>
                <p className="text-sm text-slate-500">Meta · 14px, used for captions, dates and helper text.</p>
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#009FE3]">Eyebrow · 11px, tracked</p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-semibold text-[#0B1F33]"><Ruler className="size-4 text-slate-400" />Spacing & radius</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {SPACING.map((s) => (
                  <li key={s.step} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0">
                    <span className="font-mono text-xs text-[#0B1F33]">{s.step}</span>
                    <span className="text-xs text-slate-500">{s.use}</span>
                  </li>
                ))}
                <li className="flex items-center justify-between gap-3 pt-1">
                  <span className="font-mono text-xs text-[#0B1F33]">radius 8 / 16px</span>
                  <span className="text-xs text-slate-500">Controls / cards</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#0B1F33]"><Layers className="size-4 text-slate-400" />Accessibility rules the kit enforces</p>
            <ul className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              <li>• Every diagram has an <code className="text-xs">aria-label</code> or text alternative.</li>
              <li>• Focus is always visible via a 2px <span className="text-[#009FE3]">#009FE3</span> ring.</li>
              <li>• Minimum 44px touch targets on all controls.</li>
              <li>• Colour is never the only signal — icons and labels carry the meaning.</li>
              <li>• Motion respects <code className="text-xs">prefers-reduced-motion</code>.</li>
              <li>• Text contrast targets WCAG AA on every surface.</li>
            </ul>
            <p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><BarChart3 className="size-3.5" />The same kit powers generated client applications, so a delivered app looks like a Tech360 product on day one.</p>
          </div>
        </Section>
      </div>
    </main>
  )
}
