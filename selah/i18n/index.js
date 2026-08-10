/**
 * App i18n — 产品默认英文；用户可在设置切换
 */
import { createI18n } from 'vue-i18n'
import zh from './locales/zh.js'
import en from './locales/en.js'
import es from './locales/es.js'
import pt from './locales/pt.js'
import ja from './locales/ja.js'
import ko from './locales/ko.js'
import { getCurrentLanguage, setCurrentLanguage } from '@/utils/storageKeys.js'

const SUPPORTED = ['en', 'zh', 'es', 'pt', 'ja', 'ko']

const getDefaultLocale = () => {
  try {
    const savedLocale = getCurrentLanguage()
    if (savedLocale && SUPPORTED.includes(savedLocale)) return savedLocale
  } catch (e) {}
  return 'en'
}

const i18n = createI18n({
  locale: getDefaultLocale(),
  fallbackLocale: 'en',
  messages: {
    zh,
    en,
    es,
    pt,
    ja,
    ko
  },
  legacy: false,
  globalInjection: true
})

export default i18n

export function setLocale(locale) {
  const next = SUPPORTED.includes(locale) ? locale : 'en'
  i18n.global.locale.value = next
  setCurrentLanguage(next)
}

export function getLocale() {
  return i18n.global.locale.value
}

export function t(key, params = {}) {
  return i18n.global.t(key, params)
}
