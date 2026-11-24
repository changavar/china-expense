export const DEFAULT_EXCHANGE_RATE = "1.55";
export const MAX_AMOUNT_CENTS = 999_999_999_99; // ¥999,999,999.99
export const MAX_RATE_DECIMALS = 6;

const amountFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: MAX_RATE_DECIMALS,
  useGrouping: false,
});

/**
 * Parse a decimal exchange rate into an exact fraction.
 * "1.55" -> { numerator: 155n, denominator: 100n, canonical: "1.55" }
 */
export function parseRate(raw) {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  let value = String(raw).trim().replace(/\s+/g, "").replace(",", ".");
  if (!/^\d{1,9}(?:\.\d{1,6})?$/.test(value)) return null;

  let [whole, fraction = ""] = value.split(".");
  whole = whole.replace(/^0+(?=\d)/, "");
  fraction = fraction.replace(/0+$/, "");
  const canonical = fraction ? `${whole}.${fraction}` : whole;
  const numerator = BigInt(whole + fraction);
  const denominator = 10n ** BigInt(fraction.length);

  if (numerator <= 0n) return null;

  return {
    numerator,
    denominator,
    canonical,
    value: Number(canonical),
  };
}

export function normalizeRate(raw) {
  const parsed = parseRate(raw);
  return parsed ? parsed.canonical : null;
}

/**
 * Parse a money input string into integer cents, avoiding floating point math.
 * "150" -> 15000, "150.5" -> 15050, "1,200.05" -> 120005.
 * Returns null for empty, invalid, zero, negative, or over-limit values.
 */
export function parseAmountToCents(raw) {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  let value = String(raw)
    .trim()
    .replace(/\s+/g, "")
    .replace(/^¥/, "")
    .replace(/^CNY/i, "");

  // Accept a comma as a decimal separator, while also tolerating
  // comma-grouped amounts such as 1,200.
  if (value.includes(",") && value.includes(".")) {
    value = value.replace(/,/g, "");
  } else if (value.includes(",")) {
    const parts = value.split(",");
    value =
      parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2
        ? `${parts[0]}.${parts[1]}`
        : value.replace(/,/g, "");
  }

  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(value)) return null;

  const [whole, fraction = ""] = value.split(".");
  const cents = BigInt(whole) * 100n + BigInt((fraction + "00").slice(0, 2));
  if (cents <= 0n || cents > BigInt(MAX_AMOUNT_CENTS)) return null;
  return Number(cents);
}

/** Backwards-compatible alias for older callers. */
export const parseCnyToCents = parseAmountToCents;

/**
 * Convert CNY cents to AED cents at an exact decimal rate.
 * Formula: AED = CNY / rate.
 * Rounding is half-up at the cent level.
 */
export function convertCnyToAedCents(cnyCents, rate) {
  const parsed = typeof rate === "string" ? parseRate(rate) : rate;
  if (!parsed || !Number.isSafeInteger(cnyCents) || cnyCents < 0) return null;

  const numerator = BigInt(cnyCents) * parsed.denominator;
  const denominator = parsed.numerator;
  // floor((2n + d) / 2d) is round-half-up for positive values.
  const rounded = (2n * numerator + denominator) / (2n * denominator);
  const result = Number(rounded);
  return Number.isSafeInteger(result) ? result : null;
}

/**
 * Convert AED cents to CNY cents at an exact decimal rate.
 * Formula: CNY = AED * rate.
 * Rounding is half-up at the cent level.
 */
export function convertAedToCnyCents(aedCents, rate) {
  const parsed = typeof rate === "string" ? parseRate(rate) : rate;
  if (!parsed || !Number.isSafeInteger(aedCents) || aedCents < 0) return null;

  const numerator = BigInt(aedCents) * parsed.numerator;
  const denominator = parsed.denominator;
  const rounded = (2n * numerator + denominator) / (2n * denominator);
  const result = Number(rounded);
  return Number.isSafeInteger(result) ? result : null;
}

export function formatCents(cents) {
  const safe = Number.isFinite(cents) ? Math.round(cents) : 0;
  return amountFormatter.format(safe / 100);
}

export function formatCny(cents) {
  return `¥${formatCents(cents)}`;
}

export function formatAed(cents) {
  return `AED ${formatCents(cents)}`;
}

export function formatRate(rate) {
  const parsed = typeof rate === "string" ? parseRate(rate) : rate;
  if (!parsed) return DEFAULT_EXCHANGE_RATE;
  return compactNumberFormatter.format(parsed.value);
}

export function formatRateLine(rate) {
  return `1 AED = ${formatRate(rate)} CNY`;
}

export function centsToInputValue(cents) {
  return (Math.round(cents) / 100).toFixed(2);
}

export function isValidDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1900 || year > 2200) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateFromISO(value) {
  if (!isValidDateString(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDisplayDate(value, options = {}) {
  const date = dateFromISO(value);
  if (!date) return value || "";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: options.weekday ? "short" : undefined,
    day: "numeric",
    month: "short",
    year: options.year === false ? undefined : "numeric",
  }).format(date);
}

export function formatLongDate(value) {
  const date = dateFromISO(value);
  if (!date) return value || "";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function compareExpensesNewestFirst(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  const aCreated = a.createdAt || "";
  const bCreated = b.createdAt || "";
  if (aCreated !== bCreated) return aCreated < bCreated ? 1 : -1;
  return String(a.id).localeCompare(String(b.id));
}
