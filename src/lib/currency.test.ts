import { describe, it, expect, afterEach } from "vitest";
import {
  DEFAULT_CURRENCY_SETTINGS,
  formatMoney,
  formatMoneyCompact,
  formatMoneyExact,
  formatNumber,
  setCurrencySettingsCache,
} from "./currency";

afterEach(() => setCurrencySettingsCache(DEFAULT_CURRENCY_SETTINGS));

describe("formatMoneyExact", () => {
  it("shows every digit of a figure the other two shorten", () => {
    // The report cards read "Rs 1.95 L", which nobody can reconcile against a
    // bank statement or the cash drawer.
    expect(formatMoneyCompact(194800)).toBe("₹1.95 L");
    expect(formatMoneyExact(194800)).toBe("₹1,94,800");
  });

  it("groups the Indian way", () => {
    expect(formatMoneyExact(15650)).toBe("₹15,650");
    expect(formatMoneyExact(10900)).toBe("₹10,900");
    expect(formatMoneyExact(12345678)).toBe("₹1,23,45,678");
  });

  it("stays exact even when the clinic has turned abbreviation on", () => {
    // This is the case formatMoney gets wrong: it routes through formatNumber,
    // which honours the setting. A card asked to be exact has to be exact.
    setCurrencySettingsCache({ ...DEFAULT_CURRENCY_SETTINGS, abbreviate: true });
    expect(formatNumber(194800)).toBe("1.95 L");
    expect(formatMoney(194800)).toBe("₹1.95 L");
    expect(formatMoneyExact(194800)).toBe("₹1,94,800");
  });

  it("follows the configured symbol and number style", () => {
    setCurrencySettingsCache({ ...DEFAULT_CURRENCY_SETTINGS, symbol: "$", number_style: "us" });
    expect(formatMoneyExact(194800)).toBe("$194,800");
  });

  it("follows the decimals setting", () => {
    setCurrencySettingsCache({ ...DEFAULT_CURRENCY_SETTINGS, show_decimals: true, decimal_digits: 2 });
    expect(formatMoneyExact(13045)).toBe("₹13,045.00");
    expect(formatMoneyExact(850.5)).toBe("₹850.50");
  });

  it("clamps an absurd decimal_digits rather than throwing", () => {
    setCurrencySettingsCache({ ...DEFAULT_CURRENCY_SETTINGS, show_decimals: true, decimal_digits: 99 });
    expect(() => formatMoneyExact(850)).not.toThrow();
  });

  it("reads a numeric string, as the invoice rows hand it over", () => {
    expect(formatMoneyExact("194800")).toBe("₹1,94,800");
  });

  it("gives zero, not a dash, for nothing", () => {
    expect(formatMoneyExact(null)).toBe("₹0");
    expect(formatMoneyExact(undefined)).toBe("₹0");
    expect(formatMoneyExact("not a number")).toBe("₹0");
    expect(formatMoneyExact(0)).toBe("₹0");
  });

  it("keeps a negative readable", () => {
    expect(formatMoneyExact(-2000)).toBe("-₹2,000");
  });
});

describe("the other formatters are unchanged by the shared grouping helper", () => {
  it("formatNumber still groups and still dashes on nothing", () => {
    expect(formatNumber(1234567)).toBe("12,34,567");
    expect(formatNumber(null)).toBe("—");
  });

  it("formatNumber still abbreviates only when asked to", () => {
    expect(formatNumber(194800)).toBe("1,94,800");
    setCurrencySettingsCache({ ...DEFAULT_CURRENCY_SETTINGS, abbreviate: true });
    expect(formatNumber(194800)).toBe("1.95 L");
  });

  it("formatMoneyCompact still shortens above a lakh and not below", () => {
    expect(formatMoneyCompact(99999)).toBe("₹99,999");
    expect(formatMoneyCompact(100000)).toBe("₹1.00 L");
    expect(formatMoneyCompact(12345678)).toBe("₹1.23 Cr");
  });
});
