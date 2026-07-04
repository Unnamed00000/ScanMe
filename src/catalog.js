export const catalogLanguages = [
  { id: 'en', label: 'English' },
  { id: 'ru', label: 'Русский' },
  { id: 'da', label: 'Dansk' },
  { id: 'ka', label: 'ქართული' },
  { id: 'de', label: 'Deutsch' },
];

export const catalogFiatCurrencies = ['DKK', 'EUR', 'USD', 'RUB'];
export const catalogCryptoCurrencies = ['BTC', 'TRX'];
export const catalogCurrencies = [...catalogFiatCurrencies, ...catalogCryptoCurrencies];

const translations = {
  en: {
    language: 'Language', heroEyebrow: 'Build your digital card', heroTitle: 'Choose. Customise.', heroAccent: 'See it instantly.',
    heroText: 'Choose a design and fonts, enter your details, select a plan and send the finished concept in one order.', start: 'Start creating', share: 'Share',
    pricingStep: 'Step 1 · plan', pricingTitle: 'Choose your subscription', pricingHelp: 'New customers receive 50% off their first billing period.',
    monthly: 'Monthly', yearly: 'Yearly', perMonth: 'per month', perYear: 'per year', firstPayment: 'First payment', afterwards: 'then', save: 'Save 50%', selected: 'Selected', choosePlan: 'Choose plan',
    currency: 'Currency', rateLive: 'Live exchange rate', rateLoading: 'Updating prices…', rateError: 'Live rates are temporarily unavailable. Prices are shown in DKK.',
    designStep: 'Step 2 · design', designTitle: 'Choose your style', designHelp: 'Tap any design and the preview below will update instantly.',
    livePreview: 'Live preview', digitalCard: 'Digital business card', demoRole: 'Your role · Company', demoBio: 'Contacts, links and useful information — always at hand.', call: 'Call', email: 'Email', website: 'Website', saveContact: 'Save contact',
    textStep: 'Step 3 · text and fonts', textTitle: 'Customise every block', textHelp: 'The catalogue language and card language are separate settings.',
    cardLanguage: 'Card language', cardLanguageHelp: 'Controls the labels shown on the finished card only.', fullName: 'Name on the card', role: 'Role or company',
    headingFont: 'Name font', secondaryFont: 'Role font', bodyFont: 'Description font', contactFont: 'Contacts and button font',
    orderStep: 'Step 4 · order', orderTitle: 'Send your selected concept', orderHelp: 'Your settings, plan and a PNG preview will be included in the email.',
    customerName: 'Your name *', customerNamePlaceholder: 'How should we address you?', customerEmail: 'Reply email *', customerContact: 'Phone, WhatsApp or Telegram',
    contactPlaceholder: 'For example +45… or @username', comment: 'Comment', commentPlaceholder: 'What contacts and information should be added?', sendOrder: 'Send order', creatingCard: 'Creating card…', sendingOrder: 'Sending order…',
    orderNote: 'The email includes the order details and a PNG preview of the selected card.', orderReady: 'The order and card preview are ready to send.',
  },
  ru: {
    language: 'Язык', heroEyebrow: 'Создайте свою визитку', heroTitle: 'Выберите. Настройте.', heroAccent: 'Сразу увидьте.',
    heroText: 'Выберите оформление и шрифты, введите данные, выберите тариф и отправьте готовый вариант одним заказом.', start: 'Начать создание', share: 'Поделиться',
    pricingStep: 'Шаг 1 · тариф', pricingTitle: 'Выберите подписку', pricingHelp: 'Для новых клиентов действует скидка 50% на первый оплаченный период.',
    monthly: 'Месячная', yearly: 'Годовая', perMonth: 'в месяц', perYear: 'в год', firstPayment: 'Первая оплата', afterwards: 'затем', save: 'Скидка 50%', selected: 'Выбрано', choosePlan: 'Выбрать тариф',
    currency: 'Валюта', rateLive: 'Актуальный курс', rateLoading: 'Обновляем цены…', rateError: 'Курсы временно недоступны. Цены показаны в DKK.',
    designStep: 'Шаг 2 · оформление', designTitle: 'Выберите свой стиль', designHelp: 'Нажмите на оформление — предпросмотр изменится сразу.',
    livePreview: 'Живой предпросмотр', digitalCard: 'Цифровая визитка', demoRole: 'Ваша должность · Компания', demoBio: 'Контакты, ссылки и нужная информация всегда под рукой.', call: 'Позвонить', email: 'Email', website: 'Сайт', saveContact: 'Сохранить контакт',
    textStep: 'Шаг 3 · текст и шрифты', textTitle: 'Настройте каждый блок', textHelp: 'Язык каталога и язык визитки настраиваются независимо.',
    cardLanguage: 'Язык визитки', cardLanguageHelp: 'Меняет только надписи на готовой визитке.', fullName: 'Имя на визитке', role: 'Должность или компания',
    headingFont: 'Шрифт имени', secondaryFont: 'Шрифт должности', bodyFont: 'Шрифт описания', contactFont: 'Шрифт контактов и кнопки',
    orderStep: 'Шаг 4 · заказ', orderTitle: 'Отправьте выбранный вариант', orderHelp: 'Настройки, тариф и PNG-карточка автоматически попадут в письмо.',
    customerName: 'Ваше имя *', customerNamePlaceholder: 'Как к вам обращаться?', customerEmail: 'Email для ответа *', customerContact: 'Телефон, WhatsApp или Telegram',
    contactPlaceholder: 'Например, +45… или @username', comment: 'Комментарий', commentPlaceholder: 'Какие контакты и информацию добавить?', sendOrder: 'Отправить заказ', creatingCard: 'Создаём карточку…', sendingOrder: 'Отправляем заказ…',
    orderNote: 'В письмо попадут параметры заказа и PNG-картинка выбранной визитки.', orderReady: 'Заказ и изображение карточки подготовлены к отправке.',
  },
  da: {
    language: 'Sprog', heroEyebrow: 'Byg dit digitale visitkort', heroTitle: 'Vælg. Tilpas.', heroAccent: 'Se det med det samme.',
    heroText: 'Vælg design og skrifttyper, indtast dine oplysninger, vælg abonnement og send det færdige forslag i én bestilling.', start: 'Start oprettelse', share: 'Del',
    pricingStep: 'Trin 1 · abonnement', pricingTitle: 'Vælg dit abonnement', pricingHelp: 'Nye kunder får 50 % rabat på den første betalingsperiode.',
    monthly: 'Månedligt', yearly: 'Årligt', perMonth: 'pr. måned', perYear: 'pr. år', firstPayment: 'Første betaling', afterwards: 'derefter', save: 'Spar 50 %', selected: 'Valgt', choosePlan: 'Vælg abonnement',
    currency: 'Valuta', rateLive: 'Aktuel kurs', rateLoading: 'Opdaterer priser…', rateError: 'Aktuelle kurser er midlertidigt utilgængelige. Priser vises i DKK.',
    designStep: 'Trin 2 · design', designTitle: 'Vælg din stil', designHelp: 'Tryk på et design, så opdateres forhåndsvisningen med det samme.',
    livePreview: 'Live forhåndsvisning', digitalCard: 'Digitalt visitkort', demoRole: 'Din titel · Virksomhed', demoBio: 'Kontakter, links og nyttige oplysninger — altid lige ved hånden.', call: 'Ring', email: 'E-mail', website: 'Hjemmeside', saveContact: 'Gem kontakt',
    textStep: 'Trin 3 · tekst og skrifter', textTitle: 'Tilpas hver blok', textHelp: 'Katalogsprog og visitkortsprog er separate indstillinger.',
    cardLanguage: 'Visitkortets sprog', cardLanguageHelp: 'Styrer kun teksterne på det færdige visitkort.', fullName: 'Navn på visitkortet', role: 'Titel eller virksomhed',
    headingFont: 'Skrifttype til navn', secondaryFont: 'Skrifttype til titel', bodyFont: 'Skrifttype til beskrivelse', contactFont: 'Skrifttype til kontakter og knap',
    orderStep: 'Trin 4 · bestilling', orderTitle: 'Send dit valgte forslag', orderHelp: 'Indstillinger, abonnement og PNG-forhåndsvisning vedhæftes e-mailen.',
    customerName: 'Dit navn *', customerNamePlaceholder: 'Hvad skal vi kalde dig?', customerEmail: 'E-mail til svar *', customerContact: 'Telefon, WhatsApp eller Telegram',
    contactPlaceholder: 'For eksempel +45… eller @brugernavn', comment: 'Kommentar', commentPlaceholder: 'Hvilke kontakter og oplysninger skal tilføjes?', sendOrder: 'Send bestilling', creatingCard: 'Opretter kort…', sendingOrder: 'Sender bestilling…',
    orderNote: 'E-mailen indeholder bestillingsdetaljer og en PNG-forhåndsvisning.', orderReady: 'Bestillingen og forhåndsvisningen er klar til afsendelse.',
  },
  de: {
    language: 'Sprache', heroEyebrow: 'Erstellen Sie Ihre digitale Visitenkarte', heroTitle: 'Wählen. Anpassen.', heroAccent: 'Sofort ansehen.',
    heroText: 'Wählen Sie Design und Schriftarten, geben Sie Ihre Daten ein, wählen Sie einen Tarif und senden Sie den fertigen Entwurf in einer Bestellung.', start: 'Jetzt erstellen', share: 'Teilen',
    pricingStep: 'Schritt 1 · Tarif', pricingTitle: 'Wählen Sie Ihr Abonnement', pricingHelp: 'Neukunden erhalten 50 % Rabatt auf den ersten Abrechnungszeitraum.',
    monthly: 'Monatlich', yearly: 'Jährlich', perMonth: 'pro Monat', perYear: 'pro Jahr', firstPayment: 'Erste Zahlung', afterwards: 'danach', save: '50 % sparen', selected: 'Ausgewählt', choosePlan: 'Tarif wählen',
    currency: 'Währung', rateLive: 'Aktueller Kurs', rateLoading: 'Preise werden aktualisiert…', rateError: 'Live-Kurse sind vorübergehend nicht verfügbar. Preise werden in DKK angezeigt.',
    designStep: 'Schritt 2 · Design', designTitle: 'Wählen Sie Ihren Stil', designHelp: 'Tippen Sie auf ein Design – die Vorschau wird sofort aktualisiert.',
    livePreview: 'Live-Vorschau', digitalCard: 'Digitale Visitenkarte', demoRole: 'Ihre Position · Unternehmen', demoBio: 'Kontakte, Links und wichtige Informationen — immer griffbereit.', call: 'Anrufen', email: 'E-Mail', website: 'Webseite', saveContact: 'Kontakt speichern',
    textStep: 'Schritt 3 · Text und Schriften', textTitle: 'Jeden Block anpassen', textHelp: 'Katalogsprache und Kartensprache sind getrennte Einstellungen.',
    cardLanguage: 'Sprache der Visitenkarte', cardLanguageHelp: 'Steuert nur die Beschriftungen der fertigen Visitenkarte.', fullName: 'Name auf der Karte', role: 'Position oder Unternehmen',
    headingFont: 'Schriftart des Namens', secondaryFont: 'Schriftart der Position', bodyFont: 'Schriftart der Beschreibung', contactFont: 'Schriftart für Kontakte und Schaltfläche',
    orderStep: 'Schritt 4 · Bestellung', orderTitle: 'Ausgewählten Entwurf senden', orderHelp: 'Einstellungen, Tarif und PNG-Vorschau werden an die E-Mail angehängt.',
    customerName: 'Ihr Name *', customerNamePlaceholder: 'Wie dürfen wir Sie ansprechen?', customerEmail: 'E-Mail für Antwort *', customerContact: 'Telefon, WhatsApp oder Telegram',
    contactPlaceholder: 'Zum Beispiel +45… oder @benutzername', comment: 'Kommentar', commentPlaceholder: 'Welche Kontakte und Informationen sollen hinzugefügt werden?', sendOrder: 'Bestellung senden', creatingCard: 'Karte wird erstellt…', sendingOrder: 'Bestellung wird gesendet…',
    orderNote: 'Die E-Mail enthält die Bestelldaten und eine PNG-Vorschau.', orderReady: 'Bestellung und Kartenvorschau sind versandbereit.',
  },
  ka: {
    language: 'ენა', heroEyebrow: 'შექმენით ციფრული სავიზიტო ბარათი', heroTitle: 'აირჩიეთ. მოარგეთ.', heroAccent: 'მაშინვე ნახეთ.',
    heroText: 'აირჩიეთ დიზაინი და შრიფტები, შეიყვანეთ მონაცემები, აირჩიეთ ტარიფი და გააგზავნეთ მზა ვარიანტი ერთ შეკვეთაში.', start: 'შექმნის დაწყება', share: 'გაზიარება',
    pricingStep: 'ნაბიჯი 1 · ტარიფი', pricingTitle: 'აირჩიეთ გამოწერა', pricingHelp: 'ახალი მომხმარებლები პირველ გადახდის პერიოდზე იღებენ 50%-იან ფასდაკლებას.',
    monthly: 'თვიური', yearly: 'წლიური', perMonth: 'თვეში', perYear: 'წელიწადში', firstPayment: 'პირველი გადახდა', afterwards: 'შემდეგ', save: '50% ფასდაკლება', selected: 'არჩეულია', choosePlan: 'ტარიფის არჩევა',
    currency: 'ვალუტა', rateLive: 'აქტუალური კურსი', rateLoading: 'ფასები ახლდება…', rateError: 'აქტუალური კურსები დროებით მიუწვდომელია. ფასები ნაჩვენებია DKK-ში.',
    designStep: 'ნაბიჯი 2 · დიზაინი', designTitle: 'აირჩიეთ თქვენი სტილი', designHelp: 'დააჭირეთ ნებისმიერ დიზაინს და გადახედვა მაშინვე განახლდება.',
    livePreview: 'ცოცხალი გადახედვა', digitalCard: 'ციფრული სავიზიტო ბარათი', demoRole: 'თქვენი პოზიცია · კომპანია', demoBio: 'კონტაქტები, ბმულები და საჭირო ინფორმაცია — ყოველთვის ხელთ.', call: 'დარეკვა', email: 'ელფოსტა', website: 'ვებსაიტი', saveContact: 'კონტაქტის შენახვა',
    textStep: 'ნაბიჯი 3 · ტექსტი და შრიფტები', textTitle: 'მოარგეთ თითოეული ბლოკი', textHelp: 'კატალოგისა და სავიზიტო ბარათის ენები ცალ-ცალკე იმართება.',
    cardLanguage: 'სავიზიტო ბარათის ენა', cardLanguageHelp: 'ცვლის მხოლოდ მზა ბარათის წარწერებს.', fullName: 'სახელი ბარათზე', role: 'პოზიცია ან კომპანია',
    headingFont: 'სახელის შრიფტი', secondaryFont: 'პოზიციის შრიფტი', bodyFont: 'აღწერის შრიფტი', contactFont: 'კონტაქტებისა და ღილაკის შრიფტი',
    orderStep: 'ნაბიჯი 4 · შეკვეთა', orderTitle: 'გააგზავნეთ არჩეული ვარიანტი', orderHelp: 'პარამეტრები, ტარიფი და PNG გადახედვა ელფოსტას დაერთვება.',
    customerName: 'თქვენი სახელი *', customerNamePlaceholder: 'როგორ მოგმართოთ?', customerEmail: 'საპასუხო ელფოსტა *', customerContact: 'ტელეფონი, WhatsApp ან Telegram',
    contactPlaceholder: 'მაგალითად +45… ან @username', comment: 'კომენტარი', commentPlaceholder: 'რომელი კონტაქტები და ინფორმაცია დავამატოთ?', sendOrder: 'შეკვეთის გაგზავნა', creatingCard: 'ბარათი იქმნება…', sendingOrder: 'შეკვეთა იგზავნება…',
    orderNote: 'ელფოსტაში იქნება შეკვეთის დეტალები და PNG გადახედვა.', orderReady: 'შეკვეთა და ბარათის გადახედვა მზადაა გასაგზავნად.',
  },
};

export function catalogText(language) {
  return translations[language] || translations.en;
}

export function detectCatalogLanguage() {
  const stored = localStorage.getItem('scanme_catalog_language');
  if (catalogLanguages.some((language) => language.id === stored)) return stored;
  const candidates = Array.isArray(navigator.languages) && navigator.languages.length ? navigator.languages : [navigator.language];
  for (const candidate of candidates) {
    const base = String(candidate || '').toLowerCase().split('-')[0];
    if (catalogLanguages.some((language) => language.id === base)) return base;
  }
  return 'en';
}

export function saveCatalogLanguage(language) {
  if (catalogLanguages.some((item) => item.id === language)) localStorage.setItem('scanme_catalog_language', language);
}

export async function fetchCatalogRates() {
  const [fiatResponse, cryptoResponse] = await Promise.all([
    fetch('https://open.er-api.com/v6/latest/DKK', { cache: 'no-store' }),
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,tron&vs_currencies=dkk&include_last_updated_at=true', { cache: 'no-store' }),
  ]);
  if (!fiatResponse.ok || !cryptoResponse.ok) throw new Error('RATE_REQUEST_FAILED');
  const [fiat, crypto] = await Promise.all([fiatResponse.json(), cryptoResponse.json()]);
  if (!fiat.rates?.EUR || !fiat.rates?.USD || !fiat.rates?.RUB || !crypto.bitcoin?.dkk || !crypto.tron?.dkk) throw new Error('RATE_DATA_INVALID');
  return {
    rates: { DKK: 1, EUR: fiat.rates.EUR, USD: fiat.rates.USD, RUB: fiat.rates.RUB, BTC: 1 / crypto.bitcoin.dkk, TRX: 1 / crypto.tron.dkk },
    updatedAt: new Date(Math.max((crypto.bitcoin.last_updated_at || 0) * 1000, (fiat.time_last_update_unix || 0) * 1000, Date.now() - 60000)).toISOString(),
  };
}

export function formatCatalogPrice(dkkAmount, currency, rates, language = 'en') {
  if (currency !== 'DKK' && !rates[currency]) return '…';
  const value = dkkAmount * rates[currency];
  if (currency === 'BTC') return `${value.toFixed(8)} BTC`;
  if (currency === 'TRX') return `${value.toFixed(4)} TRX`;
  const locale = { en: 'en-GB', ru: 'ru-RU', da: 'da-DK', de: 'de-DE', ka: 'ka-GE' }[language] || 'en-GB';
  return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}
