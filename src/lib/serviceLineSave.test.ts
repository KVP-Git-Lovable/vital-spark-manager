import { describe, it, expect } from "vitest";
import { parentServiceName, linesToWrite, matchStoredRows } from "./serviceLineSave";

describe("parentServiceName", () => {
  it("is the roll-up of the services that remain", () => {
    expect(
      parentServiceName(
        [{ id: "a", service_name: "HYDRADELUXE" }, { id: "b", service_name: "EXION MNRF" }],
        true,
        "HYDRADELUXE, EXION MNRF, GFC",
      ),
    ).toBe("HYDRADELUXE, EXION MNRF");
  });

  it("clears the name when every service was removed, so the document stops printing one", () => {
    expect(parentServiceName([], true, "EXION MNRF")).toBe("");
  });

  it("keeps the name of a visit that never had service lines", () => {
    // Scan Prescription writes the name on the visit itself and no lines, and
    // imported visits have none either. The printed document reads that name -
    // clearing it would lose the only record of what was done.
    expect(parentServiceName([], false, "EXION MNRF")).toBe("EXION MNRF");
  });

  it("trims what it joins, so a stray space does not reach the document", () => {
    expect(parentServiceName([{ id: "a", service_name: "  GFC  " }], true, "GFC")).toBe("GFC");
  });
});

describe("linesToWrite", () => {
  it("writes a stored row even once its name has been cleared", () => {
    // Skipping it left the old name in the database, and on the prescription.
    const lines = [{ id: "a", service_name: "" }];
    expect(linesToWrite(lines)).toEqual(lines);
  });

  it("writes stored and named rows", () => {
    const lines = [
      { id: "a", service_name: "HYDRADELUXE" },
      { service_name: "GFC" },
    ];
    expect(linesToWrite(lines)).toEqual(lines);
  });

  it("leaves an untouched empty row out, so saving adds nothing", () => {
    expect(linesToWrite([{ service_name: "" }, { service_name: "   " }])).toEqual([]);
  });
});

describe("matchStoredRows", () => {
  const stored = [
    { id: "row-1", service_name: "HYDRASIGNATURE" },
    { id: "row-2", service_name: "GFC" },
  ];

  it("writes an invented line back to the row it is really about", () => {
    // The line has no id because it was made up from the parent row while the
    // services query answered from a stale cache. Inserting it is what stored
    // HYDRASIGNATURE twice.
    expect(matchStoredRows([{ service_name: "HYDRASIGNATURE" }], stored)).toEqual(["row-1"]);
  });

  it("leaves a line that already knows its own row alone", () => {
    expect(matchStoredRows([{ id: "row-2", service_name: "GFC" }], stored)).toEqual(["row-2"]);
  });

  it("inserts a service the visit does not hold yet", () => {
    expect(matchStoredRows([{ service_name: "EXION MNRF" }], stored)).toEqual([null]);
  });

  it("still lets a doctor list the same service twice", () => {
    expect(
      matchStoredRows(
        [{ service_name: "HYDRASIGNATURE" }, { service_name: "HYDRASIGNATURE" }],
        stored,
      ),
    ).toEqual(["row-1", null]);
  });

  it("does not hand one row to two lines when the first already holds it", () => {
    expect(
      matchStoredRows(
        [{ id: "row-1", service_name: "HYDRASIGNATURE" }, { service_name: "HYDRASIGNATURE" }],
        stored,
      ),
    ).toEqual(["row-1", null]);
  });

  it("reads a name the same however it was typed", () => {
    expect(matchStoredRows([{ service_name: "  hydrasignature " }], stored)).toEqual(["row-1"]);
  });

  it("inserts a nameless line rather than claiming a row at random", () => {
    expect(matchStoredRows([{ service_name: "" }], stored)).toEqual([null]);
  });

  it("inserts everything when the visit holds nothing yet", () => {
    expect(matchStoredRows([{ service_name: "GFC" }], [])).toEqual([null]);
  });
});
