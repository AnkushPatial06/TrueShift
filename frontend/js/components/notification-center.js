const NotificationCenter = {
  count: 0,
  panel: null,

  init(bellBtnId) {
    const btn = document.getElementById(bellBtnId);
    if (!btn) return;
    btn.addEventListener('click', () => this.toggle());
    document.addEventListener('click', e => {
      if (this.panel && !btn.contains(e.target) && !this.panel.contains(e.target)) {
        this.panel.classList.add('hidden');
      }
    });
    this.loadNotifications();
    setInterval(() => this.loadNotifications(), 60000);
  },

  async loadNotifications() {
    try {
      const data = await apiRequest('/notifications');
      const unread = data.filter(n => !n.is_read);
      this.count = unread.length;
      const badge = document.getElementById('notif-badge');
      if (badge) { badge.textContent = this.count; badge.classList.toggle('hidden', this.count === 0); }
      if (this.panel) this.renderPanel(data);
    } catch(_) {}
  },

  toggle() {
    if (!this.panel) {
      this.panel = document.createElement('div');
      this.panel.className = 'notif-panel hidden';
      document.getElementById('notif-bell-wrapper')?.appendChild(this.panel);
    }
    this.panel.classList.toggle('hidden');
    if (!this.panel.classList.contains('hidden')) this.loadNotifications();
  },

  renderPanel(notifications) {
    if (!this.panel) return;
    const html = notifications.length === 0
      ? `<div style="padding:24px;text-align:center;color:var(--color-ink-soft);">All caught up!</div>`
      : notifications.slice(0, 20).map(n => `
          <div class="notif-item ${n.is_read ? '' : 'unread'}" onclick="NotificationCenter.markRead(${n.id}, this)">
            <div class="notif-item-title">${n.title}</div>
            <div class="notif-item-body">${n.body}</div>
            <div class="notif-item-time">${new Date(n.created_at).toLocaleString()}</div>
          </div>
        `).join('');
    this.panel.innerHTML = `
      <div class="notif-panel-header">
        <span>Notifications ${this.count > 0 ? `<span class="chip chip-neutral" style="font-size:0.72rem;padding:2px 8px;">${this.count} new</span>` : ''}</span>
        <button onclick="NotificationCenter.markAllRead()" style="font-size:0.8rem;color:var(--color-accent-blue);background:none;border:none;cursor:pointer;">Mark all read</button>
      </div>
      ${html}
    `;
  },

  async markRead(id, el) {
    await apiRequest(`/notifications/${id}/read`, { method: 'POST' });
    el.classList.remove('unread');
    this.count = Math.max(0, this.count - 1);
    const badge = document.getElementById('notif-badge');
    if (badge) { badge.textContent = this.count; badge.classList.toggle('hidden', this.count === 0); }
  },

  async markAllRead() {
    await apiRequest('/notifications/read-all', { method: 'POST' });
    this.count = 0;
    const badge = document.getElementById('notif-badge');
    if (badge) { badge.textContent = 0; badge.classList.add('hidden'); }
    this.panel?.querySelectorAll('.notif-item').forEach(el => el.classList.remove('unread'));
  }
};
window.NotificationCenter = NotificationCenter;
