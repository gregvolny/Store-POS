# Migration Analysis: Store-POS to Txiki.js + WebUI + PGlite

## Executive Summary

Yes, it is possible to "mix" these technologies, but with specific caveats regarding **PGlite**.

*   **WebUI**: Fully supported in `txiki.js` via the Foreign Function Interface (`tjs:ffi`).
*   **PGlite**: **Experimental/Risky**. `PGlite` depends on WebAssembly (WASM) and Emscripten bindings usually tailored for Node.js or Browsers. `txiki.js` has WASM support but it may lack specific JS APIs (like full `WebAssembly` global support or specific Node polyfills) required by the `PGlite` loader.
*   **Recommendation**: Proceed with the port using `webui` for the frontend. Attempt `PGlite`, but have a fallback plan to use `tjs:sqlite` (SQLite), which is built-in to `txiki.js` and highly reliable for desktop apps.

## Architecture Changes

### 1. Runtime Replacement
*   **From**: Electron (Chromium + Node.js).
*   **To**: `txiki.js` (QuickJS + libuv) + System Browser (via `webui`).
*   **Impact**: drastically reduced bundle size (from ~100MB+ to ~5-10MB).

### 2. Frontend (UI)
*   **From**: `BrowserWindow` loading `index.html` with `nodeIntegration: true`.
*   **To**: System browser loading `index.html`.
*   **Challenge**: You lose `nodeIntegration`. The frontend cannot require Node modules directly.
*   **Solution**: Use `webui.bind` to call backend C/JS functions from the frontend. This is safer and cleaner.

### 3. Backend (Server/Logic)
*   **From**: `server.js` using `express` and `nedb`.
*   **To**: `txiki.js` scripts.
    *   **Server**: `express` does not run on `txiki.js` (it depends on Node `http`). You will need to rewrite the API endpoints as simple functions called via `webui.bind`, or use `tjs` networking to create a raw server if a local HTTP server is strictly necessary.
    *   **Database**: Replace `nedb` (Document store) with `PGlite` (SQL) or `tjs:sqlite` (SQL). This requires rewriting all data access logic (CRUD operations).

## Detailed Feasibility & Risks

### WebUI Integration (Low Risk)
`txiki.js` provides `tjs:ffi` which allows loading shared libraries (`.dll`, `.so`, `.dylib`). `webui` is a pure C library. You can create a small wrapper (as shown in `txiki_port_poc/webui_ffi.js`) to map JS calls to `webui` functions.

### PGlite Integration (High Risk)
`PGlite` is designed to be "Embeddable Postgres". It uses Emscripten. Emscripten-generated JS glue code often assumes a "standard" environment (Node.js or Browser).
*   **Issue**: `txiki.js` might not implement all `WebAssembly` JS API features (e.g., `WebAssembly.Memory` exports/imports in the exact way Emscripten expects) or missing Node modules (`fs`, `crypto`) that `PGlite` might try to polyfill.
*   **Mitigation**:
    1.  Test `PGlite` in `txiki.js` immediately.
    2.  If it fails, patch the `PGlite` JS loader (advanced).
    3.  **Fallback**: Use `tjs:sqlite`. It is built-in (`import { DB } from 'tjs:sqlite';`) and robust. For a single-user POS system, SQLite is often indistinguishable from Postgres in capability.

## Migration Steps

1.  **Prepare the Environment**:
    *   Install `txiki.js` (build from source or download binary).
    *   Download/Build `webui` shared library (`webui-2.dll` / `libwebui.so`).
2.  **Create the Bridge (`webui_ffi.js`)**:
    *   Implement the FFI definitions to talk to `webui`.
3.  **Rewrite `server.js` Logic**:
    *   Convert Express routes (`app.get('/api/users')`) to standalone functions (`function getUsers()`).
    *   Bind these functions to the UI using `webui.bind('getUsers', getUsers)`.
4.  **Rewrite Database Layer**:
    *   Convert `nedb` queries to SQL.
    *   Implement using `PGlite` (if working) or `tjs:sqlite`.
5.  **Update Frontend (`index.html` / `renderer.js`)**:
    *   Remove `require('electron')`.
    *   Include `webui.js`.
    *   Change IPC calls (`ipcRenderer.send`) to `webui.call('myFunction')`.

## Example Code
See `txiki_port_poc/` for a starting point on how to load WebUI in Txiki.js.
