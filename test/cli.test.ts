import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, writeFile, mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { run } from "../src/cli.js";
import { fileExists } from "../src/utils.js";

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(tmpdir(), "vite-css-module-types-cli-"));
  await mkdir(path.join(tmpDir, "src"), { recursive: true });
});

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

async function writeCSS(name: string, content: string) {
  await writeFile(path.join(tmpDir, "src", name), content);
}

async function readDts(name: string): Promise<string> {
  return readFile(path.join(tmpDir, "src", name + ".d.ts"), "utf-8");
}

describe("cli", () => {
  it("generates .d.ts files for all CSS modules", async () => {
    await writeCSS("styles.module.css", ".container { color: red; }\n.header { color: blue; }\n");
    await run(["--root", tmpDir]);

    const dts = await readDts("styles.module.css");
    expect(dts).toContain("declare const container: string;");
    expect(dts).toContain("declare const header: string;");
  });

  it("includes source maps by default", async () => {
    await writeCSS("styles.module.css", ".title { font-size: 1rem; }\n");
    await run(["--root", tmpDir]);

    const dts = await readDts("styles.module.css");
    expect(dts).toContain("sourceMappingURL");
  });

  it("generates both named and default exports by default", async () => {
    await writeCSS("styles.module.css", ".title { color: red; }\n");
    await run(["--root", tmpDir]);

    const dts = await readDts("styles.module.css");
    expect(dts).toContain("export {");
    expect(dts).toContain("export default");
  });

  it("cleans up orphaned .d.ts files", async () => {
    const orphanDts = path.join(tmpDir, "src", "deleted.module.css.d.ts");
    await writeFile(orphanDts, "declare const x: string;\n");

    await run(["--root", tmpDir]);

    expect(await fileExists(orphanDts)).toBe(false);
  });

  it("reads plugin options from vite config", async () => {
    await writeCSS("styles.module.css", ".title { color: red; }\n");
    await writeFile(
      path.join(tmpDir, "vite.config.ts"),
      `export default {
  plugins: [{
    name: "vite-css-module-types",
    _options: {
      exportMode: "named",
      declarationMap: false,
      cleanup: true,
      include: ["**/*.module.css"],
      exclude: ["node_modules/**"],
    },
  }],
};
`,
    );

    await run(["--root", tmpDir]);

    const dts = await readDts("styles.module.css");
    expect(dts).toContain("export {");
    expect(dts).not.toContain("export default");
    expect(dts).not.toContain("sourceMappingURL");
  });

  it("reads localsConvention from vite config", async () => {
    await writeCSS("styles.module.css", ".input-container { padding: 8px; }\n");
    await writeFile(
      path.join(tmpDir, "vite.config.ts"),
      `export default {
  css: { modules: { localsConvention: "camelCaseOnly" } },
};
`,
    );

    await run(["--root", tmpDir]);

    const dts = await readDts("styles.module.css");
    expect(dts).toContain("declare const inputContainer: string;");
    expect(dts).not.toContain("input-container");
  });

  it("works without a vite config using defaults", async () => {
    await writeCSS("styles.module.css", ".title { color: red; }\n");
    await run(["--root", tmpDir]);

    const dts = await readDts("styles.module.css");
    expect(dts).toContain("declare const title: string;");
  });
});
