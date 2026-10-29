/**
 * 端内协议正文 — Manna 法务草稿（上架前需法务审定）。
 * 审定后：改 utils/legal/{locale}.js + 后端 legal_views + 文档，三者保持一致。
 */
import en from './legal/en.js'
import zh from './legal/zh.js'
import es from './legal/es.js'
import pt from './legal/pt.js'
import ja from './legal/ja.js'
import ko from './legal/ko.js'
import { getLocale, UI_LOCALES } from '@/i18n/index.js'

const ENTITY = '[Pending legal entity name]'
const SUPPORT = 'support@manna.app'
const EFFECTIVE = 'Effective upon store release (draft)'

const PACKS = { en, zh, es, pt, ja, ko }

function normalizeLocale(raw) {
	const s = String(raw || '').trim().toLowerCase().replace(/_/g, '-')
	if (UI_LOCALES.includes(s)) return s
	const base = s.split('-')[0]
	if (UI_LOCALES.includes(base)) return base
	return 'en'
}

function fill(str) {
	return String(str || '')
		.replace(/\{entity\}/g, ENTITY)
		.replace(/\{support\}/g, SUPPORT)
}

function packFor(locale) {
	const key = normalizeLocale(locale)
	return PACKS[key] || PACKS.en
}

/** @returns {{ slug: string, titleKey: string, fallbackTitle: string, meta: string, sections: Array }} */
export function getLegalDoc(slug, locale) {
	const pack = packFor(locale || getLocale())
	const key = String(slug || 'privacy').toLowerCase()
	const doc = pack[key] || pack.privacy || PACKS.en.privacy
	const resolved = pack[key] ? key : 'privacy'
	return {
		slug: resolved,
		titleKey: doc.titleKey,
		fallbackTitle: doc.fallbackTitle,
		meta: fill(pack.meta || PACKS.en.meta),
		sections: (doc.sections || []).map((sec) => ({
			heading: fill(sec.heading),
			paragraphs: (sec.paragraphs || []).map((p) => fill(p)),
		})),
	}
}

export function listLegalSlugs() {
	return ['privacy', 'terms', 'subscription', 'help']
}

export { ENTITY, SUPPORT, EFFECTIVE }
