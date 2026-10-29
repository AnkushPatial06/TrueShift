document.addEventListener('DOMContentLoaded', async () => {
  requireRole(['admin', 'hr', 'manager', 'employee']);
  const user = TokenStore.getUser();
  if (user) {
    Sidebar.init('leave');
    setAvatarElement('topbar-avatar', user);
    NotificationCenter.init('notif-bell-btn');
  }

  await loadBalances();
  await loadMyLeaves();

  if (['admin', 'hr', 'manager'].includes(user.role)) {
    document.getElementById('team-leaves-section').classList.remove('hidden');
    await loadTeamLeaves();
  }

  const startInput = document.getElementById('leave-start');
  const endInput = document.getElementById('leave-end');
  const calcDays = () => {
    const s = startInput.value, e = endInput.value;
    if (s && e) {
      const start = new Date(s), end = new Date(e);
      if (end >= start) {
        const diffDays = Math.ceil(Math.abs(end - start) / (1000*60*60*24)) + 1;
        document.getElementById('leave-days-calc').textContent = `${diffDays} day(s) selected`;
      } else {
        document.getElementById('leave-days-calc').textContent = 'End date must be after start date';
      }
    }
  };
  startInput.addEventListener('change', calcDays);
  endInput.addEventListener('change', calcDays);

  document.getElementById('apply-leave-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-leave');
    btn.disabled = true; btn.textContent = 'Submitting...';
    try {
      await apiRequest('/leaves', {
        method: 'POST',
        body: {
          leave_type: document.getElementById('leave-type').value,
          start_date: document.getElementById('leave-start').value,
          end_date: document.getElementById('leave-end').value,
          reason: document.getElementById('leave-reason').value
        }
      });
      Toast.show('Leave request submitted successfully', 'success');
      Modal.close('apply-leave-modal');
      e.target.reset();
      document.getElementById('leave-days-calc').textContent = '0 days selected';
      await loadBalances();
      await loadMyLeaves();
    } catch(err) {
      Toast.show(err.message || 'Failed to submit leave', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Submit Application';
    }
  });
});

async function loadBalances() {
  const container = document.getElementById('leave-balances');
  container.innerHTML = '<div class="skeleton kpi-card" style="height:100px;"></div>'.repeat(3);
  try {
    const data = await apiRequest('/leaves/balance');
    // data = { employee_id, balances: { casual: {allocated, used, remaining}, ... } }
    const balances = data.balances || {};
    const entries = Object.entries(balances);
    if (entries.length === 0) {
      container.innerHTML = `<div class="empty-state"><p>No leave balances configured.</p></div>`;
      return;
    }
    const ICONS = {
      casual: '🌴', sick: '🏥', earned: '⭐', emergency: '🚨', unpaid: '📋', work_from_home: '🏠'
    };
    const COLOR = {
      casual: 'blue', sick: 'red', earned: 'green', emergency: 'amber', unpaid: 'purple', work_from_home: 'green'
    };
    container.innerHTML = entries.map(([type, b]) => {
      const pct = b.allocated > 0 ? Math.round((b.remaining / b.allocated) * 100) : 0;
      const colorClass = COLOR[type] || 'blue';
      const icon = ICONS[type] || '📅';
      const label = type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      return `
        <div class="kpi-card">
          <div class="kpi-header">
            <div>
              <div class="kpi-label">${label} Leave</div>
              <div class="kpi-value" style="font-size:1.8rem;">${b.remaining}</div>
              <div style="font-size:0.82rem; color:var(--color-ink-soft); margin-top:2px;">of ${b.allocated} days remaining</div>
            </div>
            <div class="kpi-icon ${colorClass}">${icon}</div>
          </div>
          <div class="progress-track" style="margin-top:12px;">
            <div class="progress-fill ${pct < 25 ? 'danger' : pct < 50 ? '' : 'success'}" style="width:${pct}%;"></div>
          </div>
        </div>
      `;
    }).join('');
  } catch(err) {
    container.innerHTML = `
      <div class="card" style="grid-column:1/-1; text-align:center; padding:32px;">
        <div style="font-size:2rem; margin-bottom:12px;">⚠️</div>
        <div style="font-weight:600; margin-bottom:8px;">Unable to load leave balances</div>
        <div style="color:var(--color-ink-soft); font-size:0.88rem; margin-bottom:16px;">${err.message || 'Network error'}</div>
        <button class="btn btn-secondary" onclick="loadBalances()">Retry</button>
      </div>
    `;
  }
}

async function loadMyLeaves() {
  const container = document.getElementById('my-leaves-table');
  container.innerHTML = '<div style="padding:24px; text-align:center; color:var(--color-ink-soft);">Loading...</div>';
  try {
    const leaves = await apiRequest('/leaves/mine');
    if (!leaves || leaves.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:40px 24px; text-align:center;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:12px; color:var(--color-ink-soft);"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4" stroke-linecap="round"/></svg>
          <div style="font-weight:600; margin-bottom:4px;">No leave requests yet</div>
          <div style="color:var(--color-ink-soft); font-size:0.88rem;">Your submitted leave requests will appear here.</div>
        </div>
      `;
      return;
    }
    const columns = [
      { key: 'leave_type', label: 'Type', render: val => `<span style="text-transform:capitalize;">${val.replace(/_/g,' ')}</span>` },
      { key: 'start_date', label: 'Start', render: val => formatDate(val) },
      { key: 'end_date', label: 'End', render: val => formatDate(val) },
      { key: 'days_requested', label: 'Days' },
      { key: 'status', label: 'Status', render: val => chipHtml(val) },
      { key: 'actions', label: '', render: (_, row) => {
        if (row.status === 'pending') return `<button class="btn btn-secondary btn-sm" onclick="cancelLeave(${row.id})">Cancel</button>`;
        return '';
      }}
    ];
    container.innerHTML = '';
    new DataTable({ containerId: container.id, columns, data: leaves, pageSize: 5 });
  } catch(err) {
    container.innerHTML = `
      <div style="padding:24px; text-align:center;">
        <div style="color:var(--color-danger); margin-bottom:8px;">Error loading leave history</div>
        <button class="btn btn-secondary" onclick="loadMyLeaves()">Retry</button>
      </div>
    `;
  }
}

async function loadTeamLeaves() {
  const container = document.getElementById('team-leaves-table');
  container.innerHTML = '<div style="padding:24px; text-align:center; color:var(--color-ink-soft);">Loading...</div>';
  try {
    const leaves = await apiRequest('/leaves/team?pending_only=true');
    if (!leaves || leaves.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:40px 24px; text-align:center;">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:12px; color:var(--color-ink-soft);"><path d="M9 12l2 2 4-4M7 12a5 5 0 1110 0 5 5 0 01-10 0"/></svg>
          <div style="font-weight:600; margin-bottom:4px;">No pending approvals</div>
          <div style="color:var(--color-ink-soft); font-size:0.88rem;">All caught up! No leave requests awaiting your decision.</div>
        </div>
      `;
      return;
    }
    const columns = [
      { 
        key: 'employee_name', 
        label: 'Employee',
        render: (_, row) => renderAvatar({
          name: row.employee_name,
          profile_photo_url: row.profile_photo_url,
          employee_id: row.employee_id_str || row.employee_id
        }, { size: 'sm', showName: true, subtext: row.department || row.employee_id_str || row.employee_id })
      },
      { key: 'leave_type', label: 'Type', render: val => `<span style="text-transform:capitalize;">${val.replace(/_/g,' ')}</span>` },
      { key: 'start_date', label: 'Dates', render: (_, row) => `${formatDate(row.start_date)} – ${formatDate(row.end_date)}` },
      { key: 'days_requested', label: 'Days' },
      { key: 'reason', label: 'Reason' },
      { key: 'actions', label: 'Actions', render: (_, row) => `
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary btn-sm" onclick="approveLeave(${row.id})">Approve</button>
          <button class="btn btn-danger btn-sm" onclick="rejectLeave(${row.id})">Reject</button>
        </div>
      `}
    ];
    container.innerHTML = '';
    new DataTable({ containerId: container.id, columns, data: leaves, pageSize: 5 });
  } catch(err) {
    container.innerHTML = `<div style="padding:24px; text-align:center; color:var(--color-danger);">Error loading pending leaves. <button class="btn btn-secondary" onclick="loadTeamLeaves()">Retry</button></div>`;
  }
}

window.cancelLeave = async function(id) {
  Modal.confirm(
    'Cancel Leave Request',
    'Are you sure you want to cancel this leave request? This cannot be undone.',
    async () => {
      try {
        await apiRequest(`/leaves/${id}/cancel`, { method: 'POST' });
        Toast.show('Leave request cancelled', 'success');
        await loadBalances();
        await loadMyLeaves();
      } catch(err) {
        Toast.show(err.message || 'Failed to cancel', 'error');
      }
    },
    'Cancel Leave',
    true
  );
};

window.approveLeave = async function(id) {
  Modal.confirm(
    'Approve Leave',
    'Approve this leave request?',
    async () => {
      try {
        await apiRequest(`/leaves/${id}/approve`, { method: 'POST', body: { comment: '' } });
        Toast.show('Leave approved', 'success');
        await loadTeamLeaves();
      } catch(err) {
        Toast.show(err.message || 'Failed to approve', 'error');
      }
    },
    'Approve'
  );
};

window.rejectLeave = async function(id) {
  Modal.confirm(
    'Reject Leave',
    'Reject this leave request?',
    async () => {
      try {
        await apiRequest(`/leaves/${id}/reject`, { method: 'POST', body: { comment: '' } });
        Toast.show('Leave rejected', 'success');
        await loadTeamLeaves();
      } catch(err) {
        Toast.show(err.message || 'Failed to reject', 'error');
      }
    },
    'Reject',
    true
  );
};
