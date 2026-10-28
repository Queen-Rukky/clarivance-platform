import { describe, expect, it } from "vitest";
import { addMemberSchema, businessNameSchema, credentialsSchema } from "./validation";

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
