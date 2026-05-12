import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  /** If set, only users with these roles can access this route. */
  allowedRoles?: ('agencia' | 'cliente')[];
}

export const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Profile not loaded yet — keep spinner (brief gap after signup trigger)
  if (user && !profile) {
    return (
      <div className="flex h-full items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    // Send clients to the portal, agencies to the main dashboard
    return <Navigate to={profile.role === 'cliente' ? '/client-portal' : '/'} replace />;
  }

  return <>{children}</>;
};
