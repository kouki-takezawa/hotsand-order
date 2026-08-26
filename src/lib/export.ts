import "server-only";
import ExcelJS from "exceljs";

export interface ExportSheet {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
}

function csvCell(value: string | number | null): string {
  if (value == null) return "";
  const s = String(value);
  // カンマ・改行・ダブルクォートを含む場合はダブルクォートで囲む（RFC 4180）
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Excelで文字化けしないよう、CSVの先頭にUTF-8のBOMを付与する。
const BOM = "﻿";

export function toCsv(sheet: ExportSheet): string {
  const lines = [sheet.headers.map(csvCell).join(","), ...sheet.rows.map((row) => row.map(csvCell).join(","))];
  return BOM + lines.join("\r\n");
}

export async function toXlsxBlob(sheets: ExportSheet[]): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name.slice(0, 31));
    ws.addRow(sheet.headers);
    ws.getRow(1).font = { bold: true };
    for (const row of sheet.rows) ws.addRow(row);
    ws.columns.forEach((col) => {
      let max = 10;
      col.eachCell?.({ includeEmpty: true }, (cell) => {
        const len = String(cell.value ?? "").length;
        if (len > max) max = len;
      });
      col.width = Math.min(max + 2, 40);
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function encodeFilename(filename: string): string {
  return `filename="export.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export function csvResponseHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; ${encodeFilename(filename)}`,
  };
}

export function xlsxResponseHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; ${encodeFilename(filename)}`,
  };
}
