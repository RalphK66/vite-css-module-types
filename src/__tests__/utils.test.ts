import { describe, it, expect } from "vitest";
import {
  isCssModule,
  getDtsPath,
  getCssPathFromDts,
  slash,
  normalizePath,
  makeLegalIdentifier,
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

describe("slash", () => {
  it("converts backslashes to forward slashes", () => {
    expect(slash("src\\styles\\app.css")).toBe("src/styles/app.css");
  });

  it("leaves forward slashes unchanged", () => {
    expect(slash("src/styles/app.css")).toBe("src/styles/app.css");
  });
});

describe("normalizePath", () => {
  it("normalizes and slashes a path", () => {
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
