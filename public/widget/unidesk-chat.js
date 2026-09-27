/**
 * Unidesk — Embeddable Live Chat & AI Widget
 * 
 * Usage:
 * <script src="https://helpdesk.suafaculdade.edu.br/widget/unidesk-chat.js" data-instance-url="https://helpdesk.suafaculdade.edu.br"></script>
 */

(function () {
  // Find current script tag to detect instance URL
  const scripts = document.getElementsByTagName('script');
  const currentScript = document.currentScript || scripts[scripts.length - 1];
  const instanceUrl = currentScript?.getAttribute('data-instance-url') || window.location.origin;

  let sessionId = null;
  let isChatOpen = false;

  // Create style element
  const style = document.createElement('style');
  style.innerHTML = `
    .unidesk-embed-btn {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: #1d4ed8;
      box-shadow: 0 8px 24px rgba(29, 78, 216, 0.4);
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      color: #fff;
      transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .unidesk-embed-btn:hover {
      transform: scale(1.08);
    }
    .unidesk-embed-window {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 380px;
      height: 520px;
      background: #111827;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.6);
      z-index: 999998;
      display: none;
      flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .unidesk-embed-window.active {
      display: flex;
    }
    .unidesk-embed-header {
      background: linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%);
      color: #fff;
      padding: 14px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .unidesk-embed-body {
      flex: 1;
      padding: 14px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .unidesk-embed-msg {
      max-width: 85%;
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 13.5px;
      line-height: 1.45;
    }
    .unidesk-embed-msg.student {
      align-self: flex-end;
      background: #1d4ed8;
      color: #fff;
    }
    .unidesk-embed-msg.bot {
      align-self: flex-start;
      background: rgba(255, 255, 255, 0.08);
      color: #f3f4f6;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .unidesk-embed-footer {
      padding: 10px 14px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(0, 0, 0, 0.2);
      display: flex;
      gap: 8px;
    }
    .unidesk-embed-input {
      flex: 1;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      color: #fff;
      padding: 8px 12px;
      font-size: 13.5px;
      outline: none;
    }
  `;
  document.head.appendChild(style);

  // Create Button
  const btn = document.createElement('button');
  btn.className = 'unidesk-embed-btn';
  btn.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;
  document.body.appendChild(btn);

  // Create Window
  const win = document.createElement('div');
  win.className = 'unidesk-embed-window';
  win.innerHTML = `
    <div class="unidesk-embed-header">
      <div style="font-weight:700; font-size:14px;">Atendimento Universitário • Sophia IA</div>
      <button id="unidesk-embed-close" style="background:none; border:none; color:#fff; font-size:18px; cursor:pointer;">&times;</button>
    </div>
    <div class="unidesk-embed-body" id="unidesk-embed-messages"></div>
    <div class="unidesk-embed-footer">
      <input type="text" id="unidesk-embed-input" class="unidesk-embed-input" placeholder="Digite sua dúvida acadêmica...">
      <button id="unidesk-embed-send" style="background:#1d4ed8; color:#fff; border:none; padding:8px 14px; border-radius:8px; cursor:pointer; font-weight:700;">Enviar</button>
    </div>
  `;
  document.body.appendChild(win);

  // Fetch Institutional Config to adapt colors
  fetch(`${instanceUrl}/api/config`)
    .then(r => r.json())
    .then(cfg => {
      if (cfg.primaryColor) {
        btn.style.background = cfg.primaryColor;
      }
    })
    .catch(() => {});

  // Toggle Window
  function toggle() {
    isChatOpen = !isChatOpen;
    win.classList.toggle('active', isChatOpen);
    if (isChatOpen && !sessionId) {
      startSession();
    }
  }

  btn.onclick = toggle;
  win.querySelector('#unidesk-embed-close').onclick = toggle;

  function startSession() {
    fetch(`${instanceUrl}/api/chat/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: 'visitante-widget' })
    })
      .then(r => r.json())
      .then(sess => {
        sessionId = sess.id;
        renderMessages(sess.messages);
      });
  }

  function renderMessages(messages) {
    const box = win.querySelector('#unidesk-embed-messages');
    box.innerHTML = messages.map(m => `
      <div class="unidesk-embed-msg ${m.sender === 'student' ? 'student' : 'bot'}">
        <div style="font-size:11px; opacity:0.8; margin-bottom:2px;">${m.senderName}</div>
        <div>${m.text}</div>
      </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
  }

  function sendMessage() {
    const input = win.querySelector('#unidesk-embed-input');
    const text = input.value.trim();
    if (!text || !sessionId) return;
    input.value = '';

    fetch(`${instanceUrl}/api/chat/${sessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: 'student', senderName: 'Você', text })
    })
      .then(r => r.json())
      .then(data => {
        renderMessages(data.session.messages);
      });
  }

  win.querySelector('#unidesk-embed-send').onclick = sendMessage;
  win.querySelector('#unidesk-embed-input').onkeydown = (e) => {
    if (e.key === 'Enter') sendMessage();
  };
})();
