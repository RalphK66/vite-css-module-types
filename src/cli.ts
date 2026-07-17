import { parseArgs } from "node:util";
import path from "node:path";
import { loadConfigFromFile } from "vite";
import { scanAndGenerate, cleanupOrphans } from "./scan.js";
import type { ResolvedOptions, LocalsConvention } from "./types.js";

const PLUGIN_NAME = "vite-css-module-types";

function printHelp() {
  console.log(`Usage: vite-css-module-types [options]

Generate .d.ts type declarations for CSS Modules.
Reads configuration from your vite.config.ts automatically.

Options:
  --root <dir>    Project root directory (default: cwd)
  -h, --help      Show this help message`);
}

export async function run(argv: string[] = process.argv.slice(2)): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      root: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
    strict: true,
  });

  if (values.help) {
    printHelp();
    return;
  }

  const root = path.resolve(values.root ?? process.cwd());

  const options = await loadOptionsFromConfig(root);

  if (options.cleanup) {
    await cleanupOrphans(root, options);
  }

  await scanAndGenerate(root, options);
}

async function loadOptionsFromConfig(root: string): Promise<ResolvedOptions> {
  const defaults: ResolvedOptions = {
    exportMode: "both",
    declarationMap: true,
    cleanup: true,
    include: ["**/*.module.css"],
    exclude: ["node_modules/**"],
  };

  let config;
  try {
    config = await loadConfigFromFile({ command: "serve", mode: "development" }, undefined, root);
  } catch {
    return defaults;
  }

  if (!config) return defaults;

  const userConfig = config.config;

  const modulesConfig = userConfig.css?.modules;
  if (modulesConfig && typeof modulesConfig === "object" && "localsConvention" in modulesConfig) {
    defaults.localsConvention = modulesConfig.localsConvention as LocalsConvention;
  }

  const plugins = (userConfig.plugins ?? []).flat();
  for (const plugin of plugins) {
    if (plugin && typeof plugin === "object" && "name" in plugin && plugin.name === PLUGIN_NAME) {
      const pluginWithMeta = plugin as Record<string, unknown>;
      const pluginOptions = pluginWithMeta._options as Partial<ResolvedOptions> | undefined;
      if (pluginOptions) {
        return {
          ...defaults,
          ...pluginOptions,
          localsConvention: defaults.localsConvention,
        };
      }
    }
  }

  return defaults;
}
