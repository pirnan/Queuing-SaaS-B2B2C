import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";
import { 
  createEstablishment, 
  slugify, 
  checkSlugAvailable 
} from "../services/establishmentService";

export default function RegisterEstablishment() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [category, setCategory] = useState("Restaurant / Cafe");
  const [maxPartySize, setMaxPartySize] = useState(10);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [slugStatus, setSlugStatus] = useState({ checking: false, available: null, message: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { signupAdmin } = useAuth();
  const navigate = useNavigate();

  // Auto-generate slug from name unless user manually edited it
  const handleNameChange = (e) => {
    const val = e.target.value;
    setName(val);
    if (!slugManuallyEdited) {
      setSlug(slugify(val));
    }
  };

  const handleSlugChange = (e) => {
    setSlugManuallyEdited(true);
    setSlug(slugify(e.target.value));
  };

  // Check slug availability with debounce
  useEffect(() => {
    if (!slug) {
      setSlugStatus({ checking: false, available: null, message: "" });
      return;
    }

    setSlugStatus({ checking: true, available: null, message: "Checking availability..." });
    const timer = setTimeout(async () => {
      try {
        const available = await checkSlugAvailable(slug);
        if (available) {
          setSlugStatus({ checking: false, available: true, message: `✓ /q/${slug} is available` });
        } else {
          setSlugStatus({ checking: false, available: false, message: `⚠️ /q/${slug} is already taken` });
        }
      } catch {
        setSlugStatus({ checking: false, available: null, message: "" });
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [slug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!slug.trim()) {
      setError("Please specify a queue URL link for your establishment.");
      return;
    }

    if (slugStatus.available === false) {
      setError(`The link /q/${slug} is already taken. Please choose another.`);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify your password.");
      return;
    }

    setLoading(true);

    try {
      // 1. Create Firebase Auth account for manager
      const userCredential = await signupAdmin(email.trim(), password);
      const user = userCredential.user;

      // 2. Initialize Establishment document and subcollections in Firestore
      const createdSlug = await createEstablishment({
        name: name.trim(),
        slug: slug.trim(),
        ownerUid: user.uid,
        ownerEmail: user.email,
        category,
        maxPartySize: Number(maxPartySize) || 10
      });

      // Save active store selection in local storage for instant dashboard pickup
      localStorage.setItem("active_establishment_slug", createdSlug);

      // 3. Redirect to Establishment-specific Admin Dashboard
      navigate(`/admin/${createdSlug}`);
    } catch (err) {
      setError(err.message || "Failed to create establishment account.");
    } finally {
      setLoading(false);
    }
  };

  const domainOrigin = window.location.origin;

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
      padding: "36px 16px",
      boxSizing: "border-box"
    }}>
      <div style={{
        width: "100%",
        maxWidth: 520,
        backgroundColor: "#FFFFFF",
        border: "1px solid #E5E3DC",
        borderRadius: 20,
        padding: "36px 34px",
        boxShadow: "0 6px 30px rgba(31, 30, 29, 0.06), 0 1px 3px rgba(31, 30, 29, 0.03)",
        boxSizing: "border-box"
      }}>
        {/* Emblem & Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: 14,
            backgroundColor: "#F8EFEA",
            border: "1px solid rgba(204, 120, 92, 0.25)",
            color: "#CC785C",
            marginBottom: 16
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" />
            </svg>
          </div>
          <h2 style={{
            margin: "0 0 8px 0",
            fontFamily: "'Charter', 'Sitka Text', 'Cambria', Georgia, serif",
            fontSize: 27,
            fontWeight: 600,
            color: "#1F1E1D",
            letterSpacing: "-0.4px"
          }}>
            Create Establishment
          </h2>
          <p style={{ margin: 0, fontSize: 13.5, color: "#73716B", lineHeight: 1.5 }}>
            Launch your digital 3D queue, seating management, and unique QR code
          </p>
        </div>

        {error && (
          <div style={{
            backgroundColor: "rgba(194, 65, 56, 0.08)",
            border: "1px solid rgba(194, 65, 56, 0.25)",
            color: "#C24138",
            padding: "11px 15px",
            borderRadius: 10,
            fontSize: 13,
            marginBottom: 22,
            lineHeight: 1.45
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          
          {/* Section: Establishment Information */}
          <div style={{
            padding: "18px 20px",
            backgroundColor: "#FDFCFB",
            border: "1px solid #EAE8E1",
            borderRadius: 14,
            display: "flex",
            flexDirection: "column",
            gap: 16
          }}>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.6px",
              color: "#CC785C",
              borderBottom: "1px solid #F0EEE6",
              paddingBottom: 6
            }}>
              1. Establishment Profile
            </div>

            {/* Establishment Name */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#52504B", marginBottom: 6 }}>
                Business / Store Name
              </label>
              <input 
                type="text" 
                placeholder="e.g. Garden Terrace Cafe"
                value={name} 
                onChange={handleNameChange}
                required
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 14px",
                  fontSize: 14,
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #DCD9D0",
                  borderRadius: 8,
                  color: "#1F1E1D",
                  outline: "none"
                }}
                onFocus={(e) => (e.target.style.borderColor = "#CC785C")}
                onBlur={(e) => (e.target.style.borderColor = "#DCD9D0")}
              />
            </div>

            {/* Queue URL Slug */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#52504B" }}>
                  Queue Link (QR Code Destination)
                </label>
                {slugStatus.message && (
                  <span style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: slugStatus.available ? "#3B6B52" : slugStatus.available === false ? "#C24138" : "#8C8980"
                  }}>
                    {slugStatus.message}
                  </span>
                )}
              </div>
              <div style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: "#FFFFFF",
                border: slugStatus.available === false ? "1px solid #C24138" : "1px solid #DCD9D0",
                borderRadius: 8,
                padding: "2px 10px",
                overflow: "hidden"
              }}>
                <span style={{ fontSize: 13, color: "#8C8980", whiteSpace: "nowrap" }}>
                  /q/
                </span>
                <input 
                  type="text" 
                  placeholder="garden-terrace-cafe"
                  value={slug} 
                  onChange={handleSlugChange}
                  required
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "8px 4px",
                    fontSize: 14,
                    border: "none",
                    backgroundColor: "transparent",
                    color: "#1F1E1D",
                    outline: "none",
                    fontWeight: 600
                  }}
                />
              </div>
              <div style={{ fontSize: 11.5, color: "#8C8980", marginTop: 4 }}>
                Customers scan to open: <span style={{ color: "#CC785C", fontWeight: 500 }}>{domainOrigin}/q/{slug || "your-link"}</span>
              </div>
            </div>

            {/* Category Selection */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#52504B", marginBottom: 6 }}>
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 14px",
                  fontSize: 14,
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #DCD9D0",
                  borderRadius: 8,
                  color: "#1F1E1D",
                  outline: "none",
                  cursor: "pointer",
                  fontFamily: "inherit"
                }}
              >
                <option value="Restaurant / Cafe">Restaurant / Cafe</option>
                <option value="Bar & Lounge">Bar & Lounge</option>
                <option value="Desserts & Bakery">Desserts & Bakery</option>
                <option value="Fast Casual & Diner">Fast Casual & Diner</option>
                <option value="Salon & Spa">Salon & Spa</option>
                <option value="Clinic & Healthcare">Clinic & Healthcare</option>
                <option value="Retail & Boutique">Retail & Boutique</option>
                <option value="Other Venue">Other Venue</option>
              </select>
            </div>

            {/* Default Max Customer Party Capacity */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#52504B", marginBottom: 6 }}>
                Max Customer Party Size Allowed
              </label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                {[4, 6, 8, 10, 12, 16, 20].map((size) => {
                  const isSelected = Number(maxPartySize) === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setMaxPartySize(size)}
                      style={{
                        padding: "5px 12px",
                        fontSize: 12.5,
                        fontWeight: isSelected ? 600 : 500,
                        backgroundColor: isSelected ? "#CC785C" : "#FFFFFF",
                        color: isSelected ? "#FFFFFF" : "#52504B",
                        border: isSelected ? "1px solid #CC785C" : "1px solid #DCD9D0",
                        borderRadius: 6,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        fontFamily: "inherit"
                      }}
                    >
                      {size} guests
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section: Account Login Credentials */}
          <div style={{
            padding: "18px 20px",
            backgroundColor: "#FDFCFB",
            border: "1px solid #EAE8E1",
            borderRadius: 14,
            display: "flex",
            flexDirection: "column",
            gap: 16
          }}>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.6px",
              color: "#CC785C",
              borderBottom: "1px solid #F0EEE6",
              paddingBottom: 6
            }}>
              2. Manager Login Credentials
            </div>

            {/* Email */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#52504B", marginBottom: 6 }}>
                Manager Email
              </label>
              <input 
                type="email" 
                placeholder="manager@yourstore.com"
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 14px",
                  fontSize: 14,
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #DCD9D0",
                  borderRadius: 8,
                  color: "#1F1E1D",
                  outline: "none"
                }}
                onFocus={(e) => (e.target.style.borderColor = "#CC785C")}
                onBlur={(e) => (e.target.style.borderColor = "#DCD9D0")}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#52504B", marginBottom: 6 }}>
                Password (min 6 characters)
              </label>
              <input 
                type="password" 
                placeholder="••••••••"
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 14px",
                  fontSize: 14,
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #DCD9D0",
                  borderRadius: 8,
                  color: "#1F1E1D",
                  outline: "none"
                }}
                onFocus={(e) => (e.target.style.borderColor = "#CC785C")}
                onBlur={(e) => (e.target.style.borderColor = "#DCD9D0")}
              />
            </div>

            {/* Confirm Password */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#52504B", marginBottom: 6 }}>
                Confirm Password
              </label>
              <input 
                type="password" 
                placeholder="••••••••"
                value={confirmPassword} 
                onChange={(e) => setConfirmPassword(e.target.value)} 
                required
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 14px",
                  fontSize: 14,
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #DCD9D0",
                  borderRadius: 8,
                  color: "#1F1E1D",
                  outline: "none"
                }}
                onFocus={(e) => (e.target.style.borderColor = "#CC785C")}
                onBlur={(e) => (e.target.style.borderColor = "#DCD9D0")}
              />
            </div>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={loading || slugStatus.available === false}
            style={{
              width: "100%",
              padding: "13px 18px",
              backgroundColor: loading || slugStatus.available === false ? "#DCD9D0" : "#CC785C",
              color: "#FFFFFF",
              border: "none",
              borderRadius: 10,
              fontSize: 14.5,
              fontWeight: 600,
              cursor: loading || slugStatus.available === false ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 2px 8px rgba(204, 120, 92, 0.25)",
              transition: "all 0.15s ease",
              fontFamily: "inherit",
              marginTop: 4
            }}
            onMouseOver={(e) => {
              if (!loading && slugStatus.available !== false) {
                e.currentTarget.style.backgroundColor = "#B85D3F";
              }
            }}
            onMouseOut={(e) => {
              if (!loading && slugStatus.available !== false) {
                e.currentTarget.style.backgroundColor = "#CC785C";
              }
            }}
          >
            {loading ? "Setting Up Establishment..." : "Create Establishment & Launch Queue"}
          </button>
        </form>

        {/* Footers & Navigation Links */}
        <div style={{ marginTop: 26, textAlign: "center", borderTop: "1px solid #EFECE4", paddingTop: 20 }}>
          <p style={{ margin: "0 0 10px 0", fontSize: 13, color: "#73716B" }}>
            Already have an establishment registered?{" "}
            <Link 
              to="/login" 
              style={{ color: "#CC785C", fontWeight: 600, textDecoration: "none" }}
              onMouseOver={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseOut={(e) => (e.currentTarget.style.textDecoration = "none")}
            >
              Sign In to Dashboard
            </Link>
          </p>
          <Link 
            to="/" 
            style={{
              fontSize: 12.5,
              color: "#8C8980",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 5
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = "#1F1E1D")}
            onMouseOut={(e) => (e.currentTarget.style.color = "#8C8980")}
          >
            ← Return to Live Customer Queue
          </Link>
        </div>
      </div>
    </div>
  );
}
