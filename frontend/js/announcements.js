let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();
  currentUser = TokenStore.getUser();
  if (currentUser) {
    setAvatarElement('topbar-avatar', currentUser);
    if (['admin', 'hr'].includes(currentUser.role)) {
      document.getElementById('admin-actions').classList.remove('hidden');
    }
  }
  if (window.Sidebar) Sidebar.init('announcements');
  if (window.NotificationCenter) NotificationCenter.init('notif-bell-btn');
  await loadAnnouncements();
});

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(dateString) {
  if (!dateString) return '';
  const diff = (new Date() - new Date(dateString)) / 1000;
  if (diff < 60) return 'just now';
  const min = Math.floor(diff / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d === 1) return 'yesterday';
  return `${d} days ago`;
}

// Keep a reference to announcement data for editing
const annStore = {};

async function loadAnnouncements() {
  const container = document.getElementById('announcements-list');
  container.innerHTML = `<div style="padding:32px; text-align:center; color:var(--color-ink-soft);"><div class="spinner" style="margin:0 auto 12px;"></div><div>Loading...</div></div>`;
  try {
    const announcements = await apiRequest('/announcements');
    announcements.forEach(a => { annStore[a.id] = a; });
    if (!announcements || announcements.length === 0) {
      container.innerHTML = `<div style="padding:60px 24px; text-align:center;"><div style="font-size:3rem;margin-bottom:16px;">📢</div><div style="font-size:1.1rem;font-weight:600;margin-bottom:8px;">No announcements yet</div><div style="color:var(--color-ink-soft);font-size:0.9rem;">${['admin','hr'].includes(currentUser?.role) ? 'Use the <strong>New Announcement</strong> button to post one.' : 'Check back later for updates from HR.'}</div></div>`;
      return;
    }
    const isAdmin = ['admin', 'hr'].includes(currentUser?.role);
    container.innerHTML = announcements.map(ann => `
      <div class="announcement-card ${ann.is_pinned ? 'pinned' : ''}">
        <div class="announcement-header">
          <div class="announcement-title">${ann.is_pinned ? '📌 ' : ''}${escHtml(ann.title)}</div>
          <div style="display:flex;align-items:center;gap:8px;">
            ${ann.is_pinned ? '<span class="chip chip-info" style="font-size:0.72rem;">Pinned</span>' : ''}
            <span style="font-size:0.8rem;color:var(--color-ink-soft);">${timeAgo(ann.created_at)}</span>
          </div>
        </div>
        <div class="announcement-body">${escHtml(ann.body)}</div>
        <div class="announcement-footer">
          <div>Posted by <strong>${escHtml(ann.author_name || 'HR')}</strong> · ${new Date(ann.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>
          ${isAdmin ? `<div class="announcement-actions"><button class="btn btn-secondary btn-sm" onclick="openEditModal(${ann.id})">Edit</button><button class="btn btn-danger btn-sm" onclick="deleteAnnouncement(${ann.id})">Delete</button></div>` : ''}
        </div>
      </div>`).join('');
  } catch(err) {
    container.innerHTML = `<div style="padding:40px;text-align:center;"><div style="font-size:2rem;margin-bottom:12px;">⚠️</div><div style="font-weight:600;margin-bottom:8px;">Failed to load announcements</div><div style="color:var(--color-ink-soft);font-size:0.88rem;margin-bottom:16px;">${err.message||'Network error'}</div><button class="btn btn-secondary" onclick="loadAnnouncements()">Retry</button></div>`;
  }
}

function buildAnnModal(id, isEdit, ann) {
  document.getElementById(id)?.remove();
  const el = document.createElement('div');
  el.id = id;
  el.className = 'modal-backdrop';
  el.innerHTML = `
    <div class="modal" style="max-width:520px;" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">${isEdit ? 'Edit Announcement' : 'New Announcement'}</div>
        <button class="modal-close" onclick="Modal.close('${id}')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        </button>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:6px;">Title *</label>
          <input type="text" id="${id}-title" placeholder="Announcement title" value="${isEdit ? escHtml(ann.title) : ''}" style="width:100%;padding:10px 12px;border:1px solid var(--color-border);border-radius:var(--radius-sm);font-family:var(--font-body);font-size:0.9rem;" />
        </div>
        <div>
          <label style="display:block;font-size:0.85rem;font-weight:600;margin-bottom:6px;">Content *</label>
          <textarea id="${id}-body" rows="5" placeholder="Write your announcement here..." style="width:100%;padding:10px 12px;border:1px solid var(--color-border);border-radius:var(--radius-sm);font-family:var(--font-body);resize:vertical;">${isEdit ? escHtml(ann.body) : ''}</textarea>
        </div>
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
          <input type="checkbox" id="${id}-pinned" ${isEdit && ann.is_pinned ? 'checked' : ''} style="width:16px;height:16px;" />
          <span style="font-size:0.9rem;">📌 Pin this announcement to the top</span>
        </label>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="Modal.close('${id}')">Cancel</button>
        <button class="btn btn-primary" onclick="saveAnnouncement('${id}', ${isEdit}, ${isEdit ? ann.id : 'null'})">${isEdit ? 'Save Changes' : 'Post Announcement'}</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  el.addEventListener('click', e => { if (e.target === el) Modal.close(id); });
  setTimeout(() => el.classList.add('open'), 10);
}

window.openCreateModal = function() {
  buildAnnModal('ann-create-modal', false, null);
};

window.openEditModal = function(annId) {
  const ann = annStore[annId];
  if (!ann) { Toast.show('Announcement not found', 'error'); return; }
  buildAnnModal('ann-edit-modal', true, ann);
};

window.saveAnnouncement = async function(modalId, isEdit, annId) {
  const title = document.getElementById(`${modalId}-title`)?.value?.trim();
  const body = document.getElementById(`${modalId}-body`)?.value?.trim();
  const is_pinned = document.getElementById(`${modalId}-pinned`)?.checked || false;
  if (!title || !body) { Toast.show('Title and content are required', 'error'); return; }
  try {
    if (isEdit) {
      await apiRequest(`/announcements/${annId}`, { method: 'PUT', body: { title, body, is_pinned } });
      Toast.show('Announcement updated', 'success');
    } else {
      await apiRequest('/announcements', { method: 'POST', body: { title, body, is_pinned } });
      Toast.show('Announcement posted', 'success');
    }
    Modal.close(modalId);
    await loadAnnouncements();
  } catch(err) {
    Toast.show(err.message || 'Operation failed', 'error');
  }
};

window.deleteAnnouncement = function(annId) {
  Modal.confirm(
    'Delete Announcement',
    'Are you sure you want to delete this announcement? This cannot be undone.',
    async () => {
      try {
        await apiRequest(`/announcements/${annId}`, { method: 'DELETE' });
        Toast.show('Announcement deleted', 'success');
        await loadAnnouncements();
      } catch(err) {
        Toast.show('Failed to delete', 'error');
      }
    },
    'Delete',
    true
  );
};
