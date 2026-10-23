import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

import { getEstablishmentsForUser } from "../services/establishmentService";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { loginAdmin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const userCredential = await loginAdmin(email, password);
      const user = userCredential.user;

      const userStores = await getEstablishmentsForUser(user.uid, user.email);
      if (userStores && userStores.length > 0) {
        localStorage.setItem("active_establishment_slug", userStores[0].slug);
        navigate(`/admin/${userStores[0].slug}`);
      } else {
        const lastSlug = localStorage.getItem("active_establishment_slug");
        if (lastSlug) {
          navigate(`/admin/${lastSlug}`);
        } else {
          navigate("/admin");
        }
      }
    } catch (err) {
      setError("Failed to log in: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#FAF9F5",
      backgroundImage: "radial-gradient(circle at 50% 0%, rgba(204, 120, 92, 0.08) 0%, transparent 60%)",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif",
      color: "#1F1E1D",
      padding: "24px 16px",
      boxSizing: "border-box"
    }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        backgroundColor: "#FFFFFF",
        border: "1px solid #E5E3DC",
        borderRadius: 16,
        padding: "36px 32px",
        boxShadow: "0 4px 24px rgba(31, 30, 29, 0.04), 0 1px 2px rgba(31, 30, 29, 0.02)",
        boxSizing: "border-box"
      }}>
        {/* Claude Emblem & Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: "#F8EFEA",
            border: "1px solid rgba(204, 120, 92, 0.25)",
            color: "#CC785C",
            marginBottom: 16
          }}>
            {/* Claude Sparkle Icon */}
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" />
            </svg>
          </div>
          <h2 style={{
            margin: "0 0 8px 0",
            fontFamily: "'Charter', 'Sitka Text', 'Cambria', Georgia, serif",
            fontSize: 26,
            fontWeight: 600,
            color: "#1F1E1D",
            letterSpacing: "-0.3px"
          }}>
            Admin Portal
          </h2>
          <p style={{ margin: 0, fontSize: 14, color: "#73716B" }}>
            Sign in to manage tables and live guest queue
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: "rgba(194, 65, 56, 0.08)",
            border: "1px solid rgba(194, 65, 56, 0.25)",
            color: "#C24138",
            padding: "10px 14px",
            borderRadius: 8,
            fontSize: 13,
            marginBottom: 20,
            lineHeight: 1.4
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: "#52504B",
              marginBottom: 6
            }}>
              Email address
            </label>
            <input 
              type="email" 
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "11px 14px",
                fontSize: 14,
                backgroundColor: "#FBF9F5",
                border: "1px solid #DCD9D0",
                borderRadius: 10,
                color: "#1F1E1D",
                outline: "none",
                transition: "border-color 0.15s, box-shadow 0.15s"
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#CC785C";
                e.target.style.boxShadow = "0 0 0 3px rgba(204, 120, 92, 0.18)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#DCD9D0";
                e.target.style.boxShadow = "none";
              }}
              placeholder="admin@example.com"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: "block",
              fontSize: 13,
              fontWeight: 600,
              color: "#52504B",
              marginBottom: 6
            }}>
              Password
            </label>
            <input 
              type="password" 
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: "11px 14px",
                fontSize: 14,
                backgroundColor: "#FBF9F5",
                border: "1px solid #DCD9D0",
                borderRadius: 10,
                color: "#1F1E1D",
                outline: "none",
                transition: "border-color 0.15s, box-shadow 0.15s"
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "#CC785C";
                e.target.style.boxShadow = "0 0 0 3px rgba(204, 120, 92, 0.18)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "#DCD9D0";
                e.target.style.boxShadow = "none";
              }}
              placeholder="••••••••"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{
              width: "100%",
              padding: "12px 16px",
              backgroundColor: "#CC785C",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              boxShadow: "0 2px 8px rgba(204, 120, 92, 0.25)",
              transition: "all 0.15s ease",
              fontFamily: "inherit"
            }}
            onMouseOver={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#B85D3F"; }}
            onMouseOut={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#CC785C"; }}
          >
            {loading ? "Signing in..." : "Sign In to Dashboard"}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: "center", borderTop: "1px solid #EFECE4", paddingTop: 18 }}>
          <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "#73716B" }}>
            New establishment?{" "}
            <Link 
              to="/register" 
              style={{ color: "#CC785C", fontWeight: 600, textDecoration: "none" }}
              onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
            >
              Register your store
            </Link>
          </p>
          <Link 
            to="/" 
            style={{
              fontSize: 13,
              color: "#73716B",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: "color 0.15s"
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = "#CC785C")}
            onMouseOut={(e) => (e.currentTarget.style.color = "#73716B")}
          >
            ← Return to Customer Queue
          </Link>
        </div>
      </div>
    </div>
  );
}
