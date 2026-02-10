
import React, { useState, useEffect } from 'react';
import { UserRole, User } from './types';
import { StorageService } from './services/storageService';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CreateQuiz from './pages/CreateQuiz';
import GlobalSearch from './pages/GlobalSearch';
import History from './pages/History';
import Login from './pages/Login';
import Register from './pages/Register';
import HomePage from './pages/HomePage';
import PublicGallery from './pages/PublicGallery';
import InboxPage from './pages/InboxPage'; 
import UserManagement from './components/Admin/UserManagement';
import SystemLogs from './components/Admin/SystemLogs';
import SiteSettings from './components/Admin/SiteSettings';
import CloudDatabase from './components/Admin/CloudDatabase';
import PublicManagement from './components/Admin/PublicManagement';
import ApiKeyManagement from './components/Admin/ApiKeyManagement';
import PaymentSettingsPanel from './components/Admin/PaymentSettings';
import EmailSettingsPanel from './components/Admin/EmailSettings';
import BackupRestore from './components/Admin/BackupRestore';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTabState] = useState('home');
  const [isInitialized, setIsInitialized] = useState(false);

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    localStorage.setItem('quizgen_active_tab', tab);
  };

  useEffect(() => {
    const initApp = async () => {
      await StorageService.init();
      const token = localStorage.getItem('quizgen_auth_token');
      const savedTab = localStorage.getItem('quizgen_active_tab');

      if (token) {
        const decodedUser = await StorageService.verifyToken(token);
        if (decodedUser) {
          const allUsers = await StorageService.getUsers();
          const freshUser = allUsers.find(u => u.id === decodedUser.id);
          
          if (freshUser && freshUser.isActive) {
            setUser(freshUser);
            if (savedTab && !['home', 'login', 'gallery', 'register'].includes(savedTab)) {
              setActiveTabState(savedTab);
            } else {
              setActiveTab('dashboard');
            }
          } else {
            handleLogout();
          }
        } else {
          handleLogout();
        }
      } else {
        setActiveTabState(savedTab || 'home');
      }
      setIsInitialized(true);
    };
    initApp();
  }, []);

  const handleLogin = async (loggedUser: User) => {
    const token = await StorageService.createToken(loggedUser);
    localStorage.setItem('quizgen_auth_token', token);
    
    setUser(loggedUser);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('quizgen_auth_token');
    setActiveTab('home');
  };

  if (!isInitialized) return (
    <div className="h-screen flex flex-col items-center justify-center orange-gradient text-white font-black">
      <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4"></div>
      <p className="uppercase tracking-[0.3em] animate-pulse">Initializing GenZ Engine...</p>
    </div>
  );

  if (activeTab === 'home') return <HomePage onLoginClick={() => setActiveTab('login')} onGalleryClick={() => setActiveTab('gallery')} />;
  if (activeTab === 'gallery') return <div className="relative"><PublicGallery /><button onClick={() => setActiveTab('home')} className="fixed top-8 left-8 px-6 py-3 bg-white text-orange-600 font-black rounded-2xl shadow-2xl z-[100] border-2 border-orange-50">⬅ KEMBALI</button></div>;
  if (activeTab === 'login') return <div className="relative"><Login onLogin={handleLogin} onRegister={() => setActiveTab('register')} /><button onClick={() => setActiveTab('home')} className="absolute top-8 left-8 px-6 py-3 bg-white text-orange-600 font-black rounded-xl shadow-lg z-50">⬅ BERANDA</button></div>;
  if (activeTab === 'register') return <Register onBack={() => setActiveTab('login')} />;

  if (!user) return <Login onLogin={handleLogin} onRegister={() => setActiveTab('register')} />;

  return (
    <Layout user={user} onLogout={handleLogout} activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && <Dashboard user={user} />}
      {activeTab === 'create' && <CreateQuiz user={user} onSuccess={() => setActiveTab('history')} />}
      {activeTab === 'globalsearch' && <GlobalSearch />}
      {activeTab === 'history' && <History user={user} />}
      {activeTab === 'emails' && <InboxPage user={user} />}
      {activeTab === 'users' && <UserManagement />}
      {activeTab === 'apikeys' && <ApiKeyManagement />}
      {activeTab === 'payments' && <PaymentSettingsPanel />}
      {activeTab === 'email-settings' && <EmailSettingsPanel />}
      {activeTab === 'logs' && <SystemLogs />}
      {activeTab === 'settings' && <SiteSettings />}
      {activeTab === 'cloud' && <CloudDatabase />}
      {activeTab === 'public' && <PublicManagement />}
      {activeTab === 'backup' && <BackupRestore />}
    </Layout>
  );
};

export default App;
