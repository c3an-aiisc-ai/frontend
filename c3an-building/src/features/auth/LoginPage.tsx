import { useState, type FormEvent } from "react";
import { navigateTo } from "../../config";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    navigateTo("home");
  }

  function handleRegister() {
    navigateTo("home");
  }

  function handleDemoLogin() {
    setUsername("demoacct");
    setPassword("");
    navigateTo("home");
  }

  return (
    <div className="relative h-full overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(125,211,252,0.16),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.15),transparent_26%),linear-gradient(180deg,#f8fbff_0%,#f8fafc_44%,#eef6ff_100%)] text-slate-900">
      <div className="page-shell flex min-h-[calc(100vh-80px)] items-center justify-center py-10">
        <section className="w-full max-w-xl">
          <div className="home-angled-panel border border-white/80 bg-white/85 p-6 shadow-[0_28px_90px_-56px_rgba(15,23,42,0.35)] backdrop-blur-md">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Login</h1>

            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                void handleLogin(event);
              }}
            >
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Username
                </span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="demo-user"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Password
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 4 characters"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  className="home-angled-chip border border-slate-200/80 bg-slate-950 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  Log in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleRegister();
                  }}
                  className="home-angled-chip border border-emerald-200/80 bg-emerald-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Create account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDemoLogin();
                  }}
                  className="home-angled-chip border border-sky-200/80 bg-sky-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-800 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  Demo login
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
