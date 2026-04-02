import * as esbuild from 'esbuild';
import { readFileSync } from 'fs';

const isWatch = process.argv.includes('--watch');
const isProduction = process.env.NODE_ENV === 'production';

/** Shared build options */
const shared = {
  bundle: true,
  sourcemap: true,
  minify: isProduction,
  logLevel: 'info',
};

/** Extension host bundle -- CJS for VS Code's Node.js process */
const extensionConfig = {
  ...shared,
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  external: ['vscode'],
};

/** Webview bundle -- ESM for the browser-based webview iframe */
const webviewConfig = {
  ...shared,
  entryPoints: ['webview/drain-template-viewer/index.ts'],
  outfile: 'dist/webview-drain.js',
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
};

/**
 * Format bytes into human-readable string.
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

/**
 * Report build output sizes.
 */
function reportSizes(label, outfile) {
  try {
    const stat = readFileSync(outfile);
    console.log(`  ${label}: ${outfile} (${formatSize(stat.length)})`);
  } catch {
    // File may not exist yet during watch initialization
  }
}

async function build() {
  const start = Date.now();

  if (isWatch) {
    // Use esbuild context API for incremental rebuilds
    const [extCtx, webCtx] = await Promise.all([
      esbuild.context(extensionConfig),
      esbuild.context(webviewConfig),
    ]);

    await Promise.all([extCtx.watch(), webCtx.watch()]);

    console.log('[watch] Watching for changes...');
  } else {
    // Single build
    await Promise.all([
      esbuild.build(extensionConfig),
      esbuild.build(webviewConfig),
    ]);

    const elapsed = Date.now() - start;

    console.log(`\nBuild complete in ${elapsed}ms${isProduction ? ' (production)' : ''}`);
    reportSizes('Extension host (CJS)', 'dist/extension.js');
    reportSizes('Webview (ESM)', 'dist/webview-drain.js');

    if (elapsed < 1000) {
      console.log('\nBuild completed in under 1 second.');
    }
  }
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
