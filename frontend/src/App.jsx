import React, { useState, useEffect } from 'react';
import { api } from './services/api';
import { wsService } from './services/websocket';
import Header from './components/Header';
import StudentPortal from './pages/StudentPortal';
import AttendantPortal from './pages/AttendantPortal';
import AdminPortal from './pages/AdminPortal';
import ChatWidget from './components/ChatWidget';
import LoginView from './components/LoginView';

export default function App() {
  const [config, setConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('aluno');
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [isChatWidgetOpen, setIsChatWidgetOpen] = useState(false);
  const [users, setUsers] = useState([]);

  // Authenticated users state (persisted in localStorage)
  const [loggedInStudent, setLoggedInStudent] = useState(() => {
    try {
      const saved = localStorage.getItem('unidesk_student_user');
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  });

  const [loggedInAttendant, setLoggedInAttendant] = useState(() => {
    try {
      const saved = localStorage.getItem('unidesk_attendant_user');
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  });

  const [loggedInAdmin, setLoggedInAdmin] = useState(() => {
    try {
      const saved = localStorage.getItem('unidesk_admin_user');
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  });

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

        // If no user is logged in yet, auto-populate with first demo persona for instant convenience if desired
        // Or leave null so the student/attendant can test the email login right away
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

  // Auth Handlers
  const handleLoginStudent = (user, token) => {
    setLoggedInStudent(user);
    localStorage.setItem('unidesk_student_user', JSON.stringify(user));
  };

  const handleLogoutStudent = () => {
    setLoggedInStudent(null);
    localStorage.removeItem('unidesk_student_user');
  };

  const handleLoginAttendant = (user, token) => {
    setLoggedInAttendant(user);
    localStorage.setItem('unidesk_attendant_user', JSON.stringify(user));
  };

  const handleLogoutAttendant = () => {
    setLoggedInAttendant(null);
    localStorage.removeItem('unidesk_attendant_user');
  };

  const handleLogoutAdmin = () => {
    setLoggedInAdmin(null);
    localStorage.removeItem('unidesk_admin_user');
  };

  // Default Admin profile
  const adminUser = loggedInAdmin || users.find((u) => u.role === 'admin' || u.role === 'admin_faculdade') || {
    id: 'usr-admin',
    name: 'Prof. Dr. Roberto Guimarães',
    email: 'admin@metropolitana.edu.br',
    department: 'Diretoria de Tecnologia e Operações',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80'
  };

  const isCurrentLoggedIn = activeTab === 'aluno'
    ? !!loggedInStudent
    : activeTab === 'atendente'
    ? !!loggedInAttendant
    : true;

  const currentUser = activeTab === 'aluno'
    ? loggedInStudent
    : activeTab === 'atendente'
    ? loggedInAttendant
    : adminUser;

  const handleCurrentLogout = activeTab === 'aluno'
    ? handleLogoutStudent
    : activeTab === 'atendente'
    ? handleLogoutAttendant
    : handleLogoutAdmin;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      {/* Top Navbar */}
      <Header
        config={config}
        isWsConnected={isWsConnected}
        currentUser={currentUser}
        isLoggedIn={isCurrentLoggedIn}
        onLogout={handleCurrentLogout}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {/* Main View Module */}
      <main style={{ flex: 1, paddingBottom: activeTab === 'atendente' ? 0 : '3rem', display: 'flex', flexDirection: 'column' }}>
        {/* Portal do Aluno */}
        {activeTab === 'aluno' && (
          !loggedInStudent ? (
            <LoginView
              config={config}
              role="aluno"
              onLoginSuccess={handleLoginStudent}
              onSwitchPortal={() => handleTabChange('atendente')}
            />
          ) : (
            <StudentPortal
              config={config}
              studentUser={loggedInStudent}
              onOpenChatWidget={() => setIsChatWidgetOpen(true)}
              onLogout={handleLogoutStudent}
            />
          )
        )}

        {/* Painel do Atendente */}
        {activeTab === 'atendente' && (
          !loggedInAttendant ? (
            <LoginView
              config={config}
              role="atendente"
              onLoginSuccess={handleLoginAttendant}
              onSwitchPortal={() => handleTabChange('aluno')}
            />
          ) : (
            <AttendantPortal
              config={config}
              attendantUser={loggedInAttendant}
              onLogout={handleLogoutAttendant}
            />
          )
        )}

        {/* Painel Administrativo */}
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
        studentUser={loggedInStudent || { name: 'Aluno Visitante', ra: 'N/A' }}
      />
    </div>
  );
}
