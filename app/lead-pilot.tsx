"use client";

import { useEffect, useState } from "react";
import type { AutomationMode as Mode, LeadResult } from "@/lib/automation";

const EXAMPLE_LEAD =
  "Hi, we're a 25-person Copenhagen startup. We're looking for workflow automation for our customer support team and would like a demo next week.";

const STAGES = [
  "Understanding lead",
  "Calling automation",
  "Processing in n8n",
  "Complete",
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function LeadPilot() {
  const [lead, setLead] = useState("");
  const [stage, setStage] = useState(-1);
  const [result, setResult] = useState<LeadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [executionId, setExecutionId] = useState<string | null>(null);
  const running = stage >= 0 && stage < STAGES.length - 1;

  useEffect(() => {
    fetch("/api/qualify")
      .then((r) => r.json())
      .then((d: { mode: Mode }) => setMode(d.mode))
      .catch(() => setMode(null));
  }, []);

  async function qualify() {
    setResult(null);
    setError(null);
    setExecutionId(null);
    setStage(0);

    const request = fetch("/api/qualify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead }),
    }).then(async (r) => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Automation failed.");
      return data as { mode: Mode; result: LeadResult; executionId?: string };
    });

    try {
      await wait(700);
      setStage(1);
      await wait(700);
      setStage(2);
      const [data] = await Promise.all([request, wait(600)]);
      setMode(data.mode);
      setResult(data.result);
      setExecutionId(data.executionId ?? null);
      setStage(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Automation failed.");
      setStage(-1);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:py-14">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
              LP
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">LeadPilot</h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Turn messy leads into actionable opportunities.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300">
            Powered by Claude + MCP + n8n
          </span>
          {mode && <ModeBadge mode={mode} />}
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Qualify a Lead</h2>
          <button
            type="button"
            onClick={() => setLead(EXAMPLE_LEAD)}
            disabled={running}
            className="text-sm font-medium text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-400"
          >
            Use example lead
          </button>
        </div>
        <textarea
          value={lead}
          onChange={(e) => setLead(e.target.value)}
          placeholder="Paste an incoming lead..."
          rows={5}
          className="mt-4 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-indigo-900"
        />
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={qualify}
            disabled={running || !lead.trim()}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? "Qualifying…" : "Qualify Lead"}
          </button>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        {stage >= 0 && (
          <ol className="mt-6 grid gap-2 sm:grid-cols-4">
            {STAGES.map((label, i) => {
              const done = i < stage || stage === STAGES.length - 1;
              const active = i === stage && !done;
              return (
                <li
                  key={label}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    done
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                      : active
                        ? "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-300"
                        : "border-slate-200 text-slate-400 dark:border-slate-800"
                  }`}
                >
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      done ? "bg-emerald-500" : active ? "animate-pulse bg-indigo-500" : "bg-slate-300 dark:bg-slate-700"
                    }`}
                  />
                  {label === "Processing in n8n" && mode === "demo"
                    ? "Processing (demo)"
                    : label}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {result && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Result</h2>
            {mode && <ModeBadge mode={mode} />}
          </div>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Category" value={result.category} />
            <Field label="Priority" value={result.priority} highlight={/high/i.test(result.priority)} />
            <Field label="Summary" value={result.summary} wide />
            <Field label="Recommended Next Action" value={result.nextAction} wide />
          </dl>
          {executionId && (
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              n8n execution ID: <span className="font-mono">{executionId}</span>
            </p>
          )}
        </section>
      )}

      <section className="rounded-2xl border border-dashed border-slate-300 p-6 dark:border-slate-700">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          How it works
        </h2>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-medium">
          {["Lead", "Claude", "MCP", "n8n", "Result"].map((step, i, all) => (
            <span key={step} className="flex items-center gap-2">
              <span className="rounded-lg bg-slate-100 px-3 py-1.5 dark:bg-slate-800">{step}</span>
              {i < all.length - 1 && <span className="text-slate-400">→</span>}
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          Claude reasons about the request. MCP provides the tool interface. n8n executes the
          business workflow.
        </p>
      </section>
    </div>
  );
}

function ModeBadge({ mode }: { mode: Mode }) {
  if (mode === "demo") {
    return (
      <span
        title="Nothing configured. Results come from a local heuristic, not Claude or n8n."
        className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300"
      >
        Demo Mode · simulated
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
      {mode === "claude-mcp" ? "● Live: Claude → MCP → n8n" : "● Live: n8n webhook"}
    </span>
  );
}

function Field({
  label,
  value,
  wide,
  highlight,
}: {
  label: string;
  value: string;
  wide?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl bg-slate-50 p-4 dark:bg-slate-950 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd
        className={`mt-1 text-base font-semibold ${highlight ? "text-rose-600 dark:text-rose-400" : ""}`}
      >
        {value || "—"}
      </dd>
    </div>
  );
}
