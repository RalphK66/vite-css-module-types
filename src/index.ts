import path from "node:path";
import { readFile } from "node:fs/promises";
import type { Plugin, ResolvedConfig } from "vite";
import {
  isCssModule,
  getDtsPath,
  removeFile,
  writeFileIfChanged,
  normalizePath,
  cleanErrorMessage,
  extractCssModuleClasses,
  ansi,
} from "./utils.js";
import { generateDts } from "./generate-dts.js";
import { transformClassNames } from "./locals-convention.js";
import { scanAndGenerate, cleanupOrphans, generateDtsForFile } from "./scan.js";
import type { CssModulesDtsOptions, ResolvedOptions, LocalsConvention, Logger } from "./types.js";

export type { CssModulesDtsOptions };
export type { ExportMode } from "./generate-dts.js";

function resolveOptions(options: CssModulesDtsOptions = {}): ResolvedOptions {
  return {
    exportMode: options.exportMode ?? "both",
    declarationMap: options.declarationMap ?? true,
    cleanup: options.cleanup ?? true,
    include: options.include ?? ["**/*.module.css"],
    exclude: options.exclude ?? ["node_modules/**"],
    silent: options.silent ?? true,
  };
}

/** Vite plugin that generates .d.ts type declarations for CSS Modules with Go-to-Definition support. */
export default function cssModuleTypes(options: CssModulesDtsOptions = {}): Plugin {
  const resolved = resolveOptions(options);
  const classNamesMap = new Map<string, Record<string, string>>();
  let config: ResolvedConfig;
  let logger: Logger;

  const plugin: Plugin & { _options: ResolvedOptions } = {
    name: "vite-css-module-types",
    enforce: "post",
    _options: resolved,

    config(userConfig) {
      const existingGetJSON = userConfig.css?.modules
        ? ((userConfig.css.modules as Record<string, unknown>).getJSON as
            | ((cssFileName: string, json: Record<string, string>, outputFileName: string) => void)
            | undefined)
        : undefined;

      return {
        css: {
          modules: {
            getJSON(cssFileName: string, json: Record<string, string>, outputFileName: string) {
              classNamesMap.set(normalizePath(cssFileName), json);
              existingGetJSON?.(cssFileName, json, outputFileName);
            },
          },
        },
      };
    },

    configResolved(resolvedConfig) {
      config = resolvedConfig;
      logger = createLogger(resolved.silent, config.logger);

      const modulesConfig = config.css?.modules;
      if (
        modulesConfig &&
        typeof modulesConfig === "object" &&
        "localsConvention" in modulesConfig
      ) {
        resolved.localsConvention = modulesConfig.localsConvention as LocalsConvention;
      }
    },

    configureServer(server) {
      const root = config.root;

      const onReady = async () => {
        if (resolved.cleanup) {
          await cleanupOrphans(root, resolved, logger);
        }
        await scanAndGenerate(root, resolved, logger);
      };

      if (server.httpServer) {
        server.httpServer.once("listening", onReady);
      } else {
        onReady();
      }

      server.watcher.on("add", async (filePath) => {
        if (!isCssModule(filePath)) return;
        await generateDtsForFile(filePath, resolved, logger, root);
      });

      server.watcher.on("change", async (filePath) => {
        if (!isCssModule(filePath)) return;
        await generateDtsForFile(filePath, resolved, logger, root);
      });

      server.watcher.on("unlink", async (filePath) => {
        if (!isCssModule(filePath)) return;
        await removeFile(getDtsPath(filePath));
        logger.info(`${ansi.red}−${ansi.r} ${path.relative(root, filePath)}`);
      });
    },

    async transform(_code, id) {
      const cleanId = id.split("?")[0];
      if (!isCssModule(cleanId)) return;

      const normalizedId = normalizePath(cleanId);
      const json = classNamesMap.get(normalizedId);
      if (!json) return;

      const absolutePath = path.isAbsolute(cleanId) ? cleanId : path.resolve(config.root, cleanId);

      let exportNames: string[];
      let exportToOriginal: Map<string, string>;
      let classPositions = new Map<string, { line: number; column: number }>();

      try {
        const css = await readFile(absolutePath, "utf-8");
        const extracted = await extractCssModuleClasses(css, absolutePath);
        classPositions = extracted.classPositions;

        const transformed = transformClassNames(extracted.exportNames, resolved.localsConvention);
        exportNames = transformed.exportNames;
        exportToOriginal = transformed.exportToOriginal;

        // Merge with getJSON to catch names from composes/other postcss-modules features
        for (const jsonKey of Object.keys(json)) {
          if (!exportToOriginal.has(jsonKey)) {
            exportNames.push(jsonKey);
            exportToOriginal.set(jsonKey, jsonKey);
          }
        }
      } catch (e) {
        logger.error(
          `${ansi.red}✗${ansi.r} ${path.relative(config.root, absolutePath)}: ${cleanErrorMessage(e, absolutePath)}`,
        );
        exportNames = Object.keys(json);
        exportToOriginal = new Map(exportNames.map((n) => [n, n]));
      }

      const dtsContent = generateDts({
        exportNames,
        exportToOriginal,
        exportMode: resolved.exportMode,
        sourceMapOptions:
          resolved.declarationMap && classPositions.size > 0
            ? { classPositions, sourceFileName: absolutePath }
            : undefined,
      });

      await writeFileIfChanged(getDtsPath(absolutePath), dtsContent);
    },
  };

  return plugin;
}

const TAG = `${ansi.cyan}[vite-css-module-types]${ansi.r}`;

function createLogger(silent: boolean, viteLogger: ResolvedConfig["logger"]): Logger {
  return {
    info: silent ? () => {} : (msg) => viteLogger.info(`${TAG} ${msg}`, { timestamp: true }),
    error: (msg) => viteLogger.error(`${TAG} ${msg}`, { timestamp: true }),
  };
}
