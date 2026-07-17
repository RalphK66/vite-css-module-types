import path from "node:path";
import { readFile } from "node:fs/promises";
import { glob } from "tinyglobby";
import {
  getDtsPath,
  getCssPathFromDts,
  fileExists,
  getMtimeMs,
  removeFile,
  writeFileIfChanged,
  isCssModule,
  cleanErrorMessage,
  extractCssModuleClasses,
  ansi,
} from "./utils.js";
import { generateDts } from "./generate-dts.js";
import { transformClassNames } from "./locals-convention.js";
import type { ResolvedOptions, Logger } from "./types.js";

const noopLogger: Logger = { info: () => {}, error: () => {} };

export async function scanAndGenerate(
  root: string,
  options: ResolvedOptions,
  logger: Logger = noopLogger,
): Promise<void> {
  const cssFiles = await glob(options.include, {
    cwd: root,
    ignore: options.exclude,
    absolute: true,
  });

  let generated = 0;
  let skipped = 0;
  let failed = 0;

  await Promise.all(
    cssFiles.map(async (file) => {
      const result = await generateDtsIfStale(file, root, options, logger);
      if (result === "written") generated++;
      else if (result === "failed") failed++;
      else skipped++;
    }),
  );

  const parts = [
    `${ansi.yellow}${generated}${ansi.r} generated`,
    `${ansi.green}${skipped}${ansi.r} up to date`,
  ];
  if (failed > 0) parts.push(`${ansi.red}${failed}${ansi.r} failed`);
  logger.info(
    `${ansi.blue}●${ansi.r} scanned ${cssFiles.length} CSS modules (${parts.join(", ")})`,
  );
}

export async function cleanupOrphans(
  root: string,
  options: ResolvedOptions,
  logger: Logger = noopLogger,
): Promise<void> {
  const dtsPatterns = options.include.map((p) => p + ".d.ts");

  const dtsFiles = await glob(dtsPatterns, {
    cwd: root,
    ignore: options.exclude,
    absolute: true,
  });

  let removed = 0;

  await Promise.all(
    dtsFiles.map(async (dtsFile) => {
      const cssFile = getCssPathFromDts(dtsFile);
      if (!(await fileExists(cssFile))) {
        await removeFile(dtsFile);
        removed++;
      }
    }),
  );

  if (removed > 0) {
    logger.info(
      `${ansi.red}−${ansi.r} cleaned up ${removed} orphaned .d.ts file${removed === 1 ? "" : "s"}`,
    );
  }
}

type StaleResult = "written" | "skipped" | "failed";

async function generateDtsIfStale(
  filePath: string,
  root: string,
  options: ResolvedOptions,
  logger: Logger,
): Promise<StaleResult> {
  if (!isCssModule(filePath)) return "skipped";

  const dtsPath = getDtsPath(filePath);
  const [cssMtime, dtsMtime] = await Promise.all([getMtimeMs(filePath), getMtimeMs(dtsPath)]);

  if (!cssMtime) return "skipped";
  if (dtsMtime && dtsMtime >= cssMtime) return "skipped";

  const written = await generateDtsForFile(filePath, options, logger, root);
  return written ? "written" : "failed";
}

export async function generateDtsForFile(
  filePath: string,
  options: ResolvedOptions,
  logger: Logger = noopLogger,
  root?: string,
): Promise<boolean> {
  if (!isCssModule(filePath)) return false;

  const displayPath = root ? path.relative(root, filePath) : filePath;

  let css: string;
  try {
    css = await readFile(filePath, "utf-8");
  } catch (e) {
    logger.error(`${ansi.red}✗${ansi.r} ${displayPath}: ${cleanErrorMessage(e, filePath)}`);
    return false;
  }

  let extractedNames: string[];
  let classPositions: Map<string, { line: number; column: number }>;
  try {
    const extracted = await extractCssModuleClasses(css, filePath);
    extractedNames = extracted.exportNames;
    classPositions = extracted.classPositions;
  } catch (e) {
    logger.error(`${ansi.red}✗${ansi.r} ${displayPath}: ${cleanErrorMessage(e, filePath)}`);
    return false;
  }

  const { exportNames, exportToOriginal } = transformClassNames(
    extractedNames,
    options.localsConvention,
  );

  const dtsContent = generateDts({
    exportNames,
    exportToOriginal,
    exportMode: options.exportMode,
    sourceMapOptions:
      options.declarationMap && classPositions.size > 0
        ? { classPositions, sourceFileName: filePath }
        : undefined,
  });

  const written = await writeFileIfChanged(getDtsPath(filePath), dtsContent);
  if (written) {
    logger.info(`${ansi.green}✓${ansi.r} ${displayPath}`);
  }
  return true;
}
