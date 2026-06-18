import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppNavbar from './components/AppNavbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import EventList from './pages/EventList';

const Scan = lazy(() => import('./pages/Scan'));
const Admin = lazy(() => import('./pages/Admin'));
const Settings = lazy(() => import('./pages/Settings'));

function PageSpinner() {
  return <div className="text-center p-5"><div className="spinner-border text-danger" /></div>;
}

function Protected({ children, manager = false }) {
  const { booting, user, isManager } = useAuth();
  if (booting) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (manager && !isManager) return <Navigate to="/" replace />;
  return children;
}

function HomeOrOnboarding() {
  // ALWAYS show Dashboard - no redirects
  return <Dashboard />;
}

export default function App() {
  const { user, profile } = useAuth();
  return (
    <>
      {user && <AppNavbar />}
      {user && profile?.status === 'pending' && (
        <div className="banner-pending">
          Your account is awaiting approval. You can browse events but not register yet.
        </div>
      )}
      <div className="container py-4">
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Protected><HomeOrOnboarding /></Protected>} />
            <Route path="/profile" element={<Navigate to="/settings" replace />} />
            <Route path="/settings" element={<Protected><Settings /></Protected>} />
            <Route path="/events" element={<Protected><EventList type="event" key="event" /></Protected>} />
            <Route path="/trainings" element={<Protected><EventList type="training" key="training" /></Protected>} />
            <Route path="/scan" element={<Protected><Scan /></Protected>} />
            <Route path="/admin" element={<Protected manager><Admin /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </div>
    </>
  );
}