export const ROLES = ["owner", "admin", "staff"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function canManageMembers(role: Role | null): boolean {
  return role === "owner" || role === "admin";
}

export function canEditBusiness(role: Role | null): boolean {
  return role === "owner" || role === "admin";
}

// Mirrors the database rules: only owners can grant the owner role.
export function assignableRoles(actor: Role | null): Role[] {
  if (actor === "owner") return ["owner", "admin", "staff"];
  if (actor === "admin") return ["admin", "staff"];
  return [];
}
