import { describe, expect, it } from "vitest";
import { friendlyDbError } from "./errors";

describe("friendlyDbError", () => {
  it("shows our own SQL messages", () => {
    expect(friendlyDbError({ message: "already a member" })).toBe("Already a member.");
    expect(friendlyDbError({ message: "not allowed" })).toBe("You don't have permission to do that.");
  });

  it("hides unexpected internal errors", () => {
    expect(friendlyDbError({ message: 'relation "x" does not exist' })).toBe("Something went wrong. Please try again.");
    expect(friendlyDbError(null, "Nope")).toBe("Nope");
  });

  it("explains a schema that isn't exposed yet", () => {
    expect(friendlyDbError({ code: "PGRST106", message: "Invalid schema: clarivance" })).toMatch(/Exposed schemas/);
  });
});
