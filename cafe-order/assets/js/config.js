(function () {
  const CONFIG = {
    API_BASE_URL: 'http://localhost:4000',
    REFRESH_INTERVAL_MS: 8000,
    MANAGER_PIN: '2580',
    STAFF_PIN: null,
    ENABLE_BEEP: true,
    DEBUG_STALE_THRESHOLD_MS: 30000,
  };

  if (!window.CONFIG) {
    window.CONFIG = CONFIG;
  } else {
    window.CONFIG = Object.assign({}, CONFIG, window.CONFIG);
  }
})();
