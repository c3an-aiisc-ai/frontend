import { hrefForRoute } from "../../config";
import { PageBackButton } from "../../components/ui";

const destinations = [
  {
    title: "Workflow Builder",
    description: "Open the canvas workspace for plans, subplans, agents, and tools.",
    href: hrefForRoute("editor"),
    accent: "bg-slate-900 text-white",
  },
  {
    title: "Planning",
    description: "Generate plan templates from task descriptions or planning JSON.",
    href: hrefForRoute("planning"),
    accent: "bg-amber-100 text-amber-800",
  },
  {
    title: "Evaluations",
    description: "Configure input-to-metric-to-output mappings in the split evaluation workspace.",
    href: hrefForRoute("evaluation"),
    accent: "bg-sky-100 text-sky-800",
  },
  {
    title: "AgentGen",
    description: "Build reusable custom agents and queue plans into the workflow canvas.",
    href: hrefForRoute("agentgen"),
    accent: "bg-emerald-100 text-emerald-800",
  },
];

export default function HomePage() {
  return (
    <div className="relative h-full overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-sky-50 text-slate-900">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-32 left-0 h-80 w-80 rounded-full bg-sky-200/45 blur-3xl" />
        <div className="pointer-events-none absolute right-0 bottom-0 h-80 w-80 rounded-full bg-emerald-200/35 blur-3xl" />
      </div>

      <div className="page-shell">
        <PageBackButton fallbackRoute="home" />

        <div className="mt-6 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
            Start page
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
            Choose where to continue
          </h1>
          <p className="mt-3 text-sm text-slate-600">
            This entry page sits one level above the current workspace flow and keeps the same
            top-level actions available without changing the React stack.
          </p>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {destinations.map((item) => (
            <a
              key={item.title}
              href={item.href}
              className="group rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-slate-900">{item.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${item.accent}`}
                >
                  Open
                </span>
              </div>
            </a>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <a href={hrefForRoute("editor")} className="btn-pill btn-pill-light">
            Open workflow builder
          </a>
          <a
            href="https://c3an.aiisc.ai/"
            target="_blank"
            rel="noreferrer"
            className="btn-pill btn-pill-light"
          >
            Visit C3AN
          </a>
        </div>
      </div>
    </div>
  );
}
