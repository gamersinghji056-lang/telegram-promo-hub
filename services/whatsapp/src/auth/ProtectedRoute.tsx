import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export function ProtectedRoute() {
  const { configured, loading, session } = useAuth();
  const location = useLocation();

  if (!configured) {
    return (
      <div className="wm-auth-setup">
        <div>
          <span>BACKEND SETUP REQUIRED</span>
          <h1>Connect Supabase to activate WA MARK accounts.</h1>
          <p>Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Railway, then run the WA MARK foundation SQL in Supabase.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="wm-auth-loading"><span>WA</span><p>Loading workspace...</p></div>;
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}