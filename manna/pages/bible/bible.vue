<template>
	<!-- Figma Bible 312:2493 / 329:742 / 书卷·章节选择器 -->
	<view class="page" :class="'theme-' + themeId" :style="{ paddingTop: statusBar + 'px' }">
		<view class="page__bar">
			<view class="page__title-wrap" hover-class="page__press" @click="openBooks">
				<text class="page__title">{{ bookName }} {{ chapterNum }}</text>
			</view>
			<view class="page__tools">
				<text class="page__aa" hover-class="page__press" @click="openFont">Aa</text>
				<image
					class="page__tool"
					src="/static/ui/bible/ico-list.svg"
					mode="aspectFit"
					@click="openChapters"
				/>
				<image
					class="page__tool"
					:src="bookmarkActive ? '/static/ui/bible/ico-bookmark-on.svg' : '/static/ui/bible/ico-bookmark.svg'"
					mode="aspectFit"
					@click="onBookmark"
				/>
			</view>
		</view>

		<scroll-view
			scroll-y
			class="reader"
			:style="{ fontSize: fontPx + 'px' }"
			:scroll-into-view="scrollInto"
			scroll-with-animation
		>
			<view
				v-for="v in verses"
				:id="'verse-' + v.verse"
				:key="v.verse"
				class="reader__v"
				:class="{
					'is-hi': !!highlightMap[v.verse],
					'is-sel': selectedVerse && selectedVerse.verse === v.verse,
					'is-amen': !!amenMap[v.verse],
					'is-listening': listeningVerse === v.verse,
					'is-heard': listeningVerse > 0 && v.verse < listeningVerse,
				}"
				@longpress="onLongPress(v)"
				@click="onTapVerse(v)"
			>
				<text class="n">{{ v.verse }}</text>
				<text class="t">{{ verseText(v) }}</text>
			</view>
			<text v-if="!verses.length && !loading" class="reader__empty">{{ emptyHint }}</text>
			<view class="reader__pad" />
		</scroll-view>

		<view
			v-if="verses.length"
			class="fab fab--translate"
			:class="{ 'fab--translate-on': showTranslated }"
			hover-class="fab--press-side"
			@click="onTranslateTap"
		>
			<view class="fab__glass fab__glass--side" aria-hidden="true" />
			<text class="fab__abbr">{{ localeAbbr }}</text>
		</view>

		<view
			v-if="audioUrl"
			class="fab"
			:class="{ 'fab--playing': audioPlaying, 'fab--flow': fabFlow }"
			hover-class="fab--press"
			@click="onFabTap"
		>
			<image
				v-if="!audioPlaying"
				class="fab__full"
				src="/static/ui/bible/fab-play.svg"
				mode="aspectFit"
			/>
			<template v-else>
				<view class="fab__glass" aria-hidden="true" />
				<image
					class="fab__ico"
					src="/static/ui/bible/ico-pause.svg"
					mode="aspectFit"
				/>
			</template>
		</view>

		<!-- 字体 / 主题 -->
		<view v-if="sheet === 'font'" class="mask" @click="closeSheet">
			<view class="sheet" @click.stop>
				<view class="sheet__handle" />
				<text class="sheet__label">{{ t('bible_font') }}</text>
				<text class="sheet__preview" :style="{ fontSize: fontPx + 'px' }">{{ t('bible_font_preview') }}</text>
				<view class="font-row">
					<text class="font-row__aa">Aa</text>
					<view class="font-pills">
						<view
							v-for="sz in FONT_STEPS"
							:key="sz"
							class="font-pill"
							:class="{ 'font-pill--on': fontPx === sz }"
							@click="setFont(sz)"
						>
							{{ sz }}
						</view>
					</view>
				</view>
				<view class="theme-row">
					<view
						v-for="th in THEMES"
						:key="th.id"
						class="theme-swatch"
						:class="['theme-swatch--' + th.id, { 'theme-swatch--on': themeId === th.id }]"
						@click="setTheme(th.id)"
					>
						<view class="theme-swatch__check" />
					</view>
				</view>
			</view>
		</view>

		<!-- 书卷 -->
		<view v-if="sheet === 'books'" class="mask" @click="closeSheet">
			<view class="sheet sheet--tall" @click.stop>
				<view class="sheet__handle" />
				<view class="tags">
					<view
						v-for="tg in bookTags"
						:key="tg.id"
						class="tag"
						:class="{ 'tag--on': bookTag === tg.id }"
						@click="bookTag = tg.id"
					>
						{{ tg.label }}
					</view>
				</view>
				<scroll-view scroll-y class="sheet__scroll">
					<view class="book-grid">
						<view
							v-for="b in filteredBooks"
							:key="b.book_key"
							class="book-cell"
							:class="{ 'book-cell--on': b.book_key === bookKey }"
							@click="selectBook(b)"
						>
							{{ b.name || b.book_key }}
						</view>
					</view>
				</scroll-view>
			</view>
		</view>

		<!-- 章节 -->
		<view v-if="sheet === 'chapters'" class="mask" @click="closeSheet">
			<view class="sheet sheet--tall" @click.stop>
				<view class="sheet__handle" />
				<text class="sheet__label">{{ bookName }} · {{ t('bible_chapters') }}</text>
				<scroll-view scroll-y class="sheet__scroll">
					<view class="chap-grid">
						<view
							v-for="n in chapterNums"
							:key="n"
							class="chap-cell"
							:class="{ 'chap-cell--on': n === chapterNum }"
							@click="selectChapter(n)"
						>
							{{ n }}
						</view>
					</view>
				</scroll-view>
			</view>
		</view>

		<!-- 写笔记 -->
		<view v-if="sheet === 'note'" class="mask" @click="closeSheet">
			<view class="sheet" @click.stop>
				<view class="sheet__handle" />
				<text class="sheet__label">{{ t('bible_notes') }}</text>
				<text v-if="selectedVerse" class="sheet__preview">{{ bookName }} {{ chapterNum }}:{{ selectedVerse.verse }}</text>
				<textarea
					class="note-input"
					v-model="noteDraft"
					:placeholder="t('bible_note_placeholder')"
					:maxlength="2000"
				/>
				<button class="note-save" hover-class="note-save--press" :disabled="noteBusy" @click="saveNote">
					{{ t('bible_note_save') }}
				</button>
			</view>
		</view>

		<!-- 翻译（Google） -->
		<view v-if="sheet === 'translate'" class="mask" @click="closeSheet">
			<view class="sheet" @click.stop>
				<view class="sheet__handle" />
				<text class="sheet__label">{{ t('bible_translate') }}</text>
				<text class="sheet__preview">{{ t('bible_translate_target') }}</text>
				<view class="tags">
					<view
						v-for="opt in translateLangOptions"
						:key="opt.code"
						class="tag"
						:class="{ 'tag--on': translateTarget === opt.code }"
						hover-class="page__press"
						@click="translateTarget = opt.code"
					>
						{{ opt.abbr }} · {{ opt.label }}
					</view>
				</view>
				<text class="sheet__meta">{{ translateScopeLabel }}</text>
				<view
					class="sheet__cta"
					:class="{ 'sheet__cta--disabled': translateBusy }"
					hover-class="sheet__cta--press"
					@click="confirmTranslate"
				>
					<text class="sheet__cta-txt">{{ t('bible_translate_go') }}</text>
				</view>
				<view
					v-if="showTranslated"
					class="sheet__cta sheet__cta--ghost"
					:class="{ 'sheet__cta--disabled': translateBusy }"
					hover-class="sheet__cta--press"
					@click="restoreOriginal"
				>
					<text class="sheet__cta-txt">{{ t('bible_translate_original') }}</text>
				</view>
			</view>
		</view>

		<MannaTabBar v-if="tabOn" active="bible" variant="light" />
	</view>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { onShow, onHide, onUnload } from '@dcloudio/uni-app'
import { t, getLocale, NATIVE_LANG_LABELS, UI_LOCALES } from '@/i18n/index.js'
import i18n from '@/i18n/index.js'
import { ensureLogin } from '@/utils/session.js'
import {
	apiBibleBooks,
	apiBibleChapter,
	apiBibleHighlightSave,
	apiBibleHighlights,
	apiBibleReadProgress,
	apiBibleNoteSave,
	apiBibleAmenVerse,
	apiBibleTranslate,
} from '@/api/bible.js'
import { host } from '@/config/config.js'
import { track } from '@/utils/analytics.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { hideNativeTabBar } from '@/utils/tabbar.js'
import MannaTabBar from '@/components/MannaTabBar.vue'

function absolutizeMedia(url) {
	if (!url) return ''
	if (/^https?:\/\//i.test(url)) return url
	const origin = String(host || '').replace(/\/api\/?$/, '')
	return `${origin}${url.startsWith('/') ? '' : '/'}${url}`
}

const FONT_KEY = 'manna_bible_font_px'
const THEME_KEY = 'manna_bible_theme'
const FONT_STEPS = [14, 16, 18, 20]
const THEMES = [
	{ id: 'white' },
	{ id: 'peach' },
	{ id: 'mint' },
	{ id: 'dark' },
]

const statusBar = getStatusBarPx()
const tabOn = ref(true)
const fontPx = ref((() => {
	const raw = Number(uni.getStorageSync(FONT_KEY) || uni.getStorageSync('manna_bible_font_size') || 16)
	// 旧版存的是 rpx(28–40)，迁移到 px(14–20)
	if (raw >= 24) return Math.min(20, Math.max(14, Math.round(raw / 2)))
	return FONT_STEPS.includes(raw) ? raw : 16
})())
const themeId = ref(uni.getStorageSync(THEME_KEY) || 'white')
const translation = ref('web')
const bookKey = ref('genesis')
const bookName = ref('Genesis')
const chapterNum = ref(1)
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
const bookTag = ref('all')
const noteDraft = ref('')
const noteBusy = ref(false)
const amenMap = ref({})
/** verse → 译文 */
const translatedMap = ref({})
const showTranslated = ref(false)
const translateBusy = ref(false)
const translateTarget = ref(getLocale() || 'en')
let innerAudio = null
let audioTick = null
let readStart = Date.now()
let scrollLockUntil = 0

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

const bookmarkActive = computed(() => {
	const v = selectedVerse.value
	return !!(v && highlightMap.value[v.verse])
})

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

function closeSheet() {
	sheet.value = ''
}

function openFont() {
	sheet.value = 'font'
}

function openBooks() {
	const show = () => {
		ensureBookTag()
		sheet.value = 'books'
	}
	if (!books.value.length) loadBooks().then(show)
	else show()
}

function openChapters() {
	sheet.value = 'chapters'
}

function setFont(sz) {
	fontPx.value = sz
	uni.setStorageSync(FONT_KEY, sz)
}

function setTheme(id) {
	themeId.value = id
	uni.setStorageSync(THEME_KEY, id)
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

async function loadChapter() {
	loading.value = true
	emptyHint.value = ''
	stopAudio()
	clearTranslation()
	try {
		await loadBooks()
		const res = await apiBibleChapter({
			translation: translation.value,
			book: bookKey.value,
			chapter: chapterNum.value,
		})
		const d = res?.results || {}
		verses.value = d.verses || []
		audioUrl.value = absolutizeMedia(d.audio_url || '')
		audioDurationSec.value = Number(d.audio_duration_sec) || 0
		listeningVerse.value = 0
		scrollInto.value = ''
		if (d.book_name) bookName.value = d.book_name
		if (d.book_key) bookKey.value = d.book_key
		if (!verses.value.length) emptyHint.value = t('bible_empty')
		selectedVerse.value = null
		await loadHighlights()
		track('manna_bible_read', { book: bookKey.value, chapter: chapterNum.value })
	} catch (e) {
		verses.value = []
		emptyHint.value = e?.message || t('bible_empty')
	} finally {
		loading.value = false
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
				map[h.verse] = h.id
			}
		})
		highlightMap.value = map
	} catch (e) {}
}

function selectBook(b) {
	if (!b) return
	bookKey.value = b.book_key
	bookName.value = b.name || b.book_key
	chapterCount.value = Math.max(1, Number(b.chapter_count) || 1)
	chapterNum.value = 1
	closeSheet()
	loadChapter()
}

function selectChapter(n) {
	chapterNum.value = n
	closeSheet()
	loadChapter()
}

function onTapVerse(v) {
	selectedVerse.value = v
}

async function toggleHighlight(v, { silent } = {}) {
	if (!v) return
	const existing = highlightMap.value[v.verse]
	try {
		if (existing) {
			await apiBibleHighlightSave({ delete_id: existing })
			const next = { ...highlightMap.value }
			delete next[v.verse]
			highlightMap.value = next
			if (!silent) uni.showToast({ title: t('bible_unhighlighted'), icon: 'none' })
		} else {
			const res = await apiBibleHighlightSave({
				translation_code: translation.value,
				book_key: bookKey.value,
				chapter: chapterNum.value,
				verse: v.verse,
				color: 'gold',
			})
			const id = res?.results?.id
			if (id) highlightMap.value = { ...highlightMap.value, [v.verse]: id }
			else await loadHighlights()
			if (!silent) uni.showToast({ title: t('bible_highlighted'), icon: 'none' })
		}
	} catch (e) {
		uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
	}
}

async function onLongPress(v) {
	selectedVerse.value = v
	uni.showActionSheet({
		itemList: [t('bible_highlight'), t('bible_notes'), t('bible_amen_verse')],
		success: async (res) => {
			if (res.tapIndex === 0) await toggleHighlight(v)
			else if (res.tapIndex === 1) openNoteSheet(v)
			else if (res.tapIndex === 2) await amenVerse(v)
		},
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
		await apiBibleAmenVerse({
			translation_code: translation.value,
			book_key: bookKey.value,
			chapter: chapterNum.value,
			verse: v.verse,
			ref: `${bookName.value} ${chapterNum.value}:${v.verse}`,
		})
		amenMap.value = { ...amenMap.value, [v.verse]: true }
		uni.showToast({ title: t('amen_done'), icon: 'none' })
		track('manna_amen', { scene: 'bible_verse', verse: v.verse })
	} catch (e) {
		uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
	}
}

async function onBookmark() {
	const v = selectedVerse.value
	if (!v) {
		uni.showToast({ title: t('bible_pick_verse'), icon: 'none' })
		return
	}
	await toggleHighlight(v)
}

function stopAudioTick() {
	if (audioTick) {
		clearInterval(audioTick)
		audioTick = null
	}
}

function verseCharWeights() {
	return verses.value.map((v) => Math.max(12, String(v.text || '').length))
}

function estimateAudioDuration() {
	if (audioDurationSec.value > 0) return audioDurationSec.value
	const chars = verseCharWeights().reduce((a, b) => a + b, 0)
	/* 约 12 字符/秒 的朗读估算，无 duration 时兜底 */
	return Math.max(8, chars / 12)
}

function verseAtPlaybackTime(t, duration) {
	const list = verses.value
	if (!list.length) return 0
	const weights = verseCharWeights()
	const total = weights.reduce((a, b) => a + b, 0) || 1
	const dur = duration > 0 ? duration : estimateAudioDuration()
	const target = Math.max(0, Math.min(1, t / dur)) * total
	let acc = 0
	for (let i = 0; i < list.length; i++) {
		acc += weights[i]
		if (target <= acc) return list[i].verse
	}
	return list[list.length - 1].verse
}

function syncListeningVerse() {
	if (!innerAudio || !audioPlaying.value) return
	const t = Number(innerAudio.currentTime) || 0
	const d = Number(innerAudio.duration) || 0
	if (d > 0) audioDurationSec.value = d
	const next = verseAtPlaybackTime(t, d || audioDurationSec.value)
	if (!next || next === listeningVerse.value) return
	listeningVerse.value = next
	const now = Date.now()
	if (now >= scrollLockUntil) {
		scrollInto.value = `verse-${next}`
		scrollLockUntil = now + 400
	}
}

function startAudioTick() {
	stopAudioTick()
	syncListeningVerse()
	audioTick = setInterval(syncListeningVerse, 220)
}

function stopAudio() {
	stopAudioTick()
	if (innerAudio) {
		try { innerAudio.stop() } catch (e) {}
		try { innerAudio.destroy() } catch (e) {}
		innerAudio = null
	}
	audioPlaying.value = false
	listeningVerse.value = 0
	scrollInto.value = ''
}

const fabFlow = ref(false)
let fabFlowTimer = null

function pulseFabGlass() {
	fabFlow.value = false
	nextTick(() => {
		fabFlow.value = true
		if (fabFlowTimer) clearTimeout(fabFlowTimer)
		fabFlowTimer = setTimeout(() => {
			fabFlow.value = false
			fabFlowTimer = null
		}, 780)
	})
}

function onFabTap() {
	pulseFabGlass()
	// Figma 440:862：进全屏听经；无音频也用 demo 贴稿
	const name = encodeURIComponent(bookName.value || '')
	uni.navigateTo({
		url: `/pagesA/bible/listen?book=${encodeURIComponent(bookKey.value || 'genesis')}&chapter=${chapterNum.value || 1}&name=${name}&autoplay=1`,
	})
}

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

const localeAbbr = computed(() => {
	// 依赖 i18n.locale，设置页切换后 FAB 缩写会更新
	const code = String(i18n.global.locale.value || getLocale() || 'en').toLowerCase().split('-')[0]
	return LOCALE_ABBR[code] || code.toUpperCase().slice(0, 2)
})

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

function googleTlCode(locale) {
	const code = String(locale || 'en').toLowerCase().split('-')[0]
	return GOOGLE_TL[code] || 'en'
}

function verseText(v) {
	if (!v) return ''
	if (showTranslated.value && translatedMap.value[v.verse]) {
		return translatedMap.value[v.verse]
	}
	return v.text || ''
}

function clearTranslation() {
	translatedMap.value = {}
	showTranslated.value = false
}

function onTranslateTap() {
	if (!verses.value.length) {
		uni.showToast({ title: t('bible_empty'), icon: 'none' })
		return
	}
	if (translateBusy.value) return
	translateTarget.value = getLocale() || 'en'
	sheet.value = 'translate'
}

function restoreOriginal() {
	showTranslated.value = false
	closeSheet()
}

async function confirmTranslate() {
	if (translateBusy.value || !verses.value.length) return
	const locale = translateTarget.value || getLocale() || 'en'
	const tl = googleTlCode(locale)
	const list = verses.value.slice()
	const texts = list.map((v) => String(v.text || ''))
	const reqBook = bookKey.value
	const reqChapter = Number(chapterNum.value) || 1
	translateBusy.value = true
	closeSheet()
	uni.showLoading({
		title: t('bible_translate_from_google'),
		mask: true,
	})
	track('manna_bible_translate', {
		book: reqBook,
		chapter: reqChapter,
		locale,
		tl,
		scope: 'chapter',
	})
	try {
		const res = await apiBibleTranslate(
			{
				texts,
				target: tl,
				source: 'auto',
			},
			{
				// 页面自行 toast，避免 http 层再弹一次
				errorOutput: false,
			},
		)
		// 换章期间旧请求返回：丢弃，避免串章/串译文
		if (bookKey.value !== reqBook || Number(chapterNum.value) !== reqChapter) {
			uni.hideLoading()
			return
		}
		const out = (res?.results && res.results.translations) || []
		const map = {}
		list.forEach((v, idx) => {
			const next = out[idx]
			if (next != null && String(next).length) map[v.verse] = String(next)
		})
		uni.hideLoading()
		if (!Object.keys(map).length) {
			uni.showToast({ title: t('bible_translate_fail'), icon: 'none' })
			return
		}
		translatedMap.value = map
		showTranslated.value = true
		uni.showToast({
			title: t('bible_translate_from_google'),
			icon: 'none',
			duration: 2000,
		})
	} catch (e) {
		uni.hideLoading()
		if (bookKey.value !== reqBook || Number(chapterNum.value) !== reqChapter) return
		uni.showToast({ title: e?.message || t('bible_translate_fail'), icon: 'none' })
	} finally {
		translateBusy.value = false
	}
}

function toggleAudio() {
	if (!audioUrl.value) return
	if (!innerAudio) {
		innerAudio = uni.createInnerAudioContext()
		innerAudio.src = audioUrl.value
		innerAudio.onEnded(() => {
			audioPlaying.value = false
			stopAudioTick()
			listeningVerse.value = 0
			scrollInto.value = ''
		})
		innerAudio.onPause(() => {
			audioPlaying.value = false
			stopAudioTick()
		})
		innerAudio.onPlay(() => {
			audioPlaying.value = true
			startAudioTick()
		})
		innerAudio.onStop(() => {
			audioPlaying.value = false
			stopAudioTick()
			listeningVerse.value = 0
		})
		innerAudio.onError(() => {
			audioPlaying.value = false
			stopAudioTick()
			listeningVerse.value = 0
			uni.showToast({ title: t('bible_audio_fail'), icon: 'none' })
		})
	}
	if (audioPlaying.value) {
		innerAudio.pause()
		audioPlaying.value = false
		stopAudioTick()
	} else {
		innerAudio.play()
		audioPlaying.value = true
		startAudioTick()
	}
}

const LISTEN_KEY = 'manna_bible_listen'
let pendingAutoplay = false

async function applyListenIntent() {
	let intent = null
	try {
		intent = uni.getStorageSync(LISTEN_KEY) || null
		uni.removeStorageSync(LISTEN_KEY)
	} catch (e) {
		intent = null
	}
	if (!intent || typeof intent !== 'object') return
	if (intent.book) bookKey.value = String(intent.book)
	if (intent.chapter) chapterNum.value = Number(intent.chapter) || 1
	pendingAutoplay = !!intent.autoplay
	await loadChapter()
	if (pendingAutoplay && audioUrl.value) {
		pendingAutoplay = false
		toggleAudio()
	} else if (pendingAutoplay) {
		pendingAutoplay = false
		uni.showToast({ title: t('bible_audio_fail'), icon: 'none' })
	}
}

onMounted(async () => {
	tabOn.value = true
	hideNativeTabBar()
	readStart = Date.now()
	try {
		await ensureLogin({ explicit: true })
	} catch (e) {}
	const hasIntent = !!uni.getStorageSync(LISTEN_KEY)
	if (hasIntent) await applyListenIntent()
	else await loadChapter()
})

onShow(async () => {
	tabOn.value = true
	hideNativeTabBar()
	if (uni.getStorageSync(LISTEN_KEY)) await applyListenIntent()
})

onHide(() => {
	tabOn.value = false
})

onUnload(() => {
	if (fabFlowTimer) {
		clearTimeout(fabFlowTimer)
		fabFlowTimer = null
	}
	if (translateBusy.value) {
		try { uni.hideLoading() } catch (e) {}
		translateBusy.value = false
	}
	const sec = Math.round((Date.now() - readStart) / 1000)
	if (sec > 0) {
		apiBibleReadProgress({
			seconds: sec,
			book_key: bookKey.value,
			chapter: chapterNum.value,
		}).catch(() => {})
	}
	stopAudio()
})
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	min-height: 100vh;
	height: 100vh;
	padding: 0 0 calc(#{$manna-page-pad-bottom} + env(safe-area-inset-bottom, 0px));
	box-sizing: border-box;
	background: #ffffff;
	display: flex;
	flex-direction: column;
	color: $manna-btn-text;
}

.page.theme-peach { background: #fff4ee; }
.page.theme-mint { background: #eefff1; }
.page.theme-dark {
	background: #212121;
	color: #ffffff;
	.page__title, .page__aa, .reader__v .n, .reader__v .t { color: #ffffff; }
	.page__tool { filter: brightness(0) invert(1); }
	.reader__v.is-sel { background: rgba(255, 255, 255, 0.08); }
	.reader__v.is-hi { background: rgba(250, 208, 44, 0.28); }
	.reader__v.is-listening { background: rgba(250, 208, 44, 0.42); }
	.reader__v.is-heard { background: rgba(250, 208, 44, 0.16); }
	.reader__empty { color: rgba(255, 255, 255, 0.45); }
}

.page__bar {
	display: flex;
	justify-content: space-between;
	align-items: center;
	height: 96rpx;
	padding: 0 40rpx;
	box-sizing: border-box;
	flex-shrink: 0;
}

.page__title-wrap {
	display: flex;
	align-items: center;
	max-width: 52%;
}

.page__title {
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 36rpx;
	color: $manna-btn-text;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.page__tools {
	display: flex;
	align-items: center;
}

.page__tools .page__aa,
.page__tools .page__tool {
	margin-left: 24rpx;
}

.page__tools .page__aa:first-child {
	margin-left: 0;
}

.page__aa {
	font-family: $manna-font-body;
	font-size: 32rpx;
	color: $manna-btn-text;
	line-height: 64rpx;
	width: 64rpx;
	text-align: center;
}

.page__tool {
	width: 64rpx;
	height: 64rpx;
}

.page__press { opacity: 0.55; }

.reader {
	flex: 1;
	height: 0;
	padding: 0 0 40rpx;
	box-sizing: border-box;
}

.reader__v {
	display: flex;
	align-items: flex-start;
	padding: 20rpx 48rpx;
	box-sizing: border-box;
	transition: background-color 0.2s ease;
}

.reader__v.is-hi { background: rgba(250, 208, 44, 0.18); }
.reader__v.is-amen { box-shadow: inset 3px 0 0 #c4a574; }
.reader__v.is-sel { background: rgba(33, 33, 33, 0.04); }
.reader__v.is-heard { background: rgba(250, 208, 44, 0.12); }
.reader__v.is-listening { background: rgba(250, 208, 44, 0.38); }
.reader__v.is-listening .n { opacity: 0.85; font-weight: 500; }
.reader__v.is-listening .t { font-weight: 500; }

.reader__v .n {
	font-family: $manna-font-body;
	font-weight: 300;
	font-size: 24rpx;
	line-height: 56rpx;
	letter-spacing: 0.01em;
	opacity: 0.5;
	color: $manna-btn-text;
	flex-shrink: 0;
	min-width: 28rpx;
	margin-right: 16rpx;
}

.reader__v .t {
	font-family: $manna-font-body !important;
	font-weight: 300;
	/* Figma：16px / leading 28px */
	line-height: 56rpx;
	letter-spacing: 0.01em;
	color: $manna-btn-text;
	flex: 1;
}

.reader__empty {
	display: block;
	padding: 48rpx;
	font-family: $manna-font-body;
	font-size: 26rpx;
	color: rgba(33, 33, 33, 0.45);
	line-height: 1.5;
}

.reader__pad { height: 280rpx; }

.fab {
	position: fixed;
	/* Figma 漂在经文区中下部，不贴 Tab */
	left: 50%;
	bottom: calc(#{$manna-page-pad-bottom} + 20rpx + env(safe-area-inset-bottom, 0px));
	transform: translateX(-50%);
	z-index: 50;
	width: 128rpx;
	height: 128rpx;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: visible;
	isolation: isolate;
	background: transparent;
	border: none;
	box-shadow: none;
	box-sizing: border-box;
}

.fab--translate {
	left: auto;
	right: 24rpx;
	bottom: calc(#{$manna-page-pad-bottom} + 20rpx + env(safe-area-inset-bottom, 0px));
	transform: none;
	width: 128rpx;
	height: 128rpx;
}

.fab__glass--side {
	/* 与播放态 fab__glass 同径 */
	inset: 16rpx;
	box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.18);
}

.fab__abbr {
	position: relative;
	z-index: 3;
	font-family: $manna-font-body;
	font-size: 28rpx;
	font-weight: 700;
	letter-spacing: 0.04em;
	color: #212121;
	line-height: 1;
}

.fab--translate-on .fab__glass--side {
	background: #fff3ee;
}

.fab--translate-on .fab__abbr {
	color: #212121;
}

.fab__full {
	width: 192rpx;
	height: 192rpx;
}

.fab__glass {
	position: absolute;
	inset: 16rpx;
	border-radius: 50%;
	background: #ffffff;
	box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.18);
	z-index: 0;
	pointer-events: none;
}

.fab--playing {
	background: transparent;
}

.fab--press {
	transform: translateX(-50%) scale(0.96);
}

.fab--press-side {
	transform: scale(0.96);
	opacity: 0.92;
}

.fab__ico {
	position: relative;
	z-index: 3;
	width: 48rpx;
	height: 48rpx;
}

.mask {
	position: fixed;
	inset: 0;
	z-index: 1100; /* 高于 MannaTabBar(1000)，避免字体/主题控件被底栏盖住 */
	background: rgba(33, 33, 33, 0.28);
	display: flex;
	align-items: flex-end;
}

.sheet {
	width: 100%;
	background: #ffffff;
	border-radius: 40rpx 40rpx 0 0;
	/* 底栏高度 + 悬浮间隙 + 安全区，保证主题色块/字号控件完整可点 */
	padding: 16rpx 40rpx calc(#{$manna-tab-h} + 52rpx + env(safe-area-inset-bottom, 0px));
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 24rpx;
	max-height: 72vh;
}

.sheet--tall {
	max-height: 78vh;
	height: 78vh;
	padding-bottom: calc(#{$manna-tab-h} + 52rpx + env(safe-area-inset-bottom, 0px));
}

.sheet__handle {
	width: 96rpx;
	height: 12rpx;
	border-radius: 20rpx;
	background: rgba(33, 33, 33, 0.1);
}

.sheet__label {
	font-family: $manna-font-body;
	font-size: 32rpx;
	font-weight: 700;
	color: #212121;
	align-self: flex-start;
}

.sheet__preview {
	align-self: stretch;
	font-family: $manna-font-body;
	font-weight: 300;
	line-height: 1.6;
	color: #212121;
	padding: 12rpx 0 4rpx;
}

.sheet__meta {
	align-self: stretch;
	font-family: $manna-font-body;
	font-size: 24rpx;
	font-weight: 400;
	color: rgba(33, 33, 33, 0.45);
	padding: 0 0 8rpx;
}

.note-input {
	align-self: stretch;
	min-height: 200rpx;
	width: 100%;
	padding: 20rpx;
	box-sizing: border-box;
	border-radius: 16rpx;
	background: rgba(33, 33, 33, 0.04);
	font-size: 28rpx;
	color: #212121;
	margin-bottom: 24rpx;
}

.note-save {
	align-self: stretch;
	height: 88rpx;
	border: none;
	border-radius: 999rpx;
	background: #fff3ee;
	color: #212121;
	font-weight: 700;
	font-size: 30rpx;
}

.note-save::after { border: none; }
.note-save--press { opacity: 0.88; }

.sheet__cta {
	align-self: stretch;
	height: 88rpx;
	border-radius: 999rpx;
	background: #fff3ee;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}

.sheet__cta--ghost {
	margin-top: 16rpx;
	background: rgba(33, 33, 33, 0.04);
}

.sheet__cta--press {
	opacity: 0.88;
}

.sheet__cta--disabled {
	opacity: 0.45;
	pointer-events: none;
}

.sheet__cta-txt {
	font-family: $manna-font-body;
	font-size: 30rpx;
	font-weight: 700;
	color: #212121;
	line-height: 1;
}

.sheet__scroll {
	width: 100%;
	flex: 1;
	height: 0;
}

.font-row {
	width: 100%;
	display: flex;
	align-items: center;
	gap: 20rpx;
}

.font-row__aa {
	font-family: $manna-font-body;
	font-size: 32rpx;
	color: #212121;
}

.font-pills {
	flex: 1;
	height: 48rpx;
	border-radius: 60rpx;
	background: rgba(33, 33, 33, 0.05);
	display: flex;
	align-items: stretch;
	overflow: hidden;
}

.font-pill {
	flex: 1;
	display: flex;
	align-items: center;
	justify-content: center;
	font-family: $manna-font-body;
	font-size: 24rpx;
	font-weight: 300;
	color: #212121;
}

.font-pill--on {
	background: #212121;
	color: #ffffff;
	border-radius: 60rpx;
	font-weight: 400;
}

.theme-row {
	width: 100%;
	display: flex;
	gap: 20rpx;
}

.theme-swatch {
	flex: 1;
	height: 128rpx;
	border-radius: 16rpx;
	border: 2rpx solid rgba(33, 33, 33, 0.1);
	position: relative;
	box-sizing: border-box;
}

.theme-swatch--white { background: #ffffff; }
.theme-swatch--peach { background: #fff4ee; border: none; }
.theme-swatch--mint { background: #eefff1; border: none; }
.theme-swatch--dark { background: #212121; border: none; }

.theme-swatch__check {
	position: absolute;
	right: 12rpx;
	bottom: 12rpx;
	width: 28rpx;
	height: 28rpx;
	border-radius: 50%;
	border: 2rpx solid rgba(33, 33, 33, 0.2);
	box-sizing: border-box;
}

.theme-swatch--on .theme-swatch__check {
	background: #212121;
	border-color: #212121;
}

.theme-swatch--dark .theme-swatch__check { border-color: rgba(255, 255, 255, 0.35); }
.theme-swatch--dark.theme-swatch--on .theme-swatch__check {
	background: #ffffff;
	border-color: #ffffff;
}

.tags {
	width: 100%;
	display: flex;
	flex-wrap: wrap;
	gap: 16rpx;
}

.tag {
	padding: 12rpx 28rpx;
	border-radius: 999rpx;
	background: rgba(33, 33, 33, 0.05);
	font-family: $manna-font-body;
	font-size: 26rpx;
	color: #212121;
}

.tag--on {
	background: $manna-tag-on;
	font-weight: 700;
}

.book-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 16rpx;
	padding-bottom: 24rpx;
}

.book-cell {
	width: calc(50% - 8rpx);
	box-sizing: border-box;
	padding: 28rpx 20rpx;
	border-radius: 16rpx;
	background: rgba(33, 33, 33, 0.04);
	font-family: $manna-font-body;
	font-size: 28rpx;
	color: #212121;
	text-align: center;
}

.book-cell--on {
	background: #212121;
	color: #ffffff;
	font-weight: 700;
}

.chap-grid {
	display: flex;
	flex-wrap: wrap;
	gap: 16rpx;
	padding-bottom: 24rpx;
}

.chap-cell {
	width: calc(16.666% - 14rpx);
	aspect-ratio: 1;
	box-sizing: border-box;
	border-radius: 16rpx;
	background: rgba(33, 33, 33, 0.04);
	display: flex;
	align-items: center;
	justify-content: center;
	font-family: $manna-font-body;
	font-size: 28rpx;
	color: #212121;
}

.chap-cell--on {
	background: #212121;
	color: #ffffff;
	font-weight: 700;
}
</style>
