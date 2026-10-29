// Shared sidebar component
const Sidebar = {
  navItems: [
    { key: 'dashboard', label: 'Dashboard', href: 'dashboard.html', roles: ['admin','hr','manager'], icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/></svg>' },
    { key: 'portal', label: 'My Portal', href: 'portal.html', roles: ['employee'], icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/></svg>' },
    { key: 'attendance', label: 'Attendance', href: 'attendance.html', roles: ['admin','hr','manager','employee'], icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v5l3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' },
    { key: 'leave', label: 'Leave', href: 'leave.html', roles: ['admin','hr','manager','employee'], icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' },
    { key: 'employees', label: 'Personnel', href: 'employees.html', roles: ['admin','hr','manager'], icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="18" cy="9" r="2.4" stroke="currentColor" stroke-width="1.6"/><path d="M15.5 20c.3-2.4 2-4.3 4.3-4.9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' },
    { key: 'shifts', label: 'Shifts', href: 'shifts.html', roles: ['admin','hr','manager'], icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.6"/><path d="M12 8v4l2.5 2.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' },
    { key: 'locations', label: 'Work Locations', href: 'locations.html', roles: ['admin','hr'], icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="9" r="2.5" stroke="currentColor" stroke-width="1.6"/></svg>' },
    { key: 'face-registration', label: 'Face ID', href: 'face-registration.html', roles: ['admin','hr','manager','employee'], icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3.2" stroke="currentColor" stroke-width="1.6"/></svg>' },
    { key: 'analytics', label: 'Analytics', href: 'analytics.html', roles: ['admin','hr'], icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 20V10M12 20V4M20 20V14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' },
    { key: 'insights', label: 'AI Insights', href: 'insights.html', roles: ['admin','hr'], icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 2a5 5 0 015 5c0 2-1 3-2 4.5S14 14 14 16h-4c0-2-.5-3-1.5-4.5S7 9 7 7a5 5 0 015-5z" stroke="currentColor" stroke-width="1.5"/><path d="M9.5 19h5M10 22h4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' },
    { key: 'reports', label: 'Reports', href: 'reports.html', roles: ['admin','hr'], icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M6 3h9l5 5v13a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.6"/><path d="M9 12h6M9 16h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' },
    { key: 'org-chart', label: 'Org Chart', href: 'org-chart.html', roles: ['admin','hr'], icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="9" y="2" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.6"/><rect x="2" y="17" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.6"/><rect x="9" y="17" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.6"/><rect x="16" y="17" width="6" height="4" rx="1" stroke="currentColor" stroke-width="1.6"/><path d="M12 6v3M5 11h14M5 11v6M19 11v6M12 11v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' },
    { key: 'announcements', label: 'Announcements', href: 'announcements.html', roles: ['admin','hr','manager','employee'], icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 8a6 6 0 01-6 6m0 0a6 6 0 01-6-6m6 6v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="18" cy="4" r="2" stroke="currentColor" stroke-width="1.6"/></svg>' },
    { key: 'chat', label: 'HR Policy & Chat', href: 'chat.html', roles: ['admin','hr','manager','employee'], icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>' },
  ],

  init(activeKey) {
    const user = TokenStore.getUser();
    const sidebarEl = document.getElementById('app-sidebar');
    if (!sidebarEl || !user) return;

    const visibleItems = this.navItems.filter(item => item.roles.includes(user.role));
    const avatarHtml = typeof renderAvatar === 'function' 
      ? renderAvatar(user, user.name, 'sidebar-avatar', 40)
      : `<div class="sidebar-avatar" id="sidebar-avatar">${initials(user.name)}</div>`;

    const logoHtml = `
      <div class="sidebar-brand">
        <div class="sidebar-brand-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 20V10M12 20V4M20 20V14" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>
        </div>
        <span>TrueShift</span>
      </div>
    `;

    const profileHtml = `
      <div class="sidebar-profile">
        ${avatarHtml}
        <div class="sidebar-profile-info">
          <div class="sidebar-name" id="sidebar-name">${user.name}</div>
          <div class="sidebar-role">${roleLabel(user.role)}</div>
        </div>
      </div>
    `;

    const navHtml = visibleItems.map(item => `
      <a class="sidebar-link ${activeKey === item.key ? 'active' : ''}" href="${item.href}">
        ${item.icon}
        <span>${item.label}</span>
      </a>
    `).join('');

    const footerHtml = `
      <div class="sidebar-footer">
        <div class="sidebar-theme-row" style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; margin-bottom:8px; border-radius:var(--radius-sm); background:rgba(255,255,255,0.03);">
          <span style="font-size:0.78rem; color:var(--sidebar-text-muted, #94A3B8); font-weight:500;">Appearance</span>
          <div class="theme-toggle-slot" data-theme-switcher></div>
        </div>
        <a class="sidebar-link" href="profile.html">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.6"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          <span>Profile & Settings</span>
        </a>
        <button id="sidebar-logout" class="sidebar-link sidebar-logout">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>Sign out</span>
        </button>
      </div>
    `;

    sidebarEl.innerHTML = logoHtml + profileHtml + `<nav class="sidebar-nav">${navHtml}</nav>` + footerHtml;

    // Trigger theme toggle mount if ThemeManager is loaded
    if (window.ThemeManager) {
      window.ThemeManager.init();
    }

    document.getElementById('sidebar-logout')?.addEventListener('click', async () => {
      try { 
        await apiRequest('/auth/logout', { method: 'POST', body: { refresh_token: TokenStore.getRefresh() } }); 
      } catch(_) {}
      TokenStore.clear();
      window.location.href = 'login.html';
    });
  }
};
window.Sidebar = Sidebar;
