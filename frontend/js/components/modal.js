// Modal and Drawer system
const Modal = {
  open(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('hidden');
      el.classList.add('open');
      document.body.style.overflow = 'hidden';
      const backdrop = document.getElementById(id + '-backdrop') || el.closest('.drawer-backdrop, .modal-backdrop');
      if (backdrop) {
        backdrop.classList.remove('hidden');
        backdrop.classList.add('open');
      }
    }
  },
  close(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('open');
      document.body.style.overflow = '';
      const backdrop = document.getElementById(id + '-backdrop') || el.closest('.drawer-backdrop, .modal-backdrop');
      if (backdrop) backdrop.classList.remove('open');
    }
  },
  closeOnBackdrop(e) {
    if (e.target === e.currentTarget) Modal.close(e.currentTarget.id);
  },
  // Create a confirm modal dynamically (supports both config object and positional args)
  confirm(titleOrConfig, body, onConfirm, confirmLabel='Confirm', isDanger=false) {
    let title = titleOrConfig;
    let message = body;
    let cb = onConfirm;
    let label = confirmLabel;
    let danger = isDanger;
    if (typeof titleOrConfig === 'object' && titleOrConfig !== null) {
      title = titleOrConfig.title || 'Confirm';
      message = titleOrConfig.message || titleOrConfig.body || '';
      cb = titleOrConfig.onConfirm || (() => {});
      label = titleOrConfig.confirmLabel || titleOrConfig.confirmText || 'Confirm';
      danger = Boolean(titleOrConfig.isDanger || titleOrConfig.type === 'danger');
    }

    const id = 'dynamic-confirm-modal';
    document.getElementById(id)?.remove();
    const el = document.createElement('div');
    el.id = id;
    el.className = 'modal-backdrop';
    el.innerHTML = `
      <div class="modal" style="max-width:420px;">
        <div class="modal-header">
          <div class="modal-title">${title}</div>
          <button class="modal-close" onclick="Modal.close('${id}')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          </button>
        </div>
        <p style="color:var(--color-ink-soft);">${message}</p>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="Modal.close('${id}')">Cancel</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="${id}-confirm">${label}</button>
        </div>
      </div>
    `;
    document.body.appendChild(el);
    el.addEventListener('click', Modal.closeOnBackdrop);
    setTimeout(() => el.classList.add('open'), 10);
    document.getElementById(`${id}-confirm`).addEventListener('click', () => { cb(); Modal.close(id); });
  }
};

// Close modal on Escape key
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal-backdrop.open, .drawer-backdrop.open').forEach(el => el.classList.remove('open')); });
