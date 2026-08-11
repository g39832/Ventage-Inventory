import Decimal from "decimal.js";

/**
 * Exact decimal arithmetic for money.
 *
 * The database stores money as NUMERIC(12,2); JavaScript doubles cannot
 * represent decimal fractions exactly, so every financial calculation in
 * the app flows through decimal.js. Convert back to a number only at the
 * display boundary (the formatters in lib/format.ts).
 */
Decimal.set({ precision: 20 });

/** Wrap a value in an exact Decimal. */
export function dec(n: number | string | Decimal): Decimal {
  if (n instanceof Decimal) return n;
  // String(n) round-trips doubles to their shortest decimal form, so values
  // that originated as 2-decimal NUMERICs stay exact.
  return new Decimal(String(n));
}

/** Sum an array of money values exactly. */
export function sum(values: (number | string | Decimal)[]): Decimal {
  let acc = new Decimal(0);
  for (const v of values) acc = acc.plus(dec(v));
  return acc;
}

/** Exact subtraction. */
export function minus(a: number | string, b: number | string): Decimal {
  return dec(a).minus(dec(b));
}

/** Exact multiplication. */
export function times(a: number | string, b: number | string): Decimal {
  return dec(a).times(dec(b));
}

/** Exact division (a / b). */
export function div(a: number | string, b: number | string): Decimal {
  return dec(a).div(dec(b));
}

/** Round to 2 decimal places, banker-safe via decimal.js default. */
export function round2(d: Decimal): Decimal {
  return d.toDecimalPlaces(2);
}

/** Convert an exact Decimal to a number (display/UI boundary only). */
export function toNum(d: Decimal): number {
  return d.toNumber();
}

/** One-liner: subtract and return a plain number. */
export function subToNum(a: number | string, b: number | string): number {
  return toNum(minus(a, b));
}

/** One-liner: sum a list and return a plain number. */
export function sumToNum(values: (number | string | Decimal)[]): number {
  return toNum(sum(values));
}
