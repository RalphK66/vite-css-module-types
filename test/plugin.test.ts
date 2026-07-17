import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { build } from "vite";
import cssModuleTypes from "../src/index.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "vite-css-module-types-"));
  await mkdir(path.join(tmpDir, "src"), { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

async function writeCSS(name: string, content: string) {
  const filePath = path.join(tmpDir, "src", name);
  await writeFile(filePath, content);
  return filePath;
}

async function readDts(name: string): Promise<string> {
  return readFile(path.join(tmpDir, "src", name + ".d.ts"), "utf-8");
}

async function runBuild(pluginOptions = {}, cssModulesOptions: Record<string, unknown> = {}) {
  await build({
    root: tmpDir,
    logLevel: "silent",
    build: {
      write: false,
      rollupOptions: { input: path.join(tmpDir, "src/entry.module.css") },
    },
    css: {
      modules: cssModulesOptions,
    },
    plugins: [cssModuleTypes(pluginOptions)],
  });
}

describe("plugin", () => {
  it("generates .d.ts during build", async () => {
    await writeCSS("entry.module.css", ".container { color: red; }\n.header { color: blue; }\n");
    await runBuild();

    const dts = await readDts("entry.module.css");
    expect(dts).toContain("declare const container: string;");
    expect(dts).toContain("declare const header: string;");
  });

  it("includes source map by default", async () => {
    await writeCSS("entry.module.css", ".title { font-size: 1rem; }\n");
    await runBuild();

    const dts = await readDts("entry.module.css");
    expect(dts).toContain("sourceMappingURL");
  });

  it("respects declarationMap: false", async () => {
    await writeCSS("entry.module.css", ".title { font-size: 1rem; }\n");
    await runBuild({ declarationMap: false });

    const dts = await readDts("entry.module.css");
    expect(dts).not.toContain("sourceMappingURL");
  });

  it("respects exportMode: named", async () => {
    await writeCSS("entry.module.css", ".title { color: red; }\n");
    await runBuild({ exportMode: "named" });

    const dts = await readDts("entry.module.css");
    expect(dts).toContain("export {");
    expect(dts).not.toContain("export default");
  });

  it("respects exportMode: default", async () => {
    await writeCSS("entry.module.css", ".title { color: red; }\n");
    await runBuild({ exportMode: "default" });

    const dts = await readDts("entry.module.css");
    expect(dts).not.toContain("export {");
    expect(dts).toContain("export default");
  });

  it("handles localsConvention: camelCaseOnly", async () => {
    await writeCSS("entry.module.css", ".input-container { padding: 8px; }\n");
    await runBuild({}, { localsConvention: "camelCaseOnly" });

    const dts = await readDts("entry.module.css");
    expect(dts).toContain("declare const inputContainer: string;");
    expect(dts).not.toContain("input-container");
  });

  it("preserves user getJSON callback", async () => {
    const collected: Record<string, string>[] = [];
    await writeCSS("entry.module.css", ".btn { cursor: pointer; }\n");

    await build({
      root: tmpDir,
      logLevel: "silent",
      build: {
        write: false,
        rollupOptions: { input: path.join(tmpDir, "src/entry.module.css") },
      },
      css: {
        modules: {
          getJSON(_file, json) {
            collected.push(json);
          },
        },
      },
      plugins: [cssModuleTypes()],
    });

    expect(collected.length).toBeGreaterThan(0);
    expect(collected[0]).toHaveProperty("btn");
  });
});
