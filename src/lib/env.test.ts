import { describe, expect, it } from "vitest";
import { readPublicEnv } from "./env";

describe("readPublicEnv", () => {
  it("accepts valid values", () => {
    const env = readPublicEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "x".repeat(40),
    });
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe("https://abc.supabase.co");
  });

  it("names the missing variables", () => {
    expect(() => readPublicEnv({})).toThrow(/NEXT_PUBLIC_SUPABASE_URL.*NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });
});
