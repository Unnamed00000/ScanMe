import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCTbzJSHGxllXnFBH8CrOlfRe0xB_1tMeQ',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'scanme-da22f.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'scanme-da22f',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'scanme-da22f.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1094672663587',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1094672663587:web:1ffd3a7e7c57aad6b25d96',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-4Q5Q7GD0SY',
};

const forceDemo = import.meta.env.VITE_SCANME_DEMO === 'true';

export const isFirebaseConfigured = !forceDemo && Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

let auth;
let db;
let storage;

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

const LOCAL_KEY = 'scanme_profiles_v1';

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeLocal(profiles) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(profiles));
}

function normalizeSnapshot(snapshot) {
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export function watchAuth(callback) {
  if (!isFirebaseConfigured) {
    callback({ uid: 'local-demo', email: 'Локальный режим' });
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function login(email, password) {
  if (!isFirebaseConfigured) return { user: { uid: 'local-demo' } };
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  if (!isFirebaseConfigured) return;
  await firebaseSignOut(auth);
}

export async function listProfiles() {
  if (!isFirebaseConfigured) {
    return Object.entries(readLocal()).filter(([key]) => key !== '__themes').map(([, value]) => value).sort((a, b) =>
      String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')),
    );
  }
  const result = await getDocs(query(collection(db, 'profiles'), orderBy('updatedAt', 'desc')));
  return result.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function getProfile(slug) {
  if (!isFirebaseConfigured) return readLocal()[slug] || null;
  return normalizeSnapshot(await getDoc(doc(db, 'profiles', slug)));
}

export async function saveProfile(profile, previousSlug = '') {
  const now = new Date().toISOString();
  const payload = {
    ...profile,
    id: profile.slug,
    createdAt: profile.createdAt || now,
    updatedAt: now,
  };

  if (!isFirebaseConfigured) {
    const profiles = readLocal();
    if (previousSlug && previousSlug !== profile.slug) delete profiles[previousSlug];
    profiles[profile.slug] = payload;
    writeLocal(profiles);
    return payload;
  }

  const document = doc(db, 'profiles', profile.slug);
  const remotePayload = {
    ...payload,
    updatedAt: serverTimestamp(),
    createdAt: profile.createdAt || serverTimestamp(),
  };
  await setDoc(document, remotePayload, { merge: true });
  if (previousSlug && previousSlug !== profile.slug) {
    await deleteDoc(doc(db, 'profiles', previousSlug));
  }
  return payload;
}

export async function removeProfile(slug) {
  if (!isFirebaseConfigured) {
    const profiles = readLocal();
    delete profiles[slug];
    writeLocal(profiles);
    return;
  }
  await deleteDoc(doc(db, 'profiles', slug));
}

export async function listThemes() {
  if (!isFirebaseConfigured) {
    return Object.values(readLocal().__themes || {});
  }
  const result = await getDocs(query(collection(db, 'themes'), orderBy('createdAt', 'desc')));
  return result.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function uploadTheme({ id, name, blob }) {
  const now = new Date().toISOString();
  if (!isFirebaseConfigured) {
    const data = readLocal();
    const imageUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result));
      reader.readAsDataURL(blob);
    });
    data.__themes = data.__themes || {};
    data.__themes[id] = { id, name, imageUrl, createdAt: now };
    writeLocal(data);
    return data.__themes[id];
  }

  const path = `themes/${id}-${Date.now()}.webp`;
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, blob, { contentType: 'image/webp', cacheControl: 'public,max-age=31536000' });
  const imageUrl = await getDownloadURL(fileRef);
  const theme = { id, name, imageUrl, storagePath: path, createdAt: now };
  await setDoc(doc(db, 'themes', id), { ...theme, createdAt: serverTimestamp() });
  return theme;
}
