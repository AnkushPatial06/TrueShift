function initials(name) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

function roleLabel(role) {
  const labels = { admin: "Administrator", hr: "HR Manager", manager: "Manager", employee: "Employee" };
  return labels[role] || role;
}

/**
 * Resolves a full backend URL for profile photos if they are stored relatively.
 */
function getAvatarUrl(photoUrl) {
  if (!photoUrl) return null;
  const str = String(photoUrl).trim();
  if (!str || str === 'null' || str === 'undefined') return null;
  if (str.startsWith("http://") || str.startsWith("https://") || str.startsWith("data:")) {
    return str;
  }
  const backendBase = typeof API_BASE_URL !== "undefined" 
    ? API_BASE_URL.replace(/\/api\/v1\/?$/, "") 
    : "http://localhost:8000";
  return `${backendBase}${str.startsWith("/") ? "" : "/"}${str}`;
}

/**
 * Renders an avatar element: circular photo if uploaded, fallback to initials.
 * Avoids any generic placeholders or wrong mapping.
 */
function renderAvatar(userOrPhoto, fallbackName = "", extraClass = "", size = 36) {
  let photo = null;
  let name = fallbackName;
  if (typeof userOrPhoto === "object" && userOrPhoto !== null) {
    photo = userOrPhoto.profile_photo_url || userOrPhoto.photo_url || userOrPhoto.avatar_url;
    name = userOrPhoto.name || fallbackName || "";
  } else if (typeof userOrPhoto === "string") {
    photo = userOrPhoto;
  }

  const init = initials(name);
  const resolvedUrl = getAvatarUrl(photo);
  const fontSize = Math.max(10, Math.round(size * 0.38));

  if (resolvedUrl) {
    return `
      <div class="avatar-container ${extraClass}" style="width:${size}px; height:${size}px; min-width:${size}px; border-radius:50%; overflow:hidden; display:inline-flex; align-items:center; justify-content:center; background:var(--color-surface-subtle); border:1px solid var(--color-border); position:relative; vertical-align:middle;">
        <img src="${resolvedUrl}" alt="${name || 'Employee'}" class="avatar-img" style="width:100%; height:100%; object-fit:cover; display:block;" onerror="this.onerror=null; this.parentElement.innerHTML='<span class=\\'avatar-fallback\\' style=\\'font-weight:600; font-size:${fontSize}px; color:var(--color-primary);\\'>${init}</span>';" />
      </div>
    `.trim();
  }

  return `
    <div class="avatar-container ${extraClass}" style="width:${size}px; height:${size}px; min-width:${size}px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; background:var(--color-primary-soft); color:var(--color-primary); font-weight:600; font-size:${fontSize}px; border:1px solid var(--color-border); user-select:none; vertical-align:middle;">
      <span>${init}</span>
    </div>
  `.trim();
}

/**
 * Sets avatar into an existing DOM element (e.g. #topbar-avatar or #sidebar-avatar)
 */
function setAvatarElement(elementOrId, userOrPhoto, fallbackName = "", size = 38) {
  const el = typeof elementOrId === "string" ? document.getElementById(elementOrId) : elementOrId;
  if (!el) return;

  let photo = null;
  let name = fallbackName;
  if (typeof userOrPhoto === "object" && userOrPhoto !== null) {
    photo = userOrPhoto.profile_photo_url || userOrPhoto.photo_url || userOrPhoto.avatar_url;
    name = userOrPhoto.name || fallbackName || "";
  } else if (typeof userOrPhoto === "string") {
    photo = userOrPhoto;
  }

  const init = initials(name);
  const resolvedUrl = getAvatarUrl(photo);
  const fontSize = Math.max(10, Math.round(size * 0.38));

  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.minWidth = `${size}px`;
  el.style.borderRadius = "50%";
  el.style.overflow = "hidden";
  el.style.display = "inline-flex";
  el.style.alignItems = "center";
  el.style.justifyContent = "center";
  el.style.border = "1px solid var(--color-border)";
  el.style.verticalAlign = "middle";

  if (resolvedUrl) {
    el.innerHTML = `<img src="${resolvedUrl}" alt="${name || 'Avatar'}" style="width:100%; height:100%; object-fit:cover; display:block;" onerror="this.onerror=null; this.parentElement.innerHTML='<span style=\\'font-weight:600; font-size:${fontSize}px; color:var(--color-primary);\\'>${init}</span>';" />`;
  } else {
    el.style.background = "var(--color-primary-soft)";
    el.style.color = "var(--color-primary)";
    el.innerHTML = `<span style="font-weight:600; font-size:${fontSize}px;">${init}</span>`;
  }
}

function showAlert(containerId, message, type = "error") {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.textContent = message;
  el.className = `alert alert-${type}`;
  el.classList.remove("hidden");
}

function hideAlert(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.classList.add("hidden");
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}

function formatDuration(minutes) {
  if (typeof minutes !== "number") return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = (new Date() - new Date(iso)) / 1000;
  if (diff < 60) return "Just now";
  const min = Math.floor(diff / 60);
  if (min < 60) return `${min} minute${min !== 1 ? "s" : ""} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr !== 1 ? "s" : ""} ago`;
  const d = Math.floor(hr / 24);
  return `${d} day${d !== 1 ? "s" : ""} ago`;
}

/**
 * Standardized status badge according to HR Visual Standards:
 * Present -> Green
 * Absent -> Red
 * Late -> Amber
 * On Leave -> Blue
 * Half Day -> Purple
 */
function chipHtml(status) {
  const s = String(status || "").toLowerCase().trim();
  let type = "neutral";
  let text = status;

  if (["active", "approved", "present", "completed"].includes(s)) {
    type = "success"; // Green
  } else if (["rejected", "absent", "failed", "cancelled", "inactive"].includes(s)) {
    type = "danger"; // Red
  } else if (["pending", "late"].includes(s)) {
    type = "warning"; // Amber
  } else if (["half_day", "half day"].includes(s)) {
    type = "purple"; // Purple
  } else if (["work_from_home", "remote"].includes(s)) {
    type = "teal";
  } else if (["leave", "on_leave", "on leave"].includes(s)) {
    type = "info"; // Blue
  }

  if (s === "work_from_home") text = "WFH";
  else if (s === "half_day") text = "Half Day";
  else if (s === "on_leave") text = "On Leave";
  else if (s) text = text.charAt(0).toUpperCase() + text.slice(1).replace(/_/g, " ");

  return `<span class="chip chip-${type}">${text}</span>`;
}

function formatTime(dateInput) {
  let iso = dateInput;
  if (typeof iso === "string" && !iso.endsWith("Z") && !iso.includes("+")) {
    iso += "Z";
  }
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function homeUrlForRole(role) {
  return role === "employee" ? "portal.html" : "dashboard.html";
}

function requireRole(allowedRoles) {
  requireAuth();
  const user = TokenStore.getUser();
  if (user && !allowedRoles.includes(user.role)) {
    window.location.href = homeUrlForRole(user.role);
  }
}

function fixBackLink() {
  const link = document.getElementById("back-home-link");
  const user = TokenStore.getUser();
  if (link && user) {
    link.href = homeUrlForRole(user.role);
  }
}