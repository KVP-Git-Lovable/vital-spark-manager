import { describe, it, expect } from "vitest";
import { buildTokenFilters, fuzzyScore, fuzzyRank } from "./fuzzySearch";

/**
 * The clinic searched "nisha rai" and got Dr Supriya Rai, NISHA DSOUZA,
 * Ashritha Rai, Nisha, Punya Rai and Sulan Raiker - six people, none of them
 * called Nisha Rai - while the actual Anisha Rai was pushed below the patients
 * section entirely.
 *
 * Two separate things were OR-ing where they should have been AND-ing: the
 * PostgREST filter, and the ranking that ordered whatever came back.
 */

const PATIENT_COLS = ["first_name", "last_name", "phone", "email"];

describe("buildTokenFilters", () => {
  it("gives one filter per word, so the caller can AND them", () => {
    // Applied as separate .or() calls, which PostgREST ANDs together.
    const filters = buildTokenFilters("nisha rai", PATIENT_COLS);
    expect(filters).toHaveLength(2);
    expect(filters[0]).toContain("first_name.ilike.%nisha%");
    expect(filters[0]).toContain("last_name.ilike.%nisha%");
    expect(filters[1]).toContain("first_name.ilike.%rai%");
    expect(filters[1]).not.toContain("nisha");
  });

  it("covers every column for each word, so a phone or email still matches", () => {
    const [only] = buildTokenFilters("9845", PATIENT_COLS);
    for (const col of PATIENT_COLS) expect(only).toContain(`${col}.ilike.%9845%`);
  });

  it("leaves a single word exactly as loose as it was", () => {
    expect(buildTokenFilters("rai", PATIENT_COLS)).toHaveLength(1);
  });

  it("does not repeat a word typed twice", () => {
    expect(buildTokenFilters("rai rai", PATIENT_COLS)).toHaveLength(1);
  });

  it("has nothing to say about an empty search", () => {
    expect(buildTokenFilters("", PATIENT_COLS)).toEqual([]);
    expect(buildTokenFilters("   ", PATIENT_COLS)).toEqual([]);
    expect(buildTokenFilters("rai", [])).toEqual([]);
  });

  it("strips the characters that would break a PostgREST filter", () => {
    // %, ( ) and * are the ones that corrupt an or(...) expression. The % here
    // splits the word in two, which is correct - it is not part of the name.
    const filters = buildTokenFilters("o'br%ien(x)", ["last_name"]);
    for (const f of filters) {
      expect(f).not.toContain("(");
      expect(f).not.toContain(")");
      expect(f).not.toContain("*");
      // Only the wildcards the builder itself adds remain.
      expect(f.match(/%/g)?.length).toBe(2);
    }
  });
});

describe("fuzzyScore - the weakest word decides", () => {
  it("no longer scores another Rai as a perfect match for nisha rai", () => {
    // This is the bug: "rai" alone used to carry the whole score.
    expect(fuzzyScore("nisha rai", "Punya Rai")).toBeLessThan(0.45);
    expect(fuzzyScore("nisha rai", "Sulan Raiker")).toBeLessThan(0.45);
    expect(fuzzyScore("nisha rai", "Ashritha Rai")).toBeLessThan(0.45);
  });

  it("keeps the person actually being looked for at the top", () => {
    expect(fuzzyScore("nisha rai", "Anisha Rai")).toBeGreaterThan(0.8);
  });

  it("treats a single word exactly as before", () => {
    expect(fuzzyScore("rai", "Punya Rai")).toBeGreaterThan(0.8);
    expect(fuzzyScore("rai", "Ashritha Rai")).toBeGreaterThan(0.8);
  });

  it("still matches the whole term as a substring", () => {
    expect(fuzzyScore("anisha rai", "Anisha Rai")).toBe(1);
  });

  it("still tolerates a typo in one word", () => {
    expect(fuzzyScore("anisha rau", "Anisha Rai")).toBeGreaterThan(0.6);
  });

  it("gives nothing for an empty side", () => {
    expect(fuzzyScore("", "Anisha Rai")).toBe(0);
    expect(fuzzyScore("nisha", "")).toBe(0);
  });
});

describe("fuzzyRank on the reported search", () => {
  it("returns Anisha Rai and drops the other Rais", () => {
    const rows = [
      { name: "Dr Supriya Rai" },
      { name: "NISHA DSOUZA" },
      { name: "Ashritha Rai" },
      { name: "Anisha Rai" },
      { name: "Punya Rai" },
      { name: "Sulan Raiker" },
    ];
    const ranked = fuzzyRank(rows, "nisha rai", (r) => r.name, 0.45);
    expect(ranked.map((r) => r.name)).toEqual(["Anisha Rai"]);
  });
});
