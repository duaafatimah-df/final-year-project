import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // If logged in but wrong role, send them to their specific portal
    if (user.role === 'donor') return <Navigate to="/contributor" replace />;
    if (user.role === 'receiver') return <Navigate to="/receiver" replace />;
    if (user.role === 'admin') return <Navigate to="/admin" replace />;
  }

  return children;
};

export default ProtectedRoute;
