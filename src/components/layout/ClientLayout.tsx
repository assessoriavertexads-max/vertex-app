import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, MessageCircle, FileText, LayoutDashboard } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ClientLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen w-full bg-background">
      {/* Slim sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">
        <div className="flex items-center h-14 px-4 border-b border-sidebar-border">
          <span className="text-base font-bold text-sidebar-primary">Portal do Cliente</span>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          <button
            onClick={() => navigate('/client-portal')}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm bg-sidebar-primary text-sidebar-primary-foreground font-medium"
          >
            <LayoutDashboard className="h-5 w-5 flex-shrink-0" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => navigate('/client-portal')}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          >
            <FileText className="h-5 w-5 flex-shrink-0" />
            <span>Meus Boletos</span>
          </button>
        </nav>

        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 flex items-center justify-between px-6 border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="text-sm text-muted-foreground">
            {profile?.company_id ? 'Bem-vindo ao seu portal' : ''}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-8 w-8 rounded-full bg-primary flex items-center justify-center hover:opacity-80 transition-opacity cursor-pointer">
                <span className="text-primary-foreground text-xs font-bold">
                  {user?.email?.charAt(0).toUpperCase() || 'C'}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-xs font-medium text-foreground/60">Conectado como</p>
                <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 hover:text-red-700 hover:bg-red-50">
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
