/**
 * Role-based route guard component.
 */
import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';

interface RouteGuardProps {
  children: React.ReactNode;
  roles?: ('teacher' | 'student')[];
}

export function RouteGuard({ children, roles }: RouteGuardProps) {
  const { token, user, isLoading, fetchUser } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (token && !user) {
      fetchUser();
    }
  }, [token, user, fetchUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && user && !roles.includes(user.role)) {
    const redirect = user.role === 'teacher' ? '/dashboard' : '/student';
    return <Navigate to={redirect} replace />;
  }

  return <>{children}</>;
}

export default RouteGuard;
