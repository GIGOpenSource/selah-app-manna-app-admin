<template>
	<!-- Bible Hub：Progress / Note / Highlight / BookMark / VerseCard -->
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<view class="cross" aria-hidden="true">
			<view class="cross__v" />
			<view class="cross__h" />
		</view>

		<view class="nav">
			<view class="nav__back" hover-class="press" @click="back">
				<image class="nav__back-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
			</view>
			<text class="nav__title">{{ t('bible') }}</text>
		</view>

		<scroll-view scroll-x class="tabs" :show-scrollbar="false" enable-flex>
			<view class="tabs__inner">
				<view
					v-for="tab in tabs"
					:key="tab.id"
					class="tabs__pill"
					:class="{ 'tabs__pill--on': active === tab.id }"
					hover-class="press"
					@click="setTab(tab.id)"
				>
					<text class="tabs__txt">{{ tab.label }}</text>
				</view>
			</view>
		</scroll-view>

		<scroll-view
			scroll-y
			class="list"
			style="height: 1120rpx;"
			:show-scrollbar="false"
			enable-flex
		>
			<!-- Progress -->
			<template v-if="active === 'progress'">
				<view
					v-for="row in progressRows"
					:key="row.book_key"
					class="row"
					hover-class="press"
					@click="openProgress(row)"
				>
					<view class="ring" :style="ringStyle(row.pct)">
						<text class="ring__n">{{ row.pct }}%</text>
					</view>
					<view class="row__mid">
						<text class="row__t">{{ row.book_name }}</text>
						<text class="row__m">{{ row.subtitle }}</text>
					</view>
					<image class="row__chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
				<text v-if="!progressRows.length && !loading" class="empty">{{ t('bible_progress_empty') }}</text>
			</template>

			<!-- Note -->
			<template v-else-if="active === 'note'">
				<view v-for="n in notes" :key="n.id" class="card" @click="openHighlight(n)">
					<text class="card__body">{{ n.body }}</text>
					<text class="card__ref">{{ formatNoteRef(n) }}</text>
					<view class="card__foot">
						<text class="card__date">{{ n.date || '—' }}</text>
						<image
							class="card__trash"
							src="/static/ui/ico-trash.svg"
							mode="aspectFit"
							hover-class="press"
							@click.stop="removeNote(n)"
						/>
					</view>
				</view>
				<text v-if="!notes.length && !loading" class="empty">{{ t('notes_empty') }}</text>
			</template>

			<!-- Highlight -->
			<template v-else-if="active === 'highlight'">
				<view v-for="h in highlights" :key="h.id" class="card" hover-class="press" @click="openHighlight(h)">
					<view class="card__head">
						<view class="card__head-l">
							<text class="card__hi-ref">{{ formatHiRef(h) }}</text>
							<text class="card__date card__date--inline">{{ h.date || '—' }}</text>
						</view>
						<image
							class="card__trash"
							src="/static/ui/ico-trash.svg"
							mode="aspectFit"
							hover-class="press"
							@click.stop="removeHighlight(h)"
						/>
					</view>
					<view class="hi" :class="'hi--' + (h.color || 'gold')">
						<text class="hi__txt">{{ h.verse_text || h.text || formatHiRef(h) }}</text>
					</view>
				</view>
				<text v-if="!highlights.length && !loading" class="empty">{{ t('highlights_empty') }}</text>
			</template>

			<!-- BookMark：collections.favorites → bible_bookmark -->
			<template v-else-if="active === 'bookmark'">
				<view
					v-for="b in bookmarks"
					:key="b.verse_id"
					class="card"
					hover-class="press"
					@click="openBookmark(b)"
				>
					<text class="card__title">{{ b.reference }}</text>
					<text v-if="b.text" class="card__body card__body--sm">{{ b.text }}</text>
					<view class="card__foot">
						<text class="card__date">{{ b.created_at || '—' }}</text>
						<image
							class="card__trash"
							src="/static/ui/ico-trash.svg"
							mode="aspectFit"
							hover-class="press"
							@click.stop="removeBookmark(b)"
						/>
					</view>
				</view>
				<text v-if="!bookmarks.length && !loading" class="empty">{{ t('bookmarks_empty') }}</text>
			</template>

			<!-- VerseCard：完整展示 collections.favorites -->
			<template v-else>
				<view
					v-for="c in verseCards"
					:key="c.id"
					class="vcard"
					hover-class="press"
					@click="openVerseCard(c)"
				>
					<view
						class="vcard__media"
						:style="c.cover ? { backgroundImage: `url(${c.cover})` } : {}"
					>
						<view class="vcard__scrim" />
						<view class="vcard__copy">
							<text class="vcard__verse" :class="{ 'vcard__verse--dark': c.darkText }">{{ c.quote }}</text>
							<text v-if="c.ref" class="vcard__ref" :class="{ 'vcard__ref--dark': c.darkText }">{{ c.ref }}</text>
						</view>
					</view>
					<view class="vcard__foot">
						<text class="card__date">{{ c.date || '—' }}</text>
						<view class="vcard__acts">
							<image
								class="vcard__act"
								src="/static/ui/bible/ico-share-card.svg"
								mode="aspectFit"
								@click.stop="shareCard(c)"
							/>
							<image
								class="vcard__act"
								src="/static/ui/bible/ico-download-card.svg"
								mode="aspectFit"
								@click.stop="downloadCard(c)"
							/>
						</view>
					</view>
				</view>
				<text v-if="!verseCards.length && !loading" class="empty">{{ t('collections_empty') }}</text>
			</template>
		</scroll-view>

		<!-- 离屏合成：一键分享 / 下载（复用 versecard 的 l-painter 海报逻辑） -->
		<l-painter
			ref="painter"
			:key="paintKey"
			:width="posterLayout.width + 'rpx'"
			:height="posterLayout.height + 'rpx'"
			path-type="url"
			:hidden="true"
			:pixel-ratio="2"
			:useCORS="true"
		>
			<l-painter-view :css="posterRootCss">
				<l-painter-image :src="pBg" :css="posterFillCss + ' object-fit: cover;'" />
				<l-painter-view
					:css="posterFillCss + ' background: linear-gradient(180deg, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.06) 42%, rgba(0,0,0,0.28) 100%);'"
				/>
				<l-painter-view :css="posterTextWrapCss">
					<l-painter-text :text="pVerseLine" :css="posterVerseCss" />
					<l-painter-text v-if="pRefLine" :text="pRefLine" :css="posterRefCss" />
				</l-painter-view>
				<l-painter-view :css="posterWmCss">
					<l-painter-view :css="posterWmLineCss" />
					<l-painter-text :text="pWmText" :css="posterWmTextCss" />
					<l-painter-view :css="posterWmLineCss" />
				</l-painter-view>
			</l-painter-view>
		</l-painter>
	</view>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import {
	apiBibleChapter,
	apiBibleNotes,
	apiBibleNoteSave,
	apiBibleHighlights,
	apiBibleHighlightSave,
} from '@/api/bible.js'
import { apiMannaCollections, apiMannaFavoriteToggle } from '@/api/manna.js'
import { systemShare, saveImageToAlbum } from '@/utils/share.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { decodeAssetPath } from '@/utils/homeBg.js'
import { absolutizeMedia } from '@/utils/media.js'
import LPainter from 'lime-painter/components/l-painter/l-painter.vue'
import LPainterView from 'lime-painter/components/l-painter-view/l-painter-view.vue'
import LPainterImage from 'lime-painter/components/l-painter-image/l-painter-image.vue'
import LPainterText from 'lime-painter/components/l-painter-text/l-painter-text.vue'

const PROGRESS_KEY = 'manna_bible_progress'
const PROGRESS_MAP_KEY = 'manna_bible_book_progress'
const statusBar = getStatusBarPx()

const active = ref('progress')
const loading = ref(false)
const listH = ref(0)
const progressRows = ref([])
const notes = ref([])
const highlights = ref([])
const bookmarks = ref([])
const verseCards = ref([])

const tabs = computed(() => [
	{ id: 'progress', label: t('bible_hub_tab_progress') },
	{ id: 'note', label: t('bible_hub_tab_note') },
	{ id: 'highlight', label: t('bible_hub_tab_highlight') },
	{ id: 'bookmark', label: t('bible_hub_tab_bookmark') },
	{ id: 'versecard', label: t('bible_hub_tab_versecard') },
])

const listStyle = computed(() => (listH.value > 0 ? { height: `${listH.value}px` } : {}))

function measureList() {
	try {
		const sys = uni.getSystemInfoSync() || {}
		const winH = Number(sys.windowHeight) || 0
		// nav(~56) + tabs(~64) + paddings；剩余给列表
		const top = Number(statusBar) + 56 + 64 + 24
		listH.value = Math.max(200, winH - top)
	} catch (e) {
		listH.value = 480
	}
}

function fmtDate(raw) {
	if (raw == null || raw === '') return ''
	if (typeof raw === 'number') {
		const ms = raw < 1e12 ? raw * 1000 : raw
		const d = new Date(ms)
		if (!Number.isNaN(d.getTime())) {
			return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
		}
	}
	const d = new Date(raw)
	if (Number.isNaN(d.getTime())) {
		const s = String(raw).slice(0, 10)
		if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/.test(s)) return s.replace(/[-/]/g, '.')
		return ''
	}
	return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}

function itemDate(row) {
	if (!row || typeof row !== 'object') return ''
	return fmtDate(
		row.created_at ||
		row.updated_at ||
		row.create_time ||
		row.createdAt ||
		row.updatedAt ||
		row.time ||
		row.date ||
		''
	)
}

function asList(raw) {
	if (Array.isArray(raw)) return raw
	if (Array.isArray(raw?.results)) return raw.results
	if (Array.isArray(raw?.list)) return raw.list
	if (Array.isArray(raw?.items)) return raw.items
	return []
}

function titleCaseBook(raw) {
	const s = String(raw || '').replace(/[_-]+/g, ' ').trim()
	if (!s) return ''
	return s.replace(/\b\w/g, (ch) => ch.toUpperCase())
}

function ringStyle(pct) {
	const p = Math.max(0, Math.min(100, Number(pct) || 0))
	return {
		background: `conic-gradient(#52aa4b 0% ${p}%, rgba(33,33,33,0.08) ${p}% 100%)`,
	}
}

function setTab(id) {
	active.value = id
	loadTab(id)
}

function formatNoteRef(n) {
	const book = n.book_name || titleCaseBook(n.book_key) || n.book_key || ''
	const ch = n.chapter
	const v = n.verse
	const text = String(n.verse_text || n.text || '').trim()
	const ref = book && ch ? `${book} ${ch}:${v || ''}` : ''
	if (ref && text) return `${ref} : ${text}`
	return ref || text
}

function formatHiRef(h) {
	const book = h.book_name || titleCaseBook(h.book_key) || h.book_key || ''
	const ch = h.chapter
	const v = h.verse
	if (book && ch) return `${book} ${ch}:${v || ''}`
	return ''
}

function coverMap() {
	try {
		return uni.getStorageSync('manna_verse_card_covers') || {}
	} catch (e) {
		return {}
	}
}

function parseBookmarkKey(raw) {
	const parts = String(raw || '').split(':')
	if (parts.length < 3) return {}
	return {
		translation: parts[0] || '',
		book_key: parts[1] || '',
		chapter: Number(parts[2]) || 1,
		verse: Number(parts[3]) || 0,
	}
}

function parseVerseCardKey(raw) {
	const s = String(raw || '')
	const pipe = s.indexOf('|')
	if (pipe < 0) return { ref: s, text: '' }
	return { ref: s.slice(0, pipe), text: s.slice(pipe + 1) }
}

function mergeById(primary, secondary) {
	const map = new Map()
	asList(secondary).forEach((row) => {
		if (row && row.id != null) map.set(row.id, row)
	})
	const out = []
	const seen = new Set()
	asList(primary).forEach((row) => {
		if (!row) return
		const extra = row.id != null ? map.get(row.id) : null
		const merged = extra ? { ...extra, ...row } : { ...row }
		if (merged.id != null) seen.add(merged.id)
		out.push(merged)
	})
	asList(secondary).forEach((row) => {
		if (!row || (row.id != null && seen.has(row.id))) return
		out.push({ ...row })
	})
	return out
}

async function loadProgress() {
	let map = {}
	try {
		map = uni.getStorageSync(PROGRESS_MAP_KEY) || {}
	} catch (e) {}
	const cur = (() => {
		try { return uni.getStorageSync(PROGRESS_KEY) || {} } catch (e) { return {} }
	})()
	if (cur.book_key && !map[cur.book_key]) {
		map[cur.book_key] = {
			book_key: cur.book_key,
			book_name: cur.book_name || titleCaseBook(cur.book_key),
			chapter: Number(cur.chapter) || 1,
			chapter_count: Number(cur.chapter_count) || 0,
			translation: cur.translation || 'web',
			snippet: '',
			updated_at: Date.now(),
		}
	}
	const rows = Object.values(map)
		.filter((r) => r && r.book_key)
		.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))

	const enriched = await Promise.all(rows.map(async (r) => {
		const max = Math.max(1, Number(r.chapter_count) || 0)
		const ch = Math.max(1, Number(r.chapter) || 1)
		let pct = max > 1 ? Math.min(100, Math.round((ch / max) * 100)) : (ch > 0 ? 25 : 0)
		if (!r.chapter_count) pct = Math.min(99, Math.max(5, ch * 5))
		let snippet = r.snippet || ''
		if (!snippet && r.book_key) {
			try {
				const res = await apiBibleChapter({
					book: r.book_key,
					chapter: ch,
					translation: r.translation || 'web',
				})
				const d = res?.results || {}
				const v0 = (d.verses || [])[0]
				snippet = (v0?.text || '').slice(0, 64)
				if (d.book_name) r.book_name = d.book_name
				if (d.chapter_count) {
					r.chapter_count = Number(d.chapter_count) || r.chapter_count
					const m = Math.max(1, Number(d.chapter_count) || 1)
					pct = Math.min(100, Math.round((ch / m) * 100))
				}
			} catch (e) {}
		}
		const book = r.book_name || titleCaseBook(r.book_key)
		return {
			...r,
			book_name: book,
			pct,
			subtitle: `${ch}:1- ${snippet || t('bible_hub_open')}`.slice(0, 48),
		}
	}))
	progressRows.value = enriched
}

/** Note / Highlight / BookMark / VerseCard
 *  主数据：/manna/collections/
 *  BookMark → favorites(bible_bookmark)
 *  VerseCard → favorites 全量
 *  Note / Highlight → notes / highlights（并与 bible API 合并）
 */
async function loadCollectionsBundle() {
	try {
		const [colRes, noteRes, hiRes] = await Promise.all([
			apiMannaCollections().catch(() => null),
			apiBibleNotes().catch(() => null),
			apiBibleHighlights().catch(() => null),
		])
		const d = colRes?.results || {}
		bookmarks.value = colRes?.results?.bookmarks || []
		// console.log('colRes', colRes)
		const fav = asList(d.favorites)
		const covers = coverMap()

		// 读经页只认 bible API；合并时以 bible 为主，保证删除 id 与读经一致
		const noteRows = mergeById(asList(noteRes?.results), asList(d.notes))
		notes.value = noteRows.map((row, i) => ({
			...row,
			id: row.id ?? `note-${i}`,
			date: itemDate(row),
		}))

		const hiRows = mergeById(asList(hiRes?.results), asList(d.highlights))
		highlights.value = hiRows.map((row, i) => ({
			...row,
			id: row.id ?? `hi-${i}`,
			date: itemDate(row),
		}))

		const bm = []
		const cards = []
		fav.forEach((row, i) => {
			const type = String(row.target_type || '')
			const key = String(row.target_key || '')
			const p = parseBookmarkKey(row.target_key)
			const bookKey = p.book_key || row.book_key || ''
			const book = row.book_name || titleCaseBook(bookKey)
			const ch = Number(row.chapter || p.chapter) || 0
			const v = Number(row.verse || p.verse) || 0
			const isBookmark = type === 'bible_bookmark' || (!type && /:\d+:\d*$/.test(key) && !key.includes('|'))
			const isCard = type === 'verse_card' || (!type && key.includes('|'))

			// BookMark 仍只收 bible_bookmark
			if (isBookmark) {
				bm.push({
					id: row.id ?? `bm-${i}`,
					target_key: row.target_key,
					book_key: bookKey,
					chapter: ch || 1,
					verse: v,
					title: book && ch ? `${book} ${ch}` : (book || t('bible_bookmark')),
					quote: String(row.verse_text || row.text || row.body || '').trim(),
					date: itemDate(row),
				})
			}

			// VerseCard Tab：完整展示 favorites 全部条目
			let quote = String(row.verse_text || row.text || row.body || row.quote || '').trim()
			let ref = String(row.reference || row.ref || '').replace(/^--\s*/, '')
			if (isCard) {
				const parsed = parseVerseCardKey(row.target_key)
				quote = quote || String(parsed.text || '').trim()
				ref = ref || String(parsed.ref || '').replace(/^--\s*/, '')
			} else if (book && ch) {
				const label = v > 0 ? `${book} ${ch}:${v}` : `${book} ${ch}`
				if (!quote) quote = label
				else if (!ref) ref = label
			}
			if (!quote && !bookKey && !key) return
			cards.push({
				id: row.id ?? `vc-${i}`,
				target_type: type || (isCard ? 'verse_card' : isBookmark ? 'bible_bookmark' : ''),
				target_key: row.target_key,
				book_key: bookKey,
				chapter: ch || 1,
				verse: v,
				quote: quote || ref || t('me_versecards'),
				ref: quote && ref ? ref : '',
				date: itemDate(row),
				cover: row.cover_url || covers[row.target_key] || '',
				darkText: false,
			})
		})
		verseCards.value = cards
	} catch (e) {
		notes.value = []
		highlights.value = []
		bookmarks.value = []
		verseCards.value = []
	}
}

async function loadTab(id) {
	loading.value = true
	try {
		if (id === 'progress') {
			await Promise.all([loadProgress(), loadCollectionsBundle()])
		} else {
			await loadCollectionsBundle()
		}
	} finally {
		loading.value = false
	}
}

function openProgress(row) {
	try {
		uni.setStorageSync('manna_bible_listen', {
			book: row.book_key,
			chapter: Number(row.chapter) || 1,
			autoplay: false,
		})
		uni.setStorageSync(PROGRESS_KEY, {
			book_key: row.book_key,
			book_name: row.book_name,
			chapter: Number(row.chapter) || 1,
			translation: row.translation || 'web',
		})
	} catch (e) {}
	uni.switchTab({ url: '/pages/bible/bible' })
}

function openBookmark(b) {
	try {
		uni.setStorageSync('manna_bible_listen', {
			book: b.book_key,
			chapter: Number(b.chapter) || 1,
			autoplay: false,
		})
	} catch (e) {}
	uni.switchTab({ url: '/pages/bible/bible' })
}

/** 点击高亮卡片：写跳转意图并切换到读经 Tab，由读经页 onShow 滚动到对应节 */
function openHighlight(h) {
	if (!h) return
	try {
		uni.setStorageSync('manna_bible_open_ref', {
			book_key: h.book_key,
			chapter: Number(h.chapter) || 1,
			verse: Number(h.verse) || 0,
			translation_code: h.translation_code || undefined,
		})
	} catch (e) {}
	uni.switchTab({ url: '/pages/bible/bible' })
}

function openVerseCard(c) {
	const type = String(c.target_type || '')
	if (type === 'prayer') {
		const raw = String(c.target_key || '')
		const kind = raw.startsWith('night:') ? 'night' : 'morning'
		uni.navigateTo({ url: `/pagesA/prayer/prayer?kind=${kind}` })
		return
	}
	if (type === 'bible_bookmark' || (c.book_key && type !== 'verse_card')) {
		openBookmark(c)
		return
	}
	try {
		uni.setStorageSync('manna_versecard_payload', {
			text: c.quote || '',
			ref: String(c.ref || '').replace(/^--\s*/, ''),
			brand: 'MANNA',
			bg: c.cover || '',
		})
	} catch (e) {}
	uni.navigateTo({ url: `/pagesA/share/versecard?confirm=confirmed` })
}

/** 一键分享 / 下载：在 bible-hub 内用 l-painter 复用 versecard 的海报合成逻辑，
 *  把「背景 + 经文 + 出处 + 水印」烤成带文字的海报，不再只发裸背景图。 */

const FALLBACK_POSTER_BG = '/static/ui/share/bg-embrace.png'
const POSTER_W = 750
const POSTER_MIN_H = 1334
const POSTER_TEXT_W = 670
const POSTER_PAD_TOP = 180
const POSTER_PAD_BOTTOM = 200
const VERSE_SIZE = 48
const VERSE_LH = 80
const REF_SIZE = 40
const REF_LH = 56
const REF_GAP = 48
const POSTER_WM_BOTTOM = 56
const POSTER_WM_SIDE = 40
const POSTER_WM_SIZE = 22
const POSTER_WM_LH = 32
const POSTER_WM_LINE_W = 36
const POSTER_WM_GAP = 24

const painter = ref(null)
const posterCard = ref({ text: '', ref: '', bg: '', wm: '' })

function spacePosterWm(raw) {
	const s = String(raw || '').trim()
	if (!s) return ''
	return ` ${Array.from(s).map((ch) => (ch === ' ' ? '  ' : ch)).join('  ')} `
}

function countPosterLines(text, charsPerLine) {
	const src = String(text || '')
	if (!src) return 0
	let lines = 0
	src.split(/\r?\n/).forEach((para) => {
		const chars = Array.from(para)
		if (!chars.length) {
			lines += 1
			return
		}
		let w = 0
		let n = 1
		chars.forEach((ch) => {
			const cw = /[\u0000-\u00ff]/.test(ch) ? 0.55 : 1
			w += cw
			if (w > charsPerLine) {
				n += 1
				w = cw
			}
		})
		lines += n
	})
	return Math.max(1, lines)
}

const pVerseLine = computed(() => posterCard.value.text || '')
const pRefLine = computed(() => posterCard.value.ref || '')
const pBg = computed(() => posterCard.value.bg || FALLBACK_POSTER_BG)
const pWmText = computed(() => posterCard.value.wm || '')

const posterLayout = computed(() => {
	const verse = pVerseLine.value
	const ref = pRefLine.value
	const versePerLine = Math.max(8, Math.floor(POSTER_TEXT_W / (VERSE_SIZE * 1.2)))
	const refPerLine = Math.max(10, Math.floor(POSTER_TEXT_W / (REF_SIZE * 1.2)))
	const verseLines = countPosterLines(verse, versePerLine)
	const refLines = ref ? countPosterLines(ref, refPerLine) : 0
	const verseH = verseLines * VERSE_LH
	const refH = refLines * REF_LH
	const gaps = ref ? REF_GAP : 0
	const block = verseH + gaps + refH
	const height = Math.max(POSTER_MIN_H, POSTER_PAD_TOP + block + POSTER_PAD_BOTTOM)
	const textTop = height <= POSTER_MIN_H
		? Math.max(POSTER_PAD_TOP, Math.round((height - block) / 2))
		: POSTER_PAD_TOP
	return { width: POSTER_W, height, textTop }
})

const posterRootCss = computed(
	() => `width: ${posterLayout.value.width}rpx; height: ${posterLayout.value.height}rpx; position: relative; background: #0a0a0a; overflow: hidden;`,
)
const posterFillCss = computed(
	() => `position: absolute; left: 0; top: 0; width: ${posterLayout.value.width}rpx; height: ${posterLayout.value.height}rpx;`,
)
const posterTextWrapCss = computed(
	() => `position: absolute; left: 40rpx; top: ${posterLayout.value.textTop}rpx; width: ${POSTER_TEXT_W}rpx; display: flex; flex-direction: column; align-items: center;`,
)
const posterVerseCss = computed(
	() => `width: ${POSTER_TEXT_W}rpx; font-size: ${VERSE_SIZE}rpx; font-weight: 700; color: #ffffff; line-height: ${VERSE_LH}rpx; letter-spacing: 0.48rpx; text-align: center; white-space: pre-wrap;`,
)
const posterRefCss = computed(
	() => `margin-top: ${REF_GAP}rpx; width: ${POSTER_TEXT_W}rpx; font-size: ${REF_SIZE}rpx; color: rgba(255,255,255,0.7); line-height: ${REF_LH}rpx; letter-spacing: 0.4rpx; text-align: center;`,
)
const posterWmCss = computed(
	() => `position: absolute; left: ${POSTER_WM_SIDE}rpx; bottom: ${POSTER_WM_BOTTOM}rpx; width: ${POSTER_W - POSTER_WM_SIDE * 2}rpx; height: ${POSTER_WM_LH}rpx; display: flex; flex-direction: row; align-items: center; justify-content: center;`,
)
const posterWmLineCss =
	`width: ${POSTER_WM_LINE_W}rpx; height: 2rpx; background: rgba(255,255,255,0.55); flex-shrink: 0;`
const posterWmTextCss =
	`margin: 0 ${POSTER_WM_GAP}rpx; font-size: ${POSTER_WM_SIZE}rpx; font-weight: 400; color: rgba(255,255,255,0.72); line-height: ${POSTER_WM_LH}rpx; text-align: center; flex-shrink: 0;`

const paintKey = computed(
	() => `${pVerseLine.value}|${pRefLine.value}|${pBg.value}|${posterLayout.value.height}|wm1`,
)

function normalizePosterBg(url) {
	const raw = decodeAssetPath(url)
	return absolutizeMedia(raw) || raw || FALLBACK_POSTER_BG
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function painterInst() {
	const p = painter.value
	if (!p) return null
	if (typeof p.canvasToTempFilePathSync === 'function') return p
	if (p.$vm && typeof p.$vm.canvasToTempFilePathSync === 'function') return p.$vm
	return null
}

function painterToPath(inst, pathType) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error('timeout')), 3000)
		try {
			inst.canvasToTempFilePathSync({
				fileType: 'png',
				pathType,
				quality: 1,
				success: (res) => {
					clearTimeout(timer)
					const path = res?.tempFilePath || res?.path || (typeof res === 'string' ? res : '')
					if (path) resolve(path)
					else reject(new Error('empty'))
				},
				fail: (err) => {
					clearTimeout(timer)
					reject(err || new Error('fail'))
				},
			})
		} catch (e) {
			clearTimeout(timer)
			reject(e)
		}
	})
}

function preloadImage(src) {
	return new Promise((resolve) => {
		const s = String(src || '').trim()
		if (!s) return resolve(false)
		if (typeof uni !== 'undefined' && typeof uni.getImageInfo === 'function') {
			uni.getImageInfo({ src: s, success: () => resolve(true), fail: () => resolve(false) })
		} else {
			resolve(false)
		}
	})
}

async function makePoster(c) {
	posterCard.value = {
		text: c.quote || '',
		ref: String(c.ref || '').replace(/^--\s*/, ''),
		bg: normalizePosterBg(c.cover),
		wm: spacePosterWm(t('home_share_wm')),
	}
	await nextTick()
	// 先确保背景图（尤其是远程 cover_url）已解码，避免 l-painter 拍到空背景
	await preloadImage(pBg.value)
	await sleep(300)
	const inst = painterInst()
	if (!inst) return ''
	const types = []
	// #ifdef APP-PLUS
	types.push('local')
	// #endif
	// #ifndef APP-PLUS
	types.push('url')
	// #endif
	for (let i = 0; i < types.length; i++) {
		try {
			const p = await painterToPath(inst, types[i])
			if (p) return p
		} catch (e) {}
	}
	return ''
}

async function shareCard(c) {
	uni.showLoading({ title: t('poster_preparing') || '', mask: true })
	try {
		const path = await makePoster(c)
		if (path) {
			systemShare({
				title: 'MANNA',
				summary: [c.quote, c.ref].filter(Boolean).join(' — '),
				imageUrl: path,
			})
		} else {
			uni.showToast({ title: t('share_failed') || '', icon: 'none' })
		}
	} finally {
		try { uni.hideLoading() } catch (e) {}
	}
}

async function downloadCard(c) {
	uni.showLoading({ title: t('poster_preparing') || '', mask: true })
	try {
		const path = await makePoster(c)
		if (path) saveImageToAlbum(path)
		else uni.showToast({ title: t('save_failed') || '', icon: 'none' })
	} finally {
		try { uni.hideLoading() } catch (e) {}
	}
}

async function removeNote(n) {
	try {
		await apiBibleNoteSave({ delete_id: n.id })
		notes.value = notes.value.filter((x) => x.id !== n.id)
	} catch (e) {
		uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
	}
}

async function removeHighlight(h) {
	try {
		const id = h?.id
		if (id == null || String(id).startsWith('hi-')) {
			uni.showToast({ title: t('network_error'), icon: 'none' })
			return
		}
		await apiBibleHighlightSave({ delete_id: id })
		highlights.value = highlights.value.filter((x) => x.id !== id)
	} catch (e) {
		uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
	}
}

async function removeBookmark(b) {
	try {
		await apiMannaFavoriteToggle({
			target_type: 'bible_bookmark',
			target_key: b.target_key,
		})
		bookmarks.value = bookmarks.value.filter((x) => x.id !== b.id)
	} catch (e) {
		uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
	}
}

function back() {
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) })
}

onMounted(() => {
	measureList()
	loadTab(active.value)
})
onShow(() => {
	measureList()
	loadTab(active.value)
})
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	position: relative;
	min-height: 100vh;
	height: 100vh;
	padding: 8rpx 0 0;
	box-sizing: border-box;
	@include manna-peach-page;
	overflow: hidden;
	display: flex;
	flex-direction: column;
}

.cross {
	position: absolute;
	right: 24rpx;
	top: 76rpx;
	width: 192rpx;
	height: 288rpx;
	pointer-events: none;
	z-index: 0;
}
.cross__v {
	position: absolute;
	left: 50%;
	top: 0;
	transform: translateX(-50%);
	width: 20rpx;
	height: 256rpx;
	border-radius: 6rpx;
	background: linear-gradient(180deg, #fff1e7, #ffdabf);
}
.cross__h {
	position: absolute;
	left: 50%;
	top: 72rpx;
	transform: translateX(-50%);
	width: 160rpx;
	height: 20rpx;
	border-radius: 6rpx;
	background: linear-gradient(90deg, #ffddc4, #fff1e9, #ffddc4);
}

.nav {
	position: relative;
	z-index: 1;
	display: flex;
	align-items: center;
	padding: 0 24rpx 8rpx 16rpx;
	flex-shrink: 0;
}
.nav__back {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}
.nav__back-ico { width: 48rpx; height: 48rpx; }
.nav__title {
	@include manna-nav-title;
	margin-left: 4rpx;
}

.tabs {
	position: relative;
	z-index: 1;
	width: 100%;
	white-space: nowrap;
	padding: 12rpx 0 20rpx;
	box-sizing: border-box;
	flex-shrink: 0;
}
.tabs__inner {
	display: inline-flex;
	align-items: center;
	padding: 0 40rpx;
	box-sizing: border-box;
}
.tabs__pill {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	height: 64rpx;
	padding: 0 28rpx;
	margin-right: 16rpx;
	border-radius: 999rpx;
	background: #ffffff;
	border: 2rpx solid rgba(33, 33, 33, 0.12);
	vertical-align: top;
	box-sizing: border-box;
	flex-shrink: 0;
}
.tabs__pill--on {
	background: $manna-tag-on;
	border-color: $manna-tag-on;
}
.tabs__txt {
	font-family: $manna-font-body;
	font-size: 26rpx;
	font-weight: 500;
	color: #212121;
	line-height: 1;
}

.list {
	position: relative;
	z-index: 1;
	width: 100%;
	padding: 0 40rpx calc(48rpx + env(safe-area-inset-bottom));
	box-sizing: border-box;
}

.row {
	display: flex;
	align-items: center;
	background: #ffffff;
	border-radius: 32rpx;
	padding: 28rpx 24rpx;
	margin-bottom: 20rpx;
}
.row__mid {
	flex: 1;
	min-width: 0;
	margin: 0 20rpx;
}
.row__t {
	display: block;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 32rpx;
	color: #212121;
	line-height: 1.25;
}
.row__m {
	display: block;
	margin-top: 8rpx;
	font-family: $manna-font-body;
	font-size: 24rpx;
	color: rgba(33, 33, 33, 0.45);
	line-height: 1.35;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.row__chev {
	width: 28rpx;
	height: 28rpx;
	flex-shrink: 0;
	opacity: 0.55;
}

.ring {
	width: 88rpx;
	height: 88rpx;
	border-radius: 50%;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
}
.ring::before {
	content: '';
	position: absolute;
	inset: 10rpx;
	border-radius: 50%;
	background: #ffffff;
}
.ring__n {
	position: relative;
	z-index: 1;
	font-family: $manna-font-body;
	font-size: 22rpx;
	font-weight: 600;
	color: #212121;
}

.card {
	background: #ffffff;
	border-radius: 32rpx;
	padding: 32rpx;
	margin-bottom: 20rpx;
}
.card__body {
	display: block;
	font-family: $manna-font-body;
	font-size: 30rpx;
	font-weight: 600;
	color: #212121;
	line-height: 1.45;
}
.card__body--sm {
	font-size: 28rpx;
	font-weight: 400;
	margin-top: 16rpx;
}
.card__ref {
	display: block;
	margin-top: 16rpx;
	font-family: $manna-font-body;
	font-size: 24rpx;
	color: rgba(33, 33, 33, 0.4);
	line-height: 1.4;
}
.card__title {
	display: block;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 32rpx;
	color: #212121;
}
.card__foot {
	margin-top: 24rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.card__date {
	font-family: $manna-font-body;
	font-size: 24rpx;
	font-weight: 300;
	color: rgba(33, 33, 33, 0.35);
}
.card__date--inline {
	margin-left: 16rpx;
}
.card__trash {
	width: 40rpx;
	height: 40rpx;
	flex-shrink: 0;
}
.card__head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 20rpx;
}
.card__head-l {
	display: flex;
	align-items: baseline;
	flex-wrap: wrap;
	min-width: 0;
	flex: 1;
}
.card__hi-ref {
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 30rpx;
	color: #212121;
}

.hi {
	border-radius: 16rpx;
	padding: 24rpx;
}
.hi__txt {
	font-family: $manna-font-body;
	font-size: 28rpx;
	line-height: 1.5;
	color: #212121;
}
.hi--gold,
.hi--peach { background: rgba(245, 224, 138, 0.55); }
.hi--green { background: rgba(197, 230, 184, 0.7); }
.hi--pink { background: rgba(242, 180, 190, 0.55); }
.hi--cyan { background: rgba(181, 224, 228, 0.65); }
.hi--blue { background: rgba(184, 208, 240, 0.65); }
.hi--purple { background: rgba(212, 196, 240, 0.65); }
.hi--line { background: rgba(33, 33, 33, 0.04); }

.vcard {
	background: #ffffff;
	border-radius: 32rpx;
	padding: 24rpx;
	margin-bottom: 20rpx;
}
.vcard__media {
	position: relative;
	width: 100%;
	height: 360rpx;
	border-radius: 20rpx;
	overflow: hidden;
	background: #c9a46a center/cover no-repeat;
}
.vcard__scrim {
	position: absolute;
	inset: 0;
	background: linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.08) 45%, rgba(0,0,0,0.28) 100%);
}
.vcard__copy {
	position: absolute;
	inset: 0;
	padding: 40rpx 36rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}
.vcard__verse {
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 30rpx;
	line-height: 1.45;
	color: #ffffff;
	text-align: center;
}
.vcard__verse--dark { color: #212121; }
.vcard__ref {
	margin-top: 20rpx;
	font-family: $manna-font-body;
	font-size: 24rpx;
	color: rgba(255, 255, 255, 0.85);
	text-align: center;
}
.vcard__ref--dark { color: rgba(33, 33, 33, 0.55); }
.vcard__foot {
	margin-top: 20rpx;
	display: flex;
	align-items: center;
	justify-content: space-between;
}
.vcard__acts {
	display: flex;
	align-items: center;
	gap: 40rpx;
}
.vcard__act {
	width: 48rpx;
	height: 48rpx;
}

.empty {
	display: block;
	margin-top: 80rpx;
	text-align: center;
	font-size: 26rpx;
	color: rgba(33, 33, 33, 0.45);
}

.press { opacity: 0.78; }
</style>
