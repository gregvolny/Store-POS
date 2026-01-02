// webui_ffi.js
// A wrapper for WebUI C API using txiki.js FFI

import { Lib, CFunction, types } from 'tjs:ffi';

// Determine library name based on OS (simplified)
let libName = 'webui-2.dll'; // Windows
if (globalThis.navigator && navigator.platform.includes('Linux')) {
    libName = 'libwebui.so.2';
} else if (globalThis.navigator && navigator.platform.includes('Mac')) {
    libName = 'libwebui.2.dylib';
}

// Open the library
// Note: You must compile webui to a shared library and place it in the same directory or system path
let lib;
try {
    lib = new Lib(libName);
} catch (e) {
    console.error(`Failed to load ${libName}. Make sure it is compiled and in the path.`);
    console.error(e);
    // For POC purposes, we stop here if lib is missing
    throw e;
}

// Define the C function signatures
// webui_new_window: () -> size_t
// webui_show: (size_t window, const char* content) -> void
// webui_wait: () -> void

// We use 'ffi' module to define these.
// Assuming tjs:ffi syntax:
// const func = new CFunction(symbol, returnType, [argTypes...]);

// Use tjs:ffi types
// types.void, types.size, types.string

const webui_new_window = new CFunction(
    lib.symbol('webui_new_window'),
    types.size, // return type
    []          // arg types
);

const webui_show = new CFunction(
    lib.symbol('webui_show'),
    types.void,
    [types.size, types.string]
);

const webui_wait = new CFunction(
    lib.symbol('webui_wait'),
    types.void,
    []
);

// Wrapper class
export class WebUI {
    constructor() {
        this.windowId = webui_new_window.call();
    }

    show(content) {
        webui_show.call(this.windowId, content);
    }

    static wait() {
        webui_wait.call();
    }
}
