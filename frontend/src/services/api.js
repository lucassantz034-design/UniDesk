const API_BASE = '/api';

async function fetchJSON(url, options = {}) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    let errorMsg = `Erro na requisição: ${res.status}`;
    try {
      const err = await res.json();
      if (err.error) errorMsg = err.error;
    } catch (_) {}
    throw new Error(errorMsg);
  }
  return res.json();
}

export const api = {
  // Config
  getConfig: () => fetchJSON('/config'),
  updateConfig: (cfg) => fetchJSON('/config', { method: 'PUT', body: JSON.stringify(cfg) }),

  // Users
  getUsers: (role) => fetchJSON(`/users${role ? `?role=${role}` : ''}`),
  getUserById: (id) => fetchJSON(`/users/${id}`),
  addUser: (data) => fetchJSON('/users', { method: 'POST', body: JSON.stringify(data) }),

  // Categories
  getCategories: () => fetchJSON('/categories'),

  // Tickets
  getTickets: (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.studentId) params.append('studentId', filters.studentId);
    if (filters.attendantId) params.append('attendantId', filters.attendantId);
    if (filters.status) params.append('status', filters.status);
    if (filters.categoryId) params.append('categoryId', filters.categoryId);
    const qs = params.toString();
    return fetchJSON(`/tickets${qs ? `?${qs}` : ''}`);
  },
  getTicketById: (id) => fetchJSON(`/tickets/${id}`),
  createTicket: (data) => fetchJSON('/tickets', { method: 'POST', body: JSON.stringify(data) }),
  addTicketMessage: (ticketId, data) => fetchJSON(`/tickets/${ticketId}/messages`, { method: 'POST', body: JSON.stringify(data) }),
  updateTicketStatus: (ticketId, status, csatScore) => fetchJSON(`/tickets/${ticketId}/status`, { method: 'PATCH', body: JSON.stringify({ status, csatScore }) }),

  // AI Student Context
  getStudentAIContext: (studentId) => fetchJSON(`/students/${studentId}/ai-context`),

  // FAQ
  getFAQ: (search = '', categoryId = '') => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (categoryId) params.append('categoryId', categoryId);
    const qs = params.toString();
    return fetchJSON(`/faq${qs ? `?${qs}` : ''}`);
  },

  // Live Chat Sessions & Sophia Bot
  getChatSessions: () => fetchJSON('/chat/sessions'),
  getChatSession: (id) => fetchJSON(`/chat/sessions/${id}`),
  startChatSession: (studentId, department) => fetchJSON('/chat/start', { method: 'POST', body: JSON.stringify({ studentId, department }) }),
  sendChatMessage: (sessionId, data) => fetchJSON(`/chat/${sessionId}/messages`, { method: 'POST', body: JSON.stringify(data) }),
  escalateChatSession: (sessionId, department) => fetchJSON(`/chat/${sessionId}/escalate`, { method: 'POST', body: JSON.stringify({ department }) }),

  // Admin Metrics & Health
  getAdminMetrics: () => fetchJSON('/admin/metrics'),
  getHealth: () => fetchJSON('/health'),
  sendHeartbeat: () => fetchJSON('/telemetry/heartbeat', { method: 'POST' }),

  // Relational SQL Spec
  getSQLStats: () => fetchJSON('/sql/chamados/stats'),
  getSQLTecnicosRating: () => fetchJSON('/sql/tecnicos-rating'),
  getSQLAlunosRating: () => fetchJSON('/sql/alunos-rating'),
  getSQLUsersByRole: () => fetchJSON('/sql/users-by-role'),
  getSQLLogsAdmin: () => fetchJSON('/sql/logs-admin'),
  createSQLUser: (data) => fetchJSON('/sql/users', { method: 'POST', body: JSON.stringify(data) }),
  resetSQLPassword: (userId, data) => fetchJSON(`/sql/users/${userId}/reset-password`, { method: 'POST', body: JSON.stringify(data) }),
  inactivateSQLUser: (userId, data) => fetchJSON(`/sql/users/${userId}/inactivate`, { method: 'POST', body: JSON.stringify(data) }),
  rateSQLTecnico: (data) => fetchJSON('/sql/ratings/tecnico', { method: 'POST', body: JSON.stringify(data) }),
  rateSQLAluno: (data) => fetchJSON('/sql/ratings/aluno', { method: 'POST', body: JSON.stringify(data) }),
};
