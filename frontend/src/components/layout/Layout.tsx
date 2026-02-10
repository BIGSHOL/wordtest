import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, token, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-[#E2E8F0]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-12 h-14 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-primary">
            WordLvTest
          </Link>

          {token && (
            <div className="flex items-center gap-4">
              <span className="text-sm text-text-secondary">
                {user?.name}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-12 py-6">
        {children}
      </main>
    </div>
  );
}
