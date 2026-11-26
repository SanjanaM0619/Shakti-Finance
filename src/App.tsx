import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppShell } from './components/AppShell';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { SalesPage } from './pages/SalesPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { SeparationPage } from './pages/SeparationPage';
import { CustomersPage } from './pages/CustomersPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { VoiceEntryPage } from './pages/VoiceEntryPage';
import { HealthPage } from './pages/HealthPage';
import { ForecastPage } from './pages/ForecastPage';
import { SurplusPage } from './pages/SurplusPage';
import { AssistantPage } from './pages/AssistantPage';
import { SchemesPage } from './pages/SchemesPage';
import { SchemeDetailPage } from './pages/SchemeDetailPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { ReadinessReportPage } from './pages/ReadinessReportPage';
import { LiteracyPage } from './pages/LiteracyPage';
import { PricingPage } from './pages/PricingPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { SettingsPage } from './pages/SettingsPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">
        Loading Shakti Finance...
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/auth" element={<AuthPage />} />

          <Route
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/sales" element={<SalesPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/separation" element={<SeparationPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/voice" element={<VoiceEntryPage />} />
            <Route path="/health" element={<HealthPage />} />
            <Route path="/forecast" element={<ForecastPage />} />
            <Route path="/surplus" element={<SurplusPage />} />
            <Route path="/assistant" element={<AssistantPage />} />
            <Route path="/schemes" element={<SchemesPage />} />
            <Route path="/schemes/:id" element={<SchemeDetailPage />} />
            <Route path="/applications" element={<ApplicationsPage />} />
            <Route path="/readiness-report" element={<ReadinessReportPage />} />
            <Route path="/literacy" element={<LiteracyPage />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
