import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Briefcase, DollarSign,
  CheckSquare, BookOpen, BrainCircuit, Menu
} from 'lucide-react';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: CheckSquare, label: 'A Fazeres', path: '/tasks' },
    { icon: Briefcase, label: 'Empresas (Demandas)', path: '/companies' },
    { icon: Users, label: 'CRM (Comercial/Jurídico)', path: '/crm' },
    { icon: DollarSign, label: 'Financeiro (Vertex)', path: '/finance' },
    { icon: BrainCircuit, label: 'IA Insights', path: '/ai-insights' },
    { icon: BookOpen, label: 'Processos & Docs', path: '/docs' },
  ];

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Sidebar */}
      <aside
        className={`${
          isSidebarOpen ? 'w-64' : 'w-16'
        } flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300`}
      >
        <div className="flex items-center justify-between h-14 px-3 border-b border-sidebar-border">
          {isSidebarOpen && (
            <span className="text-lg font-bold text-sidebar-primary">VERTEX ERP</span>
          )}
          <button
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="p-1.5 rounded-md text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {isSidebarOpen && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center justify-end px-6 border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold">VX</span>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
