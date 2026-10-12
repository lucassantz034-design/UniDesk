import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import { wsService } from './services/websocket';
import Header from './components/Header';
import StudentPortal from './pages/StudentPortal';
import AttendantPortal from './pages/AttendantPortal';
import AdminPortal from './pages/AdminPortal';
import ChatWidget from './components/ChatWidget';

export default function App() {
  const [config, setConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('aluno');
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [isChatWidgetOpen, setIsChatWidgetOpen] = useState(false);
  const [users, setUsers] = useState([]);

  // Check URL pathname for direct route access
  useEffect(() => {
    const path = window.location.pathname;
    if (path === '/atendente' || path === '/operador') {
      setActiveTab('atendente');
    } else if (path === '/admin') {
      setActiveTab('admin');
    } else {
      setActiveTab('aluno');
    }
  }, []);

  // Update browser URL history when tab changes without full page reload
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    window.history.pushState({}, '', `/${tab}`);
  };

  // Load config and users
  useEffect(() => {
    const initApp = async () => {
      try {
        const [cfg, u] = await Promise.all([api.getConfig(), api.getUsers()]);
        setConfig(cfg);
        setUsers(u);
      } catch (err) {
        console.error('Erro ao inicializar aplicação:', err);
      }
    };
    initApp();

    // Connect WebSocket
    wsService.connect();
    const unsubscribe = wsService.subscribe((msg) => {
      if (msg.type === 'STATUS_CHANGE') {
        setIsWsConnected(msg.status === 'connected');
      }
    });

    return () => unsubscribe();
  }, []);

  // Apply dynamic institution theme colors
  useEffect(() => {
    if (config) {
      const root = document.documentElement;
      if (config.primaryColor) {
        root.style.setProperty('--primary', config.primaryColor);
        root.style.setProperty('--primary-glow', `${config.primaryColor}30`);
      }
      if (config.secondaryColor) {
        root.style.setProperty('--secondary', config.secondaryColor);
      }
      if (config.accentColor) {
        root.style.setProperty('--accent', config.accentColor);
      }
    }
  }, [config]);

  // Current logged in demo personas
  const studentUser = users.find((u) => u.role === 'student' || u.role === 'aluno') || {
    id: 'usr-stu-2',
    name: 'Larissa Vianna Castro',
    ra: '20230512',
    course: 'Medicina (7º Período)',
    department: 'Medicina',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=80'
  };

  const attendantUser = users.find((u) => u.role === 'attendant' || u.role === 'tecnico') || {
    id: 'usr-att-1',
    name: 'Mariana Alencar',
    department: 'Secretaria Acadêmica',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80'
  };

  const adminUser = users.find((u) => u.role === 'admin' || u.role === 'admin_faculdade') || {
    id: 'usr-admin',
    name: 'Prof. Dr. Roberto Guimarães',
    department: 'Diretoria de Tecnologia e Operações',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80'
  };

  const currentUser = activeTab === 'aluno' ? studentUser : activeTab === 'atendente' ? attendantUser : adminUser;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      {/* Top Navbar */}
      <Header
        config={config}
        isWsConnected={isWsConnected}
        currentUser={currentUser}
      />

      {/* Main View Module */}
      <main style={{ flex: 1, paddingBottom: '3rem' }}>
        {activeTab === 'aluno' && (
          <StudentPortal
            config={config}
            studentUser={studentUser}
            onOpenChatWidget={() => setIsChatWidgetOpen(true)}
          />
        )}

        {activeTab === 'atendente' && (
          <AttendantPortal
            config={config}
            attendantUser={attendantUser}
          />
        )}

        {activeTab === 'admin' && (
          <AdminPortal
            config={config}
            onConfigUpdate={(newCfg) => setConfig(newCfg)}
          />
        )}
      </main>

      {/* Floating Chat Widget with Sophia IA */}
      <ChatWidget
        config={config}
        isOpen={isChatWidgetOpen}
        setIsOpen={setIsChatWidgetOpen}
        studentUser={studentUser}
      />
    </div>
  );
}
