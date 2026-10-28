import { describe, expect, it } from "vitest";
import { assignableRoles, canEditBusiness, canManageMembers, isRole } from "./roles";

describe("roles", () => {
  it("recognises valid roles only", () => {
    expect(isRole("owner")).toBe(true);
    expect(isRole("superuser")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });

  it("lets owners and admins manage, not staff", () => {
    expect(canManageMembers("owner")).toBe(true);
    expect(canManageMembers("admin")).toBe(true);
    expect(canManageMembers("staff")).toBe(false);
    expect(canManageMembers(null)).toBe(false);
    expect(canEditBusiness("staff")).toBe(false);
  });

  it("only lets owners grant the owner role", () => {
    expect(assignableRoles("owner")).toContain("owner");
    expect(assignableRoles("admin")).toEqual(["admin", "staff"]);
    expect(assignableRoles("staff")).toEqual([]);
  });
});
