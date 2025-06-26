const productCardTemplate = document.createElement('template');
productCardTemplate.innerHTML = `
  <style>
    /* Basic styling - can be expanded or use Bootstrap parts if ::part is adopted */
    :host {
      display: block; /* Or inline-block, depending on layout needs */
      cursor: pointer;
      /* Default Bootstrap .col-lg-2 like width, can be overridden by parent layout */
      /* width: 16.66666667%; */
      padding: 5px; /* Mimic some spacing */
      box-sizing: border-box;
    }
    .widget-panel {
      border: 1px solid #eee;
      padding: 10px;
      text-align: center;
      background-color: #fff;
      border-radius: 5px;
      height: 100%; /* Make panel fill host height */
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .widget-panel:hover {
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }
    .product-image-container {
      width: 100%;
      height: 100px; /* Fixed height for image container */
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 10px;
      overflow: hidden;
    }
    .product-image {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .product-name {
      font-weight: bold;
      margin-bottom: 5px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .product-sku, .product-lot, .product-stock-status, .product-unit {
      font-size: 0.85em;
      color: #6c757d; /* text-muted like */
      margin-bottom: 3px;
    }
    .product-price {
      font-size: 1.1em;
      font-weight: bold;
      color: #28a745; /* text-success like */
      margin-top: auto; /* Pushes price to the bottom if other content varies */
    }
    .stock-label {
      font-weight: 500;
    }
  </style>
  <div class="widget-panel widget-style-2">
    <div class="product-image-container">
      <img class="product-image" src="./assets/images/default.jpg" alt="Product Image">
    </div>
    <div class="product-details">
      <div class="product-name">Product Name</div>
      <div class="product-sku">SKU: <span></span></div>
      <div class="product-lot">LOT#: <span></span></div>
      <div class="product-stock-status">
        <span class="stock-label">STOCK:</span> <span class="count">N/A</span>
      </div>
      <div class="product-unit">Unit: <span></span></div>
    </div>
    <div class="product-price">
      <span>$0.00</span>
    </div>
  </div>
`;

class ProductCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(productCardTemplate.content.cloneNode(true));
    this._productId = null;
  }

  static get observedAttributes() {
    return ['product-id', 'name', 'price', 'image-url', 'quantity', 'stock-tracking', 'sku', 'lotnumber', 'unit', 'currency-symbol'];
  }

  connectedCallback() {
    this.addEventListener('click', this._onClick);
    this._render(); // Initial render based on attributes set before connection or default values
  }

  disconnectedCallback() {
    this.removeEventListener('click', this._onClick);
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this._render();
    }
  }

  // Properties to set data, which can then call _render or set attributes
  set product(data) {
    this._productId = data.id || data._id; // Handle both _id and id
    this.setAttribute('product-id', this._productId);
    this.setAttribute('name', data.name || 'N/A');
    this.setAttribute('price', data.price || '0.00');
    this.setAttribute('image-url', data.img || ''); // Use 'img' from data
    this.setAttribute('quantity', data.quantity !== undefined ? data.quantity.toString() : '0');
    // 'stock' in data: 0 means track stock, 1 means don't track.
    // Web component 'stock-tracking': 'true' if stock is tracked (data.stock === 0), 'false' otherwise (data.stock === 1)
    this.setAttribute('stock-tracking', (data.stock === 0).toString());
    this.setAttribute('sku', data.sku || '');
    this.setAttribute('lotnumber', data.lotnumber || '');
    this.setAttribute('unit', data.unit || '');
    // Currency symbol can be passed from parent settings
    // this.setAttribute('currency-symbol', data.currencySymbol || '$');
  }


  _render() {
    const nameEl = this.shadowRoot.querySelector('.product-name');
    const priceEl = this.shadowRoot.querySelector('.product-price span');
    const imageEl = this.shadowRoot.querySelector('.product-image');
    const skuEl = this.shadowRoot.querySelector('.product-sku span');
    const lotEl = this.shadowRoot.querySelector('.product-lot span');
    const stockCountEl = this.shadowRoot.querySelector('.product-stock-status .count');
    const unitEl = this.shadowRoot.querySelector('.product-unit span');

    const currencySymbol = this.getAttribute('currency-symbol') || '$';
    const name = this.getAttribute('name');
    const price = parseFloat(this.getAttribute('price')).toFixed(2);
    let imageUrl = this.getAttribute('image-url');
    const quantity = parseInt(this.getAttribute('quantity'));
    const stockTracking = this.getAttribute('stock-tracking') === 'true';

    nameEl.textContent = name;
    nameEl.title = name; // For tooltip on overflow
    priceEl.textContent = `${currencySymbol}${price}`;

    // Assuming img_path is globally available or passed differently for base path
    // For now, if imageUrl is relative, it's relative to the component's path or handled by bundler.
    // If it's just a filename, it needs a base path.
    // The original `img_path` was 'assets/images/'
    const basePath = 'assets/images/'; // This should align with webpack output
    imageEl.src = (imageUrl && imageUrl !== "") ? basePath + imageUrl : './assets/images/default.jpg';
    imageEl.alt = name;

    skuEl.textContent = this.getAttribute('sku') || 'N/A';
    lotEl.textContent = this.getAttribute('lotnumber') || 'N/A';
    unitEl.textContent = this.getAttribute('unit') || 'N/A';

    if (stockTracking) {
      stockCountEl.textContent = quantity;
      if (quantity <= 0) {
        // Optionally add a class to indicate out of stock
        this.shadowRoot.querySelector('.widget-panel').style.opacity = '0.7';
      } else {
        this.shadowRoot.querySelector('.widget-panel').style.opacity = '1';
      }
    } else {
      stockCountEl.textContent = 'N/A';
      this.shadowRoot.querySelector('.widget-panel').style.opacity = '1';
    }

    this._productId = this.getAttribute('product-id');
  }

  _onClick() {
    // Logic from original: $(this).addToCart(${item._id}, ${item.quantity}, ${item.stock})
    // The component itself doesn't know the global cart or full stock details for complex checks.
    // It should primarily dispatch an event with its ID. The parent (pos.js) handles the logic.
    if (this._productId) {
      this.dispatchEvent(new CustomEvent('add-to-cart', {
        detail: {
            productId: this._productId,
            // Original addToCart also took quantity and stock status, but these might be stale.
            // Best to re-fetch product details or rely on ID only.
        },
        bubbles: true, // Allows event to bubble up to parent listeners
        composed: true // Allows event to cross shadow DOM boundaries
      }));
    } else {
        console.warn('ProductCard: product-id is not set, cannot dispatch add-to-cart event.');
    }
  }
}

customElements.define('product-card', ProductCard);
export default ProductCard; // Export class if needed for type checking or direct instantiation elsewhere
