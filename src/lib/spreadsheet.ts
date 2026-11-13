import "server-only";
import ExcelJS from "exceljs";
import Papa from "papaparse";

/** Reads the first sheet of an .xlsx or a .csv file into rows of cell values. */
export async function readSpreadsheet(file: File): Promise<unknown[][]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type === "text/csv") {
    const text = (await file.text()).replace(/^﻿/, "");
    const res = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
    return res.data;
  }
  if (name.endsWith(".xlsx")) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(await file.arrayBuffer()) as unknown as ArrayBuffer);
    const ws = wb.worksheets.find((w) => w.actualRowCount > 0);
    if (!ws) return [];
    const rows: unknown[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals = (row.values as unknown[]).slice(1).map(cellValue);
      if (vals.some((v) => v !== null && String(v).trim() !== "")) rows.push(vals);
    });
    return rows;
  }
  throw new Error("Upload an .xlsx or .csv file. For older .xls files, open in Excel and “Save as” .xlsx first.");
}

function cellValue(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("result" in o) return cellValue(o.result);
    if ("richText" in o && Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((t) => t.text).join("");
    if ("text" in o) return o.text;
    if ("error" in o) return null;
  }
  return v;
}

/** Finds the header row: the first of the top 10 rows with the most text cells. */
export function findHeaderRow(rows: unknown[][]): number {
  let best = 0, bestScore = -1;
  rows.slice(0, 10).forEach((r, i) => {
    const score = r.filter((c) => typeof c === "string" && c.trim() && isNaN(Number(c))).length;
    if (score > bestScore) { best = i; bestScore = score; }
  });
  return best;
}
