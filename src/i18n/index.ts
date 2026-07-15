import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { en } from './en';
import { zh } from './zh';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh }
    },
    lng: 'en', // บังคับให้ภาษาเริ่มต้นเป็นอังกฤษ
    fallbackLng: 'en', // 🌟 จุดสำคัญ: ถ้าหาภาษาอื่นไม่เจอ ให้ดึง 'en' มาใช้เสมอ
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;