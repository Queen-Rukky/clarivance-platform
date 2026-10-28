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

export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form and try again.";
}
