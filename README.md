# vite-css-module-types

A [Vite](https://vite.dev) plugin that generates `.d.ts` type declarations for CSS Modules with Go-to-Definition support. Click a class name in your TypeScript &mdash; land in the CSS.

## Why this exists

Vite handles CSS Modules at runtime but doesn't generate TypeScript types for them. Without types, you get no autocomplete, no type errors for misspelled class names, and `Cmd+click` goes nowhere useful.

Most existing solutions either parse your CSS independently (out of sync with your actual Vite config), only work inside the IDE with no build-time safety, or replace Vite's entire CSS Modules pipeline just to add types.

This plugin takes a different approach. It hooks into Vite's own CSS pipeline via the `getJSON` callback &mdash; the same data Vite already computes &mdash; and generates `.d.ts` files from it. No separate parsing, no monkey-patching Vite internals, no replacing how your CSS gets processed. It also ships a standalone CLI for generating types in CI without running a Vite build.

## Install

```bash
npm install -D vite-css-module-types
```

## Usage

### Vite plugin

```ts
// vite.config.ts
import { defineConfig } from "vite";
import cssModuleTypes from "vite-css-module-types";

export default defineConfig({
  plugins: [cssModuleTypes()],
});
```

That's it. The plugin generates `.d.ts` files for every `.module.css` file in your project.

### CLI

Generate types without running a Vite dev server or build &mdash; useful for CI type-checking.

```bash
npx vite-css-module-types
```

The CLI reads all configuration from your `vite.config.ts` automatically &mdash; plugin options, `localsConvention`, include/exclude patterns. No flags to duplicate.

```bash
# Run from a different root directory
npx vite-css-module-types --root ./packages/app
```

## What it does

- **Startup scan** &mdash; generates `.d.ts` files for all existing CSS modules when the dev server starts
- **Watch mode** &mdash; creates, updates, and removes `.d.ts` files as you add, edit, and delete CSS modules
- **Orphan cleanup** &mdash; removes stale `.d.ts` files on startup when their CSS source no longer exists
- **Build support** &mdash; generates `.d.ts` files during `vite build`
- **Go-to-Definition** &mdash; Cmd/Ctrl+click a class name in TypeScript and jump straight to the CSS source, not the `.d.ts` file
- **localsConvention** &mdash; respects Vite's `css.modules.localsConvention` setting (`camelCase`, `camelCaseOnly`, `dashes`, `dashesOnly`)

## Example

Given `button.module.css`:

```css
.container {
  display: flex;
}

.primary-button {
  background: blue;
}
```

The plugin generates `button.module.css.d.ts`:

```ts
declare const container: string;
declare const primaryButton: string;

export { container, primaryButton as "primary-button" };

declare const __default_export__: {
  container: typeof container;
  "primary-button": typeof primaryButton;
};
export default __default_export__;
```

With an inline source map so Go-to-Definition navigates to the CSS file.

## Options

### Plugin options

```ts
cssModuleTypes({
  // Which exports to generate: 'named' | 'default' | 'both'
  // Default: 'both'
  exportMode: "both",

  // Generate source maps for Go-to-Definition
  // Default: true
  declarationMap: true,

  // Remove orphaned .d.ts files on startup
  // Default: true
  cleanup: true,

  // Glob patterns to include
  // Default: ['**/*.module.css']
  include: ["**/*.module.css"],

  // Glob patterns to exclude
  // Default: ['node_modules/**']
  exclude: ["node_modules/**"],
});
```

### CLI options

```
--root <dir>    Project root directory (default: cwd)
-h, --help      Show this help message
```

All other options are read from your Vite config.

## Works with localsConvention

If you use kebab-case in CSS but camelCase in JS:

```ts
// vite.config.ts
export default defineConfig({
  css: {
    modules: {
      localsConvention: "camelCaseOnly",
    },
  },
  plugins: [cssModuleTypes()],
});
```

```css
/* styles.module.css */
.input-container {
  padding: 8px;
}
```

```ts
// Component.tsx
import styles from "./styles.module.css";

// Autocomplete gives you: styles.inputContainer
```

## Formatter configuration

The generated `.d.ts` files are machine-written and should be excluded from your formatter. Add `**/*.module.css.d.ts` to your ignore configuration:

**Prettier** (`.prettierignore`):

```
**/*.module.css.d.ts
```

**oxfmt** (`oxfmt.json` or `package.json`):

```json
{
  "ignorePatterns": ["**/*.module.css.d.ts"]
}
```

**Biome** (`biome.json`):

```json
{
  "files": {
    "ignore": ["**/*.module.css.d.ts"]
  }
}
```

## Requirements

- Vite 8
- PostCSS transformer (Vite's default)

## License

MIT
