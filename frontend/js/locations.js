/**
 * locations.js — Work Locations management page
 * Admin / HR only; enforces role check on page load.
 */

let editingId = null;
let allLocations = [];

document.addEventListener("DOMContentLoaded", async () => {
  requireAuth();
  const user = TokenStore.getUser();

  // Only admin/hr can access this page
  if (!user || !["admin", "hr"].includes(user.role)) {
    Toast.show("Access denied. This page is for HR and Admin only.", "error");
    setTimeout(() => { window.location.href = "dashboard.html"; }, 1500);
    return;
  }

  Sidebar.init("locations");
  setAvatarElement("topbar-avatar", user);
  NotificationCenter.init("notif-bell-btn");

  await loadLocations();

  document.getElementById("add-location-btn").addEventListener("click", openAddModal);
  document.getElementById("modal-cancel-btn").addEventListener("click", closeModal);
  document.getElementById("modal-save-btn").addEventListener("click", saveLocation);
  document.getElementById("capture-gps-btn").addEventListener("click", captureCurrentGPS);

  // Close modal on overlay click
  document.getElementById("location-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("location-modal")) closeModal();
  });
});

async function loadLocations() {
  try {
    allLocations = await apiRequest("/locations");
    renderGrid();
    updateStats();
  } catch (err) {
    Toast.show("Failed to load locations: " + err.message, "error");
  }
}

function updateStats() {
  const total = allLocations.length;
  const active = allLocations.filter((l) => l.is_active).length;
  const avgRadius = total
    ? Math.round(allLocations.reduce((s, l) => s + l.radius_meters, 0) / total)
    : 0;

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-active").textContent = active;
  document.getElementById("stat-radius").textContent = total ? `${avgRadius} m` : "—";
}

function statusBadge(isActive) {
  return isActive
    ? `<span class="chip chip-success">Active</span>`
    : `<span class="chip chip-neutral">Inactive</span>`;
}

function renderGrid() {
  const grid = document.getElementById("location-grid");

  if (!allLocations.length) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1;">
        <div class="empty-state-icon">📍</div>
        <div class="empty-state-title">No work locations defined yet</div>
        <p>Add your first office location to enable GPS-based attendance for on-site employees.</p>
        <button class="btn btn-primary" onclick="openAddModal()">+ Add First Location</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = allLocations
    .map(
      (loc) => `
    <div class="location-card">
      <div class="map-preview">
        <div class="map-pin-pulse"></div>
      </div>
      <div class="location-card-header">
        <div>
          <div class="location-name">${escHtml(loc.name)}</div>
          ${loc.address ? `<div class="location-address">${escHtml(loc.address)}</div>` : ""}
        </div>
        ${statusBadge(loc.is_active)}
      </div>
      <div class="location-meta">
        <div class="location-meta-item">
          <span class="location-meta-label">Latitude</span>
          <span class="location-meta-value">${loc.latitude.toFixed(5)}</span>
        </div>
        <div class="location-meta-item">
          <span class="location-meta-label">Longitude</span>
          <span class="location-meta-value">${loc.longitude.toFixed(5)}</span>
        </div>
        <div class="location-meta-item">
          <span class="location-meta-label">Geofence Radius</span>
          <span class="location-meta-value">${loc.radius_meters} m</span>
        </div>
        <div class="location-meta-item">
          <span class="location-meta-label">Added</span>
          <span class="location-meta-value">${formatDate(loc.created_at)}</span>
        </div>
      </div>
      <div class="location-actions">
        <button class="btn btn-secondary" style="flex:1;font-size:0.82rem;" onclick="openEditModal(${loc.id})">✏️ Edit</button>
        <button class="btn" style="flex:1;font-size:0.82rem;background:var(--color-danger-light,#fef2f2);color:var(--color-danger);border:1px solid var(--color-danger-light,#fecaca);" onclick="deleteLocation(${loc.id}, '${escHtml(loc.name)}')">🗑 Delete</button>
      </div>
    </div>
  `
    )
    .join("");
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// ── Modal helpers ──────────────────────────────────────────────────────────────
function openAddModal() {
  editingId = null;
  document.getElementById("modal-title").textContent = "Add Work Location";
  document.getElementById("loc-name").value = "";
  document.getElementById("loc-address").value = "";
  document.getElementById("loc-lat").value = "";
  document.getElementById("loc-lng").value = "";
  document.getElementById("loc-radius").value = "150";
  document.getElementById("loc-active").checked = true;
  document.getElementById("active-toggle-wrap").style.display = "none";
  document.getElementById("gps-capture-status").textContent = "";
  document.getElementById("location-modal").classList.add("active");
}

function openEditModal(id) {
  const loc = allLocations.find((l) => l.id === id);
  if (!loc) return;
  editingId = id;
  document.getElementById("modal-title").textContent = "Edit Work Location";
  document.getElementById("loc-name").value = loc.name;
  document.getElementById("loc-address").value = loc.address || "";
  document.getElementById("loc-lat").value = loc.latitude;
  document.getElementById("loc-lng").value = loc.longitude;
  document.getElementById("loc-radius").value = loc.radius_meters;
  document.getElementById("loc-active").checked = loc.is_active;
  document.getElementById("active-toggle-wrap").style.display = "block";
  document.getElementById("gps-capture-status").textContent = "";
  document.getElementById("location-modal").classList.add("active");
}

function closeModal() {
  document.getElementById("location-modal").classList.remove("active");
  editingId = null;
}

async function captureCurrentGPS() {
  const btn = document.getElementById("capture-gps-btn");
  const status = document.getElementById("gps-capture-status");
  if (!navigator.geolocation) {
    status.textContent = "Geolocation not supported by this browser.";
    return;
  }
  btn.textContent = "⏳ Acquiring…";
  btn.disabled = true;
  try {
    const pos = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
      })
    );
    document.getElementById("loc-lat").value = pos.coords.latitude.toFixed(7);
    document.getElementById("loc-lng").value = pos.coords.longitude.toFixed(7);
    status.textContent = `📍 GPS captured — ±${Math.round(pos.coords.accuracy)} m accuracy`;
    status.style.color = "var(--color-success, #16a34a)";
  } catch (err) {
    status.textContent = "GPS unavailable. Please enter coordinates manually.";
    status.style.color = "var(--color-danger)";
  } finally {
    btn.textContent = "📍 Use My Current GPS";
    btn.disabled = false;
  }
}

async function saveLocation() {
  const name = document.getElementById("loc-name").value.trim();
  const address = document.getElementById("loc-address").value.trim();
  const latitude = parseFloat(document.getElementById("loc-lat").value);
  const longitude = parseFloat(document.getElementById("loc-lng").value);
  const radius_meters = parseInt(document.getElementById("loc-radius").value);
  const is_active = document.getElementById("loc-active").checked;

  if (!name) { Toast.show("Location name is required.", "error"); return; }
  if (isNaN(latitude) || isNaN(longitude)) { Toast.show("Valid latitude and longitude are required.", "error"); return; }
  if (isNaN(radius_meters) || radius_meters < 10) { Toast.show("Radius must be at least 10 metres.", "error"); return; }

  const payload = { name, latitude, longitude, radius_meters };
  if (address) payload.address = address;

  const saveBtn = document.getElementById("modal-save-btn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving…";

  try {
    if (editingId) {
      payload.is_active = is_active;
      await apiRequest(`/locations/${editingId}`, { method: "PATCH", body: payload });
      Toast.show("Location updated successfully.", "success");
    } else {
      await apiRequest("/locations", { method: "POST", body: payload });
      Toast.show("Location created successfully.", "success");
    }
    closeModal();
    await loadLocations();
  } catch (err) {
    Toast.show(err.message || "Failed to save location.", "error");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Location";
  }
}

async function deleteLocation(id, name) {
  if (!confirm(`Delete location "${name}"?\n\nThis will not affect employees already assigned to this location name — their check-ins will bypass geofencing until reassigned.`)) return;
  try {
    await apiRequest(`/locations/${id}`, { method: "DELETE" });
    Toast.show(`"${name}" deleted.`, "success");
    await loadLocations();
  } catch (err) {
    Toast.show(err.message || "Failed to delete location.", "error");
  }
}
