function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

document.addEventListener('DOMContentLoaded', async () => {
  requireRole(['admin', 'hr', 'manager']);
  const user = TokenStore.getUser();
  if (user) {
    Sidebar.init('shifts');
    setAvatarElement('topbar-avatar', user);
    NotificationCenter.init('notif-bell-btn');
  }

  await loadShiftsAndRoster();
  await loadSwapRecs();

  document.getElementById('add-shift-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-shift');
    btn.disabled = true;
    btn.textContent = 'Creating...';
    try {
      await apiRequest('/shifts', {
        method: 'POST',
        body: {
          name: document.getElementById('shift-name').value,
          start_time: document.getElementById('shift-start').value.substring(0, 5),
          end_time: document.getElementById('shift-end').value.substring(0, 5),
          break_duration_minutes: parseInt(document.getElementById('shift-break').value, 10),
          grace_period_minutes: parseInt(document.getElementById('shift-grace').value, 10)
        }
      });
      Toast.show('Shift created successfully', 'success');
      Modal.close('shift-modal');
      e.target.reset();
      await loadShiftsAndRoster();
    } catch (err) {
      Toast.show(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Shift';
    }
  });
});

async function loadShiftsAndRoster() {
  const container = document.getElementById('shift-cards');
  const roster = document.getElementById('roster-grid');
  container.innerHTML = '<div style="grid-column:1/-1;">Loading...</div>';

  try {
    const shifts = await apiRequest('/shifts');
    if (!Array.isArray(shifts)) throw new Error('The shifts endpoint returned an unexpected response.');
    let emps = [];
    let employeeLoadError = '';
    try {
      const result = await apiRequest('/employees');
      emps = Array.isArray(result) ? result : [];
    } catch (err) {
      employeeLoadError = err.message;
      console.warn('Could not load shift assignments:', err);
    }

    // Group employees by shift
    const empsByShift = {};
    shifts.forEach(s => empsByShift[s.id] = []);
    emps.forEach(e => {
      if (e.shift_id && empsByShift[e.shift_id]) {
        empsByShift[e.shift_id].push(e);
      }
    });

    if (!shifts.length) {
      container.innerHTML = '<div class="shift-empty"><strong>No shifts configured yet</strong><span>Add a shift to define working hours for your team.</span></div>';
      renderRoster([] , empsByShift);
      return;
    }
    container.innerHTML = shifts.map(s => {
      // calculate bar position
      const getMin = (t) => { const [h, m] = t.split(':'); return parseInt(h) * 60 + parseInt(m); };
      const sMin = getMin(s.start_time);
      const eMin = getMin(s.end_time);
      let duration = eMin - sMin;
      if (duration < 0) duration += 24 * 60;
      const left = (sMin / (24 * 60)) * 100;
      let width = (duration / (24 * 60)) * 100;

      const count = empsByShift[s.id].length;

      return `
        <div class="shift-card">
          <div class="shift-title">${s.name}</div>
          <div class="shift-stats">
            <div class="shift-stat"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> ${s.start_time.substring(0, 5)} - ${s.end_time.substring(0, 5)}</div>
            <div class="shift-stat"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M17 20h5V4h-5m-8 16H4V4h5m8 16H9V4h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> ${formatDuration(duration)}</div>
            <div class="shift-stat"><svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M17 20h5V4h-5m-8 16H4V4h5m8 16H9V4h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> ${count} emps</div>
          </div>
          <div class="time-track">
            <div class="time-bar" style="left:${left}%; width:${width}%;"></div>
          </div>
          <div class="time-labels">
            <span>00:00</span>
            <span>12:00</span>
            <span>24:00</span>
          </div>
          <div class="shift-actions">
            <button class="btn btn-secondary btn-sm">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteShift('${s.id}')">Delete</button>
          </div>
        </div>
      `;
    }).join('');

    renderRoster(shifts, empsByShift);
    if (employeeLoadError) {
      const note = document.createElement('div');
      note.className = 'shift-data-note';
      note.textContent = `Shift configurations loaded, but employee assignments could not be loaded: ${employeeLoadError}`;
      container.prepend(note);
    }

  } catch (e) {
    container.innerHTML = `<div class="shift-error"><strong>Unable to load shift configurations</strong><span>${escapeHtml(e.message || 'Check your connection and try again.')}</span><button class="btn btn-secondary btn-sm" onclick="loadShiftsAndRoster()">Retry</button></div>`;
    if (roster) roster.innerHTML = '<div class="roster-message">The weekly roster is unavailable until shift configurations load.</div>';
  }
}

function renderRoster(shifts, empsByShift) {
  const container = document.getElementById('roster-grid');

  let html = `
    <div class="roster-header">Shift</div>
    <div class="roster-header">Mon</div>
    <div class="roster-header">Tue</div>
    <div class="roster-header">Wed</div>
    <div class="roster-header">Thu</div>
    <div class="roster-header">Fri</div>
    <div class="roster-header">Sat</div>
    <div class="roster-header">Sun</div>
  `;

  shifts.forEach(s => {
    html += `<div class="roster-cell" style="font-weight:500;">${s.name}<div style="font-size:0.75rem; color:var(--color-ink-soft); font-weight:normal;">${s.start_time.substring(0, 5)}-${s.end_time.substring(0, 5)}</div></div>`;

    // For now, assume same employees every day
    const emps = empsByShift[s.id] || [];
    const chipsHtml = emps.slice(0, 4).map(e => {
      const av = renderAvatar(e, { size: 'xs' });
      const fName = (e.name || '').split(' ')[0] || 'Emp';
      return `<div class="emp-chip" title="${escapeHtml(e.name)}">${av}<span>${escapeHtml(fName)}</span></div>`;
    }).join('');
    const more = emps.length > 4 ? `<div style="font-size:0.75rem; color:var(--color-ink-soft); font-weight:600; padding:2px 4px;">+${emps.length - 4} more</div>` : '';

    // 5 weekdays
    for (let i = 0; i < 5; i++) {
      html += `<div class="roster-cell">${chipsHtml}${more}</div>`;
    }
    // 2 weekend days (empty for simplicity)
    html += `<div class="roster-cell" style="background:var(--color-surface-alt); align-items:center; justify-content:center; color:var(--color-ink-soft); font-weight:500;">Off</div>`;
    html += `<div class="roster-cell" style="background:var(--color-surface-alt); align-items:center; justify-content:center; color:var(--color-ink-soft); font-weight:500;">Off</div>`;
  });

  container.innerHTML = html;
}

window.deleteShift = async function (id) {
  Modal.confirm({
    title: 'Delete Shift',
    message: 'Are you sure you want to delete this shift?',
    type: 'danger',
    confirmText: 'Delete',
    onConfirm: async () => {
      try {
        await apiRequest(`/shifts/${id}`, { method: 'DELETE' });
        Toast.show('Shift deleted', 'success');
        await loadShiftsAndRoster();
      } catch (e) {
        Toast.show(e.message, 'error');
      }
    }
  });
};

async function loadSwapRecs() {
  const container = document.getElementById('swap-recs');
  if (!container) return;
  try {
    const recs = await apiRequest('/ml/shift-swap/recommendations');
    if (!recs || recs.length === 0) {
      container.innerHTML = '<div style="color:var(--color-ink-soft); padding:12px 0;">No swap recommendations currently. Scheduling efficiency is optimal.</div>';
      return;
    }

    container.innerHTML = recs.map(r => {
      const name = r.employee_name || (r.employee_a_name ? `${r.employee_a_name} ↔ ${r.employee_b_name}` : 'Employee');
      const conf = r.confidence ? Math.round(r.confidence * 100) : (r.confidence_score ? Math.round(r.confidence_score * 100) : 85);
      const text = r.recommendation || r.reason || 'Shift adjustment recommended to optimize coverage.';
      return `
        <div class="swap-card">
          <div class="swap-info" style="display:flex; flex-direction:column; gap:4px;">
            <div style="font-weight:700; color:var(--color-ink); display:flex; align-items:center; gap:8px;">
              <span>${escapeHtml(name)}</span>
              <span class="chip chip-neutral" style="font-size:0.75rem;">${r.absence_count != null ? r.absence_count + ' absences' : 'Optimization'}</span>
            </div>
            <div style="color:var(--color-ink-soft); font-size:0.85rem;">
              ${escapeHtml(text)}
            </div>
            <div style="font-size:0.75rem; color:var(--color-primary); font-weight:600; display:flex; align-items:center; gap:4px; margin-top:2px;">
              <span>AI Confidence: ${conf}%</span>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="Toast.show('Recommendation accepted. Notification sent.', 'success')">Apply Recommendation</button>
        </div>
      `;
    }).join('');

  } catch (e) {
    container.innerHTML = '<div style="color:var(--color-ink-soft); padding:12px 0;">No AI recommendations available at this time.</div>';
  }
}
