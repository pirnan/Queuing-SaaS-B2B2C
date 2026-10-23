import { db } from "../firebase";
import { 
  doc, 
  setDoc, 
  getDoc,
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs 
} from "firebase/firestore";

/**
 * Normalizes a text string into a URL-friendly slug
 * e.g. "Sunset Cafe & Bistro!" -> "sunset-cafe-bistro"
 */
export function slugify(text = "") {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove non-word characters
    .replace(/[\s_-]+/g, "-")  // Replace spaces and underscores with a single dash
    .replace(/^-+|-+$/g, ""); // Strip leading/trailing dashes
}

/**
 * Checks if an establishment slug already exists in Firestore
 */
export async function checkSlugAvailable(slug) {
  if (!slug) return false;
  const cleanSlug = slugify(slug);
  if (!cleanSlug) return false;

  const docRef = doc(db, "establishments", cleanSlug);
  const docSnap = await getDoc(docRef);
  return !docSnap.exists();
}

/**
 * Creates a brand new establishment with all default subcollections (settings, starter tables)
 */
export async function createEstablishment({
  name,
  slug,
  ownerUid,
  ownerEmail,
  category = "Restaurant / Cafe",
  maxPartySize = 10
}) {
  const cleanSlug = slugify(slug || name);
  if (!cleanSlug) {
    throw new Error("A valid establishment slug is required.");
  }

  // 1. Verify slug availability
  const isAvailable = await checkSlugAvailable(cleanSlug);
  if (!isAvailable) {
    throw new Error(`The queue link /q/${cleanSlug} is already registered. Please choose a different link.`);
  }

  const safeCapacity = Math.max(1, Math.min(100, Number(maxPartySize) || 10));

  // 2. Create parent establishment document
  const estDocRef = doc(db, "establishments", cleanSlug);
  await setDoc(estDocRef, {
    name: name.trim(),
    slug: cleanSlug,
    category,
    ownerUid: ownerUid || null,
    ownerEmail: ownerEmail ? ownerEmail.toLowerCase().trim() : null,
    adminEmails: ownerEmail ? [ownerEmail.toLowerCase().trim()] : [],
    maxCustomerCapacity: safeCapacity,
    createdAt: serverTimestamp(),
  });

  // 3. Initialize default Queue Settings (Max party capacity)
  await setDoc(doc(db, "establishments", cleanSlug, "settings", "queueConfig"), {
    maxPartySize: safeCapacity,
    updatedAt: serverTimestamp(),
  });

  // 4. Initialize default 3D House Wall Art Settings
  await setDoc(doc(db, "establishments", cleanSlug, "settings", "building"), {
    walls: {
      left: { url: "", scale: 1.0, preset: "medium" },
      back: { url: "", scale: 1.0, preset: "medium" },
      right: { url: "", scale: 1.0, preset: "medium" }
    },
    updatedAt: serverTimestamp(),
  });

  // 5. Seed initial starter dining tables
  const defaultTables = [
    { tableNumber: 1, capacity: 2 },
    { tableNumber: 2, capacity: 4 },
    { tableNumber: 3, capacity: 4 },
    { tableNumber: 4, capacity: 6 }
  ];

  for (const tb of defaultTables) {
    await addDoc(collection(db, "establishments", cleanSlug, "tables"), {
      tableNumber: tb.tableNumber,
      capacity: tb.capacity,
      status: "available",
      reservationId: null,
      createdAt: serverTimestamp(),
    });
  }

  return cleanSlug;
}

/**
 * Retrieves establishment metadata by its unique slug
 */
export async function getEstablishmentBySlug(slug) {
  if (!slug) return null;
  const cleanSlug = slugify(slug);
  const docRef = doc(db, "establishments", cleanSlug);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  }
  return null;
}

/**
 * Finds all establishments associated with a user UID or email
 */
export async function getEstablishmentsForUser(uid, email) {
  const results = [];
  const seenIds = new Set();

  if (uid) {
    const qUid = query(collection(db, "establishments"), where("ownerUid", "==", uid));
    const snapUid = await getDocs(qUid);
    snapUid.docs.forEach((d) => {
      seenIds.add(d.id);
      results.push({ id: d.id, ...d.data() });
    });
  }

  if (email) {
    const qEmail = query(collection(db, "establishments"), where("adminEmails", "array-contains", email.toLowerCase().trim()));
    const snapEmail = await getDocs(qEmail);
    snapEmail.docs.forEach((d) => {
      if (!seenIds.has(d.id)) {
        seenIds.add(d.id);
        results.push({ id: d.id, ...d.data() });
      }
    });
  }

  return results;
}

/**
 * Ensures a default establishment exists (fallback for legacy or direct / access)
 */
export async function ensureDefaultEstablishment() {
  const mainRef = doc(db, "establishments", "main");
  const mainSnap = await getDoc(mainRef);
  if (!mainSnap.exists()) {
    try {
      await setDoc(mainRef, {
        name: "Main Establishment",
        slug: "main",
        category: "Restaurant / Cafe",
        ownerUid: null,
        ownerEmail: "fernannagrampa@gmail.com",
        adminEmails: ["fernannagrampa@gmail.com", "grasyaaurora126@gmail.com"],
        maxCustomerCapacity: 10,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "establishments", "main", "settings", "queueConfig"), {
        maxPartySize: 10,
        updatedAt: serverTimestamp(),
      });
      await setDoc(doc(db, "establishments", "main", "settings", "building"), {
        walls: {
          left: { url: "", scale: 1.0, preset: "medium" },
          back: { url: "", scale: 1.0, preset: "medium" },
          right: { url: "", scale: 1.0, preset: "medium" }
        },
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn("Could not auto-seed main establishment:", e.message);
    }
  }
}
