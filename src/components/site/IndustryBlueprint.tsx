"use client";

import { useId, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Boxes,
  Building2,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  ClipboardList,
  Cpu,
  Database,
  FileText,
  GitBranch,
  Layers,
  Lock,
  MonitorSmartphone,
  Route,
  ShieldCheck,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";

import type {
  IndustryRegistryEntry,
  ModuleSpec,
  SolutionMaturity,
} from "@/data/industries/types";
import { assessSolution } from "@/data/industries/maturity";
import { WORK_EXAMPLES } from "@/data/work-examples";
import { PROJECT_DETAILS } from "@/data/work-details";
import { MaturityBadge } from "./maturity-badge";

/**
 * Public rendering layer for the industry blueprint.
 *
 * Before this component existed, the registry carried 204 solution
 * specifications, 129 workflows, 65 governed agents and 61 UI screens that no
 * public route ever rendered: the industry page showed only a hero, a problem
 * list and a CTA. Everything below is authored data made reachable, with each
 * solution's honest lifecycle status shown next to it.
 *
 * Accessibility: a real tablist (arrow-key navigation, roving tabindex), all
 * panels labelled, disclosure buttons with `aria-expanded`, and no
 * information conveyed by colour alone (every badge carries its label).
 */

type TabKey =
  | "overview"
  | "solutions"
  | "workflows"
  | "architecture"
  | "governance"
  | "delivery"
  | "faq";

const TABS: { key: TabKey; label: string; icon: typeof Layers }[] = [
  { key: "overview", label: "Overview", icon: Building2 },
  { key: "solutions", label: "Solutions", icon: Boxes },
  { key: "workflows", label: "Workflows", icon: Workflow },
  { key: "architecture", label: "Architecture", icon: GitBranch },
  { key: "governance", label: "Governance", icon: ShieldCheck },
  { key: "delivery", label: "Delivery", icon: Route },
  { key: "faq", label: "FAQ", icon: FileText },
];

function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#009FE3]">{eyebrow}</p>
      <h3 className="mt-2 text-xl font-bold tracking-tight text-[#0B1F33] sm:text-2xl">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-[#526173]">{description}</p>
    </div>
  );
}

function Pill({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "blue" | "green" }) {
  const tones = {
    slate: "border-[#E2E8F0] bg-[#F6F9FC] text-[#526173]",
    blue: "border-[#009FE3]/30 bg-[#009FE3]/8 text-[#06658F]",
    green: "border-[#18B83A]/30 bg-[#18B83A]/8 text-[#0F7A28]",
  } as const;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#526173]">{label}</dt>
      <dd className="mt-1 text-lg font-bold text-[#0B1F33]">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Solutions                                                           */
/* ------------------------------------------------------------------ */

function SolutionCard({ module: spec }: { module: ModuleSpec }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const assessment = assessSolution(spec.id, spec.maturity);

  return (
    <article className="flex h-full flex-col rounded-2xl border border-[#E2E8F0] bg-white p-5 transition-colors hover:border-[#009FE3]/45">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-semibold tracking-wide text-[#009FE3]">{spec.id}</p>
          <h4 className="mt-1 text-base font-semibold leading-snug text-[#0B1F33]">{spec.name}</h4>
        </div>
        <MaturityBadge assessment={assessment} />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-[#526173]">{spec.summary}</p>

      <ul className="mt-4 flex flex-wrap gap-1.5">
        {spec.capabilities.slice(0, 4).map((capability) => (
          <li key={capability}>
            <Pill>{capability}</Pill>
          </li>
        ))}
        {spec.capabilities.length > 4 ? (
          <li>
            <Pill tone="blue">+{spec.capabilities.length - 4} more</Pill>
          </li>
        ) : null}
      </ul>

      <dl className="mt-4 grid grid-cols-2 gap-2 text-[11px] text-[#526173]">
        <div>
          <dt className="font-semibold uppercase tracking-wider text-[#8A9AAB]">SLA</dt>
          <dd className="mt-0.5">{spec.sla}</dd>
        </div>
        <div>
          <dt className="font-semibold uppercase tracking-wider text-[#8A9AAB]">Effort</dt>
          <dd className="mt-0.5">
            {spec.effort.design + spec.effort.build + spec.effort.test} person-days
          </dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="mt-4 inline-flex min-h-11 items-center gap-1.5 self-start rounded-lg text-xs font-semibold text-[#063B8F] outline-none transition-colors hover:text-[#009FE3] focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2"
      >
        {open ? "Hide specification" : "Full specification"}
        <ChevronDown
          className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div id={panelId} className="mt-3 space-y-4 border-t border-[#E2E8F0] pt-4 text-xs text-[#526173]">
          <div>
            <p className="font-semibold uppercase tracking-wider text-[#8A9AAB]">Problem solved</p>
            <p className="mt-1 leading-relaxed">{spec.problem}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wider text-[#8A9AAB]">Roles served</p>
            <p className="mt-1">{spec.roles.join(" · ")}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wider text-[#8A9AAB]">Data entities</p>
            <p className="mt-1">{spec.dataEntities.join(" · ")}</p>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wider text-[#8A9AAB]">KPIs</p>
            <ul className="mt-1 space-y-1">
              {spec.kpis.map((kpi) => (
                <li key={kpi.name}>
                  <span className="font-medium text-[#0B1F33]">{kpi.name}</span> — {kpi.formula}; target{" "}
                  {kpi.target} ({kpi.unit}, {kpi.frequency})
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wider text-[#8A9AAB]">Governed AI assist</p>
            <ul className="mt-1 space-y-1">
              {spec.aiUseCases.map((useCase) => (
                <li key={useCase.useCaseId}>
                  <span className="font-medium text-[#0B1F33]">{useCase.name}</span> ({useCase.autonomy}) —{" "}
                  {useCase.description} Approval: {useCase.approvalStep}.
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-semibold uppercase tracking-wider text-[#8A9AAB]">Acceptance criteria</p>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {spec.acceptanceCriteria.map((criterion) => (
                <li key={criterion}>{criterion}</li>
              ))}
            </ul>
          </div>
          <p className="rounded-lg border border-[#E2E8F0] bg-[#F6F9FC] p-3 leading-relaxed">
            <span className="font-semibold text-[#0B1F33]">Status evidence:</span> {assessment.explanation}
          </p>
        </div>
      ) : null}
    </article>
  );
}

function SolutionsPanel({ entry }: { entry: IndustryRegistryEntry }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | SolutionMaturity>("all");

  const assessed = useMemo(
    () =>
      entry.data.modules.map((module) => ({
        module,
        status: assessSolution(module.id, module.maturity).status,
      })),
    [entry.data.modules],
  );

  const statuses = useMemo(() => {
    const counts = new Map<SolutionMaturity, number>();
    for (const item of assessed) counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
    return [...counts.entries()];
  }, [assessed]);

  const visible = assessed.filter(({ module, status: itemStatus }) => {
    if (status !== "all" && itemStatus !== status) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return (
      module.name.toLowerCase().includes(needle) ||
      module.summary.toLowerCase().includes(needle) ||
      module.capabilities.some((capability) => capability.toLowerCase().includes(needle))
    );
  });

  return (
    <div>
      <SectionIntro
        eyebrow={`${entry.data.modules.length} solution specifications`}
        title="Solutions specified for this sector"
        description="Each entry is a complete specification — capabilities, roles, data entities, workflows, KPIs, governed AI use cases, controls, SLA and acceptance criteria. The status badge states exactly how far each one has actually been built in this repository."
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-sm">
          <span className="sr-only">Search solutions</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search solutions, capabilities…"
            className="min-h-11 w-full rounded-lg border border-[#E2E8F0] bg-white px-4 pr-10 text-sm text-[#0B1F33] outline-none placeholder:text-[#8A9AAB] focus-visible:border-[#009FE3] focus-visible:ring-2 focus-visible:ring-[#009FE3]/40"
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter solutions by status">
          <button
            type="button"
            onClick={() => setStatus("all")}
            aria-pressed={status === "all"}
            className={`min-h-11 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3] ${
              status === "all"
                ? "border-[#063B8F] bg-[#063B8F] text-white"
                : "border-[#E2E8F0] bg-white text-[#526173] hover:border-[#009FE3]"
            }`}
          >
            All ({assessed.length})
          </button>
          {statuses.map(([key, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatus(key)}
              aria-pressed={status === key}
              className={`min-h-11 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3] ${
                status === key
                  ? "border-[#063B8F] bg-[#063B8F] text-white"
                  : "border-[#E2E8F0] bg-white text-[#526173] hover:border-[#009FE3]"
              }`}
            >
              {key} ({count})
            </button>
          ))}
        </div>
      </div>

      <p aria-live="polite" className="mt-3 text-xs text-[#8A9AAB]">
        Showing {visible.length} of {assessed.length} specifications.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {visible.map(({ module }) => (
          <SolutionCard key={module.id} module={module} />
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#526173]">
          No specification matches that search. Clear the search or choose another status.
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Workflows                                                           */
/* ------------------------------------------------------------------ */

function WorkflowCard({ workflow }: { workflow: IndustryRegistryEntry["data"]["workflows"][number] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-white">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-start justify-between gap-4 rounded-2xl p-5 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2"
      >
        <span>
          <span className="font-mono text-[11px] font-semibold text-[#009FE3]">{workflow.id}</span>
          <span className="mt-1 block text-base font-semibold text-[#0B1F33]">{workflow.name}</span>
          <span className="mt-1 block text-sm leading-relaxed text-[#526173]">{workflow.purpose}</span>
          <span className="mt-3 flex flex-wrap gap-1.5">
            <Pill tone="blue">{workflow.department}</Pill>
            <Pill>{workflow.steps.length} steps</Pill>
            <Pill>SLA: {workflow.sla}</Pill>
          </span>
        </span>
        <ChevronDown
          className={`mt-1 size-5 shrink-0 text-[#526173] transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div id={panelId} className="border-t border-[#E2E8F0] p-5 text-sm text-[#526173]">
          <ol className="space-y-3">
            {workflow.steps.map((step, index) => (
              <li key={step.id} className="rounded-xl border border-[#E2E8F0] bg-[#F8FBFD] p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8A9AAB]">
                  Step {index + 1} · {step.id} · owner {step.ownerRole}
                </p>
                <p className="mt-1 font-semibold text-[#0B1F33]">{step.name}</p>
                <p className="mt-1 leading-relaxed">{step.description}</p>
                <dl className="mt-2 grid gap-1 text-[11px] sm:grid-cols-2">
                  <div>
                    <dt className="inline font-semibold text-[#0B1F33]">Approval: </dt>
                    <dd className="inline">{step.approval}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-[#0B1F33]">SLA: </dt>
                    <dd className="inline">{step.sla}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-[#0B1F33]">Automation: </dt>
                    <dd className="inline">{step.automation}</dd>
                  </div>
                  <div>
                    <dt className="inline font-semibold text-[#0B1F33]">AI assist: </dt>
                    <dd className="inline">{step.aiAssist}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="inline font-semibold text-[#0B1F33]">Exception path: </dt>
                    <dd className="inline">{step.exceptionPath}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ol>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-[#8A9AAB]">KPIs</dt>
              <dd className="mt-1">{workflow.kpis.join(" · ")}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-[#8A9AAB]">Controls</dt>
              <dd className="mt-1">{workflow.controls.join(" · ")}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-[#8A9AAB]">Exceptions</dt>
              <dd className="mt-1">{workflow.exceptions.join(" · ")}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-[#8A9AAB]">Compliance</dt>
              <dd className="mt-1">{workflow.compliance.join(" · ")}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

function OverviewPanel({ entry }: { entry: IndustryRegistryEntry }) {
  const { overview, businessModels, challenges, departments, roles } = entry.data;

  return (
    <div className="space-y-10">
      <div>
        <SectionIntro
          eyebrow="Sector brief"
          title="How this sector actually operates"
          description={overview.summary}
        />
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {overview.facts.map((fact) => (
            <Stat key={fact.label} label={fact.label} value={fact.value} />
          ))}
        </dl>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {overview.differentiators.map((item) => (
            <li key={item} className="flex items-start gap-2 rounded-xl border border-[#18B83A]/25 bg-[#F2FBF4] p-3 text-sm text-[#0B1F33]">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#18B83A]" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-lg font-bold text-[#0B1F33]">Business models supported</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {businessModels.map((model) => (
            <div key={model.id} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <p className="text-sm font-semibold text-[#0B1F33]">{model.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#526173]">{model.description}</p>
              <p className="mt-2 text-xs text-[#526173]">
                <span className="font-semibold text-[#0B1F33]">Revenue:</span> {model.revenueMechanics}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-[#0B1F33]">Challenges and the designed response</h3>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[#E2E8F0]">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">Sector challenges and the platform response</caption>
            <thead className="bg-[#F4F8FC] text-xs uppercase tracking-wider text-[#526173]">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Challenge</th>
                <th scope="col" className="px-4 py-3 font-semibold">Impact</th>
                <th scope="col" className="px-4 py-3 font-semibold">Designed response</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0] bg-white">
              {challenges.map((challenge) => (
                <tr key={challenge.id} className="align-top">
                  <th scope="row" className="px-4 py-3 font-semibold text-[#0B1F33]">
                    {challenge.title}
                  </th>
                  <td className="px-4 py-3 text-[#526173]">{challenge.impact}</td>
                  <td className="px-4 py-3 text-[#526173]">{challenge.platformResponse}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-[#0B1F33]">
            <Building2 className="size-5 text-[#009FE3]" aria-hidden="true" />
            Departments modelled
          </h3>
          <ul className="mt-3 space-y-2">
            {departments.map((department) => (
              <li key={department.id} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
                <p className="text-sm font-semibold text-[#0B1F33]">{department.name}</p>
                <p className="mt-1 text-xs text-[#526173]">{department.charter}</p>
                <p className="mt-1 text-[11px] text-[#8A9AAB]">KPIs: {department.kpis.join(" · ")}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-[#0B1F33]">
            <Users className="size-5 text-[#009FE3]" aria-hidden="true" />
            Roles and permissions
          </h3>
          <ul className="mt-3 space-y-2">
            {roles.map((role) => (
              <li key={role.id} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[#0B1F33]">{role.name}</p>
                  <Pill>{role.seniority}</Pill>
                </div>
                <p className="mt-1 text-xs text-[#526173]">{role.responsibilities.join(" · ")}</p>
                <p className="mt-1 text-[11px] text-[#8A9AAB]">
                  Permissions: {role.permissions.join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Architecture                                                        */
/* ------------------------------------------------------------------ */

function ArchitecturePanel({ entry }: { entry: IndustryRegistryEntry }) {
  const { factory, integrations, dataModel, portals, uiScreens } = entry.data;

  return (
    <div className="space-y-10">
      <div>
        <SectionIntro
          eyebrow="Six-plane blueprint"
          title="Architecture the specification assumes"
          description="Planes are the platform contract every industry system is assembled from. They describe the intended structure — they are not a claim that this particular system is running."
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {factory.planes.map((plane) => (
            <div key={plane.id} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <p className="font-mono text-[11px] font-semibold text-[#009FE3]">{plane.id}</p>
              <p className="mt-1 text-sm font-semibold text-[#0B1F33]">{plane.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#526173]">{plane.purpose}</p>
              <p className="mt-2 text-[11px] text-[#8A9AAB]">{plane.components.join(" · ")}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-[#0B1F33]">
            <GitBranch className="size-5 text-[#009FE3]" aria-hidden="true" />
            Integration surface
          </h3>
          <ul className="mt-3 space-y-2">
            {integrations.map((integration) => (
              <li key={integration.id} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[#0B1F33]">{integration.name}</p>
                  <Pill tone="blue">{integration.direction}</Pill>
                  <Pill>{integration.protocol}</Pill>
                </div>
                <p className="mt-1 text-xs text-[#526173]">{integration.description}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-[#0B1F33]">
            <Database className="size-5 text-[#009FE3]" aria-hidden="true" />
            Core data entities
          </h3>
          <ul className="mt-3 space-y-2">
            {dataModel.map((entity) => (
              <li key={entity.id} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
                <p className="text-sm font-semibold text-[#0B1F33]">{entity.name}</p>
                <p className="mt-1 text-xs text-[#526173]">{entity.description}</p>
                <p className="mt-1 text-[11px] text-[#8A9AAB]">
                  {entity.keyAttributes.join(" · ")} → {entity.relations.join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold text-[#0B1F33]">
          <MonitorSmartphone className="size-5 text-[#009FE3]" aria-hidden="true" />
          Portals and screens
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {portals.map((portal) => (
            <div key={portal.id} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <p className="text-sm font-semibold text-[#0B1F33]">{portal.name}</p>
              <p className="text-[11px] uppercase tracking-wider text-[#8A9AAB]">{portal.audience}</p>
              <p className="mt-1 text-xs text-[#526173]">{portal.description}</p>
              <p className="mt-2 text-[11px] text-[#8A9AAB]">{portal.keyScreens.join(" · ")}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {uiScreens.map((screen) => (
            <figure key={screen.id} className="rounded-xl border border-[#E2E8F0] bg-white p-3">
              <figcaption>
                <p className="text-sm font-semibold text-[#0B1F33]">{screen.title}</p>
                <p className="mt-1 text-xs text-[#526173]">{screen.description}</p>
                <p className="mt-2 text-[11px] text-[#8A9AAB]">Illustrative screen concept — not a live product screenshot.</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Governance                                                          */
/* ------------------------------------------------------------------ */

function GovernancePanel({ entry }: { entry: IndustryRegistryEntry }) {
  const { security, agents, factory } = entry.data;

  return (
    <div className="space-y-10">
      <div>
        <SectionIntro
          eyebrow="Security & controls"
          title="Controls the system is specified to enforce"
          description="Every control below is a requirement of the specification. None is a certification, and none should be read as an audit result."
        />
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {security.map((control) => (
            <li key={control.id} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <div className="flex items-center gap-2">
                <Lock className="size-4 text-[#009FE3]" aria-hidden="true" />
                <p className="text-sm font-semibold text-[#0B1F33]">{control.name}</p>
                <Pill tone="blue">{control.plane}</Pill>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-[#526173]">{control.description}</p>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold text-[#0B1F33]">
          <Sparkles className="size-5 text-[#009FE3]" aria-hidden="true" />
          Governed AI agents
        </h3>
        <p className="mt-1 max-w-3xl text-sm text-[#526173]">
          Agents are specified with a human owner and guardrails. Autonomy levels A0–A3 describe what an agent would be
          permitted to do; they are not evidence that any agent is running for a client.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <div key={agent.id} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#0B1F33]">{agent.name}</p>
                <Pill tone="blue">{agent.autonomy}</Pill>
              </div>
              <p className="mt-1 text-xs text-[#526173]">{agent.description}</p>
              <p className="mt-2 text-[11px] text-[#8A9AAB]">Human owner: {agent.humanOwner}</p>
              <p className="mt-1 text-[11px] text-[#8A9AAB]">{agent.guardrails.join(" · ")}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FBFD] p-5">
        <h3 className="flex items-center gap-2 text-base font-bold text-[#0B1F33]">
          <Cpu className="size-5 text-[#009FE3]" aria-hidden="true" />
          AI governance
        </h3>
        <p className="mt-2 text-sm text-[#526173]">{factory.aiGovernance.summary}</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-4">
          {factory.aiGovernance.autonomyLevels.map((level) => (
            <li key={level.level} className="rounded-lg border border-[#E2E8F0] bg-white p-3">
              <p className="text-xs font-bold text-[#0B1F33]">{level.level} · {level.name}</p>
              <p className="mt-1 text-[11px] text-[#526173]">{level.humanRole}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-[#526173]">
          <span className="font-semibold text-[#0B1F33]">Standing guardrails:</span>{" "}
          {factory.aiGovernance.standingGuardrails.join(" · ")}
        </p>
      </div>

      {factory.itOtBoundary.applies ? (
        <div className="rounded-2xl border border-[#F5B301]/35 bg-[#FFFBEB] p-5">
          <h3 className="text-base font-bold text-[#0B1F33]">IT/OT boundary</h3>
          <p className="mt-2 text-sm text-[#526173]">{factory.itOtBoundary.summary}</p>
          <ul className="mt-3 space-y-1 text-xs text-[#526173]">
            {factory.itOtBoundary.rules.map((rule) => (
              <li key={rule}>• {rule}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Delivery                                                            */
/* ------------------------------------------------------------------ */

function DeliveryPanel({ entry }: { entry: IndustryRegistryEntry }) {
  const { roadmap, deliverables, pricing, factory } = entry.data;

  return (
    <div className="space-y-10">
      <div>
        <SectionIntro
          eyebrow="Delivery plan"
          title="How an engagement for this sector is sequenced"
          description="Phases are the standard delivery sequence. Durations and pricing are illustrative USD scenarios that are replaced by a written scope of work."
        />
        <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roadmap.map((phase, index) => (
            <li key={phase.id} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#009FE3]">
                Phase {index + 1} · {phase.weeks}
              </p>
              <p className="mt-1 text-sm font-semibold text-[#0B1F33]">{phase.name}</p>
              <p className="mt-1 text-xs leading-relaxed text-[#526173]">{phase.activities}</p>
              <p className="mt-2 text-[11px] text-[#8A9AAB]">Gate: {phase.gate}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-[#0B1F33]">
            <ClipboardList className="size-5 text-[#009FE3]" aria-hidden="true" />
            Deliverables
          </h3>
          <ul className="mt-3 grid gap-1.5">
            {[...factory.standardDeliverables, ...deliverables].map((item, index) => (
              <li key={`${item}-${index}`} className="flex items-start gap-2 text-sm text-[#526173]">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#18B83A]" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-[#0B1F33]">
            <CircleDollarSign className="size-5 text-[#009FE3]" aria-hidden="true" />
            Illustrative pricing (USD)
          </h3>
          <div className="mt-3 space-y-3">
            {pricing.map((scenario) => (
              <div key={scenario.id} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <p className="text-sm font-semibold text-[#0B1F33]">{scenario.name}</p>
                <p className="mt-1 text-lg font-bold text-[#063B8F]">
                  {scenario.setup.display} <span className="text-xs font-medium text-[#526173]">setup</span> ·{" "}
                  {scenario.monthly.display}
                </p>
                <p className="mt-1 text-xs text-[#526173]">{scenario.included.join(" · ")}</p>
                <p className="mt-2 text-[11px] text-[#8A9AAB]">{scenario.notes}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

function FaqPanel({ entry }: { entry: IndustryRegistryEntry }) {
  return (
    <div>
      <SectionIntro
        eyebrow="Sector questions"
        title="Questions this sector asks before starting"
        description="Answers are specific to this industry's specification. Anything not covered here is scoped in writing before work begins."
      />
      <dl className="mt-5 divide-y divide-[#E2E8F0] overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white">
        {entry.data.faqs.map((faq) => (
          <div key={faq.q} className="p-5">
            <dt className="text-sm font-semibold text-[#0B1F33]">{faq.q}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-[#526173]">{faq.a}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

/** Project scenarios specified for this sector. Honest labelling: scenarios, not delivered work. */
function RelatedProjects({ slug }: { slug: string }) {
  const matched = PROJECT_DETAILS.filter((detail) => detail.industrySlug === slug)
    .map((detail) => WORK_EXAMPLES.find((example) => example.slug === detail.slug))
    .filter((example): example is (typeof WORK_EXAMPLES)[number] => Boolean(example));

  if (matched.length === 0) {
    return (
      <div className="mt-10 rounded-2xl border border-[#E2E8F0] bg-white p-5">
        <h3 className="text-base font-bold text-[#0B1F33]">Related project scenarios</h3>
        <p className="mt-2 text-sm text-[#526173]">
          No dedicated project scenario is published for this sector yet. The{" "}
          <a href="#/work/projects" className="font-semibold text-[#063B8F] underline decoration-[#009FE3]/40 underline-offset-2 hover:text-[#009FE3]">
            full project gallery
          </a>{" "}
          shows the system types that can be adapted to it.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <h3 className="text-base font-bold text-[#0B1F33]">Related project scenarios</h3>
      <p className="mt-1 text-sm text-[#526173]">
        Specifications for systems in this sector. Concept scenarios — not delivered client work.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {matched.map((example) => (
          <li key={example.slug}>
            <a
              href={`#/work/projects/${example.slug}`}
              className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#E2E8F0] bg-white outline-none transition-colors hover:border-[#009FE3]/50 focus-visible:ring-2 focus-visible:ring-[#009FE3]"
            >
              <img src={example.image} alt={example.imageAlt} className="aspect-video w-full object-cover" loading="lazy" />
              <div className="flex flex-1 flex-col p-4">
                <p className="text-sm font-semibold text-[#0B1F33]">{example.name}</p>
                <p className="mt-1 flex-1 text-xs leading-relaxed text-[#526173]">{example.tagline}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#009FE3]">
                  View specification
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function IndustryBlueprint({ entry }: { entry: IndustryRegistryEntry }) {
  const [tab, setTab] = useState<TabKey>("solutions");
  const baseId = useId();

  const tabId = (key: TabKey) => `${baseId}-tab-${key}`;
  const panelId = (key: TabKey) => `${baseId}-panel-${key}`;

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const index = TABS.findIndex((item) => item.key === tab);
    if (index === -1) return;
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    setTab(TABS[next].key);
    document.getElementById(tabId(TABS[next].key))?.focus();
  }

  return (
    <section aria-labelledby={`${baseId}-heading`} className="bg-[#F4FAFF]">
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#009FE3]">
              Industry blueprint
            </p>
            <h2 id={`${baseId}-heading`} className="mt-2 text-2xl font-bold tracking-tight text-[#0B1F33] sm:text-3xl">
              {entry.name} — complete specification library
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#526173]">
              {entry.data.modules.length} solution specifications, {entry.data.workflows.length} operational workflows and{" "}
              {entry.data.agents.length} governed AI agents for this sector. Each solution carries an evidence-based
              status: everything here is <strong>specified</strong>, not built, unless the badge says otherwise.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href="#request-quote"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#063B8F] px-5 text-sm font-semibold text-white outline-none transition-colors hover:bg-[#052f72] focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2"
            >
              Request a quote
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
            <a
              href="#/contact"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#063B8F]/25 bg-white px-5 text-sm font-semibold text-[#063B8F] outline-none transition-colors hover:border-[#009FE3] focus-visible:ring-2 focus-visible:ring-[#009FE3] focus-visible:ring-offset-2"
            >
              Book a consultation
            </a>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Industry blueprint sections"
          onKeyDown={onKeyDown}
          className="mt-8 flex gap-1 overflow-x-auto border-b border-[#D6E4F0] pb-px"
        >
          {TABS.map((item) => {
            const selected = item.key === tab;
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                id={tabId(item.key)}
                role="tab"
                type="button"
                aria-selected={selected}
                aria-controls={panelId(item.key)}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(item.key)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-t-lg px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#009FE3] ${
                  selected
                    ? "border-b-2 border-[#063B8F] bg-white text-[#063B8F]"
                    : "border-b-2 border-transparent text-[#526173] hover:bg-white/60 hover:text-[#063B8F]"
                }`}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          id={panelId(tab)}
          aria-labelledby={tabId(tab)}
          tabIndex={0}
          className="mt-8 outline-none focus-visible:ring-2 focus-visible:ring-[#009FE3]"
        >
          {tab === "overview" ? <OverviewPanel entry={entry} /> : null}
          {tab === "solutions" ? <SolutionsPanel entry={entry} /> : null}
          {tab === "workflows" ? (
            <div>
              <SectionIntro
                eyebrow={`${entry.data.workflows.length} workflows`}
                title="Operational workflows, end to end"
                description="Every workflow is documented against an 18-field contract: purpose, trigger, roles, inputs, outputs, SLA, steps, KPIs, exceptions, controls, compliance, automation, AI assist and deliverables."
              />
              <div className="mt-5 space-y-3">
                {entry.data.workflows.map((workflow) => (
                  <WorkflowCard key={workflow.id} workflow={workflow} />
                ))}
              </div>
            </div>
          ) : null}
          {tab === "architecture" ? <ArchitecturePanel entry={entry} /> : null}
          {tab === "governance" ? <GovernancePanel entry={entry} /> : null}
          {tab === "delivery" ? <DeliveryPanel entry={entry} /> : null}
          {tab === "faq" ? <FaqPanel entry={entry} /> : null}
        </div>

        <RelatedProjects slug={entry.slug} />

        <p className="mt-8 flex items-start gap-2 rounded-xl border border-[#009FE3]/25 bg-white p-4 text-xs leading-relaxed text-[#526173]">
          <Activity className="mt-0.5 size-4 shrink-0 text-[#009FE3]" aria-hidden="true" />
          <span>
            <strong className="text-[#0B1F33]">How to read these badges:</strong> a status is only raised when matching
            evidence exists in this repository (design artifact, demo route, committed source, automated tests, recorded
            deployment). No industry solution is currently presented as built, tested or deployed.
          </span>
        </p>
      </div>
    </section>
  );
}
