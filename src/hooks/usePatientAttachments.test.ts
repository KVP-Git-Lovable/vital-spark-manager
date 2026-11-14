import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * The patient attachments query is defined once, on purpose.
 *
 * It used to be defined twice against one cache key: the list in
 * PatientAttachments.tsx asked for `*`, and the patient page's tab badge asked
 * for `*, procedures(service_name)` under the same ["patient-attachments", id].
 * React Query dedupes by key, so whichever mounted first populated the cache and
 * the second was silently handed the other's shape. Nothing read the joined
 * service, so nothing broke - but reading it would have come up undefined for
 * one user on one route, depending only on how they navigated in.
 *
 * The key is still shared, deliberately: one request serves the badge and the
 * list, and an upload refetched from the list updates the badge. What is no
 * longer shared is the GUESS about the shape. These tests keep a second
 * definition from reappearing, which is the only way the shapes can diverge
 * again.
 */

const HOOK = "src/hooks/usePatientAttachments.ts";

/** Non-test sources under src/, the same walk ambiguousEmbeds.test.ts uses. */
function sourceFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      // Test files are skipped: this file names the key in its own prose, and a
      // test is not a call site that can reach the cache.
      else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
    }
  };
  walk("src");
  return out;
}

const read = (path: string) => readFileSync(path, "utf8");

/** The file with its comments stripped - this one's prose names the old
 *  select on purpose, and so does the hook's. */
const code = (src: string) =>
  src.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Files holding a useQuery whose key is ["patient-attachments", ...].
 *
 * Deliberately not a search for the key alone: PatientAttachments.tsx names the
 * full key to INVALIDATE it after a document is refiled, which is correct and
 * must stay. Only a second useQuery on the key can fork the shape, so the match
 * is the key preceded by a useQuery( opening.
 */
function queryDefinitions(): string[] {
  const needle = 'queryKey: ["patient-attachments",';
  return sourceFiles().filter((file) => {
    const src = read(file);
    let at = src.indexOf(needle);
    while (at !== -1) {
      if (src.slice(Math.max(0, at - 200), at).includes("useQuery(")) return true;
      at = src.indexOf(needle, at + 1);
    }
    return false;
  });
}

describe("the patient attachments query", () => {
  it("is defined in exactly one place", () => {
    // If this fails with a second file, point that file at the hook instead of
    // giving it its own useQuery - the two selects will drift apart otherwise.
    expect(queryDefinitions()).toEqual([HOOK]);
  });

  it("is reached by the patient page's tab badge through the hook", () => {
    const page = read("src/pages/PatientDetail.tsx");
    expect(page).toMatch(/const attachmentCount = usePatientAttachments\(id\)\.data\?\.length \?\? 0;/);
    // The page must not query this table itself; that is what forked the shape.
    expect(page).not.toContain('from("procedure_attachments")');
  });

  it("is reached by the list through the same hook", () => {
    const list = read("src/components/patients/PatientAttachments.tsx");
    expect(list).toMatch(/usePatientAttachments\(patientId\)/);
    // It still writes to the table - insert on upload, update on refile, delete
    // - so only the READ is the hook's. No useQuery here is the guard for that;
    // useQueryClient, which it does import, is a different word.
    expect(code(list)).not.toMatch(/\buseQuery\b/);
  });

  it("selects the bare row, with no embed to disagree about", () => {
    const hook = code(read(HOOK));
    expect(hook).toMatch(/\.select\("\*"\)/);
    // procedures(service_name) is the join that started this. It is not read
    // anywhere, and the column it labels does not hold a service name.
    expect(hook).not.toMatch(/procedures\(/);
  });

  it("leaves the procedure sheet's truncated list on its own key", () => {
    // ProcedureDetailSheet reads the same table but .limit()s it, so it must
    // NOT share a cache entry with the full list.
    const sheet = read("src/components/procedures/ProcedureDetailSheet.tsx");
    expect(sheet).toContain('["patient-attachments-for-procedure"');
    expect(queryDefinitions()).not.toContain("src/components/procedures/ProcedureDetailSheet.tsx");
  });
});
