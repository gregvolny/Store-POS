import { getSettings } from "./settings.js"; // To get Stripe configuration

// NOTE: This module is heavily refactored.
// Stripe operations requiring a secret key CANNOT be done client-side.
// A secure backend server is required for most Stripe functionality,
// especially PaymentIntent creation, capture, and Terminal operations.
// The functions below are placeholders or adapted for what might be
// initiated from a client, expecting a backend to handle the secure parts.

// Global Stripe object (Stripe.js) should be loaded in index.html
// This will be used for client-side tokenization or Payment Element.
// let stripe = null; // This would be window.Stripe('YOUR_PUBLISHABLE_KEY');

let currentStripeSettings = null;
let stripePublishableKey = null;
let stripeInstance = null; // Instance of Stripe.js (window.Stripe)

async function initializeStripeConfig() {
    if (!currentStripeSettings) {
        const settings = await getSettings();
        if (settings && settings.stripe) {
            currentStripeSettings = settings.stripe;
            stripePublishableKey = currentStripeSettings.live ? currentStripeSettings.publishable.live : currentStripeSettings.publishable.test;
            if (stripePublishableKey && window.Stripe) {
                stripeInstance = window.Stripe(stripePublishableKey);
            } else {
                console.error("Stripe.js not loaded or publishable key missing.");
            }
        } else {
            console.error("Stripe settings not found.");
        }
    }
}

// --- Terminal Specific Functions (Placeholders - Require Backend) ---

export async function listReaders() {
    // This operation (stripe.terminal.readers.list()) requires a secret key and must be on a backend.
    // The client would typically call an endpoint on your server.
    console.warn("listReaders: This operation requires a backend call.");
    // Example: return await fetch('/api/stripe/terminal/list_readers').then(res => res.json());
    return { status: "error", message: "Backend call required to list readers." };
}

export async function getTerminalLocationId() {
    // Location ID might be needed by the client for some UI logic,
    // but it's typically used server-side when registering readers or creating payment intents.
    await initializeStripeConfig();
    if (currentStripeSettings && currentStripeSettings.terminal && currentStripeSettings.terminal.locationid) {
        return currentStripeSettings.live ? currentStripeSettings.terminal.locationid.live : currentStripeSettings.terminal.locationid.test;
    }
    console.warn("Terminal Location ID not configured.");
    return null;
}

export async function createTerminalConnectionToken() {
    // stripe.terminal.connectionTokens.create() must be called on a backend.
    // The client requests this token from the backend to connect the JS SDK to a reader.
    console.warn("createTerminalConnectionToken: This operation requires a backend call.");
    // Example: return await fetch('/api/stripe/terminal/connection_token', { method: 'POST' }).then(res => res.json());
    // The backend would return { secret: connectionToken.secret }
    return { status: "error", message: "Backend call required for connection token." };
}

export async function processTerminalPayment(amount, currency, readerId) {
    // This involves creating a PaymentIntent (backend) and then processing it on the reader (client via SDK, then backend).
    console.warn("processTerminalPayment: This operation requires multiple backend calls and client-side SDK interaction.");
    // 1. Client requests backend to create a PaymentIntent.
    // 2. Backend creates PaymentIntent, returns client_secret.
    // 3. Client uses Stripe Terminal JS SDK's collectPaymentMethod with the client_secret.
    // 4. SDK communicates with reader. On success, client tells backend to process/capture.
    return { status: "error", message: "Complex flow requiring backend and client SDK." };
}

export async function simulateTerminalPayment(readerId) {
    // stripe.testHelpers.terminal.readers.presentPaymentMethod(readerId)
    // This is a test helper. It might be possible to call if a Stripe test instance is configured on the client,
    // but this is not typical for production client code. For actual testing, it's usually server-side.
    console.warn("simulateTerminalPayment: Test helper, usually server-side. Requires backend for real processing.");
    return { status: "error", message: "Test helper, backend usually required." };
}

export async function captureTerminalPayment(paymentIntentId) {
    // stripe.paymentIntents.capture(paymentIntentId) must be called on a backend.
    console.warn("captureTerminalPayment: This operation requires a backend call.");
    return { status: "error", message: "Backend call required to capture payment." };
}

export async function cancelTerminalAction(readerId) {
    // stripe.terminal.readers.cancelAction(readerId) usually called from backend,
    // though the JS SDK also provides a method to cancel.
    // If using JS SDK: StripeTerminal.cancelCollectPaymentMethod()
    console.warn("cancelTerminalAction: Typically handled via JS SDK or requires backend.");
    return { status: "error", message: "Use JS SDK or backend for cancel action." };
}


// --- Non-Terminal Payment Functions (Placeholders - Require Backend for PaymentIntent creation) ---

export async function createPaymentIntent(amount, currency, paymentMethodType = 'card') {
    // stripe.paymentIntents.create(...) must be called on a backend.
    // The client requests the backend to create a PaymentIntent.
    // Backend returns { client_secret: paymentIntent.client_secret }
    console.warn("createPaymentIntent: This operation requires a backend call.");
    // Example:
    // const response = await fetch('/api/stripe/create_payment_intent', {
    //   method: 'POST',
    //   headers: {'Content-Type': 'application/json'},
    //   body: JSON.stringify({ amount: Number(amount) * 100, currency: currency.toLowerCase(), type: paymentMethodType })
    // });
    // return await response.json(); // Expected: { status: 'success', paymentIntent: { client_secret: '...' } } or error
    return { status: "error", message: "Backend call required to create PaymentIntent." };
}

// --- Webhook Handling ---
// Webhooks are entirely server-side. The existing /webhook endpoint logic is removed.
// Client-side code does not handle webhooks directly.
// Any actions that were triggered by webhooks (e.g., updating order status, sending notifications)
// would now need to be initiated by the client after a successful payment confirmation,
// or by querying the backend for status updates if the backend processes webhooks.

// The accounting logic (e.g., unearnedRevenue) and desktop_notification
// from the original webhook handler are Node.js specific and removed.
// If this logic is needed, it must be re-implemented in a suitable way for the new architecture
// (either client-side if appropriate, or ideally on the backend that processes webhooks).

console.log("Stripe payment module loaded (client-side stubs). Most operations require a secure backend.");
// Initialize Stripe config when module is loaded (or on first use)
// initializeStripeConfig(); // Call this when Stripe.js is confirmed to be loaded.
// It's better to call this explicitly from application bootstrap logic.
export { initializeStripeConfig, stripeInstance };
