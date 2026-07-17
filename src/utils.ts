import { readFile, writeFile, unlink, stat, utimes } from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import postcssModules from "postcss-modules";
import postcssNested from "postcss-nested";

export { readFile };

export const ansi = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  r: "\x1b[0m",
};

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

const CSS_MODULE_RE = /\.module\.css$/;

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

export async function getMtimeMs(filePath: string): Promise<number | null> {
  try {
    const s = await stat(filePath);
    return s.mtimeMs;
  } catch {
    return null;
  }
}

export async function writeFileIfChanged(filePath: string, content: string): Promise<boolean> {
  try {
    const existing = await readFile(filePath, "utf-8");
    if (existing === content) {
      await touchFile(filePath);
      return false;
    }
  } catch {}
  await writeFile(filePath, content, "utf-8");
  return true;
}

async function touchFile(filePath: string): Promise<void> {
  const now = new Date();
  await utimes(filePath, now, now);
}

export async function removeFile(filePath: string): Promise<boolean> {
  try {
    await unlink(filePath);
    return true;
  } catch {
    return false;
  }
}

export function normalizePath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, "/");
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

export function cleanErrorMessage(error: unknown, filePath: string): string {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.replaceAll(filePath + ":", "");
}

/** Extracts class names and their source positions from a CSS module using postcss-modules. */
export async function extractCssModuleClasses(
  css: string,
  fileName: string,
): Promise<{
  exportNames: string[];
  classPositions: Map<string, { line: number; column: number }>;
}> {
  let moduleExports: Record<string, string> = {};

  const result = await postcss([
    postcssNested(),
    postcssModules({
      getJSON(_, json) {
        moduleExports = json;
      },
      generateScopedName: "[local]",
    }),
  ]).process(css, { from: fileName });

  const classPositions = new Map<string, { line: number; column: number }>();
  const classRe = /\.([\p{Alpha}_][\p{Alpha}\p{N}_-]*)/gu;
  result.root.walkRules((rule) => {
    classRe.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = classRe.exec(rule.selector)) !== null) {
      const className = match[1];
      if (!classPositions.has(className) && rule.source?.start) {
        classPositions.set(className, {
          line: rule.source.start.line,
          column: rule.source.start.column,
        });
      }
    }
  });

  return { exportNames: Object.keys(moduleExports), classPositions };
}
