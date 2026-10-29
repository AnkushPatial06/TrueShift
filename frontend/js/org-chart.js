document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  const currentUser = TokenStore.getUser();
  if (currentUser) {
    if (typeof setAvatarElement === 'function') {
      setAvatarElement("topbar-avatar", currentUser);
    }
    if (window.NotificationCenter) NotificationCenter.init('notif-bell-btn');
  }
  if (window.Sidebar) Sidebar.init('org-chart');

  await renderOrgChart();

  document.getElementById("org-search")?.addEventListener("input", (e) => {
    renderOrgChart(e.target.value);
  });
});

async function renderOrgChart(searchQuery = "") {
  try {
    let departments = await apiRequest('/org/chart');
    const container = document.getElementById("org-chart-wrap");
    if (!container) return;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      departments = departments.map(dept => {
        const managers = dept.managers.filter(m => m.name.toLowerCase().includes(q) || (m.designation && m.designation.toLowerCase().includes(q)));
        const employees = dept.employees.filter(e => e.name.toLowerCase().includes(q) || (e.designation && e.designation.toLowerCase().includes(q)));
        if (managers.length > 0 || employees.length > 0) {
          return { ...dept, managers, employees };
        }
        return null;
      }).filter(Boolean);
    }
    
    if (departments.length === 0) {
      container.innerHTML = "<p style='color:var(--color-ink-soft);'>No departments or employees found.</p>";
      return;
    }

    container.innerHTML = departments.map(dept => `
      <div class="org-dept-col">
        <div class="org-dept-header">
          <div class="org-node-card dept-node" style="background:var(--color-primary); color:#fff; border-color:var(--color-primary);">
            <div class="org-node-title" style="color:#fff; font-weight:700;">${dept.name}</div>
            <div class="org-node-role" style="color:rgba(255,255,255,0.85);">${dept.total} members</div>
          </div>
        </div>
        <div class="org-line-v"></div>
        <div class="org-children">
          ${dept.managers.map(m => renderEmployeeNode(m, 'manager')).join('')}
          ${dept.employees.slice(0, 8).map(e => renderEmployeeNode(e, 'employee')).join('')}
          ${dept.employees.length > 8 ? `<div class="org-more-badge">+${dept.employees.length - 8} more</div>` : ''}
        </div>
      </div>
    `).join('');
  } catch(e) {
    document.getElementById("org-chart-wrap").innerHTML = `<p class="alert alert-error">Failed to load organization chart</p>`;
  }
}

function renderEmployeeNode(emp, role) {
  const isManager = role === 'manager';
  const faceChip = emp.face_registered ? 'success' : 'neutral';
  const faceText = emp.face_registered ? 'Face ID ✓' : 'No Face';
  const escEmp = JSON.stringify(emp).replace(/"/g, '&quot;');
  
  const avatarHtml = typeof renderAvatar === 'function'
    ? renderAvatar(emp, emp.name, '', 38)
    : `<div class="org-avatar">${initials(emp.name)}</div>`;

  return `
    <div class="org-node" onclick="openEmployeeCard(${escEmp})">
      <div class="org-node-card ${isManager ? 'org-manager' : ''}">
        <div style="display:flex; justify-content:center; margin-bottom:8px;">${avatarHtml}</div>
        <div class="org-node-title">${emp.name}</div>
        <div class="org-node-role">${emp.designation || roleLabel(emp.role)}</div>
        <span class="chip chip-${faceChip}" style="font-size:0.68rem; margin-top:6px;">${faceText}</span>
      </div>
    </div>
  `;
}

window.openEmployeeCard = function(emp) {
  if (window.Modal) {
    const modalAvatar = typeof renderAvatar === 'function'
      ? renderAvatar(emp, emp.name, '', 72)
      : `<div class="org-avatar" style="margin: 0 auto 16px; width:72px; height:72px; font-size:1.5rem;">${initials(emp.name)}</div>`;

    Modal.open({
      title: 'Employee Profile',
      content: `
        <div style="text-align:center; padding: 12px 20px;">
          <div style="display:flex; justify-content:center; margin-bottom:12px;">${modalAvatar}</div>
          <h3 style="margin:0 0 4px; color:var(--color-ink);">${emp.name}</h3>
          <p style="color:var(--color-ink-soft); font-size:0.88rem; margin-bottom:16px;">${emp.designation || roleLabel(emp.role)}</p>
          <div style="display:flex; justify-content:center; gap:8px;">
            <span class="chip chip-${emp.face_registered ? 'success' : 'neutral'}">${emp.face_registered ? 'Face ID Registered' : 'Face ID Not Registered'}</span>
            ${emp.work_location ? `<span class="chip chip-neutral">${emp.work_location}</span>` : ''}
          </div>
        </div>
      `,
      actions: `<button class="btn btn-secondary" onclick="Modal.close()">Close</button>`
    });
  }
};
