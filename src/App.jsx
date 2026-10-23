import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Home from "./pages/Home";
import CustomerQueue from "./pages/CustomerQueue";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLogin from "./pages/AdminLogin";
import RegisterEstablishment from "./pages/RegisterEstablishment";
import { getEstablishmentsForUser } from "./services/establishmentService";

function ProtectedAdminRoute({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/login" replace />;
}

// Automatically redirects /admin to the manager's establishment dashboard (/admin/:slug)
function AdminIndexRedirect() {
  const { currentUser } = useAuth();
  const [targetSlug, setTargetSlug] = useState(null);
  const [redirectToRegister, setRedirectToRegister] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function resolveStore() {
      // 1. Check last active slug in localStorage (if valid and not 'main')
      const lastSlug = localStorage.getItem("active_establishment_slug");
      if (lastSlug && lastSlug !== "main") {
        setTargetSlug(lastSlug);
        setLoading(false);
        return;
      }

      // 2. Query user's stores from Firestore
      if (currentUser) {
        try {
          const stores = await getEstablishmentsForUser(currentUser.uid, currentUser.email);
          if (stores && stores.length > 0) {
            setTargetSlug(stores[0].slug);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.warn("Could not load user establishments:", err);
        }
      }

      // 3. If no stores exist for this manager, redirect to registration
      setRedirectToRegister(true);
      setLoading(false);
    }

    resolveStore();
  }, [currentUser]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#FAF9F5", color: "#73716B", fontFamily: "system-ui" }}>
        Loading dashboard...
      </div>
    );
  }

  if (redirectToRegister) {
    return <Navigate to="/register" replace />;
  }

  return <Navigate to={`/admin/${targetSlug}`} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public customer QR destinations */}
          <Route path="/" element={<Home />} />
          <Route path="/q/:slug" element={<CustomerQueue />} />
          <Route path="/q" element={<Navigate to="/" replace />} />

          {/* Admin & Onboarding routes */}
          <Route path="/login" element={<AdminLogin />} />
          <Route path="/register" element={<RegisterEstablishment />} />
          <Route 
            path="/admin/:slug" 
            element={
              <ProtectedAdminRoute>
                <AdminDashboard />
              </ProtectedAdminRoute>
            } 
          />
          <Route 
            path="/admin" 
            element={
              <ProtectedAdminRoute>
                <AdminIndexRedirect />
              </ProtectedAdminRoute>
            } 
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
