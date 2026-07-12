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
export const ADMIN_EMAIL = 'adam.margoev@gmail.com';

export const isFirebaseConfigured = !forceDemo && Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

let auth;
let db;

if (isFirebaseConfigured) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
}

const GITHUB_REPOSITORY = 'Unnamed00000/ScanMe';
const GITHUB_BRANCH = 'main';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPOSITORY}`;
const THEME_MANIFEST_URL = `https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${GITHUB_BRANCH}/themes/custom-themes.json`;

const LOCAL_KEY = 'scanme_profiles_v1';
const CATALOG_SETTINGS_ID = '__catalog_settings__';

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
  return onAuthStateChanged(auth, async (user) => {
    if (user && String(user.email || '').toLowerCase() !== ADMIN_EMAIL) {
      await firebaseSignOut(auth);
      callback(null);
      return;
    }
    callback(user);
  });
}

export async function login(email, password) {
  if (!isFirebaseConfigured) return { user: { uid: 'local-demo' } };
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (normalizedEmail !== ADMIN_EMAIL) {
    const error = new Error('Неверная почта или пароль.');
    error.code = 'auth/invalid-credential';
    throw error;
  }
  const credential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
  if (String(credential.user.email || '').toLowerCase() !== ADMIN_EMAIL) {
    await firebaseSignOut(auth);
    const error = new Error('Неверная почта или пароль.');
    error.code = 'auth/invalid-credential';
    throw error;
  }
  return credential;
}

export async function logout() {
  if (!isFirebaseConfigured) return;
  await firebaseSignOut(auth);
}

export async function listProfiles() {
  if (!isFirebaseConfigured) {
    return Object.entries(readLocal()).filter(([key]) => !key.startsWith('__')).map(([, value]) => value).sort((a, b) =>
      String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')),
    );
  }
  const result = await getDocs(query(collection(db, 'profiles'), orderBy('updatedAt', 'desc')));
  return result.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => !String(item.id).startsWith('__'));
}

export async function getCatalogSettings() {
  if (!isFirebaseConfigured) return readLocal().__catalogSettings || null;
  return normalizeSnapshot(await getDoc(doc(db, 'profiles', CATALOG_SETTINGS_ID)));
}

export async function saveCatalogSettings(settings) {
  const payload = { ...settings, id: CATALOG_SETTINGS_ID, slug: CATALOG_SETTINGS_ID, published: true, contentType: 'settings', updatedAt: new Date().toISOString() };
  if (!isFirebaseConfigured) {
    const data = readLocal();
    data.__catalogSettings = payload;
    writeLocal(data);
    return payload;
  }
  await setDoc(doc(db, 'profiles', CATALOG_SETTINGS_ID), { ...payload, updatedAt: serverTimestamp() }, { merge: true });
  return payload;
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
  const response = await fetch(`${THEME_MANIFEST_URL}?v=${Date.now()}`, { cache: 'no-store' });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error('Не удалось загрузить каталог оформлений с GitHub.');
  const themes = await response.json();
  if (!Array.isArray(themes)) return [];
  const names = new Set();
  return themes.filter((theme) => {
    const key = String(theme?.name || theme?.id || '').trim().toLocaleLowerCase();
    if (!key || names.has(key)) return false;
    names.add(key);
    return true;
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result).split(',')[1]));
    reader.addEventListener('error', () => reject(new Error('Не удалось прочитать изображение.')));
    reader.readAsDataURL(blob);
  });
}

function textToBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(binary);
}

function base64ToText(value) {
  const binary = atob(value.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function themeNameKey(value) {
  return String(value || '').trim().toLocaleLowerCase();
}

function themeFilePath(theme) {
  const fileName = String(theme?.fileName || '');
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(fileName) ? `themes/${fileName}` : '';
}

async function githubRequest(path, token, options = {}, allowNotFound = false) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (allowNotFound && response.status === 404) return null;
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) throw new Error('GitHub-токен недействителен. Создайте новый токен.');
    if (response.status === 403) throw new Error('Токену нужен доступ Contents: Read and write к репозиторию ScanMe.');
    throw new Error(payload?.message || `Ошибка GitHub (${response.status}).`);
  }
  return payload;
}

export async function uploadTheme({ id, name, blob, token, accentColor = '' }) {
  const now = new Date().toISOString();
  if (!isFirebaseConfigured) {
    const data = readLocal();
    const imageUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result));
      reader.readAsDataURL(blob);
    });
    data.__themes = data.__themes || {};
    data.__themes[id] = { id, name, imageUrl, accentColor, createdAt: now };
    writeLocal(data);
    return data.__themes[id];
  }

  const githubToken = String(token || '').trim();
  if (!githubToken) throw new Error('Вставьте GitHub-токен для сохранения оформления.');

  const reference = await githubRequest(`/git/ref/heads/${GITHUB_BRANCH}`, githubToken);
  const parentSha = reference.object.sha;
  const parentCommit = await githubRequest(`/git/commits/${parentSha}`, githubToken);
  const manifestFile = await githubRequest(`/contents/themes/custom-themes.json?ref=${GITHUB_BRANCH}`, githubToken, {}, true);
  const existingThemes = manifestFile?.content ? JSON.parse(base64ToText(manifestFile.content)) : [];
  const fileName = `${id}.webp`;
  const imageUrl = `https://raw.githubusercontent.com/${GITHUB_REPOSITORY}/${GITHUB_BRANCH}/themes/${fileName}`;
  const theme = { id, name, imageUrl, fileName, accentColor, createdAt: now };
  const normalizedName = name.trim().toLocaleLowerCase();
  const manifest = [theme, ...(Array.isArray(existingThemes) ? existingThemes.filter((item) => (
    item.id !== id && String(item.name || '').trim().toLocaleLowerCase() !== normalizedName
  )) : [])];

  const imageBlob = await githubRequest('/git/blobs', githubToken, {
    method: 'POST',
    body: JSON.stringify({ content: await blobToBase64(blob), encoding: 'base64' }),
  });
  const manifestBlob = await githubRequest('/git/blobs', githubToken, {
    method: 'POST',
    body: JSON.stringify({ content: textToBase64(`${JSON.stringify(manifest, null, 2)}\n`), encoding: 'base64' }),
  });
  const tree = await githubRequest('/git/trees', githubToken, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: parentCommit.tree.sha,
      tree: [
        { path: `themes/${fileName}`, mode: '100644', type: 'blob', sha: imageBlob.sha },
        { path: 'themes/custom-themes.json', mode: '100644', type: 'blob', sha: manifestBlob.sha },
      ],
    }),
  });
  const commit = await githubRequest('/git/commits', githubToken, {
    method: 'POST',
    body: JSON.stringify({
      message: `Add theme: ${name}`,
      tree: tree.sha,
      parents: [parentSha],
    }),
  });
  await githubRequest(`/git/refs/heads/${GITHUB_BRANCH}`, githubToken, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  return theme;
}

export async function renameTheme({ theme, name, token }) {
  const nextName = String(name || '').trim();
  if (!nextName) throw new Error('Введите название оформления.');
  if (!isFirebaseConfigured) {
    const data = readLocal();
    const themes = data.__themes || {};
    const current = themes[theme.id];
    if (!current) throw new Error('Оформление не найдено. Обновите страницу.');
    Object.entries(themes).forEach(([id, item]) => {
      if (id !== theme.id && themeNameKey(item.name) === themeNameKey(theme.name)) delete themes[id];
    });
    themes[theme.id] = { ...current, name: nextName };
    data.__themes = themes;
    writeLocal(data);
    return themes[theme.id];
  }

  const githubToken = String(token || '').trim();
  if (!githubToken) throw new Error('Вставьте GitHub-токен.');
  const reference = await githubRequest(`/git/ref/heads/${GITHUB_BRANCH}`, githubToken);
  const parentSha = reference.object.sha;
  const parentCommit = await githubRequest(`/git/commits/${parentSha}`, githubToken);
  const manifestFile = await githubRequest(`/contents/themes/custom-themes.json?ref=${GITHUB_BRANCH}`, githubToken, {}, true);
  const themes = manifestFile?.content ? JSON.parse(base64ToText(manifestFile.content)) : [];
  const matches = Array.isArray(themes) ? themes.filter((item) => item.id === theme.id || themeNameKey(item.name) === themeNameKey(theme.name)) : [];
  const current = matches.find((item) => item.id === theme.id) || matches[0];
  if (!current) throw new Error('Оформление не найдено в GitHub. Обновите страницу.');
  const renamed = { ...current, name: nextName };
  const removed = matches.filter((item) => item.id !== current.id);
  const manifest = [renamed, ...themes.filter((item) => !matches.some((match) => match.id === item.id))];
  const manifestBlob = await githubRequest('/git/blobs', githubToken, {
    method: 'POST', body: JSON.stringify({ content: textToBase64(`${JSON.stringify(manifest, null, 2)}\n`), encoding: 'base64' }),
  });
  const treeEntries = [{ path: 'themes/custom-themes.json', mode: '100644', type: 'blob', sha: manifestBlob.sha }];
  removed.map(themeFilePath).filter(Boolean).forEach((path) => treeEntries.push({ path, mode: '100644', type: 'blob', sha: null }));
  const tree = await githubRequest('/git/trees', githubToken, {
    method: 'POST', body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree: treeEntries }),
  });
  const commit = await githubRequest('/git/commits', githubToken, {
    method: 'POST', body: JSON.stringify({ message: `Rename theme: ${theme.name} → ${nextName}`, tree: tree.sha, parents: [parentSha] }),
  });
  await githubRequest(`/git/refs/heads/${GITHUB_BRANCH}`, githubToken, {
    method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }),
  });
  return renamed;
}

export async function deleteTheme({ theme, token }) {
  if (!isFirebaseConfigured) {
    const data = readLocal();
    const themes = data.__themes || {};
    Object.entries(themes).forEach(([id, item]) => {
      if (id === theme.id || themeNameKey(item.name) === themeNameKey(theme.name)) delete themes[id];
    });
    data.__themes = themes;
    writeLocal(data);
    return;
  }

  const githubToken = String(token || '').trim();
  if (!githubToken) throw new Error('Вставьте GitHub-токен.');
  const reference = await githubRequest(`/git/ref/heads/${GITHUB_BRANCH}`, githubToken);
  const parentSha = reference.object.sha;
  const parentCommit = await githubRequest(`/git/commits/${parentSha}`, githubToken);
  const manifestFile = await githubRequest(`/contents/themes/custom-themes.json?ref=${GITHUB_BRANCH}`, githubToken, {}, true);
  const themes = manifestFile?.content ? JSON.parse(base64ToText(manifestFile.content)) : [];
  const removed = Array.isArray(themes) ? themes.filter((item) => item.id === theme.id || themeNameKey(item.name) === themeNameKey(theme.name)) : [];
  if (!removed.length) throw new Error('Оформление уже удалено. Обновите страницу.');
  const manifest = themes.filter((item) => !removed.some((match) => match.id === item.id));
  const manifestBlob = await githubRequest('/git/blobs', githubToken, {
    method: 'POST', body: JSON.stringify({ content: textToBase64(`${JSON.stringify(manifest, null, 2)}\n`), encoding: 'base64' }),
  });
  const treeEntries = [{ path: 'themes/custom-themes.json', mode: '100644', type: 'blob', sha: manifestBlob.sha }];
  [...new Set(removed.map(themeFilePath).filter(Boolean))].forEach((path) => treeEntries.push({ path, mode: '100644', type: 'blob', sha: null }));
  const tree = await githubRequest('/git/trees', githubToken, {
    method: 'POST', body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree: treeEntries }),
  });
  const commit = await githubRequest('/git/commits', githubToken, {
    method: 'POST', body: JSON.stringify({ message: `Delete theme: ${theme.name}`, tree: tree.sha, parents: [parentSha] }),
  });
  await githubRequest(`/git/refs/heads/${GITHUB_BRANCH}`, githubToken, {
    method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }),
  });
}
