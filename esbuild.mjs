import esbuild from 'esbuild';
import fs from 'fs-extra'; // Using fs-extra for easier file operations like copying
import path from 'path';

const isProduction = process.env.NODE_ENV === 'production';
const outDir = 'dist/pwa';

async function build() {
    try {
        // Clean the output directory
        await fs.emptyDir(outDir);
        console.log(`Cleaned ${outDir}`);

        // --- JavaScript Bundling ---
        const jsEntryPoints = [
            'renderer.js',      // Main application logic
            'assets/js/database.js' // Database logic
        ];

        await esbuild.build({
            entryPoints: jsEntryPoints,
            bundle: true,
            minify: isProduction,
            sourcemap: !isProduction,
            outdir: path.join(outDir, 'assets/js'), // Output bundled JS here
            format: 'iife', // مناسب برای اسکریپت‌های مرورگر
            splitting: true, // Code splitting for shared chunks if entry points grow
            loader: {
                // Configure loaders if needed, e.g., for JSON, text files if imported in JS
            },
            define: {
                'process.env.NODE_ENV': isProduction ? '"production"' : '"development"',
                // Potentially replace some Electron/Node specific globals if they are checked
                // For example, if code checks 'typeof require', we might need to define 'require': 'undefined'
                // This needs careful analysis of the existing codebase.
            },
            // To handle 'require' calls for libraries like moment, sweetalert2, etc.,
            // if they are not properly made global via script tags or if we want to bundle them:
            // 1. Ensure they are listed in package.json dependencies.
            // 2. Esbuild should pick them up via node_modules resolution.
            // However, the current code in pos.js uses `require()` in a way that assumes a Node-like environment.
            // For browser compatibility without a full rewrite to ES modules, ensuring these are global via <script> tags
            // in index.html (as currently done) is the simpler path. Esbuild will then treat them as external/global.
            // If we wanted to bundle them, we'd need to change `pos.js` to use `import`.
        });
        console.log('JavaScript bundled successfully.');

        // --- Service Worker ---
        // We typically want the service worker to be at the root of its scope.
        // It might also be bundled if it uses imports, or just copied if it's plain JS.
        await esbuild.build({
            entryPoints: ['public/sw.js'],
            bundle: true, // Bundle if it has imports, otherwise false and just minify/copy
            minify: isProduction,
            outfile: path.join(outDir, 'sw.js'),
            format: 'iife',
        });
        console.log('Service worker processed successfully.');

        // --- CSS Bundling ---
        // Esbuild can bundle CSS if imported in JS, or process CSS files directly.
        // For existing <link> tags in index.html, a plugin or manual process is often needed.
        // This is a simplified placeholder. A more robust solution might involve:
        // 1. Creating a JS entry point that imports all necessary CSS.
        // 2. Using an esbuild plugin to extract CSS into a separate file.
        // console.log('CSS processing placeholder - manual setup or plugin needed for full integration with index.html links.');
        // Example: Bundle a main CSS file if you create one that imports others.
        // await esbuild.build({
        //   entryPoints: ['assets/css/main.css'], // Assuming you create a main.css
        //   bundle: true,
        //   outfile: path.join(outDir, 'assets/css/style.css'),
        //   minify: isProduction,
        // });

        // --- Static Assets Copying ---
        const assetsToCopy = [
            { from: 'index.html', to: path.join(outDir, 'index.html') },
            { from: 'public/manifest.json', to: path.join(outDir, 'manifest.json') },
            { from: 'public/logo_icon.png', to: path.join(outDir, 'logo_icon.png') }, // For manifest
            { from: 'public/favicon.ico', to: path.join(outDir, 'favicon.ico') }, // For manifest
            { from: 'assets/images', to: path.join(outDir, 'assets/images') },
            { from: 'assets/fonts', to: path.join(outDir, 'assets/fonts') },
            // Explicitly copy CSS files as they are linked directly in index.html
            // This is not ideal bundling but ensures they are available.
            { from: 'assets/css', to: path.join(outDir, 'assets/css') },
            { from: 'assets/plugins', to: path.join(outDir, 'assets/plugins') }, // Copy all plugins
        ];

        for (const asset of assetsToCopy) {
            if (await fs.pathExists(asset.from)) {
                await fs.copy(asset.from, asset.to);
                console.log(`Copied ${asset.from} to ${asset.to}`);
            } else {
                console.warn(`Asset not found, skipped copying: ${asset.from}`);
            }
        }

        // Special handling for sql-wasm.wasm if using sql.js locally
        // If sql.js is configured to load sql-wasm.wasm from a specific path, ensure it's copied.
        // By default, sql.js (CDN version) loads it from its own CDN path.
        // If you download sql.js and host it yourself, you'd copy its .wasm file too.
        // Example: await fs.copy('node_modules/sql.js/dist/sql-wasm.wasm', path.join(outDir, 'sql-wasm.wasm'));


        console.log('Build completed successfully!');
        console.log(`Output directory: ${outDir}`);
        console.log('Remember to install esbuild and fs-extra: npm install esbuild fs-extra --save-dev');
        console.log('Then run: node esbuild.mjs');
        console.log('Or set NODE_ENV=production node esbuild.mjs for production build.');

    } catch (e) {
        console.error('Build failed:', e);
        process.exit(1);
    }
}

build();
