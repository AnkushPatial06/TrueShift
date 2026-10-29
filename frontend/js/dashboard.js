document.addEventListener('DOMContentLoaded', async () => {
  requireRole(['admin', 'hr', 'manager']);
  const user = TokenStore.getUser();
  if (user) {
    Sidebar.init('dashboard');
    if (typeof setAvatarElement === 'function') {
      setAvatarElement('topbar-avatar', user);
    }
    if (window.NotificationCenter) NotificationCenter.init('notif-bell-btn');
    
    if (user.role === 'employee') {
      document.getElementById('employee-section')?.classList.remove('hidden');
      window.location.href = 'portal.html';
      return;
    }
  }

  try {
    const me = await apiRequest("/auth/me");
    TokenStore.setUser(me);
    if (typeof setAvatarElement === 'function') {
      setAvatarElement('topbar-avatar', me);
    }
    await loadRoleContent(me);
  } catch (err) {
    console.error(err);
    Toast.show('Failed to load user info', 'error');
  }

  window.addEventListener('themechanged', () => {
    loadAttendanceTrend();
    loadLeaveDistribution();
  });
});

async function loadRoleContent(user) {
  if (window.Skeleton && ['admin', 'hr'].includes(user.role)) Skeleton.kpiCards('admin-kpis');
  try {
    const dash = await apiRequest("/analytics/my-dashboard");
    renderDashboard(user, dash || {});
  } catch (err) {
    console.error("Could not load dashboard:", err.message);
    ['stat-total', 'stat-present', 'stat-absent', 'stat-leave', 'stat-late', 'stat-pct'].forEach(id => {
      const cell = document.getElementById(id);
      if (cell) cell.textContent = 'Unavailable';
    });
    Toast.show(`Could not load dashboard data: ${err.message}`, "error");
  }
  if (['admin', 'hr'].includes(user.role)) {
    loadRecentActivity();
    await Promise.all([loadAttendanceTrend(), loadDepartmentAttendance(), loadLeaveDistribution()]);
  }
}

function renderDashboard(user, dash) {
  const isPrivileged = ["admin", "hr"].includes(user.role);
  const isManager = user.role === "manager";

  document.getElementById("admin-section")?.classList.toggle("hidden", !isPrivileged);
  document.getElementById("manager-section")?.classList.toggle("hidden", !isManager);
  window.setHeroName?.(user.name || user.full_name || user.email?.split('@')[0] || 'there');

  if (isPrivileged) {
    document.getElementById("stat-total").innerHTML = dash.total_employees ?? '—';
    document.getElementById("stat-present").innerHTML = dash.present_today ?? '—';
    document.getElementById("stat-absent").innerHTML = dash.absent_today ?? '—';
    document.getElementById("stat-leave").innerHTML = dash.on_leave_today ?? '—';
    document.getElementById("stat-late").innerHTML = dash.late_today ?? '—';
    document.getElementById("stat-pct").innerHTML = (dash.attendance_percentage ?? '0') + "%";
    
    ['trend-present', 'trend-absent', 'trend-pct', 'trend-total', 'trend-leave', 'trend-late'].forEach(id => document.getElementById(id)?.replaceChildren());
    
  } else if (isManager) {
    document.getElementById("mgr-department").textContent = dash.department_name || "Unassigned";
    document.getElementById("mgr-pct").textContent = (dash.attendance_percentage ?? '0') + "%";
    document.getElementById("mgr-present").textContent = dash.present_today ?? '0';
    document.getElementById("mgr-absent").textContent = dash.absent_today ?? '0';
    document.getElementById("mgr-pending").textContent = dash.pending_leave_requests ?? '0';
  }
}

async function loadRecentActivity() {
  const container = document.getElementById('recent-activity');
  if (!container) return;
  try {
    const leaves = await apiRequest('/leaves/team?pending_only=false');
    if (!leaves || leaves.length === 0) {
      container.innerHTML = '<li class="activity-item"><span style="color:var(--color-ink-soft);">No recent team activity</span></li>';
      return;
    }
    
    const recent = leaves.slice(0, 5);
    container.innerHTML = recent.map(l => {
      const avatarMarkup = typeof renderAvatar === 'function'
        ? renderAvatar(l, l.employee_name || 'Emp', '', 34)
        : `<div class="avatar-container" style="width:34px;height:34px;border-radius:50%;background:var(--color-primary-soft);color:var(--color-primary);display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;">${initials(l.employee_name)}</div>`;

      return `
        <li class="activity-item">
          <div class="activity-left">
            ${avatarMarkup}
            <div>
              <div class="activity-title">${l.employee_name || 'Employee'}</div>
              <div class="activity-sub">${l.leave_type} Leave · ${formatDate(l.start_date)} – ${formatDate(l.end_date)}</div>
            </div>
          </div>
          <div>${chipHtml(l.status)}</div>
        </li>
      `;
    }).join('');
  } catch(e) {
    container.innerHTML = '<li class="activity-item"><span style="color:var(--color-danger);">Error loading activity</span></li>';
  }
}

let attendanceTrendChart = null;
let leaveDistributionChart = null;

function setChartState(canvas, state, message = '') {
  const host = canvas?.parentElement;
  if (!host) return;
  let note = host.querySelector('.chart-state');
  if (!note) { note = document.createElement('div'); note.className = 'chart-state'; note.setAttribute('role', 'status'); host.appendChild(note); }
  canvas.hidden = state !== 'chart'; note.hidden = state === 'chart';
  note.className = `chart-state chart-state-${state}`; note.textContent = message;
}

async function loadAttendanceTrend() {
  const chartCanvas = document.getElementById('attendance-trend-chart');
  if (!chartCanvas) return;

  try {
    if (typeof Chart === 'undefined') throw new Error('Chart library could not be loaded.');
    const stats = await apiRequest('/analytics/daily-attendance?days=14');
    if (!Array.isArray(stats) || stats.length === 0) {
      setChartState(chartCanvas, 'empty', 'No attendance records are available for this period.');
      attendanceTrendChart?.destroy(); attendanceTrendChart = null; return;
    }
    
    const labels = stats.map(d => formatDate(d.date).split(',')[0]);
    const data = stats.map(d => Number(d.present) || 0);
    
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const primaryColor = isDark ? '#3B82F6' : '#1D4ED8';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
    const textColor = isDark ? '#94A3B8' : '#64748B';

    if (attendanceTrendChart) {
      attendanceTrendChart.destroy();
    }

    const ctx = chartCanvas.getContext('2d');
    setChartState(chartCanvas, 'chart');
    attendanceTrendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Present Employees',
          data,
          borderColor: primaryColor,
          backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(29, 78, 216, 0.08)',
          borderWidth: 2,
          pointBackgroundColor: primaryColor,
          pointBorderColor: '#FFFFFF',
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.35,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? '#1E293B' : '#0F172A',
            titleColor: '#FFFFFF',
            bodyColor: '#E2E8F0',
            borderColor: isDark ? '#334155' : '#E2E8F0',
            borderWidth: 1,
            padding: 10,
            displayColors: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
          },
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
          }
        }
      }
    });
  } catch (e) {
    console.error('Error loading trend', e);
    setChartState(chartCanvas, 'error', `Unable to load attendance trend: ${e.message}`);
  }
}

async function loadDepartmentAttendance() {
  const container = document.getElementById('dept-bar-list');
  if (!container) return;
  try {
    const rows = await apiRequest('/analytics/department-attendance');
    if (!Array.isArray(rows) || !rows.length) { container.innerHTML = '<p class="chart-state chart-state-empty">No department attendance records are available.</p>'; return; }
    window.renderDeptBars?.(rows.map(d => ({ name: d.department_name || 'Unassigned', pct: Number(d.attendance_percentage) || 0 })));
  } catch (e) {
    console.error('Error loading department attendance', e);
    container.textContent = `Unable to load department attendance: ${e.message}`;
    container.className = 'dept-bar-list chart-state chart-state-error';
  }
}

async function loadLeaveDistribution() {
  const canvas = document.getElementById('leave-dist-chart');
  if (!canvas) return;
  try {
    if (typeof Chart === 'undefined') throw new Error('Chart library could not be loaded.');
    const rows = await apiRequest('/analytics/leave-distribution');
    if (!Array.isArray(rows) || !rows.some(d => Number(d.count) > 0)) {
      setChartState(canvas, 'empty', 'No approved leave records are available.');
      leaveDistributionChart?.destroy(); leaveDistributionChart = null; return;
    }
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    setChartState(canvas, 'chart'); leaveDistributionChart?.destroy();
    leaveDistributionChart = new Chart(canvas.getContext('2d'), {
      type: 'doughnut',
      data: { labels: rows.map(d => d.leave_type), datasets: [{ data: rows.map(d => Number(d.count) || 0), backgroundColor: ['#2563EB','#16A34A','#D97706','#7C3AED','#0891B2','#DC2626'], borderColor: dark ? '#1E293B' : '#FFFFFF', borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { display: true, position: 'right', labels: { color: dark ? '#CBD5E1' : '#475569', usePointStyle: true, padding: 12 } } } }
    });
  } catch (e) {
    console.error('Error loading leave distribution', e);
    setChartState(canvas, 'error', `Unable to load leave distribution: ${e.message}`);
  }
}
