// The six onboarding steps and how each one's answers are read from a form.
import { z } from "zod";

export const SETUP_STEPS = [
  { title: "Your business", help: "The name customers know you by and your website." },
  { title: "What you sell", help: "The product or service you want more customers for." },
  { title: "Who you sell to", help: "The industries and places your best customers are in." },
  { title: "Company size and decision maker", help: "Who usually says yes, and how big their organisation is." },
  { title: "Lead sources and channels", help: "Where enquiries come from and how you like to reply." },
  { title: "Exclusions and must-haves", help: "Optional. Who to ignore and what makes a lead worth chasing." },
] as const;

export const LEAD_SOURCE_OPTIONS = ["Website", "WhatsApp", "Instagram", "Facebook", "LinkedIn", "Referrals", "Events", "Google search", "Phone calls"];
export const CHANNEL_OPTIONS = ["Email", "WhatsApp", "Phone", "LinkedIn", "Instagram DM", "In person"];
export const COMPANY_SIZES = ["", "Individuals / consumers", "1–10 staff", "11–50 staff", "51–200 staff", "201–1,000 staff", "1,000+ staff", "Any size"];

const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters.`);
const pick = (options: string[]) => z.array(z.string()).transform((v) => v.filter((x) => options.includes(x)));

export const stepSchemas = {
  1: z.object({
    name: z.string().trim().min(2, "Business name must be at least 2 characters.").max(120),
    website: text(300),
  }),
  2: z.object({ offer: text(2000) }),
  3: z.object({ ideal_industries: text(500), ideal_locations: text(500) }),
  4: z.object({
    company_size: z.string().refine((v) => COMPANY_SIZES.includes(v), "Choose a company size."),
    decision_maker: text(200),
  }),
  5: z.object({ lead_sources: pick(LEAD_SOURCE_OPTIONS), contact_channels: pick(CHANNEL_OPTIONS) }),
  6: z.object({ exclusions: text(1000), qualification_rules: text(1000) }),
} as const;

export type StepNumber = keyof typeof stepSchemas;

export function parseStep(v: string | string[] | undefined): StepNumber {
  const n = Number.parseInt(Array.isArray(v) ? (v[0] ?? "") : (v ?? ""), 10);
  return (n >= 1 && n <= 6 ? n : 1) as StepNumber;
}

export function readStep(step: StepNumber, formData: FormData) {
  const str = (k: string) => (typeof formData.get(k) === "string" ? (formData.get(k) as string) : "");
  const raw: Record<StepNumber, Record<string, unknown>> = {
    1: { name: str("name"), website: str("website") },
    2: { offer: str("offer") },
    3: { ideal_industries: str("ideal_industries"), ideal_locations: str("ideal_locations") },
    4: { company_size: str("company_size"), decision_maker: str("decision_maker") },
    5: { lead_sources: formData.getAll("lead_sources"), contact_channels: formData.getAll("contact_channels") },
    6: { exclusions: str("exclusions"), qualification_rules: str("qualification_rules") },
  };
  return stepSchemas[step].safeParse(raw[step]);
}
