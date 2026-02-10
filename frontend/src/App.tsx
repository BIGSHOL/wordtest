import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { ProfilePage } from './pages/teacher/ProfilePage';
import { DashboardPage } from './pages/teacher/DashboardPage';
import { StudentManagePage } from './pages/teacher/StudentManagePage';
import { StudentMainPage } from './pages/student/MainPage';
import { TestPage } from './pages/student/TestPage';
import { ResultPage } from './pages/student/ResultPage';
import { StudentResultPage } from './pages/teacher/StudentResultPage';
import { RouteGuard } from './components/auth/RouteGuard';
import './index.css';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background">
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

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
