// Service Imports
import * as UserService from '../../api/users.js';
import * as SettingsService from '../../api/settings.js';
import * as InventoryService from '../../api/inventory.js';
import * as CategoryService from '../../api/categories.js';
import * as CustomerService from '../../api/customers.js';
import * as TransactionService from '../../api/transactions.js';
import * as PaymentService from '../../api/payment.js'; // May have limited use client-side

// Utility Imports
import moment from 'moment';
import Swal from 'sweetalert2';
// jsPDF, html2canvas, JsBarcode are assumed to be global or handled by direct script includes for now.
// If they have ESM versions, they could be imported too.
// Example: import jsPDF from 'jspdf';
// Example: import html2canvas from 'html2canvas';
// Example: import JsBarcode from 'jsbarcode';


// Node.js/Electron specific 'require' calls will be removed or replaced with imports/alternative solutions.
// const os = require('os'); // Removed: os specific paths like homedir() not available in browser

let cart = [];
let index = 0;
let allUsers = [];
let allProducts = [];
let allCategories = [];
let allTransactions = [];
let sold = [];
let state = [];
let sold_items = [];
let item;
let auth;
let holdOrder = 0;
let vat = 0;
let perms = null;
let deleteId = 0;
let paymentType = 0;
let receipt = '';
let totalVat = 0;
let subTotal = 0;
let method = '';
let order_index = 0;
let user_index = 0;
let product_index = 0;
let transaction_index;
// let host = 'localhost'; // Removed: Direct API calls, no host/port needed for that
// let path = require('path'); // Removed: Node.js specific
// let port = '8001'; // Removed
// let moment = require('moment'); // Assuming moment is loaded globally via index.html or will be imported
// let Swal = require('sweetalert2'); // Assuming Swal is loaded globally or will be imported
// let { ipcRenderer } = require('electron'); // Removed: Electron specific
let dotInterval = setInterval(function () { $(".dot").text('.') }, 3000); // This is fine if $ is global jQuery
// let Store = require('electron-store'); // Removed: Electron specific, will replace with service calls / browser storage
// const remote = require('electron').remote; // Removed
// const app = remote.app; // Removed
// let img_path = os.homedir() + '/.storepos/POS/uploads/'; // Removed: Will use relative paths or placeholder
let img_path = 'assets/images/'; // Adjusted to match webpack output for images
// let api = 'http://' + host + ':' + port + '/api/'; // Removed: All API calls will be direct JS function calls
// let btoa = require('btoa'); // Removed: Using native browser btoa
// let {jsPDF} = require('jspdf'); // Assuming jsPDF is loaded globally or will be imported
// let html2canvas = require('html2canvas'); // Assuming html2canvas is loaded globally or will be imported
// let JsBarcode = require('jsbarcode'); // Assuming JsBarcode is loaded globally or will be imported
// let macaddress = require('macaddress'); // Removed: Not available in browser
let categories = [];
let holdOrderList = [];
let customerOrderList = [];
let ownUserEdit = null;
let totalPrice = 0;
let orderTotal = 0;
let auth_error = 'Incorrect username or password';
let auth_empty = 'Please enter a username and password';
let holdOrderlocation = $("#randerHoldOrders");
let customerOrderLocation = $("#randerCustomerOrders");
// let storage = new Store(); // Removed: electron-store
let settings; // Will be populated by SettingsService.getSettings()
let platform; // This needs re-evaluation for web. For now, assume it's a simple client.
              // Original 'platform' held app type (standalone, network) and IP if network.
              // For a web client, it's always a "client" to its own data source (SQLite).
              // We might store some local config here if needed, fetched from settings.
let user = {}; // Current logged-in user
let start = moment().startOf('month');
let end = moment();
let start_date = moment(start).toDate();
let end_date = moment(end).toDate();
let by_till = 0;
let by_user = 0;
let by_status = 1;

window.POS = {};

$(function () {

    function cb(start, end) {
        $('#reportrange span').html(start.format('MMMM D, YYYY') + '  -  ' + end.format('MMMM D, YYYY'));
    }

    $('#reportrange').daterangepicker({
        startDate: start,
        endDate: end,
        autoApply: true,
        timePicker: true,
        timePicker24Hour: true,
        timePickerIncrement: 10,
        timePickerSeconds: true,
        // minDate: '',
        ranges: {
            'Today': [moment().startOf('day'), moment()],
            'Yesterday': [moment().subtract(1, 'days').startOf('day'), moment().subtract(1, 'days').endOf('day')],
            'Last 7 Days': [moment().subtract(6, 'days').startOf('day'), moment().endOf('day')],
            'Last 30 Days': [moment().subtract(29, 'days').startOf('day'), moment().endOf('day')],
            'This Month': [moment().startOf('month'), moment().endOf('month')],
            'This Month': [moment().startOf('month'), moment()],
            'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
        }
    }, cb);

    cb(start, end);

});


$.fn.serializeObject = function () {
    var o = {};
    var a = this.serializeArray();
    $.each(a, function () {
        if (o[this.name]) {
            if (!o[this.name].push) {
                o[this.name] = [o[this.name]];
            }
            o[this.name].push(this.value || '');
        } else {
            o[this.name] = this.value || '';
        }
    });
    return o;
};

// This function will be called from src/main.js after basic setup (DB, Stripe)
window.startPosApplication = async function () { // Exposed to global scope for main.js to call
    await initializeApplication();
};


// Initial application state loading and authentication
async function initializeApplication() {
    $("#loading").show().html('<div id="load"><form id="account"><div class="form-group"><input type="text" placeholder="Username" name="username" class="form-control"></div><div class="form-group"><input type="password" placeholder="Password" name="password" class="form-control"></div><div class="form-group"><input type="submit" class="btn btn-block btn-default" value="Login"></div></form></div>');
    // The authenticate function essentially just creates the form now.
    // The actual authentication logic is in the form's submit handler.
    console.log("Authentication form displayed.");
    // loadInitialData will be called upon successful authentication by the form submit handler
}

async function loadInitialData() {
    // This function is now called by authenticate() upon successful login
    try {
        // Fetch settings first as other parts might depend on it
        const fetchedSettings = await SettingsService.getSettings();
        settings = fetchedSettings; // Populate global settings

        // The 'platform' variable logic needs careful consideration for web.
        // Original logic: platform = storage.get('settings');
        // This 'platform' stored app type (Standalone, Network Terminal, Network Server) and IP.
        // For a web client, it's always a "client" to its own data (SQLite).
        // If some settings from the DB are meant to configure the client type, that logic would go here.
        // For now, assuming a default "standalone" like behavior for the web client.
        platform = { app: 'Standalone Web POS', till: settings?.till || 1, mac: 'N/A-Web' }; // Example default
        console.log("Platform settings determined/defaulted for web:", platform);


        // User object is already populated by the authenticate function if successful.
        // Update UI with logged-in user.
        if (user && user._id) {
            $('#loggedin-user').text(user.fullname);
        } else {
            // This case should ideally not be reached if authenticate forces login.
            console.error("User not logged in after authentication flow.");
            authenticate(); // Re-trigger auth
            return;
        }

        // Fetch all users (for user management sections, etc.)
        const users = await UserService.getAllUsers();
        allUsers = [...users];

        // Initial data loading for POS
        await loadCategories();
        await loadProducts();
        await loadCustomers(); // Ensure this is async or handles its promise

        if (settings && settings.symbol) {
            $("#price_curr, #payment_curr, #change_curr").text(settings.symbol);
        }

        if (settings) {
            vat = parseFloat(settings.percentage) || 0;
            $("#taxInfo").text(settings.charge_tax ? vat : 0);
        } else {
             // Default VAT if settings are missing, or prompt for settings.
            console.warn("Settings not loaded, VAT may be incorrect.");
            $('#settingsModal').modal('show'); // Prompt for settings if not found
        }

        // Permissions - ensure user object has these properties
        if (user && typeof user.perm_products !== 'undefined') { // Check one perm as example
            if (0 == user.perm_products) { $(".p_one").hide(); } else { $(".p_one").show(); }
            if (0 == user.perm_categories) { $(".p_two").hide(); } else { $(".p_two").show(); }
            if (0 == user.perm_transactions) { $(".p_three").hide(); } else { $(".p_three").show(); }
            if (0 == user.perm_users) { $(".p_four").hide(); } else { $(".p_four").show(); }
            if (0 == user.perm_settings) { $(".p_five").hide(); } else { $(".p_five").show(); }
        }


        $("#loading").hide();
        console.log("Initial data loaded, application ready.");

    } catch (error) {
        console.error("Error loading initial application data:", error);
        $("#loading").text("Error loading data. Please refresh.").show();
        Swal.fire('Error', `Could not load initial application data: ${error.message}`, 'error');
    }
}


// $(document).ready() equivalent in the new structure:
// Call initializeApplication after the DOM is ready and main.js has initialized DB etc.
// This will be triggered from src/main.js after initial async setup.
// For now, ensure this code runs after the DOM is ready.
$(function() {
    // This is jQuery's document ready.
    // The main initialization (DB, Stripe config) happens in src/main.js.
    // Then, initializeApplication() which includes authentication should be called.
    // For simplicity in this step, let's assume main.js handles calling initializeApplication
    // or we can call it here if main.js ensures its own async setup is done first.
    // Let's defer the call to be explicitly made from main.js after its setup.
    // For now, the event bindings below can stay within this $(function(){...}).

    // initializeApplication(); // This will be called by window.startPosApplication from main.js

    // Event handlers and other jQuery dependent setup:
    $(".loading").hide(); // Initially hide loading spinner itself, authenticate() will manage #loading div
    $(".main_app").hide(); // Hide main app content until authenticated and loaded

    $("#settingsModal").on("hide.bs.modal", function () {
        setTimeout(function () {
                if ((!settings || !settings.store) && user && user._id) {
                Swal.fire('Setup Required', 'Please configure application settings to continue.', 'warning')
                    .then(() => {
                         $('#settingsModal').modal('show');
                    });
            }
        }, 1000);
    });

    // Login form submission is already refactored above.

    // Refactored data loading functions
    async function loadProducts() {
            try {
                const data = await InventoryService.getAllProducts();
                data.forEach(item => {
                    item.price = parseFloat(item.price).toFixed(2);
                });
                allProducts = [...data];
                loadProductList(); // This function also needs to be aware that `settings` might not be ready yet if called too early

                $('#parent').text('');
                $('#categories').html(`<button type="button" id="all" class="btn btn-categories btn-white waves-effect waves-light">All</button> `);

                const uniqueCategories = new Set();
                data.forEach(item => {
                    uniqueCategories.add(item.category);
                    let item_info = `<div class="col-lg-2 box ${item.category}"
                                onclick="$(this).addToCart(${item._id}, ${item.quantity}, ${item.stock})">
                            <div class="widget-panel widget-style-2 ">                    
                            <div id="image"><img src="${item.img == "" || !item.img ? "./assets/images/default.jpg" : img_path + item.img}" id="product_img" alt=""></div>
                                        <div class="text-muted m-t-5 text-center">
                                        <div class="name" id="product_name">${item.name}</div> 
                                        <span class="sku">${item.sku || ''}</span>
                                        <div class="name" id="lot_number"><span class="stock">LOT # </span>${item.lotnumber || ''}</div>
                                        <span class="stock">STOCK </span><span class="count">${item.stock == 1 ? item.quantity : 'N/A'}</span></div>
                                        <div class="name" id="product_unit">${item.unit || ''}</div>
                                        <sp class="text-success text-center"><b data-plugin="counterup">${(settings ? settings.symbol : '$') + item.price}</b> </sp>
                            </div>
                        </div>`;
                    $('#parent').append(item_info);
                });

                categories = Array.from(uniqueCategories); // Update global categories based on products

                categories.forEach(categoryId => {
                    let c = allCategories.find(cat => cat._id == categoryId);
                    $('#categories').append(`<button type="button" id="${categoryId}" class="btn btn-categories btn-white waves-effect waves-light">${c ? c.name : 'Unknown Category'}</button> `);
                });
            } catch (error) {
                console.error("Error loading products:", error);
                Swal.fire('Error', 'Could not load products.', 'error');
            }
        }

        async function loadCategories() {
            try {
                const data = await CategoryService.getAllCategories();
                allCategories = data; // Populate global
                loadCategoryList(); // UI update function
                $('#category').html(`<option value="0">Select</option>`);
                allCategories.forEach(category => {
                    $('#category').append(`<option value="${category._id}">${category.name}</option>`);
                });
            } catch (error) {
                console.error("Error loading categories:", error);
                Swal.fire('Error', 'Could not load categories.', 'error');
            }
        }

        async function loadCustomers() {
            try {
                const customers = await CustomerService.getAllCustomers();
                $('#customer').html(`<option value="0" selected="selected">Walk in/Rideshare customer</option>`);
                customers.forEach(cust => {
                    let customerOption = `<option value='{"id": ${cust._id}, "name": "${cust.name}"}'>${cust.name}</option>`;
                    $('#customer').append(customerOption);
                });
                //  $('#customer').chosen(); // If chosen.js is used, re-initialize or update
            } catch (error) {
                console.error("Error loading customers:", error);
                Swal.fire('Error', 'Could not load customers.', 'error');
            }
        }

        // Refactor addToCart to use InventoryService.getProductById
        $.fn.addToCart = async function (id, count, stockStatus) { // count and stockStatus from product listing, might be stale
            try {
                const product = await InventoryService.getProductById(id);
                if (!product) {
                    Swal.fire('Error', 'Product not found.', 'error');
                    return;
                }

                if (product.stock == 1) { // Track stock for this product
                    if (product.quantity > 0) { // Check current quantity from DB
                        $(this).addProductToCart(product);
                    } else {
                        Swal.fire('Out of stock!', 'This item is currently unavailable', 'info');
                    }
                } else { // Stock not tracked, can always add
                    $(this).addProductToCart(product);
                }
            } catch (error) {
                console.error("Error in addToCart:", error);
                Swal.fire('Error', 'Could not add product to cart.', 'error');
            }
        };

        // Refactor barcodeSearch to use InventoryService.getProductBySku
        async function barcodeSearch(e) {
            e.preventDefault();
            $("#basic-addon2").empty().append($('<i>', { class: 'fa fa-spinner fa-spin' }));

            const skuCode = $("#skuCode").val();
            try {
                const product = await InventoryService.getProductBySku(skuCode); // Assuming SKU is _id for now

                if (product && product._id && (product.stock !== 1 || product.quantity >= 1)) { // product.stock !== 1 means don't track stock
                    $(this).addProductToCart(product);
                    $("#searchBarCode").get(0).reset();
                    $("#basic-addon2").empty().append($('<i>', { class: 'glyphicon glyphicon-ok' }));
                } else if (product && product.stock === 1 && product.quantity < 1) {
                    Swal.fire('Out of stock!', 'This item is currently unavailable', 'info');
                    $("#basic-addon2").empty().append($('<i>', { class: 'glyphicon glyphicon-ok' }));
                } else {
                    Swal.fire('Not Found!', `<b>${skuCode}</b> is not a valid barcode or product out of stock!`, 'warning');
                    $("#searchBarCode").get(0).reset();
                    $("#basic-addon2").empty().append($('<i>', { class: 'glyphicon glyphicon-ok' }));
                }
            } catch (error) {
                console.error("Error in barcodeSearch:", error);
                Swal.fire('Error', 'Error searching for product by SKU.', 'error');
                $("#basic-addon2").empty().append($('<i>', { class: 'glyphicon glyphicon-remove' }));
            }
        }

        $("#searchBarCode").on('submit', function (e) {
            barcodeSearch(e);
        });



        $('body').on('click', '#jq-keyboard button', function (e) {
            let pressed = $(this)[0].className.split(" ");
            if ($("#skuCode").val() != "" && pressed[2] == "enter") {
                barcodeSearch(e);
            }
        });



        $.fn.addProductToCart = function (data) {
            item = {
                id: data._id,
                product_name: data.name,
                sku: data.sku,
                price: data.price,
                quantity: 1
            };

            if ($(this).isExist(item)) {
                $(this).qtIncrement(index);
            } else {
                cart.push(item);
                $(this).renderTable(cart)
            }
        }


        $.fn.isExist = function (data) {
            let toReturn = false;
            $.each(cart, function (index, value) {
                if (value.id == data.id) {
                    $(this).setIndex(index);
                    toReturn = true;
                }
            });
            return toReturn;
        }


        $.fn.setIndex = function (value) {
            index = value;
        }


        $.fn.calculateCart = function () {
            let total = 0;
            let grossTotal;
            $('#total').text(cart.length);
            $.each(cart, function (index, data) {
                total += data.quantity * data.price;
            });
            total = total - $("#inputDiscount").val();
            $('#price').text(settings.symbol + total.toFixed(2));

            subTotal = total;

            if ($("#inputDiscount").val() >= total) {
                $("#inputDiscount").val(0);
            }

            if (settings.charge_tax) {
                totalVat = ((total * vat) / 100);
                grossTotal = total + totalVat
            }

            else {
                grossTotal = total;
            }

            orderTotal = grossTotal.toFixed(2);

            $("#gross_price").text(settings.symbol + grossTotal.toFixed(2));
            $("#payablePrice").val(grossTotal);
        };



        $.fn.renderTable = function (cartList) {
            $('#cartTable > tbody').empty();
            $(this).calculateCart();
            $.each(cartList, function (index, data) {
                $('#cartTable > tbody').append(
                    $('<tr>').append(
                        $('<td>', { text: index + 1 }),
                        $('<td>', { text: data.product_name }),
                        $('<td>').append(
                            $('<div>', { class: 'input-group' }).append(
                                $('<div>', { class: 'input-group-btn btn-xs' }).append(
                                    $('<button>', {
                                        class: 'btn btn-default btn-xs',
                                        onclick: '$(this).qtDecrement(' + index + ')'
                                    }).append(
                                        $('<i>', { class: 'fa fa-minus' })
                                    )
                                ),
                                $('<input>', {
                                    class: 'form-control',
                                    type: 'number',
                                    value: data.quantity,
                                    onInput: '$(this).qtInput(' + index + ')'
                                }),
                                $('<div>', { class: 'input-group-btn btn-xs' }).append(
                                    $('<button>', {
                                        class: 'btn btn-default btn-xs',
                                        onclick: '$(this).qtIncrement(' + index + ')'
                                    }).append(
                                        $('<i>', { class: 'fa fa-plus' })
                                    )
                                )
                            )
                        ),
                        $('<td>', { text: settings.symbol + (data.price * data.quantity).toFixed(2) }),
                        $('<td>').append(
                            $('<button>', {
                                class: 'btn btn-danger btn-xs',
                                onclick: '$(this).deleteFromCart(' + index + ')'
                            }).append(
                                $('<i>', { class: 'fa fa-times' })
                            )
                        )
                    )
                )
            })
        };


        $.fn.deleteFromCart = function (index) {
            cart.splice(index, 1);
            $(this).renderTable(cart);

        }


        $.fn.qtIncrement = function (i) {

            item = cart[i];

            let product = allProducts.filter(function (selected) {
                return selected._id == parseInt(item.id);
            });

            if (product[0].stock == 1) {
                if (item.quantity < product[0].quantity) {
                    item.quantity += 1;
                    $(this).renderTable(cart);
                }

                else {
                    Swal.fire(
                        'No more stock!',
                        'You have already added all the available stock.',
                        'info'
                    );
                }
            }
            else {
                item.quantity += 1;
                $(this).renderTable(cart);
            }

        }


        $.fn.qtDecrement = function (i) {
            if (item.quantity > 1) {
                item = cart[i];
                item.quantity -= 1;
                $(this).renderTable(cart);
            }
        }


        $.fn.qtInput = function (i) {
            item = cart[i];
            item.quantity = $(this).val();
            $(this).renderTable(cart);
        }


        $.fn.cancelOrder = function () {

            if (cart.length > 0) {
                Swal.fire({
                    title: 'Are you sure?',
                    text: "You are about to remove all items from the cart.",
                    icon: 'warning',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Yes, clear it!'
                }).then((result) => {

                    if (result.value) {

                        cart = [];
                        $(this).renderTable(cart);
                        holdOrder = 0;

                        Swal.fire(
                            'Cleared!',
                            'All items have been removed.',
                            'success'
                        )
                    }
                });
            }

        }


        /**
         * TODO: replace the paymentInfo on the paymentModel dialog with stripe card info, and create a payment intents object
         */
        $("#payButton").on('click', async function () { // Added async
            if (cart.length != 0) {
                try {
                    const currentSettings = await SettingsService.getSettings(); // Replaces first AJAX call
                    if (!currentSettings || !currentSettings.stripe) {
                        Swal.fire('Configuration Error', 'Stripe settings are not configured.', 'error');
                        return;
                    }
                    settings = currentSettings; // Update global settings if needed, though already loaded by loadInitialData
                    console.log("PayButton: Settings loaded", settings);
                    window.currency = settings.currency; // Used by createPaymentIntent call

                    let publishableKey;
                    if (settings.stripe.live) {
                        publishableKey = settings.stripe.publishable.live;
                    } else {
                        publishableKey = settings.stripe.publishable.test;
                    }

                    if (!publishableKey) {
                         Swal.fire('Configuration Error', 'Stripe publishable key is not configured.', 'error');
                        return;
                    }
                    // localStorage.setItem("publishableKey", publishableKey); // Not strictly needed if stripeInstance is used from PaymentService

                    // Create Payment Intent via service (which is a stubbed backend call)
                    const piAmount = $("#payablePrice").val();
                    const piCurrency = window.currency;
                    const piType = "card"; // Assuming 'card' type for this flow

                    // This call is expected to fail client-side as it requires a backend.
                    // The PaymentService.createPaymentIntent function logs a warning.
                    // For a real app, this would be an actual fetch to your backend.
                    const paymentIntentResponse = await PaymentService.createPaymentIntent(piAmount, piCurrency, piType);

                    if (paymentIntentResponse.status === 'error' || !paymentIntentResponse.paymentIntent || !paymentIntentResponse.paymentIntent.client_secret) {
                        Swal.fire('Payment Error', paymentIntentResponse.message || 'Could not create payment intent.', 'error');
                        return;
                    }

                    localStorage.setItem("client_secret", paymentIntentResponse.paymentIntent.client_secret);

                    // Initialize Stripe.js if not already done (PaymentService.initializeStripeConfig should have done this)
                    if (!PaymentService.stripeInstance) {
                        await PaymentService.initializeStripeConfig(); // Ensure it's initialized
                        if (!PaymentService.stripeInstance) {
                             Swal.fire('Stripe Error', 'Stripe.js could not be initialized.', 'error');
                             return;
                        }
                    }
                    globalThis.stripe = PaymentService.stripeInstance; // Use the initialized instance

                    var elements = globalThis.stripe.elements();
                    globalThis.cardElement = elements.create('card');
                    globalThis.cardElement.mount('#paymentInfo');

                    document.getElementById("paymentMethod").innerHTML = `<option value="manual" selected>Manual Entry</option>`;

                    // Fetch readers (also a stubbed backend call)
                    const readersResponse = await PaymentService.listReaders();
                    if (readersResponse.status == "success" && readersResponse.readersList) {
                        var readers = readersResponse.readersList;
                        readers.forEach(function(reader){
                            console.log(reader);
                            var base64 = btoa(JSON.stringify(reader)); // btoa is native
                            var disabled = reader.status == "online" ? "" : "disabled";
                            var title = reader.status;
                            document.getElementById("paymentMethod").innerHTML += `<option value="${reader.id}" ${disabled} title="${title}" data-reader="${base64}">${reader.label}</option>`;
                        });
                    } else {
                        console.warn("Could not list readers or no readers found:", readersResponse.message);
                    }
            
                    $("#paymentModel").modal('toggle');
                } catch (error) {
                    console.error("Error in payment button click:", error);
                    Swal.fire('Error', `An error occurred: ${error.message}`, 'error');
                }
            } else {
                Swal.fire(
                    'Oops!',
                    'There is nothing to pay!',
                    'warning'
                );
            }

        });


        $("#hold").on('click', function () {

            if (cart.length != 0) {

                $("#dueModal").modal('toggle');
            } else {
                Swal.fire(
                    'Oops!',
                    'There is nothing to hold!',
                    'warning'
                );
            }
        });


        function printJobComplete() {
            alert("print job complete");
        }


        $.fn.submitDueOrder = function (status) {

            let items = "";
            let payment = 0;

            cart.forEach(item => {

                items += "<tr><td>" + item.product_name + "</td><td>" + item.quantity + "</td><td>" + settings.symbol + parseFloat(item.price).toFixed(2) + "</td></tr>";

            });

            let currentTime = new Date(moment());

            let discount = $("#inputDiscount").val();
            let customer = JSON.parse($("#customer").val());
            let date = moment(currentTime).format("YYYY-MM-DD HH:mm:ss");
            let paid = $("#payment").val() == "" ? "" : parseFloat($("#payment").val()).toFixed(2);
            let change = $("#change").text() == "" ? "" : parseFloat($("#change").text()).toFixed(2);
            let refNumber = $("#refNumber").val();
            let orderNumber = holdOrder;
            let type = "";
            let tax_row = "";

            paymentType = document.getElementById('paymentType').value;


            switch (paymentType) {
                case 0: type = "Cash";
                    break;

                case 1: type = "Cheque";
                    break;

                case 2: type = "Card";
                    break;

                default: type = "Card";
            }


            if (paid != "") {
                payment = `<tr>
                        <td>Paid</td>
                        <td>:</td>
                        <td>${settings.symbol + paid}</td>
                    </tr>
                    <tr>
                        <td>Change</td>
                        <td>:</td>
                        <td>${settings.symbol + Math.abs(change).toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Method</td>
                        <td>:</td>
                        <td>${type}</td>
                    </tr>`
            }



            if (settings.charge_tax) {
                tax_row = `<tr>
                    <td>Vat(${settings.percentage})% </td>
                    <td>:</td>
                    <td>${settings.symbol}${parseFloat(totalVat).toFixed(2)}</td>
                </tr>`;
            }



            if (status == 0) {

                if ($("#customer").val() == 0 && $("#refNumber").val() == "") {
                    Swal.fire(
                        'Reference Required!',
                        'You either need to select a customer <br> or enter a reference!',
                        'warning'
                    )

                    return;
                }
            }


            $(".loading").show();


            if (holdOrder != 0) {

                orderNumber = holdOrder;
                method = 'PUT'
            }
            else {
                orderNumber = Math.floor(Date.now() / 1000);
                method = 'POST'
            }


            receipt = `<div style="font-size: 10px;">                            
        <p style="text-align: center;">
        ${settings.img == "" ? settings.img : '<img style="max-width: 50px;max-width: 100px;" src ="' + img_path + settings.img + '" /><br>'}
            <span style="font-size: 22px;">${settings.store}</span> <br>
            ${settings.address_one} <br>
            ${settings.address_two} <br>
            ${settings.contact != '' ? 'Tel: ' + settings.contact + '<br>' : ''} 
            ${settings.tax != '' ? 'Vat No: ' + settings.tax + '<br>' : ''} 
        </p>
        <hr>
        <left>
            <p>
            Order No : ${orderNumber} <br>
            Ref No : ${refNumber == "" ? orderNumber : refNumber} <br>
            Customer : ${customer == 0 ? 'Walk in/Rideshare customer' : customer.name} <br>
            Cashier : ${user.fullname} <br>
            Date : ${date}<br>
            </p>

        </left>
        <hr>
        <table width="100%">
            <thead style="text-align: left;">
            <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Price</th>
            </tr>
            </thead>
            <tbody>
            ${items}                
     
            <tr>                        
                <td><b>Subtotal</b></td>
                <td>:</td>
                <td><b>${settings.symbol}${subTotal.toFixed(2)}</b></td>
            </tr>
            <tr>
                <td>Discount</td>
                <td>:</td>
                <td>${discount > 0 ? settings.symbol + parseFloat(discount).toFixed(2) : ''}</td>
            </tr>
            
            ${tax_row}
        
            <tr>
                <td><h3>Total</h3></td>
                <td><h3>:</h3></td>
                <td>
                    <h3>${settings.symbol}${parseFloat(orderTotal).toFixed(2)}</h3>
                </td>
            </tr>
            ${payment == 0 ? '' : payment}
            </tbody>
            </table>
            <br>
            <hr>
            <br>
            <p style="text-align: center;">
             ${settings.footer}
             </p>
            </div>`;


            if (status == 3) {
                if (cart.length > 0) {

                    printJS({ printable: receipt, type: 'raw-html' });

                    $(".loading").hide();
                    return;

                }
                else {

                    $(".loading").hide();
                    return;
                }
            }


            let data = {
                _id: orderNumber.toString(), // Ensure _id is a string if TEXT in DB
                ref_number: refNumber,
                discount: parseFloat(discount) || 0,
                customer: customer, // This is an object e.g. {id: ..., name: ...} or "0"
                customer_id: customer === 0 ? "0" : customer.id.toString(), // Extract ID for DB
                status: status, // 0 for hold, 1 for paid
                subtotal: parseFloat(subTotal) || 0,
                tax: parseFloat(totalVat) || 0,
                order_type: 1, // Assuming this field is still relevant
                items: cart, // Array of items
                date: currentTime.toJSON(), // Store as ISO string
                payment_type: type,
                payment_info: $("#paymentInfo").val(), // Potentially sensitive, consider alternatives
                total: parseFloat(orderTotal) || 0,
                paid: paid ? parseFloat(paid) : 0,
                change: change ? parseFloat(change) : 0,
                till_id: platform.till, // Renamed from 'till' in schema
                // mac: platform.mac, // mac is 'N/A-Web', not storing
                user: user.fullname, // For display on receipt?
                user_id: user._id,
                // other_details: {} // For any other fields not directly mapped
            };

            // Map to schema fields explicitly for clarity, items will be stringified by service
            let transactionPayload = {
                _id: data._id,
                date: data.date,
                status: data.status,
                user_id: data.user_id,
                till_id: data.till_id,
                customer_id: data.customer_id,
                customer_name: customer === 0 ? 'Walk in/Rideshare customer' : customer.name, // For convenience if needed
                ref_number: data.ref_number,
                total_amount: data.total,
                paid_amount: data.paid,
                change_amount: data.change,
                payment_method: data.payment_type,
                items: data.items, // Service will stringify this to items_json
                notes: data.notes, // Assuming notes might be added later
                other_details: { // Store fields not directly mapped to main columns
                    discount: data.discount,
                    subtotal: data.subtotal, // Subtotal before tax/discount might be useful
                    tax_amount: data.tax,    // Actual tax amount
                    order_type: data.order_type,
                    payment_info_client: data.payment_info, // Client-side payment info
                    original_user_display_name: data.user // if 'user' field was specifically for display
                }
            };


            (async () => { // Create an async IIFE to use await
                try {
                    if (method === 'POST') {
                        await TransactionService.createTransaction(transactionPayload);
                    } else { // PUT
                        await TransactionService.updateTransaction(transactionPayload._id, transactionPayload);
                    }

                    cart = [];
                    $('#viewTransaction').html('');
                    $('#viewTransaction').html(receipt); // Receipt uses global `settings`
                    $('#orderModal').modal('show');

                    // These load functions are now async
                    await loadProducts();
                    await loadCustomers();

                    $(".loading").hide();
                    $("#dueModal").modal('hide');
                    $("#paymentModel").modal('hide');

                    await $(this).getHoldOrders(); // Ensure this is async too
                    await $(this).getCustomerOrders(); // Ensure this is async too
                    $(this).renderTable(cart);

                } catch (error) {
                    console.error("Error submitting order:", error);
                    $(".loading").hide();
                    $("#dueModal").modal('toggle'); // Re-show modal on error?
                    Swal.fire("Something went wrong!", `Could not save transaction: ${error.message}. Please try again.`, 'error');
                }
            })();

            $("#refNumber").val('');
            $("#change").text('');
            $("#payment").val('');
        }

        // Initial load of hold orders (called once in original code)
        // This should now be async and likely called after initial data load or when needed.
        (async () => {
            try {
                const data = await TransactionService.getOnHoldTransactions();
                holdOrderList = data;
                holdOrderlocation.empty();
                clearInterval(dotInterval);
                $(this).randerHoldOrders(holdOrderList, holdOrderlocation, 1);
            } catch (error) {
                console.error("Error fetching initial on-hold orders:", error);
                Swal.fire("Error", "Could not fetch on-hold orders.", "error");
            }
        })();


        $.fn.getHoldOrders = async function () { // Made async
            try {
                const data = await TransactionService.getOnHoldTransactions();
                holdOrderList = data;
                clearInterval(dotInterval); // dotInterval might need to be managed more carefully if it's restarted elsewhere
                holdOrderlocation.empty();
                $(this).randerHoldOrders(holdOrderList, holdOrderlocation, 1);
            } catch (error) {
                console.error("Error in getHoldOrders:", error);
                Swal.fire("Error", "Could not refresh on-hold orders.", "error");
            }
        };

        // randerHoldOrders itself doesn't need to be async unless calculatePrice becomes async
        $.fn.randerHoldOrders = function (data, renderLocation, orderType) {
            $.each(data, function (index, order) {
                $(this).calculatePrice(order);
                renderLocation.append(
                    $('<div>', { class: orderType == 1 ? 'col-md-3 order' : 'col-md-3 customer-order' }).append(
                        $('<a>').append(
                            $('<div>', { class: 'card-box order-box' }).append(
                                $('<p>').append(
                                    $('<b>', { text: 'Ref :' }),
                                    $('<span>', { text: order.ref_number, class: 'ref_number' }),
                                    $('<br>'),
                                    $('<b>', { text: 'Price :' }),
                                    $('<span>', { text: order.total, class: "label label-info", style: 'font-size:14px;' }),
                                    $('<br>'),
                                    $('<b>', { text: 'Items :' }),
                                    $('<span>', { text: order.items.length }),
                                    $('<br>'),
                                    $('<b>', { text: 'Customer :' }),
                                    $('<span>', { text: order.customer != 0 ? order.customer.name : 'Walk in/Rideshare customer', class: 'customer_name' })
                                ),
                                $('<button>', { class: 'btn btn-danger del', onclick: '$(this).deleteOrder(' + index + ',' + orderType + ')' }).append(
                                    $('<i>', { class: 'fa fa-trash' })
                                ),

                                $('<button>', { class: 'btn btn-default', onclick: '$(this).orderDetails(' + index + ',' + orderType + ')' }).append(
                                    $('<span>', { class: 'fa fa-shopping-basket' })
                                )
                            )
                        )
                    )
                )
            })
        }


        $.fn.calculatePrice = function (data) {
            totalPrice = 0;
            $.each(data.products, function (index, product) {
                totalPrice += product.price * product.quantity;
            })

            let vat = (totalPrice * data.vat) / 100;
            totalPrice = ((totalPrice + vat) - data.discount).toFixed(0);

            return totalPrice;
        };


        $.fn.orderDetails = function (index, orderType) {

            $('#refNumber').val('');

            if (orderType == 1) {

                $('#refNumber').val(holdOrderList[index].ref_number);

                $("#customer option:selected").removeAttr('selected');

                $("#customer option").filter(function () {
                    return $(this).text() == "Walk in/Rideshare customer";
                }).prop("selected", true);

                holdOrder = holdOrderList[index]._id;
                cart = [];
                $.each(holdOrderList[index].items, function (index, product) {
                    item = {
                        id: product.id,
                        product_name: product.product_name,
                        sku: product.sku,
                        price: product.price,
                        quantity: product.quantity
                    };
                    cart.push(item);
                })
            } else if (orderType == 2) {

                $('#refNumber').val('');

                $("#customer option:selected").removeAttr('selected');

                $("#customer option").filter(function () {
                    return $(this).text() == customerOrderList[index].customer.name;
                }).prop("selected", true);


                holdOrder = customerOrderList[index]._id;
                cart = [];
                $.each(customerOrderList[index].items, function (index, product) {
                    item = {
                        id: product.id,
                        product_name: product.product_name,
                        sku: product.sku,
                        price: product.price,
                        quantity: product.quantity
                    };
                    cart.push(item);
                })
            }
            $(this).renderTable(cart);
            $("#holdOrdersModal").modal('hide');
            $("#customerModal").modal('hide');
        }


        $.fn.deleteOrder = function (index, type) {

            switch (type) {
                case 1: deleteId = holdOrderList[index]._id;
                    break;
                case 2: deleteId = customerOrderList[index]._id;
            }

            let data = {
                orderId: deleteId,
            }

            Swal.fire({
                title: "Delete order?",
                text: "This will delete the order. Are you sure you want to delete!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, delete it!'
            }).then(async (result) => { // Made async
                if (result.value) {
                    try {
                        // The original API took `data` which was `{ orderId: deleteId }`
                        // The new service function `deleteTransaction` just takes the ID.
                        await TransactionService.deleteTransaction(deleteId);

                        // Refresh lists (these are now async)
                        await $(this).getHoldOrders();
                        await $(this).getCustomerOrders();

                        Swal.fire('Deleted!', 'You have deleted the order!', 'success');
                    } catch (error) {
                        console.error("Error deleting order:", error);
                        $(".loading").hide(); // Ensure loading is hidden on error too
                        Swal.fire('Error', `Could not delete order: ${error.message}`, 'error');
                    }
                }
            });
        }

        $.fn.getCustomerOrders = async function () { // Made async
            try {
                const data = await TransactionService.getCustomerOrders();
                clearInterval(dotInterval);
                customerOrderList = data;
                customerOrderLocation.empty();
                $(this).randerHoldOrders(customerOrderList, customerOrderLocation, 2);
            } catch (error) {
                console.error("Error in getCustomerOrders:", error);
                Swal.fire("Error", "Could not fetch customer orders.", "error");
            }
        };

        $('#saveCustomer').on('submit', async function (e) { // Made async
            e.preventDefault();
            let custData = {
                _id: Math.floor(Date.now() / 1000), // Keep client-side ID generation for now
                name: $('#userName').val(),
                phone: $('#phoneNumber').val(),
                email: $('#emailAddress').val(),
                address: $('#userAddress').val()
            };

            try {
                const savedCustomer = await CustomerService.addCustomer(custData);
                $("#newCustomer").modal('hide');
                $('#saveCustomer').get(0).reset(); // Reset form
                Swal.fire("Customer added!", `${savedCustomer.name} added successfully!`, "success");

                // Update customer dropdown
                // The value stored needs to be stringified JSON as per original logic for easy parsing later
                const customerOptionValue = JSON.stringify({ id: savedCustomer._id, name: savedCustomer.name });
                $('#customer').append(
                    $('<option>', { text: savedCustomer.name, value: customerOptionValue, selected: 'selected' })
                );
                // If using Chosen plugin, it might need an update trigger:
                // $('#customer').trigger('chosen:updated');
                // For standard select, setting val should work or re-initialize if complex.
                $('#customer').val(customerOptionValue);


            } catch (error) {
                console.error("Error saving customer:", error);
                $("#newCustomer").modal('hide');
                Swal.fire('Error', `Something went wrong please try again: ${error.message}`, 'error');
            }
        })


        $("#confirmPayment").hide();

        $("#cardInfo").hide();
        $("#cardPaymentMethod").hide();

        $("#payment").on('input', function () {
            $(this).calculateChange();
        });


        /**
         * TODO: will invoke stripe.confirmCardPayment()
         */
        $("#confirmPayment").on('click',async function () {
            if ($('#payment').val() == "") {
                Swal.fire(
                    'Nope!',
                    'Please enter the amount that was paid!',
                    'warning'
                );
            }
            else {
                var client_secret = localStorage.getItem("client_secret");
                const {paymentIntent} = await globalThis.stripe.confirmCardPayment(
                    client_secret, {
                        payment_method: {
                            card: globalThis.cardElement
                        }
                    }
                )
                console.log(paymentIntent);
                if (paymentIntent.error) {
                    alert(paymentIntent.error.message);
                } else {
                    $(this).submitDueOrder(1);
                }
            }
        });


        $('#transactions').click(function () {
            loadTransactions();
            loadUserList();

            $('#pos_view').hide();
            $('#pointofsale').show();
            $('#transactions_view').show();
            $(this).hide();

        });


        $('#pointofsale').click(function () {
            $('#pos_view').show();
            $('#transactions').show();
            $('#transactions_view').hide();
            $(this).hide();
        });


        $("#viewRefOrders").click(function () {
            setTimeout(function () {
                $("#holdOrderInput").focus();
            }, 500);
        });


        $("#viewCustomerOrders").click(function () {
            setTimeout(function () {
                $("#holdCustomerOrderInput").focus();
            }, 500);
        });


        $('#newProductModal').click(function () {
            $('#saveProduct').get(0).reset();
            $('#current_img').text('');
        });


        $('#saveProduct').submit(async function (e) { // Made async
            e.preventDefault();

            const formData = $(this).serializeObject(); // Gets form data as an object
            const imageInput = $('#imagename')[0];
            const imageFile = (imageInput && imageInput.files && imageInput.files.length > 0) ? imageInput.files[0] : null;

            // Convert checkbox 'on' to boolean or 0/1 for stock
            formData.stock = formData.stock === 'on' ? 'on' : 'off'; // Keep 'on'/'off' as per original saveProduct logic expectation for 'stock' field mapping

            try {
                await InventoryService.saveProduct(formData, imageFile); // Assumes saveProduct can handle this structure and the file

                $('#saveProduct').get(0).reset();
                $('#current_img').html(''); // Clear previous image preview
                $('#imagename').show();    // Show file input again
                $('#rmv_img').hide();      // Hide remove image button

                await loadProducts(); // Refresh product list (already async)
                Swal.fire({
                    title: 'Product Saved',
                    text: "Select an option below to continue.",
                    icon: 'success',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Add another',
                    cancelButtonText: 'Close'
                }).then((result) => {
                    if (!result.value) {
                        $("#newProduct").modal('hide');
                    }
                });
            } catch (error) {
                console.error("Error saving product:", error);
                Swal.fire('Error', `Could not save product: ${error.message}`, 'error');
            }
        });



        $('#saveCategory').submit(async function (e) { // Made async
            e.preventDefault();
            const categoryData = $(this).serializeObject(); // { id: '...', name: '...' } or { name: '...' }

            try {
                if (!categoryData.id || categoryData.id === "") { // New category
                    await CategoryService.addCategory({ name: categoryData.name });
                } else { // Update existing category
                    await CategoryService.updateCategory({ id: categoryData.id, name: categoryData.name });
                }

                $('#saveCategory').get(0).reset();
                $('#category_id').val(''); // Explicitly clear hidden ID field
                await loadCategories(); // Refresh category list (async)
                await loadProducts();   // Refresh products as categories might affect display (async)

                Swal.fire({
                    title: 'Category Saved',
                    text: "Select an option below to continue.",
                    icon: 'success',
                    showCancelButton: true,
                    confirmButtonColor: '#3085d6',
                    cancelButtonColor: '#d33',
                    confirmButtonText: 'Add another',
                    cancelButtonText: 'Close'
                }).then((result) => {
                    if (!result.value) {
                        $("#newCategory").modal('hide');
                    }
                });
            } catch (error) {
                console.error("Error saving category:", error);
                Swal.fire('Error', `Could not save category: ${error.message}`, 'error');
            }
        });


        $.fn.editProduct = function (index) {

            $('#Products').modal('hide');

            $("#category option").filter(function () {
                return $(this).val() == allProducts[index].category;
            }).prop("selected", true);

            $('#productName').val(allProducts[index].name);
            $('#product_price').val(allProducts[index].price);
            $('#quantity').val(allProducts[index].quantity);

            $('#product_id').val(allProducts[index]._id);
            $('#img').val(allProducts[index].img);

            $('#productUnit').val(allProducts[index].unit);
            $('#lotNumber').val(allProducts[index].lotnumber);

            if (allProducts[index].img != "") {

                $('#imagename').hide();
                $('#current_img').html(`<img src="${img_path + allProducts[index].img}" alt="">`);
                $('#rmv_img').show();
            }

            if (allProducts[index].stock == 0) {
                $('#stock').prop("checked", true);
            }

            $('#newProduct').modal('show');
        }


        $("#userModal").on("hide.bs.modal", function () {
            $('.perms').hide();
        });


        $.fn.editUser = function (index) {

            user_index = index;

            $('#Users').modal('hide');

            $('.perms').show();

            $("#user_id").val(allUsers[index]._id);
            $('#fullname').val(allUsers[index].fullname);
            $('#username').val(allUsers[index].username);
            $('#password').val(atob(allUsers[index].password));

            if (allUsers[index].perm_products == 1) {
                $('#perm_products').prop("checked", true);
            }
            else {
                $('#perm_products').prop("checked", false);
            }

            if (allUsers[index].perm_categories == 1) {
                $('#perm_categories').prop("checked", true);
            }
            else {
                $('#perm_categories').prop("checked", false);
            }

            if (allUsers[index].perm_transactions == 1) {
                $('#perm_transactions').prop("checked", true);
            }
            else {
                $('#perm_transactions').prop("checked", false);
            }

            if (allUsers[index].perm_users == 1) {
                $('#perm_users').prop("checked", true);
            }
            else {
                $('#perm_users').prop("checked", false);
            }

            if (allUsers[index].perm_settings == 1) {
                $('#perm_settings').prop("checked", true);
            }
            else {
                $('#perm_settings').prop("checked", false);
            }

            $('#userModal').modal('show');
        }


        $.fn.editCategory = function (index) {
            $('#Categories').modal('hide');
            $('#categoryName').val(allCategories[index].name);
            $('#category_id').val(allCategories[index]._id);
            $('#newCategory').modal('show');
        }


        $.fn.deleteProduct = function (id) {
            Swal.fire({
                title: 'Are you sure?',
                text: "You are about to delete this product.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, delete it!'
            }).then(async (result) => { // Made async
                if (result.value) {
                    try {
                        await InventoryService.deleteProduct(id);
                        await loadProducts(); // Refresh list (async)
                        Swal.fire('Done!', 'Product deleted', 'success');
                    } catch (error) {
                        console.error("Error deleting product:", error);
                        Swal.fire('Error', `Could not delete product: ${error.message}`, 'error');
                    }
                }
            });
        }

        $.fn.deleteUser = function (id) {
            if (id === 1 || id === '1') { // Prevent deletion of default admin user
                Swal.fire('Cannot Delete', 'The default admin user (ID 1) cannot be deleted.', 'warning');
                return;
            }
            Swal.fire({
                title: 'Are you sure?',
                text: "You are about to delete this user.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, delete!'
            }).then(async (result) => { // Made async
                if (result.value) {
                    try {
                        await UserService.deleteUser(id);
                        await loadUserList(); // Refresh list (async)
                        Swal.fire('Done!', 'User deleted', 'success');
                    } catch (error) {
                        console.error("Error deleting user:", error);
                        Swal.fire('Error', `Could not delete user: ${error.message}`, 'error');
                    }
                }
            });
        }

        $.fn.deleteCategory = function (id) {
            Swal.fire({
                title: 'Are you sure?',
                text: "You are about to delete this category.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Yes, delete it!'
            }).then(async (result) => { // Made async
                if (result.value) {
                   try {
                        await CategoryService.deleteCategory(id);
                        await loadCategories(); // Refresh list (async)
                        await loadProducts(); // Products might be affected by category deletion in UI
                        Swal.fire('Done!', 'Category deleted', 'success');
                    } catch (error) {
                        console.error("Error deleting category:", error);
                        Swal.fire('Error', `Could not delete category: ${error.message}`, 'error');
                    }
                }
            });
        }


        $('#productModal').click(function () {
            loadProductList();
        });


        $('#usersModal').click(function () {
            loadUserList();
        });


        $('#categoryModal').click(function () {
            loadCategoryList();
        });


        function loadUserList() {

            let counter = 0;
            let user_list = '';
            $('#user_list').empty();
            $('#userList').DataTable().destroy();

            // $.get(api + 'users/all', function (users) { // Old call
            try {
                const users = await UserService.getAllUsers();
                allUsers = [...users]; // Update global allUsers

                if (!users || users.length === 0) {
                    $('#user_list').html('<tr><td colspan="4">No users found.</td></tr>');
                    // Initialize DataTable even if empty for consistency, or handle appropriately
                     $('#userList').DataTable({"order": [[1, "desc"]], "autoWidth": false, "info": true, "JQueryUI": true, "ordering": true, "paging": false });
                    return;
                }

                users.forEach((user, index) => {
                    state = []; // Ensure state is reset for each user
                    let class_name = '';

                    if (user.status != "") {
                        state = user.status.split("_");

                        switch (state[0]) {
                            case 'Logged In': class_name = 'btn-default';
                                break;
                            case 'Logged Out': class_name = 'btn-light';
                                break;
                        }
                    }

                    counter++;
                    user_list += `<tr>
            <td>${user.fullname}</td>
            <td>${user.username}</td>
            <td class="${class_name}">${state.length > 0 ? state[0] : ''} <br><span style="font-size: 11px;"> ${state.length > 0 ? moment(state[1]).format('hh:mm A DD MMM YYYY') : ''}</span></td>
            <td>${user._id == 1 ? '<span class="btn-group"><button class="btn btn-dark"><i class="fa fa-edit"></i></button><button class="btn btn-dark"><i class="fa fa-trash"></i></button></span>' : '<span class="btn-group"><button onClick="$(this).editUser(' + index + ')" class="btn btn-warning"><i class="fa fa-edit"></i></button><button onClick="$(this).deleteUser(' + user._id + ')" class="btn btn-danger"><i class="fa fa-trash"></i></button></span>'}</td></tr>`;

                    if (counter == users.length) {

                        $('#user_list').html(user_list);

                        $('#userList').DataTable({
                            "order": [[1, "desc"]]
                            , "autoWidth": false
                            , "info": true
                            , "JQueryUI": true
                            , "ordering": true
                            , "paging": false
                        });
                    }

                });
            } catch (error) {
                console.error("Error loading user list:", error);
                Swal.fire('Error', 'Could not load user list.', 'error');
                 $('#user_list').html('<tr><td colspan="4">Error loading users.</td></tr>');
                 $('#userList').DataTable({"order": [[1, "desc"]], "autoWidth": false, "info": true, "JQueryUI": true, "ordering": true, "paging": false });
            }
            // }); // End of old $.get
        }


        // loadProductList is already async from previous changes, ensure settings symbol is handled if settings is null initially.
        async function loadProductList() {
            let products = [...allProducts]; // Assumes allProducts is already populated by an async call
            let product_list = '';
            let counter = 0;
            $('#product_list').empty();
            if ($.fn.DataTable.isDataTable('#productList')) {
                $('#productList').DataTable().destroy();
            }


            products.forEach((product, index) => {
                counter++;
                let category = allCategories.find(cat => cat._id == product.category); // Use find for single item

                product_list += `<tr>
            <td><img id="barcode_${product._id}"></td> <!-- Ensure unique ID for barcode elements -->
            <td><img style="max-height: 50px; max-width: 50px; border: 1px solid #ddd;" src="${product.img == "" || !product.img ? "./assets/images/default.jpg" : img_path + product.img}" id="product_img_list_${product._id}"></td>
            <td>${product.name}</td>
            <td>${(settings ? settings.symbol : '$')}${product.price}</td>
            <td>${product.stock == 1 ? product.quantity : 'N/A'}</td>
            <td>${category ? category.name : 'N/A'}</td>
            <td class="nobr"><span class="btn-group"><button onClick="$(this).editProduct(${index})" class="btn btn-warning btn-sm"><i class="fa fa-edit"></i></button><button onClick="$(this).deleteProduct(${product._id})" class="btn btn-danger btn-sm"><i class="fa fa-trash"></i></button></span></td></tr>`;
            });

            $('#product_list').html(product_list);

            // Generate barcodes after table is populated
            products.forEach(pro => {
                if (pro._id) { // Ensure pro has an id
                     try {
                        $("#barcode_" + pro._id).JsBarcode(pro._id.toString(), { // Ensure value is a string for JsBarcode
                            width: 2,
                            height: 25,
                            fontSize: 14,
                            displayValue: false // Often better for lists not to display value if space is tight
                        });
                    } catch (e) {
                        console.error("JsBarcode error for product ID", pro._id, e);
                        $("#barcode_" + pro._id).text('Error'); // Show error in place of barcode
                    }
                }
            });

            $('#productList').DataTable({
                "order": [[2, "asc"]], // Order by name perhaps
                "autoWidth": false,
                "info": true,
                "JQueryUI": true,
                "ordering": true,
                "paging": false // Kept as false from original
            });
        }


        // loadCategoryList is already async from previous changes
        async function loadCategoryList() {

            let category_list = '';
            let counter = 0;
            $('#category_list').empty();
            $('#categoryList').DataTable().destroy();

            allCategories.forEach((category, index) => {

                counter++;

                category_list += `<tr>
     
            <td>${category.name}</td>
            <td><span class="btn-group"><button onClick="$(this).editCategory(${index})" class="btn btn-warning"><i class="fa fa-edit"></i></button><button onClick="$(this).deleteCategory(${category._id})" class="btn btn-danger"><i class="fa fa-trash"></i></button></span></td></tr>`;
            });

            if (counter == allCategories.length) {

                $('#category_list').html(category_list);
                $('#categoryList').DataTable({
                    "autoWidth": false
                    , "info": true
                    , "JQueryUI": true
                    , "ordering": true
                    , "paging": false

                });
            }
        }

        var terminal = StripeTerminal.create({
        onFetchConnectionToken: fetchConnectionToken,
        onUnexpectedReaderDisconnect: unexpectedDisconnect,
        });

        function unexpectedDisconnect() {
        // In this function, your app should notify the user that the reader disconnected.
        // You can also include a way to attempt to reconnect to a reader.
        console.log("Disconnected from reader")
        }

        async function fetchConnectionToken() { // Made async
            // Do not cache or hardcode the ConnectionToken. The SDK manages the ConnectionToken's lifecycle.
            // api = 'http://' + host + ':' + port + '/api/'; // Removed
            try {
                // This now calls the stubbed/client-side adapted PaymentService function
                const response = await PaymentService.createTerminalConnectionToken();
                if (response.status === 'error' || !response.secret) {
                    console.error("Failed to fetch connection token:", response.message);
                    throw new Error(response.message || "Could not fetch Stripe Terminal connection token.");
                }
                return response.secret;
            } catch (error) {
                console.error("Error in fetchConnectionToken:", error);
                // Propagate error to StripeTerminal.create to handle
                throw error;
            }
        }


        $.fn.serializeObject = function () {
            var o = {};
            var a = this.serializeArray();
            $.each(a, function () {
                if (o[this.name]) {
                    if (!o[this.name].push) {
                        o[this.name] = [o[this.name]];
                    }
                    o[this.name].push(this.value || '');
                } else {
                    o[this.name] = this.value || '';
                }
            });
            return o;
        };



        $('#log-out').click(function () {

            Swal.fire({
                title: 'Are you sure?',
                text: "You are about to log out.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Logout'
            }).then(async (result) => { // Added async here
                if (result.value) {
                    try {
                        await UserService.logoutUser(user._id);
                        // Clear client-side user state
                        user = {};
                        // Instead of ipcRenderer.send('app-reload', ''), reload the window for a web app.
                        window.location.reload();
                    } catch (err) {
                        console.error("Logout error:", err);
                        Swal.fire('Error', 'Logout failed. Please try again.', 'error');
                    }
                }
            });
        });



        $('#settings_form').on('submit', async function (e) { // Added async
            e.preventDefault();
            let formData = $(this).serializeObject();
            // let mac_address; // macaddress.one removed

            // api = 'http://' + host + ':' + port + '/api/'; // Removed

            // macaddress.one(function (err, mac) { // Removed
            //     mac_address = mac;
            // });

            formData['app'] = $('#app').find('option:selected').text();
            // formData['mac'] = mac_address; // Removed
            formData['mac'] = 'N/A-Web'; // Set placeholder for web
            // formData['till'] = 1; // This might be part of settings already, or configurable

            $('#settings_form').append('<input type="hidden" name="app" value="' + formData.app + '" />');

            if (formData.percentage != "" && !$.isNumeric(formData.percentage)) {
                Swal.fire('Oops!', 'Please make sure the tax value is a number', 'warning');
            } else {
                // storage.set('settings', formData); // Removed electron-store

                // $(this).attr('action', api + 'settings/post'); // Removed
                // $(this).attr('method', 'POST'); // Removed

                // Directly call the service function
                try {
                    // Pass the existing image name if not changed, and the new file if provided
                    const imageFile = $('#logoname')[0].files ? $('#logoname')[0].files[0] : null;
                    await SettingsService.saveSettings(formData, imageFile); // Pass file if necessary

                    // ipcRenderer.send('app-reload', ''); // Replaced
                    Swal.fire('Settings Saved!', 'Reloading application...', 'success').then(() => {
                        window.location.reload();
                    });

                } catch (error) {
                    console.error("Error saving settings:", error);
                    Swal.fire('Error', `Could not save settings: ${error.message}`, 'error');
                }
            }
        });



        $('#net_settings_form').on('submit', async function (e) { // Added async
            e.preventDefault();
            let formData = $(this).serializeObject();

            if (formData.till == 0 || formData.till == 1) {
                Swal.fire('Oops!', 'Please enter a number greater than 1.', 'warning');
            } else {
                if (isNumeric(formData.till)) {
                    formData['app'] = $('#app').find('option:selected').text();
                    formData['mac'] = 'N/A-Web'; // Placeholder for mac
                    // storage.set('settings', formData); // Removed electron-store

                    // This form seems to save a subset of settings, potentially to what was 'platform'
                    // For web, we'd likely merge this into the main settings object.
                    // For now, let's assume it updates parts of the main settings.
                    try {
                        const currentSettings = await SettingsService.getSettings();
                        const updatedAppSettings = {
                            ...currentSettings, // Preserve existing settings
                            app: formData.app,
                            ip: formData.ip, // Assuming 'ip' is for a server if this mode is used
                            till: formData.till,
                            mac: formData.mac // N/A-Web
                        };
                        // Re-save the whole settings object
                        await SettingsService.saveSettings(updatedAppSettings); // This needs to map to the full settings structure expected by saveSettings

                        Swal.fire('Network Settings Saved!', 'Reloading application...', 'success').then(() => {
                            window.location.reload();
                        });
                    } catch (error) {
                         console.error("Error saving network settings:", error);
                         Swal.fire('Error', `Could not save network settings: ${error.message}`, 'error');
                    }

                } else {
                    Swal.fire('Oops!', 'Till number must be a number!', 'warning');
                }
            }
        });



        $('#saveUser').on('submit', async function (e) { // Added async
            e.preventDefault();
            let formData = $(this).serializeObject();

            // Password validation logic (remains similar, but atob might not be needed if passwords aren't re-encoded before display)
            let currentPasswordForComparison = ownUserEdit ? user.password : (allUsers[user_index] ? allUsers[user_index].password : '');
            // Assuming passwords in DB are already btoa encoded. If not, atob is wrong here.
            // For new flow, password in form is raw, service encodes it.

            let passwordCheckPassed = false;
            if (formData.password === formData.pass) { // Check if new passwords match
                 passwordCheckPassed = true;
                 // If it's an existing user and password field is empty, it means don't change password.
                 // The service function for saveUser should handle this (e.g. if password field is empty, don't update it).
                 if (!formData.password && formData.id) { // Existing user, empty password field
                    // No new password provided, don't try to validate it against itself
                 } else if (formData.password) {
                    // New password provided, validated it matches confirmation
                 }

            } else if (formData.password && formData.password !== formData.pass) {
                 Swal.fire('Oops!', 'New passwords do not match!', 'warning');
                 return;
            } else { // No new password, or password field empty
                passwordCheckPassed = true; // No new password to check, or means don't update.
            }


            if (passwordCheckPassed) {
                try {
                    const savedUserData = await UserService.saveUser(formData); // saveUser handles btoa internally now

                    if (ownUserEdit && user._id.toString() === formData.id.toString()) { // If current user edited themselves
                         // Update local user object if needed, then reload for changes to take effect
                         user = { ...user, ...savedUserData }; // Or re-fetch user data
                         Swal.fire('Profile Updated!', 'Reloading application...', 'success').then(() => {
                            window.location.reload();
                         });
                    } else {
                        $('#userModal').modal('hide');
                        await loadUserList(); // Refresh user list in the UI
                        $('#Users').modal('show');
                        Swal.fire('Ok!', 'User details saved!', 'success');
                    }
                } catch (error) {
                    console.error("Error saving user:", error);
                    Swal.fire('Error', `Could not save user: ${error.message}`, 'error');
                }
            }
        });



        $('#app').change(function () {
            if ($(this).find('option:selected').text() == 'Network Point of Sale Terminal') {
                $('#net_settings_form').show(500);
                $('#settings_form').hide(500);
                // macaddress.one removed
                $("#mac").val('N/A-Web');
            }
            else {
                $('#net_settings_form').hide(500);
                $('#settings_form').show(500);
            }
        });



        $('#cashier').click(function () {
            ownUserEdit = true;
            $('#userModal').modal('show');
            $("#user_id").val(user._id);
            $("#fullname").val(user.fullname);
            $("#username").val(user.username);
            $("#password").val(atob(user.password)); // Display decoded for editing; service will re-encode
        });



        $('#add-user').click(function () {
            // platform.app check might need adjustment if 'platform' structure changes
            if (!platform || platform.app !== 'Network Point of Sale Terminal') {
                $('.perms').show();
            }
            $("#saveUser").get(0).reset();
            $('#user_id').val(''); // Ensure ID is cleared for new user
            $('#userModal').modal('show');
        });


        $('#settings').click(function () {
            // platform might not be fully populated here yet if settings haven't been fetched.
            // This relies on settings being available.
            if (settings && platform && platform.app == 'Network Point of Sale Terminal') {
                $('#net_settings_form').show(500);
                $('#settings_form').hide(500);

                $("#ip").val(platform.ip);
                $("#till").val(platform.till);
                $("#mac").val('N/A-Web'); // macaddress.one removed

                $("#app option").filter(function () {
                    return $(this).text() == platform.app;
                }).prop("selected", true);
            }
            else if (settings) { // Assuming settings are loaded
                $('#net_settings_form').hide(500);
                $('#settings_form').show(500);

                $("#settings_id").val("1"); // This is implicit for the settings table
                $("#store").val(settings.store);
                $("#address_one").val(settings.address_one);
                $("#address_two").val(settings.address_two);
                $("#contact").val(settings.contact);
                $("#tax").val(settings.tax);
                $("#symbol").val(settings.symbol);
                $("#currency").val(settings.currency);
                $("#percentage").val(settings.percentage);
                $("#footer").val(settings.footer);
                $("#logo_img").val(settings.img); // This is for hidden field, actual image display below

                if(settings.stripe) { // Check if stripe settings exist
                    $("#stripeMerchantCategory").val(settings.stripe.category);
                    $("#stripestatus").prop("checked", settings.stripe.live);
                    $("#stripeLivePublishable").val(settings.stripe.publishable ? settings.stripe.publishable.live : '');
                    $("#stripeLiveSecret").val(settings.stripe.secret ? settings.stripe.secret.live : '');
                    $("#stripeTestPublishable").val(settings.stripe.publishable ? settings.stripe.publishable.test : '');
                    $("#stripeTestSecret").val(settings.stripe.secret ? settings.stripe.secret.test : '');
                    if (settings.stripe.terminal && settings.stripe.terminal.locationid) {
                        $('#stripeTerminalLiveLocationID').val(settings.stripe.terminal.locationid.live);
                        $('#stripeTerminalTestLocationID').val(settings.stripe.terminal.locationid.test);
                    } else {
                        $('#stripeTerminalLiveLocationID').val('');
                        $('#stripeTerminalTestLocationID').val('');
                    }
                }


                if (settings.charge_tax == 'on' || settings.charge_tax === true) { // Check boolean true as well
                    $('#charge_tax').prop("checked", true);
                } else {
                    $('#charge_tax').prop("checked", false);
                }

                if (settings.img && settings.img !== "") {
                    $('#logoname').hide();
                    // Ensure img_path is correct for web deployment
                    $('#current_logo').html(`<img src="${img_path + settings.img}" alt="logo">`);
                    $('#rmv_logo').show();
                } else {
                    $('#current_logo').html('');
                    $('#logoname').show();
                    $('#rmv_logo').hide();
                }


                $("#app option").filter(function () { // settings.app might not exist, handle gracefully
                    return $(this).text() == (settings.app || 'Standalone Point of Sale');
                }).prop("selected", true);
            } else {
                 Swal.fire("Loading...", "Settings are not yet loaded. Please wait.", "info");
            }
        });


    });


    $('#rmv_logo').click(function () {
        $('#remove_logo').val("1"); // Hidden input to signal removal
        $('#current_logo').hide(500).html('');
        $(this).hide(500);
        $('#logoname').show(500).val(''); // Clear file input
    });


    $('#rmv_img').click(function () {
        $('#remove_img').val("1"); // Hidden input to signal removal
        $('#current_img').hide(500).html('');
        $(this).hide(500);
        $('#imagename').show(500).val(''); // Clear file input
    });


    $('#print_list').click(function () {
        if (!window.html2canvas || !window.jsPDF) {
            Swal.fire("Error", "PDF generation library not loaded.", "error");
            return;
        }

        $("#loading").show();
        const oldTable = $('#productList').DataTable();
        const pageInfo = oldTable.page.info();
        oldTable.page.len(-1).draw(); // Show all entries for printing

        // const filename = path.join(os.homedir(),'.storepos/productList.pdf'); // Path specific calls removed

        html2canvas($('#all_products').get(0), { scale: 2 }) // Improve resolution
            .then(canvas => {
                let pdf = new window.jsPDF({ // Use window.jsPDF
                    orientation: 'p',
                    unit: 'mm',
                    format: 'a4'
                });
                const imgProps= pdf.getImageProperties(canvas);
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
                let currentPosition = 0;
                const pageHeight = pdf.internal.pageSize.getHeight() - 20; // 10mm margin top/bottom

                while (currentPosition < pdfHeight) {
                    pdf.addImage(canvas, 'PNG', 10, -currentPosition + 10 , pdfWidth - 20, pdfHeight);
                    currentPosition += pageHeight;
                    if (currentPosition < pdfHeight) {
                         pdf.addPage();
                    }
                }

                $("#loading").hide();
                pdf.save('productList.pdf'); // Triggers browser download

                // Restore DataTable pagination
                oldTable.page.len(pageInfo.length).draw();
                oldTable.page(pageInfo.page).draw(false);
            })
            .catch(err => {
                console.error("Error generating PDF:", err);
                Swal.fire("Error", "Could not generate PDF.", "error");
                $("#loading").hide();
                 // Restore DataTable pagination even on error
                oldTable.page.len(pageInfo.length).draw();
                oldTable.page(pageInfo.page).draw(false);
            });
    });

}


$.fn.print = function () {
    if (!window.printJS) {
         Swal.fire("Error", "Printing library not loaded.", "error");
        return;
    }
    printJS({ printable: receipt, type: 'raw-html' });
}


function loadTransactions() {

    let tills = [];
    let users = [];
    let sales = 0;
    let transact = 0;
    let unique = 0;

    sold_items = [];
    sold = [];

    let counter = 0;
    let transaction_list = '';
    // let query = `by-date?start=${start_date}&end=${end_date}&user=${by_user}&status=${by_status}&till=${by_till}`; // Old query string
    const filters = {
        start: start_date, // Should be ISO string
        end: end_date,     // Should be ISO string
        user: by_user,
        status: by_status,
        till: by_till
    };

    try {
        const transactions = await TransactionService.getTransactionsByDate(filters);

        if (transactions && transactions.length > 0) {
            $('#transaction_list').empty();
            if ($.fn.DataTable.isDataTable('#transactionList')) {
                $('#transactionList').DataTable().destroy();
            }

            allTransactions = [...transactions]; // Global variable

            transactions.forEach((trans, index) => {
                sales += parseFloat(trans.total_amount || trans.total); // Use new field name
                transact++;

                // trans.items should already be an array from rowsFromSqliteOutput helper
                (trans.items || []).forEach(item => {
                    sold_items.push(item);
                });

                if (!tills.includes(trans.till_id || trans.till)) { // Use new field name
                    tills.push(trans.till_id || trans.till);
                }

                if (!users.includes(trans.user_id)) {
                    users.push(trans.user_id);
                }

                counter++;
                // Adjust fields based on new transaction structure from service/DB
                transaction_list += `<tr>
                                <td>${trans._id || trans.order}</td>
                                <td class="nobr">${moment(trans.date).format('YYYY MMM DD hh:mm:ss')}</td>
                                <td>${(settings ? settings.symbol : '$')}${parseFloat(trans.total_amount || trans.total).toFixed(2)}</td>
                                <td>${trans.paid_amount == "" || typeof trans.paid_amount === 'undefined' ? "" : (settings ? settings.symbol : '$') + parseFloat(trans.paid_amount).toFixed(2)}</td>
                                <td>${trans.change_amount ? (settings ? settings.symbol : '$') + Math.abs(trans.change_amount).toFixed(2) : ''}</td>
                                <td>${trans.paid_amount == "" || typeof trans.paid_amount === 'undefined' ? "" : (trans.payment_method || (trans.payment_type == 0 ? "Cash" : 'Card'))}</td>
                                <td>${trans.till_id || trans.till}</td>
                                <td>${trans.user_fullname || trans.user}</td>
                                <td>${trans.paid_amount == "" || typeof trans.paid_amount === 'undefined' ? '<button class="btn btn-dark btn-sm"><i class="fa fa-search-plus"></i></button>' : '<button onClick="$(this).viewTransaction(' + index + ')" class="btn btn-info btn-sm"><i class="fa fa-search-plus"></i></button></td>'}</tr>
                    `;
            }); // Removed the if (counter == transactions.length) block from here, will process after loop

            // Process after loop
            $('#total_sales #counter').text((settings ? settings.symbol : '$') + parseFloat(sales).toFixed(2));
            $('#total_transactions #counter').text(transact);

            const result = {};
            for (const { product_name, price, quantity, id } of sold_items) {
                if (!result[product_name]) result[product_name] = [];
                result[product_name].push({ id, price, quantity });
            }

            sold = []; // Clear previous sold array before repopulating
            for (const itemName in result) {
                let price = 0;
                let quantity = 0;
                let id = 0;
                result[itemName].forEach(i => {
                    id = i.id;
                    price = i.price; // Assuming price here is unit price
                    quantity += i.quantity;
                });
                sold.push({ id: id, product: itemName, qty: quantity, price: price });
            }

            loadSoldProducts(); // This function populates #product_sales

            if (by_user == 0 && by_till == 0) {
                userFilter(users);
                tillFilter(tills);
            }

            $('#transaction_list').html(transaction_list);
            $('#transactionList').DataTable({
                "order": [[1, "desc"]],
                "autoWidth": false,
                "info": true,
                "JQueryUI": true,
                "ordering": true,
                "paging": true,
                "dom": 'Bfrtip', // Ensure Buttons extension is loaded if using this
                "buttons": ['csv', 'excel', 'pdf'] // Ensure these DataTables extensions are included
            });

        } else {
            $('#transaction_list').empty();
            if ($.fn.DataTable.isDataTable('#transactionList')) {
                $('#transactionList').DataTable().destroy();
            }
            $('#transaction_list').html('<tr><td colspan="9">No transactions available within the selected criteria.</td></tr>');
            // Optionally re-initialize DataTable for empty state with message
             $('#transactionList').DataTable({
                "order": [[1, "desc"]], "autoWidth": false, "info": true, "JQueryUI": true, "ordering": true, "paging": true,
                "dom": 'Bfrtip', "buttons": ['csv', 'excel', 'pdf'], "language": { "emptyTable": "No transactions found" }
            });

            // Clear summary fields if no transactions
            $('#total_sales #counter').text((settings ? settings.symbol : '$') + '0.00');
            $('#total_transactions #counter').text(0);
            $('#total_items #counter').text(0);
            $('#total_products #counter').text(0);
            $('#product_sales').empty();


            Swal.fire('No data!', 'No transactions available within the selected criteria', 'warning');
        }
    } catch (error) {
        console.error("Error loading transactions:", error);
        Swal.fire('Error', `Could not load transactions: ${error.message}`, 'error');
         $('#transaction_list').html('<tr><td colspan="9">Error loading transactions.</td></tr>');
    }
}


function discend(a, b) {
    if (a.qty > b.qty) {
        return -1;
    }
    if (a.qty < b.qty) {
        return 1;
    }
    return 0;
}


function loadSoldProducts() {

    sold.sort(discend);

    let counter = 0;
    let sold_list = '';
    let items = 0;
    let products = 0;
    $('#product_sales').empty();

    sold.forEach((item, index) => {

        items += item.qty;
        products++;

        let product = allProducts.filter(function (selected) {
            return selected._id == item.id;
        });

        counter++;

        sold_list += `<tr>
            <td>${item.product}</td>
            <td>${item.qty}</td>
            <td>${product[0].stock == 1 ? product.length > 0 ? product[0].quantity : '' : 'N/A'}</td>
            <td>${settings.symbol + (item.qty * parseFloat(item.price)).toFixed(2)}</td>
            </tr>`;

        if (counter == sold.length) {
            $('#total_items #counter').text(items);
            $('#total_products #counter').text(products);
            $('#product_sales').html(sold_list);
        }
    });
}


function userFilter(users) {

    $('#users').empty();
    $('#users').append(`<option value="0">All</option>`);

    users.forEach(user => {
        let u = allUsers.filter(function (usr) {
            return usr._id == user;
        });

        $('#users').append(`<option value="${user}">${u[0].fullname}</option>`);
    });

}


function tillFilter(tills) {

    $('#tills').empty();
    $('#tills').append(`<option value="0">All</option>`);
    tills.forEach(till => {
        $('#tills').append(`<option value="${till}">${till}</option>`);
    });

}


$.fn.viewTransaction = function (index) {

    transaction_index = index;

    let discount = allTransactions[index].discount;
    let customer = allTransactions[index].customer == 0 ? 'Walk in/Rideshare customer' : allTransactions[index].customer.username;
    let refNumber = allTransactions[index].ref_number != "" ? allTransactions[index].ref_number : allTransactions[index].order;
    let orderNumber = allTransactions[index].order;
    let type = "";
    let tax_row = "";
    let items = "";
    let products = allTransactions[index].items;

    products.forEach(item => {
        items += "<tr><td>" + item.product_name + "</td><td>" + item.quantity + "</td><td>" + settings.symbol + parseFloat(item.price).toFixed(2) + "</td></tr>";

    });


    switch (allTransactions[index].payment_type) {

        case 2: type = "Card";
            break;

        default: type = "Cash";

    }


    if (allTransactions[index].paid != "") {
        payment = `<tr>
                    <td>Paid</td>
                    <td>:</td>
                    <td>${settings.symbol + allTransactions[index].paid}</td>
                </tr>
                <tr>
                    <td>Change</td>
                    <td>:</td>
                    <td>${settings.symbol + Math.abs(allTransactions[index].change).toFixed(2)}</td>
                </tr>
                <tr>
                    <td>Method</td>
                    <td>:</td>
                    <td>${type}</td>
                </tr>`
    }



    if (settings.charge_tax) {
        tax_row = `<tr>
                <td>Vat(${settings.percentage})% </td>
                <td>:</td>
                <td>${settings.symbol}${parseFloat(allTransactions[index].tax).toFixed(2)}</td>
            </tr>`;
    }



    receipt = `<div style="font-size: 10px;">                            
        <p style="text-align: center;">
        ${settings.img == "" ? settings.img : '<img style="max-width: 50px;max-width: 100px;" src ="' + img_path + settings.img + '" /><br>'}
            <span style="font-size: 22px;">${settings.store}</span> <br>
            ${settings.address_one} <br>
            ${settings.address_two} <br>
            ${settings.contact != '' ? 'Tel: ' + settings.contact + '<br>' : ''} 
            ${settings.tax != '' ? 'Vat No: ' + settings.tax + '<br>' : ''} 
    </p>
    <hr>
    <left>
        <p>
        Invoice : ${orderNumber} <br>
        Ref No : ${refNumber} <br>
        Customer : ${allTransactions[index].customer == 0 ? 'Walk in/Rideshare customer' : allTransactions[index].customer.name} <br>
        Cashier : ${allTransactions[index].user} <br>
        Date : ${moment(allTransactions[index].date).format('DD MMM YYYY HH:mm:ss')}<br>
        </p>

    </left>
    <hr>
    <table width="100%">
        <thead style="text-align: left;">
        <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Price</th>
        </tr>
        </thead>
        <tbody>
        ${items}                
 
        <tr>                        
            <td><b>Subtotal</b></td>
            <td>:</td>
            <td><b>${settings.symbol}${allTransactions[index].subtotal}</b></td>
        </tr>
        <tr>
            <td>Discount</td>
            <td>:</td>
            <td>${discount > 0 ? settings.symbol + parseFloat(allTransactions[index].discount).toFixed(2) : ''}</td>
        </tr>
        
        ${tax_row}
    
        <tr>
            <td><h3>Total</h3></td>
            <td><h3>:</h3></td>
            <td>
                <h3>${settings.symbol}${allTransactions[index].total}</h3>
            </td>
        </tr>
        ${payment == 0 ? '' : payment}
        </tbody>
        </table>
        <br>
        <hr>
        <br>
        <p style="text-align: center;">
         ${settings.footer}
         </p>
        </div>`;

    $('#viewTransaction').html('');
    $('#viewTransaction').html(receipt);

    $('#orderModal').modal('show');

}


$('#status').change(function () {
    by_status = $(this).find('option:selected').val();
    loadTransactions();
});



$('#tills').change(function () {
    by_till = $(this).find('option:selected').val();
    loadTransactions();
});


$('#users').change(function () {
    by_user = $(this).find('option:selected').val();
    loadTransactions();
});


$('#reportrange').on('apply.daterangepicker', function (ev, picker) {

    start = picker.startDate.format('DD MMM YYYY hh:mm A');
    end = picker.endDate.format('DD MMM YYYY hh:mm A');

    start_date = picker.startDate.toDate().toJSON();
    end_date = picker.endDate.toDate().toJSON();


    loadTransactions();
});


function authenticate() {
    $('#loading').append(
        `<div id="load"><form id="account"><div class="form-group"><input type="text" placeholder="Username" name="username" class="form-control"></div>
        <div class="form-group"><input type="password" placeholder="Password" name="password" class="form-control"></div>
        <div class="form-group"><input type="submit" class="btn btn-block btn-default" value="Login"></div></form>`
    );
}


    $('body').on("submit", "#account", async function (e) { // Added async
        e.preventDefault();
        let formData = $(this).serializeObject();

        if (formData.username == "" || formData.password == "") {
            Swal.fire('Incomplete form!', auth_empty, 'warning');
            return;
        }

        try {
            const loggedInUser = await UserService.loginUser(formData.username, formData.password);

            if (loggedInUser && loggedInUser._id) {
                user = loggedInUser; // Populate global user variable
                // auth = true; // Simple global auth flag, not using electron-store

                // Hide login form, show main app, load initial data
                $("#loading").hide();
                $(".main_app").show();
                await loadInitialData(); // Call the main data loading function

                // Original code reloaded the app via ipcRenderer.send('app-reload', '');
                // For a web app, if a full reload isn't strictly necessary after login and data load,
                // we can just proceed. If a clean state is desired, window.location.reload() could be used
                // but ideally the UI updates dynamically. For now, dynamic update is assumed.
                console.log("Login successful, app loaded.");

            } else {
                Swal.fire('Oops!', auth_error, 'warning');
            }
        } catch (error) {
            console.error("Login error:", error);
            Swal.fire('Login Failed!', error.message || 'An unexpected error occurred during login.', 'error');
        }
    });


$('#quit').click(function () {
    Swal.fire({
        title: 'Are you sure?',
        text: "You are about to close the application.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Close Application'
    }).then((result) => {

        if (result.value) {
            ipcRenderer.send('app-quit', '');
        }
    });
});


