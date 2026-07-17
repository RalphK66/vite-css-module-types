import { readFile, writeFile, unlink, stat } from "node:fs/promises";
import path from "node:path";
import { cssClassPositions } from "css-class-positions";

// ECMAScript reserved words — spec-defined, essentially frozen
const RESERVED = new Set([
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "finally",
  "for",
  "function",
  "if",
  "implements",
  "import",
  "in",
  "instanceof",
  "interface",
  "let",
  "new",
  "package",
  "private",
  "protected",
  "public",
  "return",
  "static",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

export const CSS_MODULE_RE = /\.module\.css$/;

export const DTS_RE = /\.module\.css\.d\.ts$/;

export function isCssModule(filePath: string): boolean {
  return CSS_MODULE_RE.test(filePath);
}

export function getDtsPath(cssPath: string): string {
  return cssPath + ".d.ts";
}

export function getCssPathFromDts(dtsPath: string): string {
  return dtsPath.replace(/\.d\.ts$/, "");
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function writeFileIfChanged(filePath: string, content: string): Promise<boolean> {
  try {
    const existing = await readFile(filePath, "utf-8");
    if (existing === content) return false;
  } catch {}
  await writeFile(filePath, content, "utf-8");
  return true;
}

export async function removeFile(filePath: string): Promise<boolean> {
  try {
    await unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readCssFile(filePath: string): Promise<string> {
  return readFile(filePath, "utf-8");
}

export function slash(filePath: string): string {
  return filePath.replace(/\\/g, "/");
}

export function normalizePath(filePath: string): string {
  return slash(path.normalize(filePath));
}

export function makeLegalIdentifier(str: string): string {
  let id = str
    .replace(/-(\w)/g, (_, letter) => letter.toUpperCase())
    .replace(/[^$_a-zA-Z0-9]/g, "_");
  if (!id || /\d/.test(id[0]) || RESERVED.has(id)) {
    id = `_${id}`;
  }
  return id || "_";
}

export function getClassPositions(
  css: string,
  fileName: string,
): Map<string, { line: number; column: number }> {
  return cssClassPositions(css, { fileName });
}
