import { encode, type SourceMapSegment } from "@jridgewell/sourcemap-codec";
import path from "node:path";
import type { ClassPosition } from "./types.js";

interface SourceMapOptions {
  dtsLines: DtsLine[];
  classPositions: Map<string, ClassPosition>;
  sourceFileName: string;
  headerLineCount: number;
}

export interface DtsLine {
  text: string;
  mapping?: {
    className: string;
    column: number;
  };
}

export function buildDtsSourceMap(options: SourceMapOptions): string {
  const { dtsLines, classPositions, sourceFileName, headerLineCount } = options;
  const mappings: SourceMapSegment[][] = [];

  for (let i = 0; i < dtsLines.length; i++) {
    const line = dtsLines[i];

    if (i < headerLineCount || !line.mapping) {
      mappings.push([]);
      continue;
    }

    const pos = classPositions.get(line.mapping.className);
    if (!pos) {
      mappings.push([]);
      continue;
    }

    mappings.push([[line.mapping.column, 0, pos.line - 1, pos.column - 1]]);
  }

  const sourceMap = {
    version: 3,
    file: path.basename(sourceFileName) + ".d.ts",
    sources: [path.basename(sourceFileName)],
    names: [] as string[],
    mappings: encode(mappings),
  };

  const json = JSON.stringify(sourceMap);
  const base64 = Buffer.from(json).toString("base64");
  return `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${base64}`;
}
