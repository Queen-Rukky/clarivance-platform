import { describe, expect, it } from "vitest";
import {
  addMemberSchema,
  businessNameSchema,
  credentialsSchema,
  faqSchema,
  newPasswordSchema,
  profileSchema,
  serviceSchema,
} from "./validation";

describe("validation", () => {
  it("normalises emails", () => {
    const r = credentialsSchema.parse({ email: "Bisi@Example.com", password: "longenough" });
    expect(r.email).toBe("bisi@example.com");
  });

  it("rejects short passwords and bad emails", () => {
    expect(credentialsSchema.safeParse({ email: "x", password: "longenough" }).success).toBe(false);
    expect(credentialsSchema.safeParse({ email: "a@b.co", password: "short" }).success).toBe(false);
  });

  it("trims and bounds business names", () => {
    expect(businessNameSchema.parse("  Clarivance  ")).toBe("Clarivance");
    expect(businessNameSchema.safeParse("A").success).toBe(false);
    expect(businessNameSchema.safeParse("x".repeat(121)).success).toBe(false);
  });

  it("rejects unknown roles when adding members", () => {
    const base = { businessId: "6f1c1f0e-8b7a-4c5e-9a43-2d1f0b8e7c11", email: "a@b.co" };
    expect(addMemberSchema.safeParse({ ...base, role: "staff" }).success).toBe(true);
    expect(addMemberSchema.safeParse({ ...base, role: "god" }).success).toBe(false);
  });
});

describe("knowledge base validation", () => {
  const businessId = "6f1c1f0e-8b7a-4c5e-9a43-2d1f0b8e7c11";
  const service = { businessId, name: "Strategy session", description: "", currency: "ngn", approved: true };

  it("parses prices and clears ones the price type doesn't use", () => {
    const fixed = serviceSchema.parse({ ...service, price_type: "fixed", price_min: "50,000", price_max: "90000" });
    expect(fixed).toMatchObject({ price_min: 50000, price_max: null, currency: "NGN" });
    const ask = serviceSchema.parse({ ...service, price_type: "ask_owner", price_min: "100", price_max: "" });
    expect(ask).toMatchObject({ price_min: null, price_max: null });
  });

  it("requires prices that match the price type", () => {
    expect(serviceSchema.safeParse({ ...service, price_type: "fixed", price_min: "", price_max: "" }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...service, price_type: "range", price_min: "500", price_max: "100" }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...service, price_type: "from", price_min: "abc", price_max: "" }).success).toBe(false);
  });

  it("allows an empty contact email but not a bad one", () => {
    const base = { businessId, about: "", location: "", contact_phone: "", opening_hours: "", tone: "" };
    expect(profileSchema.safeParse({ ...base, contact_email: "" }).success).toBe(true);
    expect(profileSchema.safeParse({ ...base, contact_email: "nope" }).success).toBe(false);
  });

  it("checks that new passwords match", () => {
    expect(newPasswordSchema.safeParse({ password: "longenough", confirm: "longenough" }).success).toBe(true);
    expect(newPasswordSchema.safeParse({ password: "longenough", confirm: "different1" }).success).toBe(false);
  });

  it("requires a question and answer for FAQs", () => {
    expect(faqSchema.safeParse({ businessId, question: "Where?", answer: "Lagos", approved: false }).success).toBe(true);
    expect(faqSchema.safeParse({ businessId, question: "", answer: "Lagos", approved: false }).success).toBe(false);
  });
});
