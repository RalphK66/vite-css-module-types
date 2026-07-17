import path from "node:path";
import type { Plugin, ResolvedConfig } from "vite";
import {
  isCssModule,
  getDtsPath,
  removeFile,
  writeFileIfChanged,
  normalizePath,
  readCssFile,
} from "./utils.js";
import { generateDts } from "./generate-dts.js";
import { getClassPositions } from "./utils.js";
import { transformClassNames } from "./locals-convention.js";
import { scanAndGenerate, cleanupOrphans, generateDtsForFile } from "./scan.js";
import type { CssModulesDtsOptions, ResolvedOptions, LocalsConvention } from "./types.js";

export type { CssModulesDtsOptions };
export type { ExportMode } from "./generate-dts.js";

function resolveOptions(options: CssModulesDtsOptions = {}): ResolvedOptions {
  return {
    exportMode: options.exportMode ?? "both",
    declarationMap: options.declarationMap ?? true,
    cleanup: options.cleanup ?? true,
    include: options.include ?? ["**/*.module.css"],
    exclude: options.exclude ?? ["node_modules/**"],
  };
}

export default function cssModuleTypes(options: CssModulesDtsOptions = {}): Plugin {
  const resolved = resolveOptions(options);
  const classNamesMap = new Map<string, Record<string, string>>();
  let config: ResolvedConfig;

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

      server.httpServer?.once("listening", async () => {
        if (resolved.cleanup) {
          await cleanupOrphans(root, resolved);
        }
        await scanAndGenerate(root, resolved);
      });

      server.watcher.on("add", async (filePath) => {
        if (!isCssModule(filePath)) return;
        await generateDtsForFile(filePath, resolved);
      });

      server.watcher.on("change", async (filePath) => {
        if (!isCssModule(filePath)) return;
        await generateDtsForFile(filePath, resolved);
      });

      server.watcher.on("unlink", async (filePath) => {
        if (!isCssModule(filePath)) return;
        await removeFile(getDtsPath(filePath));
      });
    },

    async transform(_code, id) {
      const cleanId = id.split("?")[0];
      if (!isCssModule(cleanId)) return;

      const normalizedId = normalizePath(cleanId);
      const json = classNamesMap.get(normalizedId);
      if (!json) return;

      const absolutePath = path.isAbsolute(cleanId) ? cleanId : path.resolve(config.root, cleanId);

      // getJSON already has localsConvention applied by postcss-modules,
      // so the keys in json are the final export names.
      // We need to map them back to original CSS class names for source maps.
      const classPositions = new Map<string, { line: number; column: number }>();
      let exportToOriginal = new Map<string, string>();

      if (resolved.declarationMap) {
        try {
          const css = await readCssFile(absolutePath);
          const positions = getClassPositions(css, absolutePath);
          for (const [name, pos] of positions) {
            classPositions.set(name, pos);
          }

          // Build reverse mapping: getJSON keys -> original CSS class names
          const originalNames = [...positions.keys()];
          const transformed = transformClassNames(originalNames, resolved.localsConvention);
          exportToOriginal = transformed.exportToOriginal;
        } catch {}
      }

      const exportNames = Object.keys(json);
      // If we couldn't build the reverse mapping, create an identity mapping
      if (exportToOriginal.size === 0) {
        for (const name of exportNames) {
          exportToOriginal.set(name, name);
        }
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
