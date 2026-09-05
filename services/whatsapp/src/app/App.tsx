import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { PublicLayout } from "../layouts/PublicLayout";
import { appRoutes, authMenuLinks, publicHeaderLinks, publicRoutes, publicNavigation } from "../config/navigation";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <PublicLayout links={publicHeaderLinks} authLinks={authMenuLinks} />
          }
        >
          {publicRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Route>

        <Route element={<AppLayout />}>
          {appRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
