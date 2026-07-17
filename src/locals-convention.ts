import type { CSSModulesOptions } from "vite";

export type LocalsConventionFunction = (originalClassName: string) => string;

type LocalsConvention = NonNullable<CSSModulesOptions["localsConvention"]>;

function camelCase(str: string): string {
  return str
    .replace(/^[_.\- ]+/, "")
    .replace(/[_.\- ]+([\p{Alpha}\p{N}_]|$)/gu, (_, ch) => ch.toUpperCase())
    .replace(/^[\p{Lu}]/u, (ch) => ch.toLowerCase());
}

function dashesCamelCase(str: string): string {
  return str.replaceAll(/-+(\w)/g, (_, ch) => ch.toUpperCase());
}

export function getTransformFn(
  localsConvention: LocalsConvention | undefined,
): LocalsConventionFunction | undefined {
  if (!localsConvention || typeof localsConvention === "function") return undefined;
  if (localsConvention === "camelCase" || localsConvention === "camelCaseOnly") return camelCase;
  if (localsConvention === "dashes" || localsConvention === "dashesOnly") return dashesCamelCase;
  return undefined;
}

export function shouldKeepOriginal(localsConvention: LocalsConvention | undefined): boolean {
  if (!localsConvention) return true;
  if (typeof localsConvention === "function") return false;
  return localsConvention !== "camelCaseOnly" && localsConvention !== "dashesOnly";
}

export function transformClassNames(
  originalNames: string[],
  localsConvention: LocalsConvention | undefined,
): { exportNames: string[]; exportToOriginal: Map<string, string> } {
  const transformFn = getTransformFn(localsConvention);
  const keepOriginal = shouldKeepOriginal(localsConvention);
  const exportToOriginal = new Map<string, string>();
  const exportNames: string[] = [];

  for (const name of originalNames) {
    if (keepOriginal && !exportToOriginal.has(name)) {
      exportNames.push(name);
      exportToOriginal.set(name, name);
    }

    if (transformFn) {
      const transformed = transformFn(name);
      if (!exportToOriginal.has(transformed)) {
        exportNames.push(transformed);
        exportToOriginal.set(transformed, name);
      }
    }
  }

  return { exportNames, exportToOriginal };
}
