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

/** 解析成支持的 UI 语言；无法识别返回 ''（区别于 normalizeUiLocale：这里不做 en 兜底） */
export function parseUiLocale(raw) {
  const s = String(raw || '').trim().toLowerCase().replace(/_/g, '-')
  if (!s) return ''
  if (UI_LOCALES.includes(s)) return s
  const base = s.split('-')[0]
  if (UI_LOCALES.includes(base)) return base
  return ''
}

function normalizeUiLocale(raw) {
  return parseUiLocale(raw) || 'en'
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

/**
 * 全局语言以服务端 user.system_lang 为准：
 * 冷启 / 登录拿到用户资料后调用，立即生效并落到本地，换设备也一致。
 * 服务端没给值时不覆盖本地选择。
 * @returns {string} 生效后的语言
 */
export function syncLocaleFromUser(user) {
  const u = user && typeof user === 'object' ? user : {}
  const next = parseUiLocale(u.system_lang || u.language || u.locale)
  if (!next) return getLocale()
  if (getLocale() !== next) setLocale(next)
  return next
}

/**
 * App 真机上 vue-i18n named 插值常会失效，文案会原样留下 {name}/{brand}。
 * 直接读 locale 字典再手动替换，不依赖 vue-i18n 的编译插值。
 */
function getRawMessage(key) {
  const k = String(key || '')
  if (!k) return ''
  try {
    const locale = i18n.global.locale.value
    const localMsgs = i18n.global.getLocaleMessage(locale) || {}
    if (typeof localMsgs[k] === 'string') return localMsgs[k]
    const enMsgs = i18n.global.getLocaleMessage('en') || {}
    if (typeof enMsgs[k] === 'string') return enMsgs[k]
  } catch (e) {}
  try {
    const msgs = i18n.global.messages.value
    const locale = i18n.global.locale.value
    const local = msgs?.[locale]?.[k]
    if (typeof local === 'string') return local
    const en = msgs?.en?.[k]
    if (typeof en === 'string') return en
  } catch (e) {}
  return ''
}

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

export function t(key, params = {}) {
  const raw = getRawMessage(key)
  if (raw) return interpolateMessage(raw, params)
  let out
  try {
    out = i18n.global.t(key)
  } catch (e) {
    out = key
  }
  return interpolateMessage(String(out ?? key), params)
}
