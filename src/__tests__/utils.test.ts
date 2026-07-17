import { describe, it, expect } from "vitest";
import {
  isCssModule,
  getDtsPath,
  getCssPathFromDts,
  normalizePath,
  makeLegalIdentifier,
  cleanErrorMessage,
  extractCssModuleClasses,
} from "../utils.js";

describe("isCssModule", () => {
  it("matches .module.css files", () => {
    expect(isCssModule("styles.module.css")).toBe(true);
    expect(isCssModule("/src/app.module.css")).toBe(true);
  });

  it("rejects non-module CSS files", () => {
    expect(isCssModule("styles.css")).toBe(false);
    expect(isCssModule("styles.module.scss")).toBe(false);
    expect(isCssModule("module.css")).toBe(false);
  });
});

describe("getDtsPath", () => {
  it("appends .d.ts to CSS module path", () => {
    expect(getDtsPath("/src/styles.module.css")).toBe("/src/styles.module.css.d.ts");
  });
});

describe("getCssPathFromDts", () => {
  it("strips .d.ts suffix", () => {
    expect(getCssPathFromDts("/src/styles.module.css.d.ts")).toBe("/src/styles.module.css");
  });
});

describe("normalizePath", () => {
  it("normalizes and converts backslashes", () => {
    expect(normalizePath("/src/./styles/../styles/app.css")).toBe("/src/styles/app.css");
  });
});

describe("makeLegalIdentifier", () => {
  it("converts dashed names to camelCase", () => {
    expect(makeLegalIdentifier("my-class")).toBe("myClass");
  });

  it("replaces invalid chars with underscore", () => {
    expect(makeLegalIdentifier("hello world!")).toBe("hello_world_");
  });

  it("prefixes reserved words", () => {
    expect(makeLegalIdentifier("class")).toBe("_class");
    expect(makeLegalIdentifier("import")).toBe("_import");
  });

  it("prefixes digit-leading identifiers", () => {
    expect(makeLegalIdentifier("1foo")).toBe("_1foo");
  });

  it("returns underscore for empty string", () => {
    expect(makeLegalIdentifier("")).toBe("_");
  });
});

describe("cleanErrorMessage", () => {
  it("strips absolute path prefix from error message", () => {
    const err = new Error("/Users/me/project/styles.module.css:28:5: Unknown word");
    expect(cleanErrorMessage(err, "/Users/me/project/styles.module.css")).toBe(
      "28:5: Unknown word",
    );
  });

  it("handles non-Error values", () => {
    expect(cleanErrorMessage("some string error", "/a/b.css")).toBe("some string error");
  });
});

describe("extractCssModuleClasses", () => {
  it("extracts basic class names", async () => {
    const { exportNames, classPositions } = await extractCssModuleClasses(
      ".sidebar { color: red; } .header { color: blue; }",
      "test.module.css",
    );
    expect(exportNames).toContain("sidebar");
    expect(exportNames).toContain("header");
    expect(classPositions.has("sidebar")).toBe(true);
    expect(classPositions.has("header")).toBe(true);
  });

  it("resolves &-something nesting", async () => {
    const css = ".sidebar { overflow: auto; &-header { color: red; } &-footer { color: blue; } }";
    const { exportNames } = await extractCssModuleClasses(css, "test.module.css");
    expect(exportNames).toContain("sidebar");
    expect(exportNames).toContain("sidebar-header");
    expect(exportNames).toContain("sidebar-footer");
  });

  it("resolves deep nesting", async () => {
    const css = ".a { display: block; &-b { display: flex; &-c { color: red; } } }";
    const { exportNames } = await extractCssModuleClasses(css, "test.module.css");
    expect(exportNames).toContain("a");
    expect(exportNames).toContain("a-b");
    expect(exportNames).toContain("a-b-c");
  });

  it("finds classes inside @media", async () => {
    const css = "@media (max-width: 768px) { .mobile-only { color: red; } }";
    const { exportNames } = await extractCssModuleClasses(css, "test.module.css");
    expect(exportNames).toContain("mobile-only");
  });

  it("finds classes inside @layer, @supports, @container", async () => {
    const css = [
      "@layer base { .layered { color: red; } }",
      "@supports (display: grid) { .grid-only { color: red; } }",
      "@container (min-width: 400px) { .container-child { color: red; } }",
    ].join("\n");
    const { exportNames } = await extractCssModuleClasses(css, "test.module.css");
    expect(exportNames).toContain("layered");
    expect(exportNames).toContain("grid-only");
    expect(exportNames).toContain("container-child");
  });

  it("excludes :global() classes from exports", async () => {
    const css = ":global(.external) { color: red; } .local { color: blue; }";
    const { exportNames } = await extractCssModuleClasses(css, "test.module.css");
    expect(exportNames).not.toContain("external");
    expect(exportNames).toContain("local");
  });

  it("returns empty for CSS with no classes", async () => {
    const { exportNames } = await extractCssModuleClasses("h1 { color: red; }", "test.module.css");
    expect(exportNames).toEqual([]);
  });

  it("handles selector lists with nesting", async () => {
    const css = ".foo, .bar { display: block; &-baz { color: red; } }";
    const { exportNames } = await extractCssModuleClasses(css, "test.module.css");
    expect(exportNames).toContain("foo");
    expect(exportNames).toContain("bar");
    expect(exportNames).toContain("foo-baz");
    expect(exportNames).toContain("bar-baz");
  });

  it("handles unicode class names", async () => {
    const css = ".über { color: red; } .café { color: blue; }";
    const { classPositions } = await extractCssModuleClasses(css, "test.module.css");
    expect(classPositions.has("über")).toBe(true);
    expect(classPositions.has("café")).toBe(true);
  });

  it("reports correct source positions", async () => {
    const css = `.sidebar {\n  overflow: auto;\n  &-header {\n    color: red;\n  }\n}`;
    const { classPositions } = await extractCssModuleClasses(css, "test.module.css");
    expect(classPositions.get("sidebar")).toEqual({ line: 1, column: 1 });
    expect(classPositions.get("sidebar-header")).toEqual({ line: 3, column: 3 });
  });
});
