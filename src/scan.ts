import { glob } from "tinyglobby";
import {
  getDtsPath,
  getCssPathFromDts,
  fileExists,
  removeFile,
  readCssFile,
  writeFileIfChanged,
  isCssModule,
} from "./utils.js";
import { generateDts } from "./generate-dts.js";
import { getClassPositions } from "./utils.js";
import { transformClassNames } from "./locals-convention.js";
import type { ResolvedOptions } from "./types.js";

export async function scanAndGenerate(root: string, options: ResolvedOptions): Promise<void> {
  const cssFiles = await glob(options.include, {
    cwd: root,
    ignore: options.exclude,
    absolute: true,
  });

  await Promise.all(cssFiles.map((file) => generateDtsForFile(file, options)));
}

export async function cleanupOrphans(root: string, options: ResolvedOptions): Promise<void> {
  const dtsPatterns = options.include.map((p) => p + ".d.ts");

  const dtsFiles = await glob(dtsPatterns, {
    cwd: root,
    ignore: options.exclude,
    absolute: true,
  });

  await Promise.all(
    dtsFiles.map(async (dtsFile) => {
      const cssFile = getCssPathFromDts(dtsFile);
      if (!(await fileExists(cssFile))) {
        await removeFile(dtsFile);
      }
    }),
  );
}

export async function generateDtsForFile(
  filePath: string,
  options: ResolvedOptions,
): Promise<void> {
  if (!isCssModule(filePath)) return;

  const css = await readCssFile(filePath);
  const classPositions = getClassPositions(css, filePath);
  const originalNames = [...classPositions.keys()];

  const { exportNames, exportToOriginal } = transformClassNames(
    originalNames,
    options.localsConvention,
  );

  const dtsContent = generateDts({
    exportNames,
    exportToOriginal,
    exportMode: options.exportMode,
    sourceMapOptions: options.declarationMap
      ? { classPositions, sourceFileName: filePath }
      : undefined,
  });

  await writeFileIfChanged(getDtsPath(filePath), dtsContent);
}
