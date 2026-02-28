import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  BookA,
  Languages,
  Database,
  TrendingUp,
  BarChart3,
  ClipboardList,
  LogOut,
  UserCog,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

interface TeacherLayoutProps {
  children: React.ReactNode;
}

const baseNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: '대시보드' },
  { to: '/students', icon: Users, label: '학생 관리' },
  { to: '/test-settings', icon: BookA, label: '단어 테스트' },
  { to: '/grammar-settings', icon: Languages, label: '문법 테스트' },
  { to: '/words', icon: Database, label: '데이터베이스' },
  { to: '/test-results', icon: ClipboardList, label: '테스트 결과' },
  { to: '/statistics', icon: TrendingUp, label: '통계' },
  { to: '/analysis', icon: BarChart3, label: '분석' },
];

const masterNavItems = [
  { to: '/teachers', icon: UserCog, label: '선생님 관리' },
];

function getSidebarCollapsed(): boolean {
  try { return localStorage.getItem('sidebar_collapsed') === '1'; } catch { return false; }
}

export function TeacherLayout({ children }: TeacherLayoutProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(getSidebarCollapsed);

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('sidebar_collapsed', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  const navItems = user?.role === 'master'
    ? [...baseNavItems, ...masterNavItems]
    : baseNavItems;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen min-w-[1024px]">
      {/* Sidebar */}
      <aside
        className="bg-surface border-r border-border-subtle flex flex-col shrink-0 transition-[width] duration-200"
        style={{ width: collapsed ? 68 : 260 }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3" style={{ padding: collapsed ? '0 14px' : '0 24px' }}>
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
            style={{
              background: 'linear-gradient(135deg, #2D9CAE 0%, #3DBDC8 100%)',
            }}
          >
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <span className="font-display text-[20px] font-extrabold text-text-primary whitespace-nowrap">
              WordTest
            </span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 pt-6 pb-2" style={{ padding: collapsed ? '24px 8px 8px' : '24px 12px 8px' }}>
          {/* Menu label */}
          {!collapsed && (
            <div className="px-[14px] mb-3">
              <p
                className="text-[11px] font-semibold text-[#9C9B99] uppercase"
                style={{ letterSpacing: '1px' }}
              >
                메뉴
              </p>
            </div>
          )}

          {/* Nav items */}
          <div className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center h-11 rounded-[10px] text-sm transition-colors ${
                    collapsed ? 'justify-center' : 'gap-3 px-[14px]'
                  } ${
                    isActive
                      ? 'bg-[#EBF8FA] text-teal font-semibold'
                      : 'text-[#3D3C3A] hover:bg-bg-muted'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className="w-[18px] h-[18px] shrink-0"
                      style={{ color: isActive ? '#2D9CAE' : '#6D6C6A' }}
                    />
                    {!collapsed && (
                      <span className={isActive ? 'font-semibold' : 'font-medium'}>
                        {item.label}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Collapse toggle */}
        <div style={{ padding: collapsed ? '0 8px 4px' : '0 12px 4px' }}>
          <button
            onClick={toggleCollapsed}
            className="flex items-center h-9 rounded-[10px] text-sm text-[#9C9B99] hover:bg-bg-muted hover:text-text-secondary transition-colors w-full"
            style={{ justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? 0 : '0 14px', gap: collapsed ? 0 : 12 }}
            title={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
          >
            {collapsed
              ? <PanelLeftOpen className="w-[18px] h-[18px]" />
              : <PanelLeftClose className="w-[18px] h-[18px]" />
            }
            {!collapsed && <span className="text-[12px] font-medium">메뉴 접기</span>}
          </button>
        </div>

        {/* User section */}
        <div className="border-t border-border-subtle" style={{ padding: collapsed ? '12px 8px' : '16px' }}>
          <div
            className={`flex items-center cursor-pointer rounded-lg hover:bg-bg-muted transition-colors ${collapsed ? 'justify-center p-1.5' : 'gap-3 mb-3 p-1 -m-1'}`}
            onClick={() => navigate('/profile')}
            title="프로필 / 비밀번호 변경"
          >
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, #2D9CAE 0%, #3DBDC8 100%)',
              }}
            >
              <span className="text-sm font-semibold text-white">
                {user?.name?.charAt(0) || 'T'}
              </span>
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {user?.name}
                </p>
                <p className="text-xs text-text-tertiary">{user?.role === 'master' ? '마스터' : '선생님'}</p>
              </div>
            )}
          </div>
          {!collapsed ? (
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-secondary bg-[#F5F4F1] border border-[#E8E8E6] hover:text-wrong hover:bg-wrong-light rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              로그아웃
            </button>
          ) : (
            <button
              onClick={handleLogout}
              className="flex items-center justify-center w-full h-9 rounded-[10px] text-[#9C9B99] hover:text-wrong hover:bg-wrong-light transition-colors mt-2"
              title="로그아웃"
            >
              <LogOut className="w-[18px] h-[18px]" />
            </button>
          )}
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
