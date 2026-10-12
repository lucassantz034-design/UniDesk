// Real-time WebSocket connection to the Go backend Gateway

class WebSocketService {
  constructor() {
    this.ws = null;
    this.listeners = new Set();
    this.isConnected = false;
    this.reconnectAttempts = 0;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.notify({ type: 'STATUS_CHANGE', status: 'connected' });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.notify(data);
        } catch (err) {
          console.error('Erro ao interpretar mensagem WS:', err);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.notify({ type: 'STATUS_CHANGE', status: 'disconnected' });
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('WebSocket error:', err);
      };
    } catch (e) {
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    setTimeout(() => this.connect(), delay);
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(data) {
    this.listeners.forEach((callback) => {
      try {
        callback(data);
      } catch (err) {
        console.error('Erro no listener WS:', err);
      }
    });
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

export const wsService = new WebSocketService();
