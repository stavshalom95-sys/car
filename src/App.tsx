import { HashRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { DataProvider, useData } from './lib/data';
import { ConfirmProvider, ToastProvider } from './components/ui';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import FuelPage from './pages/Fuel';
import MaintenancePage from './pages/Maintenance';
import TestPage from './pages/Test';
import DocumentsPage from './pages/Documents';
import SettingsPage from './pages/Settings';
import PartsPage from './pages/Parts';
import MorePage from './pages/More';
import ExpensesPage from './pages/Expenses';
import EquipmentPage from './pages/Equipment';
import InsurancePage from './pages/Insurance';
import ImportPage from './pages/Import';

function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" aria-label="טוען" />
    </div>
  );
}

function Routed() {
  const { ready } = useData();
  if (!ready) return <Loading />;
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="fuel" element={<FuelPage />} />
        <Route path="maintenance" element={<MaintenancePage />} />
        <Route path="test" element={<TestPage />} />
        <Route path="documents" element={<DocumentsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="parts" element={<PartsPage />} />
        <Route path="more" element={<MorePage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="equipment" element={<EquipmentPage />} />
        <Route path="insurance" element={<InsurancePage />} />
        <Route path="import" element={<ImportPage />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) return <Login />;
  return (
    <DataProvider key={user.uid} user={user}>
      <Routed />
    </DataProvider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <HashRouter>
            <Gate />
          </HashRouter>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
