const API_BASE_URL = (window.CONFIG && window.CONFIG.API_BASE_URL) || 'http://localhost:4000';
const AUTO_REFRESH_INTERVAL = (window.CONFIG && window.CONFIG.REFRESH_INTERVAL_MS) || 8000;
const MESSAGE_TIMEOUT = 4500;
const HIGHLIGHT_DURATION = 3000;
const MANAGER_PIN = (window.CONFIG && window.CONFIG.MANAGER_PIN) || '2580';
const ENABLE_BEEP = !window.CONFIG || window.CONFIG.ENABLE_BEEP !== false;
const DEBUG_STALE_THRESHOLD_MS =
  (window.CONFIG && window.CONFIG.DEBUG_STALE_THRESHOLD_MS) || 30000;
const MAX_PIN_ATTEMPTS = 3;
let autoRefreshTimer = null;
let audioContext = null;

const state = {
  orders: [],
  filteredOrders: [],
  selectedOrderId: null,
  filterStatus: 'all',
  dateFilter: 'today',
  knownNewOrderIds: new Set(),
  highlightedOrderIds: new Set(),
  hasLoadedOnce: false,
  products: [],
  editingProductId: null,
  lastFetchAt: null,
  debugVisible: false,
  lastStatsContext: null,
};

const elements = {
  app: document.getElementById('managerApp'),
  pinGate: document.getElementById('pinGate'),
  pinForm: document.getElementById('pinForm'),
  pinInput: document.getElementById('pinInput'),
  pinError: document.getElementById('pinError'),
  toastStack: document.getElementById('toastStack'),
  tabs: document.getElementById('managerTabs'),
  ordersPanel: document.getElementById('ordersPanel'),
  menuPanel: document.getElementById('menuPanel'),
  statsPanel: document.getElementById('statsPanel'),
  dateFilters: document.getElementById('managerDateFilters'),
  statusFilters: document.getElementById('managerStatusFilters'),
  refreshBtn: document.getElementById('managerRefreshBtn'),
  lastUpdated: document.getElementById('managerLastUpdated'),
  ordersList: document.getElementById('managerOrdersList'),
  orderDetail: document.getElementById('managerOrderDetail'),
  productForm: document.getElementById('productForm'),
  productSubmitBtn: document.getElementById('productSubmitBtn'),
  cancelEditBtn: document.getElementById('cancelEditBtn'),
  productName: document.getElementById('productName'),
  productPrice: document.getElementById('productPrice'),
  productCategory: document.getElementById('productCategory'),
  productDescription: document.getElementById('productDescription'),
  productIsActive: document.getElementById('productIsActive'),
  productsList: document.getElementById('productsList'),
  statRange: document.getElementById('statRange'),
  statDate: document.getElementById('statDate'),
  statMonth: document.getElementById('statMonth'),
  statYear: document.getElementById('statYear'),
  calcStatsBtn: document.getElementById('calcStatsBtn'),
  statResult: document.getElementById('statResult'),
  statSummary: document.getElementById('statSummary'),
  totalOrdersValue: document.getElementById('totalOrders'),
  totalRevenueValue: document.getElementById('totalRevenue'),
  avgOrderValueValue: document.getElementById('avgOrderValue'),
  statusBreakdown: document.getElementById('statusBreakdown'),
  statError: document.getElementById('statError'),
  debugPanel: document.getElementById('debugPanel'),
  debugContent: document.getElementById('debugContent'),
};

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function toDateKey(isoString) {
  return typeof isoString === 'string' ? isoString.slice(0, 10) : '';
}

function isToday(isoString) {
  return toDateKey(isoString) === getTodayKey();
}

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
}

function formatDateTime(isoString) {
  if (!isoString) return '--';
  const date = new Date(isoString);
  return `${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function showMessage(type, text) {
  if (!elements.toastStack) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = text;
  elements.toastStack.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 320);
  }, MESSAGE_TIMEOUT);
}

function setupPinGate() {
  if (!elements.pinForm) return;
  let attempts = 0;
  elements.pinForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = (elements.pinInput.value || '').trim();
    if (value === MANAGER_PIN) {
      elements.pinGate.classList.add('is-hidden');
      elements.app.classList.remove('is-hidden');
      initManager();
    } else {
      attempts += 1;
      elements.pinError.textContent = 'Sai mã PIN. Vui lòng thử lại.';
      elements.pinInput.value = '';
      elements.pinInput.focus();
      if (attempts >= MAX_PIN_ATTEMPTS) {
        elements.pinError.textContent = 'Sai quá 3 lần. Vui lòng tải lại trang.';
        elements.pinInput.disabled = true;
        elements.pinForm.querySelector('button[type="submit"]').disabled = true;
      }
    }
  });
}

function initManager() {
  bindEvents();
  updateStatInputVisibility();
  fetchOrders();
  fetchProducts();
  startAutoRefresh();
}

function bindEvents() {
  if (elements.dateFilters) {
    elements.dateFilters.addEventListener('click', handleDateFilterClick);
  }
  elements.statusFilters.addEventListener('click', handleStatusFilterClick);
  elements.refreshBtn.addEventListener('click', () => fetchOrders());
  elements.orderDetail.addEventListener('click', handleOrderActionClick);
  elements.tabs.addEventListener('click', handleTabClick);
  elements.productForm.addEventListener('submit', handleProductSubmit);
  elements.cancelEditBtn.addEventListener('click', resetProductForm);
  elements.productsList.addEventListener('click', handleProductListClick);
  if (elements.statRange) {
    elements.statRange.addEventListener('change', handleStatRangeChange);
  }
  if (elements.calcStatsBtn) {
    elements.calcStatsBtn.addEventListener('click', handleStatsCalculation);
  }
  document.addEventListener('keydown', handleDebugToggle);
}

function handleTabClick(event) {
  const button = event.target.closest('button[data-panel]');
  if (!button) return;
  const panel = button.dataset.panel;
  elements.tabs.querySelectorAll('.tab-btn').forEach((btn) => btn.classList.remove('active'));
  button.classList.add('active');
  document.querySelectorAll('.tab-panel').forEach((panelEl) => panelEl.classList.remove('active'));
  const target = document.getElementById(`${panel}Panel`);
  if (target) {
    target.classList.add('active');
  }
}

function startAutoRefresh() {
  if (autoRefreshTimer) {
    clearInterval(autoRefreshTimer);
  }
  autoRefreshTimer = setInterval(fetchOrders, AUTO_REFRESH_INTERVAL);
}

async function fetchOrders() {
  try {
    const response = await fetch(`${API_BASE_URL}/orders?_sort=createdAt&_order=desc`);
    if (!response.ok) {
      throw new Error('Không thể tải đơn hàng');
    }
    const data = await response.json();
    state.orders = data;
    state.lastFetchAt = new Date();
    const latestNewIds = data.filter((order) => order.status === 'new').map((order) => String(order.id));
    const unseen = latestNewIds.filter((id) => !state.knownNewOrderIds.has(id));
    state.knownNewOrderIds = new Set(latestNewIds);
    applyFilter();
    updateStats();
    if (state.hasLoadedOnce && unseen.length) {
      triggerNewOrderFeedback(unseen);
    }
    state.hasLoadedOnce = true;
    updateTimestamp();
    updateDebugPanel();
  } catch (error) {
    console.error(error);
    elements.ordersList.innerHTML = '<div class="empty">Không thể tải đơn. Kiểm tra JSON Server.</div>';
    showMessage('warning', '⚠ Không kết nối được máy chủ. Vui lòng báo cho quản lý.');
  }
}

function triggerNewOrderFeedback(orderIds) {
  if (!orderIds.length) return;
  if (ENABLE_BEEP) {
    playBeep();
  }
  orderIds.forEach((id) => {
    state.highlightedOrderIds.add(id);
    setTimeout(() => {
      state.highlightedOrderIds.delete(id);
      renderOrdersList();
    }, HIGHLIGHT_DURATION);
  });
  renderOrdersList();
}

function playBeep() {
  if (!ENABLE_BEEP) return;
  try {
    if (!audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioCtx();
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, now);
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.4);
  } catch (error) {
    console.warn('Không thể phát âm thanh thông báo', error);
  }
}

function handleStatusFilterClick(event) {
  const button = event.target.closest('button[data-status]');
  if (!button) return;
  state.filterStatus = button.dataset.status;
  elements.statusFilters.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('active'));
  button.classList.add('active');
  applyFilter();
}

function handleDateFilterClick(event) {
  const button = event.target.closest('button[data-range]');
  if (!button) return;
  state.dateFilter = button.dataset.range;
  elements.dateFilters.querySelectorAll('.chip').forEach((chip) => chip.classList.remove('active'));
  button.classList.add('active');
  applyFilter();
}

function handleStatRangeChange() {
  updateStatInputVisibility();
  if (elements.statError) {
    elements.statError.textContent = '';
  }
}

function updateStatInputVisibility() {
  if (!elements.statRange) return;
  const range = elements.statRange.value;
  const controls = [
    { element: elements.statDate, visible: range === 'day' },
    { element: elements.statMonth, visible: range === 'month' },
    { element: elements.statYear, visible: range === 'year' },
  ];
  controls.forEach(({ element, visible }) => {
    if (!element) return;
    element.style.display = visible ? 'inline-block' : 'none';
    if (!visible) {
      element.value = '';
    }
  });
}

function applyFilter() {
  let working = [...state.orders];
  if (state.dateFilter === 'today') {
    working = working.filter((order) => isToday(order.createdAt));
  }

  if (state.filterStatus === 'all') {
    state.filteredOrders = working;
  } else {
    state.filteredOrders = working.filter((order) => order.status === state.filterStatus);
  }
  renderOrdersList();
  const selected = state.orders.find((order) => String(order.id) === state.selectedOrderId);
  if (selected) {
    renderOrderDetail(selected);
  } else {
    state.selectedOrderId = null;
    elements.orderDetail.innerHTML = '<div class="empty">Chọn một đơn để xem chi tiết</div>';
  }
  updateDebugPanel();
}

function validateStatRange(range, filters) {
  switch (range) {
    case 'day':
      return filters.date ? '' : 'Vui lòng chọn ngày cần thống kê.';
    case 'month':
      return filters.month ? '' : 'Vui lòng chọn tháng cần thống kê.';
    case 'year':
      if (!filters.year) {
        return 'Vui lòng nhập năm cần thống kê.';
      }
      return /^\d{4}$/.test(filters.year)
        ? ''
        : 'Năm không hợp lệ. Vui lòng nhập dạng YYYY (ví dụ: 2024).';
    default:
      return '';
  }
}

async function handleStatsCalculation(event) {
  if (event) event.preventDefault();
  if (!elements.calcStatsBtn) return;

  const range = elements.statRange ? elements.statRange.value : 'today';
  const filters = {
    date: elements.statDate ? elements.statDate.value : '',
    month: elements.statMonth ? elements.statMonth.value : '',
    year: elements.statYear ? elements.statYear.value.trim() : '',
  };

  const validationMessage = validateStatRange(range, filters);
  if (validationMessage) {
    if (elements.statError) {
      elements.statError.textContent = validationMessage;
    }
    return;
  }

  if (elements.statError) {
    elements.statError.textContent = '';
  }

  const originalLabel = elements.calcStatsBtn.textContent;
  elements.calcStatsBtn.disabled = true;
  elements.calcStatsBtn.textContent = 'Đang tính...';

  try {
    const orders = await fetchOrdersForStats();
    const filtered = filterOrdersByRange(orders, range, filters);
    renderStatsResult(filtered, range, filters);
  } catch (error) {
    console.error(error);
    if (elements.statError) {
      elements.statError.textContent = 'Không thể tải dữ liệu thống kê. Vui lòng thử lại.';
    }
    showMessage('warning', '⚠ Không kết nối được máy chủ. Vui lòng báo cho quản lý.');
  } finally {
    elements.calcStatsBtn.disabled = false;
    elements.calcStatsBtn.textContent = originalLabel;
  }
}

async function fetchOrdersForStats() {
  const response = await fetch(`${API_BASE_URL}/orders?_sort=createdAt&_order=desc`);
  if (!response.ok) {
    throw new Error('Failed to load orders for statistics');
  }
  return response.json();
}

function filterOrdersByRange(orders, range, filters) {
  if (range === 'all') {
    return orders;
  }
  if (range === 'today') {
    return orders.filter((order) => isToday(order.createdAt));
  }
  if (range === 'day') {
    const target = filters.date;
    if (!target) return [];
    return orders.filter((order) => toDateKey(order.createdAt) === target);
  }
  if (range === 'month') {
    const target = filters.month;
    if (!target) return [];
    return orders.filter((order) => (order.createdAt || '').slice(0, 7) === target);
  }
  if (range === 'year') {
    const target = filters.year;
    if (!target) return [];
    return orders.filter((order) => (order.createdAt || '').slice(0, 4) === target);
  }
  return orders;
}

function buildRangeSummary(range, filters) {
  switch (range) {
    case 'today':
      return 'Hôm nay';
    case 'day':
      return filters.date ? `Ngày ${filters.date}` : 'Ngày cụ thể';
    case 'month':
      return filters.month ? `Tháng ${filters.month}` : 'Theo tháng';
    case 'year':
      return filters.year ? `Năm ${filters.year}` : 'Theo năm';
    case 'all':
      return 'Tất cả lịch sử';
    default:
      return '--';
  }
}

function renderStatsResult(orders, range, filters) {
  if (!elements.statResult) return;

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, order) => {
    if (order.status === 'cancelled') return sum;
    return sum + Number(order.total || 0);
  }, 0);
  const avgOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

  const counts = { new: 0, making: 0, done: 0, cancelled: 0 };
  orders.forEach((order) => {
    if (counts.hasOwnProperty(order.status)) {
      counts[order.status] += 1;
    }
  });

  if (elements.statSummary) {
    elements.statSummary.textContent = `Phạm vi: ${buildRangeSummary(range, filters)}`;
  }
  if (elements.totalOrdersValue) {
    elements.totalOrdersValue.textContent = String(totalOrders);
  }
  if (elements.totalRevenueValue) {
    elements.totalRevenueValue.textContent = formatCurrency(totalRevenue);
  }
  if (elements.avgOrderValueValue) {
    elements.avgOrderValueValue.textContent = formatCurrency(avgOrderValue);
  }

  if (elements.statusBreakdown) {
    const statuses = ['new', 'making', 'done', 'cancelled'];
    const listHtml = statuses
      .map((status) => `<li>${statusLabel(status)}: <strong>${counts[status] || 0}</strong></li>`)
      .join('');
    elements.statusBreakdown.innerHTML = listHtml;
  }

  elements.statResult.classList.remove('is-hidden');

  if (elements.statError) {
    elements.statError.textContent = orders.length
      ? ''
      : 'Không có đơn nào trong phạm vi đã chọn.';
  }

  state.lastStatsContext = {
    range,
    filters: {
      date: filters.date || '',
      month: filters.month || '',
      year: filters.year || '',
    },
  };
}

function renderOrdersList() {
  if (!state.filteredOrders.length) {
    elements.ordersList.innerHTML = '<div class="empty">Không có đơn nào.</div>';
    return;
  }
  elements.ordersList.innerHTML = '';
  state.filteredOrders.forEach((order) => {
    const orderId = String(order.id);
    const isActive = orderId === state.selectedOrderId;
    const isHighlighted = state.highlightedOrderIds.has(orderId);
    const article = document.createElement('article');
    article.className = `order-card${isActive ? ' active' : ''}${isHighlighted ? ' highlight' : ''}`;
    article.innerHTML = `
      <div class="top-row">
        <span class="code">${order.code || 'Đơn #' + order.id}</span>
        <span class="status-badge ${order.status}">${statusLabel(order.status)}</span>
      </div>
      <div class="meta">
        <span>${order.orderType === 'table' ? '🪑 Bàn ' + (order.tableNumber || '?') : '🥤 Mang đi'}</span>
        <span>${formatDateTime(order.createdAt)}</span>
        <span>${formatCurrency(order.total)}</span>
      </div>
    `;
    article.addEventListener('click', () => {
      state.selectedOrderId = orderId;
      renderOrderDetail(order);
      renderOrdersList();
    });
    elements.ordersList.appendChild(article);
  });
}

function statusLabel(status) {
  const map = {
    new: 'Mới',
    making: 'Đang pha',
    done: 'Hoàn thành',
    cancelled: 'Đã hủy',
  };
  return map[status] || status;
}

function renderOrderDetail(order) {
  if (!order) {
    elements.orderDetail.innerHTML = '<div class="empty">Chọn một đơn để xem chi tiết</div>';
    return;
  }
  const itemsHtml = (order.items || [])
    .map((item) => {
      const options = [];
      if (item.options?.size) options.push(`Size ${item.options.size}`);
      if (item.options?.ice) options.push(`Đá ${item.options.ice}`);
      if (item.options?.sugar) options.push(`Đường ${item.options.sugar}`);
      const optionsText = options.length ? options.join(' · ') : 'Tuỳ chọn mặc định';
      const noteText = item.options?.note
        ? `<div class="note accent-note">Ghi chú món: ${item.options.note}</div>`
        : '';
      return `
        <div class="order-item">
          <div class="name">${item.qty} × ${item.name}</div>
          <div class="options">${optionsText}</div>
          ${noteText}
          <div class="price">${formatCurrency(item.lineTotal)}</div>
        </div>
      `;
    })
    .join('');

  const noteHtml = order.note
    ? `<div class="order-note accent-note">Ghi chú đơn: ${order.note}</div>`
    : '';

  const actionsHtml = renderOrderActions(order);

  elements.orderDetail.innerHTML = `
    <div>
      <h2>${order.code || 'Đơn #' + order.id}</h2>
      <p class="meta">${order.orderType === 'table' ? '🪑 Bàn ' + (order.tableNumber || '?') : '🥤 Mang đi'}</p>
      <p class="meta">${formatDateTime(order.createdAt)}</p>
      <p class="meta">Tổng: <strong>${formatCurrency(order.total)}</strong></p>
    </div>
    <div class="order-items">${itemsHtml}</div>
    ${noteHtml}
    ${actionsHtml}
  `;
}

function renderOrderActions(order) {
  const actions = [];
  if (order.status === 'new') {
    actions.push({ label: 'Đánh dấu đang pha', status: 'making', style: 'primary-btn' });
    actions.push({ label: 'Huỷ đơn', status: 'cancelled', style: 'danger-btn' });
  } else if (order.status === 'making') {
    actions.push({ label: 'Đánh dấu hoàn thành', status: 'done', style: 'primary-btn' });
    actions.push({ label: 'Huỷ đơn', status: 'cancelled', style: 'danger-btn' });
  } else if (order.status === 'done') {
    actions.push({ label: 'Huỷ đơn', status: 'cancelled', style: 'danger-btn' });
  } else if (order.status === 'cancelled') {
    return '<div class="empty">Đơn đã được huỷ</div>';
  }

  if (!actions.length) {
    return '<div class="empty">Không có hành động khả dụng</div>';
  }

  return `
    <div class="order-actions">
      ${actions
        .map((action) => {
          const disabledAttr = action.disabled ? 'disabled' : '';
          return `<button class="${action.style}" data-id="${order.id}" data-status="${action.status}" ${disabledAttr}>${action.label}</button>`;
        })
        .join('')}
    </div>
  `;
}

function handleOrderActionClick(event) {
  const button = event.target.closest('.order-actions button[data-status]');
  if (!button || button.disabled) return;
  const orderId = button.dataset.id;
  const status = button.dataset.status;
  if (!orderId || !status) return;
  if (status === 'cancelled') {
    const confirmed = window.confirm('Xác nhận huỷ đơn này?');
    if (!confirmed) return;
  }
  updateOrderStatus(orderId, status);
}

async function updateOrderStatus(orderId, status) {
  try {
    const response = await fetch(`${API_BASE_URL}/orders/${encodeURIComponent(orderId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (!response.ok) {
      throw new Error('Không thể cập nhật trạng thái');
    }
    const targetIndex = state.orders.findIndex((order) => String(order.id) === String(orderId));
    if (targetIndex !== -1) {
      state.orders[targetIndex] = { ...state.orders[targetIndex], status };
      state.selectedOrderId = String(state.orders[targetIndex].id);
    }
    state.highlightedOrderIds.delete(String(orderId));
    state.knownNewOrderIds.delete(String(orderId));
    applyFilter();
    updateStats();
    showMessage('success', '✅ Đã cập nhật trạng thái đơn.');
    updateDebugPanel();
  } catch (error) {
    console.error(error);
    showMessage('warning', '⚠ Không kết nối được máy chủ. Vui lòng báo cho quản lý.');
  }
}

function updateTimestamp() {
  if (!elements.lastUpdated) return;
  const now = new Date();
  elements.lastUpdated.textContent = now.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

async function fetchProducts() {
  try {
    const response = await fetch(`${API_BASE_URL}/products?_sort=name&_order=asc`);
    if (!response.ok) {
      throw new Error('Không thể tải menu');
    }
    state.products = await response.json();
    renderProductsList();
  } catch (error) {
    console.error(error);
    elements.productsList.innerHTML = '<div class="empty">Không tải được menu. Kiểm tra JSON Server.</div>';
    showMessage('warning', '⚠ Không kết nối được máy chủ. Vui lòng báo cho quản lý.');
  }
}

function handleProductSubmit(event) {
  event.preventDefault();
  const payload = {
    name: elements.productName.value.trim(),
    price: Number(elements.productPrice.value || 0),
    category: elements.productCategory.value.trim(),
    description: elements.productDescription.value.trim(),
    isActive: Boolean(elements.productIsActive.checked),
  };
  if (!payload.name || !payload.category) {
    showMessage('warning', '⚠ Vui lòng nhập đầy đủ tên món và loại.');
    return;
  }
  if (payload.price < 0) {
    showMessage('warning', '⚠ Giá món không hợp lệ.');
    return;
  }
  if (state.editingProductId) {
    updateProduct(state.editingProductId, payload);
  } else {
    createProduct(payload);
  }
}

async function createProduct(payload) {
  try {
    const response = await fetch(`${API_BASE_URL}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error('Không thể tạo sản phẩm');
    }
    const created = await response.json();
    state.products.push(created);
    renderProductsList();
    resetProductForm();
    showMessage('success', '✅ Đã thêm món mới.');
  } catch (error) {
    console.error(error);
    showMessage('warning', '⚠ Không kết nối được máy chủ. Vui lòng báo cho quản lý.');
  }
}

async function updateProduct(id, payload) {
  try {
    const response = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error('Không thể cập nhật sản phẩm');
    }
    const index = state.products.findIndex((product) => String(product.id) === String(id));
    if (index !== -1) {
      state.products[index] = { ...state.products[index], ...payload };
    }
    renderProductsList();
    resetProductForm();
    showMessage('success', '✅ Đã cập nhật sản phẩm.');
  } catch (error) {
    console.error(error);
    showMessage('warning', '⚠ Không kết nối được máy chủ. Vui lòng báo cho quản lý.');
  }
}

function handleProductListClick(event) {
  const editBtn = event.target.closest('button[data-action="edit"]');
  const deleteBtn = event.target.closest('button[data-action="delete"]');
  if (editBtn) {
    const productId = editBtn.dataset.id;
    const product = state.products.find((item) => String(item.id) === String(productId));
    if (product) {
      populateProductForm(product);
    }
  } else if (deleteBtn) {
    const productId = deleteBtn.dataset.id;
    if (!window.confirm('Xoá món này khỏi menu?')) return;
    deleteProduct(productId);
  }
}

function populateProductForm(product) {
  state.editingProductId = product.id;
  elements.productName.value = product.name || '';
  elements.productPrice.value = product.price || 0;
  elements.productCategory.value = product.category || '';
  elements.productDescription.value = product.description || '';
  elements.productIsActive.checked = Boolean(product.isActive);
  elements.productSubmitBtn.textContent = 'Cập nhật món';
  elements.cancelEditBtn.classList.remove('is-hidden');
  showMessage('info', 'Đang chỉnh sửa món. Nhấn "Hủy chỉnh sửa" để thoát.');
}

async function deleteProduct(id) {
  try {
    const response = await fetch(`${API_BASE_URL}/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Không thể xoá sản phẩm');
    }
    state.products = state.products.filter((product) => String(product.id) !== String(id));
    renderProductsList();
    if (state.editingProductId && String(state.editingProductId) === String(id)) {
      resetProductForm();
    }
    showMessage('success', '✅ Đã xoá món khỏi menu.');
  } catch (error) {
    console.error(error);
    showMessage('warning', '⚠ Không kết nối được máy chủ. Vui lòng báo cho quản lý.');
  }
}

function resetProductForm() {
  state.editingProductId = null;
  elements.productForm.reset();
  elements.productIsActive.checked = true;
  elements.productSubmitBtn.textContent = 'Thêm món';
  elements.cancelEditBtn.classList.add('is-hidden');
}

function renderProductsList() {
  if (!state.products.length) {
    elements.productsList.innerHTML = '<div class="empty">Chưa có món nào.</div>';
    return;
  }
  const sorted = [...state.products].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  elements.productsList.innerHTML = sorted
    .map((product) => {
      const statusClass = product.isActive ? 'active' : 'inactive';
      const statusLabel = product.isActive ? 'Đang bán' : 'Tạm ẩn';
      const description = product.description ? `<p class="desc">${product.description}</p>` : '';
      return `
        <div class="product-row" data-id="${product.id}">
          <div class="info">
            <h4>${product.name}</h4>
            <div class="meta">
              <span class="price">${formatCurrency(product.price)}</span>
              <span class="category">${product.category}</span>
              <span class="badge ${statusClass}">${statusLabel}</span>
            </div>
            ${description}
          </div>
          <div class="actions">
            <button class="ghost-btn" data-action="edit" data-id="${product.id}">Sửa</button>
            <button class="danger-btn" data-action="delete" data-id="${product.id}">Xoá</button>
          </div>
        </div>
      `;
    })
    .join('');
}

function updateStats() {
  if (!state.lastStatsContext) return;
  if (!elements.statResult || elements.statResult.classList.contains('is-hidden')) return;

  const { range, filters } = state.lastStatsContext;
  const clonedFilters = { ...filters };
  const scopedOrders = filterOrdersByRange(state.orders, range, clonedFilters);
  renderStatsResult(scopedOrders, range, clonedFilters);
}

function updateDebugPanel() {
  if (!elements.debugPanel || !elements.debugContent) return;
  const lastFetchAt = state.lastFetchAt;
  const lastFetchText = lastFetchAt
    ? lastFetchAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--';
  const counts = { new: 0, making: 0, done: 0, cancelled: 0 };
  state.orders.forEach((order) => {
    if (counts.hasOwnProperty(order.status)) {
      counts[order.status] += 1;
    }
  });
  const rows = [
    `<li>New: <strong>${counts.new}</strong></li>`,
    `<li>Making: <strong>${counts.making}</strong></li>`,
    `<li>Done: <strong>${counts.done}</strong></li>`,
    `<li>Cancelled: <strong>${counts.cancelled}</strong></li>`,
  ].join('');
  const stale =
    !lastFetchAt || Date.now() - lastFetchAt.getTime() > DEBUG_STALE_THRESHOLD_MS;
  const warning = stale
    ? '<p class="debug-warning">⚠ Có thể JSON Server đang tắt hoặc mất kết nối.</p>'
    : '';
  elements.debugContent.innerHTML = `
    <p>Lần fetch gần nhất: <strong>${lastFetchText}</strong></p>
    <ul>${rows}</ul>
    ${warning}
  `;
}

function handleDebugToggle(event) {
  if (!elements.debugPanel) return;
  if (elements.app && elements.app.classList.contains('is-hidden')) return;
  if ((event.ctrlKey || event.altKey) && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    state.debugVisible = !state.debugVisible;
    elements.debugPanel.classList.toggle('is-hidden', !state.debugVisible);
    updateDebugPanel();
  }
}

document.addEventListener('DOMContentLoaded', setupPinGate);
