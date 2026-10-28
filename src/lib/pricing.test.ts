import { describe, expect, it } from "vitest";
import { formatPrice } from "./pricing";

describe("formatPrice", () => {
  it("never shows a number for ask-the-owner services", () => {
    expect(formatPrice({ price_type: "ask_owner", price_min: null, price_max: null, currency: "NGN" })).toMatch(/on request/);
  });

  it("formats fixed, from and range prices", () => {
    expect(formatPrice({ price_type: "fixed", price_min: 50000, price_max: null, currency: "NGN" })).toMatch(/50,000/);
    expect(formatPrice({ price_type: "from", price_min: 100, price_max: null, currency: "USD" })).toMatch(/^From .*100/);
    expect(formatPrice({ price_type: "range", price_min: 100, price_max: 200, currency: "GBP" })).toMatch(/100.*–.*200/);
  });
});
