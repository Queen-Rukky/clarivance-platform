import { describe, expect, it } from "vitest";
import { formatActivity } from "./activity";

const emails = new Map([["u1", "bisi@example.com"]]);

describe("formatActivity", () => {
  it("names the person who acted", () => {
    expect(
      formatActivity({ action: "business.created", actor_user_id: "u1", actor_agent: null, details: { name: "Clarivance" } }, emails),
    ).toBe("bisi@example.com created the business “Clarivance”");
  });

  it("labels AI agent actions", () => {
    expect(formatActivity({ action: "draft.created", actor_user_id: null, actor_agent: "customer_service", details: {} }, emails)).toBe(
      "AI agent (customer_service): draft.created",
    );
  });

  it("copes with removed members", () => {
    expect(formatActivity({ action: "member.removed", actor_user_id: "gone", actor_agent: null, details: { role: "staff" } }, emails)).toBe(
      "A former member removed a staff member",
    );
  });
});
