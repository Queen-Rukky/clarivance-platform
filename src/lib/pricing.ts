// How a service's price reads to a person (and later, to the AI agent).
type Priced = {
  price_type: "fixed" | "from" | "range" | "ask_owner";
  price_min: number | null;
  price_max: number | null;
  currency: string;
};

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-NG")}`;
  }
}

export function formatPrice(s: Priced): string {
  if (s.price_type === "ask_owner" || s.price_min === null) return "Price on request (agent will ask you)";
  const min = formatMoney(s.price_min, s.currency);
  if (s.price_type === "fixed") return min;
  if (s.price_type === "from") return `From ${min}`;
  return s.price_max === null ? `From ${min}` : `${min} – ${formatMoney(s.price_max, s.currency)}`;
}
