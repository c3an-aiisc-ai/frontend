import { hrefForRoute } from "../../config";

const workflowStages = [
  {
    step: "01",
    label: "Intent",
    panelClass: "border-white/70 bg-white/80 text-slate-700",
    accentClass: "bg-slate-900",
  },
  {
    step: "02",
    label: "Plan",
    panelClass: "border-amber-200/80 bg-amber-50/90 text-amber-950",
    accentClass: "bg-amber-400",
  },
  {
    step: "03",
    label: "Agents",
    panelClass: "border-emerald-200/80 bg-emerald-50/90 text-emerald-950",
    accentClass: "bg-emerald-400",
  },
  {
    step: "04",
    label: "Metrics",
    panelClass: "border-sky-200/80 bg-sky-50/90 text-sky-950",
    accentClass: "bg-sky-400",
  },
  {
    step: "05",
    label: "Solution",
    panelClass: "border-slate-200/80 bg-slate-950 text-white",
    accentClass: "bg-white",
  },
] as const;

const destinations = [
  {
    title: "Workflow Builder",
    href: hrefForRoute("editor"),
    stage: "01",
    badge: "Primary workspace",
    chips: ["Canvas", "Plans", "Agents", "Tools"],
    cardClass:
      "bg-slate-950 text-white shadow-[0_32px_110px_-48px_rgba(15,23,42,0.95)]",
    badgeClass: "border-white/15 bg-white/10 text-slate-100",
    chipClass: "border-white/10 bg-white/10 text-slate-200",
    glowClass: "bg-sky-400/25",
  },
  {
    title: "Planning",
    href: hrefForRoute("planning"),
    stage: "02",
    badge: "Structure",
    chips: ["Templates", "Subplans", "Dependencies"],
    cardClass:
      "border border-amber-200/80 bg-[linear-gradient(160deg,rgba(255,251,235,0.97),rgba(254,243,199,0.92))] text-amber-950 shadow-[0_28px_80px_-52px_rgba(217,119,6,0.6)]",
    badgeClass: "border-amber-300/70 bg-white/70 text-amber-700",
    chipClass: "border-amber-200/70 bg-white/70 text-amber-800",
    glowClass: "bg-amber-300/35",
  },
  {
    title: "Evaluations",
    href: hrefForRoute("evaluation"),
    stage: "03",
    badge: "Scoring",
    chips: ["Mappings", "Metrics", "Outputs"],
    cardClass:
      "border border-sky-200/80 bg-[linear-gradient(160deg,rgba(240,249,255,0.98),rgba(224,242,254,0.94))] text-sky-950 shadow-[0_28px_80px_-52px_rgba(14,165,233,0.52)]",
    badgeClass: "border-sky-300/70 bg-white/70 text-sky-700",
    chipClass: "border-sky-200/70 bg-white/70 text-sky-800",
    glowClass: "bg-sky-300/35",
  },
  {
    title: "AgentGen",
    href: hrefForRoute("agentgen"),
    stage: "04",
    badge: "Custom agents",
    chips: ["Palette", "Registry", "Builder"],
    cardClass:
      "border border-emerald-200/80 bg-[linear-gradient(160deg,rgba(240,253,244,0.98),rgba(209,250,229,0.92))] text-emerald-950 shadow-[0_28px_80px_-52px_rgba(16,185,129,0.5)]",
    badgeClass: "border-emerald-300/70 bg-white/70 text-emerald-700",
    chipClass: "border-emerald-200/70 bg-white/70 text-emerald-800",
    glowClass: "bg-emerald-300/35",
  },
] as const;

export default function HomePage() {
  const primaryDestination = destinations[0];
  const secondaryDestinations = destinations.slice(1);

  return (
    <div className="relative h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(74,222,128,0.14),transparent_24%),linear-gradient(180deg,#f8fbff_0%,#f8fafc_44%,#eef6ff_100%)] text-slate-900">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.95),transparent_70%)]" />

      <div className="page-shell pb-14">
        <section className="grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-center">
          <div className="max-w-2xl">
            <div className="home-angled-chip inline-flex items-center gap-2 border border-slate-200/80 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-600 shadow-sm backdrop-blur-sm">
              C3AN Workspace Navigator
            </div>
            <h1 className="mt-5 max-w-xl text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
              Workflows that turn plans into solutions
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-600 sm:text-base">
              Choose the surface that matches the step you are in, then move through the system
              without losing the overall flow.
            </p>
          </div>

          <div className="home-flow-visual home-angled-panel border border-white/70 p-5 shadow-[0_28px_90px_-52px_rgba(15,23,42,0.45)] sm:p-7">
            <div className="home-flow-grid" />
            <div className="home-flow-beam" />
            <div className="home-flow-track hidden sm:block">
              <div className="home-flow-runner">
                <div className="home-flow-signal" />
              </div>
              <div className="home-flow-runner home-flow-runner-b">
                <div className="home-flow-signal" />
              </div>
              <div className="home-flow-runner home-flow-runner-c">
                <div className="home-flow-signal" />
              </div>
            </div>

            <div className="relative flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  Live system loop
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                  From intake to outcome
                </h2>
              </div>
              <div className="home-angled-chip border border-slate-200/80 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Continuous flow
              </div>
            </div>

            <div className="relative mt-6 grid gap-3 sm:grid-cols-5 sm:items-center">
              {workflowStages.map((stage, index) => {
                const isSolution = index === workflowStages.length - 1;
                return (
                  <div
                    key={stage.label}
                    className={`home-flow-stage home-angled-stage relative overflow-hidden border p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.55)] backdrop-blur-md ${isSolution ? "home-flow-stage-solution" : ""} ${stage.panelClass}`}
                    style={{ animationDelay: `${index * 0.32}s` }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={`h-2.5 w-2.5 rotate-45 ${stage.accentClass}`} />
                      <span className={`text-[10px] font-semibold uppercase tracking-[0.24em] ${isSolution ? "text-slate-300" : "text-slate-400"}`}>
                        {stage.step}
                      </span>
                    </div>
                    <div className="mt-8 text-sm font-semibold tracking-tight">
                      {stage.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Workspaces
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                Choose an entry point
              </h2>
            </div>
            <div className="home-angled-chip border border-slate-200/80 bg-white/75 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500 shadow-sm backdrop-blur-sm">
              Plan / Build / Evaluate
            </div>
          </div>

          <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <a
              href={primaryDestination.href}
              className={`home-angled-card group relative overflow-hidden p-7 transition duration-300 hover:-translate-y-1 hover:shadow-[0_38px_120px_-46px_rgba(15,23,42,0.95)] ${primaryDestination.cardClass}`}
            >
              <div className={`home-angled-glow pointer-events-none absolute -right-12 top-10 h-40 w-40 blur-3xl ${primaryDestination.glowClass}`} />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-white/10" />

              <div className="relative flex h-full flex-col gap-8">
                <div className="flex items-start justify-between gap-4">
                  <span className={`home-angled-chip border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${primaryDestination.badgeClass}`}>
                    {primaryDestination.badge}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                    {primaryDestination.stage}
                  </span>
                </div>

                <div className="max-w-md">
                  <h3 className="text-3xl font-semibold tracking-tight text-white sm:text-[2rem]">
                    {primaryDestination.title}
                  </h3>
                </div>

                <div className="flex flex-wrap gap-2">
                  {primaryDestination.chips.map((chip) => (
                    <span
                      key={chip}
                      className={`home-angled-chip border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${primaryDestination.chipClass}`}
                    >
                      {chip}
                    </span>
                  ))}
                </div>

                <div className="mt-auto flex items-center justify-between gap-3 pt-6 text-sm font-semibold text-slate-200">
                  <span>Open workspace</span>
                  <span className="transition duration-300 group-hover:translate-x-1">Go</span>
                </div>
              </div>
            </a>

            <div className="grid gap-5 sm:grid-cols-2">
              {secondaryDestinations.map((item, index) => {
                const isWide = index === secondaryDestinations.length - 1;
                return (
                  <a
                    key={item.title}
                    href={item.href}
                    className={`home-angled-card group relative overflow-hidden p-6 transition duration-300 hover:-translate-y-1 hover:shadow-[0_30px_90px_-48px_rgba(15,23,42,0.4)] ${isWide ? "sm:col-span-2" : ""} ${item.cardClass}`}
                  >
                    <div className={`home-angled-glow pointer-events-none absolute -right-8 top-8 h-28 w-28 blur-3xl ${item.glowClass}`} />
                    <div className="relative flex h-full flex-col gap-6">
                      <div className="flex items-start justify-between gap-4">
                        <span className={`home-angled-chip border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${item.badgeClass}`}>
                          {item.badge}
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                          {item.stage}
                        </span>
                      </div>

                      <h3 className="text-2xl font-semibold tracking-tight">
                        {item.title}
                      </h3>

                      <div className="flex flex-wrap gap-2">
                        {item.chips.map((chip) => (
                          <span
                            key={chip}
                            className={`home-angled-chip border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${item.chipClass}`}
                          >
                            {chip}
                          </span>
                        ))}
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-3 pt-2 text-sm font-semibold">
                        <span>Open workspace</span>
                        <span className="transition duration-300 group-hover:translate-x-1">Go</span>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
