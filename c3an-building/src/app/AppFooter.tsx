import { hrefForRoute } from "../config";
import type { Theme } from "../shared/types";

const footerLinks = [
  { label: "Home", href: hrefForRoute("home") },
];

type Props = {
  theme: Theme;
};

export default function AppFooter({ theme }: Props) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={`px-6 py-3 text-xs backdrop-blur ${
        theme === "dark"
          ? "border-t border-slate-800 bg-slate-950/90 text-slate-300"
          : "border-t border-slate-200 bg-white/90 text-slate-600"
      }`}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <p className="min-w-0">C3AN Building © {year}</p>
        <nav className="flex min-w-0 flex-wrap items-center gap-4">
          {footerLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className={theme === "dark" ? "hover:text-white" : "hover:text-slate-900"}
            >
              {link.label}
            </a>
          ))}
          <a
            href="https://c3an.aiisc.ai/"
            target="_blank"
            rel="noreferrer"
            className={theme === "dark" ? "hover:text-white" : "hover:text-slate-900"}
          >
            C3AN
          </a>
        </nav>
      </div>
    </footer>
  );
}
