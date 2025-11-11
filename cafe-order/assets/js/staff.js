const API_BASE_URL = 'http://localhost:4000';
const AUTO_REFRESH_INTERVAL = 8000;
const MESSAGE_TIMEOUT = 4500;
const HIGHLIGHT_DURATION = 3000;
let autoRefreshTimer = null;
let audioContext = null;

const state = {
  orders: [],
  filteredOrders: [],
  selectedOrderId: null,
  filterStatus: 'all',
  knownNewOrderIds: new Set(),
  highlightedOrderIds: new Set(),
  hasLoadedOnce: false,
};

const elements = {
  ordersList: document.getElementById('staffOrdersList'),
  orderDetail: document.getElementById('staffOrderDetail'),
  statusFilters: document.getElementById('staffStatusFilters'),
  refreshBtn: document.getElementById('staffRefreshBtn'),
  lastUpdated: document.getElementById('staffLastUpdated'),
  toastStack: document.getElementById('toastStack'),
};

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
}

function formatTime(isoString) {
  if (!isoString) return '--';
  const date = new Date(isoString);
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
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

function init() {
  bindEvents();
  fetchOrders();
  startAutoRefresh();
}

function bindEvents() {
  elements.statusFilters.addEventListener('click', handleStatusFilterClick);
  elements.refreshBtn.addEventListener('click', () => fetchOrders());
  elements.orderDetail.addEventListener('click', handleActionClick);
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
      throw new Error('Không thể tải đơn');
    }
    const data = await response.json();
    const todayStr = new Date().toISOString().slice(0, 10);
    const todaysOrders = data.filter((order) => (order.createdAt || '').slice(0, 10) === todayStr);
    state.orders = todaysOrders;

    const latestNewIds = todaysOrders.filter((order) => order.status === 'new').map((order) => String(order.id));
    const unseen = latestNewIds.filter((id) => !state.knownNewOrderIds.has(id));
    state.knownNewOrderIds = new Set(latestNewIds);

    applyFilter();

    if (state.hasLoadedOnce && unseen.length) {
      triggerNewOrderFeedback(unseen);
    }
    state.hasLoadedOnce = true;
    updateTimestamp();
  } catch (error) {
    console.error(error);
    elements.ordersList.innerHTML = '<div class="empty">Không thể tải đơn. Kiểm tra kết nối JSON Server.</div>';
    showMessage('warning', '⚠ Không kết nối được máy chủ. Vui lòng báo cho quản lý.');
  }
}

function triggerNewOrderFeedback(orderIds) {
  if (!orderIds.length) return;
  playBeep();
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
  } catch (err) {
    console.warn('Không thể phát âm thanh thông báo', err);
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
  const displayable = state.orders.filter((order) => ['new', 'making', 'done'].includes(order.status));
  if (state.filterStatus === 'all') {
    state.filteredOrders = [...displayable];
  } else {
    state.filteredOrders = displayable.filter((order) => order.status === state.filterStatus);
  }
  renderOrdersList();
  const selected = state.orders.find((order) => String(order.id) === state.selectedOrderId);
  if (selected) {
    renderOrderDetail(selected);
  } else {
    state.selectedOrderId = null;
    elements.orderDetail.innerHTML = '<div class="empty">Chọn một đơn để xem chi tiết</div>';
  }
}

function renderOrdersList() {
  if (!state.filteredOrders.length) {
    elements.ordersList.innerHTML = '<div class="empty">Không có đơn nào trong hôm nay.</div>';
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
        <span>${formatTime(order.createdAt)}</span>
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

  const actionsHtml = renderActions(order);

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

function renderActions(order) {
  if (order.status === 'done') {
    return '<div class="empty">Đơn đã hoàn thành 🎉</div>';
  }
  if (order.status !== 'new' && order.status !== 'making') {
    return '';
  }

  const actions = [];
  if (order.status === 'new') {
    actions.push({ label: 'Đánh dấu đang pha', status: 'making' });
  }
  if (order.status === 'making') {
    actions.push({ label: 'Đánh dấu hoàn thành', status: 'done' });
  }
  if (!actions.length) return '';

  return `
    <div class="order-actions">
      ${actions
        .map(
          (action) => `<button class="primary-btn" data-id="${order.id}" data-status="${action.status}">${action.label}</button>`
        )
        .join('')}
    </div>
  `;
}

function handleActionClick(event) {
  const button = event.target.closest('.order-actions .primary-btn');
  if (!button) return;
  const orderId = button.dataset.id;
  const status = button.dataset.status;
  if (!orderId || !status) return;
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
    applyFilter();
    showMessage('success', '✅ Đã cập nhật trạng thái đơn.');
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

document.addEventListener('DOMContentLoaded', init);
