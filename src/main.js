import QRCode from 'qrcode';
import './styles.css';
import {
  catalogCurrencies,
  catalogLanguages,
  catalogText,
  detectCatalogLanguage,
  fetchCatalogRates,
  formatCatalogPrice,
  saveCatalogLanguage,
} from './catalog.js';
import {
  ADMIN_EMAIL,
  deleteTheme,
  getCatalogSettings,
  getProfile,
  isFirebaseConfigured,
  listProfiles,
  listThemes,
  login,
  logout,
  removeProfile,
  renameTheme,
  saveProfile,
  saveCatalogSettings,
  uploadTheme,
  watchAuth,
} from './store.js';
import { escapeHtml, getInitials, icons, profileUrl, safeUrl, slugify, toast } from './ui.js';

const app = document.querySelector('#app');
let currentUser = null;
let deferredInstallPrompt = null;
let catalogDraft = {
  language: '', cardLanguage: 'en', currency: 'DKK', plan: 'monthly', theme: 'lime',
  fullName: 'Имя Фамилия', role: '', headingFont: 'unbounded', secondaryFont: 'manrope', bodyFont: 'manrope', contactFont: 'manrope',
};
let catalogRateState = { rates: { DKK: 1 }, updatedAt: '', loading: false, failed: false };
let catalogSettingsCache = null;
let catalogCustomThemesCache = null;

const defaultCatalogSettings = () => ({
  hiddenThemeIds: [],
  plans: [
    { id: 'monthly', enabled: true, title: '', subtitle: '', badge: '', first: 19.5, regular: 39, period: '', titleSize: 16, priceSize: 43, smallSize: 10 },
    { id: 'yearly', enabled: true, title: '', subtitle: '', badge: '', first: 195, regular: 390, period: '', titleSize: 16, priceSize: 43, smallSize: 10 },
  ],
});

function normalizeCatalogSettings(value = {}) {
  const defaults = defaultCatalogSettings();
  const plans = Array.isArray(value.plans) && value.plans.length ? value.plans : defaults.plans;
  return {
    hiddenThemeIds: Array.isArray(value.hiddenThemeIds) ? value.hiddenThemeIds.filter(Boolean) : [],
    plans: plans.slice(0, 4).map((plan, index) => ({
      id: String(plan.id || `plan-${index + 1}`), enabled: plan.enabled !== false,
      title: String(plan.title || ''), subtitle: String(plan.subtitle || ''), badge: String(plan.badge || ''), period: String(plan.period || ''),
      first: Math.max(0, Number(plan.first) || 0), regular: Math.max(0, Number(plan.regular) || 0),
      titleSize: clampPhotoValue(plan.titleSize, 12, 30, 16), priceSize: clampPhotoValue(plan.priceSize, 24, 64, 43), smallSize: clampPhotoValue(plan.smallSize, 8, 20, 10),
    })),
  };
}

const serviceWorkerReady = 'serviceWorker' in navigator
  ? navigator.serviceWorker.register('/ScanMe/sw.js', { scope: '/ScanMe/' }).then(() => navigator.serviceWorker.ready).catch(() => null)
  : Promise.resolve(null);

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  document.querySelectorAll('.install-pwa-button').forEach((button) => button.classList.add('is-installable'));
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  toast('Приложение установлено');
});

const themeOptions = [
  { id: 'lime', name: 'Lime noir' },
  { id: 'ocean', name: 'Deep ocean' },
  { id: 'sunset', name: 'Warm sunset' },
  { id: 'violet', name: 'Electric violet' },
  { id: 'emerald', name: 'Emerald glass' },
  { id: 'graphite', name: 'Business graphite' },
  { id: 'car', name: 'Ночной автомобиль' },
  { id: 'landrover', name: 'Land Rover Discovery' },
  { id: 'lion', name: 'Золотой лев' },
  { id: 'wolf', name: 'Серебряный волк' },
  { id: 'eagle', name: 'Золотой орёл' },
  { id: 'mountains', name: 'Альпийские горы' },
  { id: 'forest', name: 'Изумрудный лес' },
  { id: 'winter', name: 'Зимняя ночь' },
  { id: 'autumn', name: 'Осенний огонь' },
  { id: 'spring', name: 'Весенний сад' },
  { id: 'romantic', name: 'Романтический вечер' },
  { id: 'tayotayaris', name: 'Toyota Yaris Aslan' },
];

const qrThemePalettes = {
  lime: { dark: '#0b0d11', light: '#f5ffdc', accent: '#c9ff38' },
  ocean: { dark: '#052235', light: '#e8faff', accent: '#4ae1ff' },
  sunset: { dark: '#351018', light: '#fff0e9', accent: '#ff7c59' },
  violet: { dark: '#23103e', light: '#f5edff', accent: '#b278ff' },
  emerald: { dark: '#082b20', light: '#e9fff6', accent: '#55efb5' },
  graphite: { dark: '#111318', light: '#f0f2f5', accent: '#d9dde4' },
  car: { dark: '#071923', light: '#ebf9ff', accent: '#64d9ff' },
  landrover: { dark: '#071724', light: '#edf7ff', accent: '#91ccff' },
  tayotayaris: { dark: '#061722', light: '#ebf8ff', accent: '#7fd7ff' },
  lion: { dark: '#291708', light: '#fff6e5', accent: '#ffb43c' },
  wolf: { dark: '#101d29', light: '#eff8ff', accent: '#a9d8ff' },
  eagle: { dark: '#2a1c0d', light: '#fff7e9', accent: '#ffc66b' },
  mountains: { dark: '#271a12', light: '#fff5eb', accent: '#ffb875' },
  forest: { dark: '#102917', light: '#efffea', accent: '#8fe36e' },
  winter: { dark: '#10243a', light: '#eff9ff', accent: '#b8e3ff' },
  autumn: { dark: '#32150a', light: '#fff1e9', accent: '#ff8a48' },
  spring: { dark: '#16301a', light: '#f2ffe9', accent: '#b9f28f' },
  romantic: { dark: '#35101a', light: '#fff0f3', accent: '#ff728b' },
};

const catalogThemeImages = {
  car: '/ScanMe/themes/midnight-car.png', landrover: '/ScanMe/themes/land-rover-discovery.png', tayotayaris: '/ScanMe/themes/TayotaYaris-Aslan.png',
  lion: '/ScanMe/themes/golden-lion.png', wolf: '/ScanMe/themes/silver-wolf.png', eagle: '/ScanMe/themes/golden-eagle.png',
  mountains: '/ScanMe/themes/alpine-mountains.png', forest: '/ScanMe/themes/emerald-forest.png', winter: '/ScanMe/themes/winter-night.png',
  autumn: '/ScanMe/themes/autumn-fire.png', spring: '/ScanMe/themes/spring-bloom.png', romantic: '/ScanMe/themes/romantic-roses.png',
};

const englishCatalogThemeNames = {
  car: 'Midnight car', landrover: 'Land Rover Discovery', tayotayaris: 'Toyota Yaris Aslan', lion: 'Golden lion', wolf: 'Silver wolf', eagle: 'Golden eagle',
  mountains: 'Alpine mountains', forest: 'Emerald forest', winter: 'Winter night', autumn: 'Autumn fire', spring: 'Spring garden', romantic: 'Romantic evening',
};

function qrPalette(theme) {
  return qrThemePalettes[theme] || qrThemePalettes.lime;
}

function roundedCanvasRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function drawQrBrand(canvas, palette) {
  const context = canvas.getContext('2d');
  const size = canvas.width;
  const outerSize = size * 0.19;
  const outerX = (size - outerSize) / 2;
  roundedCanvasRect(context, outerX, outerX, outerSize, outerSize, outerSize * 0.22);
  context.fillStyle = palette.light;
  context.fill();
  const markSize = size * 0.145;
  const markX = (size - markSize) / 2;
  roundedCanvasRect(context, markX, markX, markSize, markSize, markSize * 0.28);
  context.fillStyle = palette.accent;
  context.fill();
  const scale = markSize * 0.56 / 24;
  const offset = markX + markSize * 0.22;
  context.strokeStyle = palette.dark;
  context.lineWidth = scale * 1.9;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  [[3, 3], [14, 3], [3, 14]].forEach(([x, y]) => context.strokeRect(offset + x * scale, offset + y * scale, 7 * scale, 7 * scale));
  context.strokeRect(offset + 14 * scale, offset + 14 * scale, 3 * scale, 3 * scale);
  context.strokeRect(offset + 18 * scale, offset + 18 * scale, 3 * scale, 3 * scale);
  context.beginPath();
  context.moveTo(offset + 18 * scale, offset + 14 * scale);
  context.lineTo(offset + 21 * scale, offset + 14 * scale);
  context.lineTo(offset + 21 * scale, offset + 16 * scale);
  context.moveTo(offset + 14 * scale, offset + 19 * scale);
  context.lineTo(offset + 14 * scale, offset + 21 * scale);
  context.lineTo(offset + 16 * scale, offset + 21 * scale);
  context.stroke();
}

const QR_CARD_WIDTH_MM = 83.6;
const QR_CARD_HEIGHT_MM = 52;
const QR_CARD_WIDTH_PX = 987;
const QR_CARD_HEIGHT_PX = 614;

function wrapQrCardName(context, value, maxWidth) {
  const words = String(value || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth && lines.length < maxLines - 1) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  return lines;
}

function drawQrBankCard(canvas, qrCanvas, { name, label, palette, backgroundImage, fonts = {}, sizes = {} }) {
  canvas.width = QR_CARD_WIDTH_PX;
  canvas.height = QR_CARD_HEIGHT_PX;
  const context = canvas.getContext('2d');
  context.fillStyle = palette.dark;
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (backgroundImage) {
    drawCoverImage(context, backgroundImage, canvas.width, canvas.height);
    const shade = context.createLinearGradient(450, 0, canvas.width, 0);
    shade.addColorStop(0, 'rgba(3,6,10,.18)');
    shade.addColorStop(.35, 'rgba(3,6,10,.38)');
    shade.addColorStop(1, 'rgba(3,6,10,.66)');
    context.fillStyle = shade;
    context.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    const glow = context.createRadialGradient(canvas.width, 0, 0, canvas.width, 0, 620);
    glow.addColorStop(0, palette.accent);
    glow.addColorStop(1, 'transparent');
    context.globalAlpha = 0.24;
    context.fillStyle = glow;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.globalAlpha = 1;
  }

  roundedCanvasRect(context, 42, 42, 530, 530, 34);
  context.fillStyle = palette.light;
  context.fill();
  context.drawImage(qrCanvas, 66, 66, 482, 482);

  const headingScale = clampPhotoValue(sizes.heading, 70, 150, 100) / 100;
  const secondaryScale = clampPhotoValue(sizes.secondary, 70, 150, 100) / 100;
  const contactScale = clampPhotoValue(sizes.contact, 70, 150, 100) / 100;

  context.textAlign = 'left';
  context.fillStyle = palette.accent;
  context.font = `700 ${Math.round(22 * secondaryScale)}px ${canvasFontFamily(fonts.secondary)}`;
  context.shadowColor = 'rgba(0,0,0,.75)';
  context.shadowBlur = 12;
  context.fillText(String(label || 'Digital business card').toUpperCase(), 620, 132);

  context.fillStyle = '#fff';
  let nameSize = Math.round(54 * headingScale);
  let lines = [];
  do {
    context.font = `700 ${nameSize}px ${canvasFontFamily(fonts.heading)}`;
    lines = wrapQrCardName(context, name || 'SCANME', 320);
    if (lines.length <= 3) break;
    nameSize -= 2;
  } while (nameSize > 30);
  lines = lines.slice(0, 3);
  const lineHeight = nameSize * 1.12;
  lines.forEach((line, index) => context.fillText(line, 620, 224 + index * lineHeight));

  const rightCenter = 790;
  context.textAlign = 'center';
  context.fillStyle = 'rgba(255,255,255,.58)';
  context.font = `700 ${Math.round(18 * contactScale)}px ${canvasFontFamily(fonts.contact)}`;
  context.fillText('SCAN TO OPEN', rightCenter, 478);
  context.fillStyle = palette.accent;
  context.font = `700 ${Math.round(27 * secondaryScale)}px ${canvasFontFamily(fonts.secondary)}`;
  context.fillText('SCANME', rightCenter, 548);
  context.shadowBlur = 0;
}

function printQrBankCard(canvas, title) {
  const printWindow = window.open('', '_blank', 'width=900,height=650');
  if (!printWindow) {
    toast('Браузер заблокировал окно печати. Разрешите всплывающие окна и попробуйте снова.', 'error');
    return;
  }
  const imageUrl = canvas.toDataURL('image/png');
  printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>@page{size:${QR_CARD_WIDTH_MM}mm ${QR_CARD_HEIGHT_MM}mm;margin:0}html,body{width:${QR_CARD_WIDTH_MM}mm;height:${QR_CARD_HEIGHT_MM}mm;margin:0;padding:0;overflow:hidden}img{display:block;width:${QR_CARD_WIDTH_MM}mm;height:${QR_CARD_HEIGHT_MM}mm}</style></head><body><img src="${imageUrl}" alt="${escapeHtml(title)}"><script>document.querySelector('img').addEventListener('load',()=>{window.print()})<\/script></body></html>`);
  printWindow.document.close();
}

function loadCanvasImage(url, timeoutMs = 6000) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      callback(value);
    };
    const timer = window.setTimeout(() => {
      image.src = '';
      finish(reject, new Error('Изображение загружается слишком долго.'));
    }, timeoutMs);
    image.crossOrigin = 'anonymous';
    image.addEventListener('load', () => finish(resolve, image));
    image.addEventListener('error', () => finish(reject, new Error('Не удалось загрузить фон для карточки.')));
    image.src = url;
  });
}

function canvasImageCandidates(url) {
  const value = String(url || '').trim();
  if (!value) return [];
  const githubMatch = value.match(/^https:\/\/raw\.githubusercontent\.com\/Unnamed00000\/ScanMe\/main\/themes\/([^?#]+)$/i);
  const localUrl = githubMatch ? `${window.location.origin}/ScanMe/themes/${encodeURIComponent(decodeURIComponent(githubMatch[1]))}` : '';
  return [...new Set([localUrl, value].filter(Boolean))];
}

async function loadCanvasImageSafely(url) {
  let lastError;
  for (const candidate of canvasImageCandidates(url)) {
    try {
      return await loadCanvasImage(candidate, 4500);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('Не удалось загрузить фон для карточки.');
}

function drawCoverImage(context, image, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const imageWidth = image.width * scale;
  const imageHeight = image.height * scale;
  context.drawImage(image, (width - imageWidth) / 2, (height - imageHeight) / 2, imageWidth, imageHeight);
}

function canvasFontFamily(id) {
  return fontStacks[id] || fontStacks.manrope;
}

function fitCanvasText(context, text, weight, preferredSize, minimumSize, maxWidth, family) {
  let size = preferredSize;
  do {
    context.font = `${weight} ${size}px ${family}`;
    if (context.measureText(text).width <= maxWidth) break;
    size -= 2;
  } while (size > minimumSize);
  return size;
}

function drawOrderBrand(context, palette) {
  roundedCanvasRect(context, 70, 66, 72, 72, 21);
  context.fillStyle = palette.accent;
  context.fill();
  context.strokeStyle = palette.dark;
  context.lineWidth = 6;
  [[88, 84], [112, 84], [88, 108]].forEach(([x, y]) => context.strokeRect(x, y, 14, 14));
  context.fillStyle = '#fff';
  context.font = "700 30px 'Unbounded', sans-serif";
  context.textAlign = 'left';
  context.fillText('SCANME', 164, 113);
}

async function createOrderCardImage({ theme, themeImageUrl = '', fullName, role, fonts, copy, description }) {
  await document.fonts?.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext('2d');
  const palette = qrPalette(theme);
  context.fillStyle = palette.dark;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const themeImage = themeImageUrl || catalogThemeImages[theme];
  if (themeImage) {
    drawCoverImage(context, await loadCanvasImageSafely(themeImage), canvas.width, canvas.height);
    const shade = context.createLinearGradient(0, 0, 0, canvas.height);
    shade.addColorStop(0, 'rgba(3,6,9,.48)'); shade.addColorStop(.48, 'rgba(3,6,9,.34)'); shade.addColorStop(1, 'rgba(3,6,9,.88)');
    context.fillStyle = shade;
    context.fillRect(0, 0, canvas.width, canvas.height);
  } else {
    const glow = context.createRadialGradient(880, 90, 0, 880, 90, 620);
    glow.addColorStop(0, palette.accent); glow.addColorStop(1, 'transparent');
    context.globalAlpha = .28; context.fillStyle = glow; context.fillRect(0, 0, canvas.width, canvas.height); context.globalAlpha = 1;
  }
  drawOrderBrand(context, palette);
  context.fillStyle = 'rgba(255,255,255,.62)';
  context.font = "700 22px 'Manrope', sans-serif";
  context.textAlign = 'right';
  context.fillText(String(copy.digitalCard).toUpperCase(), 1010, 108);

  roundedCanvasRect(context, 405, 235, 270, 270, 76);
  context.fillStyle = palette.accent;
  context.fill();
  context.fillStyle = palette.dark;
  context.textAlign = 'center';
  context.font = `700 78px ${canvasFontFamily(fonts.heading)}`;
  context.fillText(getInitials(fullName) || 'Я', 540, 402);

  context.fillStyle = palette.accent;
  context.font = `700 22px ${canvasFontFamily(fonts.secondary)}`;
  context.fillText(String(copy.digitalCard).toUpperCase(), 540, 585);
  context.fillStyle = '#fff';
  fitCanvasText(context, fullName, 700, 88, 48, 900, canvasFontFamily(fonts.heading));
  context.fillText(fullName, 540, 690);
  context.fillStyle = 'rgba(255,255,255,.78)';
  fitCanvasText(context, role, 500, 36, 24, 850, canvasFontFamily(fonts.secondary));
  context.fillText(role, 540, 756);
  context.fillStyle = 'rgba(255,255,255,.56)';
  context.font = `500 27px ${canvasFontFamily(fonts.body)}`;
  context.fillText(description, 540, 832);

  const contactLabels = [copy.call, copy.email, copy.website].map((label) => String(label).toUpperCase());
  contactLabels.forEach((label, index) => {
    const x = 238 + index * 302;
    roundedCanvasRect(context, x - 68, 902, 136, 136, 36);
    context.fillStyle = 'rgba(255,255,255,.08)'; context.fill();
    context.strokeStyle = 'rgba(255,255,255,.18)'; context.lineWidth = 2; context.stroke();
    context.fillStyle = palette.accent; context.font = `700 34px ${canvasFontFamily(fonts.contact)}`; context.fillText(index === 0 ? '☎' : index === 1 ? '@' : '⌁', x, 982);
    context.fillStyle = 'rgba(255,255,255,.68)'; context.font = `700 17px ${canvasFontFamily(fonts.contact)}`; context.fillText(label, x, 1068);
  });
  roundedCanvasRect(context, 250, 1132, 580, 82, 25);
  context.fillStyle = palette.accent; context.fill();
  context.fillStyle = palette.dark; context.font = `800 23px ${canvasFontFamily(fonts.contact)}`; context.fillText(String(copy.saveContact).toUpperCase(), 540, 1183);
  context.fillStyle = 'rgba(255,255,255,.38)'; context.font = "600 16px 'Manrope', sans-serif"; context.fillText('SCANME · ПРЕДПРОСМОТР ЗАКАЗА', 540, 1292);

  const blob = await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Не удалось создать изображение карточки.')), 'image/png', 1));
  return new File([blob], `scanme-${slugify(fullName) || 'order'}.png`, { type: 'image/png' });
}

const languageOptions = [
  { id: 'ru', name: 'Русский' },
  { id: 'en', name: 'English' },
  { id: 'da', name: 'Dansk' },
  { id: 'de', name: 'Deutsch' },
  { id: 'ka', name: 'ქართული' },
];

const socialNetworkOptions = [
  { id: 'instagram', name: 'Instagram', icon: 'IG', base: 'https://instagram.com/' },
  { id: 'facebook', name: 'Facebook', icon: 'f', base: 'https://facebook.com/' },
  { id: 'tiktok', name: 'TikTok', icon: 'TT', base: 'https://tiktok.com/@' },
  { id: 'x', name: 'X / Twitter', icon: 'X', base: 'https://x.com/' },
  { id: 'telegram', name: 'Telegram', icon: 'TG', base: 'https://t.me/' },
  { id: 'whatsapp', name: 'WhatsApp', icon: 'WA', base: 'https://wa.me/' },
  { id: 'youtube', name: 'YouTube', icon: 'YT', base: 'https://youtube.com/@' },
  { id: 'linkedin', name: 'LinkedIn', icon: 'in', base: 'https://linkedin.com/in/' },
  { id: 'snapchat', name: 'Snapchat', icon: 'SC', base: 'https://snapchat.com/add/' },
  { id: 'discord', name: 'Discord', icon: 'DS', base: 'https://discord.com/users/' },
  { id: 'website', name: 'Website / личный сайт', icon: 'WWW', base: '' },
  { id: 'pinterest', name: 'Pinterest', icon: 'P', base: 'https://pinterest.com/' },
  { id: 'github', name: 'GitHub', icon: 'GH', base: 'https://github.com/' },
];

function socialNetwork(id) {
  return socialNetworkOptions.find((network) => network.id === id) || socialNetworkOptions.find((network) => network.id === 'website');
}

function socialHref(id, value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return safeUrl(raw);
  if (id === 'whatsapp') return `https://wa.me/${raw.replace(/\D/g, '')}`;
  if (id === 'website') return safeUrl(raw);
  const username = raw.replace(/^@/, '').replace(/^\/+|\/+$/g, '');
  return `${socialNetwork(id).base}${username}`;
}

function initialSocialLinks(profile) {
  const links = Array.isArray(profile.socialLinks) ? profile.socialLinks.filter((item) => item?.network && item?.value).map((item) => ({ network: item.network, value: String(item.value) })) : [];
  [['website', profile.website], ['telegram', profile.telegram], ['whatsapp', profile.whatsapp]].forEach(([network, value]) => {
    if (value && !links.some((item) => item.network === network)) links.push({ network, value });
  });
  return links;
}

function socialContactItems(profile) {
  return initialSocialLinks(profile).map((item) => {
    const network = socialNetwork(item.network);
    return { id: item.network, value: item.value, href: socialHref(item.network, item.value), label: network.name, icon: `<b>${escapeHtml(network.icon)}</b>` };
  }).filter((item) => item.href);
}

const fontOptions = [
  { id: 'manrope', name: 'Manrope — современный' },
  { id: 'unbounded', name: 'Unbounded — выразительный' },
  { id: 'montserrat', name: 'Montserrat — деловой' },
  { id: 'playfair', name: 'Playfair Display — классический' },
  { id: 'oswald', name: 'Oswald — строгий' },
  { id: 'caveat', name: 'Caveat — рукописный' },
];

const fontStacks = {
  manrope: "'Manrope', sans-serif",
  unbounded: "'Unbounded', sans-serif",
  montserrat: "'Montserrat', sans-serif",
  playfair: "'Playfair Display', serif",
  oswald: "'Oswald', sans-serif",
  caveat: "'Caveat', cursive",
};

const publicTranslations = {
  ru: { digitalCard: 'Цифровая визитка', announcement: 'ОБЪЯВЛЕНИЕ', call: 'Позвонить', email: 'Email', website: 'Сайт', saveContact: 'Сохранить контакт', updated: 'Обновлено владельцем', contact: 'Контакт', until: 'До', contactAction: 'Связаться', expiredEyebrow: 'Требуется продление', expiredTitle: 'Срок действия визитки истёк', expiredText: 'Оплаченный период публикации завершён. Продлите размещение, чтобы визитка снова открывалась по ссылке и QR-коду.', expiredSaved: 'Все данные сохранены и появятся сразу после продления.', expiredAction: 'Запросить продление', expiredPlans: 'Посмотреть тарифы', expiredSubject: 'Продление визитки' },
  en: { digitalCard: 'Digital business card', announcement: 'ADVERTISEMENT', call: 'Call', email: 'Email', website: 'Website', saveContact: 'Save contact', updated: 'Updated by the owner', contact: 'Contact', until: 'Until', contactAction: 'Contact', expiredEyebrow: 'Renewal required', expiredTitle: 'This digital card has expired', expiredText: 'The paid publication period has ended. Renew the service to make the card available again through its link and QR code.', expiredSaved: 'All card data is safely stored and will return immediately after renewal.', expiredAction: 'Request renewal', expiredPlans: 'View plans', expiredSubject: 'Digital card renewal' },
  da: { digitalCard: 'Digitalt visitkort', announcement: 'ANNONCE', call: 'Ring', email: 'E-mail', website: 'Hjemmeside', saveContact: 'Gem kontakt', updated: 'Opdateret af ejeren', contact: 'Kontakt', until: 'Til', contactAction: 'Kontakt', expiredEyebrow: 'Fornyelse påkrævet', expiredTitle: 'Visitkortets periode er udløbet', expiredText: 'Den betalte publiceringsperiode er afsluttet. Forny tjenesten, så visitkortet igen kan åbnes via link og QR-kode.', expiredSaved: 'Alle oplysninger er gemt og vises igen umiddelbart efter fornyelsen.', expiredAction: 'Anmod om fornyelse', expiredPlans: 'Se abonnementer', expiredSubject: 'Fornyelse af digitalt visitkort' },
  de: { digitalCard: 'Digitale Visitenkarte', announcement: 'ANZEIGE', call: 'Anrufen', email: 'E-Mail', website: 'Webseite', saveContact: 'Kontakt speichern', updated: 'Vom Inhaber aktualisiert', contact: 'Kontakt', until: 'Bis', contactAction: 'Kontaktieren', expiredEyebrow: 'Verlängerung erforderlich', expiredTitle: 'Die Laufzeit der Visitenkarte ist abgelaufen', expiredText: 'Der bezahlte Veröffentlichungszeitraum ist beendet. Verlängern Sie den Dienst, damit die Visitenkarte wieder über Link und QR-Code erreichbar ist.', expiredSaved: 'Alle Daten bleiben gespeichert und werden direkt nach der Verlängerung wieder angezeigt.', expiredAction: 'Verlängerung anfragen', expiredPlans: 'Tarife ansehen', expiredSubject: 'Verlängerung der digitalen Visitenkarte' },
  ka: { digitalCard: 'ციფრული სავიზიტო ბარათი', announcement: 'განცხადება', call: 'დარეკვა', email: 'ელფოსტა', website: 'ვებსაიტი', saveContact: 'კონტაქტის შენახვა', updated: 'განახლებულია მფლობელის მიერ', contact: 'კონტაქტი', until: 'მოქმედებს', contactAction: 'დაკავშირება', expiredEyebrow: 'საჭიროა განახლება', expiredTitle: 'სავიზიტო ბარათის ვადა ამოიწურა', expiredText: 'ფასიანი გამოქვეყნების პერიოდი დასრულდა. განაახლეთ მომსახურება, რათა ბარათი კვლავ გაიხსნას ბმულითა და QR-კოდით.', expiredSaved: 'ყველა მონაცემი შენახულია და განახლებისთანავე კვლავ გამოჩნდება.', expiredAction: 'განახლების მოთხოვნა', expiredPlans: 'ტარიფების ნახვა', expiredSubject: 'ციფრული სავიზიტო ბარათის განახლება' },
};

function publicCopy(profile) {
  return publicTranslations[profile.language] || publicTranslations.ru;
}

const installLabels = { ru: 'Установить', en: 'Install', da: 'Installer', de: 'Installieren', ka: 'დაყენება' };

function manifestLink() {
  let link = document.querySelector('link[rel="manifest"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'manifest';
    document.head.append(link);
  }
  return link;
}

function configureAdminPwa() {
  manifestLink().href = '/ScanMe/manifest.webmanifest';
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', 'ScanMe');
}

async function configurePublicPwa(profile) {
  await serviceWorkerReady;
  if ('serviceWorker' in navigator && !navigator.serviceWorker.controller) {
    await Promise.race([
      new Promise((resolve) => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })),
      new Promise((resolve) => setTimeout(resolve, 1200)),
    ]);
  }
  const name = profile.contentType === 'announcement' ? profile.announcementTitle : profile.fullName;
  const description = profile.contentType === 'announcement'
    ? profile.announcementDescription
    : [profile.title, profile.company].filter(Boolean).join(' · ');
  const query = new URLSearchParams({ name: name || 'ScanMe', description, lang: profile.language || 'ru' });
  manifestLink().href = `/ScanMe/pwa-manifest/${encodeURIComponent(profile.slug)}.webmanifest?${query}`;
  document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', name || 'ScanMe');
}

function showInstallHelp(profile) {
  const language = profile?.language || 'ru';
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const messages = {
    ru: isIos ? 'Нажмите «Поделиться» в Safari, затем «На экран Домой».' : 'Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».',
    en: isIos ? 'Tap Share in Safari, then Add to Home Screen.' : 'Open the browser menu and choose Install app or Add to Home screen.',
    da: isIos ? 'Tryk på Del i Safari og derefter Føj til hjemmeskærm.' : 'Åbn browsermenuen, og vælg Installer app eller Føj til startskærm.',
    de: isIos ? 'Tippen Sie in Safari auf Teilen und dann Zum Home-Bildschirm.' : 'Öffnen Sie das Browsermenü und wählen Sie App installieren oder Zum Startbildschirm hinzufügen.',
    ka: isIos ? 'Safari-ში დააჭირეთ გაზიარებას, შემდეგ მთავარ ეკრანზე დამატებას.' : 'გახსენით ბრაუზერის მენიუ და აირჩიეთ აპის დაყენება ან მთავარ ეკრანზე დამატება.',
  };
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<section class="install-modal"><button class="modal-close" aria-label="Close">×</button><span class="brand-mark">${icons.download}</span><h2>${installLabels[language] || installLabels.ru}</h2><p>${messages[language] || messages.ru}</p></section>`;
  document.body.append(backdrop);
  const close = () => backdrop.remove();
  backdrop.querySelector('.modal-close').addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
}

function bindPwaInstall(profile = null) {
  document.querySelectorAll('.install-pwa-button').forEach((button) => button.addEventListener('click', async () => {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      toast('Приложение уже установлено');
      return;
    }
    if (!deferredInstallPrompt) {
      showInstallHelp(profile);
      return;
    }
    await deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
  }));
}

async function renderCatalog() {
  if (!catalogSettingsCache || !catalogCustomThemesCache) {
    const [savedSettings, customThemes] = await Promise.all([
      getCatalogSettings().catch(() => null),
      listThemes().catch(() => []),
    ]);
    catalogSettingsCache = normalizeCatalogSettings(savedSettings || {});
    catalogCustomThemesCache = customThemes;
  }
  if (!catalogDraft.language) catalogDraft.language = detectCatalogLanguage();
  const language = catalogDraft.language;
  const t = catalogText(language);
  const cardCopy = publicTranslations[catalogDraft.cardLanguage] || publicTranslations.en;
  const settings = normalizeCatalogSettings(catalogSettingsCache);
  const plans = Object.fromEntries(settings.plans.filter((plan) => plan.enabled).map((plan) => {
    const standard = plan.id === 'monthly' || plan.id === 'yearly';
    return [plan.id, { ...plan, label: plan.title || (plan.id === 'yearly' ? t.yearly : standard ? t.monthly : `Plan ${plan.id}`), period: plan.period || (plan.id === 'yearly' ? t.perYear : t.perMonth), subtitle: plan.subtitle || t.firstPayment, badge: plan.badge || t.save }];
  }));
  const allCatalogThemes = [...themeOptions, ...(catalogCustomThemesCache || [])].filter((theme) => !settings.hiddenThemeIds.includes(theme.id));
  if (!allCatalogThemes.some((theme) => theme.id === catalogDraft.theme)) catalogDraft.theme = allCatalogThemes[0]?.id || 'lime';
  if (!plans[catalogDraft.plan]) catalogDraft.plan = Object.keys(plans)[0] || '';
  const catalogThemes = allCatalogThemes.map((theme) => `
    <label class="catalog-theme theme-option theme-option--${theme.imageUrl ? 'custom' : theme.id}">
      <input type="radio" name="catalogTheme" value="${escapeHtml(theme.id)}" data-theme-url="${escapeHtml(theme.imageUrl || '')}" ${catalogDraft.theme === theme.id ? 'checked' : ''}>
      <span${theme.imageUrl ? ` style="--theme-image:url('${escapeHtml(theme.imageUrl)}')"` : ''}><i></i><b>${escapeHtml(theme.imageUrl ? theme.name : (language === 'ru' ? theme.name : (englishCatalogThemeNames[theme.id] || theme.name)))}</b></span>
    </label>`).join('');
  const catalogFontSelect = (name, label, selected) => `<label class="catalog-control"><span>${label}</span><select name="${name}">${fontOptions.map((font) => `<option value="${font.id}" ${font.id === selected ? 'selected' : ''}>${font.name.split(' — ')[0]}</option>`).join('')}</select></label>`;
  app.innerHTML = `
    <main class="catalog-page">
      <header class="catalog-header">
        <a class="catalog-brand" href="#/catalog" aria-label="Каталог SCANME"><span>${icons.qr}</span><b>SCAN<em>ME</em></b></a>
        <label class="catalog-language"><span>${t.language}</span><select id="catalog-language">${catalogLanguages.map((item) => `<option value="${item.id}" ${item.id === language ? 'selected' : ''}>${item.label}</option>`).join('')}</select></label>
      </header>
      <section class="catalog-hero">
        <p class="eyebrow">${t.heroEyebrow}</p>
        <h1>${t.heroTitle}<br><em>${t.heroAccent}</em></h1>
        <p>${t.heroText}</p>
        <div class="catalog-actions"><button class="button button--catalog-ghost" id="share-catalog">${icons.share} ${t.share}</button></div>
      </section>
      <section class="catalog-gallery" id="catalog-themes">
        <section class="catalog-pricing" id="catalog-pricing">
          <div class="catalog-section-heading"><div><p class="eyebrow">${t.pricingStep}</p><h2>${t.pricingTitle}</h2></div><p>${t.pricingHelp}</p></div>
          <div class="catalog-price-toolbar"><label><span>${t.currency}</span><select id="catalog-currency">${catalogCurrencies.map((currency) => `<option value="${currency}" ${catalogDraft.currency === currency ? 'selected' : ''}>${currency === 'TRX' ? 'TRX / TRON' : currency}</option>`).join('')}</select></label><small id="catalog-rate-status">${t.rateLoading}</small></div>
          <div class="catalog-plan-grid">
            ${Object.entries(plans).map(([id, plan]) => `<label class="catalog-plan" style="--plan-title-size:${plan.titleSize}px;--plan-price-size:${plan.priceSize}px;--plan-small-size:${plan.smallSize}px"><input type="radio" name="catalogPlan" value="${escapeHtml(id)}" ${catalogDraft.plan === id ? 'checked' : ''}><span><em>${escapeHtml(plan.badge)}</em><b>${escapeHtml(plan.label)}</b><strong data-plan="${escapeHtml(id)}" data-price="first">${formatCatalogPrice(plan.first, catalogDraft.currency, catalogRateState.rates, language)}</strong><small>${escapeHtml(plan.subtitle)} · ${escapeHtml(plan.period)}</small><del><span data-plan="${escapeHtml(id)}" data-price="regular">${formatCatalogPrice(plan.regular, catalogDraft.currency, catalogRateState.rates, language)}</span> ${escapeHtml(plan.period)}</del><i>${catalogDraft.plan === id ? t.selected : t.choosePlan}</i></span></label>`).join('')}
          </div>
        </section>
        <div class="catalog-section-heading catalog-design-heading"><div><p class="eyebrow">${t.designStep}</p><h2>${t.designTitle}</h2></div><p>${t.designHelp}</p></div>
        <div class="catalog-theme-grid">${catalogThemes}</div>
        <section class="catalog-configurator">
          <div class="catalog-preview-column">
            <div class="catalog-preview-heading"><p class="eyebrow">${t.livePreview}</p><button class="catalog-preview-close" id="catalog-preview-close" type="button" aria-label="Close">×</button></div>
            <div class="public-card catalog-live-card theme-${catalogDraft.theme}" id="catalog-live-card">
              <div class="card-noise"></div><div class="orb orb--one"></div>
              <header class="public-card__top"><span class="mini-logo">${icons.qr} SCANME</span><button class="round-button" type="button" aria-label="${t.share}">${icons.share}</button></header>
              <section class="identity">
                <div class="portrait-wrap"><div class="portrait" id="catalog-preview-initials">ИФ</div><i class="portrait-status"></i></div>
                <p class="identity__label" id="catalog-preview-label">${cardCopy.digitalCard}</p>
                <h1 id="catalog-preview-name">${escapeHtml(catalogDraft.fullName)}</h1>
                <p class="identity__role" id="catalog-preview-role">${escapeHtml(catalogDraft.role || t.demoRole)}</p>
                <p class="identity__bio" id="catalog-preview-bio">${catalogText(catalogDraft.cardLanguage).demoBio}</p>
              </section>
              <section class="contact-dock"><div class="contact-links"><span><i>${icons.phone}</i><small id="catalog-preview-call">${cardCopy.call}</small></span><span><i>${icons.mail}</i><small id="catalog-preview-email">${cardCopy.email}</small></span><span><i>${icons.globe}</i><small id="catalog-preview-website">${cardCopy.website}</small></span></div><button class="save-contact" type="button">${icons.plus}<span id="catalog-preview-save">${cardCopy.saveContact}</span></button></section>
            </div>
          </div>
          <div class="catalog-controls">
            <div class="catalog-config-heading"><p class="eyebrow">${t.textStep}</p><h2>${t.textTitle}</h2><p>${t.textHelp}</p></div>
            <label class="catalog-control"><span>${t.cardLanguage}</span><select name="catalogCardLanguage">${languageOptions.map((item) => `<option value="${item.id}" ${catalogDraft.cardLanguage === item.id ? 'selected' : ''}>${item.name}</option>`).join('')}</select><small>${t.cardLanguageHelp}</small></label>
            <label class="catalog-control"><span>${t.fullName}</span><input name="catalogFullName" value="${escapeHtml(catalogDraft.fullName)}" maxlength="70" placeholder="Имя Фамилия"></label>
            <label class="catalog-control"><span>${t.role}</span><input name="catalogRole" value="${escapeHtml(catalogDraft.role || t.demoRole)}" maxlength="90" placeholder="${escapeHtml(t.demoRole)}"></label>
            ${catalogFontSelect('catalogHeadingFont', t.headingFont, catalogDraft.headingFont)}
            ${catalogFontSelect('catalogSecondaryFont', t.secondaryFont, catalogDraft.secondaryFont)}
            ${catalogFontSelect('catalogBodyFont', t.bodyFont, catalogDraft.bodyFont)}
            ${catalogFontSelect('catalogContactFont', t.contactFont, catalogDraft.contactFont)}
          </div>
        </section>
        <button class="catalog-mobile-preview" id="catalog-mobile-preview" type="button">${icons.user}<span>${t.livePreview}</span></button>
        <section class="catalog-order-section">
          <div class="catalog-order-copy"><p class="eyebrow">${t.orderStep}</p><h2>${t.orderTitle}</h2><p>${t.orderHelp}</p></div>
          <form class="catalog-order-form" id="catalog-order-form" action="https://formsubmit.co/${ADMIN_EMAIL}" method="POST" enctype="multipart/form-data">
            <input type="hidden" name="_subject" value="Новый заказ визитки SCANME">
            <input type="hidden" name="_template" value="table">
            <input type="hidden" name="_next" value="https://unnamed00000.github.io/ScanMe/#/catalog">
            <input type="hidden" name="_url" value="https://unnamed00000.github.io/ScanMe/#/catalog">
            <input class="catalog-honey" type="text" name="_honey" tabindex="-1" autocomplete="off">
            <input id="catalog-order-attachment" type="file" name="attachment" accept="image/png" hidden>
            <label class="catalog-control"><span>${t.customerName}</span><input name="Клиент" required maxlength="70" placeholder="${escapeHtml(t.customerNamePlaceholder)}"></label>
            <label class="catalog-control"><span>${t.customerEmail}</span><input name="email" type="email" required maxlength="120" placeholder="name@example.com"></label>
            <label class="catalog-control catalog-control--wide"><span>${t.customerContact}</span><input name="Контакт" maxlength="100" placeholder="${escapeHtml(t.contactPlaceholder)}"></label>
            <label class="catalog-control catalog-control--wide"><span>${t.comment}</span><textarea name="Комментарий" rows="4" maxlength="800" placeholder="${escapeHtml(t.commentPlaceholder)}"></textarea></label>
            <button class="button button--catalog-order" type="submit">${icons.mail} ${t.sendOrder}</button>
            <small>${t.orderNote}</small>
          </form>
        </section>
      </section>
      <footer class="catalog-footer"><a class="catalog-brand" href="#/catalog"><span>${icons.qr}</span><b>SCAN<em>ME</em></b></a></footer>
    </main>`;
  document.documentElement.lang = language;
  document.title = `SCANME — ${t.heroEyebrow}`;
  configureAdminPwa();
  const liveCard = document.querySelector('#catalog-live-card');
  const nameInput = document.querySelector('[name="catalogFullName"]');
  const roleInput = document.querySelector('[name="catalogRole"]');
  const fontFields = {
    heading: document.querySelector('[name="catalogHeadingFont"]'),
    secondary: document.querySelector('[name="catalogSecondaryFont"]'),
    body: document.querySelector('[name="catalogBodyFont"]'),
    contact: document.querySelector('[name="catalogContactFont"]'),
  };
  const cardLanguageField = document.querySelector('[name="catalogCardLanguage"]');
  const updateCatalogPrices = () => {
    Object.entries(plans).forEach(([id, plan]) => {
      const first = document.querySelector(`[data-plan="${CSS.escape(id)}"][data-price="first"]`);
      const regular = document.querySelector(`[data-plan="${CSS.escape(id)}"][data-price="regular"]`);
      if (first) first.textContent = formatCatalogPrice(plan.first, catalogDraft.currency, catalogRateState.rates, language);
      if (regular) regular.textContent = formatCatalogPrice(plan.regular, catalogDraft.currency, catalogRateState.rates, language);
    });
    const status = document.querySelector('#catalog-rate-status');
    status.textContent = catalogRateState.failed ? t.rateError : catalogRateState.loading ? t.rateLoading : `${t.rateLive}${catalogRateState.updatedAt ? ` · ${new Date(catalogRateState.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`;
  };
  const refreshCatalogRates = async (force = false) => {
    if (catalogRateState.loading) return;
    if (!force && catalogRateState.updatedAt && Date.now() - new Date(catalogRateState.updatedAt).getTime() < 60000) return updateCatalogPrices();
    catalogRateState.loading = true; catalogRateState.failed = false; updateCatalogPrices();
    try { catalogRateState = { ...await fetchCatalogRates(), loading: false, failed: false }; }
    catch { catalogRateState = { rates: { DKK: 1 }, updatedAt: '', loading: false, failed: true }; catalogDraft.currency = 'DKK'; document.querySelector('#catalog-currency').value = 'DKK'; }
    updateCatalogPrices();
  };
  const syncCatalogPreview = () => {
    const selectedThemeInput = document.querySelector('[name="catalogTheme"]:checked');
    const selectedTheme = selectedThemeInput?.value || 'lime';
    const customThemeUrl = selectedThemeInput?.dataset.themeUrl || '';
    catalogDraft.theme = selectedTheme;
    catalogDraft.fullName = nameInput.value;
    catalogDraft.role = roleInput.value;
    catalogDraft.cardLanguage = cardLanguageField.value;
    catalogDraft.headingFont = fontFields.heading.value; catalogDraft.secondaryFont = fontFields.secondary.value; catalogDraft.bodyFont = fontFields.body.value; catalogDraft.contactFont = fontFields.contact.value;
    allCatalogThemes.forEach((theme) => liveCard.classList.remove(`theme-${theme.id}`));
    liveCard.classList.toggle('theme-custom', Boolean(customThemeUrl));
    liveCard.classList.add(`theme-${selectedTheme}`);
    if (customThemeUrl) liveCard.style.setProperty('--custom-theme-image', `url('${customThemeUrl}')`);
    else liveCard.style.removeProperty('--custom-theme-image');
    liveCard.style.setProperty('--font-heading', fontStacks[fontFields.heading.value]);
    liveCard.style.setProperty('--font-secondary', fontStacks[fontFields.secondary.value]);
    liveCard.style.setProperty('--font-body', fontStacks[fontFields.body.value]);
    liveCard.style.setProperty('--font-contact', fontStacks[fontFields.contact.value]);
    const fullName = nameInput.value.trim() || 'Имя Фамилия';
    const liveCopy = publicTranslations[cardLanguageField.value] || publicTranslations.en;
    document.querySelector('#catalog-preview-name').textContent = fullName;
    document.querySelector('#catalog-preview-role').textContent = roleInput.value.trim() || t.demoRole;
    document.querySelector('#catalog-preview-initials').textContent = getInitials(fullName) || 'ИФ';
    document.querySelector('#catalog-preview-label').textContent = liveCopy.digitalCard;
    document.querySelector('#catalog-preview-bio').textContent = catalogText(cardLanguageField.value).demoBio;
    document.querySelector('#catalog-preview-call').textContent = liveCopy.call;
    document.querySelector('#catalog-preview-email').textContent = liveCopy.email;
    document.querySelector('#catalog-preview-website').textContent = liveCopy.website;
    document.querySelector('#catalog-preview-save').textContent = liveCopy.saveContact;
  };
  document.querySelectorAll('[name="catalogTheme"]').forEach((field) => field.addEventListener('change', syncCatalogPreview));
  [nameInput, roleInput, cardLanguageField, ...Object.values(fontFields)].forEach((field) => field.addEventListener('input', syncCatalogPreview));
  document.querySelector('#catalog-language').addEventListener('change', (event) => { catalogDraft.language = event.currentTarget.value; saveCatalogLanguage(catalogDraft.language); renderCatalog(); });
  document.querySelector('#catalog-currency').addEventListener('change', (event) => { catalogDraft.currency = event.currentTarget.value; updateCatalogPrices(); });
  document.querySelectorAll('[name="catalogPlan"]').forEach((field) => field.addEventListener('change', (event) => {
    catalogDraft.plan = event.currentTarget.value;
    document.querySelectorAll('.catalog-plan').forEach((plan) => { plan.querySelector('i').textContent = plan.querySelector('input').checked ? t.selected : t.choosePlan; });
  }));
  const previewColumn = document.querySelector('.catalog-preview-column');
  document.querySelector('#catalog-mobile-preview')?.addEventListener('click', () => previewColumn.classList.add('is-mobile-open'));
  document.querySelector('#catalog-preview-close')?.addEventListener('click', () => previewColumn.classList.remove('is-mobile-open'));
  syncCatalogPreview();
  refreshCatalogRates();
  document.querySelector('#share-catalog').addEventListener('click', async () => {
    const data = { title: 'SCANME', text: t.heroText, url: window.location.href };
    if (navigator.share) await navigator.share(data).catch(() => {});
    else { await navigator.clipboard.writeText(window.location.href); toast('Ссылка на каталог скопирована'); }
  });
  const orderForm = document.querySelector('#catalog-order-form');
  if (!orderForm) {
    toast('Не удалось открыть форму заказа. Обновите страницу и попробуйте снова.', 'error');
    return;
  }
  orderForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submittedForm = event.currentTarget;
    if (!(submittedForm instanceof HTMLFormElement)) {
      toast('Форма заказа недоступна. Обновите страницу и попробуйте снова.', 'error');
      return;
    }
    const selectedThemeField = document.querySelector('[name="catalogTheme"]:checked');
    const selectedTheme = selectedThemeField?.value || 'lime';
    const selectedThemeUrl = selectedThemeField?.dataset.themeUrl || '';
    const themeName = allCatalogThemes.find((theme) => theme.id === selectedTheme)?.name || selectedTheme;
    const fontName = (field) => fontOptions.find((font) => font.id === field.value)?.name || field.value;
    const button = submittedForm.querySelector('[type="submit"]');
    const attachmentField = submittedForm.querySelector('#catalog-order-attachment');
    if (!button || !(attachmentField instanceof HTMLInputElement)) {
      toast('Не удалось подготовить заказ. Обновите страницу и попробуйте снова.', 'error');
      return;
    }
    button.disabled = true;
    button.textContent = t.creatingCard;
    try {
      await refreshCatalogRates(true);
      const fullName = nameInput.value.trim() || 'Имя Фамилия';
      const selectedPlan = plans[catalogDraft.plan];
      const selectedCardCopy = publicTranslations[cardLanguageField.value] || publicTranslations.en;
      const cardFile = await createOrderCardImage({
        theme: selectedTheme, themeImageUrl: selectedThemeUrl, fullName, role: roleInput.value.trim() || t.demoRole,
        fonts: { heading: fontFields.heading.value, secondary: fontFields.secondary.value, body: fontFields.body.value, contact: fontFields.contact.value },
        copy: selectedCardCopy, description: catalogText(cardLanguageField.value).demoBio,
      });
      const transfer = new DataTransfer();
      transfer.items.add(cardFile);
      attachmentField.files = transfer.files;
      const orderFields = {
        'Имя на визитке': fullName,
        'Должность / компания': roleInput.value.trim() || 'не указано',
        'Оформление': themeName,
        'Шрифт имени': fontName(fontFields.heading),
        'Шрифт должности': fontName(fontFields.secondary),
        'Шрифт описания': fontName(fontFields.body),
        'Шрифт контактов': fontName(fontFields.contact),
        'Язык каталога': language,
        'Язык визитки': cardLanguageField.value,
        'Тариф': selectedPlan.label,
        'Первая оплата': formatCatalogPrice(selectedPlan.first, catalogDraft.currency, catalogRateState.rates, language),
        'Обычная цена после первого периода': formatCatalogPrice(selectedPlan.regular, catalogDraft.currency, catalogRateState.rates, language),
        'Валюта': catalogDraft.currency,
        'Курс обновлён': catalogRateState.updatedAt || 'DKK base price',
      };
      submittedForm.querySelectorAll('[data-generated-order]').forEach((field) => field.remove());
      Object.entries(orderFields).forEach(([name, value]) => {
        const hidden = document.createElement('input');
        hidden.type = 'hidden'; hidden.name = name; hidden.value = value; hidden.dataset.generatedOrder = 'true';
        submittedForm.append(hidden);
      });
      button.textContent = t.sendingOrder;
      submittedForm.submit();
      toast(t.orderReady);
      setTimeout(() => { button.disabled = false; button.innerHTML = `${icons.mail} ${t.sendOrder}`; }, 1800);
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : 'Не удалось отправить заказ. Попробуйте ещё раз.';
      toast(message, 'error');
      button.disabled = false;
      button.innerHTML = `${icons.mail} ${t.sendOrder}`;
    }
  });
}

const emptyProfile = () => ({
  contentType: 'card',
  language: 'ru',
  fullName: '', slug: '', title: '', company: '', bio: '', photoUrl: '', photoZoom: '1', photoX: '50', photoY: '50', phone: '',
  email: '', website: '', telegram: '', whatsapp: '', address: '', socialLinks: [], theme: 'lime', published: true,
  announcementTitle: '', announcementDescription: '', announcementImageUrl: '', category: '',
  price: '', contactName: '', validUntil: '', ctaLabel: '',
  headingFont: 'unbounded', secondaryFont: 'manrope', bodyFont: 'manrope', contactFont: 'manrope',
  headingSize: '100', secondarySize: '100', bodySize: '100', contactSize: '100', buttonSize: '100',
  textPanelOpacity: '32', textPanelBlur: '6',
  accessMode: 'unlimited', accessPrice: '', expiresAt: '', themeImageUrl: '',
});

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function publicationState(profile) {
  if (!profile.published) return { id: 'draft', label: 'Черновик' };
  if (profile.accessMode === 'timed' && profile.expiresAt && new Date(profile.expiresAt).getTime() <= Date.now()) {
    return { id: 'expired', label: 'Срок истёк' };
  }
  return { id: 'live', label: profile.accessMode === 'timed' ? 'По таймеру' : 'Опубликована' };
}

function themeCard(theme, selectedTheme) {
  const custom = Boolean(theme.imageUrl);
  const manageable = custom && Boolean(theme.fileName || theme.createdAt);
  const style = custom ? ` style="--theme-image:url('${escapeHtml(theme.imageUrl)}')"` : '';
  return `<div class="theme-card-shell" data-theme-id="${escapeHtml(theme.id)}"><label class="theme-option theme-option--${custom ? 'custom' : theme.id}"><input type="radio" name="theme" value="${escapeHtml(theme.id)}" ${selectedTheme === theme.id ? 'checked' : ''} data-theme-url="${escapeHtml(theme.imageUrl || '')}"><span${style}><i></i><b>${escapeHtml(theme.name)}</b></span></label>${manageable ? `<button class="theme-manage-button" type="button" data-theme-id="${escapeHtml(theme.id)}" aria-label="Редактировать оформление ${escapeHtml(theme.name)}" title="Редактировать или удалить">${icons.edit}</button>` : ''}</div>`;
}

function publicThemeDeclarations(profile) {
  const headingScale = clampPhotoValue(profile.headingSize, 70, 150, 100) / 100;
  const secondaryScale = clampPhotoValue(profile.secondarySize, 70, 150, 100) / 100;
  const bodyScale = clampPhotoValue(profile.bodySize, 70, 150, 100) / 100;
  const contactScale = clampPhotoValue(profile.contactSize, 70, 150, 100) / 100;
  const buttonScale = clampPhotoValue(profile.buttonSize, 70, 150, 100) / 100;
  const styles = [
    `--font-heading:${fontStacks[profile.headingFont] || fontStacks.unbounded}`,
    `--font-secondary:${fontStacks[profile.secondaryFont] || fontStacks.manrope}`,
    `--font-body:${fontStacks[profile.bodyFont] || fontStacks.manrope}`,
    `--font-contact:${fontStacks[profile.contactFont] || fontStacks.manrope}`,
    `--heading-size:clamp(${38 * headingScale}px,${7.5 * headingScale}vw,${86 * headingScale}px)`,
    `--heading-size-mobile:clamp(${34 * headingScale}px,${12 * headingScale}vw,${58 * headingScale}px)`,
    `--announcement-heading-size:clamp(${30 * headingScale}px,${5.6 * headingScale}vw,${66 * headingScale}px)`,
    `--announcement-heading-size-mobile:clamp(${30 * headingScale}px,${10 * headingScale}vw,${46 * headingScale}px)`,
    `--secondary-label-size:${10 * secondaryScale}px`,
    `--secondary-role-size:clamp(${13 * secondaryScale}px,${2 * secondaryScale}vw,${17 * secondaryScale}px)`,
    `--announcement-price-size:clamp(${22 * secondaryScale}px,${3 * secondaryScale}vw,${36 * secondaryScale}px)`,
    `--announcement-meta-size:${10 * secondaryScale}px`,
    `--body-font-size:clamp(${12 * bodyScale}px,${1.7 * bodyScale}vw,${15 * bodyScale}px)`,
    `--announcement-body-size:${14 * bodyScale}px`,
    `--contact-font-size:${9 * contactScale}px`,
    `--contact-icon-size:${48 * contactScale}px`,
    `--contact-icon-radius:${15 * contactScale}px`,
    `--button-height:${54 * buttonScale}px`,
    `--button-width:${370 * buttonScale}px`,
    `--button-font-size:${14 * buttonScale}px`,
    `--button-icon-size:${19 * buttonScale}px`,
    `--text-panel-opacity:${clampPhotoValue(profile.textPanelOpacity, 0, 90, 32) / 100}`,
    `--text-panel-blur:${clampPhotoValue(profile.textPanelBlur, 0, 30, 6)}px`,
  ];
  if (profile.themeImageUrl) styles.push(`--custom-theme-image:url('${escapeHtml(profile.themeImageUrl)}')`);
  return styles;
}

function publicThemeStyle(profile) {
  return ` style="${publicThemeDeclarations(profile).join(';')}"`;
}

function clampPhotoValue(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function setPublicViewport(enabled) {
  const viewport = document.querySelector('meta[name="viewport"]');
  viewport?.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
  document.body.classList.toggle('public-page', enabled);
}

async function resizeThemeImage(file) {
  if (!file.type.startsWith('image/')) throw new Error('Выберите изображение JPG, PNG или WebP.');
  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.addEventListener('load', () => resolve(element));
    element.addEventListener('error', () => reject(new Error('Не удалось прочитать изображение.')));
    element.src = URL.createObjectURL(file);
  });
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1600;
  const context = canvas.getContext('2d');
  const scale = Math.max(canvas.width / image.width, canvas.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  URL.revokeObjectURL(image.src);
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('Не удалось подготовить изображение.')),
    'image/webp',
    0.84,
  ));
}

function showThemeUploadModal(onUploaded) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  let previewObjectUrl = '';
  backdrop.innerHTML = `
    <form class="theme-upload-modal" id="theme-upload-form">
      <button class="modal-close" type="button" aria-label="Закрыть">×</button>
      <p class="eyebrow">Новое оформление</p><h2>Добавить фон</h2>
      <div class="theme-upload-preview"><span>${icons.plus}<b>Предпросмотр изображения</b></span></div>
      <label class="field"><span>Название оформления</span><input name="themeName" required maxlength="60" placeholder="Например, Красная Toyota"></label>
      <div class="theme-source-grid">
        <label class="theme-file-field"><input name="themeFile" type="file" accept="image/jpeg,image/png,image/webp"><span>${icons.plus}<b>Выбрать файл</b><small>JPG, PNG или WebP</small></span></label>
        <label class="field"><span>Или прямая ссылка на изображение</span><input name="imageUrl" type="url" placeholder="https://example.com/background.jpg"><small>Ссылка должна открывать сам файл изображения</small></label>
      </div>
      <label class="field github-token-field"><span>GitHub-токен</span><input name="githubToken" type="password" required autocomplete="off" placeholder="github_pat_…"><small>Нужен fine-grained token: репозиторий ScanMe → Contents: Read and write. Токен не сохраняется в браузере и очищается после загрузки. <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">Создать токен</a></small></label>
      <p class="theme-upload-hint">Фон автоматически обрежется до 1200 × 1600. Изображение и каталог оформлений сохранятся одним коммитом в папке <b>themes/</b> на GitHub.</p>
      <p class="form-error theme-upload-error" role="alert" aria-live="polite"></p>
      <button class="button button--primary button--wide" type="submit">${icons.plus} Сохранить в GitHub</button>
    </form>`;
  document.body.append(backdrop);
  const form = backdrop.querySelector('#theme-upload-form');
  if (!form) {
    backdrop.remove();
    toast('Не удалось открыть форму добавления оформления. Обновите страницу и попробуйте снова.', 'error');
    return;
  }
  const preview = backdrop.querySelector('.theme-upload-preview');
  const fileInput = backdrop.querySelector('[name="themeFile"]');
  const urlInput = backdrop.querySelector('[name="imageUrl"]');
  const nameInput = backdrop.querySelector('[name="themeName"]');
  const tokenInput = form.elements.namedItem('githubToken');
  const errorNode = form.querySelector('.theme-upload-error');
  const showPreview = (url) => {
    preview.style.backgroundImage = `url('${url.replace(/'/g, '%27')}')`;
    preview.classList.add('has-image');
  };
  fileInput.addEventListener('change', () => {
    const [file] = fileInput.files;
    if (!file) return;
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = URL.createObjectURL(file);
    showPreview(previewObjectUrl);
    if (!nameInput.value) nameInput.value = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  });
  urlInput.addEventListener('input', () => {
    const value = urlInput.value.trim();
    if (value) showPreview(value);
  });
  const close = () => {
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    backdrop.remove();
  };
  backdrop.querySelector('.modal-close').addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submittedForm = event.currentTarget;
    if (!(submittedForm instanceof HTMLFormElement)) {
      toast('Форма загрузки недоступна. Закройте окно и попробуйте снова.', 'error');
      return;
    }
    const button = submittedForm.querySelector('[type="submit"]');
    if (!button) {
      toast('Не удалось запустить загрузку оформления. Обновите страницу и попробуйте снова.', 'error');
      return;
    }
    button.disabled = true;
    button.textContent = 'Подготавливаем и загружаем…';
    if (errorNode) errorNode.textContent = '';
    let token = '';
    try {
      const formData = new FormData(submittedForm);
      const name = String(formData.get('themeName') || '').trim();
      token = String(formData.get('githubToken') || '').trim();
      formData.delete('githubToken');
      const selectedFile = formData.get('themeFile');
      const imageUrl = String(formData.get('imageUrl') || '').trim();
      let source = selectedFile?.size ? selectedFile : null;
      if (!source && imageUrl) {
        let response;
        try {
          response = await fetch(imageUrl);
        } catch {
          throw new Error('Сайт изображения запрещает загрузку по ссылке. Скачайте картинку и выберите её как файл.');
        }
        if (!response.ok) throw new Error('Не удалось скачать изображение по указанной ссылке.');
        const remoteBlob = await response.blob();
        if (!remoteBlob.type.startsWith('image/')) throw new Error('По ссылке находится не изображение.');
        source = new File([remoteBlob], 'theme-image', { type: remoteBlob.type });
      }
      if (!source) throw new Error('Выберите файл или вставьте прямую ссылку на изображение.');
      const id = `custom-${slugify(name) || 'theme'}-${Date.now().toString(36)}`;
      const blob = await resizeThemeImage(source);
      const theme = await uploadTheme({ id, name, blob, token });
      if (tokenInput instanceof HTMLInputElement) tokenInput.value = '';
      token = '';
      if (typeof onUploaded === 'function') onUploaded(theme);
      close();
      toast('Оформление сохранено в themes/ на GitHub');
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : 'Не удалось добавить оформление. Проверьте изображение, токен и подключение к интернету.';
      if (errorNode) errorNode.textContent = message;
      toast(message, 'error');
      button.disabled = false;
      button.innerHTML = `${icons.plus} Добавить оформление`;
    } finally {
      token = '';
    }
  });
}

function showThemeManageModal(theme, { onRenamed, onDeleted }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <form class="theme-manage-modal" id="theme-manage-form">
      <button class="modal-close" type="button" aria-label="Закрыть">×</button>
      <p class="eyebrow">Оформление</p><h2>Редактировать фон</h2>
      <div class="theme-manage-preview" style="background-image:linear-gradient(#02050b33,#02050b55),url('${escapeHtml(theme.imageUrl)}')"></div>
      <label class="field"><span>Название оформления</span><input name="themeName" required maxlength="60" value="${escapeHtml(theme.name)}"></label>
      <label class="field github-token-field"><span>GitHub-токен</span><input name="githubToken" type="password" required autocomplete="off" placeholder="github_pat_…"><small>Токен используется только для этого изменения и сразу очищается.</small></label>
      <p class="form-error theme-manage-error" role="alert" aria-live="polite"></p>
      <div class="theme-manage-actions"><button class="button button--danger" id="delete-theme-button" type="button">${icons.trash} Удалить</button><button class="button button--primary" type="submit">${icons.save} Сохранить название</button></div>
    </form>`;
  document.body.append(backdrop);
  const form = backdrop.querySelector('#theme-manage-form');
  if (!form) {
    backdrop.remove();
    toast('Не удалось открыть управление оформлением.', 'error');
    return;
  }
  const tokenInput = form.elements.namedItem('githubToken');
  const nameInput = form.elements.namedItem('themeName');
  const errorNode = form.querySelector('.theme-manage-error');
  const close = () => backdrop.remove();
  const showError = (error) => {
    const message = error instanceof Error && error.message ? error.message : 'Не удалось изменить оформление.';
    if (errorNode) errorNode.textContent = message;
    toast(message, 'error');
  };
  backdrop.querySelector('.modal-close').addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    let token = tokenInput instanceof HTMLInputElement ? tokenInput.value.trim() : '';
    button.disabled = true;
    button.textContent = 'Сохраняем…';
    if (errorNode) errorNode.textContent = '';
    try {
      const updated = await renameTheme({ theme, name: nameInput?.value, token });
      if (tokenInput instanceof HTMLInputElement) tokenInput.value = '';
      token = '';
      onRenamed(updated);
      close();
      toast('Название оформления изменено');
    } catch (error) {
      showError(error);
      button.disabled = false;
      button.innerHTML = `${icons.save} Сохранить название`;
    } finally {
      token = '';
    }
  });
  form.querySelector('#delete-theme-button').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    if (button.dataset.confirmDelete !== 'true') {
      button.dataset.confirmDelete = 'true';
      button.textContent = 'Нажмите ещё раз для удаления';
      if (errorNode) errorNode.textContent = `Оформление «${theme.name}» будет удалено из GitHub и списка тем.`;
      return;
    }
    let token = tokenInput instanceof HTMLInputElement ? tokenInput.value.trim() : '';
    if (!token) {
      showError(new Error('Вставьте GitHub-токен для удаления оформления.'));
      return;
    }
    button.disabled = true;
    button.textContent = 'Удаляем…';
    if (errorNode) errorNode.textContent = '';
    try {
      await deleteTheme({ theme, token });
      if (tokenInput instanceof HTMLInputElement) tokenInput.value = '';
      token = '';
      onDeleted(theme);
      close();
      toast('Оформление удалено');
    } catch (error) {
      showError(error);
      button.disabled = false;
      button.innerHTML = `${icons.trash} Удалить`;
    } finally {
      token = '';
    }
  });
}

function route() {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [page = 'admin', value = ''] = raw.split('/');
  return { page, value: decodeURIComponent(value) };
}

function setLoading(label = 'Загружаем') {
  app.innerHTML = `<main class="loading-screen"><div class="brand-mark">${icons.qr}</div><div class="loader"></div><p>${escapeHtml(label)}</p></main>`;
}

function adminShell(content, active = 'profiles') {
  const modeBadge = !isFirebaseConfigured ? '<span class="mode-badge">Демо · данные на этом устройстве</span>' : '';
  return `
    <div class="admin-layout">
      <aside class="sidebar">
        <a class="logo" href="#/admin" aria-label="ScanMe"><span class="logo__mark">${icons.qr}</span><span>SCAN<span>ME</span></span></a>
        <nav class="sidebar__nav">
          <a class="nav-item ${active === 'profiles' ? 'is-active' : ''}" href="#/admin">${icons.user}<span>Публикации</span></a>
          <a class="nav-item ${active === 'new' ? 'is-active' : ''}" href="#/edit/new">${icons.plus}<span>Создать</span></a>
          <a class="nav-item ${active === 'catalog' ? 'is-active' : ''}" href="#/catalog-admin">${icons.edit}<span>Управление каталогом</span></a>
          <a class="nav-item" href="#/catalog" target="_blank">${icons.globe}<span>Открыть каталог</span></a>
          <button class="nav-item nav-button install-pwa-button" type="button">${icons.download}<span>Установить ScanMe</span></button>
        </nav>
        <div class="sidebar__foot">
          <div class="admin-user"><span class="admin-user__avatar">A</span><div><strong>Администратор</strong><small>${escapeHtml(currentUser?.email || 'Локальный режим')}</small></div></div>
          ${isFirebaseConfigured ? `<button class="icon-button" id="logout-button" title="Выйти">${icons.logout}</button>` : ''}
        </div>
      </aside>
      <div class="admin-main">
        <header class="mobile-header"><a class="logo" href="#/admin"><span class="logo__mark">${icons.qr}</span><span>SCAN<span>ME</span></span></a><button class="icon-button" id="menu-button">${icons.menu}</button></header>
        ${modeBadge}${content}
      </div>
    </div>`;
}

function bindAdminShell() {
  bindPwaInstall();
  document.querySelector('#logout-button')?.addEventListener('click', async () => {
    await logout();
    currentUser = null;
    render();
  });
  document.querySelector('#menu-button')?.addEventListener('click', () => document.querySelector('.sidebar')?.classList.toggle('is-open'));
}

async function renderAdmin() {
  if (!currentUser) return renderLogin();
  setLoading('Загружаем публикации');
  try {
    const profiles = await listProfiles();
    const rows = profiles.length ? profiles.map((profile) => {
      const isAnnouncement = profile.contentType === 'announcement';
      const imageUrl = isAnnouncement ? profile.announcementImageUrl : profile.photoUrl;
      const primary = isAnnouncement ? profile.announcementTitle : profile.fullName;
      const secondary = isAnnouncement
        ? [profile.category, profile.price].filter(Boolean).join(' · ')
        : [profile.title, profile.company].filter(Boolean).join(' · ');
      const state = publicationState(profile);
      const searchText = [primary, secondary, profile.slug, profile.phone, profile.email, profile.contactName, profile.address]
        .filter(Boolean).join(' ').toLocaleLowerCase('ru');
      return `
      <article class="profile-row" data-search="${escapeHtml(searchText)}">
        <div class="avatar avatar--small ${imageUrl ? 'has-photo' : ''}" ${imageUrl ? `style="background-image:url('${escapeHtml(imageUrl)}')"` : ''}>${imageUrl ? '' : escapeHtml(getInitials(primary))}</div>
        <div class="profile-row__person"><strong>${escapeHtml(primary || 'Без названия')}</strong><span><em class="content-badge">${isAnnouncement ? 'Объявление' : 'Визитка'}</em>${escapeHtml(secondary || (isAnnouncement ? 'Категория не указана' : 'Должность не указана'))}</span></div>
        <span class="status status--${state.id}"><i></i>${state.label}</span>
        <code>/${escapeHtml(profile.slug)}</code>
        <div class="profile-row__actions">
          <a class="icon-button" href="#/p/${encodeURIComponent(profile.slug)}" target="_blank" title="Открыть">${icons.globe}</a>
          <button class="icon-button qr-button" data-slug="${escapeHtml(profile.slug)}" title="QR-код">${icons.qr}</button>
          <a class="icon-button" href="#/edit/${encodeURIComponent(profile.slug)}" title="Редактировать">${icons.edit}</a>
        </div>
      </article>`;
    }).join('') : `
      <div class="empty-state"><span>${icons.user}</span><h2>Здесь появятся ваши публикации</h2><p>Создайте визитку или объявление — ссылка и QR-код будут готовы сразу.</p><a class="button button--primary" href="#/edit/new">${icons.plus} Создать публикацию</a></div>`;

    app.innerHTML = adminShell(`
      <main class="admin-content">
        <div class="page-heading"><div><p class="eyebrow">Визитки и объявления</p><h1>Публикации <span>${profiles.length}</span></h1></div><a class="button button--primary" href="#/edit/new">${icons.plus} Создать</a></div>
        ${profiles.length ? `<div class="profiles-search"><span>${icons.globe}</span><input id="profiles-search" type="search" placeholder="Найти по имени, названию, телефону или адресу…" autocomplete="off"><small id="search-count">${profiles.length} публикаций</small></div>` : ''}
        <section class="profiles-panel"><div class="profiles-panel__head"><span>Профиль</span><span>Статус</span><span>Адрес</span><span></span></div><div class="profiles-list">${rows}</div></section>
        <div class="search-empty is-hidden" id="search-empty"><h2>Ничего не найдено</h2><p>Попробуйте изменить запрос.</p></div>
      </main>`, 'profiles');
    bindAdminShell();
    document.querySelectorAll('.qr-button').forEach((button) => button.addEventListener('click', () => showQrModal(button.dataset.slug)));
    document.querySelector('#profiles-search')?.addEventListener('input', (event) => {
      const query = event.currentTarget.value.trim().toLocaleLowerCase('ru');
      let visible = 0;
      document.querySelectorAll('.profile-row').forEach((row) => {
        const matches = !query || row.dataset.search.includes(query);
        row.classList.toggle('is-filtered-out', !matches);
        if (matches) visible += 1;
      });
      document.querySelector('#search-count').textContent = `${visible} из ${profiles.length}`;
      document.querySelector('#search-empty').classList.toggle('is-hidden', visible !== 0);
      document.querySelector('.profiles-panel').classList.toggle('is-hidden', visible === 0);
    });
  } catch (error) {
    renderError('Не удалось загрузить публикации', error.message, '#/admin');
  }
}

async function renderCatalogAdmin() {
  if (!currentUser) return renderLogin();
  setLoading('Загружаем настройки каталога');
  try {
    const [savedSettings, customThemes] = await Promise.all([getCatalogSettings().catch(() => null), listThemes().catch(() => [])]);
    const settings = normalizeCatalogSettings(savedSettings || {});
    const allThemes = [...themeOptions, ...customThemes];
    let draftPlans = settings.plans.map((plan) => ({ ...plan }));
    const planRow = (plan, index) => `
      <article class="catalog-plan-editor" data-plan-id="${escapeHtml(plan.id)}">
        <div class="catalog-plan-editor__head"><b>Тариф ${index + 1}</b><button class="icon-button catalog-plan-remove" type="button" title="Убрать тариф">${icons.trash}</button></div>
        <div class="fields-grid">
          <label class="field"><span>Большой заголовок</span><input data-plan-field="title" value="${escapeHtml(plan.title)}" placeholder="Например, Месячный"></label>
          <label class="field"><span>Значок / скидка</span><input data-plan-field="badge" value="${escapeHtml(plan.badge)}" placeholder="Например, Скидка 50%"></label>
          <label class="field field--wide"><span>Маленький поясняющий текст</span><input data-plan-field="subtitle" value="${escapeHtml(plan.subtitle)}" placeholder="Например, Первая оплата"></label>
          <label class="field"><span>Первая цена, DKK</span><input data-plan-field="first" type="number" min="0" step="0.01" value="${plan.first}"></label>
          <label class="field"><span>Обычная цена, DKK</span><input data-plan-field="regular" type="number" min="0" step="0.01" value="${plan.regular}"></label>
          <label class="field field--wide"><span>Период</span><input data-plan-field="period" value="${escapeHtml(plan.period)}" placeholder="Например, в месяц"></label>
        </div>
        <div class="catalog-size-controls">
          <label><span>Размер заголовка <b>${plan.titleSize}px</b></span><input data-plan-field="titleSize" type="range" min="12" max="30" value="${plan.titleSize}"></label>
          <label><span>Размер цены <b>${plan.priceSize}px</b></span><input data-plan-field="priceSize" type="range" min="24" max="64" value="${plan.priceSize}"></label>
          <label><span>Размер маленького текста <b>${plan.smallSize}px</b></span><input data-plan-field="smallSize" type="range" min="8" max="20" value="${plan.smallSize}"></label>
        </div>
      </article>`;
    app.innerHTML = adminShell(`
      <main class="admin-content catalog-admin-page">
        <div class="page-heading page-heading--editor"><div><p class="eyebrow">Личные настройки</p><h1>Управление каталогом</h1><p>Изменения видны всем посетителям каталога после сохранения.</p></div><div class="heading-actions"><a class="button button--ghost" href="#/catalog" target="_blank">${icons.globe} Открыть каталог</a><button class="button button--primary" type="submit" form="catalog-settings-form">${icons.save} Сохранить</button></div></div>
        <form id="catalog-settings-form" class="editor-grid">
          <section class="form-card"><div class="section-heading"><span>01</span><div><h2>Тарифы</h2><p>Можно оставить от одного до четырёх тарифов.</p></div></div><div id="catalog-plan-editors"></div><button class="button button--ghost" id="catalog-add-plan" type="button">${icons.plus} Добавить тариф</button></section>
          <section class="form-card"><div class="section-heading"><span>02</span><div><h2>Оформления в каталоге</h2><p>Выключенное оформление останется в админке, но исчезнет из публичного каталога.</p></div></div><div class="catalog-theme-admin-grid">${allThemes.map((theme) => { const preview = theme.imageUrl || catalogThemeImages[theme.id] || ''; return `<label class="catalog-theme-admin"><input type="checkbox" value="${escapeHtml(theme.id)}" ${settings.hiddenThemeIds.includes(theme.id) ? '' : 'checked'}><span${preview ? ` style="--admin-theme:url('${escapeHtml(preview)}')"` : ''}><i></i><b>${escapeHtml(theme.name)}</b><small>${theme.imageUrl ? 'Добавлено вами' : 'Стандартное'}</small></span></label>`; }).join('')}</div></section>
        </form>
      </main>`, 'catalog');
    bindAdminShell();
    const form = document.querySelector('#catalog-settings-form');
    const planEditors = document.querySelector('#catalog-plan-editors');
    const renderPlanEditors = () => {
      planEditors.innerHTML = draftPlans.map(planRow).join('');
      planEditors.querySelectorAll('input[type="range"]').forEach((range) => range.addEventListener('input', () => { range.closest('label').querySelector('b').textContent = `${range.value}px`; }));
      planEditors.querySelectorAll('.catalog-plan-remove').forEach((button) => button.addEventListener('click', () => {
        if (draftPlans.length <= 1) return toast('В каталоге должен остаться хотя бы один тариф.', 'error');
        const row = button.closest('.catalog-plan-editor');
        draftPlans = draftPlans.filter((plan) => plan.id !== row.dataset.planId);
        renderPlanEditors();
      }));
    };
    renderPlanEditors();
    document.querySelector('#catalog-add-plan').addEventListener('click', () => {
      if (draftPlans.length >= 4) return toast('Можно добавить не больше четырёх тарифов.', 'error');
      draftPlans.push({ id: `custom-${Date.now().toString(36)}`, enabled: true, title: '', subtitle: '', badge: '', first: 0, regular: 0, period: '', titleSize: 16, priceSize: 43, smallSize: 10 });
      renderPlanEditors();
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = document.querySelector('button[form="catalog-settings-form"]');
      button.disabled = true; button.textContent = 'Сохраняем…';
      try {
        const plans = [...planEditors.querySelectorAll('.catalog-plan-editor')].map((row) => {
          const field = (name) => row.querySelector(`[data-plan-field="${name}"]`).value;
          return { id: row.dataset.planId, enabled: true, title: field('title').trim(), subtitle: field('subtitle').trim(), badge: field('badge').trim(), period: field('period').trim(), first: Number(field('first')), regular: Number(field('regular')), titleSize: Number(field('titleSize')), priceSize: Number(field('priceSize')), smallSize: Number(field('smallSize')) };
        });
        if (plans.some((plan) => !plan.title && !['monthly', 'yearly'].includes(plan.id))) throw new Error('Укажите заголовок для каждого добавленного тарифа.');
        const visibleThemeIds = [...form.querySelectorAll('.catalog-theme-admin input:checked')].map((input) => input.value);
        if (!visibleThemeIds.length) throw new Error('Оставьте в каталоге хотя бы одно оформление.');
        const nextSettings = normalizeCatalogSettings({ plans, hiddenThemeIds: allThemes.map((theme) => theme.id).filter((id) => !visibleThemeIds.includes(id)) });
        await saveCatalogSettings(nextSettings);
        catalogSettingsCache = nextSettings; catalogCustomThemesCache = customThemes;
        toast('Настройки каталога сохранены');
      } catch (error) { toast(error.message, 'error'); }
      finally { button.disabled = false; button.innerHTML = `${icons.save} Сохранить`; }
    });
  } catch (error) { renderError('Не удалось загрузить настройки каталога', error.message, '#/admin'); }
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-page">
      <section class="login-visual">
        <a class="logo logo--light" href="#/admin"><span class="logo__mark">${icons.qr}</span><span>SCAN<span>ME</span></span></a>
        <div class="login-visual__content"><p class="eyebrow">Цифровая визитка</p><h1>Один QR.<br><em>Нужные контакты.</em></h1><p>Создавайте персональные страницы для клиентов и управляйте ими в одном месте.</p></div><div class="scan-lines"></div>
      </section>
      <section class="login-form-wrap"><form class="login-form" id="login-form">
        <p class="eyebrow">Панель управления</p><h2>Вход в ScanMe</h2><p>Введите данные администратора.</p>
        <label>Электронная почта<input name="email" type="email" autocomplete="username" required readonly value="${ADMIN_EMAIL}"></label>
        <label>Пароль<input name="password" type="password" autocomplete="current-password" required placeholder="••••••••"></label>
        <button class="button button--primary button--wide" type="submit">Войти ${icons.arrow}</button><button class="button button--ghost button--wide install-pwa-button" type="button">${icons.download} Установить ScanMe</button><p class="form-error" id="login-error"></p>
      </form></section>
    </main>`;
  bindPwaInstall();
  document.querySelector('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = event.currentTarget.querySelector('button');
    const errorNode = document.querySelector('#login-error');
    submit.disabled = true;
    submit.textContent = 'Входим…';
    try {
      const data = new FormData(event.currentTarget);
      await login(data.get('email'), data.get('password'));
    } catch (error) {
      errorNode.textContent = error.code === 'auth/invalid-credential' ? 'Неверная почта или пароль.' : error.message;
      submit.disabled = false;
      submit.innerHTML = `Войти ${icons.arrow}`;
    }
  });
}

function showSocialLinkModal(existing, onSave) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <form class="social-modal" id="social-link-form">
      <button class="modal-close" type="button" aria-label="Закрыть">×</button>
      <p class="eyebrow">Контакты</p><h2>${existing ? 'Редактировать соцсеть' : 'Добавить соцсеть'}</h2>
      <label class="field"><span>Социальная сеть</span><select name="network" required><option value="">Выберите из списка</option>${socialNetworkOptions.map((network) => `<option value="${network.id}" ${existing?.network === network.id ? 'selected' : ''}>${network.name}</option>`).join('')}</select></label>
      <label class="field social-value-field ${existing ? '' : 'is-hidden'}"><span>Ссылка или username</span><input name="value" value="${escapeHtml(existing?.value || '')}" maxlength="300" placeholder="@username или https://…"><small>Можно вставить полную ссылку или только имя пользователя</small></label>
      <button class="button button--primary button--wide social-submit ${existing ? '' : 'is-hidden'}" type="submit">${existing ? icons.save : icons.plus} ${existing ? 'Сохранить' : 'Добавить'}</button>
    </form>`;
  document.body.append(backdrop);
  const form = backdrop.querySelector('#social-link-form');
  const networkField = form.elements.network;
  const valueField = form.elements.value;
  const syncNetwork = () => {
    const selected = Boolean(networkField.value);
    form.querySelector('.social-value-field').classList.toggle('is-hidden', !selected);
    form.querySelector('.social-submit').classList.toggle('is-hidden', !selected);
    valueField.required = selected;
    if (selected) valueField.placeholder = networkField.value === 'website' ? 'https://example.com' : '@username или полная ссылка';
  };
  const close = () => backdrop.remove();
  networkField.addEventListener('change', syncNetwork);
  backdrop.querySelector('.modal-close').addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = valueField.value.trim();
    if (!value) return;
    onSave({ network: networkField.value, value });
    close();
  });
  syncNetwork();
}

async function renderEditor(slug) {
  if (!currentUser) return renderLogin();
  setLoading('Открываем редактор');
  const isNew = slug === 'new';
  const existing = isNew ? emptyProfile() : await getProfile(slug);
  if (!existing) return renderError('Публикация не найдена', 'Возможно, она была удалена.', '#/admin');
  const profile = { ...emptyProfile(), ...existing };
  let socialLinks = initialSocialLinks(profile);
  let customThemes = [];
  try {
    customThemes = await listThemes();
  } catch (error) {
    console.warn('Custom themes are unavailable', error);
  }
  if (profile.themeImageUrl && !customThemes.some((theme) => theme.id === profile.theme)) {
    customThemes.unshift({ id: profile.theme, name: 'Загруженное оформление', imageUrl: profile.themeImageUrl });
  }
  const allThemes = [...themeOptions, ...customThemes];
  const input = (name, label, options = {}) => `
    <label class="field ${options.wide ? 'field--wide' : ''} ${options.className || ''}"><span>${label}${options.required ? ' *' : ''}</span>
      <input name="${name}" value="${escapeHtml(options.value ?? profile[name] ?? '')}" ${options.required ? 'required' : ''} type="${options.type || 'text'}" placeholder="${escapeHtml(options.placeholder || '')}">
      ${options.hint ? `<small>${options.hint}</small>` : ''}
    </label>`;
  const fontSelect = (name, label, hint) => `
    <label class="field font-field"><span>${label}</span>
      <select name="${name}">${fontOptions.map((font) => `<option value="${font.id}" ${profile[name] === font.id ? 'selected' : ''}>${font.name}</option>`).join('')}</select>
      <small>${hint}</small>
    </label>`;
  const designRange = (name, label, { min, max, step = 1, suffix = '%' }) => `
    <label class="design-range"><span>${label}<b data-range-value="${name}">${escapeHtml(profile[name])}${suffix}</b></span>
      <input name="${name}" type="range" min="${min}" max="${max}" step="${step}" value="${escapeHtml(profile[name])}" data-range-suffix="${suffix}">
    </label>`;
  const socialRowsHtml = () => socialLinks.length ? socialLinks.map((item, index) => {
    const network = socialNetwork(item.network);
    return `<article class="social-link-row"><span class="social-link-icon">${escapeHtml(network.icon)}</span><div><b>${escapeHtml(network.name)}</b><small>${escapeHtml(item.value)}</small></div><button class="icon-button social-edit" type="button" data-index="${index}" aria-label="Редактировать ${escapeHtml(network.name)}">${icons.edit}</button><button class="icon-button social-delete" type="button" data-index="${index}" aria-label="Удалить ${escapeHtml(network.name)}">${icons.trash}</button></article>`;
  }).join('') : '<p class="social-links-empty">Социальные сети ещё не добавлены.</p>';

  app.innerHTML = adminShell(`
    <main class="admin-content editor-page">
      <div class="page-heading page-heading--editor"><div><a class="back-link" href="#/admin">${icons.back} Все публикации</a><h1>${isNew ? 'Новая публикация' : 'Редактирование'}</h1><p>${isNew ? 'Выберите формат и заполните данные — QR-код появится после сохранения.' : `Адрес /${escapeHtml(profile.slug)}`}</p></div><div class="heading-actions">${!isNew ? `<button class="button button--danger" id="delete-button">${icons.trash} Удалить</button>` : ''}<button class="button button--primary" type="submit" form="profile-form">${icons.save} Сохранить</button></div></div>
      <form id="profile-form" class="editor-grid">
        <section class="form-card format-card">
          <div class="section-heading"><span>00</span><div><h2>Что создаём?</h2><p>У каждого формата будет отдельная полноэкранная страница и QR-код.</p></div></div>
          <div class="content-type-picker">
            <label><input type="radio" name="contentType" value="card" ${profile.contentType !== 'announcement' ? 'checked' : ''}><span>${icons.user}<b>Визитка</b><small>Профиль человека или компании</small></span></label>
            <label><input type="radio" name="contentType" value="announcement" ${profile.contentType === 'announcement' ? 'checked' : ''}><span>${icons.globe}<b>Объявление</b><small>Товар, услуга, событие или предложение</small></span></label>
          </div>
        </section>
        <section class="form-card">
          <div class="section-heading"><span>01</span><div><h2>Основная информация</h2><p>То, что посетитель увидит первым.</p></div></div>
          <div class="fields-grid">
            ${input('fullName', 'Имя и фамилия', { className: 'card-only', placeholder: 'Александр Иванов' })}
            ${input('slug', 'Адрес страницы', { required: true, placeholder: 'alexander-ivanov', hint: 'Только латинские буквы, цифры и дефис' })}
            <label class="field"><span>Язык публичной страницы</span><select name="language">${languageOptions.map((language) => `<option value="${language.id}" ${profile.language === language.id ? 'selected' : ''}>${language.name}</option>`).join('')}</select><small>Служебные надписи и кнопки будут показаны на выбранном языке</small></label>
            ${input('title', 'Должность', { className: 'card-only', placeholder: 'Арт-директор' })}
            ${input('company', 'Компания', { className: 'card-only', placeholder: 'Studio North' })}
            <label class="field field--wide card-only"><span>О себе</span><textarea name="bio" rows="4" placeholder="Коротко расскажите о человеке">${escapeHtml(profile.bio)}</textarea></label>
            ${input('photoUrl', 'Ссылка на фотографию', { className: 'card-only', wide: true, type: 'url', placeholder: 'https://github.com/username.png', hint: 'Можно вставить прямую ссылку на аватар GitHub' })}
            <div class="photo-crop-editor field--wide card-only">
              <div class="photo-crop-preview ${profile.photoUrl ? 'has-photo' : ''}" id="photo-crop-preview"><img ${profile.photoUrl ? `src="${escapeHtml(profile.photoUrl)}"` : ''} alt="Предпросмотр"><span>${icons.user}<small>Вставьте ссылку на фото</small></span></div>
              <div class="photo-crop-controls">
                <label><span>Приблизить / отдалить <b id="photo-zoom-value">${Number(profile.photoZoom || 1).toFixed(2)}×</b></span><input name="photoZoom" type="range" min="1" max="3" step="0.05" value="${escapeHtml(profile.photoZoom || '1')}"></label>
                <label><span>Передвинуть влево / вправо <b id="photo-x-value">${escapeHtml(profile.photoX || '50')}%</b></span><input name="photoX" type="range" min="0" max="100" step="1" value="${escapeHtml(profile.photoX || '50')}"></label>
                <label><span>Передвинуть вверх / вниз <b id="photo-y-value">${escapeHtml(profile.photoY || '50')}%</b></span><input name="photoY" type="range" min="0" max="100" step="1" value="${escapeHtml(profile.photoY || '50')}"></label>
                <button class="photo-reset-button" id="photo-reset-button" type="button">Вернуть фото в центр</button>
              </div>
            </div>

            ${input('announcementTitle', 'Заголовок объявления', { className: 'announcement-only', wide: true, placeholder: 'Продам автомобиль в отличном состоянии' })}
            ${input('category', 'Категория', { className: 'announcement-only', placeholder: 'Автомобили' })}
            ${input('price', 'Цена', { className: 'announcement-only', placeholder: '125 000 DKK' })}
            <label class="field field--wide announcement-only"><span>Описание объявления *</span><textarea name="announcementDescription" rows="6" placeholder="Подробно опишите предложение">${escapeHtml(profile.announcementDescription)}</textarea></label>
            ${input('announcementImageUrl', 'Ссылка на фотографию товара или услуги', { className: 'announcement-only', wide: true, type: 'url', placeholder: 'https://example.com/photo.jpg' })}
            ${input('contactName', 'Контактное лицо', { className: 'announcement-only', placeholder: 'Александр' })}
            ${input('validUntil', 'Действует до', { className: 'announcement-only', type: 'date' })}
            ${input('ctaLabel', 'Текст кнопки', { className: 'announcement-only', placeholder: 'Связаться' })}
          </div>
        </section>
        <section class="form-card">
          <div class="section-heading"><span>02</span><div><h2>Контакты</h2><p>Показываются только заполненные поля.</p></div></div>
          <div class="fields-grid">
            ${input('phone', 'Телефон', { type: 'tel', placeholder: '+45 12 34 56 78' })}
            ${input('email', 'Email', { type: 'email', placeholder: 'hello@example.com' })}
            ${input('address', 'Город / адрес', { placeholder: 'Copenhagen, Denmark' })}
          </div>
          <div class="social-links-editor">
            <div class="social-links-heading"><div><b>Социальные сети</b><small>Instagram, Facebook, TikTok, Telegram, сайт и другие</small></div><button class="button button--social-add" id="add-social-button" type="button">${icons.plus}<span>Добавить</span></button></div>
            <div class="social-links-list" id="social-links-list">${socialRowsHtml()}</div>
          </div>
        </section>
        <section class="form-card">
          <div class="section-heading"><span>03</span><div><h2>Оформление</h2><p>Выберите цвет, настроение, животное, пейзаж или автомобиль.</p></div></div>
          <div class="font-settings">
            <div class="font-settings__heading"><b>Шрифты отдельных блоков</b><small>Каждую часть визитки или объявления можно оформить своим стилем.</small></div>
            <div class="fields-grid">
              ${fontSelect('headingFont', 'Имя или заголовок', 'Главный крупный текст')}
              ${fontSelect('secondaryFont', 'Должность, категория или цена', 'Второстепенные акценты')}
              ${fontSelect('bodyFont', 'О себе или описание', 'Основной длинный текст')}
              ${fontSelect('contactFont', 'Контакты и кнопки', 'Нижний блок действий')}
            </div>
            <div class="design-controls">
              ${designRange('headingSize', 'Размер имени или заголовка', { min: 70, max: 150 })}
              ${designRange('secondarySize', 'Размер должности и подписей', { min: 70, max: 150 })}
              ${designRange('bodySize', 'Размер описания', { min: 70, max: 150 })}
              ${designRange('contactSize', 'Размер контактов', { min: 70, max: 150 })}
              ${designRange('buttonSize', 'Размер кнопок', { min: 70, max: 150 })}
              ${designRange('textPanelOpacity', 'Видимость фона за текстом', { min: 0, max: 90 })}
              ${designRange('textPanelBlur', 'Размытие фона за текстом', { min: 0, max: 30, suffix: ' px' })}
            </div>
            <div class="editor-preview-stage">
              <div class="editor-preview-stage__heading"><b>Предпросмотр всей страницы</b><small>Так визитка будет выглядеть на телефоне</small></div>
              <main class="public-card editor-phone-preview" id="editor-card-preview"></main>
            </div>
          </div>
          <div class="theme-picker">
            ${allThemes.map((theme) => themeCard(theme, profile.theme)).join('')}
            <button class="theme-add" id="add-theme-button" type="button"><span>${icons.plus}</span><b>Добавить оформление</b><small>Фото обрежется автоматически</small></button>
          </div>
        </section>
        <section class="form-card">
          <div class="section-heading"><span>04</span><div><h2>Срок публикации</h2><p>Для друзей можно оставить навсегда, для платных заказов — установить точное время отключения.</p></div></div>
          <div class="content-type-picker access-mode-picker">
            <label><input type="radio" name="accessMode" value="unlimited" ${profile.accessMode !== 'timed' ? 'checked' : ''}><span>${icons.user}<b>Без ограничений</b><small>Работает, пока вы сами не выключите</small></span></label>
            <label><input type="radio" name="accessMode" value="timed" ${profile.accessMode === 'timed' ? 'checked' : ''}><span>${icons.globe}<b>По таймеру</b><small>Автоматически отключится в указанное время</small></span></label>
          </div>
          <div class="fields-grid timed-access-fields">
            ${input('accessPrice', 'Стоимость размещения', { placeholder: 'Например, 200 DKK' })}
            ${input('expiresAt', 'Отключить дату и время', { type: 'datetime-local', value: toDateTimeLocal(profile.expiresAt), hint: 'После этого времени страница перестанет открываться' })}
          </div>
          <label class="publish-toggle"><input type="checkbox" name="published" ${profile.published ? 'checked' : ''}><span></span><div><b>Опубликовать</b><small>Страница будет доступна по ссылке и QR-коду</small></div></label>
        </section>
      </form>
    </main>`, isNew ? 'new' : 'profiles');
  bindAdminShell();

  const socialList = document.querySelector('#social-links-list');
  const renderSocialRows = () => { socialList.innerHTML = socialRowsHtml(); };
  document.querySelector('#add-social-button').addEventListener('click', () => showSocialLinkModal(null, (item) => { socialLinks.push(item); renderSocialRows(); syncCardPreview(); }));
  socialList.addEventListener('click', (event) => {
    const editButton = event.target.closest('.social-edit');
    const deleteButton = event.target.closest('.social-delete');
    if (editButton) {
      const index = Number(editButton.dataset.index);
      showSocialLinkModal(socialLinks[index], (item) => { socialLinks[index] = item; renderSocialRows(); syncCardPreview(); });
    }
    if (deleteButton) {
      socialLinks.splice(Number(deleteButton.dataset.index), 1);
      renderSocialRows();
      syncCardPreview();
    }
  });

  const form = document.querySelector('#profile-form');
  const cardPreview = form.querySelector('#editor-card-preview');
  form.querySelectorAll('.design-range input[type="range"]').forEach((range) => {
    const output = form.querySelector(`[data-range-value="${range.name}"]`);
    const sync = () => { if (output) output.textContent = `${range.value}${range.dataset.rangeSuffix || ''}`; };
    range.addEventListener('input', sync);
    sync();
  });
  const nameField = document.querySelector('[name="fullName"]');
  const announcementTitleField = document.querySelector('[name="announcementTitle"]');
  const announcementDescriptionField = document.querySelector('[name="announcementDescription"]');
  const slugField = document.querySelector('[name="slug"]');
  const photoUrlField = document.querySelector('[name="photoUrl"]');
  const photoPreview = document.querySelector('#photo-crop-preview');
  const photoPreviewImage = photoPreview.querySelector('img');
  const photoZoomField = document.querySelector('[name="photoZoom"]');
  const photoXField = document.querySelector('[name="photoX"]');
  const photoYField = document.querySelector('[name="photoY"]');
  let slugTouched = !isNew;
  const getContentType = () => form.querySelector('[name="contentType"]:checked')?.value || 'card';
  const previewDraft = () => {
    const draft = { ...profile, ...Object.fromEntries(new FormData(form)) };
    const selectedTheme = form.querySelector('[name="theme"]:checked');
    draft.theme = selectedTheme?.value || 'lime';
    draft.themeImageUrl = selectedTheme?.dataset.themeUrl || '';
    draft.socialLinks = socialLinks;
    return draft;
  };
  const syncCardPreview = () => {
    const draft = previewDraft();
    const copy = publicCopy(draft);
    const customTheme = Boolean(draft.themeImageUrl);
    cardPreview.className = `public-card editor-phone-preview theme-${draft.theme || 'lime'} ${customTheme ? 'theme-custom' : ''}`;
    cardPreview.setAttribute('style', publicThemeDeclarations(draft).join(';'));
    if (draft.contentType === 'announcement') {
      cardPreview.classList.add('editor-phone-preview--announcement');
      cardPreview.innerHTML = `
        <div class="card-noise"></div>
        <header class="public-card__top"><span class="mini-logo">${icons.qr} SCANME</span><span class="round-button">${icons.share}</span></header>
        <section class="announcement-content ${draft.announcementImageUrl ? '' : 'announcement-content--no-image'}">
          ${draft.announcementImageUrl ? `<div class="announcement-image" style="background-image:url('${escapeHtml(draft.announcementImageUrl)}')"></div>` : ''}
          <div class="announcement-copy">
            ${draft.category ? `<span class="announcement-category">${escapeHtml(draft.category)}</span>` : ''}
            <h1>${escapeHtml(draft.announcementTitle || 'Заголовок объявления')}</h1>
            ${draft.price ? `<p class="announcement-price">${escapeHtml(draft.price)}</p>` : ''}
            <p class="announcement-description">${escapeHtml(draft.announcementDescription || 'Описание объявления появится здесь.')}</p>
            ${draft.address ? `<div class="announcement-meta"><span>${icons.map}${escapeHtml(draft.address)}</span></div>` : ''}
          </div>
        </section>
        <section class="announcement-dock"><div class="announcement-owner"><span>${escapeHtml(getInitials(draft.contactName || draft.company || 'SCANME'))}</span><div><small>${copy.contact}</small><b>${escapeHtml(draft.contactName || draft.company || 'Контакт')}</b></div></div><span class="announcement-cta">${escapeHtml(draft.ctaLabel || copy.contactAction)} ${icons.arrow}</span></section>`;
      return;
    }
    const zoom = clampPhotoValue(draft.photoZoom, 1, 3, 1);
    const photoX = clampPhotoValue(draft.photoX, 0, 100, 50);
    const photoY = clampPhotoValue(draft.photoY, 0, 100, 50);
    const role = [draft.title, draft.company].filter(Boolean).join(' · ');
    const contactItems = [
      draft.phone ? { icon: icons.phone, label: copy.call } : null,
      draft.email ? { icon: icons.mail, label: copy.email } : null,
      draft.website ? { icon: icons.globe, label: copy.website } : null,
      ...socialContactItems(draft).map((item) => ({ icon: item.icon, label: item.label })),
    ].filter(Boolean).slice(0, 6);
    cardPreview.innerHTML = `
      <div class="card-noise"></div><div class="orb orb--one"></div><div class="orb orb--two"></div>
      <header class="public-card__top"><span class="mini-logo">${icons.qr} SCANME</span><span class="round-button">${icons.share}</span></header>
      <section class="identity">
        <div class="portrait-wrap"><div class="portrait ${draft.photoUrl ? 'has-photo' : ''}">${draft.photoUrl ? `<img src="${escapeHtml(draft.photoUrl)}" alt="" style="object-position:${photoX}% ${photoY}%;transform-origin:${photoX}% ${photoY}%;transform:scale(${zoom})">` : escapeHtml(getInitials(draft.fullName || 'Имя Фамилия'))}</div><span class="portrait-status"></span></div>
        <p class="identity__label">${copy.digitalCard}</p><h1>${escapeHtml(draft.fullName || 'Имя Фамилия')}</h1>
        ${role ? `<p class="identity__role">${escapeHtml(role)}</p>` : ''}
        ${draft.bio ? `<p class="identity__bio">${escapeHtml(draft.bio)}</p>` : ''}
        ${draft.address ? `<p class="identity__location">${icons.map}${escapeHtml(draft.address)}</p>` : ''}
      </section>
      <section class="contact-dock"><div class="contact-links">${contactItems.length ? contactItems.map((item) => `<span><i>${item.icon}</i><small>${escapeHtml(item.label)}</small></span>`).join('') : `<span><i>${icons.phone}</i><small>${copy.call}</small></span><span><i>${icons.mail}</i><small>${copy.email}</small></span>`}</div><button class="save-contact" type="button">${icons.plus}<span>${copy.saveContact}</span></button></section>`;
  };
  const syncContentType = () => {
    const type = getContentType();
    document.querySelectorAll('.card-only').forEach((node) => node.classList.toggle('is-hidden', type !== 'card'));
    document.querySelectorAll('.announcement-only').forEach((node) => node.classList.toggle('is-hidden', type !== 'announcement'));
    nameField.required = type === 'card';
    announcementTitleField.required = type === 'announcement';
    announcementDescriptionField.required = type === 'announcement';
    if (!slugTouched) slugField.value = slugify(type === 'announcement' ? announcementTitleField.value : nameField.value);
    syncCardPreview();
  };
  form.querySelectorAll('[name="contentType"]').forEach((radio) => radio.addEventListener('change', syncContentType));
  syncContentType();

  const syncAccessMode = () => {
    const timed = form.querySelector('[name="accessMode"]:checked')?.value === 'timed';
    document.querySelector('.timed-access-fields').classList.toggle('is-hidden', !timed);
    form.querySelector('[name="expiresAt"]').required = timed;
  };
  form.querySelectorAll('[name="accessMode"]').forEach((radio) => radio.addEventListener('change', syncAccessMode));
  syncAccessMode();

  document.querySelector('#add-theme-button').addEventListener('click', () => {
    showThemeUploadModal((theme) => {
      customThemes = [theme, ...customThemes.filter((item) => item.id !== theme.id)];
      catalogCustomThemesCache = [theme, ...(catalogCustomThemesCache || []).filter((item) => item.id !== theme.id)];
      const holder = document.createElement('div');
      holder.innerHTML = themeCard(theme, theme.id);
      const option = holder.firstElementChild;
      document.querySelector('#add-theme-button').before(option);
      option.querySelector('input').checked = true;
      syncCardPreview();
    });
  });

  document.querySelector('.theme-picker').addEventListener('click', (event) => {
    const button = event.target.closest('.theme-manage-button');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const theme = customThemes.find((item) => item.id === button.dataset.themeId);
    if (!theme) {
      toast('Оформление не найдено. Обновите страницу.', 'error');
      return;
    }
    const shell = button.closest('.theme-card-shell');
    showThemeManageModal(theme, {
      onRenamed: (updated) => {
        customThemes = customThemes.map((item) => item.id === theme.id ? updated : item);
        shell.querySelector('.theme-option b').textContent = updated.name;
        button.setAttribute('aria-label', `Редактировать оформление ${updated.name}`);
      },
      onDeleted: () => {
        customThemes = customThemes.filter((item) => item.id !== theme.id && item.name.toLocaleLowerCase() !== theme.name.toLocaleLowerCase());
        const selected = shell.querySelector('input[name="theme"]')?.checked;
        shell.remove();
        if (selected) form.querySelector('input[name="theme"][value="lime"]')?.click();
        else syncCardPreview();
      },
    });
  });

  slugField.addEventListener('input', () => {
    slugTouched = true;
    slugField.value = slugify(slugField.value);
  });
  nameField.addEventListener('input', () => { if (!slugTouched && getContentType() === 'card') slugField.value = slugify(nameField.value); });
  announcementTitleField.addEventListener('input', () => { if (!slugTouched && getContentType() === 'announcement') slugField.value = slugify(announcementTitleField.value); });
  form.addEventListener('input', syncCardPreview);
  form.addEventListener('change', syncCardPreview);

  const updatePhotoPreview = () => {
    const url = photoUrlField.value.trim();
    const zoom = Number(photoZoomField.value || 1);
    const x = Number(photoXField.value || 50);
    const y = Number(photoYField.value || 50);
    photoPreview.classList.toggle('has-photo', Boolean(url));
    if (url && photoPreviewImage.getAttribute('src') !== url) photoPreviewImage.src = url;
    photoPreviewImage.style.objectPosition = `${x}% ${y}%`;
    photoPreviewImage.style.transformOrigin = `${x}% ${y}%`;
    photoPreviewImage.style.transform = `scale(${zoom})`;
    document.querySelector('#photo-zoom-value').textContent = `${zoom.toFixed(2)}×`;
    document.querySelector('#photo-x-value').textContent = `${Math.round(x)}%`;
    document.querySelector('#photo-y-value').textContent = `${Math.round(y)}%`;
  };
  [photoUrlField, photoZoomField, photoXField, photoYField].forEach((field) => field.addEventListener('input', updatePhotoPreview));
  photoPreviewImage.addEventListener('error', () => photoPreview.classList.remove('has-photo'));
  document.querySelector('#photo-reset-button').addEventListener('click', () => {
    photoZoomField.value = '1';
    photoXField.value = '50';
    photoYField.value = '50';
    updatePhotoPreview();
  });
  updatePhotoPreview();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = document.querySelector('button[form="profile-form"]');
    submit.disabled = true;
    submit.innerHTML = 'Сохраняем…';
    try {
      const formData = new FormData(event.currentTarget);
      const payload = { ...profile, ...Object.fromEntries(formData), slug: slugify(formData.get('slug')), published: formData.has('published') };
      payload.socialLinks = socialLinks.map((item) => ({ network: item.network, value: item.value }));
      const selectedTheme = form.querySelector('[name="theme"]:checked');
      payload.themeImageUrl = selectedTheme?.dataset.themeUrl || '';
      if (payload.accessMode === 'timed') {
        if (!payload.expiresAt) throw new Error('Укажите дату и время отключения.');
        const expiration = new Date(payload.expiresAt);
        if (Number.isNaN(expiration.getTime())) throw new Error('Укажите корректную дату отключения.');
        payload.expiresAt = expiration.toISOString();
      } else {
        payload.expiresAt = '';
      }
      if (payload.contentType === 'card' && !payload.fullName.trim()) throw new Error('Укажите имя для визитки.');
      if (payload.contentType === 'announcement' && !payload.announcementTitle.trim()) throw new Error('Укажите заголовок объявления.');
      if (!payload.slug) throw new Error('Укажите корректный адрес страницы.');
      const occupied = await getProfile(payload.slug);
      if (occupied && payload.slug !== profile.slug) throw new Error('Такой адрес уже используется. Выберите другой.');
      await saveProfile(payload, isNew ? '' : profile.slug);
      toast(payload.contentType === 'announcement' ? 'Объявление сохранено' : 'Визитка сохранена');
      if (isNew) await showQrModal(payload.slug, true);
      else window.location.hash = '#/admin';
    } catch (error) {
      toast(error.message, 'error');
      submit.disabled = false;
      submit.innerHTML = `${icons.save} Сохранить`;
    }
  });

  document.querySelector('#delete-button')?.addEventListener('click', async () => {
    const displayName = profile.contentType === 'announcement' ? profile.announcementTitle : profile.fullName;
    if (!window.confirm(`Удалить публикацию «${displayName}»? Это действие нельзя отменить.`)) return;
    await removeProfile(profile.slug);
    toast('Публикация удалена');
    window.location.hash = '#/admin';
  });
}

async function showQrModal(slug, redirectOnClose = false) {
  document.querySelector('.modal-backdrop')?.remove();
  const url = profileUrl(slug);
  const profile = await getProfile(slug).catch(() => null);
  const palette = qrPalette(profile?.theme);
  const themeName = themeOptions.find((theme) => theme.id === profile?.theme)?.name || 'SCANME';
  const copy = profile ? publicCopy(profile) : publicTranslations.ru;
  const displayName = (profile?.contentType === 'announcement'
    ? profile.announcementTitle
    : profile?.fullName) || slug;
  const backgroundUrl = profile?.themeImageUrl || catalogThemeImages[profile?.theme] || '';
  const fonts = {
    heading: profile?.headingFont || 'unbounded',
    secondary: profile?.secondaryFont || 'manrope',
    contact: profile?.contactFont || 'manrope',
  };
  const sizes = {
    heading: profile?.headingSize,
    secondary: profile?.secondarySize,
    contact: profile?.contactSize,
  };
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.style.setProperty('--qr-dark', palette.dark);
  backdrop.style.setProperty('--qr-light', palette.light);
  backdrop.style.setProperty('--qr-accent', palette.accent);
  backdrop.innerHTML = `
    <section class="qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-title">
      <button class="modal-close" aria-label="Закрыть">×</button><p class="eyebrow">${escapeHtml(themeName)} · ${QR_CARD_WIDTH_MM} × ${QR_CARD_HEIGHT_MM} мм</p><h2 id="qr-title">QR-карта для печати</h2><p>После ламинации с рамкой около 1 мм получится размер банковской карты.</p>
      <div class="qr-canvas-wrap"><canvas id="qr-canvas"></canvas><span class="qr-render-status" id="qr-render-status">Готовим QR-карту…</span></div>
      <div class="share-url"><span>${escapeHtml(url)}</span><button class="icon-button" id="copy-url" title="Копировать">${icons.copy}</button></div>
      <div class="modal-actions modal-actions--qr"><a class="button button--ghost" href="#/p/${encodeURIComponent(slug)}" target="_blank">${icons.globe} Открыть</a><button class="button button--ghost" id="print-qr" type="button" disabled>${icons.download} Печать</button><button class="button button--primary" id="download-qr" type="button" disabled>${icons.download} PNG 300 DPI</button></div>
    </section>`;
  document.body.append(backdrop);
  const canvas = backdrop.querySelector('#qr-canvas');
  const status = backdrop.querySelector('#qr-render-status');
  const printButton = backdrop.querySelector('#print-qr');
  const downloadButton = backdrop.querySelector('#download-qr');
  const close = () => { backdrop.remove(); if (redirectOnClose) window.location.hash = '#/admin'; };
  backdrop.querySelector('.modal-close').addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  backdrop.querySelector('#copy-url').addEventListener('click', async () => { await navigator.clipboard.writeText(url); toast('Ссылка скопирована'); });
  const qrCanvas = document.createElement('canvas');
  try {
    await QRCode.toCanvas(qrCanvas, url, { width: 1024, margin: 4, color: { dark: palette.dark, light: palette.light }, errorCorrectionLevel: 'H' });
    drawQrBrand(qrCanvas, palette);
    await document.fonts?.ready;
    let backgroundImage = null;
    if (backgroundUrl) {
      try {
        backgroundImage = await loadCanvasImageSafely(backgroundUrl);
      } catch (error) {
        console.warn('QR background is unavailable', error);
        toast('Фон временно не загрузился. QR-карта создана без фона.', 'error');
      }
    }
    drawQrBankCard(canvas, qrCanvas, { name: displayName, label: copy.digitalCard, palette, backgroundImage, fonts, sizes });
    status.remove();
    printButton.disabled = false;
    downloadButton.disabled = false;
  } catch (error) {
    console.error('QR card rendering failed', error);
    status.textContent = 'Не удалось создать QR-карту. Закройте окно и попробуйте ещё раз.';
    status.classList.add('is-error');
    toast('Не удалось создать QR-карту. Попробуйте ещё раз.', 'error');
  }
  printButton.addEventListener('click', () => printQrBankCard(canvas, `${displayName} — ${copy.digitalCard}`));
  downloadButton.addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `scanme-${slug}-qr-card-${QR_CARD_WIDTH_MM}x${QR_CARD_HEIGHT_MM}mm.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}

function contactLink(type, value) {
  if (!value) return '';
  if (type === 'phone') return `tel:${value.replace(/[^+\d]/g, '')}`;
  if (type === 'email') return `mailto:${value}`;
  if (type === 'telegram') return `https://t.me/${value.replace(/^@/, '')}`;
  if (type === 'whatsapp') return `https://wa.me/${value.replace(/\D/g, '')}`;
  if (type === 'website') return safeUrl(value);
  return '';
}

function publicContactItems(profile, copy) {
  const fixedContacts = [
    { id: 'phone', value: profile.phone, href: contactLink('phone', profile.phone), icon: icons.phone, label: copy.call },
    { id: 'email', value: profile.email, href: contactLink('email', profile.email), icon: icons.mail, label: copy.email },
  ].filter((item) => item.value);
  return [...fixedContacts, ...socialContactItems(profile)];
}

function renderAnnouncement(profile) {
  const copy = publicCopy(profile);
  const contacts = publicContactItems(profile, copy);
  const primaryContact = contacts[0];
  const primaryHref = primaryContact?.href || '';
  const owner = profile.contactName || profile.company || copy.contact;

  app.innerHTML = `
    <main class="public-card announcement-card theme-${escapeHtml(profile.theme || 'lime')} ${profile.themeImageUrl ? 'theme-custom' : ''}"${publicThemeStyle(profile)}>
      <div class="card-noise"></div><div class="orb orb--one"></div><div class="orb orb--two"></div>
      <header class="public-card__top"><a class="mini-logo" href="#/catalog" aria-label="Открыть каталог SCANME">${icons.qr} SCANME · ${copy.announcement}</a><div class="public-card__actions"><button class="round-button install-pwa-button" aria-label="${installLabels[profile.language] || installLabels.ru}" title="${installLabels[profile.language] || installLabels.ru}">${icons.download}</button><button class="round-button" id="share-profile" aria-label="Share">${icons.share}</button></div></header>
      <section class="announcement-content ${profile.announcementImageUrl ? '' : 'announcement-content--no-image'}">
        ${profile.announcementImageUrl ? `<div class="announcement-image" style="background-image:url('${escapeHtml(profile.announcementImageUrl)}')"></div>` : ''}
        <div class="announcement-copy">
          ${profile.category ? `<span class="announcement-category">${escapeHtml(profile.category)}</span>` : ''}
          <h1>${escapeHtml(profile.announcementTitle)}</h1>
          ${profile.price ? `<p class="announcement-price">${escapeHtml(profile.price)}</p>` : ''}
          <p class="announcement-description">${escapeHtml(profile.announcementDescription)}</p>
          <div class="announcement-meta">
            ${profile.address ? `<span>${icons.map}${escapeHtml(profile.address)}</span>` : ''}
            ${profile.validUntil ? `<span>${copy.until} ${escapeHtml(profile.validUntil)}</span>` : ''}
          </div>
        </div>
      </section>
      <section class="announcement-dock">
        <div class="announcement-owner"><span>${escapeHtml(getInitials(owner))}</span><div><small>${copy.contact}</small><b>${escapeHtml(owner)}</b></div></div>
        ${primaryHref ? `<a class="announcement-cta" href="${escapeHtml(primaryHref)}" ${primaryContact.id !== 'phone' && primaryContact.id !== 'email' ? 'target="_blank" rel="noopener"' : ''}>${escapeHtml(profile.ctaLabel || copy.contactAction)} ${icons.arrow}</a>` : ''}
        <div class="contact-links announcement-links">${contacts.map(({ id, href, icon, label }) => `<a href="${escapeHtml(href)}" ${id !== 'phone' && id !== 'email' ? 'target="_blank" rel="noopener"' : ''}><span>${icon}</span><small>${escapeHtml(label)}</small></a>`).join('')}</div>
      </section>
    </main>`;
  document.title = `${profile.announcementTitle} — ScanMe`;
  configurePublicPwa(profile);
  bindPwaInstall(profile);
  document.querySelector('#share-profile').addEventListener('click', async () => {
    const data = { title: profile.announcementTitle, text: profile.price || profile.category || copy.announcement, url: window.location.href };
    if (navigator.share) await navigator.share(data).catch(() => {});
    else { await navigator.clipboard.writeText(window.location.href); toast('Ссылка скопирована'); }
  });
}

async function renderPublic(slug) {
  setLoading('Открываем публикацию');
  try {
    const profile = await getProfile(slug);
    if (!profile || !profile.published) return renderNotFound();
    document.documentElement.lang = profile.language || 'ru';
    if (publicationState(profile).id === 'expired') return renderExpired(profile);
    if (profile.contentType === 'announcement') return renderAnnouncement(profile);
    const copy = publicCopy(profile);
    const photoZoom = clampPhotoValue(profile.photoZoom, 1, 3, 1);
    const photoX = clampPhotoValue(profile.photoX, 0, 100, 50);
    const photoY = clampPhotoValue(profile.photoY, 0, 100, 50);
    const contacts = publicContactItems(profile, copy);

    app.innerHTML = `
      <main class="public-card theme-${escapeHtml(profile.theme || 'lime')} ${profile.themeImageUrl ? 'theme-custom' : ''}"${publicThemeStyle(profile)}>
        <div class="card-noise"></div><div class="orb orb--one"></div><div class="orb orb--two"></div>
        <header class="public-card__top"><a class="mini-logo" href="#/catalog" aria-label="Открыть каталог SCANME">${icons.qr} SCANME</a><div class="public-card__actions"><button class="round-button install-pwa-button" aria-label="${installLabels[profile.language] || installLabels.ru}" title="${installLabels[profile.language] || installLabels.ru}">${icons.download}</button><button class="round-button" id="share-profile" aria-label="Поделиться">${icons.share}</button></div></header>
        <section class="identity">
          <div class="portrait-wrap"><div class="portrait ${profile.photoUrl ? 'has-photo' : ''}">${profile.photoUrl ? `<img src="${escapeHtml(profile.photoUrl)}" alt="${escapeHtml(profile.fullName)}" style="object-position:${photoX}% ${photoY}%;transform-origin:${photoX}% ${photoY}%;transform:scale(${photoZoom})">` : escapeHtml(getInitials(profile.fullName))}</div><i class="portrait-status"></i></div>
          <p class="identity__label">${copy.digitalCard}</p><h1>${escapeHtml(profile.fullName)}</h1>
          <p class="identity__role">${escapeHtml([profile.title, profile.company].filter(Boolean).join(' · '))}</p>
          ${profile.bio ? `<p class="identity__bio">${escapeHtml(profile.bio)}</p>` : ''}
          ${profile.address ? `<p class="identity__location">${icons.map}${escapeHtml(profile.address)}</p>` : ''}
        </section>
        <section class="contact-dock">
          <div class="contact-links">${contacts.map(({ id, href, icon, label }) => `<a href="${escapeHtml(href)}" ${id !== 'phone' && id !== 'email' ? 'target="_blank" rel="noopener"' : ''}><span>${icon}</span><small>${escapeHtml(label)}</small></a>`).join('')}</div>
          <button class="save-contact" id="save-contact">${icons.plus}<span>${copy.saveContact}</span></button><p>${copy.updated} · ScanMe</p>
        </section>
      </main>`;
    document.title = `${profile.fullName} — ScanMe`;
    configurePublicPwa(profile);
    bindPwaInstall(profile);
    document.querySelector('#share-profile').addEventListener('click', async () => {
      const data = { title: profile.fullName, text: [profile.title, profile.company].filter(Boolean).join(' · '), url: window.location.href };
      if (navigator.share) await navigator.share(data).catch(() => {});
      else { await navigator.clipboard.writeText(window.location.href); toast('Ссылка скопирована'); }
    });
    document.querySelector('#save-contact').addEventListener('click', () => downloadVcard(profile));
  } catch (error) {
    renderError('Не удалось открыть публикацию', error.message, '');
  }
}

function downloadVcard(profile) {
  const parts = profile.fullName.trim().split(/\s+/);
  const firstName = parts.shift() || '';
  const lastName = parts.join(' ');
  const website = initialSocialLinks(profile).find((item) => item.network === 'website')?.value || profile.website;
  const lines = [
    'BEGIN:VCARD', 'VERSION:3.0', `N:${lastName};${firstName};;;`, `FN:${profile.fullName}`,
    profile.company && `ORG:${profile.company}`, profile.title && `TITLE:${profile.title}`,
    profile.phone && `TEL;TYPE=CELL:${profile.phone}`, profile.email && `EMAIL:${profile.email}`,
    website && `URL:${safeUrl(website)}`, profile.address && `ADR;TYPE=WORK:;;${profile.address};;;;`, 'END:VCARD',
  ].filter(Boolean).join('\r\n');
  const blob = new Blob([lines], { type: 'text/vcard;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${slugify(profile.fullName) || 'contact'}.vcf`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderNotFound() {
  app.innerHTML = `<main class="not-found"><span class="brand-mark">${icons.qr}</span><p class="eyebrow">Ошибка 404</p><h1>Публикация не найдена</h1><p>Страница не существует или пока не опубликована.</p></main>`;
}

function renderExpired(profile) {
  const copy = publicCopy(profile);
  const name = profile.contentType === 'announcement' ? profile.announcementTitle : profile.fullName;
  const renewalSubject = encodeURIComponent(`${copy.expiredSubject}: ${name || profile.slug}`);
  const renewalBody = encodeURIComponent(`${copy.expiredAction}: ${name || profile.slug}\n${profileUrl(profile.slug)}`);
  app.innerHTML = `
    <main class="expired-page">
      <section class="expired-card">
        <div class="expired-card__brand"><span>${icons.qr}</span><b>SCANME</b></div>
        <div class="expired-card__status"><i></i>${escapeHtml(copy.expiredEyebrow)}</div>
        <p class="expired-card__name">${escapeHtml(name || '')}</p>
        <h1>${escapeHtml(copy.expiredTitle)}</h1>
        <p class="expired-card__text">${escapeHtml(copy.expiredText)}</p>
        <div class="expired-card__saved">${icons.save}<span>${escapeHtml(copy.expiredSaved)}</span></div>
        <div class="expired-card__actions">
          <a class="button button--primary" href="mailto:${ADMIN_EMAIL}?subject=${renewalSubject}&body=${renewalBody}">${icons.mail}${escapeHtml(copy.expiredAction)}</a>
          <a class="button button--expired-secondary" href="#/catalog">${icons.globe}${escapeHtml(copy.expiredPlans)}</a>
        </div>
      </section>
    </main>`;
  document.title = `${copy.expiredTitle} — ScanMe`;
}

function renderError(title, message, backHref) {
  app.innerHTML = `<main class="not-found"><span class="brand-mark">!</span><p class="eyebrow">Что-то пошло не так</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${backHref ? `<a class="button button--primary" href="${backHref}">Вернуться</a>` : ''}</main>`;
}

async function render() {
  const { page, value } = route();
  setPublicViewport(page === 'p' || page === 'catalog');
  document.documentElement.lang = 'ru';
  if (page !== 'p') configureAdminPwa();
  document.title = 'ScanMe — цифровые визитки';
  if (page === 'p') return renderPublic(value);
  if (page === 'catalog') return renderCatalog();
  if (page === 'catalog-admin') return renderCatalogAdmin();
  if (page === 'edit') return renderEditor(value || 'new');
  return renderAdmin();
}

setLoading();
watchAuth((user) => {
  currentUser = user;
  render();
});
window.addEventListener('hashchange', render);
