import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppNavbar from './components/AppNavbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import EventList from './pages/EventList';

// Heavier pages — only loaded when their route is visited.
// Scan brings in html5-qrcode (~120 KB); Admin brings in a lot of admin UI.
// Most users never visit Admin, so this trims the initial bundle.
const Scan = lazy(() => import('./pages/Scan'));
const Admin = lazy(() => import('./pages/Admin'));

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
  const { profile } = useAuth();
  if (profile?.onboardingComplete === false) {
    return <Navigate to="/profile" replace />;
  }
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
            <Route path="/profile" element={<Protected><Profile /></Protected>} />
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
