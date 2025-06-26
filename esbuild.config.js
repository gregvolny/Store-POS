import esbuild from 'esbuild';
import { copy } from 'esbuild-plugin-copy'; // Requires: npm install --save-dev esbuild-plugin-copy
import fs from 'fs/promises';
import path from 'path';

const isProduction = process.env.NODE_ENV === 'production';

// Function to handle HTML processing (basic version)
async function processHtml() {
    try {
        let htmlContent = await fs.readFile('index.html', 'utf-8');
        // Replace or inject script and link tags
        // This is a very basic example. A more robust solution might use a templating engine or parser.

        // Remove old script tags if they were placeholders, or adjust as needed
        // For example, if there was a placeholder like <!-- ESBUILD_SCRIPT_TAG_LOCATION -->
        // htmlContent = htmlContent.replace('<!-- ESBUILD_SCRIPT_TAG_LOCATION -->', '<script defer src="bundle.js"></script>');

        // Assuming bundle.js and bundle.css are at the root of 'dist'
        const scriptTag = '<script defer src="bundle.js"></script>';
        const cssTag = '<link rel="stylesheet" href="bundle.css">';

        if (htmlContent.includes('</body>')) {
            htmlContent = htmlContent.replace('</body>', `  ${scriptTag}\n</body>`);
        } else {
            htmlContent += scriptTag; // Fallback if no body tag found
        }

        if (htmlContent.includes('</head>')) {
            htmlContent = htmlContent.replace('</head>', `  ${cssTag}\n</head>`);
        } else {
            // Fallback: Prepend CSS if no head tag, though this is not ideal
            htmlContent = cssTag + htmlContent;
        }

        await fs.mkdir('dist', { recursive: true });
        await fs.writeFile('dist/index.html', htmlContent);
        console.log('HTML processed and copied to dist/index.html');
    } catch (error) {
        console.error('Error processing HTML:', error);
    }
}


const buildOptions = {
    entryPoints: ['src/main.js'],
    bundle: true,
    outfile: 'dist/bundle.js',
    sourcemap: !isProduction,
    minify: isProduction,
    loader: { // Define loaders for different file types if needed, e.g. for fonts if not handled by copy
        // '.js': 'jsx', // If using JSX, not needed for this project
        // '.woff': 'file',
        // '.woff2': 'file',
        // '.ttf': 'file',
        // '.eot': 'file',
        // '.svg': 'file', // For SVGs used as images/fonts
        // '.png': 'file',
        // '.jpg': 'file',
    },
    //splitting: true, // Enable code splitting if desired for larger apps
    //format: 'esm',    // Output format, 'iife' is default for browsers when bundling
    target: ['chrome58', 'firefox57', 'safari11', 'edge16'], // Target modern browsers
    plugins: [
        copy({
            resolveFrom: 'cwd', // Current working directory
            assets: [
                {
                    from: ['./assets/**/*'], // Copy contents of assets
                    to: ['./dist/assets'],   // To dist/assets
                },
                {
                    from: ['./node_modules/sql.js/dist/sql-wasm.wasm'],
                    to: ['./dist/wasm/sql-wasm.wasm'], // Ensure path matches database.js
                },
                // Add other specific files or folders if needed, e.g. public folder contents
                // {
                //   from: ['./public/**/*', '!./public/index.html'], // Example: copy public excluding index.html
                //   to: ['./dist'],
                // }
            ],
            watch: !isProduction, // Enable watch mode for plugin during development
        }),
        // Custom plugin to process HTML after build
        {
            name: 'html-processor',
            setup(build) {
                build.onEnd(async result => {
                    if (result.errors.length === 0) {
                        await processHtml();
                    }
                });
            },
        },
    ],
    logLevel: 'info',
};

async function runBuild() {
    try {
        await esbuild.build(buildOptions);
        console.log(`Build successful (production: ${isProduction})`);
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

async function runServe() {
    try {
        const ctx = await esbuild.context(buildOptions);
        await ctx.watch();
        const { host, port } = await ctx.serve({
            servedir: 'dist',
            port: 8080, // Choose a port
        });
        console.log(`Development server listening on http://${host}:${port}`);
        // Initial HTML processing for serve mode
        await processHtml();
    } catch (error) {
        console.error('Serve failed:', error);
        process.exit(1);
    }
}

// Determine action based on script arguments or environment variables
if (process.argv.includes('--serve')) {
    runServe();
} else {
    runBuild();
}

export default buildOptions; // Export for potential programmatic use, though CLI usage is primary here
