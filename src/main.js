import QRCode from 'qrcode';
import './styles.css';
import {
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

const emptyProfile = () => ({
  contentType: 'card',
  fullName: '', slug: '', title: '', company: '', bio: '', photoUrl: '', phone: '',
  email: '', website: '', telegram: '', whatsapp: '', address: '', theme: 'lime', published: true,
  announcementTitle: '', announcementDescription: '', announcementImageUrl: '', category: '',
  price: '', contactName: '', validUntil: '', ctaLabel: 'Связаться',
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
  return profile.themeImageUrl ? ` style="--custom-theme-image:url('${escapeHtml(profile.themeImageUrl)}')"` : '';
}

function setPublicViewport(enabled) {
  const viewport = document.querySelector('meta[name="viewport"]');
  viewport?.setAttribute('content', enabled
    ? 'width=1180, initial-scale=1, viewport-fit=cover'
    : 'width=device-width, initial-scale=1.0, viewport-fit=cover');
  document.body.classList.toggle('public-desktop', enabled);
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

function showThemeUploadModal(file, onUploaded) {
  const previewUrl = URL.createObjectURL(file);
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const initialName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  backdrop.innerHTML = `
    <form class="theme-upload-modal" id="theme-upload-form">
      <button class="modal-close" type="button" aria-label="Закрыть">×</button>
      <p class="eyebrow">Новое оформление</p><h2>Добавить фон</h2>
      <div class="theme-upload-preview" style="background-image:url('${escapeHtml(previewUrl)}')"></div>
      <label class="field"><span>Название оформления</span><input name="themeName" required maxlength="60" value="${escapeHtml(initialName)}" placeholder="Например, Красная Toyota"></label>
      <p class="theme-upload-hint">Изображение автоматически обрежется до 1200 × 1600 и станет одинакового размера с другими оформлениями.</p>
      <button class="button button--primary button--wide" type="submit">${icons.plus} Добавить оформление</button>
    </form>`;
  document.body.append(backdrop);
  const close = () => {
    URL.revokeObjectURL(previewUrl);
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
      const name = new FormData(event.currentTarget).get('themeName').trim();
      const id = `custom-${slugify(name) || 'theme'}-${Date.now().toString(36)}`;
      const blob = await resizeThemeImage(file);
      const theme = await uploadTheme({ id, name, blob });
      onUploaded(theme);
      close();
      toast('Оформление добавлено');
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
        <label>Электронная почта<input name="email" type="email" autocomplete="email" required placeholder="admin@example.com"></label>
        <label>Пароль<input name="password" type="password" autocomplete="current-password" required placeholder="••••••••"></label>
        <button class="button button--primary button--wide" type="submit">Войти ${icons.arrow}</button><p class="form-error" id="login-error"></p>
      </form></section>
    </main>`;
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
            ${input('title', 'Должность', { className: 'card-only', placeholder: 'Арт-директор' })}
            ${input('company', 'Компания', { className: 'card-only', placeholder: 'Studio North' })}
            <label class="field field--wide card-only"><span>О себе</span><textarea name="bio" rows="4" placeholder="Коротко расскажите о человеке">${escapeHtml(profile.bio)}</textarea></label>
            ${input('photoUrl', 'Ссылка на фотографию', { className: 'card-only', wide: true, type: 'url', placeholder: 'https://github.com/username.png', hint: 'Можно вставить прямую ссылку на аватар GitHub' })}

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
          <div class="theme-picker">
            ${allThemes.map((theme) => themeCard(theme, profile.theme)).join('')}
            <button class="theme-add" id="add-theme-button" type="button"><span>${icons.plus}</span><b>Добавить оформление</b><small>Фото обрежется автоматически</small></button>
          </div>
          <input class="visually-hidden" id="theme-file-input" type="file" accept="image/jpeg,image/png,image/webp">
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

  const themeFileInput = document.querySelector('#theme-file-input');
  document.querySelector('#add-theme-button').addEventListener('click', () => themeFileInput.click());
  themeFileInput.addEventListener('change', () => {
    const [file] = themeFileInput.files;
    if (!file) return;
    showThemeUploadModal(file, (theme) => {
      const holder = document.createElement('div');
      holder.innerHTML = themeCard(theme, theme.id);
      const option = holder.firstElementChild;
      document.querySelector('#add-theme-button').before(option);
      option.querySelector('input').checked = true;
    });
    themeFileInput.value = '';
  });

  slugField.addEventListener('input', () => {
    slugTouched = true;
    slugField.value = slugify(slugField.value);
  });
  nameField.addEventListener('input', () => { if (!slugTouched && getContentType() === 'card') slugField.value = slugify(nameField.value); });
  announcementTitleField.addEventListener('input', () => { if (!slugTouched && getContentType() === 'announcement') slugField.value = slugify(announcementTitleField.value); });

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
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <section class="qr-modal" role="dialog" aria-modal="true" aria-labelledby="qr-title">
      <button class="modal-close" aria-label="Закрыть">×</button><p class="eyebrow">Готово к сканированию</p><h2 id="qr-title">QR-код публикации</h2><p>Код всегда ведёт на актуальную версию страницы.</p>
      <div class="qr-canvas-wrap"><canvas id="qr-canvas"></canvas></div>
      <div class="share-url"><span>${escapeHtml(url)}</span><button class="icon-button" id="copy-url" title="Копировать">${icons.copy}</button></div>
      <div class="modal-actions"><a class="button button--ghost" href="#/p/${encodeURIComponent(slug)}" target="_blank">${icons.globe} Открыть</a><button class="button button--primary" id="download-qr">${icons.download} Скачать PNG</button></div>
    </section>`;
  document.body.append(backdrop);
  const canvas = backdrop.querySelector('#qr-canvas');
  await QRCode.toCanvas(canvas, url, { width: 290, margin: 2, color: { dark: '#090b10', light: '#ffffff' }, errorCorrectionLevel: 'H' });
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
  const contacts = [
    ['phone', profile.phone, icons.phone, 'Позвонить'],
    ['email', profile.email, icons.mail, 'Email'],
    ['telegram', profile.telegram, '<b>TG</b>', 'Telegram'],
    ['whatsapp', profile.whatsapp, '<b>WA</b>', 'WhatsApp'],
    ['website', profile.website, icons.globe, 'Сайт'],
  ].filter(([, value]) => value);
  const primaryContact = contacts[0];
  const primaryHref = primaryContact ? contactLink(primaryContact[0], primaryContact[1]) : '';
  const owner = profile.contactName || profile.company || 'Автор объявления';

  app.innerHTML = `
    <main class="public-card announcement-card theme-${escapeHtml(profile.theme || 'lime')} ${profile.themeImageUrl ? 'theme-custom' : ''}"${publicThemeStyle(profile)}>
      <div class="card-noise"></div><div class="orb orb--one"></div><div class="orb orb--two"></div>
      <header class="public-card__top"><span class="mini-logo">${icons.qr} SCANME · ОБЪЯВЛЕНИЕ</span><button class="round-button" id="share-profile" aria-label="Поделиться">${icons.share}</button></header>
      <section class="announcement-content ${profile.announcementImageUrl ? '' : 'announcement-content--no-image'}">
        ${profile.announcementImageUrl ? `<div class="announcement-image" style="background-image:url('${escapeHtml(profile.announcementImageUrl)}')"></div>` : ''}
        <div class="announcement-copy">
          ${profile.category ? `<span class="announcement-category">${escapeHtml(profile.category)}</span>` : ''}
          <h1>${escapeHtml(profile.announcementTitle)}</h1>
          ${profile.price ? `<p class="announcement-price">${escapeHtml(profile.price)}</p>` : ''}
          <p class="announcement-description">${escapeHtml(profile.announcementDescription)}</p>
          <div class="announcement-meta">
            ${profile.address ? `<span>${icons.map}${escapeHtml(profile.address)}</span>` : ''}
            ${profile.validUntil ? `<span>До ${escapeHtml(profile.validUntil)}</span>` : ''}
          </div>
        </div>
      </section>
      <section class="announcement-dock">
        <div class="announcement-owner"><span>${escapeHtml(getInitials(owner))}</span><div><small>Контакт</small><b>${escapeHtml(owner)}</b></div></div>
        ${primaryHref ? `<a class="announcement-cta" href="${escapeHtml(primaryHref)}" ${primaryContact[0] !== 'phone' && primaryContact[0] !== 'email' ? 'target="_blank" rel="noopener"' : ''}>${escapeHtml(profile.ctaLabel || 'Связаться')} ${icons.arrow}</a>` : ''}
        <div class="contact-links announcement-links">${contacts.map(([type, value, icon, label]) => `<a href="${escapeHtml(contactLink(type, value))}" ${type !== 'phone' && type !== 'email' ? 'target="_blank" rel="noopener"' : ''}><span>${icon}</span><small>${label}</small></a>`).join('')}</div>
      </section>
    </main>`;
  document.title = `${profile.announcementTitle} — ScanMe`;
  document.querySelector('#share-profile').addEventListener('click', async () => {
    const data = { title: profile.announcementTitle, text: profile.price || profile.category || 'Объявление', url: window.location.href };
    if (navigator.share) await navigator.share(data).catch(() => {});
    else { await navigator.clipboard.writeText(window.location.href); toast('Ссылка скопирована'); }
  });
}

async function renderPublic(slug) {
  setLoading('Открываем публикацию');
  try {
    const profile = await getProfile(slug);
    if (!profile || !profile.published) return renderNotFound();
    if (publicationState(profile).id === 'expired') return renderExpired(profile);
    if (profile.contentType === 'announcement') return renderAnnouncement(profile);
    const contacts = [
      ['phone', profile.phone, icons.phone, 'Позвонить'],
      ['email', profile.email, icons.mail, 'Написать'],
      ['website', profile.website, icons.globe, 'Сайт'],
      ['telegram', profile.telegram, '<b>TG</b>', 'Telegram'],
      ['whatsapp', profile.whatsapp, '<b>WA</b>', 'WhatsApp'],
    ].filter(([, value]) => value);

    app.innerHTML = `
      <main class="public-card theme-${escapeHtml(profile.theme || 'lime')} ${profile.themeImageUrl ? 'theme-custom' : ''}"${publicThemeStyle(profile)}>
        <div class="card-noise"></div><div class="orb orb--one"></div><div class="orb orb--two"></div>
        <header class="public-card__top"><span class="mini-logo">${icons.qr} SCANME</span><button class="round-button" id="share-profile" aria-label="Поделиться">${icons.share}</button></header>
        <section class="identity">
          <div class="portrait-wrap"><div class="portrait ${profile.photoUrl ? 'has-photo' : ''}" ${profile.photoUrl ? `style="background-image:url('${escapeHtml(profile.photoUrl)}')"` : ''}>${profile.photoUrl ? '' : escapeHtml(getInitials(profile.fullName))}</div><i class="portrait-status"></i></div>
          <p class="identity__label">Digital business card</p><h1>${escapeHtml(profile.fullName)}</h1>
          <p class="identity__role">${escapeHtml([profile.title, profile.company].filter(Boolean).join(' · '))}</p>
          ${profile.bio ? `<p class="identity__bio">${escapeHtml(profile.bio)}</p>` : ''}
          ${profile.address ? `<p class="identity__location">${icons.map}${escapeHtml(profile.address)}</p>` : ''}
        </section>
        <section class="contact-dock">
          <div class="contact-links">${contacts.map(([type, value, icon, label]) => `<a href="${escapeHtml(contactLink(type, value))}" ${type !== 'phone' && type !== 'email' ? 'target="_blank" rel="noopener"' : ''}><span>${icon}</span><small>${label}</small></a>`).join('')}</div>
          <button class="save-contact" id="save-contact">${icons.plus}<span>Сохранить контакт</span></button><p>Обновлено владельцем · ScanMe</p>
        </section>
      </main>`;
    document.title = `${profile.fullName} — ScanMe`;
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
  const name = profile.contentType === 'announcement' ? profile.announcementTitle : profile.fullName;
  app.innerHTML = `<main class="not-found"><span class="brand-mark">${icons.qr}</span><p class="eyebrow">Срок публикации завершён</p><h1>Страница временно отключена</h1><p>${escapeHtml(name || 'Эта публикация')} снова появится после продления владельцем.</p></main>`;
}

function renderError(title, message, backHref) {
  app.innerHTML = `<main class="not-found"><span class="brand-mark">!</span><p class="eyebrow">Что-то пошло не так</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p>${backHref ? `<a class="button button--primary" href="${backHref}">Вернуться</a>` : ''}</main>`;
}

async function render() {
  const { page, value } = route();
  setPublicViewport(page === 'p');
  document.title = 'ScanMe — цифровые визитки';
  if (page === 'p') return renderPublic(value);
  if (page === 'edit') return renderEditor(value || 'new');
  return renderAdmin();
}

setLoading();
watchAuth((user) => {
  currentUser = user;
  render();
});
window.addEventListener('hashchange', render);
