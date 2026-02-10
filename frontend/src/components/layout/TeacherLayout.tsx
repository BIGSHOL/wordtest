import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Settings,
  BarChart3,
  LogOut,
  GraduationCap,
} from 'lucide-react';

interface TeacherLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: '대시보드' },
  { to: '/students', icon: Users, label: '학생 관리' },
  { to: '/words', icon: BookOpen, label: '단어 DB' },
  { to: '/test-settings', icon: Settings, label: '테스트 설정' },
  { to: '/statistics', icon: BarChart3, label: '통계' },
];

export function TeacherLayout({ children }: TeacherLayoutProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-[260px] bg-surface border-r border-border-subtle flex flex-col shrink-0">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <span className="font-display text-lg font-bold text-text-primary tracking-tight">
            WordTest
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-light text-teal font-semibold'
                    : 'text-text-secondary hover:bg-bg-muted hover:text-text-primary'
                }`
              }
            >
              <item.icon className="w-[18px] h-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-border-subtle p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-teal-light flex items-center justify-center">
              <span className="text-sm font-semibold text-teal">
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
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-secondary hover:text-wrong hover:bg-wrong-light rounded-lg transition-colors"
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
