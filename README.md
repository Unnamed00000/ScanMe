# ScanMe

Сервис для цифровых визиток. Администратор создаёт профиль, а ScanMe сразу выдаёт постоянную ссылку и QR-код. После сканирования открывается полноэкранная визитка выбранного человека.

## Возможности

- админка со входом по email и паролю;
- любое количество профилей;
- автоматический адрес профиля из имени;
- QR-код после создания, копирование ссылки и скачивание PNG;
- редактирование без замены напечатанного QR-кода;
- три цветовые темы;
- телефон, email, сайт, Telegram, WhatsApp и адрес;
- аватар по прямой ссылке, включая `https://github.com/USERNAME.png`;
- сохранение контакта в формате vCard;
- черновики и опубликованные профили;
- мобильная версия и публикация через GitHub Pages.

## Локальный запуск

```bash
npm install
npm run dev
```

Без файла `.env` приложение запускается в демонстрационном режиме. Профили сохраняются только в `localStorage` текущего браузера. Это удобно для проверки, но QR-код из деморежима нельзя использовать на других устройствах.

## Firebase

Приложение уже подключено к проекту `scanme-da22f`. В [Firebase Console](https://console.firebase.google.com/) остаётся:

1. В **Authentication → Sign-in method** включить Email/Password.
2. В **Authentication → Users** создать пользователя-администратора.
3. Создать базу **Firestore Database**.
4. В **Authentication → Settings → Authorized domains** добавить `unnamed00000.github.io`.
5. Опубликовать правила базы:

```bash
npx firebase-tools login
npx firebase-tools use scanme-da22f
npx firebase-tools deploy --only firestore:rules
```

Правила разрешают всем читать опубликованную визитку, а просматривать список и менять данные — только авторизованным пользователям.

## GitHub Pages

Workflow `.github/workflows/deploy-pages.yml` уже добавлен.

1. Откройте **Settings → Pages** и выберите Source: **GitHub Actions**.
2. Отправьте изменения в ветку `main`.

Публичная ссылка будет выглядеть так:

```text
https://USERNAME.github.io/ScanMe/#/p/имя-профиля
```

QR-код содержит эту постоянную ссылку.

## Команды

```bash
npm run dev      # разработка
npm run check    # проверка JavaScript
npm run build    # production-сборка
npm run preview  # просмотр сборки
```
