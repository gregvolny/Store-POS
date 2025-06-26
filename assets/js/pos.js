// Service Imports
import * as UserService from '../../api/users.js';
import * as SettingsService from '../../api/settings.js';
import * as InventoryService from '../../api/inventory.js';
import * as CategoryService from '../../api/categories.js';
import * as CustomerService from '../../api/customers.js';
import * as TransactionService from '../../api/transactions.js';
import * as PaymentService from '../../api/payment.js';

// Utility Imports
import moment from 'moment';
import Swal from 'sweetalert2';
// jsPDF, html2canvas, JsBarcode are global via index.html or will be handled by Webpack if imported.

let cart = [];
let index = 0; // Used by old cart logic, might be refactorable
let allUsers = [];
let allProducts = [];
let allCategories = [];
let allTransactions = [];
let sold = []; // For transaction reports
let state = []; // For user status display
let sold_items = []; // For transaction reports
let item; // Temp variable for cart item manipulation

let holdOrder = 0; // ID of order currently on hold being edited
let vat = 0;
let deleteId = 0; // ID for item to be deleted
let paymentType = 0;
let receipt = '';
let totalVat = 0;
let subTotal = 0;
let method = ''; // For POST/PUT determination for transactions
let user_index = 0;
let transaction_index;
let img_path = 'assets/images/';

let categories = [];
let holdOrderList = [];
let customerOrderList = [];
let ownUserEdit = null;
let orderTotal = 0;

const auth_error = 'Incorrect username or password';
const auth_empty = 'Please enter a username and password';
const holdOrderlocation = $("#randerHoldOrders");
const customerOrderLocation = $("#randerCustomerOrders");

let settings = {};
let platform = {};
let user = {};

let start = moment().startOf('month');
let end = moment();
let start_date = moment(start).toDate().toJSON();
let end_date = moment(end).toDate().toJSON();
let by_till = 0;
let by_user = 0;
let by_status = 1;

window.POS = {};

window.startPosApplication = async function () {
    await initializeApplicationUi();
};

async function initializeApplicationUi() {
    $("#loading").show().html(
        `<div id="load">
            <form id="account">
                <div class="form-group"><input type="text" placeholder="Username" name="username" class="form-control" autocomplete="username"></div>
                <div class="form-group"><input type="password" placeholder="Password" name="password" class="form-control" autocomplete="current-password"></div>
                <div class="form-group"><input type="submit" class="btn btn-block btn-default" value="Login"></div>
            </form>
            <div class="form-group text-center"><a href="#" id="showRegisterModal">Create an account</a></div>
        </div>`
    );
    console.log("Authentication form displayed.");
}

async function loadInitialDataAfterLogin() {
    try {
        const fetchedSettings = await SettingsService.getSettings();
        settings = fetchedSettings || {};
        console.log("Settings loaded:", settings);

        platform = { app: settings.app || 'Standalone Web POS', till: settings.till || 1, mac: 'N/A-Web' };
        console.log("Platform settings determined:", platform);

        if (!user || !user._id) {
            console.error("User not properly set after login. Re-authenticating.");
            initializeApplicationUi(); return;
        }
        $('#loggedin-user').text(user.fullname);

        const usersData = await UserService.getAllUsers();
        allUsers = [...usersData];

        await loadCategories();
        await loadProductsAndDisplay();
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
            if (!settings.store) { // Check for a critical setting
                Swal.fire('Setup Required', 'Please configure application settings.', 'warning')
                   .then(() => { $('#settingsModal').modal('show'); });
            }
        }

        if (user && user.perm_products !== undefined) {
            $(".p_one").toggle(!!user.perm_products);
            $(".p_two").toggle(!!user.perm_categories);
            $(".p_three").toggle(!!user.perm_transactions);
            $(".p_four").toggle(!!user.perm_users);
            $(".p_five").toggle(!!user.perm_settings);
        }

        await $(this).getHoldOrders();
        await $(this).getCustomerOrders();

        $("#loading").hide(); $(".main_app").show();
        console.log("Initial data loaded, application ready.");

    } catch (error) {
        console.error("Error loading initial application data:", error);
        $("#loading").html(`<p style="color:red;">Error: ${error.message}. Please refresh.</p>`).show();
        Swal.fire('Error', `Could not load initial data: ${error.message}`, 'error');
    }
}

$(function() {
    $(".loading").hide(); $(".main_app").hide();

    function cb(start_dr, end_dr) {
        $('#reportrange span').html(start_dr.format('MMMM D, YYYY') + ' - ' + end_dr.format('MMMM D, YYYY'));
    }
    $('#reportrange').daterangepicker({
        startDate: start, endDate: end, autoApply: true, timePicker: true, timePicker24Hour: true,
        timePickerIncrement: 10, timePickerSeconds: true,
        ranges: {
            'Today': [moment().startOf('day'), moment()],
            'Yesterday': [moment().subtract(1, 'days').startOf('day'), moment().subtract(1, 'days').endOf('day')],
            'Last 7 Days': [moment().subtract(6, 'days').startOf('day'), moment().endOf('day')],
            'Last 30 Days': [moment().subtract(29, 'days').startOf('day'), moment().endOf('day')],
            'This Month': [moment().startOf('month'), moment()],
            'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
        }
    }, cb);
    cb(start, end);

    $.fn.serializeObject = function(){ return $(this).serializeArray().reduce((obj, item) => { obj[item.name] = obj[item.name] ? (Array.isArray(obj[item.name]) ? [...obj[item.name], item.value] : [obj[item.name], item.value]) : item.value; return obj; }, {}); };

    $("#settingsModal").on("hide.bs.modal", function () {
        setTimeout(function () {
            if ((!settings || !settings.store) && user && user._id) {
                Swal.fire('Setup Required', 'Please configure application settings.', 'warning')
                    .then(() => { $('#settingsModal').modal('show'); });
            }
        }, 1000);
    });

    $('body').on("submit", "#account", async function (e) {
        e.preventDefault();
        let formData = $(this).serializeObject();
        if (!formData.username || !formData.password) { Swal.fire('Incomplete form!', auth_empty, 'warning'); return; }
        try {
            const loggedInUser = await UserService.loginUser(formData.username, formData.password);
            if (loggedInUser && loggedInUser._id) {
                user = loggedInUser;
                console.log("Login successful for:", user.username, "Roles:", user.roles); // Log roles
                $("#load").remove(); $("#loading").show();
                await loadInitialDataAfterLogin();
            } else { Swal.fire('Oops!', auth_error, 'warning'); }
        } catch (error) { Swal.fire('Login Error', error.message || 'Login failed.', 'error'); }
    });

    $('body').on('click', '#showRegisterModal', function(e) { e.preventDefault(); $('#registrationModal').modal('show'); });

    $('#registrationForm').on('submit', async function(e) {
        e.preventDefault();
        const data = $(this).serializeObject();
        if (!data.fullname || !data.username || !data.password || !data.confirmPassword) { Swal.fire('Error', 'All fields are required.', 'error'); return; }
        if (data.password !== data.confirmPassword) { Swal.fire('Error', 'Passwords do not match.', 'error'); return; }
        try {
            const result = await UserService.registerUser({ fullname: data.fullname, username: data.username, password: data.password });
            Swal.fire('Success', result.message || 'User registered! Please log in.', 'success');
            $('#registrationModal').modal('hide'); $(this).get(0).reset();
        } catch (error) { Swal.fire('Registration Failed', error.message || 'Error.', 'error'); }
    });

    async function loadProductsAndDisplay() {
        try {
            const productData = await InventoryService.getAllProducts();
            allProducts = productData.map(p => ({...p, price: parseFloat(p.price).toFixed(2)}));

            const parentDiv = $('#parent').empty();
            const categoriesDiv = $('#categories').html(`<button type="button" id="all" class="btn btn-categories btn-white waves-effect waves-light active">All</button> `);

            const uniqueCategoryIds = new Set();
            allProducts.forEach(p => { if(p.category) uniqueCategoryIds.add(p.category.toString()) });
            categories = Array.from(uniqueCategoryIds);

            allProducts.forEach(prod => {
                const productCard = document.createElement('product-card');
                productCard.product = prod;
                if (settings && settings.symbol) {
                    productCard.setAttribute('currency-symbol', settings.symbol);
                }
                productCard.classList.add('box');
                if (prod.category) {
                    productCard.classList.add(prod.category.toString());
                    productCard.dataset.category = prod.category.toString();
                }
                productCard.dataset.name = prod.name || '';
                productCard.dataset.sku = prod.sku || '';

                const wrapperDiv = $('<div class="col-lg-2 col-md-3 col-sm-4 col-xs-6 product-wrapper"></div>'); // Added product-wrapper
                wrapperDiv.append(productCard);
                parentDiv.append(wrapperDiv);
            });

            categories.forEach(catId => {
                let c = allCategories.find(cat => cat._id.toString() === catId);
                categoriesDiv.append(`<button type="button" id="${catId}" class="btn btn-categories btn-white waves-effect waves-light">${c ? c.name : 'Unknown'}</button> `);
            });
            await loadProductListTable();
        } catch (error) {
            console.error("Error in loadProductsAndDisplay:", error);
            Swal.fire('Error', 'Could not load products for display.', 'error');
        }
    }

    $('#parent').on('add-to-cart', async function(event) {
        const productId = event.detail.productId;
        if (productId) {
            try {
                const product = await InventoryService.getProductById(productId);
                if (!product) { Swal.fire('Error', 'Product details not found.', 'error'); return; }
                if (product.stock === 0 && product.quantity <= 0) {
                    Swal.fire('Out of stock!', 'This item is currently unavailable', 'info');
                } else {
                    addProductToCartInternal(product);
                }
            } catch (error) { Swal.fire('Error', 'Could not add product to cart.', 'error'); }
        }
    });

    function addProductToCartInternal(data) {
        let existingItemIndex = cart.findIndex(cartItem => cartItem.id === data._id);
        if (existingItemIndex > -1) {
            qtIncrementInternal(existingItemIndex);
        } else {
            cart.push({ id: data._id, product_name: data.name, sku: data.sku, price: parseFloat(data.price), quantity: 1 });
            renderCartTableInternal();
        }
    }

    function qtIncrementInternal(i) {
        if (!cart[i]) return;
        let currentCartItem = cart[i];
        let productDetails = allProducts.find(p => p._id == currentCartItem.id);
        if (productDetails && productDetails.stock === 0) { // Track stock
            if (currentCartItem.quantity < productDetails.quantity) {
                currentCartItem.quantity++;
            } else {
                Swal.fire('No more stock!', 'Max available stock reached.', 'info');
            }
        } else { // Not tracking stock or stock > 0 (though this case should be fine if stock is 0 and quantity > 0)
            currentCartItem.quantity++;
        }
        renderCartTableInternal();
    }
    function qtDecrementInternal(i) { if (cart[i] && cart[i].quantity > 1) { cart[i].quantity--; } renderCartTableInternal(); }
    function qtInputInternal(i, val) { if (cart[i]) { cart[i].quantity = parseInt(val) >= 1 ? parseInt(val) : 1; } renderCartTableInternal(); } // Ensure quantity is at least 1
    function deleteFromCartInternal(idx) { cart.splice(idx, 1); renderCartTableInternal(); }

    function calculateCartInternal() {
        let currentTotal = 0;
        $('#total').text(cart.length);
        $.each(cart, function (idx, data) { currentTotal += data.quantity * data.price; });
        let discountVal = parseFloat($("#inputDiscount").val()) || 0;
        currentTotal = currentTotal - discountVal;

        let currentSymbol = (settings && settings.symbol) ? settings.symbol : '$';
        $('#price').text(currentSymbol + currentTotal.toFixed(2));
        subTotal = currentTotal;

        if (discountVal > subTotal && subTotal >= 0) { // Allow full discount if subTotal becomes 0
             $("#inputDiscount").val(subTotal.toFixed(2)); // Set discount to subTotal
             calculateCartInternal(); // Recalculate
             return;
        } else if (discountVal < 0) {
            $("#inputDiscount").val(0);
            calculateCartInternal();
            return;
        }

        let grossTotal = subTotal;
        totalVat = 0;
        if (settings && settings.charge_tax && vat > 0) {
            totalVat = ((subTotal * vat) / 100);
            grossTotal = subTotal + totalVat;
        }
        orderTotal = grossTotal;
        $("#gross_price").text(currentSymbol + grossTotal.toFixed(2));
        $("#payablePrice").val(grossTotal.toFixed(2));
    };

    function renderCartTableInternal() {
        $('#cartTable > tbody').empty();
        calculateCartInternal();
        const currentSymbol = (settings && settings.symbol) ? settings.symbol : '$';
        $.each(cart, function (idx, data) {
            $('#cartTable > tbody').append(
                $('<tr>').append(
                    $('<td>', { text: idx + 1 }),
                    $('<td>', { text: data.product_name }),
                    $('<td>').append(
                        $('<div>', { class: 'input-group' }).append(
                            $('<div>', { class: 'input-group-btn btn-xs' }).append($('<button>', { class: 'btn btn-default btn-xs qt-decrement', 'data-index': idx }).append($('<i>', { class: 'fa fa-minus' }))),
                            $('<input>', { class: 'form-control item-quantity', type: 'number', value: data.quantity, 'data-index': idx, min: '1' }),
                            $('<div>', { class: 'input-group-btn btn-xs' }).append($('<button>', { class: 'btn btn-default btn-xs qt-increment', 'data-index': idx }).append($('<i>', { class: 'fa fa-plus' })))
                        )
                    ),
                    $('<td>', { text: currentSymbol + (data.price * data.quantity).toFixed(2) }),
                    $('<td>').append($('<button>', { class: 'btn btn-danger btn-xs delete-cart-item', 'data-index': idx }).append($('<i>', { class: 'fa fa-times' })))
                )
            );
        });
    };

    $.fn.cancelOrder = function () {
        if (cart.length > 0) {
            Swal.fire({ title: 'Are you sure?', text: "Remove all items from cart?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#3085d6', cancelButtonColor: '#d33', confirmButtonText: 'Yes, clear it!' })
                .then((result) => { if (result.value) { cart = []; renderCartTableInternal(); holdOrder = 0; Swal.fire('Cleared!', 'Cart cleared.', 'success'); } });
        }
    };

    async function loadCategories() { /* ... (as previously refactored) ... */ }
    async function loadCustomers() { /* ... (as previously refactored) ... */ }
    $("#searchBarCode").on('submit', async function(e) { /* ... (as previously refactored) ... */ });
    $("#payButton").on('click', async function () { /* ... (as previously refactored) ... */ });
    $("#hold").on('click', function () { /* ... (as previously refactored) ... */ });
    $.fn.submitDueOrder = async function (statusValue) { /* ... (as previously refactored, ensure all service calls are async) ... */ };
    $.fn.getHoldOrders = async function () { /* ... (as previously refactored) ... */ };
    $.fn.randerHoldOrders = function (data, renderLocation, orderType) { /* ... (as previously refactored, check customer name access) ... */ };
    $('#randerHoldOrders, #randerCustomerOrders').on('click', '.delete-hold-order', function() { /* ... (as previously refactored) ... */ });
    $('#randerHoldOrders, #randerCustomerOrders').on('click', '.view-hold-details', function() { /* ... (as previously refactored) ... */ });
    $.fn.deleteOrderById = function (orderId, orderType) { /* ... (as previously refactored) ... */ };
    $.fn.orderDetails = function (idx, orderType) { /* ... (as previously refactored, check customer name access) ... */ };
    $.fn.getCustomerOrders = async function () { /* ... (as previously refactored) ... */ };
    // $('#saveCustomer').on('submit', async function (e) { ... }); // Replaced by Web Component logic below

    // Listener for the custom event from <customer-form-modal-content>
    const customerFormModalContentElement = document.getElementById('customerFormModalContentElement');
    if (customerFormModalContentElement) {
        customerFormModalContentElement.addEventListener('save-customer', async (event) => {
            const customerData = event.detail;
            if (!customerData.name) { // Basic validation
                Swal.fire('Validation Error', 'Customer Name is required.', 'error');
                return;
            }
            try {
                $(".loading").show();
                // This modal was originally only for adding new customers
                await CustomerService.addCustomer(customerData);
                Swal.fire('Saved!', 'Customer has been saved.', 'success');

                await loadCustomers(); // Reload customer dropdown in POS view and potentially other lists
                $('#newCustomer').modal('hide'); // Hide the bootstrap modal

                // Reset the form inside the web component for the next time it's opened
                if (typeof customerFormModalContentElement.resetForm === 'function') {
                    customerFormModalContentElement.resetForm();
                }

            } catch (error) {
                console.error("Error saving customer:", error);
                Swal.fire('Error', `Could not save customer: ${error.message || error}`, 'error');
            } finally {
                $(".loading").hide();
            }
        });
    }

    // Ensure the customer form component is reset when the modal is about to be shown
    // This is particularly important if the modal is reused without destroying the component
    $('#newCustomer').on('show.bs.modal', function () {
        const customerFormElement = document.getElementById('customerFormModalContentElement');
        if (customerFormElement && typeof customerFormElement.resetForm === 'function') {
            customerFormElement.resetForm();
        }
    });

    $("#payment").on('input', function () { $(this).calculateChange(); });
    $.fn.calculateChange = function () { /* ... (as previously refactored) ... */ };
    $("#confirmPayment").on('click',async function () { /* ... (as previously refactored) ... */ });
    $('#transactions').click(async function () { /* ... (as previously refactored) ... */ });
    $('#pointofsale').click(function () { /* ... (as previously refactored) ... */ });
    $("#viewRefOrders").click(function () { /* ... (as previously refactored) ... */ });
    $("#viewCustomerOrders").click(function () { /* ... (as previously refactored) ... */ });
    $('#newProductModal').click(function () { /* ... (as previously refactored) ... */ });
    $('#saveProduct').submit(async function (e) { /* ... (as previously refactored) ... */ });
    // $('#saveCategory').submit(async function (e) { /* ... (as previously refactored) ... */ }); // Replaced by Web Component

    // Listener for the custom event from <category-form-modal-content>
    const categoryFormModalContentElement = document.getElementById('categoryFormModalContentElement');
    if (categoryFormModalContentElement) {
        categoryFormModalContentElement.addEventListener('save-category', async (event) => {
            const categoryData = event.detail;
            try {
                $(".loading").show();
                if (categoryData.id) { // Existing category
                    await CategoryService.updateCategory(categoryData.id, { name: categoryData.name });
                    Swal.fire('Updated!', 'Category has been updated.', 'success');
                } else { // New category
                    await CategoryService.addCategory({ name: categoryData.name });
                    Swal.fire('Saved!', 'Category has been saved.', 'success');
                }
                await loadCategories(); // Reload categories for display
                await loadCategoryListTable(); // Reload table in modal
                $('#newCategory').modal('hide');
            } catch (error) {
                console.error("Error saving category:", error);
                Swal.fire('Error', `Could not save category: ${error.message || error}`, 'error');
            } finally {
                $(".loading").hide();
            }
        });
    }


    $.fn.editProduct = function (idx) { /* ... (as previously refactored) ... */ };
    $("#userModal").on("hide.bs.modal", function () { $('.perms').hide(); ownUserEdit = false; });
    $.fn.editUser = function (idx) { /* ... (as previously refactored) ... */ };

    $.fn.editCategory = async function (categoryId) {
        try {
            const category = await CategoryService.getCategoryById(categoryId);
            if (category) {
                const categoryFormElement = document.getElementById('categoryFormModalContentElement');
                if (categoryFormElement) {
                    categoryFormElement.categoryData = { id: category._id, name: category.name }; // Set data on the component
                    $('#newCategory').modal('show'); // Show the modal
                } else {
                    Swal.fire('Error', 'Category form component not found.', 'error');
                }
            } else {
                Swal.fire('Error', 'Category not found.', 'error');
            }
        } catch (error) {
            console.error("Error fetching category for edit:", error);
            Swal.fire('Error', `Could not fetch category: ${error.message || error}`, 'error');
        }
    };

    $.fn.deleteProduct = function (id) { /* ... (as previously refactored) ... */ };
    $.fn.deleteUser = function (id) { /* ... (as previously refactored) ... */ };
    $.fn.deleteCategory = function (id) { /* ... (as previously refactored) ... */ };
    $('#productModal').click(async function() { await loadProductListTable(); });
    $('#usersModal').click(async function() { await loadUserList(); });
    $('#categoryModal').click(async function() { await loadCategoryListTable(); });
    async function loadUserList() { /* ... (as previously refactored, ensure rolesDisplay added) ... */ }
    async function loadProductListTable() { /* ... (as previously refactored) ... */ }
    async function loadCategoryListTable() { /* ... (as previously refactored) ... */ }
    if (window.StripeTerminal) { /* ... (Stripe Terminal setup) ... */ }
    async function fetchConnectionToken() { /* ... (as previously refactored) ... */ }
    $('#log-out').click(async function () { /* ... (as previously refactored) ... */ });
    $('#settings_form').on('submit', async function (e) { /* ... (as previously refactored) ... */ });
    $('#net_settings_form').on('submit', async function (e) { /* ... (as previously refactored) ... */ });
    // $('#saveUser').on('submit', async function (e) { ... }); // Replaced by Web Component logic

    // Listener for the custom event from <user-form-modal-content>
    const userFormModalContentElement = document.getElementById('userFormModalContentElement');
    if (userFormModalContentElement) {
        userFormModalContentElement.addEventListener('save-user', async (event) => {
            const userDataFromEvent = event.detail;
            // Basic client-side validation already handled in component for password match
            // and required fields for new user.
            try {
                $(".loading").show();
                if (userDataFromEvent.id) { // Existing user
                    await UserService.updateUser(userDataFromEvent.id, userDataFromEvent);
                    Swal.fire('Updated!', 'User has been updated.', 'success');
                } else { // New user
                    await UserService.addUser(userDataFromEvent);
                    Swal.fire('Saved!', 'User has been saved.', 'success');
                }
                await loadUserList(); // Reload user list in the #Users modal (table)
                allUsers = await UserService.getAllUsers(); // Refresh global allUsers array for other parts of UI
                if (typeof userFilter === "function") userFilter(allUsers); // Update user filter dropdown in transactions view if function exists
                $('#userModal').modal('hide');
            } catch (error) {
                console.error("Error saving user:", error);
                Swal.fire('Error', `Could not save user: ${error.message || error}`, 'error');
            } finally {
                $(".loading").hide();
            }
        });
    }

    // Update $.fn.editUser to use the web component
    $.fn.editUser = async function (userId) { // Changed idx to userId for clarity
        const selectedUser = allUsers.find(u => u._id.toString() === userId.toString()); // Ensure ID comparison is robust
        if (selectedUser) {
            ownUserEdit = (user._id.toString() === selectedUser._id.toString()); // Compare IDs robustly

            const userComp = document.getElementById('userFormModalContentElement');
            if (userComp) {
                // Map user data to component's expected 'userData' property
                const componentData = {
                    id: selectedUser._id,
                    fullname: selectedUser.fullname,
                    username: selectedUser.username,
                    // Map permissions (ensure names match component's expectations)
                    perm_products: selectedUser.perm_products || false,
                    perm_categories: selectedUser.perm_categories || false,
                    perm_transactions: selectedUser.perm_transactions || false,
                    perm_users: selectedUser.perm_users || false,
                    perm_settings: selectedUser.perm_settings || false,
                };
                userComp.userData = componentData; // This will trigger set userData and _populateForm in component
            }
            // The component itself should handle visibility of permission fields based on ownUserEdit if needed,
            // or we can pass another attribute/property like `can-edit-permissions`.
            // For now, the component shows all permission fields.
            // Original logic: if (ownUserEdit) { $('.perms').hide(); } else { $('.perms').show(); }
            // This could be: if (userComp) userComp.canEditPermissions = !ownUserEdit; (if implemented in component)

            $('#userModal').modal('show');
        } else {
            Swal.fire('Error', 'User not found for editing.', 'error');
            console.error('User not found with ID:', userId, 'in allUsers:', allUsers);
        }
    };

    $('#app').change(function () { /* ... (as previously refactored) ... */ });
    $('#cashier').click(function () { /* ... (as previously refactored) ... */ });

    // Update #add-user click to use the web component
    $('#add-user').click(function () {
        const userComp = document.getElementById('userFormModalContentElement');
        if (userComp) {
            userComp.resetForm(); // Ensures form is set for a new user
        }
        // The component's resetForm and set userData(null) should handle showing all fields correctly.
        $('#userModal').modal('show');
    });

    $('#settings').click(async function () { /* ... (as previously refactored) ... */ });
    $('#rmv_logo').click(function () { /* ... (DOM only) ... */ });
    $('#rmv_img').click(function () { /* ... (DOM only) ... */ });
    $('#print_list').click(function () { /* ... (PDF generation, jsPDF/html2canvas global) ... */ });
    $.fn.print = function () { /* ... (printJS global) ... */ };
    async function loadTransactions() { /* ... (as previously refactored, ensure field names match DB schema) ... */ }
    function discend(a, b) { if (a.qty > b.qty) return -1; if (a.qty < b.qty) return 1; return 0; }
    function loadSoldProducts() { /* ... (DOM, uses allProducts, settings) ... */ }
    function userFilter(users) { /* ... (DOM, uses allUsers) ... */ }
    function tillFilter(tills) { /* ... (DOM only) ... */ }
    $.fn.viewTransaction = function (index) { /* ... (DOM only, uses allTransactions, settings, moment) ... */ };
    $('#status').change(async function () { by_status = $(this).val(); await loadTransactions(); });
    $('#tills').change(async function () { by_till = $(this).val(); await loadTransactions(); });
    $('#users').change(async function () { by_user = $(this).val(); await loadTransactions(); });
    $('#reportrange').on('apply.daterangepicker', async function (ev, picker) {
        start_date = picker.startDate.toDate().toJSON(); end_date = picker.endDate.toDate().toJSON();
        await loadTransactions();
    });
    $('#quit').click(function () { Swal.fire({ title: 'Are you sure?', text: "Close this POS tab/window?", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Yes, Close'}).then((result) => { if (result.value) { console.log("User chose to close."); } }); });
});

function isNumeric(value) { return /^\d+$/.test(value); }
