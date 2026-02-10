import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { RouteGuard } from './components/auth/RouteGuard';
import './index.css';

// Lazy-loaded pages for code splitting
const ProfilePage = lazy(() => import('./pages/teacher/ProfilePage'));
const DashboardPage = lazy(() => import('./pages/teacher/DashboardPage'));
const StudentManagePage = lazy(() => import('./pages/teacher/StudentManagePage'));
const WordDatabasePage = lazy(() => import('./pages/teacher/WordDatabasePage'));
const TestSettingsPage = lazy(() => import('./pages/teacher/TestSettingsPage'));
const StatisticsPage = lazy(() => import('./pages/teacher/StatisticsPage'));
const StudentResultPage = lazy(() => import('./pages/teacher/StudentResultPage'));
const StudentMainPage = lazy(() => import('./pages/student/MainPage'));
const TestStartPage = lazy(() => import('./pages/student/TestStartPage'));
const TestPage = lazy(() => import('./pages/student/TestPage'));
const ResultPage = lazy(() => import('./pages/student/ResultPage'));
const WrongWordsPage = lazy(() => import('./pages/student/WrongWordsPage'));

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
            element={
              <RouteGuard roles={['student']}>
                <TestStartPage />
              </RouteGuard>
            }
          />
          <Route
            path="/test"
            element={
              <RouteGuard roles={['student']}>
                <TestPage />
              </RouteGuard>
            }
          />
          <Route
            path="/result/:testId"
            element={
              <RouteGuard roles={['student']}>
                <ResultPage />
              </RouteGuard>
            }
          />
          <Route
            path="/result/:testId/wrong"
            element={
              <RouteGuard roles={['student']}>
                <WrongWordsPage />
              </RouteGuard>
            }
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
