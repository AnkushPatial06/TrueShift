// Toast notification system
const Toast = (() => {
  let container = null;

  function getContainer() {
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    return container;
  }

  const icons = {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#1F7A4D" stroke-width="1.6"/><path d="M7 12l3.5 3.5L17 9" stroke="#1F7A4D" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#C0473B" stroke-width="1.6"/><path d="M15 9l-6 6M9 9l6 6" stroke="#C0473B" stroke-width="1.6" stroke-linecap="round"/></svg>',
    warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 20h20L12 2z" stroke="#D97706" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 9v5M12 17v1" stroke="#D97706" stroke-width="1.6" stroke-linecap="round"/></svg>',
    info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#2563EB" stroke-width="1.6"/><path d="M12 8v1M12 11v5" stroke="#2563EB" stroke-width="1.6" stroke-linecap="round"/></svg>',
  };

  function show(message, type = 'info', duration = 4000) {
    const c = getContainer();
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-body">${message}</div>
      <button class="toast-close" onclick="this.closest('.toast').remove()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>
    `;
    c.appendChild(el);
    if (duration > 0) setTimeout(() => el.remove(), duration);
    return el;
  }

  return { show, success: (m,d) => show(m,'success',d), error: (m,d) => show(m,'error',d), warning: (m,d) => show(m,'warning',d), info: (m,d) => show(m,'info',d) };
})();
