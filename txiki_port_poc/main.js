// main.js
// Entry point for the Ported Application
// Run with: tjs run main.js

import { WebUI } from './webui_ffi.js';
// import { PGlite } from '@electric-sql/pglite'; // Attempting to import PGlite

console.log("Starting Store-POS (Txiki Port)...");

async function main() {
    // 1. Initialize Database
    let db;
    try {
        console.log("Initializing PGlite...");
        // This is where it might fail in txiki.js currently due to WASM limitations
        // db = new PGlite();
        // await db.query("select 'Hello world' as message;");
        console.log("PGlite initialized (Simulated).");
    } catch (e) {
        console.error("PGlite initialization failed:", e);
        console.log("Falling back to tjs:sqlite or in-memory mock.");
    }

    // 2. Start WebUI
    try {
        const myWindow = new WebUI();

        // In a real app, you would serve index.html
        // For POC, we show a simple string or local file
        myWindow.show("<html><head><script src=\"webui.js\"></script></head><body><h1>Store POS running on Txiki + WebUI!</h1><div id='app'></div></body></html>");

        console.log("Window opened. Waiting...");
        WebUI.wait();
    } catch (e) {
        console.error("WebUI failed:", e);
    }
}

main();
