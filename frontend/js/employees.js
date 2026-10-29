document.addEventListener('DOMContentLoaded', async () => {
  requireRole(['admin', 'hr', 'manager']);
  const user = TokenStore.getUser();
  if (user) {
    Sidebar.init('employees');
    if (typeof setAvatarElement === 'function') {
      setAvatarElement('topbar-avatar', user);
    }
    NotificationCenter.init('notif-bell-btn');
  }

  await loadOptions();
  await loadEmployees();

  document.getElementById('add-dept-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-add-dept');
    btn.disabled = true;
    btn.textContent = 'Adding...';
    try {
      await apiRequest('/departments', {
        method: 'POST',
        body: {
          name: document.getElementById('dept-name').value,
          code: document.getElementById('dept-code').value
        }
      });
      Toast.show('Department added successfully', 'success');
      document.getElementById('dept-name').value = '';
      document.getElementById('dept-code').value = '';
      await loadDepartments();
    } catch(err) {
      Toast.show(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Add';
    }
  });

  // Toggle work arrangement cards (On-site vs Remote)
  const radioOnsite = document.getElementById('radio-type-onsite');
  const radioRemote = document.getElementById('radio-type-remote');
  const cardOnsite = document.getElementById('type-card-onsite');
  const cardRemote = document.getElementById('type-card-remote');
  const locGroup = document.getElementById('emp-location-group');
  const locSelect = document.getElementById('emp-location-select');
  const remoteBanner = document.getElementById('remote-policy-banner');
  const remoteCheckbox = document.getElementById('emp-remote');

  function syncWorkType(isRemote) {
    if (remoteCheckbox) remoteCheckbox.checked = isRemote;
    if (radioOnsite) radioOnsite.checked = !isRemote;
    if (radioRemote) radioRemote.checked = isRemote;
    if (cardOnsite && cardRemote) {
      if (isRemote) {
        cardRemote.style.borderColor = 'var(--color-accent)';
        cardRemote.style.boxShadow = '0 0 0 1px var(--color-accent)';
        cardOnsite.style.borderColor = 'var(--color-border)';
        cardOnsite.style.boxShadow = 'none';
        if (locGroup) locGroup.style.display = 'none';
        if (locSelect) locSelect.value = '';
        if (remoteBanner) remoteBanner.style.display = 'block';
      } else {
        cardOnsite.style.borderColor = 'var(--color-accent)';
        cardOnsite.style.boxShadow = '0 0 0 1px var(--color-accent)';
        cardRemote.style.borderColor = 'var(--color-border)';
        cardRemote.style.boxShadow = 'none';
        if (locGroup) locGroup.style.display = 'block';
        if (remoteBanner) remoteBanner.style.display = 'none';
      }
    }
  }
  window.syncWorkType = syncWorkType;

  if (radioOnsite && radioRemote) {
    radioOnsite.addEventListener('change', () => syncWorkType(false));
    radioRemote.addEventListener('change', () => syncWorkType(true));
  }

  document.getElementById('add-emp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-save-emp');
    btn.disabled = true;
    btn.textContent = 'Creating...';
    try {
      const isRemote = Boolean(document.getElementById('emp-remote')?.checked);
      const selectedLoc = document.getElementById('emp-location-select')?.value?.trim() || null;
      
      if (!isRemote && !selectedLoc) {
        Toast.show('Please assign a work location or mark the employee as Remote.', 'error');
        btn.disabled = false;
        btn.textContent = 'Create Employee';
        return;
      }

      const payload = {
        name: document.getElementById('emp-name').value,
        email: document.getElementById('emp-email').value,
        password: document.getElementById('emp-pass').value,
        employee_id: document.getElementById('emp-empid').value,
        role: document.getElementById('emp-role').value,
        designation: document.getElementById('emp-desig').value,
        department_id: document.getElementById('emp-dept').value || null,
        shift_id: document.getElementById('emp-shift').value || null,
        work_location: isRemote ? 'Remote' : selectedLoc,
        is_remote: isRemote,
        is_active: true
      };
      await apiRequest('/employees', {
        method: 'POST',
        body: payload
      });
      Toast.show('Employee created successfully', 'success');
      closeEmpDrawer();
      e.target.reset();
      syncWorkType(false);
      await loadEmployees();
    } catch(err) {
      Toast.show(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Employee';
    }
  });
});

window.openEmpDrawer = function() {
  document.getElementById('emp-drawer-backdrop')?.classList.add('open');
  document.getElementById('emp-drawer')?.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (window.syncWorkType) window.syncWorkType(false);
};

window.closeEmpDrawer = function() {
  document.getElementById('emp-drawer-backdrop')?.classList.remove('open');
  document.getElementById('emp-drawer')?.classList.remove('open');
  document.body.style.overflow = '';
};

window.openProfileDrawer = function() {
  document.getElementById('profile-drawer-backdrop')?.classList.add('open');
  document.getElementById('profile-drawer')?.classList.add('open');
  document.body.style.overflow = 'hidden';
};

window.closeProfileDrawer = function() {
  document.getElementById('profile-drawer-backdrop')?.classList.remove('open');
  document.getElementById('profile-drawer')?.classList.remove('open');
  document.body.style.overflow = '';
};

let deptCache = {};
let shiftCache = {};
let locationCache = []; // { id, name, is_active }

async function loadOptions() {
  try {
    await loadDepartments();
    const shifts = await apiRequest('/shifts');
    const shiftSelect = document.getElementById('emp-shift');
    shifts.forEach(s => {
      shiftCache[s.id] = s.name;
      shiftSelect.add(new Option(s.name, s.id));
    });
    // Load work locations for dropdown
    await loadLocationsIntoDropdown();
  } catch(e) {
    console.error('Failed to load options', e);
  }
}

async function loadLocationsIntoDropdown() {
  try {
    locationCache = await apiRequest('/locations');
    const sel = document.getElementById('emp-location-select');
    if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    locationCache.filter(l => l.is_active).forEach(loc => {
      sel.add(new Option(loc.name, loc.name));
    });
  } catch(e) {
    console.error('Failed to load work locations', e);
  }
}

async function loadDepartments() {
  try {
    const depts = await apiRequest('/departments');
    const deptSelect = document.getElementById('emp-dept');
    const list = document.getElementById('dept-list');
    
    // clear select (except first)
    while (deptSelect.options.length > 1) {
      deptSelect.remove(1);
    }
    
    if (depts.length === 0) {
      list.innerHTML = '<div style="color:var(--color-ink-soft);">No departments found.</div>';
    } else {
      list.innerHTML = '';
      depts.forEach(d => {
        deptCache[d.id] = d.name;
        deptSelect.add(new Option(d.name, d.id));
        list.innerHTML += `
          <div style="padding:0.75rem; border:1px solid var(--color-gray-200); border-radius:6px; display:flex; justify-content:space-between;">
            <div><strong>${d.name}</strong> <span style="color:var(--color-ink-soft); font-size:0.75rem;">${d.code}</span></div>
            <div style="font-size:0.875rem;">${d.employee_count || 0} employees</div>
          </div>
        `;
      });
    }
  } catch(e) {
    console.error('Failed to load depts', e);
  }
}

let dataTable;

async function loadEmployees() {
  const container = document.getElementById('employees-table');
  Skeleton.tableRows(container.id, 5);
  
  try {
    const emps = await apiRequest('/employees');
    const user = TokenStore.getUser();
    const isAdmin = ['admin', 'hr'].includes(user.role);
    
    const columns = [
      { key: 'name', label: 'Employee', render: (val, row) => `
        <div style="display:flex; align-items:center; gap:10px;">
          ${typeof renderAvatar === 'function' ? renderAvatar(row, val, '', 36) : `<div style="width:36px;height:36px;border-radius:50%;background:var(--color-primary-soft);color:var(--color-primary);display:inline-flex;align-items:center;justify-content:center;font-weight:600;font-size:12px;">${initials(val)}</div>`}
          <div>
            <div style="font-weight:600; color:var(--color-ink);">${val}</div>
            <div style="font-size:0.75rem; color:var(--color-ink-soft);">${row.email}</div>
          </div>
        </div>
      ` },
      { key: 'employee_id', label: 'Emp ID' },
      { key: 'role', label: 'Role', render: val => roleLabel(val) },
      { key: 'department_id', label: 'Department', render: val => val && deptCache[val] ? deptCache[val] : '—' },
      { key: 'shift_id', label: 'Shift', render: val => val && shiftCache[val] ? shiftCache[val] : '—' },
      { key: 'work_location', label: 'Location', render: (val, row) => row.is_remote ? '<span class="chip chip-purple" style="font-size:0.75rem;">Remote</span>' : `<span style="font-size:0.8rem;color:var(--color-ink-soft);">${val || 'Office'}</span>` },
      { key: 'face_registered', label: 'Face ID', render: val => val ? '<span style="color:var(--color-success);font-weight:600;">✓ Registered</span>' : '<span style="color:var(--color-danger)">✗ Missing</span>' },
      { key: 'is_active', label: 'Status', render: val => val ? chipHtml('active') : chipHtml('inactive') },
      { key: 'actions', label: 'Actions', render: (_, row) => `
        <button class="btn btn-secondary btn-sm" onclick="viewProfile('${row.id}')">View</button>
      ` }
    ];

    container.innerHTML = '';
    dataTable = new DataTable({
      containerId: container.id,
      columns,
      data: emps,
      pageSize: 10
    });
    
  } catch(e) {
    Toast.show('Failed to load employees', 'error');
    container.innerHTML = 'Error loading employees.';
  }
}

window.viewProfile = async function(id) {
  openProfileDrawer();
  const body = document.getElementById('profile-body');
  body.innerHTML = 'Loading profile...';
  
  try {
    const emp = await apiRequest(`/employees/${id}`);
    
    let attHtml = '';
    try {
      const att = await apiRequest(`/attendance/employee/${id}`);
      const last30 = att.slice(0, 30);
      const present = last30.filter(a => a.status === 'present').length;
      const absent = last30.filter(a => a.status === 'absent').length;
      const late = last30.filter(a => a.status === 'late').length;
      attHtml = `
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:0.5rem; margin:1rem 0;">
          <div style="text-align:center; padding:0.75rem 0.5rem; background:var(--color-surface-alt); border:1px solid var(--color-border); border-radius:var(--radius-sm);"><div style="font-size:1.3rem; font-weight:700; color:var(--color-success);">${present}</div><div style="font-size:0.75rem; color:var(--color-ink-soft); font-weight:600;">Present</div></div>
          <div style="text-align:center; padding:0.75rem 0.5rem; background:var(--color-surface-alt); border:1px solid var(--color-border); border-radius:var(--radius-sm);"><div style="font-size:1.3rem; font-weight:700; color:var(--color-danger);">${absent}</div><div style="font-size:0.75rem; color:var(--color-ink-soft); font-weight:600;">Absent</div></div>
          <div style="text-align:center; padding:0.75rem 0.5rem; background:var(--color-surface-alt); border:1px solid var(--color-border); border-radius:var(--radius-sm);"><div style="font-size:1.3rem; font-weight:700; color:var(--color-purple);">${late}</div><div style="font-size:0.75rem; color:var(--color-ink-soft); font-weight:600;">Late</div></div>
        </div>
      `;
    } catch(e) { attHtml = '<p style="color:var(--color-ink-soft);font-size:0.85rem;">Could not load attendance.</p>'; }
    
    let leaveHtml = '';
    try {
      const balances = await apiRequest(`/leaves/balance?employee_id=${id}`);
      leaveHtml = '<div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:1rem;">';
      balances.forEach(b => {
        leaveHtml += `<span style="padding:0.25rem 0.6rem; background:var(--color-surface-alt); border:1px solid var(--color-border); border-radius:var(--radius-full); font-size:0.75rem; color:var(--color-ink-mid);">${b.leave_type}: <strong>${b.allocated - b.used}/${b.allocated}</strong> left</span>`;
      });
      leaveHtml += '</div>';
    } catch(e) { leaveHtml = '<p style="color:var(--color-ink-soft);font-size:0.85rem;">Could not load leave balance.</p>'; }

    const drawerAvatar = typeof renderAvatar === 'function'
      ? renderAvatar(emp, emp.name, '', 72)
      : `<div class="profile-avatar" style="margin: 0 auto 1rem; width:72px; height:72px; border-radius:50%; font-size:24px; display:inline-flex; align-items:center; justify-content:center; background:var(--color-primary-soft); color:var(--color-primary);">${initials(emp.name)}</div>`;

    body.innerHTML = `
      <div style="text-align:center; margin-bottom:1.5rem; position:relative;">
        <div style="position:relative; display:inline-block; margin-bottom:0.75rem;">
          ${drawerAvatar}
          <button type="button" class="icon-btn" onclick="document.getElementById('drawer-photo-input').click()" title="Change employee photo" style="position:absolute; bottom:0; right:0; width:26px; height:26px; border-radius:50%; background:var(--color-surface); border:1px solid var(--color-border); box-shadow:var(--shadow-xs);">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
          </button>
          <input type="file" id="drawer-photo-input" style="display:none;" accept="image/*" onchange="uploadDrawerEmployeePhoto(${emp.id}, this)" />
        </div>
        <h3 style="margin:0; font-size:1.15rem; color:var(--color-ink);">${emp.name}</h3>
        <p style="color:var(--color-ink-soft); margin:0.25rem 0 0.5rem; font-size:0.85rem;">${emp.designation || 'No designation'}</p>
        <div>${chipHtml(emp.role)}</div>
      </div>
      
      <div style="margin-bottom:1.5rem; font-size:0.875rem;">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
          <span style="color:var(--color-ink-soft)">Email</span>
          <span>${emp.email}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
          <span style="color:var(--color-ink-soft)">Emp ID</span>
          <span>${emp.employee_id}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
          <span style="color:var(--color-ink-soft)">Department</span>
          <span>${emp.department_id && deptCache[emp.department_id] ? deptCache[emp.department_id] : '—'}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
          <span style="color:var(--color-ink-soft)">Shift</span>
          <span>${emp.shift_id && shiftCache[emp.shift_id] ? shiftCache[emp.shift_id] : '—'}</span>
        </div>
      </div>
      
      <h4>Attendance (Last 30)</h4>
      ${attHtml}
      
      <h4>Leave Balances</h4>
      ${leaveHtml}
      
      <h4>Onboarding Checklist</h4>
      <div style="font-size:0.875rem; margin-bottom:1.5rem;">
        <div class="checklist-item">
          ${emp.face_registered ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="var(--color-danger)" stroke-width="2" stroke-linecap="round"/></svg>'}
          Face registered
        </div>
        <div class="checklist-item">
          ${emp.shift_id ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="var(--color-danger)" stroke-width="2" stroke-linecap="round"/></svg>'}
          Shift assigned
        </div>
        <div class="checklist-item">
          ${emp.department_id ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="var(--color-danger)" stroke-width="2" stroke-linecap="round"/></svg>'}
          Department assigned
        </div>
        <div class="checklist-item">
          ${emp.work_location ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round"/></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M6 18L18 6M6 6l12 12" stroke="var(--color-danger)" stroke-width="2" stroke-linecap="round"/></svg>'}
          Work location set
        </div>
        <div class="checklist-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="var(--color-success)" stroke-width="2" stroke-linecap="round"/></svg>
          Email verified
        </div>
      </div>

      <h4 style="margin-bottom:8px;">Work Location</h4>
      <div style="font-size:0.875rem;margin-bottom:1.5rem;padding:14px;background:var(--color-bg,#F7F4EF);border-radius:10px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="color:var(--color-ink-soft)">Location</span>
          <span id="emp-location-display">${emp.work_location || '<span style="color:#94A3B8">Not set</span>'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span style="color:var(--color-ink-soft)">Work Type</span>
          <span>${emp.is_remote ? '<span style="background:#EDE9FE;color:#7C3AED;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">Remote — No Geofencing</span>' : '<span style="background:#D1FAE5;color:#059669;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;">On-Site</span>'}</span>
        </div>
      </div>
    `;
    
    const user = TokenStore.getUser();
    if (['admin', 'hr'].includes(user.role)) {
      body.innerHTML += `
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:12px;">
          <button class="btn btn-secondary btn-block" onclick="editLocation('${emp.id}', '${emp.work_location || ''}', ${emp.is_remote || false})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:6px;"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
            Edit Location / Work Type
          </button>
          <button class="btn btn-danger btn-block" onclick="deactivateEmployee('${emp.id}')">Deactivate Account</button>
        </div>
      `;
    }
    
  } catch(e) {
    body.innerHTML = 'Error loading profile.';
  }
};


window.deactivateEmployee = async function(id) {
  Modal.confirm({
    title: 'Deactivate Employee',
    message: 'Are you sure you want to deactivate this employee? They will no longer be able to log in.',
    confirmText: 'Deactivate',
    type: 'danger',
    onConfirm: async () => {
      try {
        await apiRequest(`/employees/${id}`, {
          method: 'PATCH',
          body: { is_active: false }
        });
        Toast.show('Employee deactivated', 'success');
        closeProfileDrawer();
        await loadEmployees();
      } catch(e) {
        Toast.show(e.message, 'error');
      }
    }
  });
};

window.editLocation = async function(id, currentLocation, currentIsRemote) {
  const modalId = 'edit-location-modal';
  document.getElementById(modalId)?.remove();

  // Always fetch fresh locations so the list is up-to-date
  try {
    locationCache = await apiRequest('/locations');
  } catch (e) {
    console.warn('Could not refresh location list:', e);
  }

  // Build location options from cache
  const activeLocs = locationCache.filter(l => l.is_active);
  const locOptions = activeLocs.map(loc =>
    `<option value="${loc.name}" ${currentLocation === loc.name && !currentIsRemote ? 'selected' : ''}>${loc.name}</option>`
  ).join('');

  const el = document.createElement('div');
  el.id = modalId;
  el.className = 'modal-backdrop';
  el.innerHTML = `
    <div class="modal" style="max-width:480px;">
      <div class="modal-header">
        <div class="modal-title">Edit Work Location &amp; Type</div>
        <button class="modal-close" onclick="Modal.close('${modalId}')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>

      <div style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:8px;font-size:0.875rem;font-weight:600;">Work Type</label>
        <div style="display:flex;gap:16px;">
          <label style="display:flex;align-items:center;gap:7px;font-size:0.88rem;cursor:pointer;font-weight:500;">
            <input type="radio" name="modal-work-type" id="modal-type-onsite" value="onsite" ${!currentIsRemote ? 'checked' : ''} />
            🏢 On-Site <span style="font-size:0.75rem;color:var(--color-ink-muted);">(GPS required)</span>
          </label>
          <label style="display:flex;align-items:center;gap:7px;font-size:0.88rem;cursor:pointer;font-weight:500;">
            <input type="radio" name="modal-work-type" id="modal-type-remote" value="remote" ${currentIsRemote ? 'checked' : ''} />
            🌐 Remote <span style="font-size:0.75rem;color:var(--color-ink-muted);">(no restriction)</span>
          </label>
        </div>
      </div>

      <div id="modal-location-field" style="margin-bottom:20px;transition:opacity 0.2s;${currentIsRemote ? 'opacity:0.4;pointer-events:none;' : ''}">
        <label style="display:block;margin-bottom:6px;font-size:0.875rem;font-weight:600;">Assigned Office Location *</label>
        <select id="modal-emp-loc" class="form-control">
          <option value="">-- Select Location --</option>
          ${locOptions}
          ${activeLocs.length === 0 ? '<option disabled>No active locations — add in Work Locations page</option>' : ''}
        </select>
        <small style="color:var(--color-ink-soft);font-size:0.75rem;display:block;margin-top:4px;">
          Employee must be within the geofence radius to check in on-site.
        </small>
      </div>

      <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:10px;">
        <button class="btn btn-secondary" onclick="Modal.close('${modalId}')">Cancel</button>
        <button class="btn btn-primary" id="btn-save-loc">Save Changes</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  el.addEventListener('click', Modal.closeOnBackdrop);
  setTimeout(() => el.classList.add('open'), 10);

  // Toggle location dropdown when work type changes
  el.addEventListener('change', (e) => {
    if (e.target.name === 'modal-work-type') {
      const locField = document.getElementById('modal-location-field');
      const isRemote = e.target.value === 'remote';
      locField.style.opacity = isRemote ? '0.4' : '1';
      locField.style.pointerEvents = isRemote ? 'none' : 'auto';
    }
  });

  document.getElementById('btn-save-loc').addEventListener('click', async () => {
    const btn = document.getElementById('btn-save-loc');
    btn.disabled = true;
    btn.textContent = 'Saving...';
    try {
      const isRemote = document.getElementById('modal-type-remote').checked;
      const locSelect = document.getElementById('modal-emp-loc').value;
      if (!isRemote && !locSelect) {
        Toast.show('Please select an office location, or mark as Remote.', 'error');
        btn.disabled = false;
        btn.textContent = 'Save Changes';
        return;
      }
      await apiRequest(`/employees/${id}`, {
        method: 'PATCH',
        body: {
          work_location: isRemote ? 'Remote' : locSelect,
          is_remote: isRemote
        }
      });
      Toast.show('Location and work type updated successfully', 'success');
      Modal.close(modalId);
      await viewProfile(id);
      await loadEmployees();
    } catch(err) {
      Toast.show(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  });
};

window.uploadDrawerEmployeePhoto = async function(empId, inputEl) {
  const file = inputEl.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const token = TokenStore.getAccess();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/employees/${empId}/photo`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Photo upload failed');
    }

    Toast.show('Employee profile photo updated', 'success');
    await viewProfile(empId);
    await loadEmployees();
  } catch (err) {
    Toast.show(err.message || 'Failed to upload photo', 'error');
  }
};


