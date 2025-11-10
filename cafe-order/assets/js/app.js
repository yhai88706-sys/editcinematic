const API_BASE_URL = 'http://localhost:4000';

const state = {
  products: [],
  filteredProducts: [],
  categories: [],
  cart: [],
  orderType: 'takeaway',
  tableNumber: '',
  note: '',
  selectedProduct: null,
};

const elements = {
  menuGrid: document.getElementById('menuGrid'),
  categoryFilter: document.getElementById('categoryFilter'),
  searchInput: document.getElementById('searchInput'),
  cartItems: document.getElementById('cartItems'),
  cartTotal: document.getElementById('cartTotal'),
  orderNote: document.getElementById('orderNote'),
  orderTypeToggle: document.getElementById('orderTypeToggle'),
  tableInputWrap: document.getElementById('tableInputWrap'),
  tableNumber: document.getElementById('tableNumber'),
  cartOrderType: document.getElementById('cartOrderType'),
  confirmOrderBtn: document.getElementById('confirmOrderBtn'),
  productModal: document.getElementById('productModal'),
  closeModal: document.getElementById('closeModal'),
  addToCartBtn: document.getElementById('addToCartBtn'),
  modalProductName: document.getElementById('modalProductName'),
  modalProductDesc: document.getElementById('modalProductDesc'),
  modalProductPrice: document.getElementById('modalProductPrice'),
  modalItemNote: document.getElementById('modalItemNote'),
  successModal: document.getElementById('successModal'),
  successOrderCode: document.getElementById('successOrderCode'),
  successOrderType: document.getElementById('successOrderType'),
  successOrderTotal: document.getElementById('successOrderTotal'),
  closeSuccessBtn: document.getElementById('closeSuccessBtn'),
};

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function init() {
  elements.tableInputWrap.style.display = 'none';
  bindEvents();
  fetchProducts();
  renderCart();
}

function bindEvents() {
  elements.categoryFilter.addEventListener('click', handleCategoryClick);
  elements.searchInput.addEventListener('input', handleSearch);
  elements.orderTypeToggle.addEventListener('click', handleOrderTypeToggle);
  elements.confirmOrderBtn.addEventListener('click', handleConfirmOrder);
  elements.orderNote.addEventListener('input', (e) => {
    state.note = e.target.value;
  });
  elements.closeModal.addEventListener('click', hideProductModal);
  elements.productModal.addEventListener('click', (event) => {
    if (event.target === elements.productModal) {
      hideProductModal();
    }
  });
  elements.addToCartBtn.addEventListener('click', handleAddToCart);
  elements.closeSuccessBtn.addEventListener('click', hideSuccessModal);
  elements.successModal.addEventListener('click', (event) => {
    if (event.target === elements.successModal) {
      hideSuccessModal();
    }
  });
}

async function fetchProducts() {
  try {
    const response = await fetch(`${API_BASE_URL}/products`);
    if (!response.ok) {
      throw new Error('Không thể tải sản phẩm');
    }
    const data = await response.json();
    state.products = data.filter((item) => item.isActive !== false);
    deriveCategories();
    applyFilters();
  } catch (error) {
    console.error(error);
    elements.menuGrid.innerHTML = `<div class="empty">Không thể tải menu. Vui lòng kiểm tra server JSON.</div>`;
  }
}

function deriveCategories() {
  const categories = new Set(state.products.map((product) => product.category));
  state.categories = ['all', ...Array.from(categories)];
  renderCategoryChips();
}

function renderCategoryChips() {
  elements.categoryFilter.innerHTML = '';
  state.categories.forEach((category, index) => {
    const button = document.createElement('button');
    button.className = `chip${index === 0 ? ' active' : ''}`;
    button.dataset.category = category;
    button.textContent = category === 'all' ? 'Tất cả' : formatCategoryName(category);
    elements.categoryFilter.appendChild(button);
  });
}

function formatCategoryName(category) {
  const mapping = {
    coffee: 'Cà phê',
    tea: 'Trà',
    iceblend: 'Đá xay',
    cake: 'Bánh',
    smoothie: 'Sinh tố',
  };
  return mapping[category] || category;
}

function handleCategoryClick(event) {
  const button = event.target.closest('button[data-category]');
  if (!button) return;

  elements.categoryFilter.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('active'));
  button.classList.add('active');
  applyFilters();
}

function handleSearch() {
  applyFilters();
}

function applyFilters() {
  const searchTerm = elements.searchInput.value.trim().toLowerCase();
  const activeCategoryButton = elements.categoryFilter.querySelector('.chip.active');
  const activeCategory = activeCategoryButton ? activeCategoryButton.dataset.category : 'all';

  state.filteredProducts = state.products.filter((product) => {
    const matchCategory = activeCategory === 'all' || product.category === activeCategory;
    const matchSearch = product.name.toLowerCase().includes(searchTerm);
    return matchCategory && matchSearch;
  });

  renderProducts();
}

function renderProducts() {
  if (!state.filteredProducts.length) {
    elements.menuGrid.innerHTML = '<div class="empty">Không tìm thấy món phù hợp.</div>';
    return;
  }

  elements.menuGrid.innerHTML = '';
  state.filteredProducts.forEach((product) => {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.innerHTML = `
      <div>
        <h4>${product.name}</h4>
        <div class="price">${formatCurrency(product.price)}</div>
      </div>
      <div class="desc">${product.description || ''}</div>
    `;
    card.addEventListener('click', () => openProductModal(product));
    elements.menuGrid.appendChild(card);
  });
}

function openProductModal(product) {
  state.selectedProduct = product;
  elements.modalProductName.textContent = product.name;
  elements.modalProductDesc.textContent = product.description || '';
  elements.modalProductPrice.textContent = formatCurrency(product.price);
  elements.modalItemNote.value = '';

  const defaultSize = elements.productModal.querySelector('input[name="modalSize"][value="M"]');
  const defaultIce = elements.productModal.querySelector('input[name="modalIce"][value="50%"]');
  const defaultSugar = elements.productModal.querySelector('input[name="modalSugar"][value="50%"]');
  if (defaultSize) defaultSize.checked = true;
  if (defaultIce) defaultIce.checked = true;
  if (defaultSugar) defaultSugar.checked = true;

  elements.productModal.setAttribute('aria-hidden', 'false');
}

function hideProductModal() {
  state.selectedProduct = null;
  elements.productModal.setAttribute('aria-hidden', 'true');
}

function handleAddToCart() {
  if (!state.selectedProduct) return;

  const size = getCheckedValue('modalSize');
  const ice = getCheckedValue('modalIce');
  const sugar = getCheckedValue('modalSugar');
  const note = elements.modalItemNote.value.trim();
  addItemToCart(state.selectedProduct, { size, ice, sugar, note });
  hideProductModal();
}

function getCheckedValue(name) {
  const input = elements.productModal.querySelector(`input[name="${name}"]:checked`);
  return input ? input.value : null;
}

function addItemToCart(product, options) {
  const existingItem = state.cart.find((item) => {
    return (
      item.productId === product.id &&
      item.options.size === options.size &&
      item.options.ice === options.ice &&
      item.options.sugar === options.sugar &&
      (item.options.note || '') === (options.note || '')
    );
  });

  if (existingItem) {
    existingItem.qty += 1;
    existingItem.lineTotal = existingItem.qty * existingItem.unitPrice;
  } else {
    const cartItem = {
      id: `${product.id}-${Date.now()}`,
      productId: product.id,
      name: product.name,
      qty: 1,
      unitPrice: product.price,
      lineTotal: product.price,
      options: {
        size: options.size,
        ice: options.ice,
        sugar: options.sugar,
        note: options.note,
      },
    };
    state.cart.push(cartItem);
  }

  renderCart();
}

function renderCart() {
  if (!state.cart.length) {
    elements.cartItems.innerHTML = '<div class="empty">Chưa có món nào</div>';
  } else {
    elements.cartItems.innerHTML = '';
    state.cart.forEach((item) => {
      const div = document.createElement('div');
      div.className = 'cart-item';
      div.innerHTML = `
        <div class="cart-item-header">
          <span class="cart-item-title">${item.name}</span>
          <button class="delete-btn" data-id="${item.id}">Xóa</button>
        </div>
        <div class="cart-item-options">
          ${renderItemOptions(item.options)}
        </div>
        <div class="cart-item-footer">
          <div class="qty-control">
            <button data-action="decrement" data-id="${item.id}">−</button>
            <span>${item.qty}</span>
            <button data-action="increment" data-id="${item.id}">+</button>
          </div>
          <div class="line-total">${formatCurrency(item.lineTotal)}</div>
        </div>
      `;
      elements.cartItems.appendChild(div);
    });
  }

  elements.cartItems.querySelectorAll('button[data-action]').forEach((button) => {
    button.addEventListener('click', handleQtyChange);
  });

  elements.cartItems.querySelectorAll('button.delete-btn').forEach((button) => {
    button.addEventListener('click', handleRemoveItem);
  });

  updateCartSummary();
}

function renderItemOptions(options = {}) {
  const parts = [];
  if (options.size) parts.push(`Size ${options.size}`);
  if (options.ice) parts.push(`Đá ${options.ice}`);
  if (options.sugar) parts.push(`Đường ${options.sugar}`);
  if (options.note) parts.push(`Ghi chú: ${options.note}`);
  return parts.length ? parts.join(' · ') : 'Tuỳ chọn mặc định';
}

function handleQtyChange(event) {
  const id = event.currentTarget.dataset.id;
  const action = event.currentTarget.dataset.action;
  const item = state.cart.find((cartItem) => cartItem.id === id);
  if (!item) return;

  if (action === 'increment') {
    item.qty += 1;
  } else if (action === 'decrement') {
    item.qty = Math.max(1, item.qty - 1);
  }
  item.lineTotal = item.qty * item.unitPrice;
  renderCart();
}

function handleRemoveItem(event) {
  const id = event.currentTarget.dataset.id;
  state.cart = state.cart.filter((item) => item.id !== id);
  renderCart();
}

function updateCartSummary() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.lineTotal, 0);
  elements.cartTotal.innerHTML = `
    <div class="line">
      <span>Tạm tính</span>
      <span>${formatCurrency(subtotal)}</span>
    </div>
    <div class="line total">
      <span>Tổng</span>
      <span>${formatCurrency(subtotal)}</span>
    </div>
  `;
}

function handleOrderTypeToggle(event) {
  const button = event.target.closest('.toggle-btn');
  if (!button) return;

  const type = button.dataset.type;
  if (!type) return;

  state.orderType = type;
  elements.orderTypeToggle.querySelectorAll('.toggle-btn').forEach((btn) => btn.classList.remove('active'));
  button.classList.add('active');

  if (type === 'table') {
    elements.tableInputWrap.style.display = 'flex';
    elements.tableNumber.focus();
    elements.cartOrderType.textContent = '🪑 Tại bàn';
  } else {
    elements.tableInputWrap.style.display = 'none';
    elements.tableNumber.value = '';
    state.tableNumber = '';
    elements.cartOrderType.textContent = '🥤 Mang đi';
  }
}

function validateOrder() {
  if (!state.cart.length) {
    alert('Vui lòng chọn ít nhất một món.');
    return false;
  }

  if (state.orderType === 'table') {
    const tableNumber = elements.tableNumber.value.trim();
    if (!tableNumber) {
      alert('Vui lòng nhập số bàn.');
      elements.tableNumber.focus();
      return false;
    }
    state.tableNumber = tableNumber;
  }

  return true;
}

function buildOrderPayload() {
  const subtotal = state.cart.reduce((sum, item) => sum + item.lineTotal, 0);
  const createdAt = new Date().toISOString();
  const code = generateOrderCode(createdAt);

  return {
    code,
    orderType: state.orderType,
    tableNumber: state.orderType === 'table' ? state.tableNumber : null,
    note: state.note,
    status: 'new',
    total: subtotal,
    createdAt,
    items: state.cart.map((item) => ({
      productId: item.productId,
      name: item.name,
      qty: item.qty,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      options: { ...item.options },
    })),
  };
}

function generateOrderCode(createdAt) {
  const date = new Date(createdAt);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 900 + 100);
  return `NB-${yyyy}${mm}${dd}-${random}`;
}

async function handleConfirmOrder() {
  if (!validateOrder()) return;

  elements.confirmOrderBtn.disabled = true;
  elements.confirmOrderBtn.textContent = 'Đang gửi...';

  const payload = buildOrderPayload();

  try {
    const response = await fetch(`${API_BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Không thể gửi order');
    }

    showSuccessModal(payload);
    resetCart();
  } catch (error) {
    console.error(error);
    alert('Không thể gửi order. Vui lòng kiểm tra kết nối server.');
  } finally {
    elements.confirmOrderBtn.disabled = false;
    elements.confirmOrderBtn.textContent = 'Xác nhận order';
  }
}

function showSuccessModal(order) {
  elements.successOrderCode.textContent = order.code;
  elements.successOrderType.textContent =
    order.orderType === 'table' ? `🪑 Tại bàn (Bàn ${order.tableNumber})` : '🥤 Mang đi';
  elements.successOrderTotal.textContent = formatCurrency(order.total);
  elements.successModal.setAttribute('aria-hidden', 'false');
}

function hideSuccessModal() {
  elements.successModal.setAttribute('aria-hidden', 'true');
}

function resetCart() {
  state.cart = [];
  state.note = '';
  state.tableNumber = '';
  elements.tableNumber.value = '';
  elements.orderNote.value = '';
  renderCart();
}

init();
