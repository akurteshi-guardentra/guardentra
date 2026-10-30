import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en/translation.json';

// English only for now: the German catalog was partial and the header toggle
// left most screens half-translated.
i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
    },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React already safes from xss
    },
  });

export default i18n;
