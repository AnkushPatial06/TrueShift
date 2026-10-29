let charts = {};
let currentDays = 14;

function getChartTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  return {
    isDark,
    gridColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    textColor: isDark ? '#94A3B8' : '#64748B',
    tooltipBg: isDark ? '#1E293B' : '#0F172A',
    tooltipBorder: isDark ? '#334155' : '#E2E8F0',
    font: { family: 'Plus Jakarta Sans', size: 11 }
  };
}

document.addEventListener('DOMContentLoaded', async () => {
  requireRole(['admin', 'hr']);
  const user = TokenStore.getUser();
  if (user) {
    Sidebar.init('analytics');
    setAvatarElement('topbar-avatar', user);
    NotificationCenter.init('notif-bell-btn');
  }

  // Load KPIs
  try {
    const dash = await apiRequest("/analytics/my-dashboard");
    document.getElementById("stat-total").innerHTML = dash.total_employees;
    document.getElementById("stat-present").innerHTML = dash.present_today;
    document.getElementById("stat-absent").innerHTML = dash.absent_today;
    document.getElementById("stat-leave").innerHTML = dash.on_leave_today;
    document.getElementById("stat-late").innerHTML = dash.late_today;
    document.getElementById('stat-pct').textContent = dash.attendance_percentage == null ? '—' : `${dash.attendance_percentage}%`;
  } catch(e) {}

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentDays = e.target.dataset.days || 14;
      loadCharts(currentDays);
    });
  });

  window.addEventListener('themechanged', () => {
    loadCharts(currentDays);
    loadForecast();
  });

  await loadCharts(14);
  await loadForecast();
});

async function loadCharts(days) {
  try {
    const [daily, departments, leave, hours] = await Promise.all([
      apiRequest(`/analytics/daily-attendance?days=${days}`),
      apiRequest('/analytics/department-attendance'),
      apiRequest('/analytics/leave-distribution'),
      apiRequest(`/analytics/working-hours-distribution?days=${Math.min(Number(days), 180)}`)
    ]);
    const validDaily = Array.isArray(daily) ? daily : [];
    renderDailyChart(validDaily);
    renderDeptChart(Array.isArray(departments) ? departments : []);
    renderLeaveChart(Array.isArray(leave) ? leave : []);
    renderHoursChart(Array.isArray(hours) ? hours : []);
  } catch(e) {
    console.error('Error loading analytics', e);
    ['chart-daily', 'chart-dept', 'chart-leave', 'chart-hours'].forEach(id => {
      const canvas = document.getElementById(id);
      if (canvas) showChartState(canvas, `Unable to load chart data: ${e.message}`);
    });
    Toast.show(`Error loading analytics: ${e.message}`, 'error');
  }
}

function destroyChart(id) {
  if (charts[id]) {
    charts[id].destroy();
  }
}

function renderDailyChart(data) {
  destroyChart('daily');
  const canvas = document.getElementById('chart-daily');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const t = getChartTheme();
  if (!Array.isArray(data) || !data.length) return showChartState(canvas, 'No attendance records are available for this period.');
  clearChartState(canvas);
  
  const labels = data.map(d => formatDate(d.date).split(',')[0]);
  
  charts['daily'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Present', data: data.map(d => d.present), borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,0.1)', tension: 0.3, fill: true },
        { label: 'Late', data: data.map(d => d.late), borderColor: '#8B5CF6', backgroundColor: 'rgba(139,92,246,0.1)', tension: 0.3, fill: false },
        { label: 'On Leave', data: data.map(d => d.on_leave), borderColor: '#F59E0B', backgroundColor: 'rgba(245,158,11,0.1)', tension: 0.3, fill: false }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { 
        legend: { labels: { color: t.textColor, font: t.font } },
        tooltip: { 
          mode: 'index', 
          intersect: false,
          backgroundColor: t.tooltipBg,
          borderColor: t.tooltipBorder,
          borderWidth: 1
        }
      },
      scales: {
        x: { grid: { color: t.gridColor }, ticks: { color: t.textColor, font: t.font } },
        y: { beginAtZero: true, grid: { color: t.gridColor }, ticks: { color: t.textColor, font: t.font } }
      }
    }
  });
}

function renderDeptChart(data) {
  destroyChart('dept');
  const canvas = document.getElementById('chart-dept');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const t = getChartTheme();
  if (!Array.isArray(data) || !data.length) return showChartState(canvas, 'No department attendance records are available.');
  clearChartState(canvas);
  
  const labels = data.map(d => d.department_name || 'Unassigned');
  
  charts['dept'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Attendance %', data: data.map(d => Number(d.attendance_percentage) || 0), backgroundColor: '#10B981', borderRadius: 4 }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: t.tooltipBg, borderColor: t.tooltipBorder, borderWidth: 1 }
      },
      scales: {
        x: { max: 100, grid: { color: t.gridColor }, ticks: { color: t.textColor, font: t.font } },
        y: { grid: { display: false }, ticks: { color: t.textColor, font: t.font } }
      }
    }
  });
}

function renderLeaveChart(data) {
  destroyChart('leave');
  const canvas = document.getElementById('chart-leave');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const t = getChartTheme();
  if (!Array.isArray(data) || !data.length || !data.some(d => Number(d.count) > 0)) return showChartState(canvas, 'No approved leave records are available.');
  clearChartState(canvas);
  
  const labels = data.map(d => d.leave_type);
  const values = data.map(d => Number(d.count) || 0);
  
  charts['leave'] = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ['#3B82F6', '#EF4444', '#10B981', '#F59E0B'],
        borderColor: t.isDark ? '#1E293B' : '#FFFFFF',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: t.textColor, font: t.font } },
        tooltip: { backgroundColor: t.tooltipBg, borderColor: t.tooltipBorder, borderWidth: 1 }
      }
    }
  });
}

function renderHoursChart(data) {
  destroyChart('hours');
  const canvas = document.getElementById('chart-hours');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const t = getChartTheme();
  if (!Array.isArray(data) || !data.length) return showChartState(canvas, 'No working hours records are available for this period.');
  clearChartState(canvas);
  
  const labels = data.map(d => d.bucket);
  const avgHours = data.map(d => Number(d.count) || 0);
  
  charts['hours'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Attendance records',
        data: avgHours,
        backgroundColor: t.isDark ? 'rgba(59, 130, 246, 0.4)' : 'rgba(59, 130, 246, 0.6)',
        borderColor: '#3B82F6',
        borderWidth: 1,
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: t.tooltipBg, borderColor: t.tooltipBorder, borderWidth: 1 }
      },
      scales: {
        y: { min: 0, max: 12, grid: { color: t.gridColor }, ticks: { color: t.textColor, font: t.font } },
        x: { grid: { display: false }, ticks: { color: t.textColor, font: t.font } }
      }
    }
  });
}

function showChartState(canvas, message) {
  if (!canvas) return;
  canvas.hidden = true;
  let state = canvas.parentElement.querySelector('.chart-state');
  if (!state) { state = document.createElement('div'); state.className = 'chart-state'; canvas.parentElement.appendChild(state); }
  state.textContent = message; state.hidden = false;
}

function clearChartState(canvas) {
  if (!canvas) return;
  canvas.hidden = false;
  const state = canvas.parentElement.querySelector('.chart-state');
  if (state) state.hidden = true;
}

async function loadForecast() {
  try {
    const data = await apiRequest('/ml/headcount/forecast?days=7');
    
    destroyChart('forecast');
    const canvas = document.getElementById('chart-forecast');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const t = getChartTheme();
    
    const labels = data.map(d => formatDate(d.date).split(',')[0]);
    
    charts['forecast'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Forecasted Attendance',
          data: data.map(d => d.predicted_attendance),
          borderColor: '#8B5CF6',
          borderDash: [5, 5],
          tension: 0.3,
          fill: false,
          pointBackgroundColor: '#8B5CF6'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: t.textColor, font: t.font } },
          tooltip: { backgroundColor: t.tooltipBg, borderColor: t.tooltipBorder, borderWidth: 1 }
        },
        scales: {
          x: { grid: { color: t.gridColor }, ticks: { color: t.textColor, font: t.font } },
          y: { grid: { color: t.gridColor }, ticks: { color: t.textColor, font: t.font } }
        }
      }
    });
  } catch(e) {
    console.error('Failed to load forecast', e);
  }
}
