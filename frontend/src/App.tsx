import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { RouteGuard } from './components/auth/RouteGuard';
import './index.css';

// Auto-reload on chunk load failure (stale deployment)
function lazyRetry<T extends { default: React.ComponentType }>(
  factory: () => Promise<T>,
) {
  return lazy(() =>
    factory().catch(() => {
      const reloaded = sessionStorage.getItem('chunk_reload');
      if (!reloaded) {
        sessionStorage.setItem('chunk_reload', '1');
        window.location.reload();
        return new Promise<T>(() => {}); // hang until page reloads
      }
      sessionStorage.removeItem('chunk_reload');
      return factory();
    }),
  );
}

// Lazy-loaded pages for code splitting
const ProfilePage = lazyRetry(() => import('./pages/teacher/ProfilePage'));
const DashboardPage = lazyRetry(() => import('./pages/teacher/DashboardPage'));
const StudentManagePage = lazyRetry(() => import('./pages/teacher/StudentManagePage'));
const WordDatabasePage = lazyRetry(() => import('./pages/teacher/WordDatabasePage'));
const TestSettingsPage = lazyRetry(() => import('./pages/teacher/TestSettingsPage'));
const StatisticsPage = lazyRetry(() => import('./pages/teacher/StatisticsPage'));
const AnalysisPage = lazyRetry(() => import('./pages/teacher/AnalysisPage'));
const AllTestResultsPage = lazyRetry(() => import('./pages/teacher/AllTestResultsPage'));
const StudentResultPage = lazyRetry(() => import('./pages/teacher/StudentResultPage'));
const MasteryReportPage = lazyRetry(() => import('./pages/teacher/MasteryReportPage'));
const TeacherManagePage = lazyRetry(() => import('./pages/teacher/TeacherManagePage'));
const StudentMainPage = lazyRetry(() => import('./pages/student/MainPage'));
const TestStartPage = lazyRetry(() => import('./pages/student/TestStartPage'));
const UnifiedTestPage = lazyRetry(() => import('./pages/student/UnifiedTestPage'));
const StudentReportPage = lazyRetry(() => import('./pages/student/StudentReportPage'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Teacher */}
          <Route
            path="/dashboard"
            element={
              <RouteGuard roles={['teacher']}>
                <DashboardPage />
              </RouteGuard>
            }
          />
          <Route
            path="/students"
            element={
              <RouteGuard roles={['teacher']}>
                <StudentManagePage />
              </RouteGuard>
            }
          />
          <Route
            path="/students/:studentId/results"
            element={
              <RouteGuard roles={['teacher']}>
                <StudentResultPage />
              </RouteGuard>
            }
          />
          <Route
            path="/students/:studentId/mastery/:sessionId"
            element={
              <RouteGuard roles={['teacher']}>
                <MasteryReportPage />
              </RouteGuard>
            }
          />
          <Route
            path="/words"
            element={
              <RouteGuard roles={['teacher']}>
                <WordDatabasePage />
              </RouteGuard>
            }
          />
          <Route
            path="/test-settings"
            element={
              <RouteGuard roles={['teacher']}>
                <TestSettingsPage />
              </RouteGuard>
            }
          />
          <Route
            path="/statistics"
            element={
              <RouteGuard roles={['teacher']}>
                <StatisticsPage />
              </RouteGuard>
            }
          />
          <Route
            path="/test-results"
            element={
              <RouteGuard roles={['teacher']}>
                <AllTestResultsPage />
              </RouteGuard>
            }
          />
          <Route
            path="/analysis"
            element={
              <RouteGuard roles={['teacher']}>
                <AnalysisPage />
              </RouteGuard>
            }
          />
          <Route
            path="/teachers"
            element={
              <RouteGuard roles={['master']}>
                <TeacherManagePage />
              </RouteGuard>
            }
          />
          <Route
            path="/profile"
            element={
              <RouteGuard>
                <ProfilePage />
              </RouteGuard>
            }
          />

          {/* Student */}
          <Route
            path="/student"
            element={
              <RouteGuard roles={['student']}>
                <StudentMainPage />
              </RouteGuard>
            }
          />
          <Route
            path="/test/start"
            element={<TestStartPage />}
          />
          <Route
            path="/mastery-report/:sessionId"
            element={<StudentReportPage />}
          />
          <Route
            path="/unified-test"
            element={<UnifiedTestPage />}
          />
          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  );
}

export default App;
