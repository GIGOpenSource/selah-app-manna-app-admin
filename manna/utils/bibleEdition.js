import { getLocale } from '@/i18n/index.js'
import { getCurrentLanguage } from '@/utils/storageKeys.js'
import { apiBibleTranslations } from '@/api/bible.js'

export const ENGLISH_EDITION = 'web'

/**
 * 经文语言文字键：与全局界面语言（settings / 服务端 system_lang）**解耦**。
 * 只定一次并固定，之后在 settings 切全局语言不会把读经页一起翻掉。
 */
const SCRIPTURE_LOCALE_KEY = 'manna_scripture_locale'

function normalizeLocale(raw) {
	const s = String(raw || '').trim().toLowerCase().replace(/_/g, '-')
	if (!s) return ''
	if (s.startsWith('zh')) return 'zh'
	if (s.startsWith('pt')) return 'pt'
	if (s.startsWith('es')) return 'es'
	if (s.startsWith('ja')) return 'ja'
	if (s.startsWith('ko')) return 'ko'
	if (s.startsWith('en')) return 'en'
	const base = s.split('-')[0]
	return base || ''
}

/** 软件里选中的**全局界面**语言（settings 切换 / 服务端 system_lang） */
export function appContentLocale() {
	return normalizeLocale(getLocale() || getCurrentLanguage() || 'en') || 'en'
}

function readScriptureLocale() {
	try {
		return normalizeLocale(uni.getStorageSync(SCRIPTURE_LOCALE_KEY) || '')
	} catch (e) {
		return ''
	}
}

/**
 * 经文要显示的语言 —— 与全局语言解耦。
 *
 * 首次（含老版本升级后第一次进读经页）按当时的界面语言定一次并固定，
 * 之后 settings 里切全局语言不再改写译本、也不再自动机翻正文。
 * 读经页内部想换语言，走 setScriptureLocale()。
 */
export function scriptureLocale() {
	const saved = readScriptureLocale()
	if (saved) return saved
	const init = appContentLocale() || 'en'
	try { uni.setStorageSync(SCRIPTURE_LOCALE_KEY, init) } catch (e) {}
	return init
}

/** 明确指定经文语言（读经页内主动选择时用），返回规范化后的语言码 */
export function setScriptureLocale(raw) {
	const next = normalizeLocale(raw)
	if (!next) return scriptureLocale()
	try { uni.setStorageSync(SCRIPTURE_LOCALE_KEY, next) } catch (e) {}
	return next
}

function editionCode(row) {
	return String(row?.code || row?.translation_code || row?.translation || '').trim()
}

function editionLang(row) {
	const raw = String(row?.language || row?.lang || '')
		.trim()
		.toLowerCase()
		.replace(/_/g, '-')
	if (!raw) return ''
	if (raw.startsWith('zh')) return 'zh'
	if (raw.startsWith('pt')) return 'pt'
	if (raw.startsWith('es')) return 'es'
	if (raw.startsWith('ja')) return 'ja'
	if (raw.startsWith('ko')) return 'ko'
	if (raw.startsWith('en')) return 'en'
	return raw.split('-')[0]
}

/**
 * 译本列表里优先用软件语言；没有对应语言时用英文 WEB。
 * @param {Array} rows
 * @param {string} locale
 */
export function pickBibleTranslationCode(rows, locale) {
	const picked = pickBibleEdition(rows, locale)
	return picked.code
}

/** @returns {{ code: string, matched: boolean }} matched 表示正文本身已是目标语言 */
export function pickBibleEdition(rows, locale) {
	const list = (Array.isArray(rows) ? rows : []).filter((row) => {
		if (!row || row.enabled === false) return false
		return !!editionCode(row)
	})
	const want = String(locale || scriptureLocale() || 'en').toLowerCase()
	if (want && want !== 'en') {
		const hit = list.find((row) => editionLang(row) === want)
		if (hit) return { code: editionCode(hit), matched: true }
	}
	const web = list.find((row) => editionCode(row).toLowerCase() === ENGLISH_EDITION)
	if (web) return { code: editionCode(web), matched: want === 'en' }
	const en = list.find((row) => editionLang(row) === 'en')
	if (en) return { code: editionCode(en), matched: want === 'en' }
	return { code: ENGLISH_EDITION, matched: want === 'en' }
}

export async function resolveBibleTranslationCode(locale) {
	const want = locale || scriptureLocale()
	try {
		const res = await apiBibleTranslations()
		const rows = res?.results || res?.data || []
		return pickBibleEdition(rows, want)
	} catch (e) {
		return { code: ENGLISH_EDITION, matched: want === 'en' }
	}
}
