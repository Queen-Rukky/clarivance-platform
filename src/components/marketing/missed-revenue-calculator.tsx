"use client";

import { useId, useState } from "react";

// A transparent estimate from the visitor's own numbers. No data leaves the page.
export function MissedRevenueCalculator() {
  const id = useId();
  const [enquiries, setEnquiries] = useState(40);
  const [missed, setMissed] = useState(25);
  const [closeRate, setCloseRate] = useState(20);
  const [value, setValue] = useState(150000);
  const [currency, setCurrency] = useState("NGN");

  const lostPerMonth = enquiries * 4.33 * (missed / 100) * (closeRate / 100) * value;
  const lostCustomers = enquiries * 4.33 * (missed / 100) * (closeRate / 100);
  const money = (n: number) => {
    try {
      return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
    } catch {
      return `${currency} ${Math.round(n).toLocaleString()}`;
    }
  };

  const field = (label: string, v: number, set: (n: number) => void, opts: { min: number; max: number; step: number; suffix?: string }) => (
    <label className="field" htmlFor={`${id}-${label}`}>
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <input
          id={`${id}-${label}`}
          type="number"
          inputMode="decimal"
          min={opts.min}
          max={opts.max}
          step={opts.step}
          value={Number.isFinite(v) ? v : ""}
          onChange={(e) => set(Math.min(opts.max, Math.max(opts.min, Number(e.target.value) || 0)))}
        />
        {opts.suffix && <span className="text-sm text-muted">{opts.suffix}</span>}
      </div>
    </label>
  );

  return (
    <div className="grid gap-6 rounded-2xl border border-line bg-surface p-5 md:grid-cols-2 md:p-8">
      <div className="flex flex-col gap-3">
        {field("Enquiries per week", enquiries, setEnquiries, { min: 0, max: 10000, step: 1 })}
        {field("Share that get a slow reply or none", missed, setMissed, { min: 0, max: 100, step: 1, suffix: "%" })}
        {field("Share of answered enquiries that buy", closeRate, setCloseRate, { min: 0, max: 100, step: 1, suffix: "%" })}
        <div className="grid grid-cols-[1fr_6rem] gap-2">
          {field("Average sale value", value, setValue, { min: 0, max: 1e9, step: 1000 })}
          <label className="field">
            <span>Currency</span>
            <select className="select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {["NGN", "USD", "GBP", "EUR", "GHS", "KES", "ZAR"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>
      </div>
      <div className="flex flex-col justify-center gap-2 rounded-xl p-5" style={{ background: "var(--accent-soft)" }} aria-live="polite">
        <p className="text-sm font-medium">Estimated sales you may be missing each month</p>
        <p className="text-4xl font-semibold tracking-tight tabular-nums">{money(lostPerMonth)}</p>
        <p className="text-sm text-muted">
          About {lostCustomers.toFixed(1)} customers a month, if missed enquiries would have bought at the same rate as answered
          ones. This is an estimate from your inputs, not a promise of results.
        </p>
      </div>
    </div>
  );
}
