// Global library provisioning
import jquery from 'jquery';
window.$ = jquery;
window.jQuery = jquery;

import moment from 'moment';
window.moment = moment; // Though pos.js imports it directly, some plugins might expect global

import Swal from 'sweetalert2';
window.Swal = Swal; // pos.js imports it, but good to ensure global if any part expects it

import jsPDF from 'jspdf';
window.jsPDF = jsPDF;

import html2canvas from 'html2canvas';
window.html2canvas = html2canvas;

import JsBarcode from 'jsbarcode';
window.JsBarcode = JsBarcode; // JsBarcode is often used as jQuery plugin or globally

import printJS from 'print-js'; // Assuming default export
window.printJS = printJS;
import 'print-js/dist/print.css'; // Import its CSS

// --- End Global Library Provisioning ---


import { initializeDatabase } from './database.js';
import { initializeStripeConfig } from '../api/payment.js'; // Assuming path is correct

// Import CSS for esbuild to bundle (if not handled by HTML links directly)
// Example: import '../assets/css/bootstrap.min.css';
// Example: import '../assets/css/core.css';
// ... many other CSS files are linked in index.html. Decide if they should be imported here for bundling
// or kept as links (esbuild config would then just copy assets folder).
// For now, assuming they are linked in HTML and assets are copied.

// Import main application logic files. These will execute after globals are set.
import '../assets/js/pos.js'; // Relies on global $, Swal, etc.
import '../assets/js/product-filter.js'; // Relies on global $


async function mainAppInit() {
    console.log("Web Application Initializing...");

    try {
        // Initialize the database
        await initializeDatabase();
        console.log("Database initialized.");

        // Initialize Stripe configuration (this loads settings which might be needed by pos.js)
        // Stripe.js SDK is loaded via <script> in index.html
        if (window.Stripe) {
            await initializeStripeConfig(); // This is from api/payment.js
            console.log("Stripe configuration initialized.");
        } else {
            console.warn("Stripe.js SDK not found on window. Stripe payments may not work.");
        }

        // POS.js and product-filter.js are now imported and have executed their $(document).ready() or equivalent.
        // Now, call the main startup function exposed by pos.js (if it exists and is needed after its own setup)
        if (window.startPosApplication && typeof window.startPosApplication === 'function') {
            await window.startPosApplication();
            console.log("POS application startup function called.");
        } else {
            console.warn("window.startPosApplication function not found. Ensure pos.js exposes it if needed for post-load initialization.");
        }

        console.log("Main application scripts (pos.js, product-filter.js) processing complete.");

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
