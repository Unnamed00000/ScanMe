import QRCode from 'qrcode';
import './styles.css';
import {
  ADMIN_EMAIL,
  getProfile,
  isFirebaseConfigured,
  listProfiles,
  listThemes,
  login,
  logout,
  removeProfile,
  saveProfile,
  uploadTheme,
  watchAuth,
} from './store.js';
import { escapeHtml, getInitials, icons, profileUrl, safeUrl, slugify, toast } from './ui.js';

const app = document.querySelector('#app');
let currentUser = null;
let deferredInstallPrompt = null;

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

const languageOptions = [
  { id: 'ru', name: 'Русский' },
  { id: 'en', name: 'English' },
  { id: 'da', name: 'Dansk' },
  { id: 'de', name: 'Deutsch' },
  { id: 'ka', name: 'ქართული' },
];

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
  ru: { digitalCard: 'Цифровая визитка', announcement: 'ОБЪЯВЛЕНИЕ', call: 'Позвонить', email: 'Email', website: 'Сайт', saveContact: 'Сохранить контакт', updated: 'Обновлено владельцем', contact: 'Контакт', until: 'До', contactAction: 'Связаться', expiredEyebrow: 'Срок публикации завершён', expiredTitle: 'Страница временно отключена', expiredText: 'снова появится после продления владельцем.' },
  en: { digitalCard: 'Digital business card', announcement: 'ADVERTISEMENT', call: 'Call', email: 'Email', website: 'Website', saveContact: 'Save contact', updated: 'Updated by the owner', contact: 'Contact', until: 'Until', contactAction: 'Contact', expiredEyebrow: 'Publication period ended', expiredTitle: 'Page temporarily unavailable', expiredText: 'will return after the owner renews it.' },
  da: { digitalCard: 'Digitalt visitkort', announcement: 'ANNONCE', call: 'Ring', email: 'E-mail', website: 'Hjemmeside', saveContact: 'Gem kontakt', updated: 'Opdateret af ejeren', contact: 'Kontakt', until: 'Til', contactAction: 'Kontakt', expiredEyebrow: 'Udgivelsesperioden er udløbet', expiredTitle: 'Siden er midlertidigt deaktiveret', expiredText: 'vises igen, når ejeren forlænger perioden.' },
  de: { digitalCard: 'Digitale Visitenkarte', announcement: 'ANZEIGE', call: 'Anrufen', email: 'E-Mail', website: 'Webseite', saveContact: 'Kontakt speichern', updated: 'Vom Inhaber aktualisiert', contact: 'Kontakt', until: 'Bis', contactAction: 'Kontaktieren', expiredEyebrow: 'Veröffentlichungszeitraum beendet', expiredTitle: 'Seite vorübergehend deaktiviert', expiredText: 'wird nach der Verlängerung durch den Inhaber wieder angezeigt.' },
  ka: { digitalCard: 'ციფრული სავიზიტო ბარათი', announcement: 'განცხადება', call: 'დარეკვა', email: 'ელფოსტა', website: 'ვებსაიტი', saveContact: 'კონტაქტის შენახვა', updated: 'განახლებულია მფლობელის მიერ', contact: 'კონტაქტი', until: 'მოქმედებს', contactAction: 'დაკავშირება', expiredEyebrow: 'გამოქვეყნების ვადა დასრულდა', expiredTitle: 'გვერდი დროებით გამორთულია', expiredText: 'კვლავ გამოჩნდება მფლობელის მიერ ვადის გაგრძელების შემდეგ.' },
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

function renderCatalog() {
  const catalogThemes = themeOptions.map((theme) => `
    <label class="catalog-theme theme-option theme-option--${theme.id}">
      <input type="radio" name="catalogTheme" value="${theme.id}" ${theme.id === 'lime' ? 'checked' : ''}>
      <span><i></i><b>${escapeHtml(theme.name)}</b></span>
    </label>`).join('');
  const catalogFontSelect = (name, label, selected) => `<label class="catalog-control"><span>${label}</span><select name="${name}">${fontOptions.map((font) => `<option value="${font.id}" ${font.id === selected ? 'selected' : ''}>${font.name}</option>`).join('')}</select></label>`;
  app.innerHTML = `
    <main class="catalog-page">
      <header class="catalog-header">
        <a class="catalog-brand" href="#/catalog" aria-label="Каталог SCANME"><span>${icons.qr}</span><b>SCAN<em>ME</em></b></a>
        <a class="catalog-admin-link" href="#/admin">Вход в панель ${icons.arrow}</a>
      </header>
      <section class="catalog-hero">
        <p class="eyebrow">Каталог цифровых визиток</p>
        <h1>Один QR-код.<br><em>Ваша страница.</em></h1>
        <p>Персональные визитки и объявления, которые открываются на весь экран, устанавливаются на телефон и всегда остаются актуальными.</p>
        <div class="catalog-actions"><a class="button button--catalog" href="#catalog-themes">Смотреть оформления ${icons.arrow}</a><button class="button button--catalog-ghost" id="share-catalog">${icons.share} Поделиться</button></div>
      </section>
      <section class="catalog-benefits" aria-label="Преимущества">
        <article><span>01</span><b>Один QR навсегда</b><p>Меняйте контакты и оформление, не перепечатывая QR-код.</p></article>
        <article><span>02</span><b>Как приложение</b><p>Каждую визитку можно добавить на главный экран телефона.</p></article>
        <article><span>03</span><b>Полный контроль</b><p>Публикация, таймер отключения, языки, шрифты и разные форматы.</p></article>
      </section>
      <section class="catalog-gallery" id="catalog-themes">
        <div class="catalog-section-heading"><div><p class="eyebrow">Шаг 1 · оформление</p><h2>Выберите свой характер</h2></div><p>Нажмите на любое оформление — предпросмотр ниже изменится сразу.</p></div>
        <div class="catalog-theme-grid">${catalogThemes}</div>
        <section class="catalog-configurator">
          <div class="catalog-preview-column">
            <p class="eyebrow">Живой предпросмотр</p>
            <div class="public-card catalog-live-card theme-lime" id="catalog-live-card">
              <div class="card-noise"></div><div class="orb orb--one"></div>
              <header class="public-card__top"><span class="mini-logo">${icons.qr} SCANME</span><button class="round-button" type="button" aria-label="Поделиться">${icons.share}</button></header>
              <section class="identity">
                <div class="portrait-wrap"><div class="portrait" id="catalog-preview-initials">АМ</div><i class="portrait-status"></i></div>
                <p class="identity__label">Цифровая визитка</p>
                <h1 id="catalog-preview-name">Адам Маргоев</h1>
                <p class="identity__role" id="catalog-preview-role">Специалист · SCANME</p>
                <p class="identity__bio">Контакты, ссылки и нужная информация всегда под рукой.</p>
              </section>
              <section class="contact-dock"><div class="contact-links"><span><i>${icons.phone}</i><small>Позвонить</small></span><span><i>${icons.mail}</i><small>Email</small></span><span><i>${icons.globe}</i><small>Сайт</small></span></div><button class="save-contact" type="button">${icons.plus}<span>Сохранить контакт</span></button></section>
            </div>
          </div>
          <div class="catalog-controls">
            <div class="catalog-config-heading"><p class="eyebrow">Шаг 2 · текст и шрифты</p><h2>Настройте каждый блок</h2><p>Все изменения видны на макете без перезагрузки.</p></div>
            <label class="catalog-control"><span>Имя на визитке</span><input name="catalogFullName" value="Адам Маргоев" maxlength="70" placeholder="Имя и фамилия"></label>
            <label class="catalog-control"><span>Должность или компания</span><input name="catalogRole" value="Специалист · SCANME" maxlength="90" placeholder="Должность · Компания"></label>
            ${catalogFontSelect('catalogHeadingFont', 'Шрифт имени', 'unbounded')}
            ${catalogFontSelect('catalogSecondaryFont', 'Шрифт должности', 'manrope')}
            ${catalogFontSelect('catalogBodyFont', 'Шрифт описания', 'manrope')}
            ${catalogFontSelect('catalogContactFont', 'Шрифт контактов и кнопки', 'manrope')}
          </div>
        </section>
        <section class="catalog-order-section">
          <div class="catalog-order-copy"><p class="eyebrow">Шаг 3 · заказ</p><h2>Отправьте выбранный вариант</h2><p>Тема, шрифты и текст автоматически попадут в письмо. Останется только отправить его.</p></div>
          <form class="catalog-order-form" id="catalog-order-form">
            <label class="catalog-control"><span>Ваше имя *</span><input name="customerName" required maxlength="70" placeholder="Как к вам обращаться"></label>
            <label class="catalog-control"><span>Телефон, WhatsApp или Telegram *</span><input name="customerContact" required maxlength="100" placeholder="Например, +45… или @username"></label>
            <label class="catalog-control catalog-control--wide"><span>Комментарий</span><textarea name="customerNote" rows="4" maxlength="800" placeholder="Какие контакты и информацию добавить на визитку"></textarea></label>
            <button class="button button--catalog-order" type="submit">${icons.mail} Отправить заказ</button>
            <small>Откроется ваше почтовое приложение с уже заполненным заказом.</small>
          </form>
        </section>
      </section>
      <footer class="catalog-footer"><a class="catalog-brand" href="#/catalog"><span>${icons.qr}</span><b>SCAN<em>ME</em></b></a><p>Цифровые визитки и объявления с QR-кодом.</p></footer>
    </main>`;
  document.title = 'Каталог SCANME — цифровые визитки';
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
  const syncCatalogPreview = () => {
    const selectedTheme = document.querySelector('[name="catalogTheme"]:checked')?.value || 'lime';
    themeOptions.forEach((theme) => liveCard.classList.remove(`theme-${theme.id}`));
    liveCard.classList.add(`theme-${selectedTheme}`);
    liveCard.style.setProperty('--font-heading', fontStacks[fontFields.heading.value]);
    liveCard.style.setProperty('--font-secondary', fontStacks[fontFields.secondary.value]);
    liveCard.style.setProperty('--font-body', fontStacks[fontFields.body.value]);
    liveCard.style.setProperty('--font-contact', fontStacks[fontFields.contact.value]);
    const fullName = nameInput.value.trim() || 'Ваше имя';
    document.querySelector('#catalog-preview-name').textContent = fullName;
    document.querySelector('#catalog-preview-role').textContent = roleInput.value.trim() || 'Должность · Компания';
    document.querySelector('#catalog-preview-initials').textContent = getInitials(fullName) || 'Я';
  };
  document.querySelectorAll('[name="catalogTheme"]').forEach((field) => field.addEventListener('change', syncCatalogPreview));
  [nameInput, roleInput, ...Object.values(fontFields)].forEach((field) => field.addEventListener('input', syncCatalogPreview));
  syncCatalogPreview();
  document.querySelector('#share-catalog').addEventListener('click', async () => {
    const data = { title: 'Каталог SCANME', text: 'Цифровые визитки и объявления с QR-кодом', url: window.location.href };
    if (navigator.share) await navigator.share(data).catch(() => {});
    else { await navigator.clipboard.writeText(window.location.href); toast('Ссылка на каталог скопирована'); }
  });
  document.querySelector('#catalog-order-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const selectedTheme = document.querySelector('[name="catalogTheme"]:checked')?.value || 'lime';
    const themeName = themeOptions.find((theme) => theme.id === selectedTheme)?.name || selectedTheme;
    const fontName = (field) => fontOptions.find((font) => font.id === field.value)?.name || field.value;
    const subject = `Заказ визитки SCANME — ${data.get('customerName')}`;
    const body = [
      'Новый заказ из каталога SCANME', '',
      `Клиент: ${data.get('customerName')}`,
      `Контакт: ${data.get('customerContact')}`,
      `Имя на визитке: ${nameInput.value.trim() || 'не указано'}`,
      `Должность / компания: ${roleInput.value.trim() || 'не указано'}`,
      `Оформление: ${themeName}`,
      `Шрифт имени: ${fontName(fontFields.heading)}`,
      `Шрифт должности: ${fontName(fontFields.secondary)}`,
      `Шрифт описания: ${fontName(fontFields.body)}`,
      `Шрифт контактов: ${fontName(fontFields.contact)}`,
      '', `Комментарий: ${data.get('customerNote') || 'нет'}`,
    ].join('\n');
    window.location.href = `mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast('Заказ подготовлен — отправьте письмо в почтовом приложении');
  });
}

const emptyProfile = () => ({
  contentType: 'card',
  language: 'ru',
  fullName: '', slug: '', title: '', company: '', bio: '', photoUrl: '', photoZoom: '1', photoX: '50', photoY: '50', phone: '',
  email: '', website: '', telegram: '', whatsapp: '', address: '', theme: 'lime', published: true,
  announcementTitle: '', announcementDescription: '', announcementImageUrl: '', category: '',
  price: '', contactName: '', validUntil: '', ctaLabel: '',
  headingFont: 'unbounded', secondaryFont: 'manrope', bodyFont: 'manrope', contactFont: 'manrope',
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
  const style = custom ? ` style="--theme-image:url('${escapeHtml(theme.imageUrl)}')"` : '';
  return `<label class="theme-option theme-option--${custom ? 'custom' : theme.id}"><input type="radio" name="theme" value="${escapeHtml(theme.id)}" ${selectedTheme === theme.id ? 'checked' : ''} data-theme-url="${escapeHtml(theme.imageUrl || '')}"><span${style}><i></i><b>${escapeHtml(theme.name)}</b></span></label>`;
}

function publicThemeStyle(profile) {
  const styles = [
    `--font-heading:${fontStacks[profile.headingFont] || fontStacks.unbounded}`,
    `--font-secondary:${fontStacks[profile.secondaryFont] || fontStacks.manrope}`,
    `--font-body:${fontStacks[profile.bodyFont] || fontStacks.manrope}`,
    `--font-contact:${fontStacks[profile.contactFont] || fontStacks.manrope}`,
  ];
  if (profile.themeImageUrl) styles.push(`--custom-theme-image:url('${escapeHtml(profile.themeImageUrl)}')`);
  return ` style="${styles.join(';')}"`;
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
      <button class="button button--primary button--wide" type="submit">${icons.plus} Сохранить в GitHub</button>
    </form>`;
  document.body.append(backdrop);
  const preview = backdrop.querySelector('.theme-upload-preview');
  const fileInput = backdrop.querySelector('[name="themeFile"]');
  const urlInput = backdrop.querySelector('[name="imageUrl"]');
  const nameInput = backdrop.querySelector('[name="themeName"]');
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
  backdrop.querySelector('#theme-upload-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('[type="submit"]');
    button.disabled = true;
    button.textContent = 'Подготавливаем и загружаем…';
    try {
      const formData = new FormData(event.currentTarget);
      const name = formData.get('themeName').trim();
      const token = formData.get('githubToken').trim();
      const selectedFile = formData.get('themeFile');
      const imageUrl = formData.get('imageUrl').trim();
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
      event.currentTarget.elements.githubToken.value = '';
      onUploaded(theme);
      close();
      toast('Оформление сохранено в themes/ на GitHub');
    } catch (error) {
      toast(error.message, 'error');
      button.disabled = false;
      button.innerHTML = `${icons.plus} Добавить оформление`;
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

async function renderEditor(slug) {
  if (!currentUser) return renderLogin();
  setLoading('Открываем редактор');
  const isNew = slug === 'new';
  const existing = isNew ? emptyProfile() : await getProfile(slug);
  if (!existing) return renderError('Публикация не найдена', 'Возможно, она была удалена.', '#/admin');
  const profile = { ...emptyProfile(), ...existing };
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
            ${input('website', 'Сайт', { type: 'url', placeholder: 'https://example.com' })}
            ${input('telegram', 'Telegram', { placeholder: '@username' })}
            ${input('whatsapp', 'WhatsApp', { placeholder: '+4512345678' })}
            ${input('address', 'Город / адрес', { placeholder: 'Copenhagen, Denmark' })}
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

  const form = document.querySelector('#profile-form');
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
  const syncContentType = () => {
    const type = getContentType();
    document.querySelectorAll('.card-only').forEach((node) => node.classList.toggle('is-hidden', type !== 'card'));
    document.querySelectorAll('.announcement-only').forEach((node) => node.classList.toggle('is-hidden', type !== 'announcement'));
    nameField.required = type === 'card';
    announcementTitleField.required = type === 'announcement';
    announcementDescriptionField.required = type === 'announcement';
    if (!slugTouched) slugField.value = slugify(type === 'announcement' ? announcementTitleField.value : nameField.value);
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
      const holder = document.createElement('div');
      holder.innerHTML = themeCard(theme, theme.id);
      const option = holder.firstElementChild;
      document.querySelector('#add-theme-button').before(option);
      option.querySelector('input').checked = true;
    });
  });

  slugField.addEventListener('input', () => {
    slugTouched = true;
    slugField.value = slugify(slugField.value);
  });
  nameField.addEventListener('input', () => { if (!slugTouched && getContentType() === 'card') slugField.value = slugify(nameField.value); });
  announcementTitleField.addEventListener('input', () => { if (!slugTouched && getContentType() === 'announcement') slugField.value = slugify(announcementTitleField.value); });

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
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.style.setProperty('--qr-dark', palette.dark);
  backdrop.style.setProperty('--qr-light', palette.light);
  backdrop.style.setProperty('--qr-accent', palette.accent);
  backdrop.innerHTML = `
    <section class="qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-title">
      <button class="modal-close" aria-label="Закрыть">×</button><p class="eyebrow">${escapeHtml(themeName)}</p><h2 id="qr-title">QR-код в стиле публикации</h2><p>Код всегда ведёт на актуальную версию страницы.</p>
      <div class="qr-canvas-wrap"><canvas id="qr-canvas"></canvas></div>
      <div class="share-url"><span>${escapeHtml(url)}</span><button class="icon-button" id="copy-url" title="Копировать">${icons.copy}</button></div>
      <div class="modal-actions"><a class="button button--ghost" href="#/p/${encodeURIComponent(slug)}" target="_blank">${icons.globe} Открыть</a><button class="button button--primary" id="download-qr">${icons.download} Скачать PNG</button></div>
    </section>`;
  document.body.append(backdrop);
  const canvas = backdrop.querySelector('#qr-canvas');
  await QRCode.toCanvas(canvas, url, { width: 1024, margin: 4, color: { dark: palette.dark, light: palette.light }, errorCorrectionLevel: 'H' });
  drawQrBrand(canvas, palette);
  const close = () => { backdrop.remove(); if (redirectOnClose) window.location.hash = '#/admin'; };
  backdrop.querySelector('.modal-close').addEventListener('click', close);
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
  backdrop.querySelector('#copy-url').addEventListener('click', async () => { await navigator.clipboard.writeText(url); toast('Ссылка скопирована'); });
  backdrop.querySelector('#download-qr').addEventListener('click', () => {
    const link = document.createElement('a');
    link.download = `scanme-${slug}-qr.png`;
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

function renderAnnouncement(profile) {
  const copy = publicCopy(profile);
  const contacts = [
    ['phone', profile.phone, icons.phone, copy.call],
    ['email', profile.email, icons.mail, copy.email],
    ['telegram', profile.telegram, '<b>TG</b>', 'Telegram'],
    ['whatsapp', profile.whatsapp, '<b>WA</b>', 'WhatsApp'],
    ['website', profile.website, icons.globe, copy.website],
  ].filter(([, value]) => value);
  const primaryContact = contacts[0];
  const primaryHref = primaryContact ? contactLink(primaryContact[0], primaryContact[1]) : '';
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
        ${primaryHref ? `<a class="announcement-cta" href="${escapeHtml(primaryHref)}" ${primaryContact[0] !== 'phone' && primaryContact[0] !== 'email' ? 'target="_blank" rel="noopener"' : ''}>${escapeHtml(profile.ctaLabel || copy.contactAction)} ${icons.arrow}</a>` : ''}
        <div class="contact-links announcement-links">${contacts.map(([type, value, icon, label]) => `<a href="${escapeHtml(contactLink(type, value))}" ${type !== 'phone' && type !== 'email' ? 'target="_blank" rel="noopener"' : ''}><span>${icon}</span><small>${label}</small></a>`).join('')}</div>
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
    const contacts = [
      ['phone', profile.phone, icons.phone, copy.call],
      ['email', profile.email, icons.mail, copy.email],
      ['website', profile.website, icons.globe, copy.website],
      ['telegram', profile.telegram, '<b>TG</b>', 'Telegram'],
      ['whatsapp', profile.whatsapp, '<b>WA</b>', 'WhatsApp'],
    ].filter(([, value]) => value);

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
          <div class="contact-links">${contacts.map(([type, value, icon, label]) => `<a href="${escapeHtml(contactLink(type, value))}" ${type !== 'phone' && type !== 'email' ? 'target="_blank" rel="noopener"' : ''}><span>${icon}</span><small>${label}</small></a>`).join('')}</div>
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
  const lines = [
    'BEGIN:VCARD', 'VERSION:3.0', `N:${lastName};${firstName};;;`, `FN:${profile.fullName}`,
    profile.company && `ORG:${profile.company}`, profile.title && `TITLE:${profile.title}`,
    profile.phone && `TEL;TYPE=CELL:${profile.phone}`, profile.email && `EMAIL:${profile.email}`,
    profile.website && `URL:${profile.website}`, profile.address && `ADR;TYPE=WORK:;;${profile.address};;;;`, 'END:VCARD',
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
  app.innerHTML = `<main class="not-found"><span class="brand-mark">${icons.qr}</span><p class="eyebrow">${copy.expiredEyebrow}</p><h1>${copy.expiredTitle}</h1><p>${escapeHtml(name || '')} ${copy.expiredText}</p></main>`;
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
  if (page === 'edit') return renderEditor(value || 'new');
  return renderAdmin();
}

setLoading();
watchAuth((user) => {
  currentUser = user;
  render();
});
window.addEventListener('hashchange', render);
