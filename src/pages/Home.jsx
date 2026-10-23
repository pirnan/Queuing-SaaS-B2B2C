import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { slugify } from "../services/establishmentService";

export default function Home() {
  const [slugInput, setSlugInput] = useState("");
  const [recentSlug, setRecentSlug] = useState(null);
  const { currentUser, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem("active_establishment_slug");
    if (saved && saved !== "main") {
      setRecentSlug(saved);
    }
  }, []);

  const handleGoToQueue = (e) => {
    e.preventDefault();
    const clean = slugify(slugInput);
    if (!clean) return;
    navigate(`/q/${clean}`);
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#FAF9F5",
      color: "#1F1E1D",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif",
      display: "flex",
      flexDirection: "column",
      boxSizing: "border-box"
    }}>
      {/* Top Navigation */}
      <header style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "18px 28px",
        borderBottom: "1px solid #E5E3DC",
        backgroundColor: "rgba(250, 249, 245, 0.92)",
        backdropFilter: "blur(8px)",
        position: "sticky",
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: "#F8EFEA",
            border: "1px solid rgba(204, 120, 92, 0.25)",
            color: "#CC785C",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16
          }}>
            🏛️
          </div>
          <span style={{
            fontFamily: "'Charter', 'Sitka Text', 'Cambria', Georgia, serif",
            fontSize: 20,
            fontWeight: 600,
            color: "#1F1E1D",
            letterSpacing: "-0.2px"
          }}>
            3D Live Queue
          </span>
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {isAdmin ? (
            <Link
              to="/admin"
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: "#FFFFFF",
                backgroundColor: "#1F1E1D",
                padding: "8px 16px",
                borderRadius: 8,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <span>Dashboard</span>
              <span style={{ fontSize: 11 }}>→</span>
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                style={{
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: "#57534E",
                  padding: "8px 14px",
                  borderRadius: 8,
                  textDecoration: "none",
                  border: "1px solid transparent",
                  transition: "color 0.15s, border-color 0.15s"
                }}
              >
                Manager Sign In
              </Link>
              <Link
                to="/register"
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "#FFFFFF",
                  backgroundColor: "#CC785C",
                  padding: "8px 16px",
                  borderRadius: 8,
                  textDecoration: "none",
                  boxShadow: "0 1px 2px rgba(204, 120, 92, 0.2)",
                  transition: "background-color 0.15s"
                }}
              >
                Register Store
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Main Content Area */}
      <main style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 20px 80px",
        maxWidth: 720,
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
        textAlign: "center"
      }}>
        {/* Subtle pill tag */}
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 12px",
          borderRadius: 100,
          backgroundColor: "#F8EFEA",
          border: "1px solid rgba(204, 120, 92, 0.25)",
          color: "#CC785C",
          fontSize: 12.5,
          fontWeight: 600,
          marginBottom: 20
        }}>
          <span>●</span>
          <span>Multi-Tenant 3D Queuing System</span>
        </div>

        {/* Hero Title */}
        <h1 style={{
          fontFamily: "'Charter', 'Sitka Text', 'Cambria', Georgia, serif",
          fontSize: "clamp(32px, 5.5vw, 48px)",
          fontWeight: 600,
          lineHeight: 1.15,
          color: "#1F1E1D",
          margin: "0 0 16px 0",
          letterSpacing: "-0.5px"
        }}>
          Every business has its own live 3D queue.
        </h1>

        <p style={{
          fontSize: "clamp(15px, 2.2vw, 17px)",
          lineHeight: 1.6,
          color: "#73716B",
          margin: "0 0 36px 0",
          maxWidth: 560
        }}>
          To join a line or view real-time seating in 3D, please access your establishment's unique link or scan their counter QR code.
        </p>

        {/* Direct Slug Navigation Box */}
        <div style={{
          width: "100%",
          maxWidth: 520,
          backgroundColor: "#FFFFFF",
          border: "1px solid #E5E3DC",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 4px 20px rgba(31, 30, 29, 0.04), 0 1px 2px rgba(31, 30, 29, 0.02)",
          marginBottom: 32,
          boxSizing: "border-box",
          textAlign: "left"
        }}>
          <label 
            htmlFor="slug-input"
            style={{ 
              display: "block", 
              fontSize: 12.5, 
              fontWeight: 600, 
              color: "#57534E", 
              textTransform: "uppercase", 
              letterSpacing: "0.5px",
              marginBottom: 10
            }}
          >
            Enter Business Link or Slug
          </label>

          <form onSubmit={handleGoToQueue} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              border: "1.5px solid #D6D3CB",
              borderRadius: 10,
              backgroundColor: "#FAF9F5",
              overflow: "hidden",
              transition: "border-color 0.15s"
            }}>
              <span style={{
                padding: "11px 12px 11px 14px",
                fontSize: 14,
                color: "#8C8980",
                fontWeight: 500,
                backgroundColor: "#F4F2EC",
                borderRight: "1px solid #E5E3DC",
                userSelect: "none"
              }}>
                /q/
              </span>
              <input
                id="slug-input"
                type="text"
                placeholder="e.g. sunset-cafe, burger-box"
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value)}
                style={{
                  flex: 1,
                  border: "none",
                  backgroundColor: "transparent",
                  padding: "11px 14px",
                  fontSize: 15,
                  color: "#1F1E1D",
                  outline: "none",
                  fontFamily: "inherit"
                }}
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={!slugInput.trim()}
              style={{
                width: "100%",
                padding: "12px 20px",
                backgroundColor: slugInput.trim() ? "#CC785C" : "#E5E3DC",
                color: slugInput.trim() ? "#FFFFFF" : "#A8A29E",
                border: "none",
                borderRadius: 10,
                fontSize: 14.5,
                fontWeight: 600,
                cursor: slugInput.trim() ? "pointer" : "not-allowed",
                transition: "background-color 0.15s, transform 0.05s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}
            >
              <span>View 3D Live Queue</span>
              <span>→</span>
            </button>
          </form>

          {/* Quick jump to recently visited establishment */}
          {recentSlug && (
            <div style={{
              marginTop: 18,
              paddingTop: 14,
              borderTop: "1px dashed #E5E3DC",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 13
            }}>
              <span style={{ color: "#73716B" }}>
                Recently viewed: <strong style={{ color: "#1F1E1D" }}>/q/{recentSlug}</strong>
              </span>
              <Link 
                to={`/q/${recentSlug}`}
                style={{
                  color: "#CC785C",
                  fontWeight: 600,
                  textDecoration: "none"
                }}
              >
                Open →
              </Link>
            </div>
          )}
        </div>

        {/* Feature Grid / Cards */}
        <div style={{
          width: "100%",
          maxWidth: 580,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: 16,
          textAlign: "left"
        }}>
          {/* Card 1: For Customers */}
          <div style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E3DC",
            borderRadius: 12,
            padding: 20
          }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>📱</div>
            <h3 style={{
              margin: "0 0 6px 0",
              fontFamily: "'Charter', 'Sitka Text', 'Cambria', Georgia, serif",
              fontSize: 17,
              fontWeight: 600,
              color: "#1F1E1D"
            }}>
              For Customers
            </h3>
            <p style={{ margin: 0, fontSize: 13.5, color: "#73716B", lineHeight: 1.5 }}>
              Scan the physical QR code displayed in the store, or ask the staff for their queue link to hold your spot online.
            </p>
          </div>

          {/* Card 2: For Store Owners */}
          <div style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E3DC",
            borderRadius: 12,
            padding: 20
          }}>
            <div style={{ fontSize: 24, marginBottom: 10 }}>🏪</div>
            <h3 style={{
              margin: "0 0 6px 0",
              fontFamily: "'Charter', 'Sitka Text', 'Cambria', Georgia, serif",
              fontSize: 17,
              fontWeight: 600,
              color: "#1F1E1D"
            }}>
              For Store Owners
            </h3>
            <p style={{ margin: "0 0 12px 0", fontSize: 13.5, color: "#73716B", lineHeight: 1.5 }}>
              Register your restaurant to generate a branded 3D queue, table manager, and custom printable QR code.
            </p>
            <Link
              to="/register"
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: "#CC785C",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 4
              }}
            >
              <span>Get started for free</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        padding: "20px 24px",
        borderTop: "1px solid #E5E3DC",
        textAlign: "center",
        fontSize: 12.5,
        color: "#8C8980"
      }}>
        3D Live Queuing System • Multi-tenant establishment queue & seating management
      </footer>
    </div>
  );
}
