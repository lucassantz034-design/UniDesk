// API Service for Central Control Plane Backend (Default: http://localhost:4000)

const BASE_URL = import.meta.env.VITE_CENTRAL_API_URL || 'http://localhost:4000';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('master_token') || null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('master_token', token);
    } else {
      localStorage.removeItem('master_token');
    }
  }

  getToken() {
    return this.token;
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          // Limpa sessão e emite evento para logout global da aplicação
          this.setToken(null);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth:unauthorized', { 
              detail: { endpoint, status: 401, message: data.error || 'Sessão expirada ou não autorizada' } 
            }));
          }
        }
        throw new Error(data.error || data.message || `HTTP ${response.status} - Falha na requisição`);
      }
      return data;
    } catch (error) {
      console.error(`[API Error] Requisição para ${url} falhou:`, error.message);
      throw error;
    }
  }

  // Auth Endpoints
  async login(username, password) {
    const res = await this.request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  logout() {
    this.setToken(null);
  }

  // Tenants / Empresas
  async getTenants() {
    return await this.request('/api/v1/tenants');
  }

  async extendLicense(tenantId, days = 15) {
    return await this.request(`/api/v1/tenants/${tenantId}/extend-license`, {
      method: 'POST',
      body: JSON.stringify({ days }),
    });
  }

  // Financeiro / Asaas
  async getFinancialInvoices() {
    return await this.request('/api/v1/billing/invoices');
  }

  // Suporte N2/N3
  async getSupportTickets() {
    return await this.request('/api/v1/support/tickets');
  }

  async replySupportTicket(ticketId, message, newStatus = 'ANSWERED') {
    return await this.request(`/api/v1/support/tickets/${ticketId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message, response: message, status: newStatus }),
    });
  }

  async closeSupportTicket(ticketId) {
    return await this.request(`/api/v1/support/tickets/${ticketId}/close`, {
      method: 'PATCH',
    });
  }
}

export const api = new ApiService();
export default api;
