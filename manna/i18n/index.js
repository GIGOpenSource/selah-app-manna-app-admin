/**
 * App i18n — 产品默认英文；用户可在设置切换。
 * UI 六语：en / zh / es / pt / ja / ko（与产品文档一致）。
 */
import { createI18n } from 'vue-i18n'
import zh from './locales/zh.js'
import en from './locales/en.js'
import es from './locales/es.js'
import pt from './locales/pt.js'
import ja from './locales/ja.js'
import ko from './locales/ko.js'
import { getCurrentLanguage, setCurrentLanguage } from '@/utils/storageKeys.js'

/** 设置页可选、UI 文案完整的语言 */
export const UI_LOCALES = ['en', 'zh', 'es', 'pt', 'ja', 'ko']

/** 母语名称：不随界面语言变化，避免切换时列表标签来回跳 */
export const NATIVE_LANG_LABELS = {
  en: 'English',
  zh: '中文',
  es: 'Español',
  pt: 'Português',
  ja: '日本語',
  ko: '한국어',
}

export const LANG_PICKER_OPTIONS = UI_LOCALES.map((code) => ({
  code,
  label: NATIVE_LANG_LABELS[code] || code,
}))

function normalizeUiLocale(raw) {
  const s = String(raw || '').trim().toLowerCase().replace(/_/g, '-')
  if (!s) return 'en'
  if (UI_LOCALES.includes(s)) return s
  const base = s.split('-')[0]
  if (UI_LOCALES.includes(base)) return base
  return 'en'
}

const getDefaultLocale = () => {
  try {
    const savedLocale = getCurrentLanguage()
    return normalizeUiLocale(savedLocale)
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
  const next = normalizeUiLocale(locale)
  i18n.global.locale.value = next
  setCurrentLanguage(next)
  return next
}

export function getLocale() {
  return i18n.global.locale.value
}

export function t(key, params = {}) {
  return i18n.global.t(key, params)
}
