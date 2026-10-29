let liveHoursInterval = null;
let currentCheckInTime = null;

document.addEventListener("DOMContentLoaded", async () => {
  requireRole(["employee"]);

  try {
    const me = await apiRequest("/auth/me");
    TokenStore.setUser(me);
    
    document.getElementById("portal-avatar").textContent = initials(me.name);
    
    // Set greeting and date
    const hour = new Date().getHours();
    let greeting = "Good evening";
    if (hour < 12) greeting = "Good morning";
    else if (hour < 18) greeting = "Good afternoon";
    
    document.getElementById("greeting-text").textContent = greeting;
    document.getElementById("greeting-name").textContent = me.name.split(" ")[0];
    
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById("current-date-text").textContent = new Date().toLocaleDateString(undefined, options);

    NotificationCenter.init('notif-bell-btn');

    // Setup Document Upload
    document.getElementById('doc-upload-input').addEventListener('change', handleDocumentUpload);

    // Load data
    await Promise.all([
      loadTodayStatus(),
      loadHistoryAndHeatmap(),
      loadLeaveBalance(),
      loadShiftInfo(),
      checkOnboarding(me),
      loadDocuments()
    ]);

  } catch (err) {
    console.error("Portal initialization failed:", err);
  }

  document.getElementById("logout-btn").addEventListener("click", async () => {
    try {
      await apiRequest("/auth/logout", { method: "POST", body: { refresh_token: TokenStore.getRefresh() } });
    } catch (_) {}
    TokenStore.clear();
    window.location.href = "login.html";
  });
});

async function loadTodayStatus() {
  const container = document.getElementById("today-main-card");
  try {
    const today = await apiRequest("/attendance/today");
    
    if (today.status === "not_marked" || !today.check_in) {
      container.innerHTML = `
        <h2 style="margin-bottom:16px;">Not checked in yet</h2>
        <a href="attendance.html" class="btn btn-primary" style="padding: 12px 32px; font-size: 16px;">Go to Check-In</a>
      `;
    } else if (today.check_in && !today.check_out) {
      // Checked in, not checked out
      currentCheckInTime = new Date(today.check_in);
      
      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; width:100%; padding:0 32px; align-items:center;">
          <div style="text-align:left;">
            <div class="field-hint">Current Status</div>
            <div style="font-size:24px; font-weight:600; display:flex; align-items:center; gap:8px;">
              <span style="width:12px; height:12px; border-radius:50%; background:var(--color-primary);"></span>
              Checked In
            </div>
            <div style="margin-top:16px; font-size:14px;">In at: ${formatTime(today.check_in)}</div>
            <div style="font-size:14px; color:${today.late_minutes_today ? 'var(--color-danger)' : 'var(--color-ink-soft)'};">
              ${today.late_minutes_today ? `Late by ${today.late_minutes_today} min` : 'On time'}
            </div>
          </div>
          <div style="text-align:right;">
            <div class="field-hint">Working Hours</div>
            <div id="live-hours" style="font-size:48px; font-weight:700; font-variant-numeric: tabular-nums;">0.0h</div>
            <a href="attendance.html" class="btn btn-secondary" style="margin-top:16px;">Check Out</a>
          </div>
        </div>
      `;
      
      updateLiveHours();
      if (liveHoursInterval) clearInterval(liveHoursInterval);
      liveHoursInterval = setInterval(updateLiveHours, 60000); // update every minute
      
    } else {
      // Checked out
      container.innerHTML = `
        <div style="display:flex; justify-content:space-between; width:100%; padding:0 32px; align-items:center;">
          <div style="text-align:left;">
            <div class="field-hint">Current Status</div>
            <div style="font-size:24px; font-weight:600; display:flex; align-items:center; gap:8px;">
              <span style="width:12px; height:12px; border-radius:50%; background:var(--color-ink-soft);"></span>
              Completed Shift
            </div>
            <div style="margin-top:16px; font-size:14px;">In at: ${formatTime(today.check_in)}</div>
            <div style="font-size:14px;">Out at: ${formatTime(today.check_out)}</div>
          </div>
          <div style="text-align:right;">
            <div class="field-hint">Total Working Hours</div>
            <div style="font-size:48px; font-weight:700;">${today.working_hours != null ? today.working_hours.toFixed(1) : '—'}h</div>
          </div>
        </div>
      `;
    }
  } catch (err) {
    container.innerHTML = `<p style="color:var(--color-danger);">Failed to load today's status</p>`;
  }
}

function updateLiveHours() {
  if (!currentCheckInTime) return;
  const now = new Date();
  const diffMs = now - currentCheckInTime;
  const diffHours = diffMs / (1000 * 60 * 60);
  const el = document.getElementById("live-hours");
  if (el) el.textContent = diffHours.toFixed(1) + 'h';
}

async function loadHistoryAndHeatmap() {
  try {
    const history = await apiRequest("/attendance/history?limit=30");
    if (!history) return;
    
    // Compute Streak
    let currentStreak = 0;
    let longestStreak = 0; // Simplified for now
    let presentMonth = 0;
    let absentMonth = 0;
    
    // Sort descending by date
    history.sort((a,b) => new Date(b.date) - new Date(a.date));
    
    for (const rec of history) {
      if (rec.status === 'present' || rec.status === 'late') {
        currentStreak++;
        presentMonth++;
      } else if (rec.status === 'absent') {
        absentMonth++;
        break; // break streak
      }
    }
    
    const totalWorkingDays = presentMonth + absentMonth || 1;
    const monthlyPct = Math.round((presentMonth / totalWorkingDays) * 100);
    
    // Render Streak SVG Ring
    const ringContainer = document.getElementById("streak-circle-container");
    const circum = 2 * Math.PI * 40; // r=40
    const offset = circum - (monthlyPct / 100) * circum;
    
    ringContainer.innerHTML = `
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border-light)" stroke-width="8" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--color-primary)" stroke-width="8" 
                stroke-dasharray="${circum}" stroke-dashoffset="${offset}" stroke-linecap="round" 
                transform="rotate(-90 50 50)" />
        <text x="50" y="50" text-anchor="middle" dominant-baseline="middle" font-size="20" font-weight="bold">${monthlyPct}%</text>
      </svg>
    `;
    
    // Render Stats
    document.getElementById("streak-stats").innerHTML = `
      <div><div class="stat-value">${currentStreak}</div><div class="field-hint">Current streak</div></div>
      <div><div class="stat-value">${presentMonth}</div><div class="field-hint">Days present</div></div>
      <div><div class="stat-value">${absentMonth}</div><div class="field-hint">Days absent</div></div>
    `;
    
    // Render Heatmap (6x5 grid = 30 days)
    const heatmapGrid = document.getElementById("heatmap-grid");
    
    // Pad to 30 if needed, or take first 30
    const mapData = history.slice(0, 30).reverse(); // oldest to newest for grid
    
    heatmapGrid.innerHTML = mapData.map(d => {
      let cssClass = "gray";
      if (d.status === 'present') cssClass = 'present';
      else if (d.status === 'absent') cssClass = 'absent';
      else if (d.status === 'late') cssClass = 'late';
      else if (d.status === 'leave') cssClass = 'leave';
      
      return `<div class="heatmap-cell ${cssClass}" title="${d.date}: ${d.status}"></div>`;
    }).join("");
    
  } catch (err) {
    console.error("Failed to load history", err);
  }
}

async function loadLeaveBalance() {
  try {
    const dash = await apiRequest("/analytics/my-dashboard");
    const el = document.getElementById("balance-cards");
    el.innerHTML = Object.entries(dash.leave_balance || {}).map(([type, b]) => `
      <div class="card" style="padding: 16px;">
        <div class="field-hint" style="text-transform: capitalize; margin-bottom: 8px;">${type.replace("_", " ")}</div>
        <div style="font-size: 24px; font-weight: 600;">${b.remaining} <span style="font-size:14px; font-weight:normal; color:var(--color-ink-soft);">/ ${b.allocated} days</span></div>
        <div style="width:100%; height:4px; background:var(--border-light); margin-top:12px; border-radius:2px; overflow:hidden;">
          <div style="width:${(b.remaining/b.allocated)*100}%; height:100%; background:var(--color-primary);"></div>
        </div>
      </div>
    `).join("");
  } catch (err) {
    console.error("Failed to load leave balance");
  }
}

async function loadShiftInfo() {
  try {
    const dash = await apiRequest("/analytics/my-dashboard");
    document.getElementById("shift-name").textContent = dash.shift_name || "Default (no shift assigned)";
    document.getElementById("shift-hours").textContent = `${dash.shift_start_time || '--'} – ${dash.shift_end_time || '--'}`;
    document.getElementById("shift-grace").textContent = `${dash.grace_period_minutes || 0} min`;
  } catch (err) {
    console.error("Failed to load shift");
  }
}

async function checkOnboarding(me) {
  try {
    const container = document.getElementById("checklist-items");
    
    // Check Face ID
    const faceStatus = await apiRequest(`/face/status/${me.employee_id || me.id}`).catch(() => ({ face_registered: false }));
    
    const checklist = [
      { label: "Profile complete", done: !!me.designation, action: "Edit Profile", href: "#" },
      { label: "Department assigned", done: !!me.department, action: "Contact HR", href: "#" },
      { label: "Face ID registered", done: faceStatus.face_registered, action: "Set up", href: "face-registration.html" },
    ];
    
    let allDone = true;
    
    container.innerHTML = checklist.map(item => {
      if (!item.done) allDone = false;
      return `
        <div class="checklist-item">
          <div style="display:flex; align-items:center; gap:8px;">
            ${item.done ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" color="var(--color-primary)"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M22 4L12 14.01l-3-3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" color="var(--border-light)"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/></svg>'}
            <span style="${item.done ? 'text-decoration:line-through; color:var(--color-ink-soft);' : ''}">${item.label}</span>
          </div>
          ${!item.done ? `<a href="${item.href}" class="btn btn-secondary" style="padding:4px 8px; font-size:12px;">${item.action}</a>` : ''}
        </div>
      `;
    }).join("");
    
    if (allDone) {
      document.getElementById("onboarding-card").classList.add("hidden");
    }
  } catch (err) {
    console.error("Failed onboarding check");
  }
}

async function loadDocuments() {
  const container = document.getElementById("document-list");
  try {
    const docs = await apiRequest("/documents/mine").catch(() => []);
    
    if (docs.length === 0) {
      container.innerHTML = `<div class="field-hint" style="grid-column: 1/-1;">No documents uploaded yet.</div>`;
      return;
    }
    
    container.innerHTML = docs.map(doc => `
      <div class="card" style="padding:16px; display:flex; flex-direction:column;">
        <div style="display:flex; align-items:flex-start; gap:12px; margin-bottom:16px;">
          <div style="width:40px; height:40px; background:var(--bg-light); border-radius:8px; display:flex; align-items:center; justify-content:center;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M13 2v7h7" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>
          </div>
          <div style="flex:1; overflow:hidden;">
            <div style="font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${doc.filename}">${doc.filename}</div>
            <div class="field-hint" style="font-size:12px;">${(doc.size / 1024).toFixed(1)} KB</div>
          </div>
        </div>
        <div style="display:flex; gap:8px; margin-top:auto;">
          <a href="${doc.url}" download class="btn btn-secondary" style="flex:1; justify-content:center; padding:4px;">Download</a>
          <button class="btn btn-secondary" style="color:var(--color-danger); border-color:#fad2cf;" onclick="deleteDocument(${doc.id})">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    `).join("");
  } catch (err) {
    console.error("Failed to load documents");
  }
}

async function handleDocumentUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const token = TokenStore.getAccess();
    const res = await fetch(`${API_BASE_URL}/documents/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData
    });
    
    if (!res.ok) throw new Error("Upload failed");
    
    Toast.show("Document uploaded successfully", "success");
    await loadDocuments();
  } catch (err) {
    Toast.show(err.message, "error");
  }
  
  e.target.value = ''; // Reset input
}

async function deleteDocument(id) {
  if (typeof Modal !== 'undefined') {
    Modal.confirm("Delete Document", "Are you sure you want to delete this document?", async () => {
      try {
        await apiRequest(`/documents/${id}`, { method: 'DELETE' });
        Toast.show("Document deleted", "success");
        await loadDocuments();
      } catch (err) {
        Toast.show(err.message, "error");
      }
    });
  }
}