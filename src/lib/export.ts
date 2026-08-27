import "server-only";
import ExcelJS from "exceljs";

export interface ExportSheet {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
}

// セルの値が =, +, -, @, タブ、改行 で始まる場合、Excel/LibreOffice等は
// それを数式として評価してしまう（CSVインジェクション / 数式インジェクション）。
// カテゴリー名・商品名・設置場所名は招待コードで登録した任意のスタッフが
// 自由に入力できるため、先頭にシングルクォートを足して文字列として固定する。
const FORMULA_TRIGGER_PATTERN = /^[=+\-@\t\r]/;

function sanitizeForSpreadsheet(s: string): string {
  return FORMULA_TRIGGER_PATTERN.test(s) ? `'${s}` : s;
}

function csvCell(value: string | number | null): string {
  if (value == null) return "";
  const s = typeof value === "string" ? sanitizeForSpreadsheet(value) : String(value);
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
    for (const row of sheet.rows) {
      ws.addRow(row.map((cell) => (typeof cell === "string" ? sanitizeForSpreadsheet(cell) : cell)));
    }
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
