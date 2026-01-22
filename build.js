import esbuild from 'esbuild';
import { readdir, mkdir, copyFile, stat, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isWatch = process.argv.includes('--watch');

// Load environment variables from .env.local if it exists
const loadEnvFile = async () => {
  try {
    const envContent = await readFile('.env.local', 'utf-8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = value;
          }
        }
      }
    }
  } catch (error) {
    // .env.local doesn't exist, that's fine
  }
};

await loadEnvFile();

const baseBuildOptions = {
  bundle: true,
  platform: 'browser',
  target: 'es2020',
  sourcemap: true,
  minify: !isWatch,
  logLevel: 'info',
};

const buildServiceWorker = async () => {
  // Bundle service worker as single ESM file with all dependencies
  await esbuild.build({
    ...baseBuildOptions,
    entryPoints: ['src/background/service-worker.ts'],
    outfile: 'dist/background/service-worker.js',
    format: 'esm',
    define: {
      'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL || ''),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY || ''),
      'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
      '__ENABLE_LOGS__': isWatch ? 'true' : 'false', // Disable logs in production
    },
  });
};

const buildContentScript = async () => {
  await esbuild.build({
    ...baseBuildOptions,
    entryPoints: ['src/content/content-main.ts'],
    outfile: 'dist/content/content-main.js',
    format: 'iife',
    globalName: 'StopSlopContent',
    define: {
      'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
      '__ENABLE_LOGS__': isWatch ? 'true' : 'false', // Disable logs in production
    },
  });
};

const buildPopup = async () => {
  await esbuild.build({
    ...baseBuildOptions,
    entryPoints: ['src/popup/popup.ts'],
    outfile: 'dist/popup.js',
    format: 'iife',
    define: {
      'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
      '__ENABLE_LOGS__': isWatch ? 'true' : 'false', // Disable logs in production
    },
  });
};

const copyManifest = async () => {
  // Read manifest and fix paths for dist folder
  const manifestContent = await readFile('manifest.json', 'utf-8');
  const manifest = JSON.parse(manifestContent);
  
  // Fix paths - remove 'dist/' prefix since dist is the root
  if (manifest.background?.service_worker) {
    manifest.background.service_worker = manifest.background.service_worker.replace(/^dist\//, '');
  }
  
  if (manifest.content_scripts) {
    manifest.content_scripts.forEach((script) => {
      if (script.js) {
        script.js = script.js.map(path => path.replace(/^dist\//, ''));
      }
      if (script.css) {
        script.css = script.css.map(path => path.replace(/^dist\//, ''));
      }
    });
  }
  
  if (manifest.action?.default_popup) {
    manifest.action.default_popup = manifest.action.default_popup.replace(/^dist\//, '');
  }
  
  // Remove icons if they don't exist
  try {
    await stat('icons/icon16.png');
  } catch {
    // Icons don't exist, remove them from manifest
    delete manifest.icons;
  }
  
  // Write fixed manifest
  await mkdir('dist', { recursive: true });
  await writeFile('dist/manifest.json', JSON.stringify(manifest, null, 2));
};

const copyCSS = async () => {
  await mkdir('dist/content', { recursive: true });
  await copyFile('src/content/content.css', 'dist/content/content.css');
};

const copyPopup = async () => {
  await copyFile('popup.html', 'dist/popup.html');
};

const build = async () => {
  console.log('Building Stop-Slop extension...');

  try {
    await mkdir('dist/background', { recursive: true });
    await mkdir('dist/content', { recursive: true });

    await buildServiceWorker();
    await buildContentScript();
    await buildPopup();
    await copyManifest();
    await copyCSS();
    await copyPopup();

    console.log('Build complete!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
};

if (isWatch) {
  console.log('Watching for changes...');
  // Watch mode: rebuild everything on file changes
  const watchAndRebuild = async () => {
    await build();
  };
  
  // Initial build
  await watchAndRebuild();
  
  // Set up file watchers (simplified - in production you might want to use chokidar)
  console.log('Watching for changes... (Press Ctrl+C to stop)');
  // Note: For a more robust watch mode, consider using chokidar or similar
} else {
  await build();
}
