let currentAttendantId = "usr-att-1";
let currentTicketId = null;
let currentStudentId = null;
let isInternalNoteMode = false;
let socket = null;
let activeChatSessionId = "chat-sess-1";

document.addEventListener('DOMContentLoaded', async () => {
  setupProfileUploadListener();
  await loadConfig();
  await loadAttendantProfile();
  await loadQueueTickets();
  initWebSocket();
  setupEventListeners();
});

// Load Config & Apply Institutional Branding
async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    
    document.title = `${config.name} — Painel do Atendente`;
    const instName = document.getElementById('inst-name');
    if (instName) instName.textContent = config.name;
    const instLogo = document.getElementById('inst-logo');
    if (instLogo && config.logoUrl) instLogo.src = config.logoUrl;

    if (config.primaryColor) {
      document.documentElement.style.setProperty('--primary', config.primaryColor);
      document.documentElement.style.setProperty('--primary-glow', `${config.primaryColor}2e`);
    }
  } catch (err) {
    console.error('Error loading config:', err);
  }
}

// Load Attendant Profile
async function loadAttendantProfile() {
  try {
    const res = await fetch(`/api/users/${currentAttendantId}`);
    const att = await res.json();

    const avatar = document.getElementById('att-avatar');
    if (avatar && att.avatar) avatar.src = att.avatar;

    const sidebarAvatar = document.getElementById('sidebar-att-avatar');
    if (sidebarAvatar && att.avatar) sidebarAvatar.src = att.avatar;

    const perfilAvatar = document.getElementById('perfil-avatar-preview');
    if (perfilAvatar && att.avatar) perfilAvatar.src = att.avatar;

    const perfilName = document.getElementById('perfil-name');
    if (perfilName && att.name) perfilName.textContent = att.name;

    const roleLabel = document.getElementById('att-role-label');
    if (roleLabel) roleLabel.textContent = att.department || 'Atendimento Integrado';
  } catch (err) {
    console.error('Error loading attendant profile:', err);
  }
}

// Load Tickets for the Queue
async function loadQueueTickets() {
  const container = document.getElementById('queue-tickets-list');
  const statusFilter = document.getElementById('queue-status-filter').value;

  try {
    let url = '/api/tickets';
    if (statusFilter) url += `?status=${statusFilter}`;
    const res = await fetch(url);
    const tickets = await res.json();

    const totalCountEl = document.getElementById('queue-total-count');
    if (totalCountEl) totalCountEl.textContent = tickets.length;
    const showingCountEl = document.getElementById('queue-showing-count');
    if (showingCountEl) showingCountEl.textContent = `${tickets.length} chamados`;

    if (tickets.length === 0) {
      container.innerHTML = `<div style="text-align:center; padding:2rem; color:var(--text-muted); font-size:0.85rem;">Nenhum chamado com esse filtro.</div>`;
      return;
    }

    container.innerHTML = tickets.map(t => {
      const isSelected = t.id === currentTicketId;
      const statusMap = {
        'open': 'Aberto',
        'in_progress': 'Em Atendimento',
        'waiting_student': 'Aguardando',
        'resolved': 'Resolvido'
      };

      return `
        <div class="ticket-card ${isSelected ? 'selected' : ''}" onclick="selectQueueTicket('${t.id}')">
          <div class="ticket-top-meta">
            <span class="ticket-num">#${t.ticketNumber} • ${t.studentName.split(' ')[0]}</span>
            <span class="badge badge-${t.status}">${statusMap[t.status] || t.status}</span>
          </div>
          <div class="ticket-subject" style="font-size:0.88rem;">${t.subject}</div>
          <div class="ticket-bottom-bar" style="font-size:0.72rem;">
            <span>${t.categoryName.split(' ')[0]}</span>
            <span class="badge badge-${t.priority}">${t.priority}</span>
          </div>
        </div>
      `;
    }).join('');

    // If no ticket selected yet, select the first one
    if (!currentTicketId && tickets.length > 0) {
      selectQueueTicket(tickets[0].id);
    }
  } catch (err) {
    container.innerHTML = `<div style="color:#ef4444; padding:1rem;">Erro ao carregar fila.</div>`;
  }
}

// Select Ticket in Queue
async function selectQueueTicket(ticketId) {
  currentTicketId = ticketId;
  document.querySelectorAll('#queue-tickets-list .ticket-card').forEach(c => c.classList.remove('selected'));

  try {
    const res = await fetch(`/api/tickets/${ticketId}`);
    const ticket = await res.json();

    currentStudentId = ticket.studentId;

    const statusMap = {
      'open': 'Aberto',
      'in_progress': 'Em Atendimento',
      'waiting_student': 'Aguardando Aluno',
      'resolved': 'Resolvido'
    };

    document.getElementById('att-dtl-status').textContent = statusMap[ticket.status] || ticket.status;
    document.getElementById('att-dtl-status').className = `badge badge-${ticket.status}`;
    document.getElementById('att-dtl-priority').textContent = ticket.priority.toUpperCase();
    document.getElementById('att-dtl-priority').className = `badge badge-${ticket.priority}`;
    document.getElementById('att-dtl-protocol').textContent = `#${ticket.ticketNumber}`;
    document.getElementById('att-dtl-subject').textContent = ticket.subject;
    document.getElementById('att-dtl-student-name').textContent = ticket.student ? ticket.student.name : 'Aluno';
    document.getElementById('att-dtl-student-course').textContent = ticket.student ? ticket.student.course : 'Graduação';

    // Calculate SLA remaining hours
    const diffHours = Math.round((new Date(ticket.slaDueAt) - new Date()) / (1000 * 60 * 60));
    document.getElementById('att-dtl-sla').textContent = diffHours > 0 ? `${diffHours}h restantes` : 'SLA expirado';
    document.getElementById('att-dtl-sla').style.color = diffHours > 4 ? '#f59e0b' : '#ef4444';

    // Render Messages with internal notes clearly visible
    const msgListEl = document.getElementById('att-dtl-messages');
    msgListEl.innerHTML = ticket.messages.map(m => {
      const isInternal = m.isInternalNote;
      const isStudent = m.senderRole === 'student';
      const timeStr = new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      if (isInternal) {
        return `
          <div class="message-bubble msg-internal">
            <div style="font-weight:700; display:flex; align-items:center; gap:0.3rem; margin-bottom:0.25rem;">
              <span>🔒 NOTA INTERNA DA EQUIPE</span> • <span>${m.senderName}</span>
            </div>
            <div>${m.message}</div>
            <div class="msg-meta">
              <span>Visível apenas para atendentes/coordenação</span>
              <span>${timeStr}</span>
            </div>
          </div>
        `;
      }

      return `
        <div class="message-bubble ${isStudent ? 'msg-student' : 'msg-attendant'}">
          <div style="font-weight:700; font-size:0.75rem; margin-bottom:0.25rem;">${m.senderName}</div>
          <div>${m.message}</div>
          ${m.attachments && m.attachments.length > 0 ? `
            <div style="margin-top:0.4rem; font-size:0.75rem; background:rgba(0,0,0,0.2); padding:0.25rem 0.5rem; border-radius:4px;">
              📎 ${m.attachments.join(', ')}
            </div>
          ` : ''}
          <div class="msg-meta">
            <span>${isStudent ? 'Mensagem do Aluno' : 'Resposta da Equipe'}</span>
            <span>${timeStr}</span>
          </div>
        </div>
      `;
    }).join('');

    msgListEl.scrollTop = msgListEl.scrollHeight;

    // Load AI Student Context Card
    await loadAIStudentContext(ticket.studentId);
  } catch (err) {
    console.error('Error selecting ticket:', err);
  }
}

// Load the AI Student Context Card (Section 4.2 / 4.6 of Architecture Spec)
async function loadAIStudentContext(studentId) {
  try {
    const studentRes = await fetch(`/api/users/${studentId}`);
    const student = await studentRes.json();

    const aiRes = await fetch(`/api/students/${studentId}/ai-context`);
    const aiData = await aiRes.json();

    // Populate student header
    document.getElementById('ai-student-name').textContent = student.name;
    document.getElementById('ai-student-meta').textContent = `RA: ${student.ra || 'N/A'} • ${student.course || ''}`;
    const avatar = document.getElementById('ai-student-avatar');
    if (avatar && student.avatar) avatar.src = student.avatar;

    // Populate Sentiment Badge
    const sentimentBadge = document.getElementById('ai-sentiment-badge');
    const sentimentText = document.getElementById('ai-sentiment-text');
    sentimentText.textContent = aiData.sentiment;
    sentimentBadge.className = `sentiment-pill sentiment-${aiData.sentimentScore || 'warning'}`;

    // Populate Summary
    document.getElementById('ai-summary-text').textContent = aiData.summary;

    // Populate Points of Attention
    const attentionList = document.getElementById('ai-attention-list');
    attentionList.innerHTML = aiData.pointsOfAttention.map(pt => `
      <div class="ai-attention-item">
        <span>⚠️</span>
        <span>${pt}</span>
      </div>
    `).join('');

    // Populate Recommended Action
    document.getElementById('ai-action-text').textContent = aiData.recommendedAction;
  } catch (err) {
    console.error('Error loading AI context:', err);
  }
}

// Send Attendant Reply (Public or Internal Note)
async function sendAttendantReply() {
  const input = document.getElementById('att-reply-input');
  const message = input.value.trim();
  if (!message || !currentTicketId) return;

  try {
    input.value = '';
    await fetch(`/api/tickets/${currentTicketId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: currentAttendantId,
        message,
        isInternalNote: isInternalNoteMode
      })
    });

    // Notify via WebSocket
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'TICKET_UPDATE',
        ticketId: currentTicketId
      }));
    }

    await selectQueueTicket(currentTicketId);
    await loadQueueTickets();
  } catch (err) {
    alert('Erro ao registrar resposta');
  }
}

// Update Ticket Status (In Progress, Waiting, Resolved)
async function updateActiveTicketStatus(newStatus) {
  if (!currentTicketId) return;
  try {
    await fetch(`/api/tickets/${currentTicketId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });

    await selectQueueTicket(currentTicketId);
    await loadQueueTickets();
  } catch (err) {
    alert('Erro ao atualizar status do chamado');
  }
}

// Toggle Reply Mode (Public vs. Internal Note)
function setReplyMode(isInternal) {
  isInternalNoteMode = isInternal;
  const publicBtn = document.getElementById('reply-mode-public');
  const internalBtn = document.getElementById('reply-mode-internal');
  const input = document.getElementById('att-reply-input');

  if (isInternal) {
    internalBtn.className = 'badge badge-in_progress';
    internalBtn.style.opacity = '1';
    publicBtn.className = 'badge';
    publicBtn.style.opacity = '0.6';
    input.placeholder = '🔒 Digite uma NOTA INTERNA (não visível para o aluno)...';
    input.style.borderColor = '#f59e0b';
  } else {
    publicBtn.className = 'badge badge-open';
    publicBtn.style.opacity = '1';
    internalBtn.className = 'badge';
    internalBtn.style.opacity = '0.6';
    input.placeholder = '💬 Digite uma resposta orientando o aluno...';
    input.style.borderColor = 'var(--border-color)';
  }
}

// Quick AI Template Insertion
function insertQuickResponse(text) {
  const input = document.getElementById('att-reply-input');
  input.value = text;
  input.focus();
}

// Switch between Tickets Queue & Live Chat
function switchAttendantMode(mode) {
  const ticketsGrid = document.getElementById('attendant-workspace-grid');
  const chatView = document.getElementById('attendant-chat-view');
  const btnTickets = document.getElementById('btn-mode-tickets');
  const btnChat = document.getElementById('btn-mode-chat');

  if (mode === 'tickets') {
    ticketsGrid.style.display = 'grid';
    chatView.style.display = 'none';
    btnTickets.className = 'btn-primary';
    btnChat.className = 'btn-secondary';
  } else {
    ticketsGrid.style.display = 'none';
    chatView.style.display = 'block';
    btnChat.className = 'btn-primary';
    btnTickets.className = 'btn-secondary';
    loadLiveChatMessages();
  }
}

// Live Chat in WebSocket
async function loadLiveChatMessages() {
  try {
    const res = await fetch(`/api/chat/sessions/${activeChatSessionId}`);
    const session = await res.json();
    renderLiveChat(session.messages);
  } catch (err) {
    console.error('Error loading live chat:', err);
  }
}

function renderLiveChat(messages) {
  const container = document.getElementById('live-chat-messages-box');
  container.innerHTML = messages.map(m => {
    const isMe = m.sender === 'attendant';
    const isBot = m.sender === 'bot';
    const isStudent = m.sender === 'student';

    let bubbleClass = 'msg-student';
    if (isMe) bubbleClass = 'msg-attendant';
    if (isBot) bubbleClass = 'msg-bot';

    return `
      <div class="message-bubble ${bubbleClass}">
        <div style="font-weight:700; font-size:0.75rem; margin-bottom:0.25rem;">${m.senderName}</div>
        <div>${m.text}</div>
      </div>
    `;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

async function sendLiveChatMessage() {
  const input = document.getElementById('live-chat-input');
  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  try {
    const att = await (await fetch(`/api/users/${currentAttendantId}`)).json();
    await fetch(`/api/chat/${activeChatSessionId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: 'attendant',
        senderName: att.name,
        text
      })
    });

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'CHAT_MESSAGE',
        sessionId: activeChatSessionId,
        text
      }));
    }

    await loadLiveChatMessages();
  } catch (err) {
    alert('Erro ao enviar mensagem no chat');
  }
}

// WebSocket Connection
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  
  socket = new WebSocket(wsUrl);

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'CHAT_MESSAGE' && data.sessionId === activeChatSessionId) {
        loadLiveChatMessages();
      } else if (data.type === 'TICKET_UPDATE') {
        loadQueueTickets();
      }
    } catch (err) {
      console.error('WS parse error:', err);
    }
  };
}

// Setup Event Listeners
function setupEventListeners() {
  const switcher = document.getElementById('attendant-switcher-select');
  if (switcher) {
    switcher.addEventListener('change', async (e) => {
      currentAttendantId = e.target.value;
      await loadAttendantProfile();
      await loadQueueTickets();
    });
  }
}

// Alternador de Visualização da Barra Lateral do Operador
function switchSidebarView(viewId) {
  // Atualizar botões ativos da barra lateral
  document.querySelectorAll('.sidebar-rail-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`nav-${viewId}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Alternar módulos de visualização
  document.querySelectorAll('.module-view').forEach(view => view.classList.remove('active'));
  const targetView = document.getElementById(`view-${viewId}`);
  if (targetView) targetView.classList.add('active');

  // Metadados da tela no Top Bar
  const viewMeta = {
    'tickets': {
      icon: '🎫',
      title: 'Mesa de Operações de Atendimento',
      desc: 'Gestão de chamados acadêmicos, suporte ao aluno e inteligência contextual em tempo real.'
    },
    'chat': {
      icon: '💬',
      title: 'Chat ao Vivo em Tempo Real',
      desc: 'Atendimento síncrono direto com alunos conectados pelo site ou portal.'
    },
    'filas': {
      icon: '👥',
      title: 'Filas Acadêmicas por Departamento',
      desc: 'Distribuição da demanda entre Secretaria, Financeiro, TI, Coordenação e Estágios.'
    },
    'kb': {
      icon: '📚',
      title: 'Base de Conhecimento',
      desc: 'Artigos técnicos, normas regimentais e procedimentos operacionais padrão (SOPs).'
    },
    'metrics': {
      icon: '📊',
      title: 'Minha Performance Individual',
      desc: 'Monitoramento pessoal de SLA, resoluções e satisfação dos estudantes (CSAT).'
    },
    'perfil': {
      icon: '👤',
      title: 'Perfil & Status Operacional',
      desc: 'Gerencie sua disponibilidade, notificações e credenciais de atendimento.'
    }
  };

  const meta = viewMeta[viewId] || viewMeta['tickets'];
  const iconEl = document.getElementById('current-view-icon');
  const titleEl = document.getElementById('current-view-title');
  const descEl = document.getElementById('current-view-desc');

  if (iconEl) iconEl.textContent = meta.icon;
  if (titleEl) titleEl.textContent = meta.title;
  if (descEl) descEl.textContent = meta.desc;

  if (viewId === 'chat') {
    loadLiveChatMessages();
  }
}

// Copiar texto de SOP
function copySOPText(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('Texto do procedimento copiado para a área de transferência!');
  });
}

// Alterar status operacional do atendente
function changeOperatorStatus(status) {
  const statusMap = {
    'online': 'Online & Disponível',
    'away': 'Ausente / Intervalo',
    'busy': 'Ocupado / Em Atendimento'
  };
  const headerStatus = document.getElementById('header-status-text');
  if (headerStatus) {
    headerStatus.textContent = statusMap[status] || 'Online & Disponível';
  }
}

// Listener para Alteração de Foto de Perfil do Atendente
function setupProfileUploadListener() {
  const uploadInput = document.getElementById('profile-upload');
  if (uploadInput) {
    uploadInput.addEventListener('change', function () {
      if (this.files && this.files[0]) {
        const newUrl = URL.createObjectURL(this.files[0]);

        // Atualizar foto na tela de perfil
        const perfilPreview = document.getElementById('perfil-avatar-preview');
        if (perfilPreview) perfilPreview.src = newUrl;

        // Atualizar foto no seletor do topo
        const topAvatar = document.getElementById('att-avatar');
        if (topAvatar) topAvatar.src = newUrl;

        // Atualizar foto na barra lateral
        const sidebarAvatar = document.getElementById('sidebar-att-avatar');
        if (sidebarAvatar) sidebarAvatar.src = newUrl;

        showUnideskToast('Foto de perfil atualizada com sucesso!');
      }
    });
  }
}

// Toast Feedback Notification
function showUnideskToast(message, icon = '✓') {
  const toast = document.getElementById('unidesk-toast');
  const msgEl = document.getElementById('toast-message');
  const iconEl = document.getElementById('toast-icon');
  if (toast && msgEl) {
    msgEl.textContent = message;
    if (iconEl) iconEl.textContent = icon;
    toast.classList.add('show');
    clearTimeout(window.__attToastTimer);
    window.__attToastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }
}

