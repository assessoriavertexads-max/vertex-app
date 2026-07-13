import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ('agencia' | 'cliente')[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Se profile ainda não carregou (null), trata como agência para não bloquear
  // usuários existentes que ainda não têm linha na tabela profiles.
  const role = profile?.role ?? 'agencia';

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={role === 'cliente' ? '/client-portal' : '/'} replace />;
  }

  return <>{children}</>;
};
