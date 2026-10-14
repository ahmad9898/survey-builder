/// <reference types="vitest/config" />
import { defineConfig, esmExternalRequirePlugin } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { fileURLToPath } from 'node:url';

const externalPeerDeps = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  /^@mui\/material/,
  /^@mui\/icons-material/,
  /^@emotion\/react/,
  /^@emotion\/styled/,
  /^@emotion\/cache/,
];

// Library mode: ESM output + generated .d.ts, with React/MUI/Emotion left as
// peer dependencies (external) so the host app's own copies are used instead
// of bundling a second one.
export default defineConfig({
  plugins: [
    react(),
    // Bundled CJS deps (zustand's use-sync-external-store shim, etc.) call
    // require('react') internally. Rolldown leaves literal require() calls
    // to externalized modules alone by default, which crashes in the browser
    // (no `require`) -- this plugin rewrites those specific calls into real
    // ESM imports instead. See https://rolldown.rs/in-depth/bundling-cjs.
    esmExternalRequirePlugin({ external: externalPeerDeps }),
    dts({
      include: ['src'],
      // Flattens dist/src/** to dist/** (so "types": "./dist/index.d.ts" in
      // package.json resolves) without going through the rollupTypes/API
      // Extractor path, which silently produced near-empty output against
      // this repo's TypeScript 6 -- see the build investigation in the repo
      // history if that's revisited.
      entryRoot: 'src',
      tsconfigPath: './tsconfig.app.json',
    }),
  ],
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'survey-builder-kit.js',
    },
    rollupOptions: {
      // externalPeerDeps is declared to esmExternalRequirePlugin above, not
      // here -- that plugin must exclusively own which externals it converts
      // require() calls for (duplicating the list here makes it skip them).
      output: {
        // Static name so package.json's "./style.css" export subpath (for the
        // one static stylesheet we ship -- React Flow's own CSS, which isn't
        // covered by the Emotion CSS-in-JS the rest of the library injects
        // at runtime) resolves to a predictable file.
        assetFileNames: 'style.css',
      },
    },
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
