// Plan names, prices and limits shown in the app. Lead limits mirror
// clarivance.plan_lead_limit() in the database, which enforces them.
import type { Plan } from "@/lib/data";

export const PLANS: Record<Exclude<Plan, "cancelled">, { name: string; price: string; leads: number; summary: string }> = {
  trial: { name: "Free trial", price: "Free for 14 days", leads: 100, summary: "Everything available today, up to 100 leads." },
  starter: { name: "Starter", price: "$29 / month", leads: 1000, summary: "Lead pipeline, knowledge base, outreach drafts and CSV export." },
  growth: { name: "Growth", price: "$79 / month", leads: 10000, summary: "Everything in Starter, plus the AI website chat and WhatsApp as they launch." },
};

export function planName(plan: Plan): string {
  return plan === "cancelled" ? "Cancelled" : PLANS[plan].name;
}

export function leadLimit(plan: Plan): number {
  return plan === "cancelled" ? 0 : PLANS[plan].leads;
}

export function trialDaysLeft(trialEndsAt: string, now: Date): number {
  return Math.max(0, Math.ceil((Date.parse(trialEndsAt) - now.getTime()) / 864e5));
}
