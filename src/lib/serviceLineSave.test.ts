import { describe, it, expect } from "vitest";
import { parentServiceName, linesToWrite } from "./serviceLineSave";

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
