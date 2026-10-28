import { z } from "zod";
import { ROLES } from "@/lib/roles";

export const credentialsSchema = z.object({
  email: z.email("Enter a valid email address.").transform((v) => v.trim().toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const businessNameSchema = z
  .string()
  .trim()
  .min(2, "Business name must be at least 2 characters.")
  .max(120, "Business name must be 120 characters or fewer.");

export const addMemberSchema = z.object({
  businessId: z.uuid(),
  email: z.email("Enter a valid email address.").transform((v) => v.trim().toLowerCase()),
  role: z.enum(ROLES, "Choose a role."),
});

export const memberChangeSchema = z.object({
  businessId: z.uuid(),
  userId: z.uuid(),
});

export const emailSchema = z.email("Enter a valid email address.").transform((v) => v.trim().toLowerCase());

export const newPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The two passwords don't match.", path: ["confirm"] });

const text = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer.`);

export const profileSchema = z.object({
  businessId: z.uuid(),
  about: text(4000, "About"),
  location: text(300, "Location"),
  contact_email: z.union([z.literal(""), emailSchema]),
  contact_phone: text(50, "Phone"),
  opening_hours: text(500, "Opening hours"),
  tone: text(500, "Tone"),
});

export const PRICE_TYPES = ["fixed", "from", "range", "ask_owner"] as const;

const money = z
  .string()
  .trim()
  .transform((v) => v.replace(/,/g, ""))
  .pipe(z.union([z.literal(""), z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter prices as numbers, e.g. 50000.")]))
  .transform((v) => (v === "" ? null : Number(v)));

export const serviceSchema = z
  .object({
    businessId: z.uuid(),
    name: z.string().trim().min(2, "Service name must be at least 2 characters.").max(120, "Service name is too long."),
    description: text(2000, "Description"),
    price_type: z.enum(PRICE_TYPES, "Choose how this service is priced."),
    price_min: money,
    price_max: money,
    currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Currency must be a 3-letter code like NGN."),
    approved: z.boolean(),
  })
  .transform((v) => ({
    ...v,
    price_min: v.price_type === "ask_owner" ? null : v.price_min,
    price_max: v.price_type === "range" ? v.price_max : null,
  }))
  .superRefine((v, ctx) => {
    if (v.price_type !== "ask_owner" && v.price_min === null) {
      ctx.addIssue({ code: "custom", message: "Enter a price, or choose “Ask the owner”." });
    }
    if (v.price_type === "range" && (v.price_max === null || (v.price_min !== null && v.price_max < v.price_min))) {
      ctx.addIssue({ code: "custom", message: "Enter a top price that is at least the starting price." });
    }
  });

export const faqSchema = z.object({
  businessId: z.uuid(),
  question: z.string().trim().min(3, "Question must be at least 3 characters.").max(300, "Question is too long."),
  answer: z.string().trim().min(1, "Write an answer.").max(4000, "Answer is too long."),
  approved: z.boolean(),
});

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}
