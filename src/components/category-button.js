const categoryButtonTemplate = document.createElement('template');
categoryButtonTemplate.innerHTML = `
  <style>
    :host {
      display: inline-block; /* Behave like a button */
      margin: 2px;
    }
    button {
      padding: 8px 12px;
      border: 1px solid #ccc;
      background-color: #f8f9fa; /* Light grey, similar to btn-white */
      color: #212529;
      cursor: pointer;
      border-radius: 4px;
      font-size: 0.9em;
    }
    button:hover {
      background-color: #e2e6ea;
    }
    button.active { /* Style for active button */
      background-color: #007bff;
      color: white;
      border-color: #007bff;
    }
    /* TODO: Add styles for btn-white, waves-effect, waves-light if desired within component,
       or rely on global styles if they can pierce Shadow DOM / component is light DOM.
       For now, keeping it simple. */
  </style>
  <button type="button">
    <slot></slot> <!-- For the category name -->
  </button>
`;

class CategoryButton extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(categoryButtonTemplate.content.cloneNode(true));
    this._buttonElement = this.shadowRoot.querySelector('button');
  }

  static get observedAttributes() {
    return ['category-id', 'category-name', 'active'];
  }

  connectedCallback() {
    this._buttonElement.addEventListener('click', this._onClick.bind(this));
    this._render();
  }

  disconnectedCallback() {
    this._buttonElement.removeEventListener('click', this._onClick.bind(this));
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      this._render();
    }
  }

  set categoryId(value) {
    this.setAttribute('category-id', value);
  }

  get categoryId() {
    return this.getAttribute('category-id');
  }

  set categoryName(value) {
    this.setAttribute('category-name', value);
  }

  get categoryName() {
    return this.getAttribute('category-name');
  }

  set active(value) {
    const isActive = Boolean(value);
    if (isActive) {
      this.setAttribute('active', '');
    } else {
      this.removeAttribute('active');
    }
  }

  get active() {
    return this.hasAttribute('active');
  }

  _render() {
    const name = this.getAttribute('category-name') || 'Unnamed Category';
    // Use textContent for the button, or default slot if preferred.
    // If using slot, the name would be set in light DOM: <category-button>Category Name</category-button>
    this._buttonElement.textContent = name;

    if (this.hasAttribute('active')) {
      this._buttonElement.classList.add('active');
    } else {
      this._buttonElement.classList.remove('active');
    }
  }

  _onClick() {
    const catId = this.getAttribute('category-id');
    if (catId) {
      this.dispatchEvent(new CustomEvent('filter-category', {
        detail: { categoryId: catId },
        bubbles: true,
        composed: true
      }));
    }
  }
}

customElements.define('category-button', CategoryButton);
export default CategoryButton;
