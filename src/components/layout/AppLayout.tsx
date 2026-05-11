import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Briefcase, DollarSign,
  CheckSquare, BookOpen, BrainCircuit, Menu, LogOut, Settings as SettingsIcon,
  MessageCircle, X, Zap, BarChart2
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: CheckSquare, label: 'A Fazeres', path: '/tasks' },
  { icon: Zap, label: 'Automação', path: '/automation' },
  { icon: Briefcase, label: 'Empresas (Demandas)', path: '/companies' },
  { icon: Users, label: 'CRM (Comercial/Jurídico)', path: '/crm' },
  { icon: DollarSign, label: 'Financeiro (Vertex)', path: '/finance' },
  { icon: BarChart2, label: 'Ads Manager', path: '/ads-manager' },
  { icon: MessageCircle, label: 'WhatsApp', path: '/whatsapp' },
  { icon: BrainCircuit, label: 'IA Insights', path: '/ai-insights' },
  { icon: BookOpen, label: 'Processos & Docs', path: '/docs' },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const isMobile = useIsMobile();
  const [isSidebarOpen, setSidebarOpen] = useState(!isMobile);

  // Close sidebar on mobile when route changes
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [location.pathname, isMobile]);

  // Sync sidebar state when breakpoint changes
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    if (isMobile) setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Mobile overlay */}
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          isMobile
            ? `fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ${
                isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`
            : `${isSidebarOpen ? 'w-64' : 'w-16'} transition-all duration-300`
        } flex flex-col bg-sidebar border-r border-sidebar-border`}
      >
        <div className="flex items-center justify-between h-14 px-3 border-b border-sidebar-border">
          {(isSidebarOpen || isMobile) && (
            <span className="text-lg font-bold text-sidebar-primary">VERTEX ERP</span>
          )}
          <button
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="p-1.5 rounded-md text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-colors"
          >
            {isMobile && isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = item.path === '/'
              ? location.pathname === '/'
              : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => handleNavigate(item.path)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {(isSidebarOpen || isMobile) && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center justify-between px-4 sm:px-6 border-b border-border bg-card/50 backdrop-blur-sm">
          {isMobile && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded-md text-foreground hover:bg-accent transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          {!isMobile && <div />}
          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="h-8 w-8 rounded-full bg-primary flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer">
                  <span className="text-primary-foreground text-xs font-bold">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-xs font-medium text-foreground/60">Conectado como</p>
                  <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleNavigate('/settings')} className="cursor-pointer">
                  <SettingsIcon className="w-4 h-4 mr-2" />
                  Configurações
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}