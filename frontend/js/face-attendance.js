let stream = null;
let currentUser = null;
let gpsCoords = null; // { latitude, longitude } or null
let cameraReady = false;
let todayAttendance = null;
let attendanceStatusLoaded = false;
let actionInProgress = false;
let attendanceLoadError = '';

document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  try {
    const me = await apiRequest("/auth/me");
    if (me) {
      currentUser = me;
      TokenStore.setUser(me);
    }
  } catch (_) {
    currentUser = TokenStore.getUser();
  }

  if (currentUser) {
    Sidebar.init('attendance');
    setAvatarElement('topbar-avatar', currentUser);
    NotificationCenter.init('notif-bell-btn');
  }

  document.getElementById("employee-id-field").value = currentUser?.employee_id || currentUser?.id || "";
  
  document.getElementById("check-in-btn").addEventListener("click", () => performAction("check-in"));
  document.getElementById("check-out-btn").addEventListener("click", () => performAction("check-out"));
  document.getElementById('retry-camera-btn')?.addEventListener('click', startCamera);
  document.getElementById("attendance-action-note")?.replaceChildren();
  syncAttendanceActions();

  // Set initial skeletons
  if (typeof Skeleton !== 'undefined') {
    document.getElementById("today-status-container").innerHTML = 
      Skeleton.text(5);
    document.getElementById("history-container").innerHTML = 
      Skeleton.tableRows(5, 2);
  }

  renderWorkLocationBanner();
  await Promise.all([startCamera(), initGPS(), refreshTodayStatus()]);
  await refreshHistory();
});

function renderWorkLocationBanner() {
  const badgeEl = document.getElementById("loc-type-badge");
  const nameEl = document.getElementById("loc-name-display");
  const hintEl = document.getElementById("loc-policy-hint");
  if (!nameEl) return;

  const isRemote = currentUser?.is_remote === true;
  if (isRemote) {
    if (badgeEl) {
      badgeEl.className = 'chip';
      badgeEl.style.background = '#EEF2FF';
      badgeEl.style.color = '#4F46E5';
      badgeEl.style.fontWeight = '600';
      badgeEl.textContent = '🌐 Remote Employee';
    }
    nameEl.innerHTML = 'Remote / Work From Anywhere';
    hintEl.innerHTML = '✓ You are authorized for remote attendance. You may mark attendance from any location using face recognition.';
  } else {
    const locName = currentUser?.work_location || 'Office (Unassigned)';
    if (badgeEl) {
      badgeEl.className = 'chip chip-success';
      badgeEl.style.background = '';
      badgeEl.style.color = '';
      badgeEl.style.fontWeight = '600';
      badgeEl.textContent = '🏢 On-Site Employee';
    }
    nameEl.innerHTML = `🏢 ${locName}`;
    hintEl.innerHTML = `⚠️ On-site attendance policy active. You must be physically within the geofence perimeter of <strong>${locName}</strong> with GPS enabled.`;
  }
}

async function startCamera() {
  try {
    stream?.getTracks().forEach(track => track.stop());
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
    const video = document.getElementById("camera-feed");
    video.srcObject = stream;
    if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Camera did not become ready. Check camera permissions and try again.')), 8000);
        video.addEventListener('loadedmetadata', () => { clearTimeout(timeout); resolve(); }, { once: true });
        video.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Could not read the camera stream.')); }, { once: true });
      });
    }
    await video.play();
    cameraReady = video.videoWidth > 0 && video.videoHeight > 0;
    if (!cameraReady) throw new Error('Camera is not ready. Check camera permissions and try again.');
  } catch (err) {
    cameraReady = false;
    if (typeof Toast !== 'undefined') {
      Toast.show("Could not access the camera: " + err.message, "error");
    } else {
      alert("Could not access the camera: " + err.message);
    }
  } finally {
    syncAttendanceActions();
  }
}

window.addEventListener('pagehide', () => {
  stream?.getTracks().forEach(track => track.stop());
  stream = null;
  cameraReady = false;
});

// ── GPS / Geofence helpers ────────────────────────────────────────────────────
function updateGPSBadge(state, text) {
  const badge = document.getElementById("gps-status-badge");
  if (!badge) return;
  const icons = {
    acquiring: '⏳',
    ok: '📍',
    denied: '🚫',
    remote: '🌐',
    na: 'ℹ️'
  };
  const colors = {
    acquiring: 'var(--color-ink-muted)',
    ok: 'var(--color-success, #16a34a)',
    denied: 'var(--color-danger)',
    remote: 'var(--color-primary)',
    na: 'var(--color-ink-muted)'
  };
  badge.innerHTML = `<span style="color:${colors[state] || colors.na};font-weight:600;">${icons[state] || '📡'} ${text}</span>`;
}

async function initGPS() {
  // Check if this employee is remote from their profile
  const isRemote = currentUser?.is_remote === true;
  if (isRemote) {
    updateGPSBadge('remote', 'Remote employee — no location check required');
    syncAttendanceActions();
    return;
  }

  if (!navigator.geolocation) {
    updateGPSBadge('na', 'GPS not supported by this browser');
    syncAttendanceActions();
    return;
  }

  updateGPSBadge('acquiring', 'Acquiring GPS location…');
  try {
    const pos = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      })
    );
    gpsCoords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    const acc = Math.round(pos.coords.accuracy);
    updateGPSBadge('ok', `GPS ready · ±${acc} m accuracy`);
  } catch (err) {
    gpsCoords = null;
    updateGPSBadge('denied', 'GPS denied — on-site check-in will be blocked');
    Toast.show('Location access denied. On-site employees must allow GPS to mark attendance.', 'warning', 7000);
  } finally {
    syncAttendanceActions();
  }
}

function captureFrame() {
  const video = document.getElementById("camera-feed");
  const canvas = document.getElementById("capture-canvas");
  if (!cameraReady || !video?.videoWidth || !video?.videoHeight) {
    throw new Error('Camera is not ready. Allow camera access and try again.');
  }
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

async function captureBurst(count = 5, intervalMs = 150) {
  const frames = [];
  for (let i = 0; i < count; i++) {
    frames.push(captureFrame());
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return frames;
}

async function performAction(action) {
  if (actionInProgress) return;
  const checkedIn = Boolean(todayAttendance?.check_in);
  const checkedOut = Boolean(todayAttendance?.check_out);
  if ((action === 'check-in' && checkedIn) || (action === 'check-out' && (!checkedIn || checkedOut))) {
    await refreshTodayStatus();
    return;
  }
  if (!cameraReady) {
    Toast.show('Camera is not ready. Allow camera access and try again.', 'warning');
    return;
  }

  const employeeId = document.getElementById("employee-id-field").value.trim();
  if (!employeeId) {
    if (typeof Toast !== 'undefined') {
      Toast.show("Employee ID is required.", "error");
    }
    return;
  }

  if (!currentUser?.is_remote && !navigator.geolocation) {
    Toast.show('Location services are required for on-site attendance.', 'error');
    return;
  }
  if (!currentUser?.is_remote && !gpsCoords) {
    Toast.show('Allow location access and wait for GPS to be ready before marking attendance.', 'warning');
    return;
  }

  const btn = document.getElementById(action === "check-in" ? "check-in-btn" : "check-out-btn");
  actionInProgress = true;
  btn.disabled = true;
  btn.textContent = "Verifying…";
  syncAttendanceActions();

  // Refresh GPS coords just before submission for accuracy
  if (!currentUser?.is_remote && navigator.geolocation) {
    try {
      const pos = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true, timeout: 8000, maximumAge: 15000
        })
      );
      gpsCoords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      updateGPSBadge('ok', `GPS ready · ±${Math.round(pos.coords.accuracy)} m`);
    } catch (_) {
      // keep last known coords or null
    }
  }

  try {
    const singleFrame = captureFrame();
    const livenessFrames = await captureBurst();

    const payload = {
      employee_id: employeeId,
      frame_base64: singleFrame,
      liveness_frames_base64: livenessFrames,
      location: currentUser?.is_remote ? "Remote" : (currentUser?.work_location || "Office"),
      latitude: gpsCoords?.latitude ?? null,
      longitude: gpsCoords?.longitude ?? null,
    };

    const result = await apiRequest(`/attendance/${action}`, { method: "POST", body: payload });
    
    if (result.success) {
      if (typeof Toast !== 'undefined') {
        Toast.show(result.message || `Checked ${action.split('-')[1]} successfully!`, "success", 6000);
      }
      await Promise.all([refreshTodayStatus(), refreshHistory()]);
    } else {
      if (typeof Toast !== 'undefined') {
        Toast.show(result.message || "Face recognition failed", "error");
      }
    }
  } catch (err) {
    if (typeof Toast !== 'undefined') {
      Toast.show(err.message, "error", 6000);
    }
  } finally {
    actionInProgress = false;
    btn.disabled = false;
    btn.textContent = action === "check-in" ? "Check In" : "Check Out";
    await refreshTodayStatus();
  }
}

function syncAttendanceActions() {
  const checkInBtn = document.getElementById('check-in-btn');
  const checkOutBtn = document.getElementById('check-out-btn');
  const note = document.getElementById('attendance-action-note');
  const retryCamera = document.getElementById('retry-camera-btn');
  if (!checkInBtn || !checkOutBtn) return;

  const hasCheckedIn = Boolean(todayAttendance?.check_in);
  const hasCheckedOut = Boolean(todayAttendance?.check_out);
  const remote = currentUser?.is_remote === true;
  const locationReady = remote || Boolean(gpsCoords);
  const canUseFace = cameraReady && locationReady;
  if (retryCamera) retryCamera.classList.toggle('hidden', cameraReady);
  const showCheckIn = attendanceStatusLoaded && !hasCheckedIn;
  const showCheckOut = attendanceStatusLoaded && hasCheckedIn && !hasCheckedOut;

  checkInBtn.classList.toggle('hidden', !showCheckIn);
  checkOutBtn.classList.toggle('hidden', !showCheckOut);
  checkInBtn.disabled = !canUseFace || actionInProgress;
  checkOutBtn.disabled = !canUseFace || actionInProgress;
  checkInBtn.title = canUseFace ? '' : (!cameraReady ? 'Allow camera access to use Face ID.' : 'Allow location access to verify your work location.');
  checkOutBtn.title = canUseFace ? '' : (!cameraReady ? 'Allow camera access to use Face ID.' : 'Allow location access to verify your work location.');

  if (!note) return;
  if (!attendanceStatusLoaded && attendanceLoadError) {
    note.replaceChildren(document.createTextNode(`Could not confirm today's attendance: ${attendanceLoadError} `));
    const retry = document.createElement('button');
    retry.type = 'button'; retry.className = 'btn btn-secondary btn-sm'; retry.textContent = 'Retry';
    retry.addEventListener('click', refreshTodayStatus, { once: true });
    note.appendChild(retry);
    return;
  }
  if (!attendanceStatusLoaded) note.textContent = 'Checking today’s attendance…';
  else if (hasCheckedOut) note.textContent = 'Your attendance for today is complete.';
  else if (hasCheckedIn) note.textContent = 'You’re checked in. Use Face ID to check out when your shift is complete.';
  else note.textContent = 'Use Face ID to check in for today.';

  if (attendanceStatusLoaded && (showCheckIn || showCheckOut) && !canUseFace) {
    note.textContent += !cameraReady
      ? ' Waiting for camera access.'
      : (remote ? '' : ' Waiting for location access.');
  }
}

async function refreshTodayStatus() {
  attendanceLoadError = '';
  syncAttendanceActions();
  try {
    const today = await apiRequest("/attendance/today");
    const container = document.getElementById("today-status-container");
    todayAttendance = today && today.status !== 'not_marked' ? today : null;
    attendanceStatusLoaded = true;
    syncAttendanceActions();
    
    if (today.status === "not_marked" || !today.check_in) {
      container.innerHTML = `
        <div style="padding:16px 0;">
          <p class="field-hint" style="margin-bottom:8px;">No attendance recorded yet today.</p>
          <div style="font-size:0.82rem;color:var(--color-ink-soft);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Check-in window opens 10 minutes prior to your shift start time.
          </div>
        </div>
      `;
      return;
    }

    const statusChip = chipHtml(today.status || 'not_marked');
                            
    container.innerHTML = `
      <table style="margin-bottom: 0;">
        <tbody>
          <tr><td style="color:var(--color-ink-soft);">Status</td><td>${statusChip}</td></tr>
          <tr><td style="color:var(--color-ink-soft);">Location</td><td>${today.location ? `<span style="font-weight:600;">${today.location}</span>` : "—"}</td></tr>
          <tr><td style="color:var(--color-ink-soft);">Check-in time</td><td>${today.check_in ? formatTime(today.check_in) : "—"}</td></tr>
          <tr><td style="color:var(--color-ink-soft);">Check-out time</td><td>${today.check_out ? formatTime(today.check_out) : "—"}</td></tr>
          <tr><td style="color:var(--color-ink-soft);">Late Minutes</td><td>${today.late_minutes ? `<span style="color:var(--color-danger);font-weight:600;">${today.late_minutes} min late</span>` : '<span style="color:var(--color-success);font-weight:600;">On Time</span>'}</td></tr>
          <tr><td style="color:var(--color-ink-soft);">Working hours</td><td>${today.working_hours != null ? today.working_hours + ' hrs' : "In Progress"}</td></tr>
          <tr><td style="color:var(--color-ink-soft);">Confidence score</td><td>${today.confidence_score != null ? (today.confidence_score * 100).toFixed(1) + '%' : "—"}</td></tr>
          <tr><td style="color:var(--color-ink-soft);">Liveness</td><td>${today.liveness_verified ? '<span class="chip chip-success">Verified</span>' : '<span class="chip chip-danger">Unverified</span>'}</td></tr>
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error("Could not load today's attendance:", err.message);
    todayAttendance = null;
    attendanceStatusLoaded = false;
    attendanceLoadError = err.message || 'Request failed';
    syncAttendanceActions();
    document.getElementById("today-status-container").innerHTML = `<p class="field-hint" style="color:var(--color-danger);">Failed to load status.</p>`;
  }
}

async function refreshHistory() {
  try {
    // Assuming history endpoint takes a limit query parameter
    const history = await apiRequest("/attendance/history?limit=7");
    const container = document.getElementById("history-container");
    
    if (!history || history.length === 0) {
      container.innerHTML = `<p class="field-hint">No recent attendance history.</p>`;
      return;
    }
    
    container.innerHTML = history.map(record => {
      const statusChipClass = record.status === 'present' ? 'chip-success' : 
                              record.status === 'late' ? 'chip-danger' : 
                              record.status === 'absent' ? 'chip-danger' : 'chip-neutral';
      return `
        <div class="mini-list-item">
          <div><strong>${record.date}</strong></div>
          <div><span class="chip ${statusChipClass}">${record.status}</span></div>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Could not load history:", err.message);
    document.getElementById("history-container").innerHTML = `<p class="field-hint" style="color:var(--color-danger);">Failed to load history.</p>`;
  }
}
