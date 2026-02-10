
import React, { useState, useEffect } from 'react';
import { UserRole } from '../types';
import { StorageService } from '../services/storageService';
import { 
  LayoutDashboard, 
  Sparkles, 
  Search, 
  History, 
  Mail, 
  Globe, 
  Users, 
  Key, 
  CreditCard, 
  AtSign, 
  ScrollText, 
  Settings, 
  Cloud, 
  Package, 
  Home, 
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  user: { username: string; role: UserRole } | null;
  onLogout: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

// Fixed: Component must return JSX and be exported as default to satisfy React.FC and import statements
const Layout: React.FC<LayoutProps> = ({ children, user, onLogout, activeTab, setActiveTab }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const isCloud = !StorageService.isLocal();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!user) return <>{children}</>;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} />, roles: [UserRole.ADMIN, UserRole.TEACHER] },
    { id: 'create', label: 'Buat Quiz', icon: <Sparkles size={20} />, roles: [UserRole.ADMIN, UserRole.TEACHER] },
    { id: 'globalsearch', label: 'Pencarian Global', icon: <Search size={20} />, roles: [UserRole.ADMIN, UserRole.TEACHER] },
    { id: 'history', label: 'Riwayat', icon: <History size={20} />, roles: [UserRole.ADMIN, UserRole.TEACHER] },
    { id: 'emails', label: 'Inbox', icon: <Mail size={20} />, roles: [UserRole.ADMIN, UserRole.TEACHER] },
    { id: 'public', label: 'Bank Soal', icon: <Globe size={20} />, roles: [UserRole.ADMIN] },
    { id: 'users', label: 'User Management', icon: <Users size={20} />, roles: [UserRole.ADMIN] },
    { id: 'apikeys', label: 'API Keys', icon: <Key size={20} />, roles: [UserRole.ADMIN] },
    { id: 'payments', label: 'Payments', icon: <CreditCard size={20} />, roles: [UserRole.ADMIN] },
    { id: 'email-settings', label: 'Email Config', icon: <AtSign size={20} />, roles: [UserRole.ADMIN] },
    { id: 'logs', label: 'System Logs', icon: <ScrollText size={20} />, roles: [UserRole.ADMIN] },
    { id: 'settings', label: 'Site Settings', icon: <Settings size={20} />, roles: [UserRole.ADMIN] },
    { id: 'cloud', label: 'Cloud DB', icon: <Cloud size={20} />, roles: [UserRole.ADMIN] },
    { id: 'backup', label: 'Backup', icon: <Package size={20} />, roles: [UserRole.ADMIN] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(user.role));

  return (
    <div className="flex h-screen bg-[#fffaf0] overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className={`${isSidebarOpen ? 'w-72' : 'w-20'} bg-white border-r border-orange-100 transition-all duration-300 flex flex-col z-50`}>
        <div className="p-6 flex items-center justify-between">
          {isSidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 orange-gradient rounded-lg flex items-center justify-center text-white font-black text-lg shadow-lg">Q</div>
              <span className="text-xl font-black tracking-tighter text-gray-800">QuizGen<span className="text-orange-500">Pro</span></span>
            </div>
          )}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-orange-50 rounded-xl text-gray-400">
            {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-2 custom-scrollbar">
          {filteredMenu.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${
                activeTab === item.id 
                ? 'bg-orange-500 text-white shadow-lg shadow-orange-200' 
                : 'text-gray-500 hover:bg-orange-50 hover:text-orange-500'
              }`}
            >
              <span className="shrink-0">{item.icon}</span>
              {isSidebarOpen && <span className="font-bold text-sm whitespace-nowrap">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-orange-50 space-y-2">
          {isSidebarOpen && (
            <div className="p-4 bg-orange-50 rounded-2xl mb-4">
              <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Active User</div>
              <div className="font-bold text-gray-800 truncate">{user.username}</div>
              <div className="text-[9px] text-orange-600 font-bold uppercase">{user.role}</div>
            </div>
          )}
          <button onClick={onLogout} className="w-full flex items-center gap-4 p-4 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all">
            <span className="shrink-0"><LogOut size={20} /></span>
            {isSidebarOpen && <span className="font-bold text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-16 bg-white border-b border-orange-100 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <div className="text-xs font-black text-gray-400 uppercase tracking-widest">
              {filteredMenu.find(m => m.id === activeTab)?.label || 'System'}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`}></span>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{isOnline ? 'System Online' : 'Offline'}</span>
            </div>
            {isCloud && (
              <div className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-blue-100 flex items-center gap-2">
                <Cloud size={12} /> Cloud Turso
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
