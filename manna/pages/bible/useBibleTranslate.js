import { ref, computed } from 'vue'
import { t, getLocale, NATIVE_LANG_LABELS, UI_LOCALES } from '@/i18n/index.js'
import { scriptureLocale } from '@/utils/bibleEdition.js'
import i18n from '@/i18n/index.js'
import { apiBibleTranslate } from '@/api/bible.js'
import { track } from '@/utils/analytics.js'

export function useBibleTranslate({ verses, bookKey, bookName, chapterNum, sheet, closeSheet }) {
	/** verse → 当页内存译文（不落盘、不作为译本保存；换章后按同一目标语重译） */
	const translatedMap = ref({})
	const showTranslated = ref(false)
	/** 用户处于译文模式：换章后自动按同一目标语重译 */
	const translateActive = ref(false)
	const translateBusy = ref(false)
	const translateTarget = ref(getLocale() || 'en')
	const translateEnabled = ref(true)
	let translateSeq = 0
	/** 用户点了「显示原文」后，本章不再自动翻译 */
	let preferOriginal = false
	let preferOriginalLocale = ''

	const GOOGLE_TL = {
		en: 'en',
		zh: 'zh-CN',
		es: 'es',
		pt: 'pt',
		ja: 'ja',
		ko: 'ko',
	}
	
	const LOCALE_ABBR = {
		en: 'EN',
		zh: 'ZH',
		es: 'ES',
		pt: 'PT',
		ja: 'JA',
		ko: 'KO',
	}
	
	const translateLangOptions = computed(() => {
		return UI_LOCALES.map((code) => ({
			code,
			abbr: LOCALE_ABBR[code] || String(code).toUpperCase().slice(0, 2),
			label: NATIVE_LANG_LABELS[code] || code,
		}))
	})
	
	const translateScopeLabel = computed(() => {
		// 始终译整章；勿显示单节以免误解
		return `${bookName.value} ${chapterNum.value}`
	})
	
	const translateHint = computed(() => {
		void i18n.global.locale.value
		const code = String(translateTarget.value || getLocale() || 'en').toLowerCase().split('-')[0]
		const lang = NATIVE_LANG_LABELS[code] || code
		return t('bible_translate_hint', { lang })
	})

	/** 真正存在译文时才为真（换章重译进行中为 false），用于译文署名等展示 */
	const hasTranslated = computed(() => (
		showTranslated.value && Object.keys(translatedMap.value).length > 0
	))
	
	function googleTlCode(locale) {
		const code = String(locale || 'en').toLowerCase().split('-')[0]
		return GOOGLE_TL[code] || 'en'
	}
	
	function verseText(v) {
		if (!v) return ''
		if (showTranslated.value && translatedMap.value[v.verse]) {
			return translatedMap.value[v.verse]
		}
		// 译文模式但当前节尚未译好（换章重译进行中）：不回退英文，避免「先英文、再闪切」
		if (showTranslated.value) return ''
		return v.text || ''
	}
	
	function clearTranslation({ keepMode = false } = {}) {
		translateSeq += 1
		translatedMap.value = {}
		// 译文模式换章：保留译文态，避免切换瞬间回退英文；新章译文就绪前由 verseText 返回占位
		if (!keepMode) {
			showTranslated.value = false
			translateActive.value = false
		}
	}
	
	function normalizeTranslateTarget(raw) {
		const code = String(raw || '').toLowerCase().split('-')[0]
		if (UI_LOCALES.includes(code)) return code
		const fallback = String(getLocale() || 'en').toLowerCase().split('-')[0]
		return UI_LOCALES.includes(fallback) ? fallback : 'en'
	}
	
	function onTranslateTap() {
		if (!verses.value.length) {
			uni.showToast({ title: t('bible_empty'), icon: 'none' })
			return
		}
		if (translateBusy.value) return
		// 记住上次选中的目标语；已译时弹窗也要回显当前语，不要每次重置成界面语言
		translateTarget.value = normalizeTranslateTarget(translateTarget.value)
		sheet.value = 'translate'
	}
	
	function restoreOriginal() {
		preferOriginal = true
		preferOriginalLocale = scriptureLocale()
		translateActive.value = false
		showTranslated.value = false
		closeSheet()
	}

	/** 界面语言不是英文时，默认把本章译成该语言；失败则保持英文原文 */
	function applyDefaultScriptureLanguage(opts = {}) {
		if (opts && typeof opts.preventDefault === 'function') opts = {}
		const locale = scriptureLocale()
		if (preferOriginal && preferOriginalLocale !== locale) preferOriginal = false
		if (preferOriginal || translateEnabled.value === false) return Promise.resolve(false)
		if (opts.nativeEdition || !locale || locale === 'en') {
			showTranslated.value = false
			translateActive.value = false
			translatedMap.value = {}
			return Promise.resolve(false)
		}
		translateTarget.value = locale
		return confirmTranslate({ silent: true, quietFail: true })
	}
	
	async function confirmTranslate(opts = {}) {
		if (opts && typeof opts.preventDefault === 'function') opts = {}
		const silent = !!opts.silent
		const quietFail = !!opts.quietFail
		if (!quietFail) preferOriginal = false
		if (!verses.value.length) return
		const locale = normalizeTranslateTarget(translateTarget.value)
		translateTarget.value = locale
		const tl = googleTlCode(locale)
		const list = verses.value.slice()
		const texts = list.map((v) => String(v.text || ''))
		const reqBook = bookKey.value
		const reqChapter = Number(chapterNum.value) || 1
		const seq = ++translateSeq
		translateActive.value = true
		translateBusy.value = true
		closeSheet()
		uni.showLoading({
			title: t('bible_translate_loading'),
			mask: true,
		})
		if (!silent) {
			track('manna_bible_translate', {
				book: reqBook,
				chapter: reqChapter,
				locale,
				tl,
				scope: 'chapter',
			})
		}
		let pendingToast = null
		try {
			const res = await apiBibleTranslate(
				{
					texts,
					target: tl,
					source: 'auto',
					title: String(bookName.value || '').trim()
						|| String(bookKey.value || '').replace(/^[a-z]/, (c) => c.toUpperCase()),
				},
				{
					// 页面自行 toast，避免 http 层再弹一次
					errorOutput: false,
				},
			)
			// 换章期间旧请求返回：丢弃，避免串章/串译文
			if (seq !== translateSeq || bookKey.value !== reqBook || Number(chapterNum.value) !== reqChapter) {
				return
			}
			const out = (res?.results && res.results.translations) || []
			const map = {}
			list.forEach((v, idx) => {
				const next = out[idx]
				if (next != null && String(next).length) map[v.verse] = String(next)
			})
			if (!Object.keys(map).length) {
				// 译文为空：回落原文，避免译文态下长期空白
				showTranslated.value = false
				translateActive.value = false
				if (!quietFail) pendingToast = { title: t('bible_translate_fail'), icon: 'none' }
				return
			}
			translatedMap.value = map
			showTranslated.value = true
		} catch (e) {
			if (seq !== translateSeq || bookKey.value !== reqBook || Number(chapterNum.value) !== reqChapter) return
			// 异常：回落原文，避免译文态下长期空白
			showTranslated.value = false
			translateActive.value = false
			if (!quietFail) pendingToast = { title: e?.message || t('bible_translate_fail'), icon: 'none' }
		} finally {
			if (seq === translateSeq) {
				translateBusy.value = false
				try { uni.hideLoading() } catch (err) {}
				if (pendingToast) uni.showToast(pendingToast)
			}
		}
	}

	return {
		translatedMap,
		showTranslated,
		hasTranslated,
		translateActive,
		translateBusy,
		translateTarget,
		translateEnabled,
		translateLangOptions,
		translateScopeLabel,
		translateHint,
		verseText,
		clearTranslation,
		onTranslateTap,
		restoreOriginal,
		confirmTranslate,
		applyDefaultScriptureLanguage,
	}
}
