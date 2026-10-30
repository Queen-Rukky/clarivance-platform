import { describe, expect, it } from "vitest";
import { templateDraft } from "./leads";
import { checkDraft } from "./outreach-rules";

const rules = (subject: string, body: string, channel: "email" | "social" | "whatsapp" = "email") =>
  checkDraft({ subject, body }, channel).map((i) => i.rule);

describe("outreach writing check", () => {
  it("passes a short, plain, specific email", () => {
    expect(rules("idea for apex roofing", "Hi Sam,\n\nApex Roofing shows storm repairs first on its site.\n\nHow do you handle calls that come in after 6pm?\n\nAda\nClarivance")).toEqual([]);
  });

  it("flags the usual AI and template tells", () => {
    const found = rules(
      "Re: QUICK question",
      "Hi Sam,\n\nI hope this finds you well! I'm reaching out because we supercharge growth — really. Free trial? Call today?",
    );
    expect(found).toEqual(
      expect.arrayContaining(["dash", "exclamation", "one_question", "cliche", "spam_words", "caps", "starts_with_me", "fake_reply"]),
    );
  });

  it("matches whole words only and ignores curly apostrophes", () => {
    expect(rules("", "Your freezer business looks busy. Is winter slower?")).not.toContain("spam_words");
    expect(rules("", "Hope you’re doing well. Is winter slower?")).toContain("cliche");
  });

  it("checks length per channel and only checks email for links and spam words", () => {
    const long = Array(70).fill("word").join(" ");
    expect(rules("", long, "email")).not.toContain("length");
    expect(rules("", long, "whatsapp")).toContain("length");
    expect(rules("", "Free to talk? www.example.com", "whatsapp")).toEqual([]);
    expect(rules("a thought", "Free to talk? www.example.com", "email")).toEqual(["spam_words", "link"]);
  });

  it("is satisfied by the built-in template drafts", () => {
    const base = { businessName: "Clarivance", offer: "we answer every enquiry in under a minute.", senderName: "Ada" };
    const cold = templateDraft(
      { ...base, lead: { contact_name: "Sam Lee", company: "Apex Roofing", industry: "Roofing", location: "Houston", enquiry: "", status: "new" } },
      "email",
    );
    expect(cold.body).toContain("Apex Roofing came up while I was looking at roofing businesses in Houston.");
    expect(cold.subject).toBe("idea for Apex Roofing");
    expect(checkDraft(cold, "email")).toEqual([]);
    const inbound = templateDraft(
      { ...base, lead: { contact_name: "", company: "", industry: "", location: "", enquiry: "Need WhatsApp replies", status: "new" } },
      "whatsapp",
    );
    expect(checkDraft(inbound, "whatsapp")).toEqual([]);
  });
});
