import { describe, expect, it } from "vitest";
import { mapHeaders, markDuplicates, parseCategory, parseDate, parseAssetStatus, validateAssetRow, validateEmployeeRow } from "@/lib/import";
import { formatAssetTag, formatRequestRef } from "@/lib/sequences";
import { toCsv } from "@/lib/csv";

describe("dates", () => {
  it("parses UAE dd/mm/yyyy, ISO, month names and Excel serials", () => {
    expect(parseDate("05/03/2024")).toBe("2024-03-05");
    expect(parseDate("2024-03-05")).toBe("2024-03-05");
    expect(parseDate("5-Mar-2024")).toBe("2024-03-05");
    expect(parseDate("05 March 24")).toBe("2024-03-05");
    expect(parseDate(45356)).toBe("2024-03-05");
    expect(parseDate("")).toBeNull();
    expect(parseDate("31/02/2024")).toBe("invalid");
    expect(parseDate("soon")).toBe("invalid");
  });
});

describe("categories and status", () => {
  it("guesses categories from free text", () => {
    expect(parseCategory("Laptop")).toBe("LAPTOP");
    expect(parseCategory("Dell Notebook")).toBe("LAPTOP");
    expect(parseCategory("iPad")).toBe("TABLET");
    expect(parseCategory("HP LaserJet Printer")).toBe("PRINTER");
    expect(parseCategory("Cisco switch")).toBe("NETWORK");
    expect(parseCategory("Intraoral camera")).toBe("PERIPHERAL");
    expect(parseCategory("Something")).toBe("OTHER");
  });
  it("maps statuses", () => {
    expect(parseAssetStatus("In use")).toBe("ASSIGNED");
    expect(parseAssetStatus("Spare")).toBe("IN_STOCK");
    expect(parseAssetStatus("Faulty")).toBe("UNDER_REPAIR");
    expect(parseAssetStatus("Disposed")).toBe("RETIRED");
    expect(parseAssetStatus("")).toBeNull();
  });
});

describe("header mapping", () => {
  it("maps common Excel headers", () => {
    const { mapping, unmapped, missing } = mapHeaders(["S/N", "Device Type", "Brand", "Model", "Emp ID", "Assigned To", "Location", "Random"], "assets");
    expect(Object.values(mapping)).toEqual(["serialNumber", "category", "make", "model", "ownerEmployeeId", "ownerName", "branch"]);
    expect(unmapped).toEqual(["Random"]);
    expect(missing).toEqual([]);
  });
  it("reports missing required columns", () => {
    expect(mapHeaders(["Name"], "employees").missing).toEqual(["Employee ID"]);
  });
});

describe("row validation", () => {
  it("validates employee rows", () => {
    const { mapping } = mapHeaders(["Emp No", "Name", "Email", "DOJ"], "employees");
    const ok = validateEmployeeRow(["E1", "Sara Ali", "SARA@clinic.ae", "01/02/2023"], mapping, 2);
    expect(ok.data).toMatchObject({ employeeId: "E1", fullName: "Sara Ali", email: "sara@clinic.ae", startDate: "2023-02-01", status: "ACTIVE" });
    const bad = validateEmployeeRow(["", "No Id", "", "bad"], mapping, 3);
    expect(bad.data).toBeNull();
    expect(bad.errors.length).toBe(2);
  });
  it("validates asset rows and flags duplicate serials", () => {
    const { mapping } = mapHeaders(["Type", "Serial", "Cost"], "assets");
    const rows = [
      validateAssetRow(["Laptop", "ABC", "AED 3,200.50"], mapping, 2),
      validateAssetRow(["Laptop", "abc", "100"], mapping, 3),
      validateAssetRow(["Laptop", "XYZ", "lots"], mapping, 4),
    ];
    expect(rows[0].data?.purchaseCost).toBe(3200.5);
    expect(rows[2].data).toBeNull();
    markDuplicates(rows, (d) => d.serialNumber, "Serial number");
    expect(rows[1].data).toBeNull();
    expect(rows[1].errors[0]).toContain("row 2");
  });
});

describe("formats", () => {
  it("formats tags and references", () => {
    expect(formatAssetTag("SIDC", "LAPTOP", 7)).toBe("SIDC-LT-0007");
    expect(formatRequestRef(2026, 12)).toBe("REQ-2026-0012");
  });
  it("CSV escapes and blocks formula injection", () => {
    const csv = toCsv(["a", "b"], [["=cmd()", 'x,"y"']]);
    expect(csv).toContain(`'=cmd(),"x,""y"""`);
  });
});

import { z } from "zod";
import { optDate, optEmail, optText } from "@/lib/validation";
describe("form validation", () => {
  it("treats missing and blank optional fields as null", () => {
    const s = z.object({ a: optText(), b: optEmail, c: optDate });
    expect(s.parse({})).toEqual({ a: null, b: null, c: null });
    expect(s.parse({ a: "  ", b: "", c: "" })).toEqual({ a: null, b: null, c: null });
    expect(s.parse({ a: " x ", b: "A@B.CO", c: "2026-01-02" }).b).toBe("a@b.co");
  });
});
