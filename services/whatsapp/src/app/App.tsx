import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { PublicLayout } from "../layouts/PublicLayout";
import { appRoutes, authMenuLinks, publicHeaderLinks, publicRoutes } from "../config/navigation";
import { AuthProvider } from "../auth/AuthProvider";
import { ProtectedRoute } from "../auth/ProtectedRoute";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicLayout links={publicHeaderLinks} authLinks={authMenuLinks} />}>
            {publicRoutes.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              {appRoutes.map((route) => (
                <Route key={route.path} path={route.path} element={route.element} />
              ))}
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}