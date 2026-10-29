
import { ref, computed, watch, onMounted, getCurrentInstance, nextTick } from 'vue'
import { onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { ensureLogin, getUser, setUser } from '@/utils/session.js'
import { getToken } from '@/utils/storageKeys.js'
import {
	apiBibleBooks,
	apiBibleChapter,
	apiBibleHighlightSave,
	apiBibleHighlights,
	apiBibleReadProgress,
	apiBibleNoteSave,
	apiBibleAmenVerse,
	apiBibleAmenCounts,
	apiBibleSearch,
} from '@/api/bible.js'
import { apiMannaFavoriteToggle } from '@/api/manna.js'
import { host } from '@/config/config.js'
import { track } from '@/utils/analytics.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { useMaskReady } from '@/utils/overlay.js'
import { hideNativeTabBar, setTabUiKey } from '@/utils/tabbar.js'
import { listenSession, listenAudio, pauseOrphanListenAudio, retargetListenChapter } from '@/utils/listenSession.js'
import { readPageCache } from '@/utils/pageCache.js'
import { APP_CONFIG_KEY } from '@/utils/wallpaperCache.js'
import { LISTEN_KEY } from './useBibleAudio.js'
import { correctSpokenDuration } from '@/utils/verseCue.js'
import { scriptureLocale, resolveBibleTranslationCode, ENGLISH_EDITION } from '@/utils/bibleEdition.js'

/** 个人中心高亮/书签点击后，跳回读经页指定书卷·章·节（仅滚动定位，不触发听经态）。 */
const OPEN_REF_KEY = 'manna_bible_open_ref'

export function useBibleReader(hooks = {}) {
	function absolutizeMedia(url) {
		if (!url) return ''
		if (/^https?:\/\//i.test(url)) return url
		const origin = String(host || '').replace(/\/api\/?$/, '')
		return `${origin}${url.startsWith('/') ? '' : '/'}${url}`
	}
	
	const FONT_KEY = 'manna_bible_font_px'
	const FONT_FACE_KEY = 'manna_bible_font_face'
	const THEME_KEY = 'manna_bible_theme'
	const SEARCH_HIST_KEY = 'manna_bible_search_recent'
	const TRANS_KEY = 'manna_bible_translation'
	const PROGRESS_KEY = 'manna_bible_progress'
	const HOLD_CHAPTER_KEY = 'manna_bible_hold_chapter'
	const FONT_STEPS = [14, 16, 18, 20]
	const FONT_FACES = [
		{ id: 'sans', label: 'Sans' },
		{ id: 'serif', label: 'Serif' },
	]
	const THEMES = [
		{ id: 'white' },
		{ id: 'peach' },
		{ id: 'mint' },
		{ id: 'dark' },
	]
	
	const statusBar = getStatusBarPx()
	const tabOn = ref(true)
	const isRead = ref(false)
	const fontPx = ref((() => {
		const raw = Number(uni.getStorageSync(FONT_KEY) || uni.getStorageSync('manna_bible_font_size') || 16)
		// 旧版存的是 rpx(28–40)，迁移到 px(14–20)
		if (raw >= 24) return Math.min(20, Math.max(14, Math.round(raw / 2)))
		return FONT_STEPS.includes(raw) ? raw : 16
	})())
	const themeId = ref(uni.getStorageSync(THEME_KEY) || 'white')
	const fontFace = ref(uni.getStorageSync(FONT_FACE_KEY) || 'sans')
	const searchQ = ref('')
	const searchHits = ref([])
	const searchDone = ref(false)
	const searchRecent = ref([])
	const bookmarkOn = ref(false)
	let sheetTouchY = 0
	const translation = ref(uni.getStorageSync(TRANS_KEY) || ENGLISH_EDITION)
	let editionLocale = ''
	let editionInflight = null
	/** 当前译本正文已经是界面语言，不必再机器翻译 */
	let editionMatched = false

	/** 没有在听时，有对应译本就用；没有则稍后把英文译成界面语言 */
	function alignEditionToAppLanguage() {
		if (listenSession.mini || listenSession.keepAlive) return Promise.resolve(false)
		const locale = scriptureLocale()
		if (editionInflight && editionLocale === locale) return editionInflight
		if (editionLocale === locale) return Promise.resolve(false)
		editionLocale = locale
		editionInflight = (async () => {
			try {
				const picked = await resolveBibleTranslationCode(locale)
				const next = picked?.code || ENGLISH_EDITION
				editionMatched = !!picked?.matched
				if (next === translation.value) return false
				translation.value = next
				try { uni.setStorageSync(TRANS_KEY, next) } catch (e) {}
				return true
			} finally {
				editionInflight = null
			}
		})()
		return editionInflight
	}
	function readSavedProgress() {
		try {
			const p = uni.getStorageSync(PROGRESS_KEY) || {}
			if (!p || typeof p !== 'object' || !p.book_key) return null
			return p
		} catch (e) {
			return null
		}
	}
	const savedProgress = readSavedProgress() || {}
	const bookKey = ref(savedProgress.book_key || 'genesis')
	const bookName = ref(savedProgress.book_name || 'Genesis')
	const chapterNum = ref(Math.max(1, Number(savedProgress.chapter) || 1))
	const chapterCount = ref(1)
	const books = ref([])
	const verses = ref([])
	const audioUrl = ref('')
	const audioDurationSec = ref(0)
	const audioPlaying = ref(false)
	const listeningVerse = ref(0)
	const scrollInto = ref('')
	const loading = ref(false)
	const emptyHint = ref('')
	/** verse → highlight id */
	const highlightMap = ref({})
	const selectedVerse = ref(null)
	const sheet = ref('')
	const sheetMaskReady = useMaskReady(() => !!sheet.value)
	const bookTag = ref('all')
	/** 书卷/章节合并选择器：books 视图选书 → chapters 视图选章 */
	const pickerView = ref('books')
	const pickerBook = ref(null)
	const noteDraft = ref('')
	const noteBusy = ref(false)
	const amenMap = ref({})
	/** verse → 当页内存译文（不落盘、不作为译本保存；换章后按同一目标语重译） */
	const badgeOpen = ref(false)
	const badgeItems = ref([])
	let readStart = Date.now()

	function localDateIso() {
		const d = new Date()
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
	}
	
	function showNewBadges(list) {
		const earned = Array.isArray(list) ? list.filter(Boolean) : []
		if (!earned.length) return
		badgeItems.value = earned
		badgeOpen.value = true
	}
	
	function applyReadGrant(d) {
		showNewBadges(d?.newly_earned)
		const delta = Number(d?.manna_delta || 0)
		if (delta <= 0) return
		uni.showToast({ title: t('manna_granted', { n: delta }), icon: 'none' })
		try {
			const u = getUser() || {}
			if (typeof d.balance === 'number') setUser({ ...u, manna_balance: d.balance })
		} catch (e) {}
	}
	
	function persistReadingPosition() {
		try {
			uni.setStorageSync(PROGRESS_KEY, {
				book_key: bookKey.value,
				book_name: bookName.value,
				chapter: Math.max(1, Number(chapterNum.value) || 1),
				translation: translation.value,
			})
		} catch (e) {}
	}

	function flushReadProgress() {
		const sec = Math.round((Date.now() - readStart) / 1000)
		readStart = Date.now()
		if (sec <= 0) return
		if (!getToken()) return
		apiBibleReadProgress({
			seconds: sec,
			book_key: bookKey.value,
			chapter: chapterNum.value,
			local_date: localDateIso(),
		}).then((res) => {
			applyReadGrant(res?.results || {})
		}).catch(() => {
			if (!getToken()) return
			if (sec >= 60) uni.showToast({ title: t('network_error'), icon: 'none' })
		})
	}
	
	const BOOK_TAG_ORDER = ['ot', 'nt', 'pentateuch', 'gospel']
	const BOOK_TAG_SKIP = new Set(['ot', 'nt', 'old', 'new'])
	
	function tagLabel(id) {
		const map = {
			all: 'bible_all',
			ot: 'bible_ot',
			nt: 'bible_nt',
			pentateuch: 'bible_tag_pentateuch',
			gospel: 'bible_tag_gospel',
		}
		const key = map[id]
		return key ? t(key) : String(id)
	}
	
	function bookMatchesTag(b, id) {
		if (!b) return false
		if (id === 'all') return true
		const testament = String(b.testament || '').toLowerCase()
		const keys = (b.tag_keys || []).map((k) => String(k).toLowerCase())
		if (id === 'ot') {
			return testament === 'ot' || testament === 'old' || keys.includes('ot')
				|| (!testament && !keys.length && (b.order_index || 0) <= 39)
		}
		if (id === 'nt') {
			return testament === 'nt' || testament === 'new' || keys.includes('nt')
				|| (!testament && !keys.length && (b.order_index || 0) > 39)
		}
		return keys.includes(String(id).toLowerCase())
	}
	
	const bookmarkActive = computed(() => bookmarkOn.value)
	
	const readerFace = computed(() => (
		fontFace.value === 'serif'
			? 'Forum, "Times New Roman", Georgia, serif'
			: 'Lexend, "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif'
	))
	
	const readerFaceStyle = computed(() => ({
		fontSize: fontPx.value + 'px',
		lineHeight: Math.round(fontPx.value * 1.75) + 'px',
		fontFamily: readerFace.value,
	}))
	
	const previewFaceStyle = computed(() => ({
		fontFamily: readerFace.value,
		fontSize: fontPx.value + 'px',
	}))
	
	const pageChromeStyle = computed(() => ({
		paddingTop: statusBar + 'px',
		'--reader-size': fontPx.value + 'px',
		'--reader-face': readerFace.value,
	}))
	
	const bookTags = computed(() => {
		const list = books.value || []
		if (!list.length) return []
		const tags = [{ id: 'all', label: tagLabel('all') }]
		BOOK_TAG_ORDER.forEach((id) => {
			if (list.some((b) => bookMatchesTag(b, id))) {
				tags.push({ id, label: tagLabel(id) })
			}
		})
		const extras = new Set()
		list.forEach((b) => {
			;(b.tag_keys || []).forEach((raw) => {
				const id = String(raw || '').toLowerCase()
				if (!id || BOOK_TAG_SKIP.has(id) || BOOK_TAG_ORDER.includes(id)) return
				extras.add(id)
			})
		})
		Array.from(extras).sort().forEach((id) => {
			if (list.some((b) => bookMatchesTag(b, id))) {
				tags.push({ id, label: tagLabel(id) })
			}
		})
		return tags
	})
	
	const filteredBooks = computed(() => {
		const tag = bookTag.value || 'all'
		if (tag === 'all') return books.value
		return books.value.filter((b) => bookMatchesTag(b, tag))
	})
	
	function ensureBookTag() {
		const ids = bookTags.value.map((tg) => tg.id)
		if (!ids.includes(bookTag.value)) bookTag.value = ids[0] || 'all'
	}
	
	const chapterNums = computed(() => {
		const n = Math.max(1, Number(chapterCount.value) || 1)
		return Array.from({ length: n }, (_, i) => i + 1)
	})

	const pickerBookName = computed(() => (
		pickerBook.value?.name || pickerBook.value?.book_key || ''
	))

	/** 选择器内章节数取自书卷列表的 chapter_count，切卷时无需额外请求 */
	const pickerChapterNums = computed(() => {
		const book = pickerBook.value
		const n = Math.max(
			1,
			Number(book?.chapter_count) || (book?.book_key === bookKey.value ? Number(chapterCount.value) : 0) || 1
		)
		return Array.from({ length: n }, (_, i) => i + 1)
	})

	/** 章节高亮只在「选择器里的书 == 正在读的书」时生效，避免切卷后误标章号 */
	const pickerOnCurrentBook = computed(() => (
		!!pickerBook.value?.book_key && String(pickerBook.value.book_key) === String(bookKey.value || '')
	))

	function resetPicker() {
		pickerView.value = 'books'
		pickerBook.value = null
	}

	function closeSheet() {
		sheet.value = ''
		selectedVerse.value = null
		resetPicker()
	}
	
	function noop() {}
	
	function onMaskClose() {
		if (!sheetMaskReady.value) return
		closeSheet()
	}
	
	function openFont() {
		sheet.value = 'font'
	}
	
	function loadSearchRecent() {
		try {
			const rows = uni.getStorageSync(SEARCH_HIST_KEY)
			searchRecent.value = Array.isArray(rows) ? rows.filter(Boolean).slice(0, 8) : []
		} catch (e) {
			searchRecent.value = []
		}
	}

	function pushSearchRecent(q) {
		const s = String(q || '').trim()
		if (s.length < 2) return
		const next = [s, ...searchRecent.value.filter((x) => x !== s)].slice(0, 8)
		searchRecent.value = next
		try {
			uni.setStorageSync(SEARCH_HIST_KEY, next)
		} catch (e) {}
	}

	function removeSearchRecent(q) {
		searchRecent.value = searchRecent.value.filter((x) => x !== q)
		try {
			uni.setStorageSync(SEARCH_HIST_KEY, searchRecent.value)
		} catch (e) {}
	}

	function clearSearchRecent() {
		searchRecent.value = []
		try {
			uni.removeStorageSync(SEARCH_HIST_KEY)
		} catch (e) {}
	}

	function pickSearchRecent(q) {
		searchQ.value = q
		runSearch()
	}

	function highlightSearchParts(text) {
		const raw = String(text || '')
		const q = String(searchQ.value || '').trim()
		if (!q || q.length < 2) return [{ t: raw, em: false }]
		const lower = raw.toLowerCase()
		const needle = q.toLowerCase()
		const parts = []
		let i = 0
		while (i < raw.length) {
			const hit = lower.indexOf(needle, i)
			if (hit < 0) {
				parts.push({ t: raw.slice(i), em: false })
				break
			}
			if (hit > i) parts.push({ t: raw.slice(i, hit), em: false })
			parts.push({ t: raw.slice(hit, hit + needle.length), em: true })
			i = hit + needle.length
		}
		return parts.length ? parts : [{ t: raw, em: false }]
	}
	
	function openSearch() {
		searchQ.value = ''
		searchHits.value = []
		searchDone.value = false
		loadSearchRecent()
		sheet.value = 'search'
	}

	function onSearchInput(e) {
		searchQ.value = e?.detail?.value ?? e?.target?.value ?? (typeof e === 'string' ? e : '')
	}
	
	function onSheetTouchStart(e) {
		sheetTouchY = e.changedTouches?.[0]?.clientY || 0
	}
	
	function onSheetTouchEnd(e) {
		const y = e.changedTouches?.[0]?.clientY || 0
		if (y - sheetTouchY > 48) closeSheet()
	}
	
	function setFontFace(id) {
		fontFace.value = id
		uni.setStorageSync(FONT_FACE_KEY, id)
	}
	
	function openBooks() {
		const show = () => {
			ensureBookTag()
			resetPicker()
			sheet.value = 'books'
		}
		if (!books.value.length) loadBooks().then(show)
		else show()
	}

	/** 列表按钮：直接进同一选择器，并停在当前书卷的章节视图 */
	function openChapters() {
		const show = () => {
			ensureBookTag()
			pickerBook.value = books.value.find((b) => b.book_key === bookKey.value) || {
				book_key: bookKey.value,
				name: bookName.value,
				chapter_count: Math.max(1, Number(chapterCount.value) || 1),
			}
			pickerView.value = 'chapters'
			sheet.value = 'books'
		}
		if (!books.value.length) loadBooks().then(show)
		else show()
	}

	/** 选择器内点书卷：不立即请求正文，先展示该书的章节 */
	function pickBook(b) {
		if (!b) return
		pickerBook.value = {
			book_key: b.book_key,
			name: b.name || b.book_key,
			chapter_count: Math.max(1, Number(b.chapter_count) || 1),
		}
		pickerView.value = 'chapters'
	}

	function backToBooks() {
		pickerView.value = 'books'
		pickerBook.value = null
	}
	
	function setFont(sz) {
		fontPx.value = sz
		uni.setStorageSync(FONT_KEY, sz)
	}
	
	function setTheme(id) {
		themeId.value = id
		uni.setStorageSync(THEME_KEY, id)
	}
	
	const segTrackStyle = { flexDirection: 'row', width: '100%' }
	const segGrowStyle = { flexDirection: 'row', flexGrow: 1, flexShrink: 1, flexBasis: '0%' }
	
	function segBtnStyle(on, width) {
		return {
			width,
			backgroundColor: on ? '#212121' : 'transparent',
		}
	}
	
	function segTxtStyle(on) {
		return { color: on ? '#ffffff' : '#212121' }
	}
	
	async function loadBooks() {
		try {
			const booksRes = await apiBibleBooks({ translation: translation.value })
			books.value = booksRes?.results || []
			if (!books.value.length) return
			const cur = books.value.find((b) => b.book_key === bookKey.value) || books.value[0]
			bookKey.value = cur.book_key
			bookName.value = cur.name || cur.book_key
			chapterCount.value = Math.max(1, Number(cur.chapter_count) || 1)
			ensureBookTag()
		} catch (e) {}
	}
	

	let syncingFromListen = false
	let syncInflight = null
	let retargetGen = 0

	function listenReaderSameChapter() {
		return String(listenSession.bookKey || '') === String(bookKey.value || '')
			&& Number(listenSession.chapter) === Math.max(1, Number(chapterNum.value) || 1)
	}

	/**
	 * 听经音频是否还活着。以「播放器实例还在」为准，
	 * 不能只看 listenSession.mini —— 小卡标记和实际播放状态会脱节
	 * （H5 浏览器返回没走 onBackPress 时 mini 仍是 false，声音却还在响）。
	 */
	function listenSessionAlive() {
		return !!listenSession.mini || !!listenSession.keepAlive || !!listenAudio.inner
	}

	/**
	 * 正文换章后，仍在播的听经音频必须跟过去，否则就是「一边读第 5 章、一边放第 1 章」。
	 * 由 loadChapter 统一兜底，覆盖所有换章入口；loadReaderChapter 自己已经处理过，不重复。
	 */
	function followListenAudioToChapter() {
		if (!listenSessionAlive()) return null
		if (listenAudio.readerRetarget || syncingFromListen) return null
		if (listenReaderSameChapter()) return null
		const gen = ++retargetGen
		listenAudio.readerRetarget = true
		listeningVerse.value = 0
		return Promise.resolve(
			retargetListenChapter({
				bookKey: bookKey.value,
				bookName: bookName.value,
				chapter: Math.max(1, Number(chapterNum.value) || 1),
				translation: translation.value,
				src: audioUrl.value,
				durationSec: audioDurationSec.value,
				play: !!listenSession.playing,
				isStale: () => gen !== retargetGen,
			}),
		)
			.catch(() => {})
			.finally(() => {
				if (gen !== retargetGen) return
				listenAudio.readerRetarget = false
				setTimeout(() => {
					if (gen !== retargetGen) return
					listenAudio.suppressEnd = false
				}, 500)
			})
	}

	function mediaChapter(url) {
		const path = decodeURIComponent(String(url || '').split('?')[0])
		const m = path.match(/\/(\d{1,3})\.mp3$/i)
		return m ? Number(m[1]) : 0
	}

	/** 音源章号和正文不一致时才换文件；地址对不上当前章则不动，避免用上一章的 url 覆盖 */
	async function alignListenFile() {
		if (!listenSessionAlive() || !audioUrl.value) return
		const fileChapter = mediaChapter(audioUrl.value)
		const want = Math.max(1, Number(chapterNum.value) || 1)
		if (fileChapter && fileChapter !== want) return
		await retargetListenChapter({
			bookKey: bookKey.value,
			bookName: bookName.value,
			chapter: want,
			translation: translation.value,
			src: audioUrl.value,
			durationSec: audioDurationSec.value,
			keepPosition: true,
			onlyIfChapterDiffers: true,
		})
	}

	/** 小卡还在、且用户换了章：先挡住跟播，等正文载入后再把音频切过去 */
	function armListenRetarget() {
		if (!listenSessionAlive() || syncingFromListen || listenReaderSameChapter()) return false
		listenAudio.readerRetarget = true
		listenAudio.resumeAfterRetarget = !!listenSession.playing
		listeningVerse.value = 0
		return true
	}

	async function readChapterForEdition() {
		const preferred = translation.value || ENGLISH_EDITION
		const order = [preferred]
		if (String(order[0]).toLowerCase() !== ENGLISH_EDITION) order.push(ENGLISH_EDITION)
		let lastErr = null
		for (const code of order) {
			translation.value = code || ENGLISH_EDITION
			try {
				await loadBooks()
				const maxCh = Math.max(1, Number(chapterCount.value) || 1)
				if (Number(chapterNum.value) > maxCh) chapterNum.value = maxCh
				const res = await apiBibleChapter({
					translation: translation.value,
					book: bookKey.value,
					chapter: chapterNum.value,
				})
				const d = res?.results || {}
				const rows = d.verses || []
				if (rows.length || String(translation.value).toLowerCase() === ENGLISH_EDITION) {
					if (String(translation.value).toLowerCase() !== String(preferred).toLowerCase()) {
						editionMatched = false
					}
					if (rows.length) {
						try { uni.setStorageSync(TRANS_KEY, translation.value) } catch (e) {}
					}
					return d
				}
			} catch (e) {
				lastErr = e
				if (String(translation.value).toLowerCase() === ENGLISH_EDITION) throw e
			}
		}
		if (lastErr) throw lastErr
		return { verses: [] }
	}

	async function loadChapter() {
		loading.value = true
		emptyHint.value = ''
		hooks.stopAudio()
		const keepTranslate = hooks.translateActive.value
		try {
			const d = await readChapterForEdition()
			isRead.value = d.chapter_done || false
			const newVerses = d.verses || []
			// 译文模式：保持当前章译文与内容不变，待新章译文就绪后整体切换，
			// 避免「先英文、再闪切」。清空旧译文映射但保留译文态（verseText 在未译好时返回占位）。
			hooks.clearTranslation({ keepMode: keepTranslate })
			verses.value = newVerses
			const maleUrl = absolutizeMedia(d.audio_url_male || '')
			const femaleUrl = absolutizeMedia(d.audio_url_female || '')
			const legacyUrl = absolutizeMedia(d.audio_url || '')
			let male = maleUrl
			let female = femaleUrl
			if (!male && !female && legacyUrl) {
				const g = (legacyUrl.match(/\/(male|female)\//i) || [])[1]
				if (g && g.toLowerCase() === 'female') female = legacyUrl
				else male = legacyUrl
			}
			const voice = listenSession.voice === 'female' ? 'female' : 'male'
			audioUrl.value = (voice === 'female' ? female : male) || male || female || legacyUrl
			const baseDur = Number(d.audio_duration_sec) || 0
			const dur = voice === 'female'
				? (Number(d.audio_duration_sec_female) || baseDur)
				: (Number(d.audio_duration_sec_male) || baseDur)
			audioDurationSec.value = correctSpokenDuration(dur, newVerses)
			listeningVerse.value = 0
			scrollInto.value = ''
			if (d.book_name) bookName.value = d.book_name
			if (d.book_key) bookKey.value = d.book_key
			if (d.chapter_count) chapterCount.value = Number(d.chapter_count) || chapterCount.value
			bookmarkOn.value = d.bookmarked === true
			if (!verses.value.length) emptyHint.value = t('bible_empty')
			selectedVerse.value = null
			// 译文模式：立即异步重译（展示 loading 遮罩），避免新章译文就绪前空白/英文闪现；
			// 后续高亮/进度写盘在遮罩下进行，整段对用户而言是一气呵成的译文切换。
			if (verses.value.length && keepTranslate) {
				await hooks.confirmTranslate({ silent: true, quietFail: true })
			} else if (verses.value.length && hooks.applyDefaultScriptureLanguage) {
				await hooks.applyDefaultScriptureLanguage({ nativeEdition: editionMatched })
			}
			try {
				uni.setStorageSync(PROGRESS_KEY, {
					book_key: bookKey.value,
					book_name: bookName.value,
					chapter: chapterNum.value,
					translation: translation.value,
				})
				const mapKey = 'manna_bible_book_progress'
				const map = (() => {
					try { return uni.getStorageSync(mapKey) || {} } catch (e) { return {} }
				})()
				const maxCh = Math.max(1, Number(chapterCount.value) || 1)
				const curCh = Math.max(1, Number(chapterNum.value) || 1)
				map[bookKey.value] = {
					book_key: bookKey.value,
					book_name: bookName.value,
					chapter: curCh,
					chapter_count: maxCh,
					translation: translation.value,
					snippet: (verses.value[0]?.text || '').slice(0, 80),
					updated_at: Date.now(),
				}
				uni.setStorageSync(mapKey, map)
			} catch (e) {}
			await loadHighlights()
			track('manna_bible_read', { book: bookKey.value, chapter: chapterNum.value })
			// 正文已就位：让仍在播的听经音频跟到这一章。
			// 换章入口不止 loadReaderChapter 一条（个人中心高亮跳转 / 听经 intent / 译本切换），
			// 少了这一步就会出现「正文在第 5 章、音频还在念第 1 章」。
			followListenAudioToChapter()
			// 正文已就位：重新判定贴底（短章一屏装得下时不会有 scroll 事件，需主动量一次）
			setTimeout(() => refreshBottomStateAfterChapter(), 120)
		} catch (e) {
			verses.value = []
			bookmarkOn.value = false
			emptyHint.value = e?.message || t('bible_empty')
		} finally {
			loading.value = false
		}
	}

	/** 用户主动换章：正文和小卡音频一起换，旧章立刻停 */
	async function loadReaderChapter() {
		const follow = armListenRetarget()
		const gen = follow ? ++retargetGen : 0
		try {
			await loadChapter()
			if (!follow || !verses.value.length || gen !== retargetGen) return
			try {
				await retargetListenChapter({
					bookKey: bookKey.value,
					bookName: bookName.value,
					chapter: chapterNum.value,
					translation: translation.value,
					src: audioUrl.value,
					durationSec: audioDurationSec.value,
					play: !!listenAudio.resumeAfterRetarget,
					isStale: () => gen !== retargetGen,
				})
			} catch (e) {}
		} finally {
			if (follow && gen === retargetGen) {
				listenAudio.readerRetarget = false
				listenAudio.resumeAfterRetarget = false
				setTimeout(() => {
					if (gen !== retargetGen) return
					listenAudio.suppressEnd = false
				}, 500)
			}
		}
	}

	async function loadHighlights() {
		try {
			const res = await apiBibleHighlights()
			const list = res?.results || []
			const map = {}
			list.forEach((h) => {
				if (
					h.translation_code === translation.value &&
					h.book_key === bookKey.value &&
					Number(h.chapter) === Number(chapterNum.value)
				) {
					map[h.verse] = { id: h.id, color: h.color || 'gold' }
				}
			})
			highlightMap.value = map
			await loadAmenCounts()
		} catch (e) {}
	}
	
	async function loadAmenCounts() {
		try {
			const res = await apiBibleAmenCounts({
				book_key: bookKey.value,
				chapter: chapterNum.value,
			})
			const data = res?.results || {}
			const map = {}
			Object.keys(data).forEach((k) => {
				const n = Number(data[k] || 0)
				if (n > 0) map[Number(k) || k] = n
			})
			amenMap.value = map
		} catch (e) {}
	}
	
	function hiColor(v) {
		if (!v) return ''
		const row = highlightMap.value[v.verse]
		if (!row) return ''
		return row.color || 'gold'
	}
	
	/** 备用：直接切卷读第 1 章（合并选择器后 UI 已改走 pickBook → selectChapter） */
	function selectBook(b) {
		if (!b) return
		bookKey.value = b.book_key
		bookName.value = b.name || b.book_key
		chapterCount.value = Math.max(1, Number(b.chapter_count) || 1)
		chapterNum.value = 1
		hideNextHint()
		closeSheet()
		persistReadingPosition()
		loadReaderChapter().then(() => scrollToFirstVerse())
	}
	
	function selectChapter(n) {
		const target = pickerBook.value
		const nextChapter = Math.max(1, Number(n) || 1)
		// 换卷后才需要同步书名/章数；同卷直接翻章
		if (target?.book_key && String(target.book_key) !== String(bookKey.value || '')) {
			bookKey.value = target.book_key
			bookName.value = target.name || target.book_key
			chapterCount.value = Math.max(1, Number(target.chapter_count) || 1)
		}
		chapterNum.value = nextChapter
		hideNextHint()
		closeSheet()
		persistReadingPosition()
		loadReaderChapter().then(() => scrollToFirstVerse())
	}

	async function scrollToFirstVerse() {
		const first = verses.value[0]
		if (!first?.verse) return
		scrollInto.value = ''
		await Promise.resolve()
		scrollInto.value = `verse-${first.verse}`
	}

	/**
	 * 章末翻章：贴底 + 一次明确的上拉才算数，滑到底本身绝不翻章。
	 * - 手指按下那一刻锁定「本次手势是否有资格翻章」，惯性滚到章末再抬手不会误跳
	 * - 阈值按视口高度换算（64–104px），比固定 56px 更要求意图；松手瞬间仍要达标
	 * - 章末另给「下一章」按钮兜底，短章/安卓不再依赖手势
	 */
	const pullProgress = ref(0)
	const pullArmed = ref(false)
	const pullLoading = ref(false)
	const pullFlash = ref(false)
	const nearBottom = ref(false)
	const isLastChapter = computed(() => {
		const cur = Number(chapterNum.value) || 1
		const max = Math.max(1, Number(chapterCount.value) || 1)
		return cur >= max
	})
	let nextBusy = false
	let readerViewH = 0
	let lastScrollHeight = 0
	let lastScrollTop = 0
	let lastScrollAt = 0
	let pullStartY = 0
	let pullStartX = 0
	let pullMaxDy = 0
	/** 本次手势是否有资格翻章（touchstart 时锁定） */
	let pullEligible = false
	/** 本次手势已判定为横向拖动，不再参与翻章 */
	let pullLocked = false
	let pullTouchAt = 0
	let pullTriggerCache = 0
	let pullFlashTimer = null
	/** 贴底判定：进入用 NEAR，离开用 LEAVE，中间留滞回区，避免边界抖动 */
	const READER_NEAR_BOTTOM = 90
	const READER_LEAVE_BOTTOM = 220
	/** scroll 事件降频：安卓 WebView 上每帧回调会让整页重渲染 */
	const SCROLL_THROTTLE_MS = 32
	/** 指示器进度分档：把每帧的 ref 变更收敛到 8 档，显著减少重渲染 */
	const PULL_PROGRESS_STEPS = 8
	let scrollFlushTimer = null
	let pendingScrollTop = 0
	let pendingScrollHeight = 0

	/** 上拉阈值：随视口高度走，夹在 96–156px（比原先整体抬高 50%） */
	function pullTriggerPx() {
		if (pullTriggerCache) return pullTriggerCache
		let h = 0
		try {
			const info = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()
			h = Number(info?.windowHeight) || 0
		} catch (e) {}
		pullTriggerCache = h ? Math.round(Math.min(156, Math.max(96, h * 0.1275))) : 108
		return pullTriggerCache
	}

	function clearPullFlashTimer() {
		if (pullFlashTimer) {
			clearTimeout(pullFlashTimer)
			pullFlashTimer = null
		}
	}

	function clearScrollFlush() {
		if (scrollFlushTimer) {
			clearTimeout(scrollFlushTimer)
			scrollFlushTimer = null
		}
	}

	function resetPullState({ keepNear = false, keepArmed = false } = {}) {
		clearPullFlashTimer()
		pullFlash.value = false
		pullProgress.value = 0
		pullLoading.value = false
		pullMaxDy = 0
		pullEligible = false
		pullLocked = false
		if (!keepArmed) pullArmed.value = false
		if (!keepNear) nearBottom.value = false
	}

	function hideNextHint() {
		resetPullState()
	}

	function measureReaderHeight() {
		try {
			const inst = getCurrentInstance()?.proxy
			const q = inst ? uni.createSelectorQuery().in(inst) : uni.createSelectorQuery()
			q.select('.reader').boundingClientRect((rect) => {
				if (rect?.height) readerViewH = Number(rect.height) || 0
			}).exec()
		} catch (e) {}
	}

	function enterBottom() {
		if (!nearBottom.value) nearBottom.value = true
	}

	function leaveBottom() {
		if (!nearBottom.value) return
		nearBottom.value = false
		resetPullState({ keepNear: true })
	}

	/** 跳章后重新量高：短章一屏内也算到底，上拉/点按都能进下一章 */
	function refreshBottomStateAfterChapter() {
		measureReaderHeight()
		try {
			const inst = getCurrentInstance()?.proxy
			const q = inst ? uni.createSelectorQuery().in(inst) : uni.createSelectorQuery()
			q.select('.reader').boundingClientRect()
			q.select('.reader').scrollOffset()
			q.exec((res) => {
				const rect = res?.[0]
				const off = res?.[1]
				if (rect?.height) readerViewH = Number(rect.height) || readerViewH
				const sh = Number(off?.scrollHeight) || 0
				const st = Number(off?.scrollTop) || 0
				if (sh > 0) {
					lastScrollHeight = sh
					lastScrollTop = st
					const dist = sh - st - (readerViewH || 0)
					if (nearBottom.value) {
						if (dist > READER_LEAVE_BOTTOM) leaveBottom()
					} else if (!readerViewH || dist <= READER_NEAR_BOTTOM) {
						enterBottom()
					}
				} else if (readerViewH && lastScrollHeight) {
					const dist = lastScrollHeight - lastScrollTop - readerViewH
					if (dist <= READER_NEAR_BOTTOM) enterBottom()
				}
			})
		} catch (e) {}
	}

	function updateNearBottom(scrollTop, scrollHeight) {
		lastScrollTop = Number(scrollTop) || 0
		lastScrollHeight = Number(scrollHeight) || lastScrollHeight
		if (!readerViewH) measureReaderHeight()
		const viewH = readerViewH || 0
		if (!viewH || !lastScrollHeight) return
		const dist = lastScrollHeight - lastScrollTop - viewH
		if (nearBottom.value) {
			if (dist > READER_LEAVE_BOTTOM) leaveBottom()
		} else if (dist <= READER_NEAR_BOTTOM) {
			enterBottom()
		}
	}

	function onReaderScroll(e) {
		const d = e?.detail || {}
		pendingScrollTop = Number(d.scrollTop) || 0
		pendingScrollHeight = Number(d.scrollHeight) || pendingScrollHeight
		const now = Date.now()
		if (now - lastScrollAt < SCROLL_THROTTLE_MS) {
			// 被降频丢掉的这帧可能正好是终点，补一次尾帧，别让贴底判定停在中途
			if (!scrollFlushTimer) {
				scrollFlushTimer = setTimeout(() => {
					scrollFlushTimer = null
					updateNearBottom(pendingScrollTop, pendingScrollHeight)
				}, SCROLL_THROTTLE_MS)
			}
			return
		}
		lastScrollAt = now
		armLongPressScrollGuard()
		updateNearBottom(pendingScrollTop, pendingScrollHeight)
	}

	/** 触底只做「贴底」标记，绝不在这里翻章 —— iOS 惯性滑到章末误跳的根因就在这 */
	function onReaderScrollToLower() {
		armLongPressScrollGuard()
		enterBottom()
	}

	function setPullProgress(raw) {
		const p = Math.min(1.15, Math.max(0, raw))
		const step = Math.round(p * PULL_PROGRESS_STEPS) / PULL_PROGRESS_STEPS
		if (step !== pullProgress.value) pullProgress.value = step
		// 过阈值即武装；回落 14% 才解除，避免边界处文案闪烁
		if (step >= 1) pullArmed.value = true
		else if (step < 0.86) pullArmed.value = false
	}

	function trackPullFromTouch(e) {
		if (!pullEligible || pullLocked) return
		if (nextBusy || loading.value || sheet.value || pullLoading.value) return
		const t0 = e?.touches?.[0] || e?.changedTouches?.[0]
		if (!t0) return
		const y = Number(t0.clientY ?? t0.pageY ?? NaN)
		const x = Number(t0.clientX ?? t0.pageX ?? NaN)
		if (!Number.isFinite(y) || !pullStartY) return
		const dy = pullStartY - y
		const dx = Number.isFinite(x) ? Math.abs(x - pullStartX) : 0
		if (dy < -8) {
			// 明确往回滚：本次手势不再参与翻章
			pullEligible = false
			setPullProgress(0)
			return
		}
		if (dy <= 0) return
		// 横向拖动交给系统，别把指示器拽出来
		if (dx > 14 && dx > dy * 0.8) {
			pullLocked = true
			setPullProgress(0)
			return
		}
		if (dy > pullMaxDy) pullMaxDy = dy
		setPullProgress(dy / pullTriggerPx())
	}

	function onReaderTouchStart(e) {
		const now = Date.now()
		// 手势事件会从经文节点冒泡到 scroll-view，同一手势只初始化一次
		if (now - pullTouchAt < 30) return
		pullTouchAt = now
		const t0 = e?.touches?.[0] || e?.changedTouches?.[0]
		const y = Number(t0?.clientY ?? t0?.pageY ?? 0)
		if (!y) return
		pullStartY = y
		pullStartX = Number(t0?.clientX ?? t0?.pageX ?? 0)
		pullMaxDy = 0
		pullLocked = false
		pullArmed.value = false
		// 资格在这一刻锁定：滑到底之前的这次手势，抬手也不翻章
		pullEligible = nearBottom.value && !nextBusy && !loading.value && !sheet.value && !pullLoading.value
		if (!pullEligible) setPullProgress(0)
	}

	function onReaderTouchMove(e) {
		trackPullFromTouch(e)
	}

	function onReaderTouchEnd() {
		const eligible = pullEligible
		const dy = pullMaxDy
		const armed = pullArmed.value
		const need = pullTriggerPx()
		pullTouchAt = 0
		pullEligible = false
		pullLocked = false
		pullMaxDy = 0
		pullArmed.value = false
		setPullProgress(0)
		if (!eligible || armed !== true) return
		if (nextBusy || loading.value || sheet.value || pullLoading.value) return
		// 松手瞬间仍要达标：一次明确的「上拉 → 松手」，不是滑到底的惯性
		if (dy < need) return
		goNextChapterByPull()
	}

	function onNextChapterTap() {
		if (nextBusy || loading.value || sheet.value) return
		if (isLastChapter.value) {
			uni.showToast({ title: t('bible_last_chapter'), icon: 'none' })
			return
		}
		goNextChapterByPull()
	}

	async function goNextChapterByPull() {
		if (nextBusy || loading.value || sheet.value) return
		const cur = Number(chapterNum.value) || 1
		const max = Math.max(1, Number(chapterCount.value) || 1)
		if (cur >= max) {
			uni.showToast({ title: t('bible_last_chapter'), icon: 'none' })
			resetPullState()
			return
		}
		nextBusy = true
		clearPullFlashTimer()
		pullFlash.value = false
		pullProgress.value = 0
		pullLoading.value = true
		pullArmed.value = false
		try {
			chapterNum.value = cur + 1
			await loadReaderChapter()
			readerViewH = 0
			lastScrollHeight = 0
			lastScrollTop = 0
			measureReaderHeight()
			await scrollToFirstVerse()
			nearBottom.value = false
			setTimeout(() => {
				refreshBottomStateAfterChapter()
			}, 120)
			setTimeout(() => {
				refreshBottomStateAfterChapter()
			}, 360)
		} finally {
			pullLoading.value = false
			setTimeout(() => {
				nextBusy = false
			}, 400)
		}
	}

	const pullHintText = computed(() => {
		if (pullLoading.value) return t('bible_chapter_loading')
		if (pullFlash.value) return t('bible_pull_next')
		if (pullArmed.value && pullProgress.value >= 1) return t('bible_pull_release_go')
		if (pullProgress.value >= 1) return t('bible_pull_release')
		if (pullArmed.value) return t('bible_pull_next')
		return t('bible_pull_hint')
	})

	/** 仅在上拉过程 / 武装闪现 / 加载中显示（同下拉刷新，不常驻） */
	const showPullNudge = computed(() => (
		pullLoading.value
		|| pullFlash.value
		|| pullProgress.value > 0.06
	))

	// 兼容旧导出名
	const showNextHint = pullFlash
	function onTapVerse(v) {
		/* 单击工具条已隐藏：保留原逻辑便于恢复
		if (selectedVerse.value && selectedVerse.value.verse === v.verse) {
			selectedVerse.value = null
			return
		}
		selectedVerse.value = v
		*/
	}
	
	async function toggleHighlight(v, { silent, color } = {}) {
		if (!v) return
		await applyHighlight(v, color || 'gold', { silent })
	}
	
	async function applyHighlight(v, color, { silent } = {}) {
		if (!v) return
		const existing = highlightMap.value[v.verse]
		try {
			if (existing && existing.color === color) {
				await apiBibleHighlightSave({ delete_id: existing.id })
				const next = { ...highlightMap.value }
				delete next[v.verse]
				highlightMap.value = next
				if (!silent) uni.showToast({ title: t('bible_unhighlighted'), icon: 'none' })
				return
			}
			const res = await apiBibleHighlightSave({
				translation_code: translation.value,
				book_key: bookKey.value,
				chapter: chapterNum.value,
				verse: v.verse,
				color: color || 'gold',
			})
			const id = res?.results?.id || existing?.id
			if (id) {
				highlightMap.value = {
					...highlightMap.value,
					[v.verse]: { id, color: color || 'gold' },
				}
			} else {
				await loadHighlights()
			}
			if (!silent) uni.showToast({ title: t('bible_highlighted'), icon: 'none' })
		} catch (e) {
			uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
		}
	}

	/** 长按经文操作条色点（与原单击栏能力一致，视觉对齐新稿） */
	const verseHiColors = [
		{ id: 'pink', hex: '#F2B4BE' },
		{ id: 'peach', hex: '#F5C9A8' },
		{ id: 'gold', hex: '#F0E08A' },
		{ id: 'green', hex: '#C5E6B8' },
		{ id: 'cyan', hex: '#B5E0E4' },
		{ id: 'blue', hex: '#B8D0F0' },
		{ id: 'purple', hex: '#D4C4F0' },
	]
	
	/** 滑动时抑制长按，避免滚列表误弹操作条 */
	let longPressScrollGuardUntil = 0
	let verseTouchMoved = false
	let verseTouchX = 0
	let verseTouchY = 0
	const VERSE_TOUCH_MOVE_PX = 10
	const LONGPRESS_SCROLL_GUARD_MS = 480

	function armLongPressScrollGuard() {
		longPressScrollGuardUntil = Date.now() + LONGPRESS_SCROLL_GUARD_MS
	}

	function onVerseTouchStart(e) {
		verseTouchMoved = false
		const t0 = e?.touches?.[0] || e?.changedTouches?.[0]
		verseTouchX = Number(t0?.clientX || t0?.pageX || 0)
		verseTouchY = Number(t0?.clientY || t0?.pageY || 0)
		onReaderTouchStart(e)
	}

	function onVerseTouchMove(e) {
		if (!verseTouchMoved) {
			const t0 = e?.touches?.[0] || e?.changedTouches?.[0]
			const x = Number(t0?.clientX || t0?.pageX || 0)
			const y = Number(t0?.clientY || t0?.pageY || 0)
			if (
				Math.abs(x - verseTouchX) >= VERSE_TOUCH_MOVE_PX
				|| Math.abs(y - verseTouchY) >= VERSE_TOUCH_MOVE_PX
			) {
				verseTouchMoved = true
				armLongPressScrollGuard()
			}
		}
		onReaderTouchMove(e)
	}

	function onVerseTouchEnd() {
		onReaderTouchEnd()
	}

	async function onLongPress(v) {
		if (verseTouchMoved || Date.now() < longPressScrollGuardUntil) return
		if (loading.value || sheet.value) return
		selectedVerse.value = v
		sheet.value = 'verse'
		/* 旧系统 ActionSheet，保留便于恢复
		uni.showActionSheet({
			itemList: [t('amen'), t('bible_notes'), t('versecard_title'), t('bible_copy')],
			success: async (res) => {
				if (res.tapIndex === 0) await amenVerse(v)
				else if (res.tapIndex === 1) openNoteSheet(v)
				else if (res.tapIndex === 2) openVerseCard()
				else if (res.tapIndex === 3) copyVerse(v)
			},
		})
		*/
	}

	function onVerseAct(action) {
		const v = selectedVerse.value
		if (!v) return
		if (action === 'amen') {
			amenVerse(v)
			return
		}
		if (action === 'note') {
			openNoteSheet(v)
			return
		}
		if (action === 'card') {
			openVerseCard()
			return
		}
		if (action === 'copy') {
			copyVerse(v)
		}
	}

	function copyVerse(v) {
		const row = v || selectedVerse.value
		if (!row) return
		const ref = `${bookName.value} ${chapterNum.value}:${row.verse}`
		const text = `${row.text || ''}\n${ref}`.trim()
		uni.setClipboardData({
			data: text,
			success: () => uni.showToast({ title: t('copied'), icon: 'none' }),
		})
	}
	
	function openNoteSheet(v) {
		selectedVerse.value = v
		noteDraft.value = ''
		sheet.value = 'note'
	}
	
	async function saveNote() {
		const v = selectedVerse.value
		const body = String(noteDraft.value || '').trim()
		if (!v || !body) {
			uni.showToast({ title: t('bible_note_placeholder'), icon: 'none' })
			return
		}
		if (noteBusy.value) return
		noteBusy.value = true
		try {
			await apiBibleNoteSave({
				translation_code: translation.value,
				book_key: bookKey.value,
				chapter: chapterNum.value,
				verse: v.verse,
				body,
			})
			uni.showToast({ title: t('bible_note_saved'), icon: 'none' })
			closeSheet()
		} catch (e) {
			uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
		} finally {
			noteBusy.value = false
		}
	}
	
	async function amenVerse(v) {
		if (!v) return
		try {
			const res = await apiBibleAmenVerse({
				translation_code: translation.value,
				book_key: bookKey.value,
				chapter: chapterNum.value,
				verse: v.verse,
				ref: `${bookName.value} ${chapterNum.value}:${v.verse}`,
			})
			const n = Number(res?.results?.count || 1)
			amenMap.value = { ...amenMap.value, [v.verse]: n }
			showNewBadges(res?.results?.newly_earned)
			uni.showToast({ title: t('amen_done'), icon: 'none' })
			track('manna_amen', { scene: 'bible_verse', verse: v.verse })
		} catch (e) {
			uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
		}
	}
	
	async function onBookmark() {
		try {
			const key = `${translation.value}:${bookKey.value}:${chapterNum.value}:${selectedVerse.value?.verse || 0}`
			const res = await apiMannaFavoriteToggle({
				target_type: 'bible_bookmark',
				target_key: key,
			})
			bookmarkOn.value = !!(res?.results?.liked)
			uni.showToast({
				title: bookmarkOn.value ? t('bible_bookmarked') : t('bible_unbookmarked'),
				icon: 'none',
			})
		} catch (e) {
			uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
		}
	}
	
	async function runSearch() {
		const q = String(searchQ.value || '').trim()
		if (q.length < 2) {
			uni.showToast({ title: t('bible_search_ph'), icon: 'none' })
			return
		}
		try {
			const res = await apiBibleSearch({ q, translation: translation.value })
			const rows = res?.results
			searchHits.value = Array.isArray(rows) ? rows : []
			searchDone.value = true
			pushSearchRecent(q)
		} catch (e) {
			searchHits.value = []
			searchDone.value = true
		}
	}
	
	function openSearchHit(hit) {
		bookKey.value = hit.book_key
		bookName.value = hit.book_name || hit.book_key
		chapterNum.value = Number(hit.chapter) || 1
		closeSheet()
		loadReaderChapter().then(() => {
			selectedVerse.value = verses.value.find((v) => v.verse === hit.verse) || null
			scrollInto.value = hit.verse ? `verse-${hit.verse}` : ''
		})
	}
	
	function openVerseCard() {
		const v = selectedVerse.value
		if (!v) return
		uni.setStorageSync('manna_versecard_payload', {
			text: v.text || '',
			ref: `${bookName.value} ${chapterNum.value}:${v.verse}`,
			brand: 'MANNA',
		})
		sheet.value = ''
		persistReadingPosition()
		try { uni.setStorageSync(HOLD_CHAPTER_KEY, 1) } catch (e) {}
		uni.navigateTo({ url: '/pagesA/share/versecard' })
	}

	async function scrollToVerseNum(n) {
		const v = Math.max(0, Number(n) || 0)
		if (!v) return
		listeningVerse.value = v
		scrollInto.value = ''
		await Promise.resolve()
		scrollInto.value = `verse-${v}`
	}

	/** 个人中心高亮列表点击：跳回读经页并滚动到对应节（纯定位，不进入听经态）。 */
	async function applyOpenIntent() {
		let intent = null
		try {
			intent = uni.getStorageSync(OPEN_REF_KEY) || null
			uni.removeStorageSync(OPEN_REF_KEY)
		} catch (e) {
			intent = null
		}
		if (!intent || typeof intent !== 'object') return

		const nextBook = intent.book_key ? String(intent.book_key) : String(bookKey.value || 'genesis')
		const nextChapter = intent.chapter
			? (Number(intent.chapter) || 1)
			: (Math.max(1, Number(chapterNum.value) || 1))
		const targetVerse = Math.max(0, Number(intent.verse) || 0)

		// H5 读经固定 WEB 译本，避免把译本写成非 web 造成与接口不一致
		// #ifndef H5
		if (intent.translation_code) {
			translation.value = String(intent.translation_code) || translation.value
		}
		// #endif

		const sameChapter =
			nextBook === String(bookKey.value || '')
			&& nextChapter === Math.max(1, Number(chapterNum.value) || 1)
			&& (!intent.translation_code || String(intent.translation_code) === String(translation.value || ''))
			&& Array.isArray(verses.value)
			&& verses.value.length > 0

		// 同章：仅滚动到目标节，避免整章重拉（体感像 App 重启）
		if (sameChapter) {
			if (targetVerse) {
				scrollInto.value = ''
				await nextTick()
				scrollInto.value = `verse-${targetVerse}`
			}
			return
		}

		if (intent.book_key) bookKey.value = nextBook
		if (intent.chapter) chapterNum.value = nextChapter
		await loadChapter()
		if (targetVerse) {
			scrollInto.value = ''
			await nextTick()
			scrollInto.value = `verse-${targetVerse}`
		}
	}

	async function syncFromListenSession() {
		if (listenAudio.readerRetarget) return false
		const bk = String(listenSession.bookKey || '').trim()
		const ch = Math.max(1, Number(listenSession.chapter) || 0)
		const verse = Math.max(0, Number(listenSession.verse) || 0)
		if (!bk || !ch) return false
		const same =
			bk === String(bookKey.value || '')
			&& ch === Math.max(1, Number(chapterNum.value) || 1)
		if (same) {
			if (verse) await scrollToVerseNum(verse)
			try { await alignListenFile() } catch (e) {}
			return !!verse
		}
		listenAudio.readerRetarget = true
		syncingFromListen = true
		try {
			bookKey.value = bk
			if (listenSession.bookName) bookName.value = String(listenSession.bookName)
			chapterNum.value = ch
			if (listenSession.translation) translation.value = String(listenSession.translation) || translation.value
			hideNextHint()
			await loadChapter()
			try { await alignListenFile() } catch (e) {}
			if (verse) await scrollToVerseNum(verse)
			else await scrollToFirstVerse()
			return true
		} finally {
			syncingFromListen = false
			listenAudio.readerRetarget = false
		}
	}

	function scheduleSyncFromListen() {
		if (syncInflight) return syncInflight
		if (listenAudio.readerRetarget || syncingFromListen) return null
		if (!(listenSession.mini || listenSession.keepAlive)) return null
		if (listenReaderSameChapter() && verses.value.length) return null
		syncInflight = Promise.resolve(syncFromListenSession()).finally(() => {
			syncInflight = null
		})
		return syncInflight
	}

	watch(
		() => [listenSession.mini, listenSession.bookKey, Number(listenSession.chapter) || 0],
		() => {
			if (!listenSession.mini) return
			scheduleSyncFromListen()
		}
	)

	onMounted(async () => {
		tabOn.value = true
		setTabUiKey('bible')
		hideNativeTabBar()
		readStart = Date.now()
		const cfg = readPageCache(APP_CONFIG_KEY) || {}
		if (cfg.translate_enabled === false) hooks.translateEnabled.value = false
		try {
			await ensureLogin({ explicit: true })
		} catch (e) {}
		// onShow 可能已消费 intent / 载入章节，避免二次 loadChapter 造成整页闪白
		let openRefIntent = null
		try { openRefIntent = uni.getStorageSync(OPEN_REF_KEY) || null } catch (e) { openRefIntent = null }
		if (uni.getStorageSync(LISTEN_KEY)) {
			await hooks.applyListenIntent()
		} else if (openRefIntent) {
			await applyOpenIntent()
		} else if (!verses.value.length) {
			await alignEditionToAppLanguage()
			await loadChapter()
		}
		setTimeout(() => measureReaderHeight(), 80)
	})

	onShow(async () => {
		tabOn.value = true
		setTabUiKey('bible')
		hideNativeTabBar()
		track('page_view', { page_name: 'bible' })
		setTimeout(() => measureReaderHeight(), 80)
		let openRefIntent = null
		try { openRefIntent = uni.getStorageSync(OPEN_REF_KEY) || null } catch (e) { openRefIntent = null }
		const hasListen = !!uni.getStorageSync(LISTEN_KEY)
		const hasIntent = hasListen || !!openRefIntent
		let holdChapter = false
		try {
			holdChapter = !!uni.getStorageSync(HOLD_CHAPTER_KEY)
			if (holdChapter) uni.removeStorageSync(HOLD_CHAPTER_KEY)
		} catch (e) {}
		const runFollow = () => {
			try { hooks.bindMiniListenFollow && hooks.bindMiniListenFollow() } catch (e) {}
		}
		// const hasIntent = hasListen || !!openRefIntent
		// 从经文卡返回：停在用户刚选的章节，不要被听经进度或默认第 1 章拉走
		if (holdChapter && !hasIntent) {
			if (verses.value.length) loadHighlights().catch(() => {})
			return
		}

		// 个人中心取消高亮后返回：tab 页内存未清，需重拉
		if (!hasIntent && !(listenSession.mini || listenSession.keepAlive)) {
			const changed = await alignEditionToAppLanguage()
			if (changed && verses.value.length) {
				await loadChapter()
			} else if (verses.value.length) {
				loadHighlights().catch(() => {})
			}
		} else if (!hasIntent && verses.value.length) {
			loadHighlights().catch(() => {})
		}
		if (hasIntent) {
			if (openRefIntent) {
				// 高亮列表点击：跳回指定书卷·章·节并定位
				setTimeout(() => {
					applyOpenIntent().catch(() => {})
				}, 80)
				return
			}
			setTimeout(() => {
				hooks.applyListenIntent()
					.catch(() => {})
					.finally(() => {
						if (listenSession.mini || listenSession.keepAlive) {
							// intent 可能仍是第 1 章，小卡已经切到别的章：以正在听的章为准
							Promise.resolve(scheduleSyncFromListen() || syncFromListenSession())
								.catch(() => {})
								.finally(runFollow)
							return
						}
						// 非小卡返回才停残留音频
						setTimeout(() => {
							try { pauseOrphanListenAudio() } catch (e) {}
						}, 400)
					})
			}, 80)
			return
		}
		if (listenSession.mini || listenSession.keepAlive) {
			setTimeout(() => {
				Promise.resolve(scheduleSyncFromListen() || syncFromListenSession())
					.catch(() => {})
					.finally(runFollow)
			}, 80)
			return
		}
		setTimeout(() => {
			try { pauseOrphanListenAudio() } catch (e) {}
		}, 480)
	})

	onHide(() => {
		// 保持自定义底栏挂载，避免返回时拆装闪屏
		clearScrollFlush()
		flushReadProgress()
	})

	onUnload(() => {
		clearScrollFlush()
		hooks.clearFabFlowTimer()
		if (hooks.translateBusy.value) {
			try { uni.hideLoading() } catch (e) {}
			hooks.translateBusy.value = false
		}
		flushReadProgress()
		hooks.stopAudio()
	})


	return {
		FONT_STEPS,
		FONT_FACES,
		THEMES,
		statusBar,
		tabOn,
		fontPx,
		themeId,
		fontFace,
		searchQ,
		searchHits,
		searchDone,
		searchRecent,
		bookmarkOn,
		translation,
		bookKey,
		bookName,
		chapterNum,
		chapterCount,
		books,
		verses,
		audioUrl,
		audioDurationSec,
		audioPlaying,
		listeningVerse,
		scrollInto,
		loading,
		emptyHint,
		showNextHint,
		showPullNudge,
		nearBottom,
		isLastChapter,
		pullArmed,
		pullLoading,
		pullFlash,
		pullProgress,
		pullHintText,
		highlightMap,
		selectedVerse,
		sheet,
		sheetMaskReady,
		bookTag,
		noteDraft,
		noteBusy,
		amenMap,
		badgeOpen,
		badgeItems,
		bookmarkActive,
		readerFaceStyle,
		previewFaceStyle,
		pageChromeStyle,
		bookTags,
		filteredBooks,
		chapterNums,
		pickerView,
		pickerBook,
		pickerBookName,
		pickerChapterNums,
		pickerOnCurrentBook,
		segTrackStyle,
		segGrowStyle,
		listenSession,
		noop,
		onMaskClose,
		openFont,
		openSearch,
		onSearchInput,
		pickSearchRecent,
		removeSearchRecent,
		clearSearchRecent,
		highlightSearchParts,
		onSheetTouchStart,
		onSheetTouchEnd,
		setFontFace,
		openBooks,
		openChapters,
		pickBook,
		backToBooks,
		setFont,
		setTheme,
		segBtnStyle,
		segTxtStyle,
		loadChapter,
		hiColor,
		selectBook,
		selectChapter,
		onReaderScroll,
		onReaderScrollToLower,
		onReaderTouchStart,
		onReaderTouchMove,
		onReaderTouchEnd,
		onNextChapterTap,
		onTapVerse,
		toggleHighlight,
		applyHighlight,
		onLongPress,
		onVerseTouchStart,
		onVerseTouchMove,
		onVerseTouchEnd,
		onVerseAct,
		verseHiColors,
		openNoteSheet,
		saveNote,
		amenVerse,
		onBookmark,
		runSearch,
		openSearchHit,
		openVerseCard,
		copyVerse,
		closeSheet,
	}
}

