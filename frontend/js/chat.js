/**
 * TrueShift Chat — Employee-to-HR messaging with REST polling.
 * Works without WebSocket. WS fallback attempt is made silently.
 */

let currentUser = null;
let activeConvId = null;   // the 'other' user's ID (for employees: HR user ID)
let activeConvName = '';
let pollTimer = null;
let lastMessageId = 0;
let isHRMode = false;      // true when logged-in user is hr/admin
let allConversations = [];

document.addEventListener('DOMContentLoaded', async () => {
  requireAuth();
  currentUser = TokenStore.getUser();
  if (!currentUser) return;

  Sidebar.init('chat');
  setAvatarElement('topbar-avatar', currentUser);
  if (window.NotificationCenter) NotificationCenter.init('notif-bell-btn');

  isHRMode = ['admin', 'hr'].includes(currentUser.role);

  // Setup send button
  const sendBtn = document.getElementById('send-btn');
  const chatInput = document.getElementById('chat-input');

  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
  });
  document.getElementById('conv-search')?.addEventListener('input', e => renderConversations(e.target.value));
  document.getElementById('chat-back-btn')?.addEventListener('click', () => {
    document.querySelector('.chat-container')?.classList.remove('mobile-chat-open');
  });

  // Show/hide HR button
  if (!isHRMode) {
    document.getElementById('conv-new-btn').classList.remove('hidden');
  }

  // Update empty state text for employees
  if (!isHRMode) {
    document.getElementById('chat-empty-title').textContent = 'Need help from HR?';
    document.getElementById('chat-empty-sub').textContent = 'Start a conversation with the HR team. They can help with leave, payroll, policies, and more.';
  } else {
    document.getElementById('start-conv-btn').style.display = 'none';
    document.getElementById('chat-empty-sub').textContent = 'Select an employee conversation from the list.';
  }

  await loadConversations();

  // Start-HR button in conv panel header
  const startHrBtn = document.getElementById('start-hr-btn');
  if (startHrBtn) startHrBtn.addEventListener('click', startHRConversation);
});

async function loadConversations() {
  const convList = document.getElementById('conv-list');
  convList.innerHTML = '<div style="padding:16px; text-align:center; color:var(--color-ink-soft); font-size:0.85rem;">Loading...</div>';
  
  try {
    let conversations;
    if (isHRMode) {
      conversations = await apiRequest('/chat/hr/conversations');
      // Transform to standard format
      conversations = conversations.map(c => ({
        id: c.employee_id,
        name: c.employee_name,
        last_message: c.last_message,
        last_at: c.last_at,
        unread: c.unread,
        type: 'employee'
      }));
    } else {
      conversations = await apiRequest('/chat/conversations');
    }

    allConversations = Array.isArray(conversations) ? conversations : [];
    if (allConversations.length === 0) {
      convList.innerHTML = `
        <div class="conv-empty">
          <div style="font-size:2rem; margin-bottom:10px;">💬</div>
          <div style="font-size:0.85rem; line-height:1.5;">${isHRMode ? 'No employee conversations yet.' : 'No conversations yet.<br>Start one with HR!'}</div>
          ${!isHRMode ? '<button class="btn btn-primary" style="margin-top:16px;font-size:0.85rem;" onclick="startHRConversation()">+ Start HR Chat</button>' : ''}
        </div>`;
      return;
    }
    renderConversations(document.getElementById('conv-search')?.value || '');
  } catch(err) {
    convList.innerHTML = `<div class="conv-error">${escHtml(err.message || 'Unable to load conversations')}<button class="btn btn-secondary" style="margin-top:8px;font-size:0.8rem;" onclick="loadConversations()">Retry</button></div>`;
  }
}

function renderConversations(query = '') {
    const convList = document.getElementById('conv-list');
    const needle = query.trim().toLocaleLowerCase();
    const filtered = allConversations.filter(conv => `${conv.name || ''} ${conv.last_message || ''}`.toLocaleLowerCase().includes(needle));
    if (!filtered.length) {
      convList.innerHTML = `<div class="conv-empty">${allConversations.length ? 'No conversations match your search.' : 'No conversations yet.'}</div>`;
      return;
    }
    convList.innerHTML = filtered.map(conv => {
      const convId = String(conv.id);
      const preview = conv.last_message ? (conv.last_message.length > 40 ? conv.last_message.slice(0,40)+'...' : conv.last_message) : 'No messages yet';
      const timeStr = conv.last_at ? timeAgo(conv.last_at) : '';
      const avatarHtml = typeof renderAvatar === 'function'
        ? renderAvatar({ name: conv.name, profile_photo_url: conv.profile_photo_url }, { size: 'sm', showName: false })
        : `<div class="conv-avatar">${initials(conv.name)}</div>`;
      return `
        <div role="button" tabindex="0" class="conv-item ${activeConvId === convId ? 'active' : ''}" data-id="${escHtml(convId)}" onclick="openConversation('${escHtml(convId)}', decodeURIComponent('${encodeURIComponent(conv.name || '')}'))" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openConversation('${escHtml(convId)}',decodeURIComponent('${encodeURIComponent(conv.name || '')}'))}">
          ${avatarHtml}
          <div class="conv-info">
            <div class="conv-name">${escHtml(conv.name)}</div>
            <div class="conv-preview">${escHtml(preview)}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
            ${timeStr ? `<span style="font-size:0.7rem;color:var(--color-ink-soft);">${timeStr}</span>` : ''}
            ${conv.unread > 0 ? `<span class="conv-unread">${conv.unread}</span>` : ''}
          </div>
        </div>`;
    }).join('');
}

window.openConversation = async function(convId, convName) {
  activeConvId = convId;
  activeConvName = convName;
  lastMessageId = 0;

  // Update active state in list
  document.querySelectorAll('.conv-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === convId);
  });

  // Show active chat panel
  document.getElementById('chat-empty').style.display = 'none';
  const chatActive = document.getElementById('chat-active');
  chatActive.style.display = 'flex';
  document.querySelector('.chat-container')?.classList.add('mobile-chat-open');

  // Update header
  document.getElementById('chat-hdr-avatar').textContent = initials(convName);
  document.getElementById('chat-hdr-name').textContent = convName;
  document.getElementById('chat-hdr-sub').textContent = isHRMode ? 'Employee' : 'HR Support';

  await loadMessages();
  startPolling();
  document.getElementById('chat-input').focus();
};

async function loadMessages() {
  const container = document.getElementById('chat-messages');
  if (!container || !activeConvId) return;

  try {
    const messages = await apiRequest(`/chat/messages/${activeConvId}`);
    if (!messages) return;

    container.innerHTML = '';
    if (!messages.length) {
      container.innerHTML = '<div class="message-empty"><strong>Start the conversation</strong><span>Send a message whenever you are ready. Your messages will appear here.</span></div>';
      return;
    }
    let lastDate = null;

    messages.forEach(msg => {
      const msgDate = new Date(msg.created_at).toDateString();
      if (msgDate !== lastDate) {
        lastDate = msgDate;
        const sep = document.createElement('div');
        sep.className = 'date-sep';
        sep.textContent = msgDate === new Date().toDateString() ? 'Today' : new Date(msg.created_at).toLocaleDateString('en-US', {month:'short', day:'numeric'});
        container.appendChild(sep);
      }

      const isSystem = msg.message_type === 'system';
      const isMine = msg.sender_id === currentUser.id;

      if (isSystem) {
        const row = document.createElement('div');
        row.innerHTML = `<div class="msg-bubble system">${escHtml(msg.content)}</div>`;
        row.style.cssText = 'display:flex;justify-content:center;';
        container.appendChild(row);
        return;
      }

      const row = document.createElement('div');
      row.className = `msg-row ${isMine ? 'mine' : 'theirs'}`;
      row.innerHTML = `
        ${!isMine ? `<div class="msg-sender">${escHtml(msg.sender_name || 'HR')}</div>` : ''}
        <div class="msg-bubble ${isMine ? 'mine' : 'theirs'}">${escHtml(msg.content)}</div>
        <div class="msg-time">${formatTime(msg.created_at)}</div>
      `;
      container.appendChild(row);

      if (msg.id > lastMessageId) lastMessageId = msg.id;
    });

    container.scrollTop = container.scrollHeight;
  } catch(err) {
    console.error('Failed to load messages:', err);
  }
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || !activeConvId) return;

  const sendBtn = document.getElementById('send-btn');
  sendBtn.disabled = true;
  input.value = '';
  input.style.height = 'auto';

  try {
    await apiRequest('/chat/messages', {
      method: 'POST',
      body: {
        receiver_id: parseInt(activeConvId),
        content: text,
        message_type: 'text',
        is_broadcast: false
      }
    });
    await loadMessages();
    await loadConversations();
  } catch(err) {
    Toast.show('Failed to send message: ' + (err.message || 'Unknown error'), 'error');
    input.value = text;
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (activeConvId) await loadMessages();
  }, 5000);
}

window.startHRConversation = async function() {
  const btn = document.getElementById('start-conv-btn') || document.getElementById('start-hr-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Connecting...'; }
  
  try {
    const result = await apiRequest('/chat/hr/start', { method: 'POST' });
    await loadConversations();
    await openConversation(String(result.hr_user_id), result.hr_name || 'HR Support');
    if (result.is_new) {
      Toast.show('Conversation started! HR will respond shortly.', 'success');
    }
  } catch(err) {
    Toast.show(err.message || 'Failed to start conversation', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Start HR Conversation'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = btn.id === 'start-hr-btn' ? '+ HR Chat' : 'Start HR Conversation'; }
  }
};

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
