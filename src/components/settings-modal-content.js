class SettingsModalContent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._settingsData = null;
        this.logoFile = null; // To store the selected logo file
        this.removeLogoFlag = false;
    }

    connectedCallback() {
        this.render(); // Render first
        this._addEventListeners(); // Then add listeners
        if(this._settingsData) { // Populate if data was set before connection
            this._populateForm();
        }
    }

    _addEventListeners() {
        const form = this.shadowRoot.querySelector('#settingsComponentForm');
        if (form) {
            form.addEventListener('submit', this._handleSubmit.bind(this));
        }

        const logoInput = this.shadowRoot.querySelector('#logoname');
        if (logoInput) {
            logoInput.addEventListener('change', (event) => {
                this.logoFile = event.target.files[0];
                this.removeLogoFlag = false; // If new logo, clear remove flag
                const preview = this.shadowRoot.querySelector('#logoPreview');
                if (this.logoFile) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        preview.src = e.target.result;
                        preview.style.display = 'block';
                    }
                    reader.readAsDataURL(this.logoFile);
                } else {
                    preview.style.display = 'none';
                    preview.src = '';
                }
            });
        }

        const removeLogoBtn = this.shadowRoot.querySelector('#removeCurrentLogoBtn');
        if(removeLogoBtn) {
            removeLogoBtn.addEventListener('click', () => {
                this.removeLogoFlag = true;
                this.logoFile = null;
                const currentLogoImg = this.shadowRoot.querySelector('#current_logo_img');
                if (currentLogoImg) currentLogoImg.style.display = 'none';
                const logoPreview = this.shadowRoot.querySelector('#logoPreview');
                if (logoPreview) {
                     logoPreview.style.display = 'none';
                     logoPreview.src = '';
                }
                this.shadowRoot.querySelector('#logoname').value = ''; // Clear file input
                // Consider a visual cue that it's marked for removal
            });
        }
    }

    _handleSubmit(event) {
        event.preventDefault();
        const formData = new FormData(event.target);
        const settingsDetails = {};

        settingsDetails.id = formData.get('id');
        settingsDetails.store = formData.get('store');
        settingsDetails.address_one = formData.get('address_one');
        settingsDetails.address_two = formData.get('address_two');
        settingsDetails.contact = formData.get('contact');
        settingsDetails.tax = formData.get('tax_number');
        settingsDetails.symbol = formData.get('symbol');
        settingsDetails.currency = formData.get('currency');
        settingsDetails.percentage = formData.get('percentage') ? parseFloat(formData.get('percentage')) : 0;
        settingsDetails.charge_tax = this.shadowRoot.querySelector('#charge_tax').checked;
        settingsDetails.footer = formData.get('footer');

        settingsDetails.remove_logo = this.removeLogoFlag;
        if (this.logoFile) {
            settingsDetails.logofile_name = this.logoFile.name;
            // In a real scenario, you'd handle the file upload here or pass the file object.
            // For now, we're just passing the name. The service layer would need to be adapted.
            // If a data URL preview was stored and small enough, it could be passed.
            // settingsDetails.logo_data_url = this.shadowRoot.querySelector('#logoPreview')?.src;
        } else {
           settingsDetails.logofile_name = null; // Explicitly null if no new file
        }


        settingsDetails.stripestatus = this.shadowRoot.querySelector('#stripestatus').checked ? 'live' : 'test';
        settingsDetails.stripelivepublishable = formData.get('stripelivepublishable');
        settingsDetails.stripelivesecret = formData.get('stripelivesecret');
        settingsDetails.stripetestpublishable = formData.get('stripetestpublishable');
        settingsDetails.stripetestsecret = formData.get('stripetestsecret');
        settingsDetails.stripeterminallivelocationid = formData.get('stripeterminallivelocationid');
        settingsDetails.stripeterminaltestlocationid = formData.get('stripeterminaltestlocationid');
        settingsDetails.stripemcc = formData.get('stripemcc');

        this.dispatchEvent(new CustomEvent('save-settings', {
            detail: settingsDetails,
            bubbles: true,
            composed: true
        }));
    }

    get settingsData() {
        return this._settingsData;
    }

    set settingsData(data) {
        this._settingsData = data;
        // If component is already in DOM, populate form. Otherwise, render will call populate.
        if (this.shadowRoot.querySelector('form')) {
            this._populateForm();
        }
    }

    _populateForm() {
        const form = this.shadowRoot.querySelector('#settingsComponentForm');
        if (!form || !this._settingsData) return;

        form.querySelector('#settings_id').value = this._settingsData._id || this._settingsData.id || '';
        form.querySelector('#store').value = this._settingsData.store || '';
        form.querySelector('#address_one').value = this._settingsData.address_one || '';
        form.querySelector('#address_two').value = this._settingsData.address_two || '';
        form.querySelector('#contact').value = this._settingsData.contact || '';
        form.querySelector('#tax_number').value = this._settingsData.tax || '';
        form.querySelector('#symbol').value = this._settingsData.symbol || '';
        form.querySelector('#currency').value = this._settingsData.currency || '';
        form.querySelector('#percentage').value = this._settingsData.percentage || '0';
        form.querySelector('#charge_tax').checked = !!this._settingsData.charge_tax;
        form.querySelector('#footer').value = this._settingsData.footer || '';

        const currentLogoImg = this.shadowRoot.querySelector('#current_logo_img');
        if (this._settingsData.logo) {
            currentLogoImg.src = `assets/images/${this._settingsData.logo}`;
            currentLogoImg.style.display = 'block';
        } else {
            currentLogoImg.style.display = 'none';
        }
        this.shadowRoot.querySelector('#logoname').value = '';
        this.shadowRoot.querySelector('#logoPreview').style.display = 'none';
        this.shadowRoot.querySelector('#logoPreview').src = '';
        this.logoFile = null;
        this.removeLogoFlag = false;

        form.querySelector('#stripestatus').checked = (this._settingsData.stripestatus === 'live');
        form.querySelector('#stripelivepublishable').value = this._settingsData.stripelivepublishable || '';
        form.querySelector('#stripelivesecret').value = this._settingsData.stripelivesecret || '';
        form.querySelector('#stripetestpublishable').value = this._settingsData.stripetestpublishable || '';
        form.querySelector('#stripetestsecret').value = this._settingsData.stripetestsecret || '';
        form.querySelector('#stripeterminallivelocationid').value = this._settingsData.stripeterminallivelocationid || '';
        form.querySelector('#stripeterminaltestlocationid').value = this._settingsData.stripeterminaltestlocationid || '';
        form.querySelector('#stripemcc').value = this._settingsData.stripemcc || '';
    }

    render() {
        // Full list of currencies and MCC codes should be added for full fidelity.
        // Using placeholders for brevity in this example.
        const currencies = this._settingsData && this._settingsData.available_currencies ? this._settingsData.available_currencies : [
            { value: "USD", label: "US Dollar" }, { value: "EUR", label: "Euro" }, { value: "GBP", label: "British Pound" }, /* ... more */
        ];
        const mccCodes = this._settingsData && this._settingsData.available_mcc_codes ? this._settingsData.available_mcc_codes : [
            { value: "5812", label: "Eating Places, Restaurants (5812)" }, { value: "5411", label: "Grocery Stores, Supermarkets (5411)" }, /* ... more */
        ];

        this.shadowRoot.innerHTML = `
            <style>
                /* Basic form styling */
                .form-group { margin-bottom: 1rem; }
                label { display: block; margin-bottom: .5rem; font-weight: bold; }
                .form-control, select { display: block; width: 100%; padding: .375rem .75rem; font-size: 1rem; line-height: 1.5; color: #495057; background-color: #fff; background-clip: padding-box; border: 1px solid #ced4da; border-radius: .25rem; box-sizing: border-box; }
                textarea.form-control { min-height: 80px; }
                .btn { display: inline-block; font-weight: 400; text-align: center; vertical-align: middle; cursor: pointer; user-select: none; background-color: transparent; border: 1px solid transparent; padding: .375rem .75rem; font-size: 1rem; line-height: 1.5; border-radius: .25rem; }
                .btn-primary { color: #fff; background-color: #007bff; border-color: #007bff; }
                .btn-warning { color: #212529; background-color: #ffc107; border-color: #ffc107; }
                .btn-block { display: block; width: 100%; margin-top: 1rem;}
                .row { display: flex; flex-wrap: wrap; margin-right: -15px; margin-left: -15px; }
                .col-md-6 { position: relative; width: 100%; padding-right: 15px; padding-left: 15px; flex: 0 0 50%; max-width: 50%; box-sizing: border-box;}
                .col-md-12 { position: relative; width: 100%; padding-right: 15px; padding-left: 15px; flex: 0 0 100%; max-width: 100%; box-sizing: border-box;}
                hr { margin-top: 1rem; margin-bottom: 1rem; border: 0; border-top: 1px solid rgba(0,0,0,.1); }
                h4 { font-size: 1.25rem; margin-bottom: .5rem; }
                #current_logo_display img, #logoPreview { max-width: 100px; max-height: 100px; margin-bottom: 10px; display: block; }
                #logoPreview { display: none; } /* Hide preview initially */
            </style>
            <form id="settingsComponentForm">
                <input type="hidden" name="id" id="settings_id">

                <h4>Store Information</h4>
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label for="store">Store Name</label>
                            <input type="text" required name="store" class="form-control" id="store">
                        </div>
                        <div class="form-group">
                            <label for="address_one">Address Line 1</label>
                            <input type="text" name="address_one" class="form-control" id="address_one">
                        </div>
                        <div class="form-group">
                            <label for="address_two">Address Line 2</label>
                            <input type="text" name="address_two" class="form-control" id="address_two">
                        </div>
                        <div class="form-group">
                            <label for="contact">Contact Number</label>
                            <input type="text" name="contact" class="form-control" id="contact">
                        </div>
                        <div class="form-group">
                            <label for="tax_number">Vat Number</label>
                            <input type="text" name="tax_number" class="form-control" id="tax_number">
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group">
                            <label for="symbol">Currency Symbol</label>
                            <input type="text" required name="symbol" class="form-control" id="symbol">
                        </div>
                        <div class="form-group">
                            <label for="currency">Currency</label>
                            <select required name="currency" class="form-control" id="currency">
                                <option value="">Select Currency</option>
                                ${currencies.map(c => `<option value="${c.value}">${c.label}</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="percentage">Vat Percentage</label>
                            <input type="number" step="any" name="percentage" class="form-control" id="percentage">
                        </div>
                        <div class="form-group">
                            <label style="display:inline-flex; align-items:center;"><input type="checkbox" name="charge_tax" id="charge_tax" style="width:auto; margin-right: 5px;"> Charge Vat</label>
                        </div>
                         <div class="form-group">
                            <label for="logoname">Logo</label>
                            <div id="current_logo_display">
                                <img id="current_logo_img" src="#" alt="Current Logo" style="display:none;" />
                                <button type="button" id="removeCurrentLogoBtn" class="btn btn-warning btn-xs" style="padding: .25rem .5rem; font-size: .875rem;">Remove Current</button>
                            </div>
                            <img id="logoPreview" src="#" alt="New Logo Preview"/>
                            <input type="file" name="imagename" id="logoname" class="form-control" accept="image/*">
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label for="footer">Receipt Footer</label>
                    <textarea name="footer" class="form-control" id="footer"></textarea>
                </div>

                <hr>
                <h4>Stripe Configuration</h4>
                <div class="form-group">
                    <label style="display:inline-flex; align-items:center;"><input type="checkbox" name="stripestatus" id="stripestatus" style="width:auto; margin-right: 5px;"> Stripe Live Mode</label>
                </div>
                <div class="row">
                    <div class="col-md-6">
                        <div class="form-group">
                            <label for="stripelivepublishable">Stripe Live Publishable Key</label>
                            <input type="text" name="stripelivepublishable" class="form-control" id="stripelivepublishable">
                        </div>
                        <div class="form-group">
                            <label for="stripelivesecret">Stripe Live Secret Key</label>
                            <input type="text" name="stripelivesecret" class="form-control" id="stripelivesecret">
                        </div>
                         <div class="form-group">
                            <label for="stripeterminallivelocationid">Stripe Terminal Live Location ID</label>
                            <input type="text" name="stripeterminallivelocationid" class="form-control" id="stripeterminallivelocationid">
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="form-group">
                            <label for="stripetestpublishable">Stripe Test Publishable Key</label>
                            <input type="text" name="stripetestpublishable" class="form-control" id="stripetestpublishable">
                        </div>
                        <div class="form-group">
                            <label for="stripetestsecret">Stripe Test Secret Key</label>
                            <input type="text" name="stripetestsecret" class="form-control" id="stripetestsecret">
                        </div>
                        <div class="form-group">
                            <label for="stripeterminaltestlocationid">Stripe Terminal Test Location ID</label>
                            <input type="text" name="stripeterminaltestlocationid" class="form-control" id="stripeterminaltestlocationid">
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label for="stripemcc">Stripe Merchant Category (MCC)</label>
                    <select name="stripemcc" class="form-control" id="stripemcc">
                        <option value="">Select</option>
                         ${mccCodes.map(m => `<option value="${m.value}">${m.label}</option>`).join('')}
                    </select>
                </div>

                <input type="submit" class="btn btn-primary btn-block waves-effect waves-light" value="Save Settings">
            </form>
        `;
    }
}
customElements.define('settings-modal-content', SettingsModalContent);
