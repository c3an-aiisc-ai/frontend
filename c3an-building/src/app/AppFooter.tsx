import { hrefForRoute } from "../config";

const footerLinks = [
  { label: "Home", href: hrefForRoute("home") },
  { label: "Workflow", href: hrefForRoute("editor") },
  { label: "Planning", href: hrefForRoute("planning") },
  { label: "Evaluations", href: hrefForRoute("evaluation") },
  { label: "AgentGen", href: hrefForRoute("agentgen") },
];

export default function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-200 bg-white/90 px-6 py-3 text-xs text-slate-600 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="min-w-0">C3AN Building © {year}</p>
        <nav className="flex min-w-0 flex-wrap items-center gap-4">
          {footerLinks.map((link) => (
            <a key={link.label} href={link.href} className="hover:text-slate-900">
              {link.label}
            </a>
          ))}
          <a
            href="https://c3an.aiisc.ai/"
            target="_blank"
            rel="noreferrer"
            className="hover:text-slate-900"
          >
            C3AN
          </a>
        </nav>
      </div>
    </footer>
  );
}
