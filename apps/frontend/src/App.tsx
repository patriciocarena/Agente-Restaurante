import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import Onboarding from './pages/Onboarding';
import ResetPassword from './pages/ResetPassword';
import MenuEditor from './pages/MenuEditor';
import Settings from './pages/Settings';
import { ProtectedRoute } from './pages/ProtectedRoute';
import { OnboardingGate } from './lib/onboarding-guard';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
        <Route path="/menu" element={<ProtectedRoute><OnboardingGate><MenuEditor /></OnboardingGate></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><OnboardingGate><Settings /></OnboardingGate></ProtectedRoute>} />
        <Route path="/reset-password" element={<ProtectedRoute><ResetPassword /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
