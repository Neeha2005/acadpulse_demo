import { Navigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

export default function PrivateRoute({ children }) {
  const { authReady, isAuthenticated } = useAppContext();
  const location = useLocation();

  if (!authReady) {
    return (
      <div className="auth-shell">
        <div className="auth-form-side auth-form-side-full">
          <div className="auth-card auth-loading-card">
            <div className="auth-spinner"></div>
            <p>Checking your session...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
