import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Settings,
  Database,
  TrendingUp,
  BarChart3,
  LogOut,
} from 'lucide-react';

interface TeacherLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: '대시보드' },
  { to: '/students', icon: Users, label: '학생 관리' },
  { to: '/test-settings', icon: Settings, label: '테스트 설정' },
  { to: '/words', icon: Database, label: '데이터베이스' },
  { to: '/statistics', icon: TrendingUp, label: '통계' },
  { to: '/analysis', icon: BarChart3, label: '분석' },
];

export function TeacherLayout({ children }: TeacherLayoutProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen min-w-[1024px]">
      {/* Sidebar */}
      <aside className="w-[260px] bg-surface border-r border-border-subtle flex flex-col shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #2D9CAE 0%, #3DBDC8 100%)',
            }}
          >
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <span className="font-display text-[20px] font-extrabold text-text-primary">
            WordTest
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 pt-6 pb-2">
          {/* Menu label */}
          <div className="px-[14px] mb-3">
            <p
              className="text-[11px] font-semibold text-[#9C9B99] uppercase"
              style={{ letterSpacing: '1px' }}
            >
              메뉴
            </p>
          </div>

          {/* Nav items */}
          <div className="space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-[14px] h-11 rounded-[10px] text-sm transition-colors ${
                    isActive
                      ? 'bg-[#EBF8FA] text-teal font-semibold'
                      : 'text-[#3D3C3A] hover:bg-bg-muted'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className="w-[18px] h-[18px]"
                      style={{ color: isActive ? '#2D9CAE' : '#6D6C6A' }}
                    />
                    <span className={isActive ? 'font-semibold' : 'font-medium'}>
                      {item.label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* User section */}
        <div className="border-t border-border-subtle p-4">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #2D9CAE 0%, #3DBDC8 100%)',
              }}
            >
              <span className="text-sm font-semibold text-white">
                {user?.name?.charAt(0) || 'T'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {user?.name}
              </p>
              <p className="text-xs text-text-tertiary">선생님</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-secondary bg-[#F5F4F1] border border-[#E8E8E6] hover:text-wrong hover:bg-wrong-light rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-[#F8F8F6] overflow-auto">
        <div className="p-7 px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
