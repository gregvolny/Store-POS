import jquery from 'jquery'; // Import jQuery
window.jQuery = jquery;    // Make it global before other imports that might depend on it
window.$ = jquery;         // Make $ global too

import { initializeDatabase } from './database.js';
import { initializeStripeConfig } from '../api/payment.js'; // Assuming path is correct
import '../components/product-card.js'; // Import to register the product-card component
import '../components/category-button.js'; // Import to register the category-button component
import '../components/product-form-modal.js'; // Import to register the product-form-modal-content component
import '../components/category-form-modal.js'; // Import to register the category-form-modal-content component


// Import styles if not handled globally or via index.html template
// import '../assets/css/bootstrap.min.css'; // Example
// import '../assets/css/core.css';
// ... other global CSS

// Import main application logic files (formerly required by renderer.js)
// These files will need to be refactored to ESM and to not use Node.js/Electron specific APIs directly where possible
import '../assets/js/pos.js';
import '../assets/js/product-filter.js';

// print-js is often used as a global or via specific imports if it supports ESM
import 'print-js/dist/print.css'; // Import its CSS
// import printJS from 'print-js'; // If using it as a module: window.printJS = printJS; or use it directly

async function main() {
    console.log("Web Application Initializing...");

    try {
        // Initialize the database
        await initializeDatabase();
        console.log("Database initialized.");

        // Initialize Stripe configuration (this loads settings which might be needed by pos.js)
        // Ensure Stripe.js SDK (from index.html) is loaded before this, or handle appropriately.
        // We might need to wait for DOMContentLoaded or for Stripe.js to signal readiness.
        if (window.Stripe) {
            await initializeStripeConfig();
            console.log("Stripe configuration initialized.");
        } else {
            console.warn("Stripe.js SDK not found on window. Stripe payments may not work.");
            // Optionally, retry initialization after a delay or on an event
        }

        // POS.js and product-filter.js are now imported.
        // Their jQuery $(document).ready() or similar will execute.
        console.log("Main application scripts (pos.js, product-filter.js) loaded.");

    } catch (error) {
        console.error("Error during application initialization:", error);
        // Display a user-friendly error message on the page if appropriate
        const body = document.querySelector('body');
        if (body) {
            body.innerHTML = `<div style="padding: 20px; text-align: center; font-family: sans-serif;">
                <h1>Application Error</h1>
                <p>There was an error initializing the application. Please try refreshing the page.</p>
                <p>Details: ${error.message}</p>
            </div>`;
        }
    }
}

// Wait for the DOM to be fully loaded before running main initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
} else {
    main();
}
