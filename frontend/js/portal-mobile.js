let currentCheckInTime = null;
let liveHoursInterval = null;
let portalTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let scheduledShiftEnd = null;
let scheduledShiftStart = null;
let shiftBreakMinutes = 0;

document.addEventListener("DOMContentLoaded", async () => {
  requireRole(["employee", "manager", "admin", "hr"]);

  try {
    const me = await apiRequest("/auth/me");
    TokenStore.setUser(me);
    
    // Init Sidebar for Desktop
    if (typeof Sidebar !== 'undefined') Sidebar.init('dashboard');
    if (typeof NotificationCenter !== 'undefined') {
      NotificationCenter.init('notif-bell-btn'); // Desktop
      NotificationCenter.init('notif-bell-btn-mobile'); // Mobile
    }

    // Set Header Avatars (Desktop & Mobile)
    setAvatarElement('topbar-avatar', me);
    setAvatarElement('portal-avatar-mobile', me);
    const mobileAvatar = document.getElementById("portal-avatar-mobile");
    if (mobileAvatar && !mobileAvatar.querySelector(".avatar-dot")) {
      const dot = document.createElement("div");
      dot.className = "avatar-dot";
      mobileAvatar.appendChild(dot);
    }
    
    // Set desktop topbar info
    const desktopName = document.getElementById("topbar-name");
    if(desktopName) desktopName.textContent = me.name;
    const desktopRole = document.getElementById("topbar-role");
    if(desktopRole) desktopRole.textContent = me.role.charAt(0).toUpperCase() + me.role.slice(1);
    
    // Desktop Clock
    const desktopClock = document.getElementById("desktop-clock");
    const updateDesktopClock = () => {
      if (desktopClock) desktopClock.textContent = new Intl.DateTimeFormat('en-US', {
        timeZone: portalTimezone, hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
      }).format(new Date());
    };
    updateDesktopClock();
    setInterval(updateDesktopClock, 1000);
    
    // Set Greeting
    const hour = new Date().getHours();
    let greeting = "Good evening";
    if (hour < 12) greeting = "Good morning";
    else if (hour < 18) greeting = "Good afternoon";
    
    document.getElementById("greeting-text").textContent = greeting;
    document.getElementById("greeting-name").textContent = me.name.split(" ")[0];
    
    // Set Date
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    document.getElementById("current-date-text").textContent = new Date().toLocaleDateString('en-US', options);

    // Load the dashboard timezone first so greeting, clock, and date share the
    // same configured zone as attendance calculations.
    let dashboardData = null;
    try {
      dashboardData = await apiRequest("/analytics/my-dashboard");
      if (dashboardData?.timezone) portalTimezone = dashboardData.timezone;
    } catch (err) {
      console.error("Shift and timezone data unavailable", err);
    }
    const localizedNow = new Date();
    const localizedHour = Number(new Intl.DateTimeFormat('en-US', {timeZone: portalTimezone, hour: 'numeric', hourCycle: 'h23'}).format(localizedNow));
    document.getElementById("greeting-text").textContent = localizedHour < 12 ? "Good morning" : localizedHour < 18 ? "Good afternoon" : "Good evening";
    document.getElementById("current-date-text").textContent = new Intl.DateTimeFormat('en-US', {
      timeZone: portalTimezone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(localizedNow);

    // Run loaders in parallel after the timezone is known.
    await Promise.all([
      loadTodayStatus(),
      loadHistoryAndTelemetry(),
      loadShiftInfo(dashboardData)
    ]);

  } catch (err) {
    console.error("Portal initialization failed:", err);
  }
});

async function loadTodayStatus() {
  try {
    const today = await apiRequest("/attendance/today");
    const pill1 = document.getElementById("status-pill-1");
    const pill2 = document.getElementById("status-pill-2");
    const timeDisplay = document.getElementById("live-time");
    const actionBtn = document.getElementById("action-btn");
    
    if (today.status === "not_marked" || !today.check_in) {
      pill1.textContent = "Not checked in yet";
      pill1.className = "pill gray red-dot";
      pill2.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Shift inactive';
      timeDisplay.innerHTML = formatClockMarkup(new Date());
      setInterval(() => { timeDisplay.innerHTML = formatClockMarkup(new Date()); }, 1000);
      
      actionBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 0 0-10 10 10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><path d="M12 6v6l4 2"/></svg> Go to Check-In &rarr;';
      actionBtn.onclick = () => window.location.href = 'attendance.html';
      
    } else if (today.check_in && !today.check_out) {
      currentCheckInTime = new Date(today.check_in);
      pill1.textContent = "Checked In";
      pill1.className = "pill gray";
      
      const diffMins = Math.floor((new Date() - currentCheckInTime) / 60000);
      pill2.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Shift started ${diffMins}m ago`;
      
      actionBtn.innerHTML = 'Check Out &rarr;';
      actionBtn.style.background = '#059669'; // Green button when active
      actionBtn.onclick = () => window.location.href = 'attendance.html';
      
      updateLiveClock();
      if(liveHoursInterval) clearInterval(liveHoursInterval);
      liveHoursInterval = setInterval(updateLiveClock, 1000);
      
    } else {
      pill1.textContent = "Shift Completed";
      pill1.className = "pill gray";
      pill2.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> ${Number(today.working_hours || 0).toFixed(1)} hrs total`;
      timeDisplay.innerHTML = formatClockMarkup(new Date());
      setInterval(() => { timeDisplay.innerHTML = formatClockMarkup(new Date()); }, 1000);
      
      actionBtn.innerHTML = 'View Record &rarr;';
      actionBtn.style.background = '#4B5563';
      actionBtn.onclick = () => window.location.href = 'attendance.html';
    }
  } catch(e) {
    console.error("Status load failed", e);
    const status = document.getElementById("status-pill-1");
    const shift = document.getElementById("hero-pill-status");
    const boundary = document.getElementById("checkin-boundary");
    if (status) status.textContent = "Attendance status unavailable";
    if (shift) shift.textContent = "Could not load shift status";
    if (boundary) boundary.textContent = "Attendance status could not be loaded. Please retry or visit Attendance.";
  }
}

function updateLiveClock() {
    const now = new Date();
    document.getElementById("live-time").innerHTML = formatClockMarkup(now);
    
    if (currentCheckInTime) {
       const diffMins = Math.floor((now - currentCheckInTime) / 60000);
       document.getElementById("status-pill-2").innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Shift started ${diffMins}m ago`;
       
       // Update Shift Progress Box
       const elapsedHours = Math.floor(diffMins / 60);
       const elapsedMins = diffMins % 60;
       const progressTimeEl = document.getElementById("progress-time");
       if(progressTimeEl) progressTimeEl.innerHTML = `${elapsedHours}h ${elapsedMins}m <span>elapsed</span>`;
       
       const totalGoalMins = scheduledShiftStart && scheduledShiftEnd
         ? Math.max(0, (scheduledShiftEnd - scheduledShiftStart) / 60000 - shiftBreakMinutes)
         : 0;
       let percent = totalGoalMins ? (diffMins / totalGoalMins) * 100 : 0;
       if (percent > 100) percent = 100;
       const barFill = document.getElementById("progress-bar-fill");
       if(barFill) barFill.style.width = `${percent}%`;
       
       const eodEl = document.getElementById("progress-eod");
       if(eodEl) eodEl.textContent = scheduledShiftEnd ? formatTimeOnly(scheduledShiftEnd) : '—';
       
       const remainingMins = Math.max(0, (scheduledShiftEnd ? (scheduledShiftEnd - now) / 60000 : totalGoalMins - diffMins));
       const remHours = Math.floor(remainingMins / 60);
       const remMins = remainingMins % 60;
       const remEl = document.getElementById("progress-remaining");
       if(remEl) remEl.textContent = `${remHours}h ${remMins}m`;
    }
}

function formatLiveTime(date) {
    return new Intl.DateTimeFormat('en-US', {timeZone: portalTimezone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true}).format(date).replace(/\s[AP]M$/, '');
}

function formatAmPmOnly(date) {
    return new Intl.DateTimeFormat('en-US', {timeZone: portalTimezone, hour: 'numeric', hour12: true}).format(date).replace(/[0-9\s]/g, '');
}

function formatClockMarkup(date) {
    return `<div>${formatLiveTime(date)}</div><div style="font-size:24px;">${formatAmPmOnly(date)}</div>`;
}

function formatTimeOnly(date) {
    return new Intl.DateTimeFormat('en-US', {timeZone: portalTimezone, hour: '2-digit', minute: '2-digit', hour12: true}).format(date);
}
async function loadHistoryAndTelemetry() {
  try {
    const history = await apiRequest("/attendance/history?limit=30");
    if (!Array.isArray(history)) throw new Error("Attendance history response is not a list");
    
    // Sort descending by date
    history.sort((a,b) => new Date(b.date) - new Date(a.date));
    
    // Calculate Telemetry
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let leaveCount = 0;
    
    const recordedWorkDays = history.filter(r => ['present', 'late', 'half_day', 'absent'].includes(r.status)).length;
    
    for (const rec of history) {
      if (['present', 'late', 'half_day'].includes(rec.status)) presentCount++;
      if (rec.status === 'late') lateCount++;
      if (rec.status === 'absent') absentCount++;
      if (rec.status === 'leave') leaveCount++;
    }
    
    const arrivalRecords = history.filter(r => ['present', 'late'].includes(r.status)).length;
    const attendRate = recordedWorkDays ? Math.round((presentCount / recordedWorkDays) * 100) : null;
    const onTimeRate = arrivalRecords ? Math.round(((arrivalRecords - lateCount) / arrivalRecords) * 100) : null;
    
    // Update Telemetry UI
    document.getElementById("stat-attendance-rate").textContent = attendRate === null ? '—' : `${attendRate}%`;
    document.getElementById("stat-late-count").textContent = `${lateCount}`;
    document.getElementById("stat-days-present").textContent = `${presentCount} / ${recordedWorkDays} recorded work days`;
    document.getElementById("stat-ontime").textContent = onTimeRate === null ? '—' : `${onTimeRate}%`;
    document.getElementById("stat-absent-count").textContent = `${absentCount} day${absentCount === 1 ? '' : 's'}`;
    const validCheckIns = history.map(r => r.check_in ? new Date(r.check_in) : null).filter(d => d && !Number.isNaN(d.getTime()));
    document.getElementById("stat-average-entry").textContent = validCheckIns.length
      ? new Intl.DateTimeFormat('en-US', {timeZone: portalTimezone, hour: 'numeric', minute: '2-digit'}).format(new Date(validCheckIns.reduce((sum, d) => sum + d.getTime(), 0) / validCheckIns.length))
      : 'No check-ins';
    
    // Render 30-Day Matrix Grid
    const matrixGrid = document.getElementById("matrix-grid");
    let mapData = history.slice(0, 30).reverse(); // only recorded days; no synthetic dates
    
    matrixGrid.innerHTML = mapData.map((d, index) => {
        let cls = 'gray'; // Default rest/none
        if(d.status === 'present' || d.status === 'late') cls = 'green';
        else if(d.status === 'leave') cls = 'blue';
        else if(d.status === 'absent') cls = 'red';
        
        let displayDay = '—';
        if(d.date !== '---') {
            const dayNum = Number(String(d.date).slice(-2));
            displayDay = dayNum < 10 ? '0'+dayNum : dayNum;
        }
        
        let bgColor = '#F1F5F9';
        if (cls === 'green') bgColor = '#F0FDF4';
        else if (cls === 'blue') bgColor = '#EFF6FF';
        else if (cls === 'red') bgColor = '#FEF2F2';
        
        let dotColor = '#94A3B8';
        if (cls === 'green') dotColor = '#10B981';
        else if (cls === 'blue') dotColor = '#3B82F6';
        else if (cls === 'red') dotColor = '#EF4444';

        return `<div class="m-cell" style="background:${bgColor}; color:#0B1830; flex-direction:column; gap:4px; padding-top:4px;">
            <span style="font-size:10px; font-weight:700;">${displayDay}</span>
            <div style="width:4px; height:4px; border-radius:50%; background:${dotColor};"></div>
        </div>`;
    }).join("");
    
    if(mapData.length && mapData[0].date && mapData[mapData.length - 1].date) {
       const formatDateOnly = (value, opts) => new Intl.DateTimeFormat('en-US', {...opts, timeZone: 'UTC'}).format(new Date(`${value}T12:00:00Z`));
       const d1 = formatDateOnly(mapData[0].date, {month:'short', day:'numeric'});
       const d2 = formatDateOnly(mapData[mapData.length - 1].date, {month:'short', day:'numeric', year:'numeric'});
       document.getElementById("matrix-subtitle").textContent = `${d1} - ${d2}`;
    } else {
       document.getElementById("matrix-subtitle").textContent = 'No attendance records are available yet.';
       matrixGrid.innerHTML = '<div class="empty-state">Attendance history will appear here after records are available.</div>';
    }

  } catch (err) {
    console.error("Failed to load history", err);
    const matrix = document.getElementById("matrix-grid");
    const subtitle = document.getElementById("matrix-subtitle");
    if (matrix) matrix.innerHTML = '<div class="empty-state">Attendance history could not be loaded. Please refresh to retry.</div>';
    if (subtitle) subtitle.textContent = "Attendance history unavailable";
    ["stat-attendance-rate", "stat-late-count", "stat-days-present", "stat-ontime", "stat-absent-count", "stat-average-entry"].forEach(id => {
      const node = document.getElementById(id);
      if (node) node.textContent = "—";
    });
  }
}

async function loadShiftInfo(dashData = null) {
  try {
    const dash = dashData || await apiRequest("/analytics/my-dashboard");
    
    // --- Shift Timing (real, from DB) ---
    portalTimezone = dash.timezone || portalTimezone;
    scheduledShiftStart = dash.scheduled_shift_start ? new Date(dash.scheduled_shift_start) : null;
    scheduledShiftEnd = dash.scheduled_shift_end ? new Date(dash.scheduled_shift_end) : null;
    shiftBreakMinutes = Number(dash.shift_break_duration_minutes || 0);
    const shiftStart = dash.shift_start_time;
    const shiftEnd = dash.shift_end_time;
    
    function fmt24to12(t) {
      if (!t) return t;
      const [h, m] = t.split(":").map(Number);
      const ampm = h >= 12 ? "PM" : "AM";
      const h12  = h % 12 || 12;
      return `${String(h12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`;
    }
    
    const assignedHours = shiftStart && shiftEnd ? `${fmt24to12(shiftStart)} – ${fmt24to12(shiftEnd)} (${portalTimezone})` : null;
    const shiftTimeDisplay = !assignedHours ? 'No shift assigned' : dash.shift_assigned === false
      ? `Default attendance schedule: ${assignedHours}` : assignedHours;
    document.getElementById("shift-time-range").textContent = shiftTimeDisplay;
    
    // --- Location (HR-assigned, from DB; remote workers skip geofencing) ---
    const location = dash.work_location || "Location not assigned";
    const isRemote = dash.is_remote || false;
    const locationLabel = isRemote ? "Remote Worker" : `Assigned Location: ${location}`;
    const locationEl = document.getElementById("shift-location");
    if (locationEl) locationEl.textContent = locationLabel;
    
    // --- Live Shift Status Pill (real-time, not hardcoded) ---
    const pillStatus = document.getElementById("hero-pill-status");
    const pillLocation = document.getElementById("hero-pill-location");
    
    const now = new Date();
    let shiftActive = dash.shift_active || false;
    
    // Calculate shift active status client-side too for reliability
    if (dash.checkin_window_opens && dash.checkin_window_closes) {
      const winOpen  = new Date(dash.checkin_window_opens);
      const winClose = new Date(dash.checkin_window_closes);
      shiftActive = now >= winOpen && now <= winClose;
      const boundary = document.getElementById('checkin-boundary');
      const updateBoundary = (at) => {
        if (!boundary) return;
        boundary.textContent = at < winOpen
          ? `Check-in opens ${formatTimeOnly(winOpen)} (${portalTimezone}).`
          : at <= winClose ? `Check-in is available until ${formatTimeOnly(winClose)} (${portalTimezone}).`
          : `The check-in window closed at ${formatTimeOnly(winClose)} (${portalTimezone}).`;
      };
      updateBoundary(now);
      
      // Update pill every minute to keep real-time
      setInterval(() => {
        const n = new Date();
        const active = n >= winOpen && n <= winClose;
        updateBoundary(n);
        if (pillStatus) {
          if (active) {
            pillStatus.innerHTML = `<span style="background:#3B82F6;width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:4px;"></span> Check-in window open`;
            pillStatus.style.background = "#DBEAFE";
            pillStatus.style.color = "#1E3A8A";
          } else if (n < winOpen) {
            const minsUntil = Math.floor((winOpen - n) / 60000);
            pillStatus.innerHTML = `<span style="background:#F59E0B;width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:4px;"></span> Shift starts in ${minsUntil}m`;
            pillStatus.style.background = "#FEF3C7";
            pillStatus.style.color = "#92400E";
          } else {
            pillStatus.innerHTML = `<span style="background:#6B7280;width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:4px;"></span> Shift ended`;
            pillStatus.style.background = "#F1F5F9";
            pillStatus.style.color = "#475569";
          }
        }
      }, 60000);
    }
    
    // Set initial pill state
    if (pillStatus) {
      if (shiftActive && dash.checkin_window_opens) {
        const winOpen = new Date(dash.checkin_window_opens);
        pillStatus.innerHTML = `<span style="background:#3B82F6;width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:4px;"></span> Check-in window open`;
        pillStatus.style.background = "#DBEAFE";
        pillStatus.style.color = "#1E3A8A";
      } else if (dash.checkin_window_opens && now < new Date(dash.checkin_window_opens)) {
        const minsUntil = Math.floor((new Date(dash.checkin_window_opens) - now) / 60000);
        pillStatus.innerHTML = `<span style="background:#F59E0B;width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:4px;"></span> Shift starts in ${minsUntil}m`;
        pillStatus.style.background = "#FEF3C7";
        pillStatus.style.color = "#92400E";
      } else {
        pillStatus.innerHTML = `<span style="background:#6B7280;width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:4px;"></span> Shift inactive`;
        pillStatus.style.background = "#F1F5F9";
        pillStatus.style.color = "#475569";
      }
    }
    
    // Location pill
    if (pillLocation) {
      const locIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>`;
      pillLocation.innerHTML = locIcon + (isRemote ? "Remote Worker — No Geofencing" : location);
    }
    
    // --- Upcoming Shifts Panel ---
    const boundary = document.getElementById('checkin-boundary');
    if (boundary && (!dash.checkin_window_opens || !dash.checkin_window_closes)) {
      boundary.textContent = 'No shift window is available. Contact HR if a shift should be assigned.';
    }
    const clockNode = document.getElementById('desktop-clock');
    if (clockNode) clockNode.textContent = new Intl.DateTimeFormat('en-US', {
      timeZone: portalTimezone, hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short'
    }).format(new Date());

    const upcomingContainer = document.getElementById("upcoming-shifts");
    if (upcomingContainer) {
      const rosterMessage = dash.shift_assigned === false
        ? 'No shift is assigned. The displayed default attendance schedule is currently in effect.'
        : 'Scheduled shift dates are available in the roster.';
      upcomingContainer.innerHTML = `<div class="empty-state">${rosterMessage}</div>`;
    }
    
  } catch (err) {
    console.error("Failed to load shift info", err);
    // Show fallback
    const pillStatus = document.getElementById("hero-pill-status");
    if (pillStatus) pillStatus.textContent = "Shift info unavailable";
    const boundary = document.getElementById("checkin-boundary");
    if (boundary) boundary.textContent = "Shift details could not be loaded. Please refresh or contact HR.";
  }
}

