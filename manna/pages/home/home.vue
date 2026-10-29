<template>
	<!-- Figma Home 279:364；背景 fixed，页面本身不滚动 -->
	<view class="home" :class="'home--' + tone" :style="{ paddingTop: statusBar + 'px' }">
		<!-- 双层底图：新图加载完成前保留旧图，避免闪黑/闪错图 -->
		<image
			v-if="bgBackSrc"
			class="home__bg home__bg--back"
			:src="bgBackSrc"
			mode="aspectFill"
		/>
		<image
			v-if="bgSrc"
			class="home__bg"
			:src="bgSrc"
			mode="aspectFill"
			@load="onBgLoad"
			@error="onBgError"
		/>
		<view class="home__fade" />

		<view class="home__top">
			<view
				class="home__top-btn"
				:class="{ 'is-spinning': listening }"
				hover-class="home__top-btn--press"
				@click.stop="onMusic"
			>
				<image
					class="home__top-ico"
					:class="{ 'is-listening': listening }"
					:src="listening ? '/static/ui/home/ico-music.png' : '/static/ui/home/ico-nomusic.png'"
					mode="aspectFit"
				/>
			</view>
			<view class="home__top-right">
				<view class="home__top-btn" hover-class="home__top-btn--press" @click.stop="onShare">
					<image class="home__top-ico" src="/static/ui/home/ico-share.svg" mode="aspectFit" />
				</view>
				<view
					class="home__top-btn"
					:class="{ 'is-liked': liked }"
					hover-class="home__top-btn--press"
					@click.stop="onLike"
				>
					<image
						class="home__top-ico"
						:class="{ 'is-liked': liked }"
						:src="liked ? '/static/ui/home/heart-on.png' : '/static/ui/home/heart.png'"
						mode="aspectFit"
					/>
				</view>
				<view class="home__top-btn" hover-class="home__top-btn--press" @click.stop="onDownload">
					<image class="home__top-ico" src="/static/ui/share/ico-save.svg" mode="aspectFit" />
				</view>
			</view>
		</view>

		<view v-if="verseText" class="home__verse">
			<text class="home__verse-t">{{ verseText }}</text>
			<text v-if="reference" class="home__verse-r">{{ reference }}</text>
		</view>

		<view class="home__foot">
			<button
				class="home__amen"
				hover-class="home__amen--press"
				:disabled="amenBusy"
				@click="onAmen"
			>
				<view v-if="prayerDot" class="home__amen-dot" />
				<image class="home__amen-ico" src="/static/ui/home/ico-amen.svg" mode="aspectFit" />
				<text class="home__amen-txt">{{ amenDone ? t('amen_done') : t('amen') }}</text>
			</button>
			<text v-if="loadHint" class="home__hint">{{ loadHint }}</text>
			<!-- 运营卡：每张卡一个容器，title/subtitle 各一个 text，勿拆词 -->
			<scroll-view
				scroll-x
				class="home__cards"
				:show-scrollbar="false"
				enable-flex
			>
				<view class="home__cards-inner">
					<view
						v-for="c in displayCards"
						:key="'card-' + c.id"
						class="home__card"
						:class="{ 'home__card--cover': !!c.cover_url }"
						hover-class="home__card--press"
						@click="onCard(c)"
					>
						<image
							v-if="c.cover_url"
							class="home__card-cover"
							:src="cardCoverSrc(c)"
							mode="aspectFill"
						/>
						<view v-if="c.cover_url" class="home__card-veil" />
						<image class="home__card-ico" :src="cardIcon(c)" mode="aspectFit" />
						<text class="home__card-t">{{ c.title }}</text>
						<text class="home__card-s">{{ c.subtitle }}</text>
					</view>
				</view>
			</scroll-view>
		</view>

		<MannaTabBar v-show="tabOn" active="home" variant="dark" />

		<!-- 离屏合成：分享 / 保存时把经文和出处画进海报 -->
		<!-- H5 用固定 px + 低 dpr，避免宽屏 rpx×2 超浏览器 canvas 上限导致导出半截 -->
		<l-painter
			ref="painter"
			:key="paintKey"
			:width="posterPainterSize.w"
			:height="posterPainterSize.h"
			path-type="url"
			:hidden="true"
			:pixel-ratio="posterPixelRatio"
			:useCORS="true"
			@done="onPainterDone"
		>
			<l-painter-view :css="posterRootCss">
				<l-painter-image
					:src="posterBgSrc"
					:css="posterFillCss + ' object-fit: cover;'"
				/>
				<l-painter-view
					:css="posterFillCss + ' background: linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.04) 38%, rgba(0,0,0,0.22) 100%);'"
				/>
				<!-- 绝对定位逐行画字：安卓画布不画 flex 里的文字，会只剩背景图 -->
				<l-painter-text
					v-for="(line, i) in posterVerseLines"
					:key="'v' + i"
					:text="line"
					:css="verseLineCss(i)"
				/>
				<l-painter-text
					v-for="(line, i) in posterRefLines"
					:key="'r' + i"
					:text="line"
					:css="refLineCss(i)"
				/>
				<l-painter-view :css="posterWmLineLeftCss" />
				<l-painter-text :text="posterWmText" :css="posterWmTextCss" />
				<l-painter-view :css="posterWmLineRightCss" />
			</l-painter-view>
		</l-painter>
	</view>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { onShow, onHide, onUnload, onLoad } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { ensureLogin, shouldForceLoginPage, hasLocalSession } from '@/utils/session.js'
import {
	apiDailyVerse,
	apiMannaAmen,
	apiMannaFavoriteToggle,
	apiMannaSharePayload,
	apiMannaHomeCards,
	apiMannaCollections,
} from '@/api/manna.js'
import { host } from '@/config/config.js'
import { saveImageToAlbum, systemShare } from '@/utils/share.js'
import { track } from '@/utils/analytics.js'
import { hideNativeTabBar, scheduleCustomTabBarHide, setTabUiKey } from '@/utils/tabbar.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import {
	clearSessionBg,
	decodeAssetPath,
	getHomeBg,
	homeBgSrc,
	isHomePoolBg,
	resolveTimedBg,
	setSessionBg,
} from '@/utils/homeBg.js'
import {
	periodKind,
	isPeriodPrayerDone,
	MORNING_START_HOUR,
	EVENING_START_HOUR,
} from '@/utils/dayPeriod.js'
import { homeBgm, toggleHomeBgm } from '@/utils/homeBgm.js'
import { stashNewlyEarned } from '@/utils/badges.js'
import { getTimezone } from '@/utils/device.js'
import { readPageCache, writePageCache, silentListRefresh } from '@/utils/pageCache.js'
import { ensureLocalAsset, peekLocalAsset } from '@/utils/assetCache.js'
import { openQuizPlayDirect } from '@/utils/quizAttempt.js'
import MannaTabBar from '@/components/MannaTabBar.vue'

const HOME_CARDS_CACHE_KEY = 'home_cards_v1'
/** 上次成功展示的底图（冷启比 daily-verse 缓存更早可用） */
const HOME_LAST_BG_KEY = 'manna_home_last_bg_v1'

const CARD_ICONS = {
	daily_quiz: '/static/ui/me/ico-quiz.svg',
	quiz: '/static/ui/me/ico-quiz.svg',
	daily_devotion: '/static/ui/me/ico-devotion.svg',
	devotion: '/static/ui/me/ico-devotion.svg',
	story: '/static/ui/me/ico-stories-fill.svg',
	testimony: '/static/ui/me/ico-bible-fill.svg',
	prayer: '/static/ui/me/ico-pray.svg',
	bible: '/static/ui/me/ico-bible-fill.svg',
}

function absolutizeMedia(url) {
	if (!url) return ''
	if (/^https?:\/\//i.test(url)) return url
	const origin = String(host || '').replace(/\/api\/?$/, '')
	return `${origin}${url.startsWith('/') ? '' : '/'}${url}`
}

/** 今日经文缓存键（按时区+本地日，避免隔日脏缓存） */
function dailyVerseCacheKey() {
	const tz = getTimezone()
	let day = ''
	try {
		day = new Intl.DateTimeFormat('en-CA', {
			timeZone: tz,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		}).format(new Date())
	} catch (e) {
		const d = new Date()
		day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
	}
	return `daily_verse_${tz}_${day}`
}

function cmsMediaSrc(url) {
	const s = decodeAssetPath(url)
	if (!s) return ''
	if (/^https?:\/\//i.test(s) || s.startsWith('/static/')) return s
	return absolutizeMedia(s)
}

/** 配置图优先本地落盘路径，避免冷启先闪随机本地池 */
function displayCmsBg(url) {
	const cms = cmsMediaSrc(url)
	if (!cms) return ''
	return peekLocalAsset(cms) || cms
}

function readLastBg() {
	try {
		const s = String(uni.getStorageSync(HOME_LAST_BG_KEY) || '').trim()
		return s
	} catch (e) {
		return ''
	}
}

function writeLastBg(src) {
	const s = String(src || '').trim()
	if (!s) return
	try {
		uni.setStorageSync(HOME_LAST_BG_KEY, s)
	} catch (e) {}
}

const statusBar = getStatusBarPx()
const tabOn = ref(true)
let tabHideTimer = null
const verseText = ref('')
const reference = ref('')
const bibleBook = ref('')
const bibleChapter = ref(0)
const amenDone = ref(false)
const amenBusy = ref(false)
const prayerDot = ref(false)
const loadHint = ref('')
const liked = ref(false)
const cards = ref([])
const kind = ref('')
/** 经文文字色调跟随本地时段（与底图 resolveTimedBg 同一时钟口径） */
const tone = ref(periodKind())
const exportBusy = ref(false)
const painter = ref(null)
/** painter 本轮是否已 @done（H5 导出前必须等齐） */
const painterReady = ref(false)
let painterDoneResolvers = []
const listening = computed(() => homeBgm.playing)
let cmsDayUrl = ''
let cmsNightUrl = ''
let bgFromCms = false
let bgErrorLocked = false
let verseTracked = ''
let bgReady = false

function applyPrayerDot(d) {
	// 本地已记录当前时段祷告完成 -> 直接灭红点，且不再拿后端旧值覆盖：
	// 后端 prayer_dot 依赖落库/幂等，可能出现「本地已打卡但服务端仍返回 true」，
	// 一旦覆盖回来就会出现「祷告完红点自己又亮」的假象。
	if (isPeriodPrayerDone(periodKind())) {
		prayerDot.value = false
		amenDone.value = true
		return
	}
	if (typeof d?.prayer_dot !== 'boolean') return
	prayerDot.value = d.prayer_dot
	amenDone.value = !d.prayer_dot
}

/**
 * 时段边界（06:00 / 18:00）监听：用户停在首页跨过边界时，
 * 红点、底图、Amen 入口都要跟着切，否则会一直沿用上一个时段的状态。
 */
let periodTimer = null
let periodKey = periodKind()

/** 距离下一个时段边界（06:00 / 18:00）的毫秒数 */
function msToNextPeriodBoundary() {
	const now = new Date()
	const h = now.getHours()
	let targetHour = MORNING_START_HOUR
	if (h >= EVENING_START_HOUR) targetHour = 24 + MORNING_START_HOUR
	else if (h >= MORNING_START_HOUR) targetHour = EVENING_START_HOUR
	const next = new Date(now)
	next.setHours(targetHour, 0, 0, 0) // targetHour ≥ 24 时自动进位到次日
	return Math.max(1000, next.getTime() - now.getTime())
}

function clearPeriodTimer() {
	if (periodTimer) {
		clearTimeout(periodTimer)
		periodTimer = null
	}
}

/**
 * 时段真的变了才动：先用本地打卡定红点（新时段默认未完成 → 亮），
 * 再换时段底图，最后拉一次接口纠正（另一设备已做过的情况）。
 * @returns {boolean} 是否发生了切换
 */
function syncPeriodIfChanged({ refetch = true } = {}) {
	const k = periodKind()
	if (k === periodKey) return false
	periodKey = k
	tone.value = k
	kind.value = k
	const done = isPeriodPrayerDone(k)
	prayerDot.value = !done
	amenDone.value = done
	if (cmsDayUrl || cmsNightUrl) applyHomeBg({ allowLocalFallback: false })
	if (refetch) loadVerse().catch(() => {})
	return true
}

/** 对齐到下一个边界再触发；触发后重新排期，避免轮询 */
function armPeriodTimer() {
	clearPeriodTimer()
	periodTimer = setTimeout(() => {
		try {
			syncPeriodIfChanged()
		} finally {
			armPeriodTimer() // 即使校正过程报错也要排下一次，别让红点永久停在旧时段
		}
	}, msToNextPeriodBoundary())
}

function normalizeHomeCards(list) {
	return (Array.isArray(list) ? list : [])
		.map((c, i) => ({
			id: c.id ?? `card-${i}`,
			card_type: c.card_type || '',
			title: String(c.title || '').trim(),
			subtitle: String(c.subtitle || '').trim(),
			// 存规范 URL（勿写入本地落盘路径，否则落盘后 revision 变了会整卡重挂载闪一下）
			cover_url: cmsMediaSrc(c.cover_url || ''),
			link_path: String(c.link_path || '').trim(),
			payload: c.payload || {},
		}))
		.filter((c) => c.title)
}

function cardCoverSrc(c) {
	const u = String(c?.cover_url || '').trim()
	if (!u) return ''
	return peekLocalAsset(u) || u
}

function cardsRevision(list) {
	return normalizeHomeCards(list)
		.map((c) => `${c.id}|${c.title}|${c.subtitle}|${c.cover_url}|${c.link_path}|${c.card_type}`)
		.join('||')
}

function hydrateCardsFromCache() {
	const cached = readPageCache(HOME_CARDS_CACHE_KEY)
	const raw = cached?.results ?? cached
	const list = normalizeHomeCards(raw)
	if (list.length) cards.value = list
}

function hydrateFromVerseCache() {
	const d = readPageCache(dailyVerseCacheKey())
	if (!d || typeof d !== 'object') return ''
	cmsDayUrl = String(d.image_url || '').trim()
	cmsNightUrl = String(d.image_url_night || '').trim()
	if (d.verse_text) {
		verseText.value = d.verse_text
		reference.value = d.reference || ''
		bibleBook.value = String(d.bible_book || '').trim()
		bibleChapter.value = Number(d.chapter) || 0
	}
	applyPrayerDot(d)
	const cms = resolveTimedBg({ dayUrl: cmsDayUrl, nightUrl: cmsNightUrl })
	if (cms) {
		bgFromCms = true
		bgReady = true
		const show = displayCmsBg(cms)
		setSessionBg(show)
		return show
	}
	// 缓存明确无配置图 → 才用本地池
	if (Object.prototype.hasOwnProperty.call(d, 'image_url')) {
		bgFromCms = false
		bgReady = true
		const local = getHomeBg().src
		setSessionBg(local)
		return local
	}
	return ''
}

hydrateCardsFromCache()
// 冷启优先上次成功底图，再叠今日经文缓存（避免杀进程重进先空再跳）
const bgSrc = ref(readLastBg() || hydrateFromVerseCache())
const bgBackSrc = ref('')
if (bgSrc.value) {
	bgReady = true
	bgFromCms = !isHomePoolBg(bgSrc.value)
	setSessionBg(bgSrc.value)
	writeLastBg(bgSrc.value)
	// 只补 CMS URL / 经文，勿再抽本地池（会污染 session）
	if (!cmsDayUrl && !cmsNightUrl) {
		const d = readPageCache(dailyVerseCacheKey())
		if (d && typeof d === 'object') {
			cmsDayUrl = String(d.image_url || '').trim()
			cmsNightUrl = String(d.image_url_night || '').trim()
			if (!verseText.value && d.verse_text) {
				verseText.value = d.verse_text
				reference.value = d.reference || ''
				bibleBook.value = String(d.bible_book || '').trim()
				bibleChapter.value = Number(d.chapter) || 0
			}
			applyPrayerDot(d)
		}
	}
}

const displayCards = computed(() => cards.value)

function cardIcon(c) {
	return CARD_ICONS[c?.card_type] || CARD_ICONS[c?.type] || '/static/ui/me/ico-bible-fill.svg'
}

/** 轻音乐背景音：播放时左上角音符转动 */
async function onMusic() {
	track('manna_home_listen', { bgm: true, on: !listening.value })
	toggleHomeBgm()
}

const verseKey = computed(() =>
	(reference.value || verseText.value || 'today').slice(0, 120),
)

function useLocalFolderBg() {
	bgFromCms = false
	bgReady = true
	const local = clearSessionBg()
	setBgSrc(local.src)
}

/** 同一资源的 http / 本地落盘路径视为相同，避免二次闪屏 */
function sameBgAsset(cur, next) {
	if (cur === next) return true
	if (!cur || !next) return false
	const localNext = peekLocalAsset(next)
	if (localNext && localNext === cur) return true
	const localCur = peekLocalAsset(cur)
	if (localCur && localCur === next) return true
	return false
}

function setBgSrc(next) {
	const s = String(next || '').trim()
	if (!s || sameBgAsset(bgSrc.value, s)) return
	// 已有前景时垫到底层，等新图 @load 再撤，避免闪黑
	if (bgSrc.value && !sameBgAsset(bgSrc.value, s)) {
		bgBackSrc.value = bgSrc.value
	}
	bgSrc.value = s
	writeLastBg(s)
}

function onBgLoad() {
	bgBackSrc.value = ''
}

function applyHomeBg({ allowLocalFallback = true } = {}) {
	const cmsRaw = resolveTimedBg({ dayUrl: cmsDayUrl, nightUrl: cmsNightUrl })
	const cms = cmsMediaSrc(cmsRaw)
	if (cms) {
		bgFromCms = true
		bgReady = true
		const show = displayCmsBg(cms)
		setBgSrc(show)
		setSessionBg(show)
		// 后台落盘，下次冷启秒开；本帧不改 src，避免 http→file 二次闪
		ensureLocalAsset(cms).catch(() => {})
		return
	}
	if (!allowLocalFallback) return
	useLocalFolderBg()
}

/** 首次无缓存图：先落盘再上屏，避免远程图半截闪入 */
async function applyHomeBgFirstPaint() {
	const cmsRaw = resolveTimedBg({ dayUrl: cmsDayUrl, nightUrl: cmsNightUrl })
	const cms = cmsMediaSrc(cmsRaw)
	if (!cms) {
		applyHomeBg({ allowLocalFallback: true })
		return
	}
	bgFromCms = true
	bgReady = true
	const peeked = peekLocalAsset(cms)
	if (peeked) {
		setBgSrc(peeked)
		setSessionBg(peeked)
		return
	}
	if (!bgSrc.value) {
		const path = await ensureLocalAsset(cms)
		const show = path || cms
		setBgSrc(show)
		setSessionBg(show)
		return
	}
	setBgSrc(cms)
	setSessionBg(cms)
	ensureLocalAsset(cms).catch(() => {})
}

function onBgError() {
	// CMS 图失败：先试同源另一路径，仍失败再回本地池（勿立刻清配置 URL）
	if (bgFromCms) {
		const cms = cmsMediaSrc(resolveTimedBg({ dayUrl: cmsDayUrl, nightUrl: cmsNightUrl }))
		const local = cms ? peekLocalAsset(cms) : ''
		if (local && !sameBgAsset(bgSrc.value, local)) {
			setBgSrc(local)
			return
		}
		bgBackSrc.value = ''
		useLocalFolderBg()
		return
	}
	if (!isHomePoolBg(bgSrc.value)) {
		bgBackSrc.value = ''
		useLocalFolderBg()
		return
	}
	if (bgErrorLocked) return
	bgErrorLocked = true
	setBgSrc(getHomeBg(true).src)
}

function applyVersePayload(d, { trackView = true, firstPaint = false } = {}) {
	if (!d || typeof d !== 'object') return
	applyPrayerDot(d)
	cmsDayUrl = String(d.image_url || '').trim()
	cmsNightUrl = String(d.image_url_night || '').trim()
	bgErrorLocked = false
	if (d.verse_text) {
		verseText.value = d.verse_text
		reference.value = d.reference || ''
		bibleBook.value = String(d.bible_book || '').trim()
		bibleChapter.value = Number(d.chapter) || 0
		loadHint.value = ''
		const vid = d.id || d.verse_id || reference.value
		if (trackView && vid && verseTracked !== String(vid)) {
			verseTracked = String(vid)
			track('verse_view', {
				verse_id: vid,
				verse_ref: reference.value,
			})
		}
	} else {
		loadHint.value = t('home_empty_hint')
	}
	if (firstPaint && !bgSrc.value) {
		return applyHomeBgFirstPaint()
	}
	applyHomeBg({ allowLocalFallback: true })
}

async function loadVerse() {
	const hadBg = !!bgSrc.value
	try {
		const res = await apiDailyVerse({ tz: getTimezone() })
		const d = res?.results || {}
		// 时段以设备本地时钟为准：底图 resolveTimedBg、红点 isPeriodPrayerDone 都走这套口径，
		// 服务端 prayer_kind 依赖传上去的 tz（App 端 Intl 取不到时会退回 UTC，早晚判反）。
		kind.value = periodKind()
		tone.value = kind.value
		writePageCache(dailyVerseCacheKey(), {
			id: d.id || d.verse_id || '',
			verse_text: d.verse_text || '',
			reference: d.reference || '',
			bible_book: d.bible_book || '',
			chapter: d.chapter || 0,
			image_url: d.image_url || '',
			image_url_night: d.image_url_night || '',
			prayer_dot: d.prayer_dot,
		})
		await applyVersePayload(d, { trackView: true, firstPaint: !hadBg })
	} catch (e) {
		// 有今日缓存则保住配置图，勿闪回随机本地池
		const cached = readPageCache(dailyVerseCacheKey())
		if (cached?.verse_text || cached?.image_url || cached?.image_url_night) {
			loadHint.value = ''
			await applyVersePayload(cached, { trackView: false, firstPaint: !hadBg })
			return
		}
		loadHint.value = t('home_load_fail')
		cmsDayUrl = ''
		cmsNightUrl = ''
		useLocalFolderBg()
	}
}

function prefetchCardCovers(list) {
	for (const c of list || []) {
		const u = cmsMediaSrc(c.cover_url || '')
		if (u) ensureLocalAsset(u).catch(() => {})
	}
}

async function loadCards() {
	const { refresh } = silentListRefresh(
		HOME_CARDS_CACHE_KEY,
		async () => {
			const res = await apiMannaHomeCards()
			const results = Array.isArray(res?.results) ? res.results : []
			return { results }
		},
		(data) => {
			const next = normalizeHomeCards(data?.results)
			// 失败/空响应时保留已有卡片，避免「消失再出现」
			if (!next.length && cards.value.length) return
			if (cardsRevision(cards.value) === cardsRevision(next)) return
			cards.value = next
			prefetchCardCovers(data?.results)
		},
		{
			getRevision: (d) => cardsRevision(d?.results),
		},
	)
	try {
		await refresh
	} catch (e) {
		// 保留缓存卡片
	}
}

onShow(async () => {
	if (tabHideTimer) {
		clearTimeout(tabHideTimer)
		tabHideTimer = null
	}
	// 未登录：不要在首页静默建号，直接回 Welcome
	if (shouldForceLoginPage() || !hasLocalSession()) {
		uni.reLaunch({ url: '/pagesA/welcome/welcome' })
		return
	}
	tabOn.value = true
	setTabUiKey('home')
	hideNativeTabBar()
	// 跨 18:00 回到首页时，文字深浅跟着时段一起切；
	// 后台停留期间若跨了时段，红点也在这里校正（下面统一 loadVerse，故不重复请求）
	syncPeriodIfChanged({ refetch: false })
	tone.value = periodKind()
	armPeriodTimer()
	// 仅在已有配置 URL 时刷新时段图；勿在接口返回前落到随机本地池（会闪屏）
	if (cmsDayUrl || cmsNightUrl) {
		applyHomeBg({ allowLocalFallback: false })
	} else if (!bgReady) {
		const restored = hydrateFromVerseCache()
		if (restored) bgSrc.value = restored
		if (cmsDayUrl || cmsNightUrl) applyHomeBg({ allowLocalFallback: false })
	}
	try {
		await ensureLogin({ explicit: true })
	} catch (e) {}
	await Promise.all([loadVerse(), loadCards(), restoreLiked()])
})

onHide(() => {
	clearPeriodTimer()
	tabHideTimer = scheduleCustomTabBarHide(() => {
		tabOn.value = false
		tabHideTimer = null
	})
})

onUnload(() => {
	clearPeriodTimer()
	if (tabHideTimer) {
		clearTimeout(tabHideTimer)
		tabHideTimer = null
	}
	tabOn.value = false
})

async function restoreLiked() {
	try {
		const res = await apiMannaCollections()
		const favs = res?.results?.favorites || []
		const key = `${reference.value || verseKey.value}|${verseText.value}`.slice(0, 255)
		liked.value = favs.some((f) => f.target_type === 'verse_card' && f.target_key === key)
	} catch (e) {
		liked.value = false
	}
}

onMounted(() => {
	tabOn.value = true
	setTabUiKey('home')
	hideNativeTabBar()
	track('page_view', { page_name: 'home' })
})

async function onAmen() {
	if (amenBusy.value) return
	amenBusy.value = true
	
	try {
		// 已祷告过时接口可能失败，仍进入祷告页
		try {
			const amenRes = await apiMannaAmen({ scene: 'home', ref: reference.value || '' })
			stashNewlyEarned(amenRes?.results?.newly_earned)
		} catch (e) {}
		uni.vibrateShort?.({ type: 'light' })
		track('prayer_start', {
			verse_id: reference.value || '',
			verse_ref: reference.value || '',
			prayer_period: kind.value,
			trigger_source: 'home_amen',
		})
		track('manna_amen', { scene: 'home' })
		try {
			uni.setStorageSync('manna_prayer_entry', { kind: kind.value })
		} catch (e) {}
		uni.navigateTo({
			url: `/pagesA/prayer/prayer?kind=${kind.value}`,
		})
	} finally {
		amenBusy.value = false
	}
}

async function onLike() {
	try {
		const res = await apiMannaFavoriteToggle({
			target_type: 'verse_card',
			target_key: `${reference.value || verseKey.value}|${verseText.value}`.slice(0, 255),
		})
		liked.value = !!(res?.results?.liked)
		const key = `${reference.value || verseKey.value}|${verseText.value}`.slice(0, 255)
		try {
			const covers = uni.getStorageSync('manna_verse_card_covers') || {}
			if (liked.value) covers[key] = homeBgSrc()
			else delete covers[key]
			uni.setStorageSync('manna_verse_card_covers', covers)
		} catch (e) {}
		track('manna_favorite', { liked: liked.value })
	} catch (e) {
		uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
	}
}

function cardImageSrc() {
	const src = String(bgSrc.value || homeBgSrc() || '').trim()
	if (!src) return ''
	// #ifdef APP-PLUS
	try {
		if (src.startsWith('/static/') && typeof plus !== 'undefined' && plus.io) {
			const local = plus.io.convertLocalFileSystemURL('_www' + src)
			if (local) return local
		}
	} catch (e) {}
	// #endif
	return src
}

const POSTER_W = 750
const POSTER_MIN_H = 1334
const POSTER_TEXT_W = 638
const POSTER_PAD_TOP = 160
const POSTER_PAD_BOTTOM = 320
const VERSE_SIZE = 36
const VERSE_LH = 54
const REF_SIZE = 28
const REF_LH = 39
const REF_GAP = 36
const POSTER_TEXT_X = 56
/** painter 无 letter-spacing：用空格拉字距 */
function spaceShareWm(raw) {
	const s = String(raw || '').trim()
	if (!s) return ''
	return ` ${Array.from(s).map((ch) => (ch === ' ' ? '  ' : ch)).join('  ')} `
}
const posterWmText = computed(() => spaceShareWm(t('home_share_wm')))
/** 相对现高加倍上移 */
const POSTER_WM_BOTTOM = 240
const POSTER_WM_SIDE = 40
const POSTER_WM_SIZE = 28
const POSTER_WM_LH = 40
/** 两侧短横线（勿再 flex 拉满） */
const POSTER_WM_LINE_W = 48
/** 线与文字间距 ≈ 两个空格 */
const POSTER_WM_GAP = 36

function measureTextW(str, fontSize) {
	return Array.from(String(str || '')).reduce((n, ch) => {
		if (/\s/.test(ch)) return n + fontSize * 0.32
		if (/[\u0000-\u00ff]/.test(ch)) return n + fontSize * 0.55
		return n + fontSize
	}, 0)
}

/** 按词换行，避免安卓画布把单词从中间切开，也避免整段文字因 flex 画不出来 */
function wrapByWords(text, fontSize, maxWidth) {
	const src = String(text || '').trim()
	if (!src) return []
	const out = []
	src.split(/\r?\n/).forEach((para) => {
		const raw = para.trim()
		if (!raw) return
		const tokens = raw.split(/(\s+)/)
		let line = ''
		const flush = () => {
			const s = line.replace(/\s+$/g, '')
			if (s) out.push(s)
			line = ''
		}
		tokens.forEach((tok) => {
			if (!tok) return
			const trial = line + tok
			if (line && measureTextW(trial, fontSize) > maxWidth) {
				flush()
				line = tok.replace(/^\s+/g, '')
			} else {
				line = trial
			}
		})
		flush()
	})
	return out
}

const posterVerseLines = computed(() => wrapByWords(verseText.value, VERSE_SIZE, POSTER_TEXT_W))
const posterRefLines = computed(() => wrapByWords(reference.value, REF_SIZE, POSTER_TEXT_W))

const posterLayout = computed(() => {
	const verseH = posterVerseLines.value.length * VERSE_LH
	const refH = posterRefLines.value.length * REF_LH
	const gaps = posterVerseLines.value.length && posterRefLines.value.length ? REF_GAP : 0
	const block = verseH + gaps + refH
	const height = Math.max(POSTER_MIN_H, POSTER_PAD_TOP + block + POSTER_PAD_BOTTOM)
	const textTop = Math.max(POSTER_PAD_TOP, Math.round((height - block) / 2))
	const refTop = textTop + verseH + gaps
	const wmTextW = Math.min(
		POSTER_W - (POSTER_WM_SIDE + POSTER_WM_LINE_W + POSTER_WM_GAP) * 2,
		Math.max(160, Math.ceil(measureTextW(posterWmText.value, POSTER_WM_SIZE))),
	)
	return { width: POSTER_W, height, textTop, refTop, wmTextW }
})

/**
 * H5：画布用设计稿 px，避免宽屏把 750rpx 放大后再 × pixelRatio 超浏览器上限 → 导出半截。
 * App：继续用 rpx。
 */
const posterUnit = (() => {
	// #ifdef H5
	return 'px'
	// #endif
	// #ifndef H5
	return 'rpx'
	// #endif
})()

const posterPainterSize = computed(() => ({
	w: `${posterLayout.value.width}${posterUnit}`,
	h: `${posterLayout.value.height}${posterUnit}`,
}))

const posterPixelRatio = (() => {
	// #ifdef H5
	return 1
	// #endif
	// #ifndef H5
	return 2
	// #endif
})()

/** 包内 / 已落盘路径不能再拼 API 域名，否则 iOS 画布读不到底图 */
function isPosterLocalSrc(raw) {
	const s = String(raw || '')
	if (!s) return false
	if (s.startsWith('/static/') || s.startsWith('data:') || s.startsWith('blob:')) return true
	if (/^(file:|wxfile:|content:)/i.test(s)) return true
	if (/^_(doc|www|downloads|documents)\b/i.test(s)) return true
	if (s.startsWith('/var/') || s.startsWith('/private/') || s.startsWith('/storage/')) return true
	return false
}

const posterBgSrc = computed(() => {
	const raw = String(bgSrc.value || '').trim()
	if (!raw) return ''
	if (isPosterLocalSrc(raw)) return raw
	return absolutizeMedia(raw) || raw
})

const u = posterUnit
function absCss(left, top, width, height) {
	return `position: absolute; left: ${left}${u}; top: ${top}${u}; width: ${width}${u}; height: ${height}${u};`
}
const posterRootCss = computed(() =>
	`width: ${posterLayout.value.width}${u}; height: ${posterLayout.value.height}${u}; position: relative; background: #0a0a0a; overflow: hidden;`,
)
const posterFillCss = computed(() =>
	`position: absolute; left: 0; top: 0; width: ${posterLayout.value.width}${u}; height: ${posterLayout.value.height}${u};`,
)
function verseLineCss(i) {
	const top = posterLayout.value.textTop + i * VERSE_LH
	return `${absCss(POSTER_TEXT_X, top, POSTER_TEXT_W, VERSE_LH)} font-size: ${VERSE_SIZE}${u}; font-weight: 400; color: #ffffff; line-height: ${VERSE_LH}${u}; text-align: center; white-space: nowrap;`
}
function refLineCss(i) {
	const top = posterLayout.value.refTop + i * REF_LH
	return `${absCss(POSTER_TEXT_X, top, POSTER_TEXT_W, REF_LH)} font-size: ${REF_SIZE}${u}; color: rgba(255,255,255,0.88); line-height: ${REF_LH}${u}; text-align: center; white-space: nowrap;`
}
const posterWmTextCss = computed(() => {
	const top = posterLayout.value.height - POSTER_WM_BOTTOM - POSTER_WM_LH
	const left = Math.round((POSTER_W - posterLayout.value.wmTextW) / 2)
	return `${absCss(left, top, posterLayout.value.wmTextW, POSTER_WM_LH)} font-size: ${POSTER_WM_SIZE}${u}; font-weight: 400; color: rgba(255,255,255,0.9); line-height: ${POSTER_WM_LH}${u}; text-align: center; white-space: nowrap;`
})
function wmLineCss(side) {
	const top = posterLayout.value.height - POSTER_WM_BOTTOM - POSTER_WM_LH + Math.round((POSTER_WM_LH - 2) / 2)
	const textLeft = Math.round((POSTER_W - posterLayout.value.wmTextW) / 2)
	const left = side === 'left'
		? textLeft - POSTER_WM_GAP - POSTER_WM_LINE_W
		: textLeft + posterLayout.value.wmTextW + POSTER_WM_GAP
	return `${absCss(left, top, POSTER_WM_LINE_W, 2)} background: rgba(255,255,255,0.75);`
}
const posterWmLineLeftCss = computed(() => wmLineCss('left'))
const posterWmLineRightCss = computed(() => wmLineCss('right'))
const paintKey = computed(() =>
	`${posterBgSrc.value}|${posterVerseLines.value.join('\n')}|${posterRefLines.value.join('\n')}|${posterWmText.value}|${posterLayout.value.height}|wm11`,
)

watch(paintKey, () => {
	painterReady.value = false
})

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function onPainterDone() {
	painterReady.value = true
	const q = painterDoneResolvers.splice(0, painterDoneResolvers.length)
	q.forEach((fn) => {
		try { fn() } catch (e) {}
	})
}

function waitPainterDone(ms = 8000) {
	if (painterReady.value) return Promise.resolve()
	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			painterDoneResolvers = painterDoneResolvers.filter((fn) => fn !== finish)
			resolve()
		}, ms)
		const finish = () => {
			clearTimeout(timer)
			resolve()
		}
		painterDoneResolvers.push(finish)
	})
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
		const timer = setTimeout(() => reject(new Error('timeout')), 8000)
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

async function composeVersePoster() {
	if (!verseText.value && !reference.value) return ''
	await nextTick()
	await sleep(80)
	if (!painterReady.value) await waitPainterDone(8000)
	await sleep(60)
	const inst = painterInst()
	if (!inst) return ''
	const types = []
	// #ifdef APP-PLUS
	types.push('local')
	types.push('url')
	// #endif
	// #ifndef APP-PLUS
	types.push('url')
	// #endif
	for (let i = 0; i < types.length; i++) {
		try {
			const path = await painterToPath(inst, types[i])
			if (path) return path
		} catch (e) {}
	}
	return ''
}

async function verseSharePayload() {
	const fallbackText = verseText.value || ''
	const fallbackRef = reference.value || ''
	try {
		const res = await apiMannaSharePayload({
			scene: 'daily_verse',
			ref: fallbackRef,
			text: fallbackText,
		})
		const d = res?.results || {}
		const text = d.raw_text || fallbackText
		const ref = d.reference || fallbackRef
		return {
			title: d.brand || 'Manna',
			summary: d.text || [text, ref].filter(Boolean).join(' — '),
			text,
			ref,
		}
	} catch (e) {
		return {
			title: 'Manna',
			summary: [fallbackText, fallbackRef].filter(Boolean).join(' — '),
			text: fallbackText,
			ref: fallbackRef,
		}
	}
}

async function onShare() {
	if (exportBusy.value) return
	exportBusy.value = true
	uni.showLoading({ title: t('poster_preparing'), mask: true })
	try {
		const payload = await verseSharePayload()
		const poster = await composeVersePoster()
		try { uni.hideLoading() } catch (e) {}
		if (!poster) {
			uni.showToast({ title: t('share_failed'), icon: 'none' })
			return
		}
		track('verse_share', { verse_id: payload.ref || '', share_platform: 'system' })
		systemShare({
			title: payload.title,
			summary: payload.summary,
			imageUrl: poster,
		})
	} catch (e) {
		try { uni.hideLoading() } catch (err) {}
		uni.showToast({ title: e?.message || t('share_failed'), icon: 'none' })
	} finally {
		exportBusy.value = false
	}
}

async function onDownload() {
	if (exportBusy.value) return
	exportBusy.value = true
	uni.showLoading({ title: t('poster_preparing'), mask: true })
	try {
		const poster = await composeVersePoster()
		const imageUrl = poster || cardImageSrc()
		try { uni.hideLoading() } catch (e) {}
		if (!imageUrl) {
			uni.showToast({ title: t('save_failed'), icon: 'none' })
			return
		}
		track('verse_share', { verse_id: reference.value || '', share_platform: 'save' })
		await saveImageToAlbum(imageUrl)
	} catch (e) {
		try { uni.hideLoading() } catch (err) {}
		uni.showToast({ title: e?.message || t('save_failed'), icon: 'none' })
	} finally {
		exportBusy.value = false
	}
}

function onCard(c) {
	const p = c.payload || {}
	const TAB_ROOTS = new Set([
		'/pages/home/home',
		'/pages/quiz/quiz',
		'/pages/devotion/list',
		'/pages/bible/bible',
		'/pages/profile/profile',
	])
	const DETAIL_ROOTS = new Set([
		'/pagesA/devotion/detail',
		'/pagesA/quiz/play',
	])

	let path = String(c.link_path || '').trim()
	// 兼容旧数据：仅有 card_type、无 link_path
	if (!path) {
		const type = c.card_type || c.type
		if (type === 'daily_quiz') path = '/pages/quiz/quiz'
		else if (type === 'daily_devotion') {
			path = p.series_id ? '/pagesA/devotion/detail' : '/pages/devotion/list'
		} else if (type === 'story') path = '/pagesA/quiz/stories'
		else if (type === 'testimony') path = '/pages/profile/profile'
	}
	if (!path) return

	const root = path.split('?')[0]
	let url = path.startsWith('/') ? path : `/${path}`
	const targetId = p.target_id ?? p.series_id ?? p.story_id ?? p.level_id ?? p.testimony_id
	if (targetId != null && targetId !== '' && !url.includes('?') && DETAIL_ROOTS.has(root)) {
		url += `?id=${encodeURIComponent(String(targetId))}`
	}

	if (TAB_ROOTS.has(root)) {
		if (root === '/pages/quiz/quiz') {
			openQuizPlayDirect().catch(() => {})
			return
		}
		uni.switchTab({ url: root })
		return
	}
	uni.navigateTo({ url })
}
onLoad(() => {
	onMusic()
})
 
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.home {
	position: relative;
	min-height: 100vh;
	height: 100vh;
	box-sizing: border-box;
	overflow: hidden;
	color: $manna-white;
	/* 配置图未就绪时底色，避免先闪随机本地池 */
	background: #22170b;
}

.home__bg {
	position: fixed;
	left: 0;
	top: 0;
	width: 100%;
	height: 100%;
	z-index: 0;
	pointer-events: none;
}

.home__bg--back {
	z-index: 0;
}

.home__fade {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	height: 70%;
	z-index: 1;
	pointer-events: none;
	background: linear-gradient(
		180deg,
		rgba(34, 23, 11, 0) 0%,
		rgba(34, 23, 11, 0.06) 32%,
		rgba(34, 23, 11, 0.22) 58%,
		rgba(34, 23, 11, 0.38) 82%,
		rgba(34, 23, 11, 0.48) 100%
	);
}

.home__top,
.home__foot {
	position: relative;
	z-index: 2;
}

.home__verse {
	position: absolute;
	left: 0;
	right: 0;
	top: 50%;
	z-index: 2;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 0 56rpx;
	box-sizing: border-box;
	transform: translateY(-50%);
}

.home__verse-t {
	width: 100%;
	font-family: $manna-font-serif;
	font-weight: 400;
	font-size: 36rpx;
	line-height: 1.5;
	letter-spacing: 0.01em;
	color: #ffffff;
	text-align: center;
	white-space: pre-wrap;
	text-shadow: 0 2rpx 16rpx rgba(0, 0, 0, 0.35);
}

.home__verse-r {
	width: 100%;
	margin-top: 36rpx;
	font-family: $manna-font-serif;
	font-weight: 400;
	font-size: 28rpx;
	line-height: 1.4;
	color: rgba(255, 255, 255, 0.88);
	text-align: center;
	letter-spacing: 0.02em;
	text-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.3);
}

/* 早祷（浅色底图）经文转深色字；晚祷沿用上面的白字。
   投影同步换成白色柔光，避免深影叠在深字上发糊。 */
.home--morning .home__verse-t {
	color: #212121;
	text-shadow: 0 2rpx 16rpx rgba(255, 255, 255, 0.6);
}

.home--morning .home__verse-r {
	color: rgba(33, 33, 33, 0.88);
	text-shadow: 0 2rpx 12rpx rgba(255, 255, 255, 0.55);
}

/* Figma 顶栏 h=58 @ top 51 — 紧贴状态栏，不额外加空 */
.home__top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	height: 96rpx;
	padding: 0 40rpx;
	box-sizing: border-box;
}

.home__top-right {
	display: flex;
	align-items: center;
}

.home__top-right .home__top-btn + .home__top-btn {
	margin-left: 32rpx;
}

.home__top-btn {
	width: 64rpx;
	height: 64rpx;
	border-radius: 50%;
	overflow: hidden;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	transform: translateZ(0);
}

.home__top-btn--press {
	opacity: 0.7;
}

.home__top-ico {
	width: 64rpx;
	height: 64rpx;
}

.home__top-ico.is-liked {
	filter: none;
}

.home__top-btn.is-spinning {
	animation: home-music-spin 4.5s linear infinite;
}

@keyframes home-music-spin {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}

/* Amen @580 / 812；运营卡在 Amen 下，不抢主构图 */
.home__foot {
	position: absolute;
	left: 0;
	right: 0;
	bottom: calc(#{$manna-page-pad-bottom} + env(safe-area-inset-bottom, 0px));
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 0 40rpx;
	box-sizing: border-box;
}

.home__amen {
	@include manna-cta-cream;
	position: relative;
	/* Figma 279:374：160×52 · blur 4 · shadow 0 2 6 */
	width: 320rpx;
	height: 104rpx;
	padding: 0;
	margin: 0;
	border: none;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	backdrop-filter: blur(8rpx);
	box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
}

.home__amen-dot {
	position: absolute;
	top: 8rpx;
	right: 16rpx;
	width: 16rpx;
	height: 16rpx;
	border-radius: 50%;
	background: #e23d3d;
	z-index: 2;
}

.home__amen::after {
	border: none;
}

.home__amen--press {
	transform: scale(0.97);
	opacity: 0.92;
}

.home__amen-ico {
	width: 48rpx;
	height: 48rpx;
	margin-right: 8rpx;
	flex-shrink: 0;
}

.home__amen-txt {
	font-family: $manna-font-body !important;
	font-weight: 700;
	font-size: 36rpx;
	color: $manna-btn-text;
	line-height: 1;
}

.home__hint {
	margin-top: 12rpx;
	font-size: 22rpx;
	color: $manna-ink-mute;
}

.home__cards {
	margin-top: 20rpx;
	width: 100%;
	/* 固定占位，避免卡片异步到达时脚底跳动/闪没 */
	min-height: 160rpx;
	isolation: isolate;
	opacity: 0.92;
}

.home__cards-inner {
	display: flex;
	flex-direction: row;
	flex-wrap: nowrap;
	align-items: stretch;
	width: max-content;
}

.home__card {
	position: relative;
	display: flex;
	flex-direction: column;
	justify-content: flex-start;
	box-sizing: border-box;
	overflow: hidden;
	flex: 0 0 auto;
	width: 280rpx;
	min-height: 160rpx;
	margin-right: 16rpx;
	padding: 22rpx 24rpx;
	@include manna-panel;
}

.home__card--cover {
	background: transparent;
	backdrop-filter: none;
}

.home__card-cover {
	position: absolute;
	left: 0;
	top: 0;
	width: 100%;
	height: 100%;
	z-index: 0;
}

.home__card-veil {
	position: absolute;
	left: 0;
	top: 0;
	width: 100%;
	height: 100%;
	z-index: 1;
	background: linear-gradient(180deg, rgba(0, 0, 0, 0.12) 0%, rgba(0, 0, 0, 0.46) 100%);
}

.home__card-ico {
	position: relative;
	z-index: 2;
	width: 48rpx;
	height: 48rpx;
	margin-bottom: 12rpx;
}

.home__card--press { opacity: 0.88; }

.home__card-t {
	position: relative;
	z-index: 2;
	display: block;
	font-family: $manna-font-body !important;
	font-weight: 600;
	font-size: 26rpx;
	line-height: 1.3;
	color: $manna-white;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.home__card-s {
	position: relative;
	z-index: 2;
	display: block;
	margin-top: 8rpx;
	font-family: $manna-font-body !important;
	font-size: 22rpx;
	color: $manna-ink-mute;
	line-height: 1.35;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
</style>

<!-- 非 scoped：压住 App.vue 全局桃色底，冷启未绘图层时不露粉闪 -->
<style lang="scss">
page {
	background: #22170b !important;
}
</style>
