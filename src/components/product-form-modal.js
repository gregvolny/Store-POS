const productFormModalTemplate = document.createElement('template');
productFormModalTemplate.innerHTML = `
  <style>
    /* Basic form styling, can be enhanced */
    form { display: flex; flex-direction: column; gap: 10px; }
    .form-group { display: flex; flex-direction: column; }
    label { margin-bottom: 2px; font-size: 0.9em; color: #555; }
    input[type="text"], input[type="number"], input[type="file"], select {
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 0.9em;
    }
    input[type="checkbox"] { margin-right: 5px; }
    .image-preview { margin-top: 5px; max-width: 100px; max-height: 100px; }
    .btn-remove-img {
        font-size: 0.8em; padding: 2px 5px; margin-left: 10px; cursor: pointer;
        background-color: #ffc107; border: none; color: black; border-radius: 3px;
    }
    /* Add more styles as needed, potentially from Bootstrap form controls if not using global Bootstrap */
  </style>
  <form id="internalProductForm">
    <input type="hidden" name="id" id="product_id_field">
    <input type="hidden" name="img" id="current_img_name_field"> <!-- To store existing image name -->
    <input type="hidden" name="remove_img_flag" id="remove_img_field" value="0">

    <div class="form-group">
      <label for="category_field">Category</label>
      <select name="category" id="category_field" class="form-control"></select>
    </div>
    <div class="form-group">
      <label for="productName_field">Product Name*</label>
      <input type="text" required name="name" class="form-control" id="productName_field" placeholder="Enter a product name">
    </div>
    <div class="form-group">
      <label for="productUnit_field">Product Unit*</label>
      <input type="text" required name="unit" class="form-control" id="productUnit_field" placeholder="e.g. loaf, slice, dozen">
    </div>
    <div class="form-group">
      <label for="lotNumber_field">Lot Number</label>
      <input type="text" name="lotnumber" class="form-control" id="lotNumber_field" placeholder="Enter lot number">
    </div>
    <div class="form-group">
      <label for="product_price_field">Price*</label>
      <input type="number" required name="price" placeholder="Price" class="form-control" id="product_price_field" step="0.01">
    </div>
    <div class="form-group">
      <label for="quantity_field">Stock Quantity</label>
      <input type="number" name="quantity" placeholder="Available stock" class="form-control" id="quantity_field" step="1">
    </div>
    <div class="form-group">
      <label>
        <input type="checkbox" name="stock" id="stock_disable_field"> Disable stock check
      </label>
    </div>
    <div class="form-group">
      <label for="imagename_field">
        Picture
        <button type="button" class="btn-remove-img" style="display:none;">Remove Current</button>
      </label>
      <div class="current-image-display"></div>
      <input type="file" name="imagename" id="imagename_field" accept="image/*">
    </div>
    <div class="form-group">
      <input type="submit" class="btn btn-primary btn-block" value="Save Product">
    </div>
  </form>
`;

class ProductFormModal extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(productFormModalTemplate.content.cloneNode(true));

    this._form = this.shadowRoot.querySelector('#internalProductForm');
    this._idField = this.shadowRoot.querySelector('#product_id_field');
    this._currentImgNameField = this.shadowRoot.querySelector('#current_img_name_field');
    this._removeImgField = this.shadowRoot.querySelector('#remove_img_field');
    this._categoryField = this.shadowRoot.querySelector('#category_field');
    this._productNameField = this.shadowRoot.querySelector('#productName_field');
    this._productUnitField = this.shadowRoot.querySelector('#productUnit_field');
    this._lotNumberField = this.shadowRoot.querySelector('#lotNumber_field');
    this._productPriceField = this.shadowRoot.querySelector('#product_price_field');
    this._quantityField = this.shadowRoot.querySelector('#quantity_field');
    this._stockDisableField = this.shadowRoot.querySelector('#stock_disable_field');
    this._imageNameField = this.shadowRoot.querySelector('#imagename_field');
    this._currentImageDisplay = this.shadowRoot.querySelector('.current-image-display');
    this._removeImageButton = this.shadowRoot.querySelector('.btn-remove-img');

    this._imgPath = 'assets/images/'; // Should align with pos.js img_path and webpack output
  }

  connectedCallback() {
    this._form.addEventListener('submit', this._onSubmit.bind(this));
    this._removeImageButton.addEventListener('click', this._onRemoveImage.bind(this));
  }

  disconnectedCallback() {
    this._form.removeEventListener('submit', this._onSubmit.bind(this));
    this._removeImageButton.removeEventListener('click', this._onRemoveImage.bind(this));
  }

  set categories(categoriesData = []) {
    this._categoryField.innerHTML = '<option value="">Select Category</option>';
    categoriesData.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat._id;
      option.textContent = cat.name;
      this._categoryField.appendChild(option);
    });
  }

  open(productData = null) { // productData is for editing, null for new
    this._form.reset();
    this._idField.value = '';
    this._currentImgNameField.value = '';
    this._removeImgField.value = '0';
    this._currentImageDisplay.innerHTML = '';
    this._removeImageButton.style.display = 'none';
    this._imageNameField.style.display = 'block';


    if (productData) { // Editing existing product
      this._idField.value = productData._id || '';
      this._categoryField.value = productData.category || '';
      this._productNameField.value = productData.name || '';
      this._productUnitField.value = productData.unit || '';
      this._lotNumberField.value = productData.lotnumber || '';
      this._productPriceField.value = productData.price || '';
      this._quantityField.value = productData.quantity !== undefined ? productData.quantity : '';
      // Original logic: stock == 0 means checkbox is checked (stock check enabled, not disabled)
      // new logic: checkbox "Disable stock check" means if checked, product.stock = 1 (don't track)
      this._stockDisableField.checked = productData.stock === 1; // 1 means stock check is disabled

      if (productData.img) {
        this._currentImgNameField.value = productData.img;
        this._currentImageDisplay.innerHTML = `<img src="${this._imgPath + productData.img}" alt="Current Image" class="image-preview">`;
        this._removeImageButton.style.display = 'inline-block';
        this._imageNameField.style.display = 'none'; // Hide file input if there's a current image
      }
    }
    // The modal itself (e.g., #newProduct bootstrap modal) should be opened by the calling code
  }

  _onRemoveImage() {
    this._removeImgField.value = '1'; // Signal to backend/service to remove image
    this._currentImgNameField.value = ''; // Clear current image name
    this._currentImageDisplay.innerHTML = '';
    this._removeImageButton.style.display = 'none';
    this._imageNameField.style.display = 'block';
    this._imageNameField.value = ''; // Clear any selected file
  }

  _onSubmit(e) {
    e.preventDefault();
    const formData = new FormData(this._form);
    const productData = Object.fromEntries(formData.entries());

    // Adjust checkbox value for 'stock' (disable stock check)
    // If 'stock_disable_field' is checked (value 'on'), then product.stock should be 1 (don't track)
    // If unchecked, product.stock should be 0 (track stock)
    productData.stock = this.shadowRoot.querySelector('#stock_disable_field').checked ? 'on' : 'off';
                                                                                    // Service expects 'on' or 'off'
                                                                                    // which it then converts to 0 or 1.

    // Keep existing image if no new one is selected and old one wasn't removed
    if (!this._imageNameField.files[0] && this._currentImgNameField.value && this._removeImgField.value === '0') {
        productData.img = this._currentImgNameField.value;
    } else if (this._removeImgField.value === '1') {
        productData.img = ''; // Image was removed
    }
    // If a new image is selected, it will be in productData.imagename (File object)

    this.dispatchEvent(new CustomEvent('save-product', {
      detail: {
        data: productData,
        file: this._imageNameField.files[0] || null
      },
      bubbles: true,
      composed: true
    }));
  }
}

customElements.define('product-form-modal-content', ProductFormModal);
export default ProductFormModal;
