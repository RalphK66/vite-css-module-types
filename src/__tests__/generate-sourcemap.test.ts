import { describe, it, expect } from "vitest";
import { buildDtsSourceMap, type DtsLine } from "../generate-sourcemap.js";

describe("buildDtsSourceMap", () => {
  it("generates a valid source map data URI", () => {
    const dtsLines: DtsLine[] = [
      { text: "/* header */" },
      { text: "" },
      {
        text: "declare const container: string;",
        mapping: { className: "container", column: 14 },
      },
    ];

    const classPositions = new Map([["container", { line: 2, column: 1 }]]);

    const result = buildDtsSourceMap({
      dtsLines,
      classPositions,
      sourceFileName: "styles.module.css",
      headerLineCount: 2,
    });

    expect(result).toMatch(/^\/\/# sourceMappingURL=data:application\/json;charset=utf-8;base64,/);

    const base64 = result.split("base64,")[1];
    const json = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));

    expect(json.version).toBe(3);
    expect(json.sources).toEqual(["styles.module.css"]);
    expect(json.names).toEqual([]);
    expect(json.mappings).toBeTruthy();
  });

  it("produces empty mappings for header lines", () => {
    const dtsLines: DtsLine[] = [
      { text: "/* line 1 */" },
      { text: "/* line 2 */" },
      {
        text: "declare const x: string;",
        mapping: { className: "x", column: 14 },
      },
    ];

    const classPositions = new Map([["x", { line: 1, column: 1 }]]);

    const result = buildDtsSourceMap({
      dtsLines,
      classPositions,
      sourceFileName: "test.module.css",
      headerLineCount: 2,
    });

    const base64 = result.split("base64,")[1];
    const json = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));

    const mappingLines = json.mappings.split(";");
    expect(mappingLines[0]).toBe("");
    expect(mappingLines[1]).toBe("");
    expect(mappingLines[2]).not.toBe("");
  });

  it("skips mappings for classes not in classPositions", () => {
    const dtsLines: DtsLine[] = [
      {
        text: "declare const missing: string;",
        mapping: { className: "missing", column: 14 },
      },
    ];

    const classPositions = new Map<string, { line: number; column: number }>();

    const result = buildDtsSourceMap({
      dtsLines,
      classPositions,
      sourceFileName: "test.module.css",
      headerLineCount: 0,
    });

    const base64 = result.split("base64,")[1];
    const json = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));

    expect(json.mappings).toBe("");
  });
});
