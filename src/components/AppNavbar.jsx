import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AppNavbar() {
  const { profile, isManager, logout } = useAuth();
  
  // Check if user has specific roles
  const hasRole = (role) => {
    const roles = profile?.roles || [];
    if (Array.isArray(roles)) {
      return roles.includes(role);
    }
    if (typeof roles === 'string') {
      return roles === role;
    }
    return false;
  };

  // Check if user is Manager or Volunteer Leader
  const isManagerOrVolunteerLeader = isManager || hasRole('Volunteer Leader');

  return (
    <nav className="navbar navbar-expand-lg navbar-dark navbar-24 sticky-top">
      <div className="container">
        <Link className="navbar-brand" to="/">
          <span className="logo-chip"><img src="/logo.png" alt="24asia" height="26" /></span>
        </Link>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#nav">
          <span className="navbar-toggler-icon" />
        </button>
        <div className="collapse navbar-collapse" id="nav">
          <ul className="navbar-nav me-auto">
            {/* Everyone can see these */}
            <li className="nav-item"><NavLink className="nav-link" to="/">Dashboard</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/events">Event</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/trainings">Training</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/champions">Achievement</NavLink></li>
            <li className="nav-item"><NavLink className="nav-link" to="/settings">ID Card</NavLink></li>
            
            {/* Only Manager can see Admin */}
            {isManager && (
              <li className="nav-item"><NavLink className="nav-link" to="/admin">Admin</NavLink></li>
            )}
            
            {/* Only Manager or Volunteer Leader can see Scan */}
            {isManagerOrVolunteerLeader && (
              <li className="nav-item"><NavLink className="nav-link" to="/scan">Scan</NavLink></li>
            )}
          </ul>
          <ul className="navbar-nav">
            <li className="nav-item">
              <NavLink className="nav-link d-flex align-items-center gap-2" to="/settings">
                {profile?.photoUrl
                  ? <img src={profile.photoUrl} alt="" width="28" height="28" className="rounded-circle object-fit-cover border border-danger" />
                  : <span className="rounded-circle bg-secondary d-inline-flex align-items-center justify-content-center text-white" style={{ width: 28, height: 28, fontSize: 13 }}>{(profile?.name || '?').charAt(0).toUpperCase()}</span>}
                <span>{profile?.name?.split(' ')[0] || 'Profile'}</span>
              </NavLink>
            </li>
            <li className="nav-item d-flex align-items-center gap-2 ms-lg-2 mt-2 mt-lg-0">
              <button className="btn btn-sm btn-outline-light refresh-btn" onClick={() => window.location.reload()} title="Refresh data" aria-label="Refresh">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
                  <polyline points="21 3 21 8 16 8" />
                </svg>
              </button>
              <button className="btn btn-sm btn-outline-light" onClick={logout}>Sign out</button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}