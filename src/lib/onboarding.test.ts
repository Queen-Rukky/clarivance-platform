import { describe, expect, it } from "vitest";
import { parseStep, readStep } from "./onboarding";

describe("onboarding", () => {
  it("clamps the step number", () => {
    expect(parseStep("3")).toBe(3);
    expect(parseStep("9")).toBe(1);
    expect(parseStep(undefined)).toBe(1);
  });

  it("keeps only known checkbox options", () => {
    const fd = new FormData();
    fd.append("lead_sources", "WhatsApp");
    fd.append("lead_sources", "<script>");
    fd.append("contact_channels", "Email");
    const r = readStep(5, fd);
    expect(r.success && r.data).toEqual({ lead_sources: ["WhatsApp"], contact_channels: ["Email"] });
  });

  it("allows optional steps to be empty but requires a business name", () => {
    expect(readStep(6, new FormData()).success).toBe(true);
    expect(readStep(1, new FormData()).success).toBe(false);
  });
});
