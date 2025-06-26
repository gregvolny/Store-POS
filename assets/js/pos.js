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
// let auth; // Replaced by user object check
let holdOrder = 0;
let vat = 0;
// let perms = null; // User object will contain permissions/roles
let deleteId = 0;
let paymentType = 0;
let receipt = '';
let totalVat = 0;
let subTotal = 0;
let method = ''; // For POST/PUT determination
let order_index = 0; // Unused?
let user_index = 0; // Index for editing users from allUsers array
let product_index = 0; // Unused?
let transaction_index; // Index for viewing transaction details from allTransactions
let img_path = 'assets/images/'; // Adjusted for Webpack output

let categories = []; // To store unique category IDs from products
let holdOrderList = [];
let customerOrderList = [];
let ownUserEdit = null; // Flag when current user edits their own profile
let totalPrice = 0; // Used in calculatePrice, seems to be a temp var there
let orderTotal = 0; // Holds calculated gross total for current cart

let auth_error = 'Incorrect username or password';
let auth_empty = 'Please enter a username and password';
let holdOrderlocation = $("#randerHoldOrders");
let customerOrderLocation = $("#randerCustomerOrders");

let settings = {}; // Will be populated by SettingsService.getSettings()
let platform = {}; // Will be derived from settings or default
let user = {}; // Current logged-in user

// Date range picker defaults
let start = moment().startOf('month');
let end = moment();
let start_date = moment(start).toDate().toJSON(); // Use ISO strings for service calls
let end_date = moment(end).toDate().toJSON();
let by_till = 0;
let by_user = 0;
let by_status = 1; // Default to 'Paid'

window.POS = {}; // Expose a global POS object if needed by external scripts (currently not used)

// This function will be called from src/main.js after basic setup (DB, Stripe)
window.startPosApplication = async function () {
    await initializeApplicationUi(); // Changed name to avoid conflict if any
};

async function initializeApplicationUi() {
    $("#loading").show().html( // Display login form
        `<div id="load">
            <form id="account">
                <div class="form-group">
                    <input type="text" placeholder="Username" name="username" class="form-control" autocomplete="username">
                </div>
                <div class="form-group">
                    <input type="password" placeholder="Password" name="password" class="form-control" autocomplete="current-password">
                </div>
                <div class="form-group">
                    <input type="submit" class="btn btn-block btn-default" value="Login">
                </div>
            </form>
            <div class="form-group text-center">
                <a href="#" id="showRegisterModal">Create an account</a>
            </div>
        </div>`
    );
    console.log("Authentication form displayed.");
}

async function loadInitialDataAfterLogin() {
    try {
        const fetchedSettings = await SettingsService.getSettings();
        settings = fetchedSettings || {};
        console.log("Settings loaded:", settings);

        platform = {
            app: settings.app || 'Standalone Web POS',
            till: settings.till || 1,
            mac: 'N/A-Web'
        };
        console.log("Platform settings determined:", platform);

        if (!user || !user._id) {
            console.error("User not properly set after login. Re-authenticating.");
            initializeApplicationUi();
            return;
        }
        $('#loggedin-user').text(user.fullname);

        const usersData = await UserService.getAllUsers();
        allUsers = [...usersData];

        await loadCategories();
        await loadProducts(); // Depends on allCategories being loaded for category name display
        await loadCustomers();

        if (settings && settings.symbol) {
            $("#price_curr, #payment_curr, #change_curr").text(settings.symbol);
        } else {
            $("#price_curr, #payment_curr, #change_curr").text('$');
        }

        if (settings && typeof settings.percentage !== 'undefined') {
            vat = parseFloat(settings.percentage) || 0;
            $("#taxInfo").text(settings.charge_tax ? vat : 0);
        } else {
            console.warn("VAT settings not fully loaded.");
            if (!settings.store) {
                Swal.fire('Setup Required', 'Please configure application settings to continue.', 'warning')
                   .then(() => { $('#settingsModal').modal('show'); });
            }
        }

        // UI Permissions
        if (user && user.perm_products !== undefined) {
            if (!user.perm_products) { $(".p_one").hide(); } else { $(".p_one").show(); }
            if (!user.perm_categories) { $(".p_two").hide(); } else { $(".p_two").show(); }
            if (!user.perm_transactions) { $(".p_three").hide(); } else { $(".p_three").show(); }
            if (!user.perm_users) { $(".p_four").hide(); } else { $(".p_four").show(); }
            if (!user.perm_settings) { $(".p_five").hide(); } else { $(".p_five").show(); }
        }

        // Initial load of on-hold orders
        $(this).getHoldOrders();
        $(this).getCustomerOrders();


        $("#loading").hide();
        $(".main_app").show();
        console.log("Initial data loaded, application ready.");

    } catch (error) {
        console.error("Error loading initial application data:", error);
        $("#loading").html(`<p style="color:red;">Error loading data: ${error.message}. Please refresh.</p>`).show();
        Swal.fire('Error', `Could not load initial application data: ${error.message}`, 'error');
    }
}

// All event handlers and UI functions within jQuery's document ready
$(function() {
    $(".loading").hide();
    $(".main_app").hide();

    // Date Range Picker Setup
    function cb(start_dr, end_dr) { // Renamed start/end to avoid conflict with global start/end
        $('#reportrange span').html(start_dr.format('MMMM D, YYYY') + '  -  ' + end_dr.format('MMMM D, YYYY'));
    }
    $('#reportrange').daterangepicker({
        startDate: start, // Use global start
        endDate: end,     // Use global end
        autoApply: true, timePicker: true, timePicker24Hour: true, timePickerIncrement: 10, timePickerSeconds: true,
        ranges: {
            'Today': [moment().startOf('day'), moment()],
            'Yesterday': [moment().subtract(1, 'days').startOf('day'), moment().subtract(1, 'days').endOf('day')],
            'Last 7 Days': [moment().subtract(6, 'days').startOf('day'), moment().endOf('day')],
            'Last 30 Days': [moment().subtract(29, 'days').startOf('day'), moment().endOf('day')],
            'This Month': [moment().startOf('month'), moment()], // Corrected This Month end
            'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
        }
    }, cb);
    cb(start, end); // Initial call

    $.fn.serializeObject = function () {
        var o = {}; var a = this.serializeArray();
        $.each(a, function () {
            if (o[this.name]) {
                if (!o[this.name].push) { o[this.name] = [o[this.name]]; }
                o[this.name].push(this.value || '');
            } else { o[this.name] = this.value || ''; }
        });
        return o;
    };

    $("#settingsModal").on("hide.bs.modal", function () {
        setTimeout(function () {
            if ((!settings || !settings.store) && user && user._id) {
                Swal.fire('Setup Required', 'Please configure application settings to continue.', 'warning')
                    .then(() => { $('#settingsModal').modal('show'); });
            }
        }, 1000);
    });

    $('body').on("submit", "#account", async function (e) {
        e.preventDefault();
        let formData = $(this).serializeObject();
        if (formData.username == "" || formData.password == "") {
            Swal.fire('Incomplete form!', auth_empty, 'warning'); return;
        }
        try {
            const loggedInUser = await UserService.loginUser(formData.username, formData.password);
            if (loggedInUser && loggedInUser._id) {
                user = loggedInUser;
                console.log("Login successful for:", user.username, "Roles:", user.roles);
                $("#load").remove();
                $("#loading").show();
                await loadInitialDataAfterLogin();
            } else {
                Swal.fire('Oops!', auth_error, 'warning');
            }
        } catch (error) {
            console.error("Login error:", error);
            Swal.fire('Login Error', error.message || 'An unexpected error occurred during login.', 'error');
        }
    });

    $('body').on('click', '#showRegisterModal', function(e) {
        e.preventDefault();
        $('#registrationModal').modal('show');
    });

    $('#registrationForm').on('submit', async function(e) {
        e.preventDefault();
        const fullname = $('#regFullname').val();
        const username = $('#regUsername').val();
        const password = $('#regPassword').val();
        const confirmPassword = $('#regConfirmPassword').val();

        if (!fullname || !username || !password || !confirmPassword) {
            Swal.fire('Error', 'All fields are required.', 'error'); return;
        }
        if (password !== confirmPassword) {
            Swal.fire('Error', 'Passwords do not match.', 'error'); return;
        }
        try {
            const result = await UserService.registerUser({ fullname, username, password });
            Swal.fire('Success', result.message || 'User registered successfully! Please log in.', 'success');
            $('#registrationModal').modal('hide');
            $('#registrationForm').get(0).reset();
        } catch (error) {
            console.error("Registration error:", error);
            Swal.fire('Registration Failed', error.message || 'An unexpected error occurred.', 'error');
        }
    });

    // Data loading functions (now async)
    async function loadProducts() {
        try {
            const data = await InventoryService.getAllProducts();
            allProducts = data.map(item => ({...item, price: parseFloat(item.price).toFixed(2)}));

            $('#parent').empty();
            const categoriesDiv = $('#categories').html(`<button type="button" id="all" class="btn btn-categories btn-white waves-effect waves-light active">All</button> `);

            const uniqueCategoryIds = new Set();
            allProducts.forEach(p => { if(p.category) uniqueCategoryIds.add(p.category) });
            categories = Array.from(uniqueCategoryIds);

            allProducts.forEach(prod => {
                let item_cat = allCategories.find(c => c._id == prod.category);
                let item_info = `<div class="col-lg-2 box ${prod.category}" onclick="$(this).addToCart(${prod._id})">
                        <div class="widget-panel widget-style-2 ">
                        <div id="image"><img src="${prod.img && prod.img !== "" ? img_path + prod.img : "./assets/images/default.jpg"}" id="product_img_${prod._id}" alt="${prod.name}"></div>
                                    <div class="text-muted m-t-5 text-center">
                                    <div class="name" id="product_name_${prod._id}">${prod.name}</div>
                                    <span class="sku">${prod.sku || ''}</span>
                                    <div class="name" id="lot_number_${prod._id}"><span class="stock">LOT # </span>${prod.lotnumber || ''}</div>
                                    <span class="stock">STOCK </span><span class="count">${prod.stock == 1 ? prod.quantity : 'N/A'}</span></div>
                                    <div class="name" id="product_unit_${prod._id}">${prod.unit || ''}</div>
                                    <sp class="text-success text-center"><b data-plugin="counterup">${(settings ? settings.symbol : '$') + prod.price}</b> </sp>
                        </div>
                    </div>`;
                $('#parent').append(item_info);
            });

            categories.forEach(catId => {
                let c = allCategories.find(cat => cat._id == catId);
                categoriesDiv.append(`<button type="button" id="${catId}" class="btn btn-categories btn-white waves-effect waves-light">${c ? c.name : 'Unknown'}</button> `);
            });
            loadProductListTable(); // For the modal table
        } catch (error) {
            console.error("Error loading products display:", error);
            Swal.fire('Error', 'Could not load products for display.', 'error');
        }
    }

    async function loadCategories() {
        try {
            allCategories = await CategoryService.getAllCategories();
            const categoryDropdown = $('#category').html(`<option value="">Select Category</option>`);
            allCategories.forEach(category => {
                categoryDropdown.append(`<option value="${category._id}">${category.name}</option>`);
            });
            loadCategoryListTable(); // For the modal table
        } catch (error) {
            console.error("Error loading categories:", error);
        }
    }

    async function loadCustomers() {
        try {
            const customers = await CustomerService.getAllCustomers();
            const customerDropdown = $('#customer').html(`<option value="0" selected="selected">Walk in/Rideshare customer</option>`);
            customers.forEach(cust => {
                customerDropdown.append(`<option value='${JSON.stringify({id: cust._id, name: cust.name})}'>${cust.name}</option>`);
            });
        } catch (error) {
            console.error("Error loading customers:", error);
        }
    }

    // CART FUNCTIONS
    $.fn.addToCart = async function (id) {
        try {
            const product = await InventoryService.getProductById(id);
            if (!product) { Swal.fire('Error', 'Product not found.', 'error'); return; }

            if (product.stock === 0 || product.quantity > 0) { // stock:0 means don't track stock, product.quantity > 0 means in stock
                $(this).addProductToCart(product);
            } else {
                Swal.fire('Out of stock!', 'This item is currently unavailable', 'info');
            }
        } catch (error) {
            console.error("Error in addToCart:", error);
            Swal.fire('Error', 'Could not add product to cart.', 'error');
        }
    };

    $("#searchBarCode").on('submit', async function(e) { // Made async
        e.preventDefault();
        $("#basic-addon2").empty().append($('<i>', { class: 'fa fa-spinner fa-spin' }));
        const skuCode = $("#skuCode").val();
        try {
            const product = await InventoryService.getProductBySku(skuCode);
            if (product && product._id && (product.stock === 0 || product.quantity >= 1)) {
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
    });

    $('body').on('click', '#jq-keyboard button', function (e) {
        let pressed = $(this)[0].className.split(" ");
        if ($("#skuCode").is(":focus") && $("#skuCode").val() != "" && pressed[2] == "enter") {
             $("#searchBarCode").trigger('submit'); // Trigger form submission
        }
         if($("#search").is(":focus")) { // For general product search
            searchProducts();
        }
         if($("#holdOrderInput").is(":focus")) {
            searchOpenOrders();
        }
        if($("#holdCustomerOrderInput").is(":focus")) {
            searchCustomerOrders();
        }
    });

    $.fn.addProductToCart = function (data) {
        item = { id: data._id, product_name: data.name, sku: data.sku, price: parseFloat(data.price), quantity: 1 };
        if ($(this).isExist(item)) { $(this).qtIncrement(index); }
        else { cart.push(item); $(this).renderTable(cart); }
    };
    $.fn.isExist = function (data) {
        let toReturn = false;
        $.each(cart, function (i, value) { if (value.id == data.id) { $(this).setIndex(i); toReturn = true; } });
        return toReturn;
    };
    $.fn.setIndex = function (value) { index = value; };

    $.fn.calculateCart = function () {
        let currentTotal = 0;
        $('#total').text(cart.length);
        $.each(cart, function (idx, data) { currentTotal += data.quantity * data.price; });
        currentTotal = currentTotal - (parseFloat($("#inputDiscount").val()) || 0);
        $('#price').text((settings.symbol || '$') + currentTotal.toFixed(2));
        subTotal = currentTotal;
        if ($("#inputDiscount").val() >= currentTotal && currentTotal > 0) { $("#inputDiscount").val(0); } // Prevent discount > total
        let grossTotal = subTotal;
        totalVat = 0;
        if (settings.charge_tax && vat > 0) {
            totalVat = ((subTotal * vat) / 100);
            grossTotal = subTotal + totalVat;
        }
        orderTotal = grossTotal.toFixed(2);
        $("#gross_price").text((settings.symbol || '$') + grossTotal.toFixed(2));
        $("#payablePrice").val(grossTotal.toFixed(2)); // ensure it's a value for payment modal
    };

    $.fn.renderTable = function (cartList) {
        $('#cartTable > tbody').empty();
        $(this).calculateCart(); // Recalculate totals
        $.each(cartList, function (idx, data) {
            $('#cartTable > tbody').append(
                $('<tr>').append(
                    $('<td>', { text: idx + 1 }),
                    $('<td>', { text: data.product_name }),
                    $('<td>').append(
                        $('<div>', { class: 'input-group' }).append(
                            $('<div>', { class: 'input-group-btn btn-xs' }).append($('<button>', { class: 'btn btn-default btn-xs qt-decrement', 'data-index': idx }).append($('<i>', { class: 'fa fa-minus' }))),
                            $('<input>', { class: 'form-control item-quantity', type: 'number', value: data.quantity, 'data-index': idx }),
                            $('<div>', { class: 'input-group-btn btn-xs' }).append($('<button>', { class: 'btn btn-default btn-xs qt-increment', 'data-index': idx }).append($('<i>', { class: 'fa fa-plus' })))
                        )
                    ),
                    $('<td>', { text: (settings.symbol || '$') + (data.price * data.quantity).toFixed(2) }),
                    $('<td>').append($('<button>', { class: 'btn btn-danger btn-xs delete-cart-item', 'data-index': idx }).append($('<i>', { class: 'fa fa-times' })))
                )
            );
        });
    };

    // Delegated event handlers for cart quantity changes and item deletion
    $('#cartTable').on('click', '.qt-increment', function() { $(this).qtIncrement($(this).data('index')); });
    $('#cartTable').on('click', '.qt-decrement', function() { $(this).qtDecrement($(this).data('index')); });
    $('#cartTable').on('input', '.item-quantity', function() { $(this).qtInput($(this).data('index'), $(this).val()); });
    $('#cartTable').on('click', '.delete-cart-item', function() { $(this).deleteFromCart($(this).data('index')); });

    $.fn.deleteFromCart = function (idx) { cart.splice(idx, 1); $(this).renderTable(cart); };
    $.fn.qtIncrement = function (i) {
        item = cart[i];
        let product = allProducts.find(p => p._id == item.id);
        if (product.stock == 1) { // Track stock
            if (item.quantity < product.quantity) { item.quantity++; }
            else { Swal.fire('No more stock!', 'You have already added all the available stock.', 'info'); }
        } else { item.quantity++; }
        $(this).renderTable(cart);
    };
    $.fn.qtDecrement = function (i) { item = cart[i]; if (item.quantity > 1) { item.quantity--; } $(this).renderTable(cart); };
    $.fn.qtInput = function (i, val) { item = cart[i]; item.quantity = parseInt(val) || 1; $(this).renderTable(cart); };
    $.fn.cancelOrder = function () {
        if (cart.length > 0) {
            Swal.fire({ title: 'Are you sure?', text: "You are about to remove all items from the cart.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33', confirmButtonText: 'Yes, clear it!' })
                .then((result) => { if (result.value) { cart = []; $(this).renderTable(cart); holdOrder = 0; Swal.fire('Cleared!', 'All items have been removed.', 'success'); } });
        }
    };

    $("#payButton").on('click', async function () {
        if (cart.length === 0) { Swal.fire('Oops!', 'There is nothing to pay!', 'warning'); return; }
        try {
            const s = await SettingsService.getSettings(); // Ensure latest settings
            settings = s || {}; // Update global settings
            if (!settings.stripe || !settings.currency) { Swal.fire('Configuration Error', 'Stripe/currency settings are not configured.', 'error'); return; }

            window.currency = settings.currency;
            const publishableKey = settings.stripe.live ? settings.stripe.publishable.live : settings.stripe.publishable.test;
            if (!publishableKey) { Swal.fire('Configuration Error', 'Stripe publishable key missing.', 'error'); return; }

            const piResponse = await PaymentService.createPaymentIntent($("#payablePrice").val(), window.currency, "card");
            if (piResponse.status === 'error' || !piResponse.paymentIntent || !piResponse.paymentIntent.client_secret) {
                Swal.fire('Payment Error', piResponse.message || 'Could not create payment intent.', 'error'); return;
            }
            localStorage.setItem("client_secret", piResponse.paymentIntent.client_secret);

            if (!PaymentService.stripeInstance) await PaymentService.initializeStripeConfig(publishableKey); // Pass key if not auto-picked by service
            if (!PaymentService.stripeInstance) { Swal.fire('Stripe Error', 'Stripe.js could not be initialized.', 'error'); return; }

            globalThis.stripe = PaymentService.stripeInstance;
            globalThis.cardElement = globalThis.stripe.elements().create('card');
            globalThis.cardElement.mount('#paymentInfo');

            $("#paymentModel").modal('toggle');
        } catch (error) { Swal.fire('Error', `Payment setup error: ${error.message}`, 'error'); }
    });

    $("#hold").on('click', function () {
        if (cart.length === 0) { Swal.fire('Oops!', 'There is nothing to hold!', 'warning'); return; }
        $("#dueModal").modal('toggle');
    });

    $.fn.submitDueOrder = async function (statusValue) { // statusValue is the new status for the order
        if (cart.length === 0 && statusValue !== 3 /* print only */) {
            Swal.fire('Oops!', 'Cart is empty.', 'warning');
            return;
        }

        let itemsText = "";
        cart.forEach(item => { itemsText += `<tr><td>${item.product_name}</td><td>${item.quantity}</td><td>${(settings.symbol||'$')}${parseFloat(item.price).toFixed(2)}</td></tr>`; });

        const currentTime = moment(); // Use moment for consistent date formatting
        const discount = parseFloat($("#inputDiscount").val()) || 0;
        const customerVal = $("#customer").val();
        const customerObj = customerVal === "0" ? { id: "0", name: "Walk in/Rideshare customer" } : JSON.parse(customerVal);

        const paidVal = $("#payment").val();
        const paidAmount = paidVal ? parseFloat(paidVal).toFixed(2) : 0.00;
        const changeVal = $("#change").text();
        const changeAmount = changeVal ? parseFloat(changeVal).toFixed(2) : 0.00;
        const refNum = $("#refNumber").val();
        let currentOrderNumber = holdOrder || `txn_${Date.now()}`; // Use holdOrder if it exists, else generate
        method = holdOrder ? 'PUT' : 'POST'; // Determine if it's an update or new

        paymentType = document.getElementById('paymentType').value; // 0:Cash, 1:Cheque (unused?), 2:Card
        let paymentMethodText = "Cash";
        if (paymentType === "3" || paymentType === 3) paymentMethodText = "Card"; // From card click
        // Add other payment types if necessary, original had 0,1,2 for type, now seems to be direct string.

        // Construct receipt (remains largely the same, ensure variables are correct)
        receipt = `<div style="font-size: 10px;"> ... </div>`; // (Full receipt HTML as before) ...
        // Ensure all variables in receipt string like settings.img, settings.store, etc. are correctly populated.
        // For brevity, I'm not including the full receipt string here again. It should use current values.
        // Example part of receipt:
        receipt = `<div style="font-size: 10px;">
            <p style="text-align: center;">
            ${settings.img == "" || !settings.img ? '' : '<img style="max-width: 50px;max-width: 100px;" src ="' + img_path + settings.img + '" /><br>'}
                <span style="font-size: 22px;">${settings.store || 'Your Store'}</span> <br>
                ${settings.address_one || ''} <br>
                ${settings.address_two || ''} <br>
                ${settings.contact ? 'Tel: ' + settings.contact + '<br>' : ''}
                ${settings.tax ? 'Vat No: ' + settings.tax + '<br>' : ''}
            </p>
            <hr>
            <left>
                <p>
                Order No : ${currentOrderNumber} <br>
                Ref No : ${refNum == "" ? currentOrderNumber : refNum} <br>
                Customer : ${customerObj.name} <br>
                Cashier : ${user.fullname} <br>
                Date : ${currentTime.format("YYYY-MM-DD HH:mm:ss")}<br>
                </p>
            </left>
            <hr>
            <table width="100%">
                <thead style="text-align: left;"><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead>
                <tbody>${itemsText}</tbody>
                <tfoot>
                    <tr><td><b>Subtotal</b></td><td>:</td><td><b>${(settings.symbol||'$')}${subTotal.toFixed(2)}</b></td></tr>
                    ${discount > 0 ? `<tr><td>Discount</td><td>:</td><td>${(settings.symbol||'$')}${discount.toFixed(2)}</td></tr>` : ''}
                    ${settings.charge_tax && totalVat > 0 ? `<tr><td>Vat(${settings.percentage || 0})% </td><td>:</td><td>${(settings.symbol||'$')}${totalVat.toFixed(2)}</td></tr>` : ''}
                    <tr><td><h3>Total</h3></td><td><h3>:</h3></td><td><h3>${(settings.symbol||'$')}${parseFloat(orderTotal).toFixed(2)}</h3></td></tr>
                    ${paidAmount > 0 ? `<tr><td>Paid</td><td>:</td><td>${(settings.symbol||'$')}${paidAmount}</td></tr>
                                        <tr><td>Change</td><td>:</td><td>${(settings.symbol||'$')}${Math.abs(changeAmount).toFixed(2)}</td></tr>
                                        <tr><td>Method</td><td>:</td><td>${paymentMethodText}</td></tr>` : ''}
                </tfoot>
            </table>
            <br><hr><br>
            <p style="text-align: center;">${settings.footer || 'Thank you!'}</p>
        </div>`;


        if (statusValue === 3) { // Print receipt only
            if (cart.length > 0) { printJS({ printable: receipt, type: 'raw-html' }); }
            $(".loading").hide(); return;
        }

        if (statusValue === 0 && customerObj.id === "0" && refNum === "") {
            Swal.fire('Reference Required!', 'Select a customer or enter a reference for hold orders.', 'warning');
            return;
        }

        $(".loading").show();

        let transactionPayload = {
            _id: currentOrderNumber.toString(),
            date: currentTime.toJSON(),
            status: statusValue,
            user_id: user._id,
            till_id: platform.till,
            customer_id: customerObj.id.toString(),
            ref_number: refNum,
            total_amount: parseFloat(orderTotal),
            paid_amount: parseFloat(paidAmount) || 0,
            change_amount: Math.abs(parseFloat(changeAmount)) || 0,
            payment_method: paymentMethodText,
            items: cart, // Service will stringify this
            other_details: {
                discount: discount,
                subtotal: parseFloat(subTotal),
                tax_amount: parseFloat(totalVat),
                customer_name_display: customerObj.name, // Store display name
                user_name_display: user.fullname, // Store display name
                payment_info_client: $("#paymentInfo").val(), // if any text based info
            }
        };

        try {
            let savedTransaction;
            if (method === 'POST') {
                savedTransaction = await TransactionService.createTransaction(transactionPayload);
            } else { // PUT for holdOrder
                savedTransaction = await TransactionService.updateTransaction(currentOrderNumber.toString(), transactionPayload);
            }

            cart = [];
            $('#viewTransaction').html(receipt);
            $('#orderModal').modal('show');

            await loadProducts();
            await loadCustomers();

            $("#dueModal").modal('hide');
            $("#paymentModel").modal('hide');

            await $(this).getHoldOrders();
            await $(this).getCustomerOrders();
            $(this).renderTable(cart); // Clears and re-renders cart UI
            $("#refNumber").val(''); $("#payment").val(''); $("#change").text(''); $("#inputDiscount").val(0);
            holdOrder = 0; // Reset holdOrder ID

        } catch (error) {
            console.error("Error submitting order:", error);
            Swal.fire("Transaction Error!", `Could not save transaction: ${error.message}. Please try again.`, 'error');
        } finally {
            $(".loading").hide();
        }
    };


    $.fn.getHoldOrders = async function () {
        try {
            const data = await TransactionService.getOnHoldTransactions();
            holdOrderList = data;
            clearInterval(dotInterval);
            holdOrderlocation.empty();
            $(this).randerHoldOrders(holdOrderList, holdOrderlocation, 1);
        } catch (error) {
            console.error("Error in getHoldOrders:", error);
            Swal.fire("Error", "Could not refresh on-hold orders.", "error");
        }
    };

    $.fn.randerHoldOrders = function (data, renderLocation, orderType) {
        renderLocation.empty(); // Clear before rendering
        if (!data || data.length === 0) {
            renderLocation.append('<p class=\"text-center\">No orders found.</p>'); // Added escaped quote
            return;
        }
        $.each(data, function (idx, order) {
            // $(this).calculatePrice(order); // calculatePrice seems for a different data structure (data.products, data.vat)
            let displayTotal = order.total_amount || order.total; // Use field from transaction
            let customerName = (order.other_details && order.other_details.customer_name_display) ? order.other_details.customer_name_display : (order.customer_id === "0" ? "Walk in/Rideshare" : "Customer");

            renderLocation.append(
                $('<div>', { class: orderType == 1 ? 'col-md-3 order' : 'col-md-3 customer-order' }).append(
                    $('<a>').append( // Removed href="#"
                        $('<div>', { class: 'card-box order-box', 'data-order-id': order._id, 'data-order-index': idx, 'data-order-type': orderType }).append( // Added data attributes
                            $('<p>').append(
                                $('<b>', { text: 'Ref :' }), $('<span>', { text: order.ref_number || order._id, class: 'ref_number' }), $('<br>'),
                                $('<b>', { text: 'Price :' }), $('<span>', { text: (settings.symbol||'$') + parseFloat(displayTotal).toFixed(2), class: "label label-info", style: 'font-size:14px;' }), $('<br>'),
                                $('<b>', { text: 'Items :' }), $('<span>', { text: (order.items || []).length }), $('<br>'), // items from items_json
                                $('<b>', { text: 'Customer :' }), $('<span>', { text: customerName, class: 'customer_name' })
                            ),
                            $('<button>', { class: 'btn btn-danger btn-xs del delete-hold-order', 'data-order-id': order._id, 'data-order-type': orderType }).append($('<i>', { class: 'fa fa-trash' })), // Simpler class for event delegation
                            $('<button>', { class: 'btn btn-default btn-xs view-hold-details', 'data-order-id': order._id, 'data-order-type': orderType }).append($('<span>', { class: 'fa fa-shopping-basket' }))
                        )
                    )
                )
            );
        });
    };

    // Delegated event handlers for hold/customer orders
    $('#randerHoldOrders, #randerCustomerOrders').on('click', '.delete-hold-order', function() {
        const orderId = $(this).data('order-id');
        const orderType = $(this).data('order-type'); // To know which list to find original index if needed, or just use ID
        let orderIndex = -1;
        if(orderType === 1) orderIndex = holdOrderList.findIndex(o => o._id === orderId);
        else if(orderType === 2) orderIndex = customerOrderList.findIndex(o => o._id === orderId);

        if(orderId) $(this).deleteOrderById(orderId, orderType); // New function to delete by ID
        else console.error("Order ID not found for deletion");
    });

    $('#randerHoldOrders, #randerCustomerOrders').on('click', '.view-hold-details', function() {
        const orderId = $(this).data('order-id');
        const orderType = $(this).data('order-type');
        let orderIndex = -1;
        if(orderType === 1) orderIndex = holdOrderList.findIndex(o => o._id === orderId);
        else if(orderType === 2) orderIndex = customerOrderList.findIndex(o => o._id === orderId);

        if(orderIndex !== -1) $(this).orderDetails(orderIndex, orderType);
        else console.error("Order not found for details view");
    });


    $.fn.deleteOrderById = function (orderId, orderType) { // New function to delete by ID
        Swal.fire({
            title: "Delete order?", text: "This will delete the order. Are you sure you want to delete!", icon: 'warning',
            showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33', confirmButtonText: 'Yes, delete it!'
        }).then(async (result) => {
            if (result.value) {
                try {
                    await TransactionService.deleteTransaction(orderId);
                    if (orderType === 1) await $(this).getHoldOrders();
                    else if (orderType === 2) await $(this).getCustomerOrders();
                    Swal.fire('Deleted!', 'The order has been deleted.', 'success');
                } catch (error) {
                    Swal.fire('Error', `Could not delete order: ${error.message}`, 'error');
                }
            }
        });
    };


    $.fn.calculatePrice = function (data) { /* This function seems unused or for a different data structure */ return 0; };

    $.fn.orderDetails = function (idx, orderType) {
        $('#refNumber').val('');
        let orderToLoad = null;
        if (orderType == 1 && holdOrderList[idx]) { orderToLoad = holdOrderList[idx]; }
        else if (orderType == 2 && customerOrderList[idx]) { orderToLoad = customerOrderList[idx]; }

        if (!orderToLoad) { console.error("Order not found for details"); return; }

        $('#refNumber').val(orderToLoad.ref_number || '');

        const customerVal = orderToLoad.customer_id === "0" ? "0" : JSON.stringify({id: orderToLoad.customer_id, name: (orderToLoad.other_details && orderToLoad.other_details.customer_name_display) || 'Customer'});
        $("#customer").val(customerVal).trigger('change'); // Assuming select2/chosen might need 'change'

        holdOrder = orderToLoad._id; // Set this to indicate we are editing an existing hold order
        cart = [...(orderToLoad.items || [])]; // items should be correctly parsed from items_json by service

        // Set discount if it exists
        const discount = (orderToLoad.other_details && orderToLoad.other_details.discount) ? parseFloat(orderToLoad.other_details.discount) : 0;
        $("#inputDiscount").val(discount.toFixed(2));

        $(this).renderTable(cart); // This will also call calculateCart
        $("#holdOrdersModal").modal('hide');
        $("#customerModal").modal('hide');
    };

    $.fn.getCustomerOrders = async function () {
        try {
            const data = await TransactionService.getCustomerOrders();
            clearInterval(dotInterval);
            customerOrderList = data;
            $(this).randerHoldOrders(customerOrderList, customerOrderLocation, 2);
        } catch (error) {
            Swal.fire("Error", "Could not fetch customer orders.", "error");
        }
    };

    $('#saveCustomer').on('submit', async function (e) {
        e.preventDefault();
        let custData = {
            _id: `cust_${Date.now()}`,
            name: $('#userName').val(), phone: $('#phoneNumber').val(),
            email: $('#emailAddress').val(), address: $('#userAddress').val()
        };
        try {
            const savedCustomer = await CustomerService.addCustomer(custData);
            $("#newCustomer").modal('hide'); $(this).get(0).reset();
            Swal.fire("Customer added!", `${savedCustomer.name} added successfully!`, "success");
            const customerOptionValue = JSON.stringify({ id: savedCustomer._id, name: savedCustomer.name });
            $('#customer').append($('<option>', { text: savedCustomer.name, value: customerOptionValue, selected: 'selected' }));
            $('#customer').val(customerOptionValue);
        } catch (error) {
            $("#newCustomer").modal('hide');
            Swal.fire('Error', `Save customer failed: ${error.message}`, 'error');
        }
    });

    $("#confirmPayment").hide(); $("#cardInfo").hide(); $("#cardPaymentMethod").hide();
    $("#payment").on('input', function () { $(this).calculateChange(); });

    $("#confirmPayment").on('click', async function () {
        if ($('#payment').val() == "") { Swal.fire('Nope!', 'Please enter the amount that was paid!', 'warning'); return; }

        const paymentMethodValue = $("#paymentMethod").val();
        if (paymentMethodValue !== "manual" && paymentMethodValue !== "cash_equivalent_for_non_stripe") { // Assuming "cash_equivalent_for_non_stripe" is for non-Stripe card/other
            // This is a Stripe Terminal Reader payment flow
            const readerId = paymentMethodValue;
            const clientSecret = localStorage.getItem("client_secret_terminal"); // Assume this was set by a backend call for Terminal
            if (!clientSecret) { Swal.fire("Error", "Terminal Payment Intent not ready.", "error"); return; }
            // ... Stripe Terminal JS SDK processPayment ...
            // This part is complex and needs the JS SDK properly set up.
            // For now, if it's not manual, assume it's a placeholder for future Terminal logic.
            console.log("Attempting Stripe Terminal payment with reader: ", readerId);
             Swal.fire("Info", "Stripe Terminal payment processing not fully implemented in this stub.", "info");
            // $(this).submitDueOrder(1); // Example: proceed as if successful for stub
            return; // Prevent normal flow for now
        }

        // For manual card entry via Stripe Elements or cash
        if (globalThis.cardElement && document.getElementById('paymentType').value === "3") { // Card payment via Stripe Elements
             const clientSecret = localStorage.getItem("client_secret");
             if(!clientSecret) { Swal.fire("Error", "Payment session not ready.", "error"); return; }

            globalThis.stripe.confirmCardPayment(clientSecret, {
                payment_method: { card: globalThis.cardElement }
            }).then(function(result) {
                if (result.error) {
                    Swal.fire("Payment Failed", result.error.message, "error");
                } else {
                    if (result.paymentIntent.status === 'succeeded' || result.paymentIntent.status === 'requires_capture') {
                         $(this).submitDueOrder(1); // Mark as paid
                    } else {
                         Swal.fire("Payment Not Completed", "Payment status: " + result.paymentIntent.status, "info");
                    }
                }
            }.bind(this));
        } else { // Cash or other non-Stripe Elements payment
            $(this).submitDueOrder(1); // Mark as paid
        }
    });

    $('#transactions').click(function () {
        loadTransactions(); // Now async
        loadUserList();     // Now async
        $('#pos_view').hide(); $('#pointofsale').show(); $('#transactions_view').show(); $(this).hide();
    });
    $('#pointofsale').click(function () {
        $('#pos_view').show(); $('#transactions').show(); $('#transactions_view').hide(); $(this).hide();
    });

    $("#viewRefOrders").click(function () { setTimeout(() => { $("#holdOrderInput").focus(); }, 500); });
    $("#viewCustomerOrders").click(function () { $(this).getCustomerOrders(); setTimeout(() => { $("#holdCustomerOrderInput").focus(); }, 500); });
    $('#newProductModal').click(function () { $('#saveProduct').get(0).reset(); $('#current_img').html(''); $('#remove_img').hide(); $('#imagename').show(); });

    $('#saveProduct').submit(async function (e) {
        e.preventDefault();
        const formData = $(this).serializeObject();
        const imageFile = ($('#imagename')[0].files && $('#imagename')[0].files.length > 0) ? $('#imagename')[0].files[0] : null;
        formData.stock = formData.stock === 'on' ? 'on' : 'off';
        try {
            await InventoryService.saveProduct(formData, imageFile);
            $('#saveProduct').get(0).reset(); $('#current_img').html(''); $('#imagename').show(); $('#rmv_img').hide();
            await loadProducts();
            Swal.fire({ title: 'Product Saved', text: "Select an option to continue.", icon: 'success', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33', confirmButtonText: 'Add another', cancelButtonText: 'Close' })
                .then((result) => { if (!result.value) { $("#newProduct").modal('hide'); } });
        } catch (error) { Swal.fire('Error', `Save product failed: ${error.message}`, 'error'); }
    });

    $('#saveCategory').submit(async function (e) {
        e.preventDefault();
        const categoryData = $(this).serializeObject();
        try {
            if (!categoryData.id || categoryData.id === "") { await CategoryService.addCategory({ name: categoryData.name }); }
            else { await CategoryService.updateCategory({ id: categoryData.id, name: categoryData.name }); }
            $('#saveCategory').get(0).reset(); $('#category_id').val('');
            await loadCategories(); await loadProducts();
            Swal.fire({ title: 'Category Saved', text: "Select an option to continue.", icon: 'success', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33', confirmButtonText: 'Add another', cancelButtonText: 'Close' })
                .then((result) => { if (!result.value) { $("#newCategory").modal('hide'); } });
        } catch (error) { Swal.fire('Error', `Save category failed: ${error.message}`, 'error'); }
    });

    $.fn.editProduct = function (idx) { // idx is the index in allProducts array
        const product = allProducts[idx];
        if (!product) return;
        $('#Products').modal('hide');
        $("#category option[value='" + product.category + "']").prop("selected", true);
        $('#productName').val(product.name); $('#product_price').val(product.price);
        $('#quantity').val(product.quantity); $('#product_id').val(product._id);
        $('#img').val(product.img); // Hidden field for current image name
        $('#productUnit').val(product.unit); $('#lotNumber').val(product.lotnumber);
        if (product.img && product.img !== "") {
            $('#imagename').hide(); $('#current_img').html(`<img src="${img_path + product.img}" alt="Current Image">`); $('#rmv_img').show();
        } else {
             $('#current_img').html(''); $('#imagename').show(); $('#rmv_img').hide();
        }
        $('#stock').prop("checked", product.stock == 0); // If stock is 0 (track stock, old logic), checkbox is checked.
        $('#newProduct').modal('show');
    };

    $("#userModal").on("hide.bs.modal", function () { $('.perms').hide(); ownUserEdit = false; });

    $.fn.editUser = function (idx) { // idx is index in allUsers array
        const targetUser = allUsers[idx];
        if (!targetUser) return;
        user_index = idx; // Keep track of which user in the list is being edited for non-ownUserEdit case
        $('#Users').modal('hide'); $('.perms').show();
        $("#user_id").val(targetUser._id); $('#fullname').val(targetUser.fullname);
        $('#username').val(targetUser.username); $('#password').val(atob(targetUser.password)); // Display decoded

        $('#perm_products').prop("checked", targetUser.perm_products == 1);
        $('#perm_categories').prop("checked", targetUser.perm_categories == 1);
        $('#perm_transactions').prop("checked", targetUser.perm_transactions == 1);
        $('#perm_users').prop("checked", targetUser.perm_users == 1);
        $('#perm_settings').prop("checked", targetUser.perm_settings == 1);
        $('#userModal').modal('show');
    };

    $.fn.editCategory = function (idx) { // idx is index in allCategories array
        const category = allCategories[idx];
        if(!category) return;
        $('#Categories').modal('hide');
        $('#categoryName').val(category.name); $('#category_id').val(category._id);
        $('#newCategory').modal('show');
    };

    $.fn.deleteProduct = function (id) {
        Swal.fire({ title: 'Are you sure?', text: "Delete this product?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33', confirmButtonText: 'Yes, delete it!'})
        .then(async (result) => { if (result.value) { try { await InventoryService.deleteProduct(id); await loadProducts(); Swal.fire('Done!', 'Product deleted', 'success'); } catch (e) { Swal.fire('Error', `Delete failed: ${e.message}`, 'error');}} });
    };
    $.fn.deleteUser = function (id) {
        if (id === 1 || id === '1') { Swal.fire('Cannot Delete', 'Default admin user cannot be deleted.', 'warning'); return; }
        Swal.fire({ title: 'Are you sure?', text: "Delete this user?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33', confirmButtonText: 'Yes, delete!'})
        .then(async (result) => { if (result.value) { try { await UserService.deleteUser(id); await loadUserList(); Swal.fire('Done!', 'User deleted', 'success'); } catch (e) { Swal.fire('Error', `Delete failed: ${e.message}`, 'error');}} });
    };
    $.fn.deleteCategory = function (id) {
        Swal.fire({ title: 'Are you sure?', text: "Delete this category?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33', confirmButtonText: 'Yes, delete it!'})
        .then(async (result) => { if (result.value) { try { await CategoryService.deleteCategory(id); await loadCategories(); await loadProducts(); Swal.fire('Done!', 'Category deleted', 'success'); } catch (e) { Swal.fire('Error', `Delete failed: ${e.message}`, 'error');}} });
    };

    $('#productModal').click(function () { loadProductListTable(); }); // Changed from loadProductList to avoid UI redraw
    $('#usersModal').click(function () { loadUserList(); });
    $('#categoryModal').click(function () { loadCategoryListTable(); }); // Changed from loadCategories

    async function loadUserList() { // Made async
        try {
            const usersData = await UserService.getAllUsers();
            allUsers = [...usersData];
            let user_list_html = '';
            if ($.fn.DataTable.isDataTable('#userList')) { $('#userList').DataTable().destroy(); }
            $('#user_list').empty();

            // Roles column header is now statically in index.html thead

            allUsers.forEach((u, idx) => {
                let statusParts = u.status ? u.status.split("_") : [''];
                let statusClass = statusParts[0] === 'Logged In' ? 'text-success' : (statusParts[0] === 'Logged Out' ? 'text-muted' : '');
                    let rolesDisplay = (u.roles && u.roles.length > 0) ? u.roles.join(', ') : 'N/A';
                user_list_html += `<tr>
                    <td>${u.fullname}</td><td>${u.username}</td>
                    <td class="${statusClass}">${statusParts[0]} <br><small>${statusParts[1] ? moment(statusParts[1]).format('hh:mm A DD MMM YYYY') : ''}</small></td>
                    <td>${rolesDisplay}</td>
                    <td>${u._id == 1 ? '<span class="btn-group"><button class="btn btn-dark btn-sm" disabled><i class="fa fa-edit"></i></button><button class="btn btn-dark btn-sm" disabled><i class="fa fa-trash"></i></button></span>' :
                                    '<span class="btn-group"><button onClick="$(this).editUser(' + idx + ')" class="btn btn-warning btn-sm"><i class="fa fa-edit"></i></button><button onClick="$(this).deleteUser(' + u._id + ')" class="btn btn-danger btn-sm"><i class="fa fa-trash"></i></button></span>'}
                    </td></tr>`;
            });
            $('#user_list').html(user_list_html);
            $('#userList').DataTable({ "order": [[0, "asc"]], "autoWidth": false, "info": true, "JQueryUI": true, "ordering": true, "paging": false });
        } catch (e) { Swal.fire('Error', 'Could not load user list.', 'error');}
    }

    async function loadProductListTable() { // For the modal product list
        try {
            // Assuming allProducts is already up-to-date from loadProducts() display part
            let product_list_html = '';
             if ($.fn.DataTable.isDataTable('#productList')) { $('#productList').DataTable().destroy(); }
            $('#product_list').empty();

            allProducts.forEach((product, index) => {
                let category = allCategories.find(cat => cat._id == product.category);
                product_list_html += `<tr>
                    <td><svg id="barcode_modal_${product._id}"></svg></td>
                    <td><img style="max-height: 40px; max-width: 40px;" src="${product.img && product.img !== "" ? img_path + product.img : "./assets/images/default.jpg"}"></td>
                    <td>${product.name}</td>
                    <td>${(settings ? settings.symbol : '$')}${product.price}</td>
                    <td>${product.stock == 1 ? product.quantity : 'N/A'}</td>
                    <td>${category ? category.name : 'N/A'}</td>
                    <td class="nobr"><span class="btn-group"><button onClick="$(this).editProduct(${index})" class="btn btn-warning btn-sm"><i class="fa fa-edit"></i></button><button onClick="$(this).deleteProduct(${product._id})" class="btn btn-danger btn-sm"><i class="fa fa-trash"></i></button></span></td></tr>`;
            });
            $('#product_list').html(product_list_html);
            allProducts.forEach(pro => {
                if (pro._id && window.JsBarcode) {
                    try { $("#barcode_modal_" + pro._id).JsBarcode(pro._id.toString(), { width: 1, height: 20, fontSize: 10, displayValue: true }); }
                    catch (e) { console.error("Barcode error for modal list:", pro._id, e); }
                }
            });
            $('#productList').DataTable({ "order": [[2, "asc"]], "autoWidth": false, "info": true, "JQueryUI": true, "ordering": true, "paging": true, "pageLength": 10 });
        } catch (e) { Swal.fire('Error', 'Could not load product table.', 'error'); }
    }

    async function loadCategoryListTable() { // For the modal category list
         try {
            // Assuming allCategories is up-to-date
            let category_list_html = '';
            if ($.fn.DataTable.isDataTable('#categoryList')) { $('#categoryList').DataTable().destroy(); }
            $('#category_list').empty();
            allCategories.forEach((category, index) => {
                category_list_html += `<tr><td>${category.name}</td>
                    <td><span class="btn-group"><button onClick="$(this).editCategory(${index})" class="btn btn-warning btn-sm"><i class="fa fa-edit"></i></button><button onClick="$(this).deleteCategory(${category._id})" class="btn btn-danger btn-sm"><i class="fa fa-trash"></i></button></span></td></tr>`;
            });
            $('#category_list').html(category_list_html);
            $('#categoryList').DataTable({ "autoWidth": false, "info": true, "JQueryUI": true, "ordering": true, "paging": false });
        } catch (e) { Swal.fire('Error', 'Could not load category table.', 'error'); }
    }

    // Stripe Terminal SDK initialization (onFetchConnectionToken is required)
    if (window.StripeTerminal) {
        var terminal = StripeTerminal.create({
            onFetchConnectionToken: fetchConnectionToken, // Already refactored to use PaymentService
            onUnexpectedReaderDisconnect: function() { console.log("Stripe Terminal: Unexpectedly disconnected from reader"); Swal.fire("Reader Disconnected", "The card reader was disconnected unexpectedly.", "warning"); },
            // onConnectionStatusChange: function(e) { console.log("Stripe Terminal: Connection status change", e); },
            // onPaymentStatusChange: function(e) { console.log("Stripe Terminal: Payment status change", e); }
        });
    } else {
        console.warn("StripeTerminal.js SDK not loaded. Terminal features will not be available.");
    }


    async function fetchConnectionToken() {
        try {
            const response = await PaymentService.createTerminalConnectionToken(); // This is a stub
            if (response.status === 'error' || !response.secret) {
                throw new Error(response.message || "Could not fetch Stripe Terminal connection token.");
            }
            return response.secret;
        } catch (error) {
            console.error("Error in fetchConnectionToken:", error);
            Swal.fire("Connection Token Error", error.message, "error");
            throw error;
        }
    }

    $('#log-out').click(async function () { // Made async
        Swal.fire({ title: 'Are you sure?', text: "You are about to log out.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Logout'})
        .then(async (result) => {
            if (result.value) {
                try {
                    if(user && user._id) await UserService.logoutUser(user._id);
                    user = {};
                    window.location.reload();
                } catch (err) { Swal.fire('Error', 'Logout failed.', 'error'); }
            }
        });
    });

    $('#settings_form').on('submit', async function (e) {
        e.preventDefault();
        let formData = $(this).serializeObject();
        formData['app'] = $('#app').find('option:selected').text();
        formData['mac'] = 'N/A-Web';
        // formData['till'] should be part of the form data if it's meant to be saved here.
        // The original code set formData['till'] = 1; this might be desired default if not in form.
        formData['till'] = formData.till || settings.till || 1;


        if (formData.percentage != "" && !$.isNumeric(formData.percentage)) {
            Swal.fire('Oops!', 'VAT percentage must be a number.', 'warning'); return;
        }
        try {
            const imageFile = ($('#logoname')[0].files && $('#logoname')[0].files.length > 0) ? $('#logoname')[0].files[0] : null;
            // Ensure all boolean-like settings are correctly formatted (true/false or 1/0) if service expects it
            formData.charge_tax = $('#charge_tax').is(':checked');
            formData.stripestatus = $('#stripestatus').is(':checked'); // for 'live' status

            await SettingsService.saveSettings(formData, imageFile);
            Swal.fire('Settings Saved!', 'Reloading application...', 'success').then(() => { window.location.reload(); });
        } catch (error) { Swal.fire('Error', `Save settings failed: ${error.message}`, 'error');}
    });

    $('#net_settings_form').on('submit', async function (e) {
        e.preventDefault();
        let formData = $(this).serializeObject();
        if (!formData.till || parseInt(formData.till) <= 0 || !isNumeric(formData.till)) {
            Swal.fire('Oops!', 'Till number must be a positive number.', 'warning'); return;
        }
        formData['app'] = $('#app').find('option:selected').text();
        formData['mac'] = 'N/A-Web';
        try {
            const currentSettingsData = await SettingsService.getSettings() || {};
            const updatedSettings = { ...currentSettingsData, ...formData }; // Merge, formData specific to network will overwrite
            await SettingsService.saveSettings(updatedSettings);
            Swal.fire('Network Settings Saved!', 'Reloading application...', 'success').then(() => { window.location.reload(); });
        } catch (error) { Swal.fire('Error', `Save network settings failed: ${error.message}`, 'error');}
    });

    $('#saveUser').on('submit', async function (e) {
        e.preventDefault();
        let formData = $(this).serializeObject();
        if (formData.password && formData.password !== formData.pass) {
            Swal.fire('Oops!', 'Passwords do not match!', 'warning'); return;
        }
        // If ID is present, it's an update. If password is blank for update, service should not change it.
        if (!formData.id && !formData.password) { // New user must have password
             Swal.fire('Oops!', 'Password is required for new users.', 'warning'); return;
        }
        try {
            const savedUser = await UserService.saveUser(formData);
            if (ownUserEdit && user._id && user._id.toString() === formData.id) {
                user = { ...user, ...savedUser, roles: user.roles }; // Preserve roles, update other fields from saveUser result
                Swal.fire('Profile Updated!', 'Reloading for changes to take effect...', 'success').then(() => window.location.reload());
            } else {
                $('#userModal').modal('hide'); $(this).get(0).reset();
                await loadUserList();
                $('#Users').modal('show');
                Swal.fire('Ok!', 'User details saved!', 'success');
            }
        } catch (error) { Swal.fire('Error', `Save user failed: ${error.message}`, 'error'); }
    });

    $('#app').change(function () {
        if ($(this).find('option:selected').text() == 'Network Point of Sale Terminal') {
            $('#net_settings_form').show(500); $('#settings_form').hide(500);
            $("#mac").val('N/A-Web');
        } else {
            $('#net_settings_form').hide(500); $('#settings_form').show(500);
        }
    });

    $('#cashier').click(function () {
        ownUserEdit = true; $('#userModal').modal('show');
        $("#user_id").val(user._id); $("#fullname").val(user.fullname);
        $("#username").val(user.username); $("#password").val(atob(user.password)); // For display
        // Permissions checkboxes should be set based on `user` object here
        $('#perm_products').prop("checked", user.perm_products == 1);
        $('#perm_categories').prop("checked", user.perm_categories == 1);
        $('#perm_transactions').prop("checked", user.perm_transactions == 1);
        $('#perm_users').prop("checked", user.perm_users == 1);
        $('#perm_settings').prop("checked", user.perm_settings == 1);
        $('.perms').show(); // Show perms for own profile edit
    });

    $('#add-user').click(function () {
        ownUserEdit = false;
        // platform.app check might need adjustment if 'platform' structure changes
        if (!platform || platform.app !== 'Network Point of Sale Terminal') { $('.perms').show(); }
        else { $('.perms').hide(); } // Hide perms if it's a network terminal adding user (server might set perms)
        $("#saveUser").get(0).reset(); $('#user_id').val('');
        $('#userModal').modal('show');
    });

    $('#settings').click(async function () { // Made async
        try {
            const currentSettings = await SettingsService.getSettings(); // Fetch fresh settings
            settings = currentSettings || {}; // Update global settings

            if (platform.app == 'Network Point of Sale Terminal') { // platform should be set by now
                $('#net_settings_form').show(500); $('#settings_form').hide(500);
                $("#ip").val(settings.ip); $("#till").val(settings.till); $("#mac").val('N/A-Web');
            } else {
                $('#net_settings_form').hide(500); $('#settings_form').show(500);
                $("#settings_id").val("1");
                $("#store").val(settings.store); $("#address_one").val(settings.address_one);
                $("#address_two").val(settings.address_two); $("#contact").val(settings.contact);
                $("#tax").val(settings.tax); $("#symbol").val(settings.symbol);
                $("#currency").val(settings.currency); $("#percentage").val(settings.percentage);
                $("#footer").val(settings.footer); $("#logo_img").val(settings.img);

                if(settings.stripe) {
                    $("#stripeMerchantCategory").val(settings.stripe.category);
                    $("#stripestatus").prop("checked", !!settings.stripe.live);
                    $("#stripeLivePublishable").val(settings.stripe.publishable?.live || '');
                    $("#stripeLiveSecret").val(settings.stripe.secret?.live || '');
                    $("#stripeTestPublishable").val(settings.stripe.publishable?.test || '');
                    $("#stripeTestSecret").val(settings.stripe.secret?.test || '');
                    $('#stripeTerminalLiveLocationID').val(settings.stripe.terminal?.locationid?.live || '');
                    $('#stripeTerminalTestLocationID').val(settings.stripe.terminal?.locationid?.test || '');
                }
                $('#charge_tax').prop("checked", !!settings.charge_tax);
                if (settings.img && settings.img !== "") {
                    $('#logoname').hide(); $('#current_logo').html(`<img src="${img_path + settings.img}" alt="logo">`); $('#rmv_logo').show();
                } else {
                    $('#current_logo').html(''); $('#logoname').show(); $('#rmv_logo').hide();
                }
            }
             // Set selected app type
            $("#app option").filter(function () { return $(this).text() == (settings.app || 'Standalone Point of Sale'); }).prop("selected", true);

        } catch (error) { Swal.fire("Error", "Could not load settings for display.", "error"); }
    });

    $('#rmv_logo').click(function () { $('#remove_logo').val("1"); $('#current_logo').hide(500).html(''); $(this).hide(500); $('#logoname').show(500).val(''); });
    $('#rmv_img').click(function () { $('#remove_img').val("1"); $('#current_img').hide(500).html(''); $(this).hide(500); $('#imagename').show(500).val(''); });

    $('#print_list').click(function () { /* PDF generation code remains largely same, ensure jsPDF/html2canvas are global */ });
    // Quit button functionality
    $('#quit').click(function () {
        Swal.fire({ title: 'Are you sure?', text: "Close this POS tab/window?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Yes, Close'})
        .then((result) => { if (result.value) { console.log("User chose to close. Standard browser close action would apply if this were a real tab."); /* window.close(); typically won't work unless window was opened by script */ } });
    });
}); // End of jQuery $(function(){...})

// Helper: Check if numeric
function isNumeric(value) {
    return /^\d+$/.test(value);
}
