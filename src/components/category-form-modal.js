const categoryFormModalTemplate = document.createElement('template');
categoryFormModalTemplate.innerHTML = `
  <style>
    form { display: flex; flex-direction: column; gap: 10px; }
    .form-group { display: flex; flex-direction: column; }
    label { margin-bottom: 2px; font-size: 0.9em; color: #555; }
    input[type="text"] {
      padding: 8px;
      border: 1px solid #ccc;
      border-radius: 4px;
      font-size: 0.9em;
    }
  </style>
  <form id="internalCategoryForm">
    <input type="hidden" name="id" id="category_id_field">
    <div class="form-group">
      <label for="categoryName_field">Name*</label>
      <input type="text" required name="name" class="form-control" id="categoryName_field" placeholder="Enter a category name">
    </div>
    <div class="form-group">
      <input type="submit" class="btn btn-primary btn-block" value="Save Category">
    </div>
  </form>
`;

class CategoryFormModalContent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(categoryFormModalTemplate.content.cloneNode(true));

    this._form = this.shadowRoot.querySelector('#internalCategoryForm');
    this._idField = this.shadowRoot.querySelector('#category_id_field');
    this._nameField = this.shadowRoot.querySelector('#categoryName_field');
  }

  connectedCallback() {
    this._form.addEventListener('submit', this._onSubmit.bind(this));
  }

  disconnectedCallback() {
    this._form.removeEventListener('submit', this._onSubmit.bind(this));
  }

  open(categoryData = null) { // categoryData is for editing, null for new
    this._form.reset();
    this._idField.value = '';

    if (categoryData) { // Editing existing category
      this._idField.value = categoryData._id || '';
      this._nameField.value = categoryData.name || '';
    }
    // The modal itself (e.g., #newCategory bootstrap modal) is opened by the calling code
  }

  _onSubmit(e) {
    e.preventDefault();
    const formData = new FormData(this._form);
    const categoryData = Object.fromEntries(formData.entries());

    this.dispatchEvent(new CustomEvent('save-category', {
      detail: { data: categoryData },
      bubbles: true,
      composed: true
    }));
  }
}

customElements.define('category-form-modal-content', CategoryFormModalContent);
export default CategoryFormModalContent;
