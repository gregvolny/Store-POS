class CustomerFormModalContent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._customerData = null; // For potential future use (editing)
    }

    connectedCallback() {
        this.render();
        this.shadowRoot.querySelector('form').addEventListener('submit', this._handleSubmit.bind(this));
    }

    _handleSubmit(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const customerDetails = {
            name: formData.get('name'),
            phone: formData.get('phone'),
            email: formData.get('email'),
            address: formData.get('address'),
        };
        // Add id if editing in the future
        // if (this._customerData && this._customerData.id) {
        //     customerDetails.id = this._customerData.id;
        // }

        this.dispatchEvent(new CustomEvent('save-customer', {
            detail: customerDetails,
            bubbles: true,
            composed: true
        }));
    }

    get customerData() {
        return this._customerData;
    }

    set customerData(data) {
        this._customerData = data;
        this.render(); // Re-render if data changes (for pre-filling if/when edit is implemented)
         // Pre-fill logic would go here if editing is supported by this modal
        if (this._customerData) {
            this.shadowRoot.querySelector('#name').value = this._customerData.name || '';
            this.shadowRoot.querySelector('#phone').value = this._customerData.phone || '';
            this.shadowRoot.querySelector('#email').value = this._customerData.email || '';
            this.shadowRoot.querySelector('#address').value = this._customerData.address || '';
            // if (this._customerData.id) {
            //     const idInput = this.shadowRoot.querySelector('#customerId');
            //     if (idInput) idInput.value = this._customerData.id;
            // }
        } else {
            this.shadowRoot.querySelector('form').reset();
        }
    }

    resetForm() {
        if (this.shadowRoot.querySelector('form')) {
            this.shadowRoot.querySelector('form').reset();
        }
        this._customerData = null; // Clear any stored data
    }


    render() {
        // Basic Bootstrap-like styling for the form elements
        // Form fields match the original form structure in index.html
        this.shadowRoot.innerHTML = `
            <style>
                .form-group {
                    margin-bottom: 1rem;
                }
                label {
                    display: block;
                    margin-bottom: .5rem;
                }
                .form-control {
                    display: block;
                    width: 100%;
                    padding: .375rem .75rem;
                    font-size: 1rem;
                    line-height: 1.5;
                    color: #495057;
                    background-color: #fff;
                    background-clip: padding-box;
                    border: 1px solid #ced4da;
                    border-radius: .25rem;
                    box-sizing: border-box; /* Ensures padding doesn't add to width */
                }
                .btn {
                    display: inline-block;
                    font-weight: 400;
                    color: #212529;
                    text-align: center;
                    vertical-align: middle;
                    cursor: pointer;
                    user-select: none;
                    background-color: transparent;
                    border: 1px solid transparent;
                    padding: .375rem .75rem;
                    font-size: 1rem;
                    line-height: 1.5;
                    border-radius: .25rem;
                }
                .btn-primary {
                    color: #fff;
                    background-color: #007bff;
                    border-color: #007bff;
                }
                .btn-block {
                    display: block;
                    width: 100%;
                }
                /* Add other styles as needed */
            </style>
            <form data-parsley-validate>
                <!-- <input type="hidden" name="id" id="customerId"> -->
                <div class="form-group">
                    <label for="name">Customer Name*</label>
                    <input type="text" required="required" name="name" placeholder="Enter name" class="form-control" id="name">
                </div>
                <div class="form-group">
                    <label for="phone">Customer Phone</label>
                    <input type="text" name="phone" placeholder="Enter Phone number" class="form-control" id="phone">
                </div>
                <div class="form-group">
                    <label for="email">Customer Email</label>
                    <input type="email" name="email" placeholder="Enter email address" class="form-control" id="email">
                </div>
                <div class="form-group">
                    <label for="address">Customer Address</label>
                    <input type="text" name="address" placeholder="Enter address" class="form-control" id="address">
                </div>
                <input type="submit" class="btn btn-primary btn-block waves-effect waves-light" value="Save Customer">
            </form>
        `;
    }
}

customElements.define('customer-form-modal-content', CustomerFormModalContent);
