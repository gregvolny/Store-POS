class UserFormModalContent extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._userData = null; // For editing
        this._isNewUser = true; // Default to new user
    }

    connectedCallback() {
        this.render();
        this.shadowRoot.querySelector('form').addEventListener('submit', this._handleSubmit.bind(this));
    }

    _handleSubmit(event) {
        event.preventDefault();
        const form = event.target;
        const formData = new FormData(form);
        const userDetails = {
            fullname: formData.get('fullname'),
            username: formData.get('username'),
            password: formData.get('password'),
            // Permissions
            perm_products: form.querySelector('#perm_products').checked,
            perm_categories: form.querySelector('#perm_categories').checked,
            perm_transactions: form.querySelector('#perm_transactions').checked,
            perm_users: form.querySelector('#perm_users').checked,
            perm_settings: form.querySelector('#perm_settings').checked,
        };

        const confirmPassword = formData.get('confirmPassword');

        if (!this._isNewUser && !userDetails.password && !confirmPassword) {
            // If editing and password fields are empty, don't send password for update
            delete userDetails.password;
        } else {
            if (userDetails.password !== confirmPassword) {
                // Basic validation, can be enhanced with a proper message display
                alert('Passwords do not match!'); // Replace with a better notification
                return;
            }
             if (!userDetails.password && this._isNewUser) { // Password required for new user
                alert('Password is required for new users.');
                return;
            }
        }

        if (this._userData && this._userData.id) {
            userDetails.id = this._userData.id;
        }

        this.dispatchEvent(new CustomEvent('save-user', {
            detail: userDetails,
            bubbles: true,
            composed: true
        }));
    }

    get userData() {
        return this._userData;
    }

    set userData(data) {
        this._isNewUser = !(data && data.id);
        this._userData = data;
        // Call render before trying to access shadowRoot elements if it's conditional
        if (!this.shadowRoot.querySelector('form')) {
            this.render();
        }
        this._populateForm();
    }

    _populateForm() {
        const form = this.shadowRoot.querySelector('form');
        // Ensure password fields are updated correctly based on _isNewUser state
        const passwordInput = form.querySelector('#password');
        const confirmPasswordInput = form.querySelector('#confirmPassword');

        if (this._userData) {
            form.querySelector('#user_id').value = this._userData.id || '';
            form.querySelector('#fullname').value = this._userData.fullname || '';
            form.querySelector('#username').value = this._userData.username || '';

            passwordInput.setAttribute('placeholder', this._isNewUser ? 'Password' : 'Leave blank to keep current');
            confirmPasswordInput.setAttribute('placeholder', this._isNewUser ? 'Repeat Password' : 'Leave blank to keep current');
            passwordInput.required = this._isNewUser;
            confirmPasswordInput.required = this._isNewUser;

            form.querySelector('#perm_products').checked = !!this._userData.perm_products;
            form.querySelector('#perm_categories').checked = !!this._userData.perm_categories;
            form.querySelector('#perm_transactions').checked = !!this._userData.perm_transactions;
            form.querySelector('#perm_users').checked = !!this._userData.perm_users;
            form.querySelector('#perm_settings').checked = !!this._userData.perm_settings;
        } else {
            form.reset();
            form.querySelector('#user_id').value = '';
            passwordInput.setAttribute('placeholder', 'Password');
            confirmPasswordInput.setAttribute('placeholder', 'Repeat Password');
            passwordInput.required = true;
            confirmPasswordInput.required = true;
        }
    }

    resetForm() {
        const form = this.shadowRoot.querySelector('form');
        if (form) {
            form.reset();
            form.querySelector('#user_id').value = '';
            const passwordInput = form.querySelector('#password');
            const confirmPasswordInput = form.querySelector('#confirmPassword');
            passwordInput.setAttribute('placeholder', 'Password');
            confirmPasswordInput.setAttribute('placeholder', 'Repeat Password');
            passwordInput.required = true;
            confirmPasswordInput.required = true;
        }
        this._userData = null;
        this._isNewUser = true;
         // After resetting, ensure placeholders and required attributes reflect the 'new user' state
        if (this.shadowRoot.querySelector('form')) { // Re-populate to set placeholders correctly
             this._populateForm();
        }
    }

    render() {
        // Determine required state for password based on _isNewUser at render time
        const passwordRequired = this._isNewUser;
        const passwordPlaceholder = this._isNewUser ? 'Password' : 'Leave blank to keep current password';
        const confirmPlaceholder = this._isNewUser ? 'Repeat Password' : 'Leave blank to keep current password';

        this.shadowRoot.innerHTML = `
            <style>
                .form-group { margin-bottom: 1rem; }
                label { display: block; margin-bottom: .5rem; }
                .form-control { display: block; width: 100%; padding: .375rem .75rem; font-size: 1rem; line-height: 1.5; color: #495057; background-color: #fff; background-clip: padding-box; border: 1px solid #ced4da; border-radius: .25rem; box-sizing: border-box; }
                .btn { display: inline-block; font-weight: 400; color: #212529; text-align: center; vertical-align: middle; cursor: pointer; user-select: none; background-color: transparent; border: 1px solid transparent; padding: .375rem .75rem; font-size: 1rem; line-height: 1.5; border-radius: .25rem; }
                .btn-primary { color: #fff; background-color: #007bff; border-color: #007bff; }
                .btn-block { display: block; width: 100%; }
                .perms { margin-top: 20px; }
                .perms h4 { font-size: 18px; margin-bottom: 10px; }
                .perms .form-group { margin-bottom: .5rem; }
                .perms label { font-weight: normal; }
                .perms input[type="checkbox"] { margin-right: 5px; vertical-align: middle; }
            </style>
            <form>
                <input type="hidden" name="id" id="user_id">
                <div class="form-group">
                    <label for="fullname">Name*</label>
                    <input type="text" required name="fullname" placeholder="Enter name" class="form-control" id="fullname">
                </div>
                <div class="form-group">
                    <label for="username">Username*</label>
                    <input type="text" required name="username" placeholder="Login Username" class="form-control" id="username">
                </div>
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" name="password" placeholder="${passwordPlaceholder}" class="form-control" id="password" ${passwordRequired ? 'required' : ''}>
                </div>
                <div class="form-group">
                    <label for="confirmPassword">Repeat Password</label>
                    <input type="password" name="confirmPassword" placeholder="${confirmPlaceholder}" class="form-control" id="confirmPassword" ${passwordRequired ? 'required' : ''}>
                </div>

                <div class="perms">
                    <h4>Permissions</h4>
                    <hr style="margin-top:0; margin-bottom:10px;">
                    <div class="form-group">
                        <label><input type="checkbox" name="perm_products" id="perm_products"> Manage Products and Stock</label>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" name="perm_categories" id="perm_categories"> Manage Product Categories</label>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" name="perm_transactions" id="perm_transactions"> View Transactions</label>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" name="perm_users" id="perm_users"> Manage Users and Permissions</label>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" name="perm_settings" id="perm_settings"> Manage Settings</label>
                    </div>
                </div>

                <input type="submit" class="btn btn-primary btn-block waves-effect waves-light" value="Save User">
            </form>
        `;
    }
}

customElements.define('user-form-modal-content', UserFormModalContent);
