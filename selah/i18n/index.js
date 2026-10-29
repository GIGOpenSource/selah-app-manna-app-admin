/**
 * App i18n — 产品默认英文；用户可在设置切换
 *
 * 注意：部分 App 真机上 useI18n().t 的 named 插值会失效（留下 {n}/{date}），
 * 业务侧优先用本文件导出的 t()；其内含手动占位符兜底。
 */
import { createI18n } from 'vue-i18n'
import zh from './locales/zh.js'
import en from './locales/en.js'
import es from './locales/es.js'
import pt from './locales/pt.js'
import ja from './locales/ja.js'
import ko from './locales/ko.js'
import ar from './locales/ar.js'
import ru from './locales/ru.js'
import fr from './locales/fr.js'
import de from './locales/de.js'
import fil from './locales/fil.js'
import it from './locales/it.js'
import { getCurrentLanguage, setCurrentLanguage } from '@/utils/storageKeys.js'
import { applyTextDirection } from '@/utils/textDirection.js'

export const SUPPORTED = ['en', 'zh', 'es', 'pt', 'ja', 'ko', 'ar', 'ru', 'fr', 'de', 'fil', 'it']
const LANG_ALIAS = { tl: 'fil', tgl: 'fil' }

function canonicalizeLocale(locale) {
  const raw = String(locale || '').trim().toLowerCase().replace(/_/g, '-')
  const mapped = LANG_ALIAS[raw] || LANG_ALIAS[raw.split('-')[0]] || raw.split('-')[0] || 'en'
  return SUPPORTED.includes(mapped) ? mapped : 'en'
}

const getDefaultLocale = () => {
  try {
    return canonicalizeLocale(getCurrentLanguage())
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
    ko,
    ar,
    ru,
    fr,
    de,
    fil,
    it,
  },
  legacy: false,
  globalInjection: true,
  missingWarn: false,
  fallbackWarn: false,
})

export default i18n

applyTextDirection(getDefaultLocale())

export function setLocale(locale) {
  const next = canonicalizeLocale(locale)
  i18n.global.locale.value = next
  setCurrentLanguage(next)
  applyTextDirection(next)
  // 延迟 import，避免与 bootstrap ↔ i18n 循环依赖
  import('@/utils/cmsI18n.js').then(({ clearLocaleSensitiveCaches }) => {
    clearLocaleSensitiveCaches()
    return import('@/utils/bootstrap.js')
  }).then((mod) => {
    if (mod && typeof mod.refreshBootstrapCaches === 'function') {
      mod.refreshBootstrapCaches().catch(() => {})
    }
  }).catch(() => {})
  import('@/utils/alarmClock.js').then((mod) => {
    if (mod && typeof mod.syncAndroidAlarmCopy === 'function') mod.syncAndroidAlarmCopy()
  }).catch(() => {})
}

export function getLocale() {
  return i18n.global.locale.value
}

/** 手动替换 {name}，兼容 App 端 vue-i18n named 插值失效 */
export function interpolateMessage(message, params) {
  if (message == null) return ''
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return String(message)
  }
  return String(message).replace(/\{(\w+)\}/g, (all, name) => {
    if (!Object.prototype.hasOwnProperty.call(params, name)) return all
    const v = params[name]
    if (v == null) return all
    return String(v)
  })
}

/**
 * @param {string} key
 * @param {Record<string, any>} [params]
 */
export function t(key, params = {}) {
  let out
  try {
    out = i18n.global.t(key, params)
  } catch (e) {
    out = key
  }
  const s = String(out ?? key)
  if (
    params
    && typeof params === 'object'
    && !Array.isArray(params)
    && /\{[a-zA-Z_]\w*\}/.test(s)
  ) {
    return interpolateMessage(s, params)
  }
  return s
}
