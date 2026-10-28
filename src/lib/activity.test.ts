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
    expect(formatActivity({ action: "reply.sent", actor_user_id: null, actor_agent: "customer_service", details: {} }, emails)).toBe(
      "AI agent (customer_service): reply.sent",
    );
  });

  it("copes with removed members", () => {
    expect(formatActivity({ action: "member.removed", actor_user_id: "gone", actor_agent: null, details: { role: "staff" } }, emails)).toBe(
      "A former member removed a staff member",
    );
  });
});

describe("formatActivity for the knowledge base", () => {
  it("describes approvals with the item's label", () => {
    expect(
      formatActivity({ action: "service.approved", actor_user_id: "u1", actor_agent: null, details: { label: "Audit" } }, emails),
    ).toBe("bisi@example.com approved the service “Audit”");
    expect(formatActivity({ action: "knowledge.deleted", actor_user_id: "u1", actor_agent: null, details: {} }, emails)).toBe(
      "bisi@example.com deleted the FAQ",
    );
  });

  it("describes invites", () => {
    expect(formatActivity({ action: "member.invited", actor_user_id: "u1", actor_agent: null, details: { role: "staff" } }, emails)).toBe(
      "bisi@example.com invited someone to join as staff",
    );
  });
});

describe("formatActivity for leads", () => {
  it("describes stage changes in words", () => {
    expect(
      formatActivity({ action: "lead.status_changed", actor_user_id: "u1", actor_agent: null, details: { label: "Acme", to: "meeting_booked" } }, emails),
    ).toBe("bisi@example.com moved “Acme” to Meeting booked");
  });
});
