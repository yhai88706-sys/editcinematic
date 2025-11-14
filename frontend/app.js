/*
 * Frontend JavaScript responsible for interacting with the Flask backend.
 * Each API call updates UI components and any errors are surfaced through the
 * global message banner to help operators debug issues quickly.
 */

const API_BASE = '/api';

// Helper to show success/error messages globally
function showMessage(message, isError = true) {
    const messageEl = document.getElementById('global-message');
    messageEl.textContent = message;
    messageEl.style.display = 'block';
    messageEl.classList.remove('red-text', 'green-text');
    messageEl.classList.add(isError ? 'red-text' : 'green-text');
    setTimeout(() => (messageEl.style.display = 'none'), 5000);
}

// Universal fetch wrapper for error handling
async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        ...options,
    });
    if (!response.ok) {
        const errText = await response.text();
        showMessage(`Error ${response.status}: ${errText}`);
        throw new Error(errText);
    }
    return response.json();
}

// Authentication logic
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const payload = {
            username: document.getElementById('login-username').value,
            password: document.getElementById('login-password').value,
        };
        const data = await apiRequest('/login', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        showMessage(`Welcome ${data.username}! Token stored in session.`, false);
        sessionStorage.setItem('authToken', data.token);
    } catch (error) {
        console.error('Login failed', error);
    }
});

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const payload = {
            username: document.getElementById('register-username').value,
            password: document.getElementById('register-password').value,
        };
        await apiRequest('/login', {
            method: 'POST',
            body: JSON.stringify({ ...payload, register: true }),
        });
        showMessage('Registration successful. You can now login.', false);
    } catch (error) {
        console.error('Registration failed', error);
    }
});

// Fetch dashboard data: market and history
async function refreshMarketData() {
    try {
        const market = await apiRequest('/market-data');
        const list = document.getElementById('market-summary');
        list.innerHTML = '';
        market.summary.forEach((item) => {
            const li = document.createElement('li');
            li.className = 'collection-item';
            li.innerHTML = `<span>${item.symbol}</span><span>${item.price}</span>`;
            list.appendChild(li);
        });
        const table = document.getElementById('ticks-table');
        table.innerHTML = '';
        market.ticks.forEach((tick) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${tick.symbol}</td>
                <td>${tick.bid.toFixed(5)}</td>
                <td>${tick.ask.toFixed(5)}</td>
                <td>${new Date(tick.time).toLocaleTimeString()}</td>
            `;
            table.appendChild(tr);
        });
    } catch (error) {
        console.error('Market data error', error);
    }
}

async function refreshTrades() {
    try {
        const trades = await apiRequest('/trades');
        const table = document.getElementById('history-table');
        table.innerHTML = '';
        trades.forEach((trade) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${trade.time}</td>
                <td>${trade.symbol}</td>
                <td>${trade.side}</td>
                <td>${trade.volume}</td>
                <td>${trade.price.toFixed(5)}</td>
            `;
            table.appendChild(tr);
        });
    } catch (error) {
        console.error('Trade history error', error);
    }
}

// Strategy management
const strategyForm = document.getElementById('strategy-form');

strategyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const payload = {
            name: document.getElementById('strategy-name').value,
            parameters: document.getElementById('strategy-params').value,
        };
        await apiRequest('/strategies', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        showMessage('Strategy saved.', false);
        loadStrategies();
    } catch (error) {
        console.error('Strategy save error', error);
    }
});

async function loadStrategies() {
    try {
        const strategies = await apiRequest('/strategies');
        const list = document.getElementById('strategies-list');
        list.innerHTML = '';
        strategies.forEach((strategy) => {
            const li = document.createElement('li');
            li.className = 'collection-item';
            li.innerHTML = `
                <div>
                    <strong>${strategy.name}</strong>
                    <p>${strategy.parameters}</p>
                </div>
                <a class="secondary-content delete-strategy" data-id="${strategy.id}"><i class="material-icons red-text">delete</i></a>
            `;
            list.appendChild(li);
        });
        document.querySelectorAll('.delete-strategy').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                await apiRequest(`/strategies/${id}`, { method: 'DELETE' });
                loadStrategies();
            });
        });
    } catch (error) {
        console.error('Strategy load error', error);
    }
}

// Risk settings
const riskForm = document.getElementById('risk-form');

riskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const payload = {
            max_drawdown: parseFloat(document.getElementById('max-drawdown').value),
            max_position_size: parseFloat(document.getElementById('max-position').value),
        };
        await apiRequest('/risk-settings', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
        showMessage('Risk settings saved.', false);
        loadRiskSettings();
    } catch (error) {
        console.error('Risk save error', error);
    }
});

async function loadRiskSettings() {
    try {
        const risk = await apiRequest('/risk-settings');
        document.getElementById('max-drawdown').value = risk.max_drawdown;
        document.getElementById('max-position').value = risk.max_position_size;
        M.updateTextFields();
    } catch (error) {
        console.error('Risk load error', error);
    }
}

// Health check
const healthButton = document.getElementById('health-check-btn');
healthButton.addEventListener('click', async () => {
    try {
        const status = await apiRequest('/health');
        document.getElementById('health-status').textContent = status.status;
    } catch (error) {
        console.error('Health check failed', error);
    }
});

// Initialize dashboard data on load
refreshMarketData();
refreshTrades();
loadStrategies();
loadRiskSettings();
healthButton.click();

// Optional periodic refreshes to keep UI live
setInterval(refreshMarketData, 15000);
setInterval(refreshTrades, 30000);
