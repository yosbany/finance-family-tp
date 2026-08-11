import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './components/auth/LoginPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { UnauthorizedPage } from './components/auth/UnauthorizedPage';
import { Layout } from './components/layout/Layout';
import { Dashboard } from './components/dashboard/Dashboard';
import { UploadStatements } from './components/transactions/UploadStatements';
import { TransactionList } from './components/transactions/TransactionList';
import { FinancialAnalysis } from './components/reports/FinancialAnalysis';
import { AssetManagement } from './components/assets/AssetManagement';
import { GoalsManagement } from './components/goals/GoalsManagement';
import { AccountsManagement } from './components/accounts/AccountsManagement';
import { CategoriesManagement } from './components/categories/CategoriesManagement';
import { MembersManagement } from './components/members/MembersManagement';
import { useAuthorization } from './hooks/useAuthorization';

function App() {
  const { user, isAuthorized, loading } = useAuthorization();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter basename="/finance-family-tp">
      <Routes>
        <Route
          path="/login"
          element={
            user
              ? (isAuthorized ? <Navigate to="/" replace /> : <Navigate to="/unauthorized" replace />)
              : <LoginPage />
          }
        />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/accounts"
          element={
            <ProtectedRoute>
              <Layout>
                <AccountsManagement />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute>
              <Layout>
                <TransactionList />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions/upload"
          element={
            <ProtectedRoute>
              <Layout>
                <UploadStatements />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/categories"
          element={
            <ProtectedRoute>
              <Layout>
                <CategoriesManagement />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/assets"
          element={
            <ProtectedRoute>
              <Layout>
                <AssetManagement />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/goals"
          element={
            <ProtectedRoute>
              <Layout>
                <GoalsManagement />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Layout>
                <FinancialAnalysis />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/members"
          element={
            <ProtectedRoute>
              <Layout>
                <MembersManagement />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={user ? (isAuthorized ? '/' : '/unauthorized') : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

// Made with Bob
