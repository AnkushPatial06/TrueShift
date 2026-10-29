let currentUser = null;

document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  currentUser = TokenStore.getUser();
  if (window.Sidebar) Sidebar.init('profile');
  
  if (currentUser) {
    if (typeof setAvatarElement === 'function') {
      setAvatarElement("topbar-avatar", currentUser);
    }
  }

  await loadProfile();
  
  document.getElementById("profile-form").addEventListener("submit", handleProfileSave);
  document.getElementById("password-form").addEventListener("submit", handlePasswordSave);
  document.getElementById("photo-upload").addEventListener("change", handlePhotoUpload);
});

window.switchTab = function(tabId) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  
  document.querySelector(`button[onclick="switchTab('${tabId}')"]`).classList.add('active');
  document.getElementById(`tab-${tabId}`).classList.add('active');

  if (tabId === 'sessions') {
    loadSessions();
  }
};

async function loadProfile() {
  try {
    const me = await apiRequest('/auth/me');
    currentUser = me;
    TokenStore.setUser(me);
    
    // Left column
    if (typeof setAvatarElement === 'function') {
      setAvatarElement("topbar-avatar", me);
      setAvatarElement("profile-avatar", me, me.name, 96);
    }
    document.getElementById("profile-name").textContent = me.name;
    document.getElementById("profile-role").textContent = roleLabel(me.role);
    document.getElementById("profile-empid").textContent = me.employee_id || 'N/A';
    document.getElementById("profile-dept").textContent = me.department_id || 'N/A';
    
    // Right column - Account form
    document.getElementById("input-name").value = me.name;
    document.getElementById("input-designation").value = me.designation || '';
    document.getElementById("input-email").value = me.email;
    
    // Security 2FA status
    renderTfaStatus(me.tfa_enabled);
    
  } catch(e) {
    if (window.Toast) Toast.show("Failed to load profile", "error");
  }
}

async function handleProfileSave(e) {
  e.preventDefault();
  const btn = document.getElementById("btn-save-profile");
  const name = document.getElementById("input-name").value.trim();
  const designation = document.getElementById("input-designation").value.trim();
  
  btn.disabled = true;
  btn.textContent = "Saving...";
  
  try {
    // Requires an endpoint to update employee details
    await apiRequest(`/employees/${currentUser.id}`, { 
      method: 'PATCH', 
      body: { name, designation } 
    });
    if (window.Toast) Toast.show("Profile updated successfully", "success");
    await loadProfile();
  } catch(e) {
    if (window.Toast) Toast.show(e.message || "Failed to update profile", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Save Changes";
  }
}

async function handlePasswordSave(e) {
  e.preventDefault();
  const current = document.getElementById("current-password").value;
  const newPass = document.getElementById("new-password").value;
  const confirm = document.getElementById("confirm-password").value;
  
  if (newPass !== confirm) {
    if (window.Toast) Toast.show("New passwords do not match", "error");
    return;
  }
  
  const btn = document.getElementById("btn-save-password");
  btn.disabled = true;
  
  try {
    await apiRequest('/auth/change-password', {
      method: 'POST',
      body: { old_password: current, new_password: newPass }
    });
    if (window.Toast) Toast.show("Password changed successfully", "success");
    document.getElementById("password-form").reset();
  } catch(e) {
    if (window.Toast) Toast.show(e.message || "Failed to change password", "error");
  } finally {
    btn.disabled = false;
  }
}

function renderTfaStatus(isEnabled) {
  const container = document.getElementById("tfa-status-area");
  if (isEnabled) {
    container.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
        <span class="chip chip-success" style="font-size:1rem; padding:6px 12px;">2FA Active</span>
        <span style="color:var(--color-ink-soft); font-size:0.9rem;">Your account is secured with two-factor authentication.</span>
      </div>
      <button class="btn btn-secondary" style="color:var(--color-danger);" onclick="window.disableTfa()">Disable 2FA</button>
    `;
  } else {
    container.innerHTML = `
      <p style="margin-bottom:16px; color:var(--color-ink-soft);">Add an extra layer of security to your account by requiring a code from your authenticator app when you sign in.</p>
      <button class="btn btn-primary" onclick="window.startTfaSetup()">Enable 2FA</button>
    `;
  }
}

window.startTfaSetup = async function() {
  try {
    const res = await apiRequest('/security/2fa/setup', { method: 'POST' });
    
    if (window.Modal) {
      Modal.open({
        title: 'Setup Two-Factor Authentication',
        content: `
          <div style="text-align:center;">
            <p style="margin-bottom:16px;">Scan this QR code with your authenticator app (e.g., Google Authenticator, Authy).</p>
            <img src="${res.qr_code_url}" alt="QR Code" style="width:200px; height:200px; border:1px solid var(--color-border); padding:8px; border-radius:var(--radius-sm); margin-bottom:16px;" />
            <p style="font-size:0.8rem; color:var(--color-ink-soft); margin-bottom:24px;">Or enter this code manually: <br/><strong style="font-family:monospace; font-size:1rem; color:var(--color-ink);">${res.secret}</strong></p>
            
            <div class="field" style="text-align:left;">
              <label>Enter 6-digit code from app</label>
              <input type="text" id="tfa-verify-code" placeholder="000000" maxlength="6" style="font-size:1.5rem; letter-spacing:0.2em; text-align:center; font-family:monospace;" />
            </div>
          </div>
        `,
        actions: `
          <button class="btn btn-secondary" onclick="Modal.close()">Cancel</button>
          <button class="btn btn-primary" onclick="window.verifyTfaSetup()">Verify & Enable</button>
        `
      });
    }
  } catch(e) {
    if (window.Toast) Toast.show(e.message || "Failed to start 2FA setup", "error");
  }
};

window.verifyTfaSetup = async function() {
  const code = document.getElementById("tfa-verify-code").value.trim();
  if (code.length !== 6) {
    if (window.Toast) Toast.show("Please enter a 6-digit code", "error");
    return;
  }
  
  try {
    await apiRequest('/security/2fa/verify', { method: 'POST', body: { code } });
    if (window.Toast) Toast.show("2FA enabled successfully", "success");
    if (window.Modal) Modal.close();
    loadProfile();
  } catch(e) {
    if (window.Toast) Toast.show(e.message || "Invalid code", "error");
  }
};

window.disableTfa = async function() {
  if (window.Modal) {
    Modal.confirm("Are you sure you want to disable 2FA? This will reduce your account security.", async () => {
      try {
        await apiRequest('/security/2fa/disable', { method: 'POST' }); // Assume this endpoint exists
        if (window.Toast) Toast.show("2FA disabled", "success");
        loadProfile();
      } catch(e) {
        if (window.Toast) Toast.show("Failed to disable 2FA", "error");
      }
    });
  }
};

async function loadSessions() {
  const container = document.getElementById("sessions-list");
  container.innerHTML = "<p>Loading...</p>";
  try {
    const sessions = await apiRequest('/security/sessions');
    if (sessions.length === 0) {
      container.innerHTML = "<p>No active sessions found.</p>";
      return;
    }
    
    container.innerHTML = sessions.map(s => `
      <div class="session-item">
        <div>
          <div style="font-weight:600;">${s.device_info || 'Unknown Device'} ${s.is_current ? '<span class="chip chip-success" style="font-size:0.7rem;">Current</span>' : ''}</div>
          <div style="font-size:0.85rem; color:var(--color-ink-soft);">IP: ${s.ip_address || 'Unknown'} · Last seen: ${new Date(s.last_seen || s.created_at).toLocaleString()}</div>
        </div>
        ${!s.is_current ? `<button class="btn btn-secondary" style="padding:6px 12px; font-size:0.8rem; color:var(--color-danger);" onclick="window.revokeSession(${s.id})">Revoke</button>` : ''}
      </div>
    `).join('');
  } catch(e) {
    container.innerHTML = "<p class='alert alert-error'>Failed to load sessions.</p>";
  }
}

window.revokeSession = async function(id) {
  try {
    await apiRequest(`/security/sessions/${id}`, { method: 'DELETE' });
    if (window.Toast) Toast.show("Session revoked", "success");
    loadSessions();
  } catch(e) {
    if (window.Toast) Toast.show("Failed to revoke session", "error");
  }
};

window.revokeAllSessions = async function() {
  if (window.Modal) {
    Modal.confirm("Revoke all other active sessions?", async () => {
      try {
        await apiRequest('/security/sessions/revoke-all', { method: 'POST' }); // Assume endpoint
        if (window.Toast) Toast.show("All other sessions revoked", "success");
        loadSessions();
      } catch(e) {
        if (window.Toast) Toast.show("Failed to revoke sessions", "error");
      }
    });
  }
};

async function handlePhotoUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  try {
    const token = TokenStore.getAccess();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    if (window.Toast) Toast.show("Uploading profile photo...", "info");

    const res = await fetch(`${API_BASE_URL}/auth/photo`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Photo upload failed');
    }

    const updated = await res.json();
    TokenStore.setUser(updated);
    currentUser = updated;

    if (window.Toast) Toast.show("Profile photo updated successfully!", "success");
    await loadProfile();
    if (window.Sidebar) Sidebar.init('profile');
  } catch (err) {
    if (window.Toast) Toast.show(err.message || "Failed to upload photo", "error");
  }
}
