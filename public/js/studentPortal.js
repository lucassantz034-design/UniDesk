/**
 * UniDesk — Portal do Aluno (Frontend Controller)
 * Experiência Exclusiva e Otimizada para Estudantes
 */

// Perfil do Aluno Conectado
const currentStudent = {
  id: 'usr-stu-2',
  name: 'Larissa Vianna Castro',
  ra: '20230512',
  course: 'Medicina (7º Período)',
  email: 'larissa.vianna@aluno.metropolitana.edu.br',
  phone: '(11) 99812-3456',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop&q=80'
};

let currentView = 'dashboards';
let allStudentTickets = [];
let activeTicketId = null;
let currentFilterStatus = '';

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  setupProfileUploadListener();
  setupKeyboardShortcuts();
  await loadGlobalConfig();
  await loadStudentTickets();
});

// Listener para Alteração de Foto de Perfil
function setupProfileUploadListener() {
  const uploadInput = document.getElementById('profile-upload');
  if (uploadInput) {
    uploadInput.addEventListener('change', function () {
      if (this.files && this.files[0]) {
        const newUrl = URL.createObjectURL(this.files[0]);
        const profilePreview = document.getElementById('profile-avatar-preview');
        if (profilePreview) profilePreview.src = newUrl;
        
        const sidebarImg = document.querySelector('.sidebar-user-la-card img');
        if (sidebarImg) sidebarImg.src = newUrl;

        showUnideskToast('Foto de perfil atualizada com sucesso!');
      }
    });
  }
}

// Configurações Globais / Nome da Instituição
async function loadGlobalConfig() {
  try {
    const res = await fetch('/api/config');
    if (res.ok) {
      const cfg = await res.json();
      if (cfg.name) {
        document.title = `Portal do Aluno — ${cfg.name}`;
      }
    }
  } catch (err) {
    console.error('Erro ao carregar configurações institucionais:', err);
  }
}

// Alternar Telas / Módulos da Barra Lateral
function switchSidebarView(viewId) {
  currentView = viewId;

  // Atualizar classe ativa nos botões da barra lateral
  document.querySelectorAll('.sidebar-rail-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.getElementById(`nav-${viewId}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Alternar visibilidade das seções
  document.querySelectorAll('.module-view').forEach(view => view.classList.remove('active'));
  const targetView = document.getElementById(`view-${viewId}`);
  if (targetView) targetView.classList.add('active');

  // Metadados da tela no Header Superior
  const viewMeta = {
    'dashboards': {
      icon: '🎫',
      title: 'Meus Chamados',
      desc: `${currentStudent.name} • RA: ${currentStudent.ra} • ${currentStudent.course}`,
      actionText: '+ Novo Chamado'
    },
    'novochamado': {
      icon: '➕',
      title: 'Abrir Chamado',
      desc: 'Envie uma solicitação para a Secretaria, Financeiro, Suporte TI ou Coordenação.',
      actionText: 'Voltar aos Chamados'
    },
    'inbox': {
      icon: '💬',
      title: 'Chat ao Vivo',
      desc: 'Atendimento síncrono em tempo real com a equipe de suporte e assistente virtual.',
      actionText: '+ Novo Chamado'
    },
    'notificacoes': {
      icon: '🔔',
      title: 'Notificações',
      desc: 'Avisos acadêmicos oficiais e atualizações de andamento em seus protocolos.',
      actionText: 'Marcar Todas como Lidas'
    },
    'perfil': {
      icon: '👤',
      title: 'Meu Perfil Acadêmico',
      desc: 'Consulte seus dados cadastrais, informações do curso e foto de identificação.',
      actionText: '+ Novo Chamado'
    }
  };

  const meta = viewMeta[viewId] || viewMeta['dashboards'];
  const iconEl = document.getElementById('current-view-icon');
  const titleEl = document.getElementById('current-view-title');
  const descEl = document.getElementById('current-view-desc');
  const actionBtn = document.getElementById('btn-global-action');

  if (iconEl) iconEl.textContent = meta.icon;
  if (titleEl) titleEl.textContent = meta.title;
  if (descEl) descEl.textContent = meta.desc;
  if (actionBtn) {
    if (viewId === 'novochamado') {
      actionBtn.textContent = 'Meus Chamados';
      actionBtn.onclick = () => switchSidebarView('dashboards');
    } else {
      actionBtn.textContent = '+ Novo Chamado';
      actionBtn.onclick = openNewTicketModal;
    }
  }
}

// Carregar Chamados do Aluno
async function loadStudentTickets() {
  try {
    const res = await fetch('/api/tickets');
    if (res.ok) {
      const tickets = await res.json();
      
      // Filtrar ou priorizar chamados vinculados ao aluno ou geral
      const studentTickets = tickets.filter(t => t.studentId === currentStudent.id);
      allStudentTickets = studentTickets.length > 0 ? studentTickets : tickets;

      updateKPIs(allStudentTickets);
      renderStudentTicketsList(allStudentTickets);

      // Selecionar o primeiro chamado automaticamente se não houver um ativo
      if (!activeTicketId && allStudentTickets.length > 0) {
        selectStudentTicket(allStudentTickets[0].id);
      }
    }
  } catch (err) {
    console.error('Erro ao carregar chamados:', err);
  }
}

// Atualizar Contadores de Chamados
function updateKPIs(tickets) {
  const inProgress = tickets.filter(t => t.status === 'in_progress' || t.status === 'open').length;
  const waiting = tickets.filter(t => t.status === 'waiting_student').length;
  const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length;

  const progEl = document.getElementById('student-kpi-progresso');
  const waitEl = document.getElementById('student-kpi-aguardando');
  const resEl = document.getElementById('student-kpi-resolvidos');

  if (progEl) progEl.textContent = inProgress;
  if (waitEl) waitEl.textContent = waiting;
  if (resEl) resEl.textContent = resolved;
}

// Renderizar Lista de Chamados
function renderStudentTicketsList(tickets) {
  const container = document.getElementById('student-tickets-list');
  if (!container) return;

  if (tickets.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:2.5rem 1rem; color:var(--text-muted);">
        <div style="font-size:2rem; margin-bottom:0.5rem;">📂</div>
        <div style="font-weight:700; color:#fff; font-size:0.9rem;">Nenhum chamado encontrado</div>
        <div style="font-size:0.75rem; margin-top:0.25rem;">Você não possui solicitações com esse filtro.</div>
      </div>
    `;
    return;
  }

  const statusLabel = {
    'open': 'Aberto',
    'in_progress': 'Em Atendimento',
    'waiting_student': 'Aguardando Você',
    'resolved': 'Resolvido',
    'closed': 'Fechado'
  };

  const statusColor = {
    'open': '#3b82f6',
    'in_progress': '#f59e0b',
    'waiting_student': '#60a5fa',
    'resolved': '#10b981',
    'closed': '#6b7280'
  };

  container.innerHTML = tickets.map(t => {
    const isSelected = t.id === activeTicketId;
    const dateFormatted = new Date(t.createdAt).toLocaleDateString('pt-BR');
    
    return `
      <div class="ticket-card ${isSelected ? 'selected' : ''}" onclick="selectStudentTicket('${t.id}')"
        style="padding:1rem; cursor:pointer; border-radius:10px; border:1px solid ${isSelected ? 'var(--primary)' : 'var(--border-color)'}; background:${isSelected ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)'}; transition:all 0.15s ease;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
          <span style="font-size:0.78rem; font-weight:800; color:#60a5fa;">#${t.ticketNumber}</span>
          <span style="font-size:0.68rem; font-weight:700; padding:0.2rem 0.5rem; border-radius:9999px; background:${statusColor[t.status] || '#3b82f6'}; color:#fff;">
            ${statusLabel[t.status] || t.status}
          </span>
        </div>
        <div style="font-size:0.86rem; font-weight:700; color:#fff; line-height:1.35; margin-bottom:0.5rem;">
          ${t.subject}
        </div>
        <div style="display:flex; justify-content:space-between; font-size:0.72rem; color:var(--text-muted);">
          <span>${t.categoryName || 'Acadêmico'}</span>
          <span>${dateFormatted}</span>
        </div>
      </div>
    `;
  }).join('');
}

// Selecionar um Chamado e Carregar Detalhes
async function selectStudentTicket(ticketId) {
  activeTicketId = ticketId;
  renderStudentTicketsList(allStudentTickets);

  try {
    const res = await fetch(`/api/tickets/${ticketId}`);
    if (res.ok) {
      const ticket = await res.json();
      renderTicketDetails(ticket);
    }
  } catch (err) {
    console.error('Erro ao buscar detalhes do chamado:', err);
  }
}

// Renderizar Painel Detalhado do Chamado
function renderTicketDetails(ticket) {
  const statusLabel = {
    'open': 'Aberto',
    'in_progress': 'Em Atendimento',
    'waiting_student': 'Aguardando Sua Resposta',
    'resolved': 'Resolvido',
    'closed': 'Fechado'
  };

  const statusColor = {
    'open': '#3b82f6',
    'in_progress': '#f59e0b',
    'waiting_student': '#60a5fa',
    'resolved': '#10b981',
    'closed': '#6b7280'
  };

  // Header do chamado
  document.getElementById('detail-ticket-num').textContent = `#${ticket.ticketNumber}`;
  const badgeEl = document.getElementById('detail-ticket-badge');
  badgeEl.textContent = statusLabel[ticket.status] || ticket.status;
  badgeEl.style.background = statusColor[ticket.status] || '#f59e0b';
  badgeEl.style.color = '#fff';

  document.getElementById('detail-ticket-category').textContent = ticket.category?.name || 'Secretaria Acadêmica';
  document.getElementById('detail-ticket-subject').textContent = ticket.subject;
  
  const createdDate = new Date(ticket.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  document.getElementById('detail-ticket-created').textContent = createdDate;
  document.getElementById('detail-ticket-attendant').textContent = ticket.attendant?.name || 'Equipe de Atendimento';

  // Mensagens da Conversa (Filtrando estritamente para NÃO exibir notas internas ao aluno!)
  const timeline = document.getElementById('ticket-messages-timeline');
  const messages = (ticket.messages || []).filter(m => !m.isInternalNote);

  if (messages.length === 0) {
    timeline.innerHTML = `
      <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:10px; padding:1.25rem;">
        <div style="font-size:0.8rem; color:#60a5fa; font-weight:700; margin-bottom:0.25rem;">Descrição Original do Chamado:</div>
        <div style="font-size:0.85rem; color:#e2e8f0; line-height:1.5;">${ticket.description}</div>
      </div>
    `;
  } else {
    timeline.innerHTML = `
      <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border-color); border-radius:10px; padding:1.25rem; margin-bottom:0.5rem;">
        <div style="font-size:0.8rem; color:#60a5fa; font-weight:700; margin-bottom:0.25rem;">Solicitação Inicial:</div>
        <div style="font-size:0.85rem; color:#e2e8f0; line-height:1.5;">${ticket.description}</div>
      </div>
    ` + messages.map(m => {
      const isStudent = m.senderRole === 'student' || m.senderId === currentStudent.id;
      const msgDate = new Date(m.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      return `
        <div style="display:flex; flex-direction:column; align-items:${isStudent ? 'flex-end' : 'flex-start'};">
          <div style="font-size:0.72rem; color:var(--text-subtle); margin-bottom:0.25rem;">
            ${m.senderName || (isStudent ? currentStudent.name : 'Atendente')} • ${msgDate}
          </div>
          <div style="max-width:82%; padding:0.85rem 1.15rem; border-radius:${isStudent ? '14px 14px 2px 14px' : '14px 14px 14px 2px'}; background:${isStudent ? 'var(--primary)' : 'var(--bg-surface)'}; border:1px solid ${isStudent ? 'transparent' : 'var(--border-color)'}; color:#fff; font-size:0.85rem; line-height:1.5;">
            ${m.message}
            ${m.attachments && m.attachments.length > 0 ? `
              <div style="margin-top:0.5rem; padding-top:0.4rem; border-top:1px solid rgba(255,255,255,0.2); font-size:0.75rem;">
                📎 <strong>Anexo:</strong> ${m.attachments[0]}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  // Rolar para a última mensagem
  timeline.scrollTop = timeline.scrollHeight;

  // Controle da Caixa de Avaliação CSAT
  const csatBox = document.getElementById('ticket-csat-box');
  if (csatBox) {
    if (ticket.status === 'resolved' || ticket.status === 'closed') {
      csatBox.style.display = 'block';
    } else {
      csatBox.style.display = 'none';
    }
  }
}

// Enviar Resposta / Réplica no Chamado
async function handleSendStudentReply(e) {
  e.preventDefault();
  const input = document.getElementById('student-reply-input');
  const message = input.value.trim();
  if (!message || !activeTicketId) return;

  const fileInput = document.getElementById('reply-file-upload');
  const attachments = (fileInput && fileInput.files[0]) ? [fileInput.files[0].name] : [];

  try {
    const res = await fetch(`/api/tickets/${activeTicketId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderId: currentStudent.id,
        senderName: currentStudent.name,
        senderRole: 'student',
        message: message,
        isInternalNote: false,
        attachments: attachments
      })
    });

    if (res.ok) {
      input.value = '';
      if (fileInput) fileInput.value = '';
      const label = document.getElementById('reply-file-name-label');
      if (label) label.textContent = 'Anexar Arquivo';

      showUnideskToast('Sua mensagem foi enviada ao atendente!');
      await selectStudentTicket(activeTicketId);
    }
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
    showUnideskToast('Erro ao enviar mensagem.', '⚠️');
  }
}

// Arquivo selecionado na réplica
function handleReplyFileSelected(input) {
  const label = document.getElementById('reply-file-name-label');
  if (input.files && input.files[0] && label) {
    label.textContent = input.files[0].name.substring(0, 20) + '...';
  }
}

// Criar Chamado a partir da Tela Cheia
async function handleCreateTicketPageSubmit(e) {
  e.preventDefault();

  const categoryId = document.getElementById('new-ticket-category').value;
  const priority = document.getElementById('new-ticket-priority').value;
  const subject = document.getElementById('new-ticket-subject').value.trim();
  const description = document.getElementById('new-ticket-description').value.trim();

  const fileInput = document.getElementById('new-ticket-file');
  const attachments = (fileInput && fileInput.files[0]) ? [fileInput.files[0].name] : [];

  if (!categoryId || !subject || !description) {
    alert('Preencha os campos obrigatórios.');
    return;
  }

  await submitNewTicket({
    studentId: currentStudent.id,
    categoryId,
    priority,
    subject,
    description,
    attachments
  });

  document.getElementById('new-ticket-page-form').reset();
  const fileLabel = document.getElementById('new-ticket-file-label');
  if (fileLabel) fileLabel.textContent = 'Clique para anexar PDF, comprovante ou foto';
}

// Criar Chamado a partir do Modal
async function handleCreateTicketModalSubmit(e) {
  e.preventDefault();

  const categoryId = document.getElementById('modal-ticket-category').value;
  const subject = document.getElementById('modal-ticket-subject').value.trim();
  const description = document.getElementById('modal-ticket-description').value.trim();

  if (!categoryId || !subject || !description) {
    alert('Preencha os campos obrigatórios.');
    return;
  }

  await submitNewTicket({
    studentId: currentStudent.id,
    categoryId,
    priority: 'medium',
    subject,
    description,
    attachments: []
  });

  closeNewTicketModal();
}

// Submissão Universal de Novo Chamado
async function submitNewTicket(ticketData) {
  try {
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ticketData)
    });

    if (res.ok) {
      const created = await res.json();
      showUnideskToast(`Chamado #${created.ticketNumber} aberto com sucesso!`);
      
      await loadStudentTickets();
      activeTicketId = created.id;
      switchSidebarView('dashboards');
      await selectStudentTicket(created.id);
    }
  } catch (err) {
    console.error('Erro ao abrir chamado:', err);
    showUnideskToast('Erro ao registrar chamado.', '⚠️');
  }
}

// Feedback de arquivo no form de chamado
function handleNewTicketFileSelected(input) {
  const label = document.getElementById('new-ticket-file-label');
  if (input.files && input.files[0] && label) {
    label.textContent = `Arquivo anexado: ${input.files[0].name}`;
  }
}

// Avaliação CSAT
async function rateCurrentTicket(score) {
  if (!activeTicketId) return;

  try {
    await fetch(`/api/tickets/${activeTicketId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'resolved',
        csatScore: score
      })
    });

    const csatBox = document.getElementById('ticket-csat-box');
    if (csatBox) {
      csatBox.innerHTML = `
        <div style="color:#10b981; font-weight:700; font-size:0.95rem;">
          ✓ Obrigado! Você avaliou este atendimento com ${score} estrela(s).
        </div>
      `;
    }
    showUnideskToast('Avaliação registrada com sucesso!');
  } catch (err) {
    console.error('Erro ao avaliar chamado:', err);
  }
}

// Chat em Tempo Real
function handleSendChatMessage(e) {
  e.preventDefault();
  const input = document.getElementById('live-chat-input');
  const msg = input.value.trim();
  if (!msg) return;

  const chatContainer = document.getElementById('live-chat-messages');
  
  // Mensagem do Aluno
  const studentBubble = `
    <div style="display:flex; justify-content:flex-end;">
      <div style="background:var(--primary); color:#fff; border-radius:12px 12px 2px 12px; padding:0.85rem 1rem; font-size:0.85rem; max-width:80%;">
        ${msg}
      </div>
    </div>
  `;
  chatContainer.insertAdjacentHTML('beforeend', studentBubble);
  input.value = '';
  chatContainer.scrollTop = chatContainer.scrollHeight;

  // Resposta da Sophia
  setTimeout(() => {
    let reply = "Recebi sua mensagem. Nossa equipe de atendimento está analisando sua solicitação e responderá em instantes.";
    const lower = msg.toLowerCase();
    
    if (lower.includes('boleto') || lower.includes('financeiro') || lower.includes('desconto')) {
      reply = "Entendido! Para assuntos financeiros ou dúvidas sobre boletos, você também pode abrir um chamado no setor 'Financeiro & Bolsas' para que nosso time emita a 2ª via corrigida.";
    } else if (lower.includes('moodle') || lower.includes('senha') || lower.includes('ava')) {
      reply = "Caso esteja enfrentando dificuldades no AVA Moodle, você pode abrir um chamado no 'Suporte AVA & TI' que nossa equipe técnica resetará suas credenciais.";
    } else if (lower.includes('declaração') || lower.includes('matrícula')) {
      reply = "Declarações oficiais podem ser solicitadas diretamente pelo setor de 'Secretaria Acadêmica' no menu de Novo Chamado.";
    }

    const botBubble = `
      <div style="display:flex; gap:0.75rem; max-width:80%;">
        <img src="/assets/LOGO_UD.png" style="width:32px; height:32px; border-radius:50%; border:1px solid var(--primary); padding:2px; background:#111827;">
        <div style="background:var(--bg-surface); border:1px solid var(--border-color); border-radius:12px 12px 12px 2px; padding:0.85rem 1rem; font-size:0.85rem; color:#e2e8f0; line-height:1.5;">
          ${reply}
        </div>
      </div>
    `;
    chatContainer.insertAdjacentHTML('beforeend', botBubble);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }, 750);
}

// Salvar Perfil
function handleUpdateProfile(e) {
  e.preventDefault();
  const phoneInput = document.getElementById('profile-input-phone');
  if (phoneInput) {
    currentStudent.phone = phoneInput.value;
  }
  showUnideskToast('Informações de contato salvas!');
}

// Filtro de Chamados por Status
function filterStudentTickets(status) {
  currentFilterStatus = status;

  const btnAll = document.getElementById('btn-filter-all');
  const btnActive = document.getElementById('btn-filter-active');

  if (btnAll) btnAll.classList.toggle('active', status === '');
  if (btnActive) btnActive.classList.toggle('active', status === 'active');

  let filtered = allStudentTickets;
  if (status === 'active') {
    filtered = allStudentTickets.filter(t => t.status === 'open' || t.status === 'in_progress' || t.status === 'waiting_student');
  } else if (status) {
    filtered = allStudentTickets.filter(t => t.status === status);
  }

  renderStudentTicketsList(filtered);
}

// Busca rápida
function handleStudentSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  if (!query) {
    renderStudentTicketsList(allStudentTickets);
    return;
  }

  const filtered = allStudentTickets.filter(t => 
    t.ticketNumber.toString().includes(query) ||
    t.subject.toLowerCase().includes(query) ||
    (t.categoryName && t.categoryName.toLowerCase().includes(query))
  );

  renderStudentTicketsList(filtered);
}

// Notificações
function markAllNotificationsAsRead() {
  const badge = document.getElementById('badge-notif-count');
  if (badge) badge.style.display = 'none';
  showUnideskToast('Todas as notificações foram marcadas como lidas.');
}

// Modais
function openNewTicketModal() {
  const modal = document.getElementById('new-ticket-modal');
  if (modal) {
    modal.classList.add('active');
    setTimeout(() => {
      const subjectInput = document.getElementById('modal-ticket-subject');
      if (subjectInput) subjectInput.focus();
    }, 100);
  }
}

function closeNewTicketModal() {
  const modal = document.getElementById('new-ticket-modal');
  if (modal) {
    modal.classList.remove('active');
    const form = document.getElementById('new-ticket-modal-form');
    if (form) form.reset();
  }
}

function handleTicketModalBackdrop(e) {
  if (e.target && e.target.id === 'new-ticket-modal') {
    closeNewTicketModal();
  }
}

// Máscara de Telefone
function maskPhone(input) {
  let v = input.value.replace(/\D/g, '');
  if (v.length > 11) v = v.substring(0, 11);
  if (v.length > 10) {
    input.value = v.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  } else if (v.length > 5) {
    input.value = v.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
  } else if (v.length > 2) {
    input.value = v.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
  } else {
    input.value = v;
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
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 3500);
  }
}

// Atalhos de Teclado
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('new-ticket-modal');
      if (modal && modal.classList.contains('active')) {
        closeNewTicketModal();
      }
    }
  });
}
