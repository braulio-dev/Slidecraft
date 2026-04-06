import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

const LoadingScreen = () => (
  <div className="flex h-screen items-center justify-center bg-background">
    <div className="h-8 w-8 rounded-full border-4 border-border border-t-primary animate-spin" />
  </div>
);

const PrivateRoute = () => {
  const { isAuthenticated, loading, sessionExpired } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location, reason: sessionExpired ? 'expired' : 'unauthenticated' }}
      />
    );
  }

  return <Outlet />;
};

export default PrivateRoute;
