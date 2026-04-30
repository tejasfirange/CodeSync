import { Navigate, Outlet, useLocation } from 'react-router-dom';
import Spinner from '../components/common/Spinner.jsx';
import useAuth from '../hooks/useAuth.js';

const ProtectedRoute = () => {
  const { user, initialized, loading } = useAuth();
  const location = useLocation();

  if (!initialized || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f7f4]">
        <Spinner label="Opening workspace" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
