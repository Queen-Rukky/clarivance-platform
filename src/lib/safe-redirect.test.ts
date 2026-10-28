import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it("keeps same-site paths", () => {
    expect(safeRedirectPath("/b/123")).toBe("/b/123");
    expect(safeRedirectPath("/dashboard?tab=leads")).toBe("/dashboard?tab=leads");
  });

  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "dashboard", "", "/ok\n", null, 42])(
    "falls back for %s",
    (value) => {
      expect(safeRedirectPath(value)).toBe("/dashboard");
    },
  );
});
