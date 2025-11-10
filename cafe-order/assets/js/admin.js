const API_BASE_URL = 'http://localhost:4000';
const AUTO_REFRESH_INTERVAL = 8000;
let autoRefreshTimer = null;

const state = {
  orders: [],
  filteredOrders: [],
  selectedOrderId: null,
  filterStatus: 'all',
};

const elements = {
  ordersList: document.getElementById('ordersList'),
  orderDetail: document.getElementById('orderDetail'),
  statusFilters: document.getElementById('statusFilters'),
  refreshBtn: document.getElementById('refreshBtn'),
  lastUpdated: document.getElementById('lastUpdated'),
};

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

function formatDateTime(isoString) {
  const date = new Date(isoString);
  return `${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function init() {
  bindEvents();
  fetchOrders();
  startAutoRefresh();
  requestPin();
}

function bindEvents() {
  elements.statusFilters.addEventListener('click', handleStatusFilterClick);
  elements.refreshBtn.addEventListener('click', () => {
    fetchOrders();
  });
}

function requestPin() {
  const PIN = '4321';
  const entered = prompt('Nhập mã PIN nhân viên (gợi ý: 4321)');
  if (entered !== PIN) {
    alert('Sai mã PIN. Trang sẽ chỉ hiển thị dữ liệu khi nhập đúng.');
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
    state.orders = await response.json();
    applyFilter();
    updateTimestamp();
  } catch (error) {
    console.error(error);
    elements.ordersList.innerHTML = '<div class="empty">Không thể tải đơn. Kiểm tra server JSON.</div>';
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

function applyFilter() {
  if (state.filterStatus === 'all') {
    state.filteredOrders = [...state.orders];
  } else {
    state.filteredOrders = state.orders.filter((order) => order.status === state.filterStatus);
  }
  renderOrdersList();

  if (state.selectedOrderId) {
    const selected = state.orders.find((order) => String(order.id) === state.selectedOrderId);
    if (selected) {
      renderOrderDetail(selected);
    } else {
      state.selectedOrderId = null;
      elements.orderDetail.innerHTML = '<div class="empty">Chọn một đơn để xem chi tiết</div>';
    }
  }
}

function renderOrdersList() {
  if (!state.filteredOrders.length) {
    elements.ordersList.innerHTML = '<div class="empty">Không có đơn nào.</div>';
    return;
  }

  elements.ordersList.innerHTML = '';
  state.filteredOrders.forEach((order) => {
    const article = document.createElement('article');
    const orderId = String(order.id);
    article.className = `order-card${orderId === state.selectedOrderId ? ' active' : ''}`;
    article.innerHTML = `
      <div class="top-row">
        <span class="code">${order.code || 'Đơn #' + order.id}</span>
        <span class="status-badge ${order.status}">${statusLabel(order.status)}</span>
      </div>
      <div class="meta">
        <span>${order.orderType === 'table' ? '🪑 Bàn ' + (order.tableNumber || '?') : '🥤 Mang đi'}</span>
        <span>${formatDateTime(order.createdAt)}</span>
        <span>${formatCurrency(order.total || 0)}</span>
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
      const noteText = item.options?.note ? `<div class="note">Ghi chú: ${item.options.note}</div>` : '';
      return `
        <div class="order-item">
          <div class="name">${item.qty} × ${item.name}</div>
          <div class="options">${optionsText}</div>
          ${noteText}
          <div class="price">${formatCurrency(item.lineTotal || 0)}</div>
        </div>
      `;
    })
    .join('');

  const noteHtml = order.note ? `<div class="order-note">Ghi chú đơn: ${order.note}</div>` : '';
  const actionsHtml = renderActions(order);

  elements.orderDetail.innerHTML = `
    <div>
      <h2>${order.code || 'Đơn #' + order.id}</h2>
      <p class="meta">${order.orderType === 'table' ? '🪑 Bàn ' + (order.tableNumber || '?') : '🥤 Mang đi'}</p>
      <p class="meta">${formatDateTime(order.createdAt)}</p>
      <p class="meta">Tổng: <strong>${formatCurrency(order.total || 0)}</strong></p>
    </div>
    <div class="order-items">${itemsHtml}</div>
    ${noteHtml}
    ${actionsHtml}
  `;
}

function renderActions(order) {
  if (order.status === 'done') {
    return '<div class="empty">Đơn đã hoàn thành 🎉</div>';
  }

  let buttonLabel = '';
  let nextStatus = '';

  if (order.status === 'new') {
    buttonLabel = 'Đánh dấu đang pha';
    nextStatus = 'making';
  } else if (order.status === 'making') {
    buttonLabel = 'Đánh dấu hoàn thành';
    nextStatus = 'done';
  }

  if (!nextStatus) return '';

  return `
    <div class="order-actions">
      <button class="primary-btn" data-id="${order.id}" data-status="${nextStatus}">${buttonLabel}</button>
    </div>
  `;
}

function handleActionClick(event) {
  const button = event.target.closest('.order-actions .primary-btn');
  if (!button) return;

  const orderId = button.dataset.id;
  const status = button.dataset.status;
  if (!orderId) {
    alert('Không xác định được đơn hàng để cập nhật.');
    return;
  }
  updateOrderStatus(orderId, status);
}

elements.orderDetail.addEventListener('click', handleActionClick);

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
    await fetchOrders();
    const updatedOrder = state.orders.find((order) => String(order.id) === String(orderId));
    if (updatedOrder) {
      state.selectedOrderId = String(updatedOrder.id);
      renderOrderDetail(updatedOrder);
    }
  } catch (error) {
    console.error(error);
    alert('Không thể cập nhật trạng thái.');
  }
}

function updateTimestamp() {
  const now = new Date();
  elements.lastUpdated.textContent = now.toLocaleTimeString('vi-VN');
}

init();
