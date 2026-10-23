import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { 
  collection, 
  query, 
  orderBy, 
  limit,
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  setDoc
} from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { Link, useParams, useNavigate, Navigate } from "react-router-dom";
import { getEstablishmentsForUser } from "../services/establishmentService";
import QRCodeDisplay from "../components/QRCodeDisplay";

export default function AdminDashboard() {
  const { logout, currentUser } = useAuth();
  const { slug: routeSlug } = useParams();
  const navigate = useNavigate();

  // Active establishment slug directly from URL parameter
  const activeSlug = routeSlug ? routeSlug.trim().toLowerCase() : null;

  const [establishment, setEstablishment] = useState(null);
  const [loadingEst, setLoadingEst] = useState(Boolean(activeSlug));
  const [estNotFound, setEstNotFound] = useState(false);
  const [userEstablishments, setUserEstablishments] = useState([]);

  // Scoped subcollection path helpers for this establishment
  const estColl = (collName) => collection(db, "establishments", activeSlug || "_", collName);
  const estDoc = (collName, id) => doc(db, "establishments", activeSlug || "_", collName, id);
  const estSetting = (name) => doc(db, "establishments", activeSlug || "_", "settings", name);

  const [reservations, setReservations] = useState([]);
  const [tables, setTables] = useState([]);
  const [showQR, setShowQR] = useState(false);

  // New reservation state for Admin walk-in entry
  const [newName, setNewName] = useState("");
  const [newPartySize, setNewPartySize] = useState(1);
  const [newTableNumber, setNewTableNumber] = useState(0);
  const [capacity, setCapacity] = useState(2);

  // Editing modal state
  const [editingItem, setEditingItem] = useState(null);
  // Dining Tables popup modal state
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [assigningReservation, setAssigningReservation] = useState(null);
  // View toggle: all reservations vs only active (waiting or eating) - defaults to active only
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  // Customer queue settings: Maximum party capacity limit that customers are allowed to set
  const [maxCustomerCapacity, setMaxCustomerCapacity] = useState(10);
  const [inputMaxCapacity, setInputMaxCapacity] = useState(10);
  const [isSavingCapacity, setIsSavingCapacity] = useState(false);
  const [capacitySaveMessage, setCapacitySaveMessage] = useState("");

  // Multi-wall 3D framed artwork state: Left, Back, and Right walls can each have distinct pictures & frame sizes
  const WALL_SIDES = [
    { id: "left", label: "Left Wall", orientation: "Exterior Left Wall", desc: "Facing open garden / patio", icon: "👈" },
    { id: "back", label: "Back Wall", orientation: "Exterior Back Facade", desc: "Facing rear landscape / promenade", icon: "🏛️" },
    { id: "right", label: "Right Wall", orientation: "Exterior Right Wall", desc: "Facing sunny lawn / pavilion side", icon: "👉" }
  ];

  const [activeWallTab, setActiveWallTab] = useState("left");
  const [wallConfigs, setWallConfigs] = useState({
    left: { url: "", scale: 1.0, preset: "medium" },
    back: { url: "", scale: 1.0, preset: "medium" },
    right: { url: "", scale: 1.0, preset: "medium" }
  });
  const [buildingConfig, setBuildingConfig] = useState(null);
  const [isSavingWallSignage, setIsSavingWallSignage] = useState(false);
  const [wallSaveMessage, setWallSaveMessage] = useState("");

  const activeReservations = reservations.filter(
    (r) => r.status === "waiting" || r.status === "eating"
  );
  const displayedReservations = showActiveOnly ? activeReservations : reservations;

  useEffect(() => {
    if (!activeSlug) {
      setLoadingEst(false);
      setEstNotFound(true);
      return;
    }

    setLoadingEst(true);
    setEstNotFound(false);

    // 1. Listen to active establishment document
    const unsubEst = onSnapshot(doc(db, "establishments", activeSlug), (docSnap) => {
      setLoadingEst(false);
      if (docSnap.exists()) {
        setEstablishment({ id: docSnap.id, ...docSnap.data() });
        setEstNotFound(false);
        localStorage.setItem("active_establishment_slug", activeSlug);
      } else {
        setEstablishment(null);
        setEstNotFound(true);
      }
    }, (err) => {
      console.warn("Could not load establishment:", err);
      setLoadingEst(false);
      setEstNotFound(true);
    });

    // 2. Fetch user's managed stores for switcher dropdown
    if (currentUser) {
      getEstablishmentsForUser(currentUser.uid, currentUser.email).then((list) => {
        setUserEstablishments(list || []);
      }).catch((err) => console.warn("Could not load user stores:", err));
    }

    // 3. Subcollection queries scoped to active establishment
    const reservationsQuery = query(estColl("reservations"), orderBy("createdAt", "asc"));
    const unsubscribeReservations = onSnapshot(reservationsQuery, (snapshot) => {
      setReservations(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const tablesQuery = query(estColl("tables"), orderBy("tableNumber", "desc"));
    const unsubscribeTables = onSnapshot(tablesQuery, (snapshot) => {
      setTables(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    const latestTableQuery = query(estColl("tables"), orderBy("tableNumber", "desc"), limit(1));
    const unsubscribeLatestTable = onSnapshot(latestTableQuery, (snapshot) => {
      if (!snapshot.empty) {
        const highestNumber = snapshot.docs[0].data().tableNumber;
        setNewTableNumber(highestNumber + 1); // Auto-suggest next table number
      } else {
        setNewTableNumber(1); // Default to 1 if no tables exist yet
      }
    });

    // Real-time subscription to 3D house wall art & signage configuration in subcollection
    const unsubscribeBuilding = onSnapshot(estSetting("building"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBuildingConfig(data);

        const loadedWalls = {
          left: { url: "", scale: 1.0, preset: "medium" },
          back: { url: "", scale: 1.0, preset: "medium" },
          right: { url: "", scale: 1.0, preset: "medium" }
        };

        if (data.walls && typeof data.walls === "object") {
          ["left", "back", "right"].forEach((side) => {
            if (data.walls[side]) {
              loadedWalls[side] = {
                url: data.walls[side].url || "",
                scale: Number(data.walls[side].scale) || 1.0,
                preset: data.walls[side].preset || "medium"
              };
            }
          });
        } else if (data.logoUrl) {
          const legacySides = Array.isArray(data.logoSides) && data.logoSides.length > 0
            ? data.logoSides
            : [data.logoSide || "back"];
          const s = Number(data.frameScale) || 1.0;
          const p = data.frameSizePreset || "medium";
          legacySides.forEach((side) => {
            if (loadedWalls[side]) {
              loadedWalls[side] = { url: data.logoUrl, scale: s, preset: p };
            }
          });
        }

        setWallConfigs(loadedWalls);
      } else {
        setBuildingConfig(null);
        setWallConfigs({
          left: { url: "", scale: 1.0, preset: "medium" },
          back: { url: "", scale: 1.0, preset: "medium" },
          right: { url: "", scale: 1.0, preset: "medium" }
        });
      }
    });

    // Real-time subscription to customer queue settings in subcollection
    const unsubscribeQueueConfig = onSnapshot(estSetting("queueConfig"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const limitVal = Number(data.maxPartySize);
        if (limitVal && limitVal > 0) {
          setMaxCustomerCapacity(limitVal);
          setInputMaxCapacity(limitVal);
        }
      } else {
        setMaxCustomerCapacity(10);
        setInputMaxCapacity(10);
      }
    });

    return () => {
      unsubEst();
      unsubscribeReservations();
      unsubscribeTables();
      unsubscribeLatestTable();
      unsubscribeBuilding();
      unsubscribeQueueConfig();
    };
  }, [activeSlug, currentUser]);

  const handleSaveCustomerCapacity = async (newLimit) => {
    const targetValue = Math.max(1, Math.min(100, Number(newLimit !== undefined ? newLimit : inputMaxCapacity) || 10));
    setIsSavingCapacity(true);
    setCapacitySaveMessage("");
    try {
      await setDoc(estSetting("queueConfig"), {
        maxPartySize: targetValue,
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.email || "admin"
      }, { merge: true });

      setMaxCustomerCapacity(targetValue);
      setInputMaxCapacity(targetValue);
      setCapacitySaveMessage(`✓ Saved! Customers joining online can now select up to ${targetValue} guests.`);
      setTimeout(() => setCapacitySaveMessage(""), 5000);
    } catch (err) {
      alert("Error saving max customer capacity: " + err.message);
    } finally {
      setIsSavingCapacity(false);
    }
  };

  const handleAddWalkIn = async (e) => {
    e.preventDefault();
    if (!newName) return;
    await addDoc(estColl("reservations"), {
      customerName: newName,
      partySize: Number(newPartySize),
      status: "waiting",
      createdAt: serverTimestamp(),
      createdBy: currentUser?.uid || "admin"
    });
    setNewName("");
    setNewPartySize(1);
  };

  const handleAddTable = async (e) => {
    e.preventDefault();
    try {
      await addDoc(estColl("tables"), {
        tableNumber: Number(newTableNumber),
        capacity: Number(capacity),
        status: "available",
        reservationId: null,
        createdAt: serverTimestamp(),
      });
      setCapacity(2);
    } catch (err) {
      alert("Error adding table: " + err.message);
    }
  };

  const handleAssignTable = async (tableId, tableNumber, reservationId) => {
    if (!reservationId) return;
    try {
      // Release any previously occupied table by this reservation if reassigning
      const prevTable = tables.find((t) => t.reservationId === reservationId && t.id !== tableId);
      if (prevTable) {
        await updateDoc(estDoc("tables", prevTable.id), {
          status: "available",
          reservationId: null,
        });
      }

      // 1. Update reservation: assign tableNumber and set status to "eating"
      await updateDoc(estDoc("reservations", reservationId), {
        tableNumber: Number(tableNumber),
        status: "eating",
      });

      // 2. Update table: mark as occupied and link reservationId
      await updateDoc(estDoc("tables", tableId), {
        status: "occupied",
        reservationId: reservationId,
      });
    } catch (err) {
      alert("Error assigning table: " + err.message);
    }
  };

  const handleCompleteTable = async (tableId, reservationId) => {
    try {
      // 1. Set table back to available and clear reservationId
      await updateDoc(estDoc("tables", tableId), {
        status: "available",
        reservationId: null,
      });

      // 2. If table was linked to a reservation, mark that reservation as completed
      if (reservationId) {
        await updateDoc(estDoc("reservations", reservationId), {
          status: "completed",
        });
      }
    } catch (err) {
      alert("Error completing table: " + err.message);
    }
  };

  const handleDeleteTable = async (tableId, tableNumber) => {
    if (!confirm(`Delete Table ${tableNumber}?`)) return;
    try {
      await deleteDoc(estDoc("tables", tableId));
    } catch (err) {
      alert("Error deleting table: " + err.message);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    await updateDoc(estDoc("reservations", id), { status });
  };

  const handleDelete = async (id) => {
    if (confirm("Delete this reservation?")) {
      await deleteDoc(estDoc("reservations", id));
    }
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    await updateDoc(estDoc("reservations", editingItem.id), {
      customerName: editingItem.customerName,
      partySize: Number(editingItem.partySize),
      status: editingItem.status
    });
    setEditingItem(null);
  };

  const updateWallConfig = (side, patch) => {
    setWallConfigs((prev) => ({
      ...prev,
      [side]: { ...prev[side], ...patch }
    }));
    setWallSaveMessage("");
  };

  const handleWallFileUpload = (side, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file (PNG, JPG, SVG, WebP, etc.)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 512;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
        const compressedDataUrl = canvas.toDataURL(mimeType, 0.88);
        updateWallConfig(side, { url: compressedDataUrl });
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleClearWall = (side) => {
    updateWallConfig(side, { url: "" });
  };

  const handleCopyWallToAll = (sourceSide) => {
    const source = wallConfigs[sourceSide];
    if (!source?.url) {
      alert("Please add an image to this wall before copying.");
      return;
    }
    setWallConfigs({
      left: { ...source },
      back: { ...source },
      right: { ...source }
    });
    setWallSaveMessage(`Copied ${sourceSide.toUpperCase()} wall picture & frame size to all 3 walls! Click "Save Wall Artworks" to apply.`);
  };

  const handleSaveAllWallSignage = async (e) => {
    e?.preventDefault();
    setIsSavingWallSignage(true);
    setWallSaveMessage("");
    try {
      const activeSides = ["left", "back", "right"].filter((s) => Boolean(wallConfigs[s]?.url?.trim()));

      await setDoc(estSetting("building"), {
        walls: wallConfigs,
        logoUrl: wallConfigs.back?.url || wallConfigs.left?.url || wallConfigs.right?.url || "",
        logoSides: activeSides,
        logoSide: activeSides[0] || "back",
        frameScale: wallConfigs.back?.scale || wallConfigs.left?.scale || wallConfigs.right?.scale || 1.0,
        frameSizePreset: wallConfigs.back?.preset || wallConfigs.left?.preset || "medium",
        updatedAt: serverTimestamp(),
        updatedBy: currentUser?.email || "admin"
      }, { merge: true });

      const count = activeSides.length;
      setWallSaveMessage(`✓ Saved! ${count} wall${count === 1 ? "" : "s"} now displaying custom framed pictures on the 3D building.`);
      setTimeout(() => setWallSaveMessage(""), 5000);
    } catch (err) {
      alert("Error saving wall art: " + err.message);
    } finally {
      setIsSavingWallSignage(false);
    }
  };

  const handleClearAllWalls = async () => {
    if (!confirm("Clear custom pictures and frames from all 3 walls?")) return;
    setIsSavingWallSignage(true);
    const cleared = {
      left: { url: "", scale: 1.0, preset: "medium" },
      back: { url: "", scale: 1.0, preset: "medium" },
      right: { url: "", scale: 1.0, preset: "medium" }
    };
    try {
      await setDoc(estSetting("building"), {
        walls: cleared,
        logoUrl: "",
        logoSides: [],
        updatedAt: serverTimestamp()
      }, { merge: true });
      setWallConfigs(cleared);
      setWallSaveMessage("Cleared all wall artwork.");
      setTimeout(() => setWallSaveMessage(""), 4000);
    } catch (err) {
      alert("Error clearing walls: " + err.message);
    } finally {
      setIsSavingWallSignage(false);
    }
  };

  if (!activeSlug) {
    return <Navigate to="/admin" replace />;
  }

  if (loadingEst) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FAF9F5",
        color: "#73716B",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        gap: 14
      }}>
        <div style={{
          width: 32,
          height: 32,
          border: "2.5px solid #E5E3DC",
          borderTopColor: "#CC785C",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite"
        }}>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
        <span style={{ fontSize: 14, fontWeight: 500 }}>
          Loading dashboard for /admin/{activeSlug}...
        </span>
      </div>
    );
  }

  if (estNotFound || !establishment) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#FAF9F5",
        padding: "24px 16px",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#1F1E1D",
        boxSizing: "border-box"
      }}>
        <div style={{
          width: "100%",
          maxWidth: 440,
          backgroundColor: "#FFFFFF",
          border: "1px solid #E5E3DC",
          borderRadius: 16,
          padding: "36px 28px",
          textAlign: "center",
          boxShadow: "0 4px 24px rgba(31, 30, 29, 0.04)"
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: "#F8EFEA",
            border: "1px solid rgba(204, 120, 92, 0.25)",
            color: "#CC785C",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            marginBottom: 16
          }}>
            🏛️
          </div>
          <h2 style={{
            fontFamily: "'Charter', 'Sitka Text', 'Cambria', Georgia, serif",
            fontSize: 22,
            fontWeight: 600,
            margin: "0 0 8px 0"
          }}>
            Establishment Not Found
          </h2>
          <p style={{ fontSize: 14, color: "#73716B", lineHeight: 1.5, margin: "0 0 24px 0" }}>
            The establishment <code style={{ backgroundColor: "#F4F2EC", padding: "2px 6px", borderRadius: 4, color: "#CC785C", fontWeight: 600 }}>/admin/{activeSlug}</code> does not exist or you do not have permission to manage it.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {userEstablishments && userEstablishments.length > 0 ? (
              <Link
                to={`/admin/${userEstablishments[0].slug}`}
                style={{
                  display: "block",
                  padding: "11px 16px",
                  backgroundColor: "#CC785C",
                  color: "#FFFFFF",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none"
                }}
              >
                Go to {userEstablishments[0].name} Dashboard
              </Link>
            ) : (
              <Link
                to="/register"
                style={{
                  display: "block",
                  padding: "11px 16px",
                  backgroundColor: "#CC785C",
                  color: "#FFFFFF",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none"
                }}
              >
                Register New Store
              </Link>
            )}
            <button
              onClick={logout}
              style={{
                padding: "10px 16px",
                backgroundColor: "transparent",
                color: "#57534E",
                border: "1px solid #E5E3DC",
                borderRadius: 8,
                fontSize: 13.5,
                fontWeight: 500,
                cursor: "pointer"
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-root" style={{
      minHeight: "100vh",
      backgroundColor: "#FAF9F5",
      fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif",
      color: "#1F1E1D",
      padding: "24px 16px 48px",
      boxSizing: "border-box"
    }}>
      <style>{`
        .admin-table-scroll {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border: 1px solid #EAE8E1;
          border-radius: 10px;
          width: 100%;
          background: #FFFFFF;
          scrollbar-width: thin;
          scrollbar-color: #DCD9D0 #F7F5EE;
        }
        .admin-table-scroll::-webkit-scrollbar {
          height: 6px;
        }
        .admin-table-scroll::-webkit-scrollbar-track {
          background: #F7F5EE;
          border-radius: 4px;
        }
        .admin-table-scroll::-webkit-scrollbar-thumb {
          background: #DCD9D0;
          border-radius: 4px;
        }
        .admin-table-scroll::-webkit-scrollbar-thumb:hover {
          background: #CC785C;
        }
        @media (max-width: 640px) {
          .admin-dashboard-root {
            padding: 16px 12px 40px !important;
          }
          .admin-card {
            padding: 16px 12px !important;
            border-radius: 12px !important;
          }
          .mobile-scroll-hint {
            display: flex !important;
          }
        }
      `}</style>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* Navigation & Header */}
        <header style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          paddingBottom: 20,
          borderBottom: "1px solid #EAE8E1",
          marginBottom: 28
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 38,
              height: 38,
              borderRadius: 10,
              backgroundColor: "#F8EFEA",
              border: "1px solid rgba(204, 120, 92, 0.25)",
              color: "#CC785C"
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z" />
              </svg>
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h2 style={{
                  margin: 0,
                  fontFamily: "'Charter', 'Sitka Text', 'Cambria', Georgia, serif",
                  fontSize: 24,
                  fontWeight: 600,
                  letterSpacing: "-0.3px",
                  color: "#1F1E1D"
                }}>
                  {establishment?.name || "Admin Management"}
                </h2>
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 6,
                  backgroundColor: "#F0ECE1",
                  color: "#52504B",
                  border: "1px solid #DCD9D0"
                }}>
                  /q/{activeSlug}
                </span>
              </div>
              <span style={{ fontSize: 13, color: "#73716B" }}>
                {establishment?.category ? `${establishment.category} • ` : ""}Live queue & seating coordination
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {/* Store Switcher if user manages multiple establishments */}
            {userEstablishments && userEstablishments.length > 1 && (
              <select
                value={activeSlug}
                onChange={(e) => navigate(`/admin/${e.target.value}`)}
                style={{
                  padding: "8px 12px",
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #DCD9D0",
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#1F1E1D",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  outline: "none"
                }}
              >
                {userEstablishments.map((est) => (
                  <option key={est.slug} value={est.slug}>
                    🏬 {est.name}
                  </option>
                ))}
              </select>
            )}

            <Link
              to="/register"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "8px 12px",
                backgroundColor: "#FBF9F5",
                border: "1px solid #DCD9D0",
                borderRadius: 8,
                color: "#73716B",
                fontSize: 12.5,
                fontWeight: 500,
                textDecoration: "none",
                transition: "all 0.15s ease"
              }}
              onMouseOver={(e) => { e.currentTarget.style.color = "#1F1E1D"; }}
              onMouseOut={(e) => { e.currentTarget.style.color = "#73716B"; }}
              title="Register another establishment"
            >
              + New Store
            </Link>

            <Link
              to={`/q/${activeSlug}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                backgroundColor: "#FFFFFF",
                border: "1px solid #DCD9D0",
                borderRadius: 8,
                color: "#52504B",
                fontSize: 13,
                fontWeight: 500,
                textDecoration: "none",
                transition: "all 0.15s ease"
              }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = "#CC785C"; e.currentTarget.style.color = "#CC785C"; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = "#DCD9D0"; e.currentTarget.style.color = "#52504B"; }}
            >
              👁️ View Queue Stage
            </Link>

            <button 
              onClick={() => setShowQR(!showQR)}
              style={{
                padding: "8px 14px",
                backgroundColor: showQR ? "#F8EFEA" : "#FFFFFF",
                border: showQR ? "1px solid #CC785C" : "1px solid #DCD9D0",
                color: showQR ? "#CC785C" : "#3D3B35",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
                fontFamily: "inherit"
              }}
            >
              {showQR ? "Hide QR Code" : "Show QR Code"}
            </button>

            <button 
              onClick={logout}
              style={{
                padding: "8px 14px",
                backgroundColor: "transparent",
                border: "1px solid #E5E3DC",
                color: "#73716B",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
                fontFamily: "inherit"
              }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#F3F1EC"; e.currentTarget.style.color = "#1F1E1D"; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#73716B"; }}
            >
              Sign Out
            </button>
          </div>
        </header>

        {showQR && (
          <div style={{
            marginBottom: 28,
            padding: 24,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E3DC",
            borderRadius: 16,
            boxShadow: "0 1px 3px rgba(31, 30, 29, 0.04)"
          }}>
            <QRCodeDisplay slug={activeSlug} establishmentName={establishment?.name} />
          </div>
        )}

        {/* Section: Customer Queue Capacity Settings */}
        <section className="admin-card" style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E5E3DC",
          borderRadius: 16,
          padding: 24,
          marginBottom: 28,
          boxShadow: "0 1px 3px rgba(31, 30, 29, 0.04)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 14, marginBottom: 16 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h3 style={{
                  margin: 0,
                  fontFamily: "'Charter', 'Sitka Text', 'Cambria', Georgia, serif",
                  fontSize: 19,
                  fontWeight: 600,
                  color: "#1F1E1D"
                }}>
                  Customer Queue Capacity Limit
                </h3>
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: 12,
                  backgroundColor: "rgba(204, 120, 92, 0.12)",
                  color: "#CC785C",
                  border: "1px solid rgba(204, 120, 92, 0.25)"
                }}>
                  Current Max: {maxCustomerCapacity} {maxCustomerCapacity === 1 ? "Guest" : "Guests"}
                </span>
              </div>
              <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#73716B" }}>
                Set the maximum party capacity that customers are allowed to select when joining the queue online.
              </p>
            </div>
          </div>

          {capacitySaveMessage && (
            <div style={{
              padding: "10px 14px",
              backgroundColor: "rgba(78, 120, 94, 0.1)",
              border: "1px solid rgba(78, 120, 94, 0.25)",
              borderRadius: 8,
              color: "#3B6B52",
              fontSize: 13,
              fontWeight: 500,
              marginBottom: 16
            }}>
              {capacitySaveMessage}
            </div>
          )}

          <div style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            padding: "16px 18px",
            backgroundColor: "#FBF9F5",
            border: "1px solid #EAE8E1",
            borderRadius: 12
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#73716B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Max Allowed Party Size
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={inputMaxCapacity}
                  onChange={(e) => setInputMaxCapacity(e.target.value)}
                  style={{
                    width: 90,
                    padding: "9px 12px",
                    fontSize: 15,
                    fontWeight: 600,
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #DCD9D0",
                    borderRadius: 8,
                    color: "#1F1E1D",
                    outline: "none"
                  }}
                  onFocus={(e) => (e.target.style.borderColor = "#CC785C")}
                  onBlur={(e) => (e.target.style.borderColor = "#DCD9D0")}
                />
                <span style={{ fontSize: 13.5, color: "#52504B", fontWeight: 500 }}>
                  guests maximum
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: "1 1 260px" }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#73716B", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Quick Presets
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[2, 4, 6, 8, 10, 12, 15, 20].map((num) => {
                  const isSelected = Number(inputMaxCapacity) === num;
                  const isSaved = maxCustomerCapacity === num;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setInputMaxCapacity(num)}
                      style={{
                        padding: "5px 11px",
                        fontSize: 12.5,
                        fontWeight: isSelected ? 600 : 500,
                        backgroundColor: isSelected ? "#CC785C" : isSaved ? "rgba(204, 120, 92, 0.12)" : "#FFFFFF",
                        color: isSelected ? "#FFFFFF" : isSaved ? "#B85D3F" : "#52504B",
                        border: isSelected ? "1px solid #CC785C" : isSaved ? "1px solid rgba(204, 120, 92, 0.3)" : "1px solid #DCD9D0",
                        borderRadius: 6,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                        fontFamily: "inherit"
                      }}
                      onMouseOver={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = "#F3F1EC";
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = isSaved ? "rgba(204, 120, 92, 0.12)" : "#FFFFFF";
                        }
                      }}
                    >
                      {num} {isSaved && !isSelected ? "•" : ""}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSaveCustomerCapacity(inputMaxCapacity)}
              disabled={isSavingCapacity || Number(inputMaxCapacity) === maxCustomerCapacity}
              style={{
                alignSelf: "flex-end",
                padding: "9px 20px",
                backgroundColor: Number(inputMaxCapacity) === maxCustomerCapacity ? "#E5E3DC" : "#CC785C",
                color: Number(inputMaxCapacity) === maxCustomerCapacity ? "#8C8980" : "#FFFFFF",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: Number(inputMaxCapacity) === maxCustomerCapacity ? "default" : "pointer",
                transition: "all 0.15s ease",
                fontFamily: "inherit",
                boxShadow: Number(inputMaxCapacity) === maxCustomerCapacity ? "none" : "0 1px 3px rgba(204, 120, 92, 0.3)"
              }}
              onMouseOver={(e) => {
                if (Number(inputMaxCapacity) !== maxCustomerCapacity) {
                  e.currentTarget.style.backgroundColor = "#B85D3F";
                }
              }}
              onMouseOut={(e) => {
                if (Number(inputMaxCapacity) !== maxCustomerCapacity) {
                  e.currentTarget.style.backgroundColor = "#CC785C";
                }
              }}
            >
              {isSavingCapacity ? "Saving..." : Number(inputMaxCapacity) === maxCustomerCapacity ? "Saved" : "Save Capacity Limit"}
            </button>
          </div>
        </section>

        {/* Section: Queue Management & Walk-ins */}
        <section className="admin-card" style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E5E3DC",
          borderRadius: 16,
          padding: 24,
          marginBottom: 28,
          boxShadow: "0 1px 3px rgba(31, 30, 29, 0.04)"
        }}>
          <div style={{ marginBottom: 18 }}>
            <h3 style={{
              margin: "0 0 4px 0",
              fontFamily: "'Charter', 'Sitka Text', 'Cambria', Georgia, serif",
              fontSize: 19,
              fontWeight: 600,
              color: "#1F1E1D"
            }}>
              Add Walk-In Guest
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: "#73716B" }}>
              Quickly register guests who arrive in person into the queue
            </p>
          </div>

          <form onSubmit={handleAddWalkIn} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <input 
              type="text" 
              placeholder="Customer Name" 
              value={newName} 
              onChange={(e) => setNewName(e.target.value)} 
              required 
              style={{
                flex: "2 1 200px",
                padding: "9px 13px",
                fontSize: 14,
                backgroundColor: "#FBF9F5",
                border: "1px solid #DCD9D0",
                borderRadius: 8,
                color: "#1F1E1D",
                outline: "none",
                transition: "border-color 0.15s"
              }}
              onFocus={(e) => (e.target.style.borderColor = "#CC785C")}
              onBlur={(e) => (e.target.style.borderColor = "#DCD9D0")}
            />
            <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "1 1 140px" }}>
              <span style={{ fontSize: 13, color: "#73716B" }}>Party:</span>
              <input 
                type="number" 
                min="1" 
                value={newPartySize} 
                onChange={(e) => setNewPartySize(e.target.value)} 
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  fontSize: 14,
                  backgroundColor: "#FBF9F5",
                  border: "1px solid #DCD9D0",
                  borderRadius: 8,
                  color: "#1F1E1D",
                  outline: "none"
                }}
                onFocus={(e) => (e.target.style.borderColor = "#CC785C")}
                onBlur={(e) => (e.target.style.borderColor = "#DCD9D0")}
              />
              <span style={{ fontSize: 11.5, color: "#8C8980", whiteSpace: "nowrap" }} title={`Customers joining online are capped at ${maxCustomerCapacity} guests`}>
                (Online max: {maxCustomerCapacity})
              </span>
            </div>
            <button 
              type="submit"
              style={{
                padding: "9px 18px",
                backgroundColor: "#CC785C",
                color: "#FFFFFF",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 0.15s ease",
                fontFamily: "inherit"
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#B85D3F")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#CC785C")}
            >
              Add to Queue
            </button>
          </form>

          {/* Reservation Header with Toggle */}
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            marginTop: 28, 
            marginBottom: 14, 
            flexWrap: "wrap", 
            gap: 12 
          }}>
            <h4 style={{ 
              margin: 0, 
              fontFamily: "'Charter', 'Sitka Text', 'Cambria', Georgia, serif",
              fontSize: 17, 
              fontWeight: 600, 
              color: "#1F1E1D" 
            }}>
              Reservations Queue
            </h4>

            {/* Actions & Segmented Control */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  setAssigningReservation(null);
                  setIsTableModalOpen(true);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  fontSize: 12.5,
                  fontWeight: 500,
                  backgroundColor: "#FFFFFF",
                  border: "1px solid #DCD9D0",
                  borderRadius: 8,
                  color: "#52504B",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  fontFamily: "inherit"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = "#CC785C";
                  e.currentTarget.style.color = "#CC785C";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = "#DCD9D0";
                  e.currentTarget.style.color = "#52504B";
                }}
              >
                <span>🪑</span>
                <span>Dining Tables ({tables.filter((t) => t.status === "available").length} Open)</span>
              </button>

              {/* Segmented Control */}
              <div style={{ 
                display: "inline-flex", 
                backgroundColor: "#F0ECE1", 
                borderRadius: 8, 
                padding: 3,
                border: "1px solid #E2DFD6" 
              }}>
                <button
                  type="button"
                  onClick={() => setShowActiveOnly(true)}
                  style={{
                    padding: "6px 14px",
                    fontSize: 12.5,
                    fontWeight: showActiveOnly ? 600 : 500,
                    backgroundColor: showActiveOnly ? "#CC785C" : "transparent",
                    color: showActiveOnly ? "#FFFFFF" : "#52504B",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    fontFamily: "inherit",
                    boxShadow: showActiveOnly ? "0 1px 3px rgba(204, 120, 92, 0.3)" : "none"
                  }}
                >
                  Active Only ({activeReservations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setShowActiveOnly(false)}
                  style={{
                    padding: "6px 14px",
                    fontSize: 12.5,
                    fontWeight: !showActiveOnly ? 600 : 500,
                    backgroundColor: !showActiveOnly ? "#CC785C" : "transparent",
                    color: !showActiveOnly ? "#FFFFFF" : "#52504B",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    fontFamily: "inherit",
                    boxShadow: !showActiveOnly ? "0 1px 3px rgba(204, 120, 92, 0.3)" : "none"
                  }}
                >
                  All ({reservations.length})
                </button>
              </div>
            </div>
          </div>

          {/* Mobile swipe hint */}
          <div className="mobile-scroll-hint" style={{
            display: "none",
            alignItems: "center",
            gap: 4,
            fontSize: 11.5,
            color: "#8C8980",
            marginBottom: 6,
            justifyContent: "flex-end"
          }}>
            <span>Scroll sideways to view actions ➔</span>
          </div>

          {/* Reservation Table */}
          <div className="admin-table-scroll">
            <table style={{ width: "100%", minWidth: 660, borderCollapse: "collapse", textAlign: "left", fontSize: 13.5 }}>
              <thead>
                <tr style={{ backgroundColor: "#F7F5EE", borderBottom: "1px solid #EAE8E1" }}>
                  <th style={{ padding: "10px 14px", color: "#73716B", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>Customer</th>
                  <th style={{ padding: "10px 14px", color: "#73716B", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>Party</th>
                  <th style={{ padding: "10px 14px", color: "#73716B", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>Status</th>
                  <th style={{ padding: "10px 14px", color: "#73716B", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>Assign to a table</th>
                  <th style={{ padding: "10px 14px", color: "#73716B", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "right", whiteSpace: "nowrap" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedReservations.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: 24, textAlign: "center", color: "#8C8980" }}>
                      {showActiveOnly ? "No active waiting or seated guests." : "No reservations found."}
                    </td>
                  </tr>
                ) : (
                  displayedReservations.map((res) => {
                    const isEating = res.status === "eating";
                    const isWaiting = res.status === "waiting";
                    return (
                      <tr key={res.id} style={{ borderBottom: "1px solid #F0EEE6", transition: "background 0.1s" }}>
                        <td style={{ padding: "12px 14px", fontWeight: 500, color: "#1F1E1D", whiteSpace: "nowrap" }}>
                          {res.customerName}
                        </td>
                        <td style={{ padding: "12px 14px", color: "#52504B", whiteSpace: "nowrap" }}>
                          {res.partySize} {res.partySize === 1 ? "guest" : "guests"}
                        </td>
                        {/* Status Column (Not editable read-only badge) */}
                        <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "4px 9px",
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 6,
                            backgroundColor: isWaiting 
                              ? "rgba(217, 130, 43, 0.1)" 
                              : isEating 
                              ? "rgba(204, 120, 92, 0.12)" 
                              : "rgba(78, 120, 94, 0.1)",
                            color: isWaiting 
                              ? "#B45309" 
                              : isEating 
                              ? "#CC785C" 
                              : "#3B6B52",
                            border: isWaiting 
                              ? "1px solid rgba(217, 130, 43, 0.25)" 
                              : isEating 
                              ? "1px solid rgba(204, 120, 92, 0.3)" 
                              : "1px solid rgba(78, 120, 94, 0.25)",
                            textTransform: "capitalize"
                          }}>
                            <span style={{ fontSize: 8 }}>●</span>
                            {isWaiting 
                              ? "Waiting" 
                              : isEating 
                              ? `Seated (Table #${res.tableNumber || "?"})` 
                              : res.status}
                          </span>
                        </td>
                        {/* New Action Column: Assign to a table */}
                        <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setAssigningReservation(res);
                              setIsTableModalOpen(true);
                            }}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "5px 12px",
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 6,
                              border: isWaiting ? "none" : "1px solid #DCD9D0",
                              backgroundColor: isWaiting ? "#CC785C" : "#F7F5EE",
                              color: isWaiting ? "#FFFFFF" : "#52504B",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              fontFamily: "inherit",
                              boxShadow: isWaiting ? "0 1px 2px rgba(204, 120, 92, 0.2)" : "none"
                            }}
                            onMouseOver={(e) => {
                              if (isWaiting) {
                                e.currentTarget.style.backgroundColor = "#B85D3F";
                              } else {
                                e.currentTarget.style.backgroundColor = "#EFECE4";
                              }
                            }}
                            onMouseOut={(e) => {
                              if (isWaiting) {
                                e.currentTarget.style.backgroundColor = "#CC785C";
                              } else {
                                e.currentTarget.style.backgroundColor = "#F7F5EE";
                              }
                            }}
                          >
                            <span>🪑</span>
                            <span>
                              {isEating && res.tableNumber 
                                ? `Table #${res.tableNumber} (Reassign)` 
                                : "Assign to a table"}
                            </span>
                          </button>
                        </td>
                        <td style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                          <button 
                            onClick={() => setEditingItem(res)} 
                            style={{
                              padding: "4px 10px",
                              fontSize: 12,
                              fontWeight: 500,
                              backgroundColor: "#F7F5EE",
                              border: "1px solid #DCD9D0",
                              color: "#3D3B35",
                              borderRadius: 6,
                              cursor: "pointer",
                              marginRight: 6,
                              transition: "all 0.15s ease",
                              fontFamily: "inherit"
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#EFECE4")}
                            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#F7F5EE")}
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDelete(res.id)} 
                            style={{
                              padding: "4px 10px",
                              fontSize: 12,
                              fontWeight: 500,
                              backgroundColor: "transparent",
                              border: "1px solid rgba(194, 65, 56, 0.3)",
                              color: "#C24138",
                              borderRadius: 6,
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              fontFamily: "inherit"
                            }}
                            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "rgba(194, 65, 56, 0.08)")}
                            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section: Multi-Wall 3D Signage & Framed Pictures */}
        <section className="admin-card" style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #E5E3DC",
          borderRadius: 16,
          padding: 24,
          marginBottom: 28,
          boxShadow: "0 1px 3px rgba(31, 30, 29, 0.04)"
        }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <h3 style={{
                margin: 0,
                fontFamily: "'Charter', 'Sitka Text', 'Cambria', Georgia, serif",
                fontSize: 19,
                fontWeight: 600,
                color: "#1F1E1D"
              }}>
                Establishment Wall Art & Signage
              </h3>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "3px 10px",
                  borderRadius: 6,
                  backgroundColor: "#F7F5EE",
                  border: "1px solid #DCD9D0",
                  color: "#52504B"
                }}>
                  {["left", "back", "right"].filter((s) => Boolean(wallConfigs[s]?.url)).length} of 3 Walls Mounted
                </span>
                <Link
                  to="/"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "4px 12px",
                    backgroundColor: "#F7F5EE",
                    border: "1px solid #DCD9D0",
                    borderRadius: 6,
                    color: "#52504B",
                    fontSize: 12,
                    fontWeight: 500,
                    textDecoration: "none"
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = "#CC785C";
                    e.currentTarget.style.color = "#CC785C";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = "#DCD9D0";
                    e.currentTarget.style.color = "#52504B";
                  }}
                >
                  👁️ View on 3D Stage
                </Link>
              </div>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#73716B" }}>
              Each exterior wall (Left Wall, Back Wall, and Right Wall) can display a different framed image, menu, logo, or poster at its own custom frame size.
            </p>
          </div>

          {/* 3-Wall Switcher Gallery */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: 12,
            marginBottom: 20
          }}>
            {WALL_SIDES.map((w) => {
              const isSelected = activeWallTab === w.id;
              const config = wallConfigs[w.id] || { url: "", scale: 1.0, preset: "medium" };
              const hasPic = Boolean(config.url);

              return (
                <div
                  key={w.id}
                  onClick={() => {
                    setActiveWallTab(w.id);
                    setWallSaveMessage("");
                  }}
                  style={{
                    padding: "14px 14px",
                    backgroundColor: isSelected ? "#FBF7F4" : "#FFFFFF",
                    border: isSelected ? "2px solid #CC785C" : "1px solid #E0DDD5",
                    borderRadius: 12,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    position: "relative",
                    boxShadow: isSelected ? "0 2px 8px rgba(204, 120, 92, 0.12)" : "none"
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 16 }}>{w.icon}</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: isSelected ? "#CC785C" : "#1F1E1D" }}>
                          {w.label}
                        </span>
                      </div>
                      <span style={{
                        fontSize: 10.5,
                        fontWeight: 600,
                        padding: "2px 7px",
                        borderRadius: 5,
                        backgroundColor: hasPic ? "rgba(78, 120, 94, 0.12)" : "#F0EEE6",
                        color: hasPic ? "#3B6B52" : "#8C8980",
                        border: hasPic ? "1px solid rgba(78, 120, 94, 0.25)" : "1px solid #DCD9D0"
                      }}>
                        {hasPic ? `Active (${config.scale || 1.0}x)` : "Empty"}
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "#73716B", marginBottom: 12 }}>
                      {w.desc}
                    </div>
                  </div>

                  {/* Miniature 3D Frame Preview */}
                  <div style={{
                    height: 90,
                    backgroundColor: "#2B1D15",
                    border: "2px solid #C59B4B",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 4,
                    overflow: "hidden",
                    position: "relative",
                    boxShadow: "inset 0 0 8px rgba(0,0,0,0.4)"
                  }}>
                    {hasPic ? (
                      <div style={{
                        width: "100%",
                        height: "100%",
                        backgroundColor: "#FAF9F5",
                        borderRadius: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: 2,
                        boxSizing: "border-box"
                      }}>
                        <img 
                          src={config.url} 
                          alt={w.label} 
                          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} 
                        />
                      </div>
                    ) : (
                      <div style={{
                        color: "#A89F91",
                        fontSize: 11.5,
                        textAlign: "center",
                        padding: "0 8px"
                      }}>
                        <span>+ No picture</span>
                        <div style={{ fontSize: 10, color: "#857D71", marginTop: 2 }}>Click to configure</div>
                      </div>
                    )}
                  </div>

                  {isSelected && (
                    <div style={{
                      marginTop: 8,
                      textAlign: "center",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "#CC785C"
                    }}>
                      ● Selected for Editing
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Active Wall Configuration Card */}
          {(() => {
            const currentWall = WALL_SIDES.find((w) => w.id === activeWallTab) || WALL_SIDES[0];
            const currentConfig = wallConfigs[activeWallTab] || { url: "", scale: 1.0, preset: "medium" };
            const currentScale = Number(currentConfig.scale) || 1.0;

            return (
              <form onSubmit={handleSaveAllWallSignage}>
                <div style={{
                  padding: 20,
                  backgroundColor: "#FAF9F5",
                  border: "1px solid #EAE8E1",
                  borderRadius: 14,
                  marginBottom: 20
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                    <div>
                      <h4 style={{ margin: "0 0 3px 0", fontSize: 15, fontWeight: 600, color: "#1F1E1D" }}>
                        {currentWall.icon} Editing {currentWall.label}
                      </h4>
                      <span style={{ fontSize: 12, color: "#73716B" }}>
                        {currentWall.orientation} • {currentWall.desc}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {currentConfig.url && (
                        <button
                          type="button"
                          onClick={() => handleClearWall(activeWallTab)}
                          style={{
                            padding: "4px 10px",
                            fontSize: 11.5,
                            fontWeight: 500,
                            backgroundColor: "transparent",
                            border: "1px solid rgba(194, 65, 56, 0.35)",
                            borderRadius: 6,
                            color: "#C24138",
                            cursor: "pointer"
                          }}
                        >
                          Clear Picture
                        </button>
                      )}
                      {currentConfig.url && (
                        <button
                          type="button"
                          onClick={() => handleCopyWallToAll(activeWallTab)}
                          title="Copy this picture and size to the other 2 walls"
                          style={{
                            padding: "4px 10px",
                            fontSize: 11.5,
                            fontWeight: 500,
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #DCD9D0",
                            borderRadius: 6,
                            color: "#52504B",
                            cursor: "pointer"
                          }}
                        >
                          Copy to All 3 Walls
                        </button>
                      )}
                    </div>
                  </div>

                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                    gap: 20
                  }}>
                    {/* Visualizer: Realistic 3D Picture Frame Replica */}
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#52504B", marginBottom: 8 }}>
                        Live 3D Frame Preview ({currentWall.label})
                      </label>
                      <div style={{
                        height: 230,
                        backgroundColor: "#2B1D15",
                        border: "3px solid #C59B4B",
                        borderRadius: 12,
                        padding: 14,
                        boxSizing: "border-box",
                        boxShadow: "0 6px 18px rgba(0,0,0,0.18), inset 0 0 12px rgba(0,0,0,0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative"
                      }}>
                        {/* Brass corner brackets */}
                        <div style={{ position: "absolute", top: 4, left: 4, width: 14, height: 14, borderTop: "3px solid #E2BE68", borderLeft: "3px solid #E2BE68" }} />
                        <div style={{ position: "absolute", top: 4, right: 4, width: 14, height: 14, borderTop: "3px solid #E2BE68", borderRight: "3px solid #E2BE68" }} />
                        <div style={{ position: "absolute", bottom: 4, left: 4, width: 14, height: 14, borderBottom: "3px solid #E2BE68", borderLeft: "3px solid #E2BE68" }} />
                        <div style={{ position: "absolute", bottom: 4, right: 4, width: 14, height: 14, borderBottom: "3px solid #E2BE68", borderRight: "3px solid #E2BE68" }} />

                        {/* Top mounting bracket */}
                        <div style={{
                          position: "absolute",
                          top: -7,
                          width: 28,
                          height: 7,
                          backgroundColor: "#C59B4B",
                          borderRadius: "3px 3px 0 0"
                        }} />

                        {currentConfig.url ? (
                          <div style={{
                            width: "100%",
                            height: "100%",
                            backgroundColor: "#FAF9F5",
                            borderRadius: 6,
                            padding: 8,
                            boxSizing: "border-box",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            boxShadow: "inset 0 1px 4px rgba(0,0,0,0.15)"
                          }}>
                            <img 
                              src={currentConfig.url} 
                              alt={`Artwork for ${currentWall.label}`} 
                              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} 
                            />
                          </div>
                        ) : (
                          <div style={{
                            width: "100%",
                            height: "100%",
                            backgroundColor: "#FAF9F5",
                            borderRadius: 6,
                            padding: 16,
                            boxSizing: "border-box",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            textAlign: "center",
                            color: "#8C8980"
                          }}>
                            <span style={{ fontSize: 28, marginBottom: 6 }}>🖼️</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "#52504B" }}>
                              No picture chosen yet
                            </span>
                            <span style={{ fontSize: 11.5, marginTop: 4 }}>
                              Upload an image file or paste a web URL on the right to mount on {currentWall.label}.
                            </span>
                          </div>
                        )}
                      </div>

                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                        <span style={{ fontSize: 11.5, color: "#73716B" }}>
                          Physical scale on 3D wall:
                        </span>
                        <span style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: "#CC785C",
                          backgroundColor: "#FFFFFF",
                          border: "1px solid #DCD9D0",
                          padding: "2px 8px",
                          borderRadius: 6
                        }}>
                          {currentScale}x (~{(1.45 * currentScale).toFixed(2)}m wide)
                        </span>
                      </div>
                    </div>

                    {/* Controls Column */}
                    <div>
                      {/* Step 1: Picture Source */}
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "#52504B", marginBottom: 6 }}>
                          1. Choose Picture for {currentWall.label}
                        </label>
                        
                        {/* File Upload Box */}
                        <div style={{
                          border: "2px dashed #DCD9D0",
                          borderRadius: 10,
                          padding: "12px 14px",
                          textAlign: "center",
                          backgroundColor: "#FFFFFF",
                          cursor: "pointer",
                          marginBottom: 8
                        }}>
                          <input 
                            type="file" 
                            id={`wall-file-${activeWallTab}`}
                            accept="image/*" 
                            onChange={(e) => handleWallFileUpload(activeWallTab, e)}
                            style={{ display: "none" }} 
                          />
                          <label 
                            htmlFor={`wall-file-${activeWallTab}`}
                            style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                          >
                            <span style={{ fontSize: 20 }}>📁</span>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#CC785C" }}>
                              Upload image for {currentWall.label}
                            </span>
                          </label>
                        </div>

                        {/* Or Image URL */}
                        <div>
                          <input 
                            type="url" 
                            placeholder="Or paste direct image URL (https://...)" 
                            value={currentConfig.url || ""} 
                            onChange={(e) => updateWallConfig(activeWallTab, { url: e.target.value.trim() })}
                            style={{
                              width: "100%",
                              padding: "7px 11px",
                              fontSize: 12.5,
                              backgroundColor: "#FFFFFF",
                              border: "1px solid #DCD9D0",
                              borderRadius: 8,
                              color: "#1F1E1D",
                              outline: "none",
                              boxSizing: "border-box"
                            }}
                            onFocus={(e) => (e.target.style.borderColor = "#CC785C")}
                            onBlur={(e) => (e.target.style.borderColor = "#DCD9D0")}
                          />
                        </div>
                      </div>

                      {/* Step 2: Frame Size Controls */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <label style={{ fontSize: 12.5, fontWeight: 600, color: "#52504B", margin: 0 }}>
                            2. Frame Size ({currentWall.label})
                          </label>
                          <span style={{ fontSize: 11, color: "#73716B" }}>
                            Independent scale
                          </span>
                        </div>

                        {/* Preset Buttons */}
                        <div style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(2, 1fr)",
                          gap: 6,
                          marginBottom: 10
                        }}>
                          {[
                            { key: "small", scale: 0.75, title: "Small (0.75x)", desc: "1.1m plaque" },
                            { key: "medium", scale: 1.0, title: "Medium (1.0x)", desc: "1.45m signboard" },
                            { key: "large", scale: 1.35, title: "Large (1.35x)", desc: "1.95m grand facade" },
                            { key: "xlarge", scale: 1.7, title: "Extra Large (1.7x)", desc: "2.45m billboard" }
                          ].map((preset) => {
                            const isPresetActive = Math.abs(currentScale - preset.scale) < 0.05;
                            return (
                              <button
                                key={preset.key}
                                type="button"
                                onClick={() => updateWallConfig(activeWallTab, { scale: preset.scale, preset: preset.key })}
                                style={{
                                  padding: "6px 8px",
                                  textAlign: "left",
                                  backgroundColor: isPresetActive ? "#F8EFEA" : "#FFFFFF",
                                  border: isPresetActive ? "2px solid #CC785C" : "1px solid #DCD9D0",
                                  borderRadius: 8,
                                  cursor: "pointer",
                                  fontFamily: "inherit"
                                }}
                              >
                                <div style={{ fontSize: 11.5, fontWeight: 600, color: isPresetActive ? "#CC785C" : "#1F1E1D" }}>
                                  {preset.title}
                                </div>
                                <div style={{ fontSize: 10, color: "#73716B" }}>
                                  {preset.desc}
                                </div>
                              </button>
                            );
                          })}
                        </div>

                        {/* Slider */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, backgroundColor: "#FFFFFF", padding: "8px 12px", borderRadius: 8, border: "1px solid #E0DDD5" }}>
                          <span style={{ fontSize: 11, color: "#73716B" }}>0.6x</span>
                          <input 
                            type="range"
                            min="0.6"
                            max="1.8"
                            step="0.05"
                            value={currentScale}
                            onChange={(e) => updateWallConfig(activeWallTab, { scale: parseFloat(e.target.value), preset: "custom" })}
                            style={{
                              flex: 1,
                              accentColor: "#CC785C",
                              cursor: "pointer"
                            }}
                          />
                          <span style={{ fontSize: 11, color: "#73716B" }}>1.8x</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Global Action Bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <button
                    type="submit"
                    disabled={isSavingWallSignage}
                    style={{
                      padding: "10px 22px",
                      backgroundColor: "#CC785C",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 13.5,
                      fontWeight: 600,
                      cursor: isSavingWallSignage ? "not-allowed" : "pointer",
                      transition: "background 0.15s ease",
                      fontFamily: "inherit"
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#B85D3F")}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#CC785C")}
                  >
                    {isSavingWallSignage ? "Saving to 3D Building..." : "Save All Wall Artworks to 3D Building"}
                  </button>

                  <button
                    type="button"
                    onClick={handleClearAllWalls}
                    disabled={isSavingWallSignage}
                    style={{
                      padding: "9px 16px",
                      backgroundColor: "transparent",
                      border: "1px solid rgba(194, 65, 56, 0.35)",
                      borderRadius: 8,
                      color: "#C24138",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "inherit"
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "rgba(194, 65, 56, 0.08)")}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    Clear All 3 Walls
                  </button>

                  <Link
                    to="/"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "9px 16px",
                      backgroundColor: "#F7F5EE",
                      border: "1px solid #DCD9D0",
                      borderRadius: 8,
                      color: "#52504B",
                      fontSize: 13,
                      fontWeight: 500,
                      textDecoration: "none",
                      transition: "all 0.15s ease"
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = "#CC785C";
                      e.currentTarget.style.color = "#CC785C";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = "#DCD9D0";
                      e.currentTarget.style.color = "#52504B";
                    }}
                  >
                    👁️ View on 3D Stage
                  </Link>

                  {wallSaveMessage && (
                    <span style={{ fontSize: 13, color: "#3B6B52", fontWeight: 600 }}>
                      {wallSaveMessage}
                    </span>
                  )}
                </div>
              </form>
            );
          })()}
        </section>

        {/* Edit Modal */}
        {editingItem && (
          <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(31, 30, 29, 0.45)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
            boxSizing: "border-box"
          }}>
            <div style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E3DC",
              borderRadius: 16,
              padding: 28,
              width: "100%",
              maxWidth: 360,
              boxShadow: "0 16px 48px rgba(31, 30, 29, 0.15)"
            }}>
              <h3 style={{
                margin: "0 0 16px 0",
                fontFamily: "'Charter', 'Sitka Text', 'Cambria', Georgia, serif",
                fontSize: 20,
                fontWeight: 600,
                color: "#1F1E1D"
              }}>
                Edit Reservation
              </h3>
              
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#52504B", marginBottom: 6 }}>
                  Customer Name
                </label>
                <input 
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 12px",
                    fontSize: 14,
                    backgroundColor: "#FBF9F5",
                    border: "1px solid #DCD9D0",
                    borderRadius: 8,
                    color: "#1F1E1D",
                    outline: "none"
                  }}
                  type="text" 
                  value={editingItem.customerName} 
                  onChange={(e) => setEditingItem({ ...editingItem, customerName: e.target.value })} 
                  onFocus={(e) => (e.target.style.borderColor = "#CC785C")}
                  onBlur={(e) => (e.target.style.borderColor = "#DCD9D0")}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#52504B", marginBottom: 6 }}>
                  Party Size
                </label>
                <input 
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 12px",
                    fontSize: 14,
                    backgroundColor: "#FBF9F5",
                    border: "1px solid #DCD9D0",
                    borderRadius: 8,
                    color: "#1F1E1D",
                    outline: "none"
                  }}
                  type="number" 
                  min="1"
                  value={editingItem.partySize} 
                  onChange={(e) => setEditingItem({ ...editingItem, partySize: e.target.value })} 
                  onFocus={(e) => (e.target.style.borderColor = "#CC785C")}
                  onBlur={(e) => (e.target.style.borderColor = "#DCD9D0")}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button 
                  onClick={() => setEditingItem(null)}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#F7F5EE",
                    border: "1px solid #DCD9D0",
                    color: "#52504B",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit"
                  }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveEdit}
                  style={{
                    padding: "8px 18px",
                    backgroundColor: "#CC785C",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit"
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#B85D3F")}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#CC785C")}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Dining Tables & Seating Management */}
        {isTableModalOpen && (
          <div 
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(31, 30, 29, 0.55)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 110,
              padding: 16
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsTableModalOpen(false);
                setAssigningReservation(null);
              }
            }}
          >
            <div style={{
              backgroundColor: "#FFFFFF",
              border: "1px solid #E5E3DC",
              borderRadius: 18,
              padding: "24px 28px",
              width: "100%",
              maxWidth: 780,
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 50px rgba(31, 30, 29, 0.2)",
              display: "flex",
              flexDirection: "column",
              gap: 20
            }}>
              {/* Modal Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #F0EEE6", paddingBottom: 16 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h3 style={{
                      margin: 0,
                      fontFamily: "'Charter', 'Sitka Text', 'Cambria', Georgia, serif",
                      fontSize: 22,
                      fontWeight: 600,
                      color: "#1F1E1D"
                    }}>
                      Dining Tables & Seating
                    </h3>
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 12,
                      backgroundColor: "rgba(78, 120, 94, 0.12)",
                      color: "#3B6B52"
                    }}>
                      {tables.filter(t => t.status === "available").length} / {tables.length} Open
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "#73716B" }}>
                    {assigningReservation 
                      ? "Choose an open table to seat this guest, or manage your restaurant tables"
                      : "Manage your dining tables, assign walk-ins, and free up tables when dining is finished"}
                  </p>
                </div>

                <button
                  onClick={() => {
                    setIsTableModalOpen(false);
                    setAssigningReservation(null);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 20,
                    lineHeight: 1,
                    color: "#8C8980",
                    cursor: "pointer",
                    padding: "4px 8px",
                    borderRadius: 6,
                    fontFamily: "inherit"
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.color = "#1F1E1D")}
                  onMouseOut={(e) => (e.currentTarget.style.color = "#8C8980")}
                  title="Close modal"
                >
                  ✕
                </button>
              </div>

              {/* Active Guest Banner if assigningReservation is active */}
              {assigningReservation && (
                <div style={{
                  padding: "12px 16px",
                  backgroundColor: "#FDF4EE",
                  border: "1px solid rgba(204, 120, 92, 0.3)",
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 10
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}>🪑</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#B85D3F", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Assigning Table For:
                      </div>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: "#1F1E1D" }}>
                        {assigningReservation.customerName}{" "}
                        <span style={{ fontWeight: 500, color: "#73716B", fontSize: 13 }}>
                          ({assigningReservation.partySize} {assigningReservation.partySize === 1 ? "guest" : "guests"})
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setAssigningReservation(null)}
                    style={{
                      padding: "5px 12px",
                      fontSize: 12,
                      fontWeight: 500,
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #DCD9D0",
                      color: "#73716B",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontFamily: "inherit"
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#F7F5EE")}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
                  >
                    Clear selection
                  </button>
                </div>
              )}

              {/* Dining Tables Table */}
              <div>
                <div className="admin-table-scroll" style={{ border: "1px solid #EAE8E1", borderRadius: 10, overflow: "hidden" }}>
                  <table style={{ width: "100%", minWidth: 620, borderCollapse: "collapse", textAlign: "left", fontSize: 13.5 }}>
                    <thead>
                      <tr style={{ backgroundColor: "#F7F5EE", borderBottom: "1px solid #EAE8E1" }}>
                        <th style={{ padding: "10px 14px", color: "#73716B", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>Table</th>
                        <th style={{ padding: "10px 14px", color: "#73716B", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>Capacity</th>
                        <th style={{ padding: "10px 14px", color: "#73716B", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>Status</th>
                        <th style={{ padding: "10px 14px", color: "#73716B", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>Assigned Guest</th>
                        <th style={{ padding: "10px 14px", color: "#73716B", fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "right", whiteSpace: "nowrap" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tables.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ padding: 28, textAlign: "center", color: "#8C8980" }}>
                            No tables added yet. Add a new table below to get started.
                          </td>
                        </tr>
                      ) : (
                        tables.map((tb) => {
                          const isOccupied = tb.status === "occupied";
                          const fitsGuest = assigningReservation ? tb.capacity >= assigningReservation.partySize : true;
                          const isCurrentGuestTable = assigningReservation && isOccupied && tb.reservationId === assigningReservation.id;

                          return (
                            <tr 
                              key={tb.id} 
                              style={{ 
                                borderBottom: "1px solid #F0EEE6",
                                backgroundColor: isCurrentGuestTable ? "rgba(204, 120, 92, 0.05)" : "transparent"
                              }}
                            >
                              <td style={{ padding: "12px 14px", fontWeight: 600, color: "#1F1E1D", whiteSpace: "nowrap" }}>
                                Table #{tb.tableNumber}
                              </td>
                              <td style={{ padding: "12px 14px", color: "#52504B", whiteSpace: "nowrap" }}>
                                <span>{tb.capacity} seats</span>
                                {assigningReservation && !isOccupied && (
                                  <span style={{
                                    marginLeft: 8,
                                    fontSize: 11,
                                    fontWeight: 600,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                    backgroundColor: fitsGuest ? "rgba(78, 120, 94, 0.12)" : "rgba(224, 102, 102, 0.12)",
                                    color: fitsGuest ? "#3B6B52" : "#C24138"
                                  }}>
                                    {fitsGuest ? "✓ Fits" : `⚠️ Needs ${assigningReservation.partySize}`}
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                                <span style={{
                                  display: "inline-block",
                                  padding: "3px 8px",
                                  fontSize: 11.5,
                                  fontWeight: 600,
                                  borderRadius: 6,
                                  textTransform: "capitalize",
                                  backgroundColor: isOccupied ? "rgba(204, 120, 92, 0.12)" : "rgba(78, 120, 94, 0.1)",
                                  color: isOccupied ? "#CC785C" : "#3B6B52",
                                  border: isOccupied ? "1px solid rgba(204, 120, 92, 0.25)" : "1px solid rgba(78, 120, 94, 0.25)"
                                }}>
                                  {tb.status}
                                </span>
                              </td>
                              <td style={{ padding: "12px 14px", whiteSpace: "nowrap" }}>
                                {isOccupied ? (
                                  <div>
                                    <span style={{ fontWeight: 600, color: "#CC785C" }}>
                                      {reservations.find((r) => r.id === tb.reservationId)?.customerName || "Occupied"}
                                    </span>
                                    {isCurrentGuestTable && (
                                      <span style={{ marginLeft: 6, fontSize: 11, color: "#8C8980" }}>
                                        (Current)
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  assigningReservation ? (
                                    <span style={{ fontSize: 12.5, color: "#8C8980", fontStyle: "italic" }}>
                                      Ready for assignment
                                    </span>
                                  ) : (
                                    <select 
                                      defaultValue=""
                                      onChange={(e) => handleAssignTable(tb.id, tb.tableNumber, e.target.value)}
                                      style={{
                                        padding: "6px 10px",
                                        fontSize: 13,
                                        borderRadius: 6,
                                        border: "1px solid #DCD9D0",
                                        backgroundColor: "#FBF9F5",
                                        color: "#1F1E1D",
                                        outline: "none",
                                        cursor: "pointer",
                                        maxWidth: 220,
                                        fontFamily: "inherit"
                                      }}
                                    >
                                      <option value="" disabled>Select a waiting customer...</option>
                                      {reservations
                                        .filter((cts) => cts.partySize <= tb.capacity && cts.status === "waiting")
                                        .map((cts) => (
                                          <option key={cts.id} value={cts.id}>
                                            {cts.customerName} ({cts.partySize} guests)
                                          </option>
                                        ))}
                                    </select>
                                  )
                                )}
                              </td>
                              <td style={{ padding: "12px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                                {assigningReservation && !isOccupied && (
                                  <button
                                    disabled={!fitsGuest}
                                    onClick={async () => {
                                      if (!fitsGuest) return;
                                      await handleAssignTable(tb.id, tb.tableNumber, assigningReservation.id);
                                      setIsTableModalOpen(false);
                                      setAssigningReservation(null);
                                    }}
                                    style={{
                                      padding: "5px 12px",
                                      fontSize: 12,
                                      fontWeight: 600,
                                      backgroundColor: fitsGuest ? "#CC785C" : "#E5E3DC",
                                      color: fitsGuest ? "#FFFFFF" : "#8C8980",
                                      border: fitsGuest ? "none" : "1px solid #DCD9D0",
                                      borderRadius: 6,
                                      cursor: fitsGuest ? "pointer" : "not-allowed",
                                      marginRight: 6,
                                      boxShadow: fitsGuest ? "0 1px 2px rgba(204, 120, 92, 0.2)" : "none",
                                      transition: "all 0.15s ease",
                                      fontFamily: "inherit",
                                      opacity: fitsGuest ? 1 : 0.6
                                    }}
                                    onMouseOver={(e) => {
                                      if (fitsGuest) e.currentTarget.style.backgroundColor = "#B85D3F";
                                    }}
                                    onMouseOut={(e) => {
                                      if (fitsGuest) e.currentTarget.style.backgroundColor = "#CC785C";
                                    }}
                                    title={
                                      !fitsGuest 
                                        ? `Party size (${assigningReservation.partySize}) exceeds table capacity (${tb.capacity})` 
                                        : `Assign ${assigningReservation.customerName} to Table #${tb.tableNumber}`
                                    }
                                  >
                                    Assign Table #{tb.tableNumber}
                                  </button>
                                )}
                                {isOccupied && (
                                  <button 
                                    onClick={() => handleCompleteTable(tb.id, tb.reservationId)}
                                    style={{
                                      padding: "4px 10px",
                                      fontSize: 12,
                                      fontWeight: 600,
                                      backgroundColor: "#4E785E",
                                      color: "#FFFFFF",
                                      border: "none",
                                      borderRadius: 6,
                                      cursor: "pointer",
                                      marginRight: 6,
                                      transition: "background 0.15s ease",
                                      fontFamily: "inherit"
                                    }}
                                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#3F634D")}
                                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#4E785E")}
                                  >
                                    Free Table
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleDeleteTable(tb.id, tb.tableNumber)}
                                  style={{
                                    padding: "4px 10px",
                                    fontSize: 12,
                                    fontWeight: 500,
                                    backgroundColor: "transparent",
                                    border: "1px solid rgba(194, 65, 56, 0.3)",
                                    color: "#C24138",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    transition: "all 0.15s ease",
                                    fontFamily: "inherit"
                                  }}
                                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "rgba(194, 65, 56, 0.08)")}
                                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add Table Subform */}
              <div style={{
                padding: "16px 20px",
                backgroundColor: "#FBF9F5",
                border: "1px solid #EAE8E1",
                borderRadius: 12
              }}>
                <h5 style={{
                  margin: "0 0 10px 0",
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: "#1F1E1D"
                }}>
                  Add New Dining Table
                </h5>
                <form onSubmit={handleAddTable} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#73716B", marginBottom: 4 }}>
                      Table # (Next)
                    </label>
                    <input 
                      type="number" 
                      min="1" 
                      value={newTableNumber} 
                      disabled 
                      style={{
                        padding: "8px 12px",
                        fontSize: 13,
                        backgroundColor: "#F0EEE6",
                        border: "1px solid #DCD9D0",
                        borderRadius: 8,
                        width: 90,
                        color: "#73716B"
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#73716B", marginBottom: 4 }}>
                      Seat Capacity
                    </label>
                    <input 
                      type="number" 
                      min="1" 
                      value={capacity} 
                      onChange={(e) => setCapacity(e.target.value)} 
                      style={{
                        padding: "8px 12px",
                        fontSize: 13,
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #DCD9D0",
                        borderRadius: 8,
                        width: 110,
                        color: "#1F1E1D",
                        outline: "none"
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "#CC785C")}
                      onBlur={(e) => (e.target.style.borderColor = "#DCD9D0")}
                    />
                  </div>

                  <button 
                    type="submit"
                    style={{
                      padding: "8px 18px",
                      backgroundColor: "#CC785C",
                      color: "#FFFFFF",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "background 0.15s ease",
                      fontFamily: "inherit"
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#B85D3F")}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#CC785C")}
                  >
                    + Create Table
                  </button>
                </form>
              </div>

              {/* Modal Footer */}
              <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 8, borderTop: "1px solid #F0EEE6" }}>
                <button
                  onClick={() => {
                    setIsTableModalOpen(false);
                    setAssigningReservation(null);
                  }}
                  style={{
                    padding: "8px 18px",
                    backgroundColor: "#F7F5EE",
                    border: "1px solid #DCD9D0",
                    color: "#52504B",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "inherit"
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#EAE8E1")}
                  onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#F7F5EE")}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
