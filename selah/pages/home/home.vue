<!--
  首页 Feed：滑动语录、点赞/收藏/举报、壁纸背景、签到入口与新人引导。
-->
<template>
	<view class="home">
		<image v-if="bgUrl" class="bg" :src="bgUrl" mode="aspectFill" />
		<view class="veil" />

		<!-- 顶栏：稿 Status bar=62、侧钮 y=62；H5 用 getStatusBarPx 回落 62 -->
		<view class="top" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="glass-pill" @tap.stop="goMe">
				<image class="pill-img" src="/static/ui/ico-profile.svg" mode="aspectFit" />
			</view>
			<view
				v-if="newcomer.visible"
				class="progress-pill"
				@tap.stop="openLikeSheet"
			>
				<image class="progress-ico" src="/static/ui/ico-like-on.svg" mode="aspectFit" />
				<text class="progress-num">{{ newcomer.current }}/{{ newcomer.goal }}</text>
				<view class="bar">
					<view class="bar-fill" :style="{ width: Math.min(100, (newcomer.current / newcomer.goal * 100)) + '%' }" />
				</view>
			</view>
			<view v-else class="brand-wrap">
				<text class="brand">{{ brandLabel }}</text>
			</view>
			<view class="glass-pill" @tap.stop="user.vip_level === 'free' ? goVip('quote_home') : go('/pagesA/wallpaper/wallpaper')">
				<image class="pill-img" src="/static/ui/ico-vip.svg" mode="aspectFit" />
			</view>
		</view>

		<swiper
			class="feed"
			vertical
			:current="current"
			@change="onSwipe"
			:circular="false"
		>
			<swiper-item v-for="(q, idx) in list" :key="q.id">
				<view class="card">
					<!-- 语录块：稿 Frame36 y=311/812 -->
					<view class="quote-block">
						<text class="quote">{{ q.content }}</text>
						<text v-if="q.source_ref" class="cite">-{{ q.source_ref }}</text>
					</view>
					<view v-if="q.locked" class="lock-mask" @tap.stop="goVip('quote_lock')">
						<text class="lock-text">{{ t('vip_content') }}</text>
						<text class="lock-cta">{{ t('unlock_vip') }}</text>
					</view>
					<view class="quote-hit" @longpress="openMore(q)" />
				</view>
			</swiper-item>
		</swiper>

		<!-- Share/Like：稿 Frame41 y=662；挂根层避免 swiper 裁切 -->
		<view v-if="activeQuote && !activeQuote.locked" class="mid-actions">
			<view class="icon-btn" @tap.stop="goShare(activeQuote)">
				<image class="act-img" src="/static/ui/ico-share.svg" mode="aspectFit" />
			</view>
			<view class="icon-btn" @tap.stop="toggleLike(activeQuote)">
				<image
					class="act-img"
					:src="liked[activeQuote.id] ? '/static/ui/ico-like-on.svg' : '/static/ui/ico-like.svg'"
					mode="aspectFit"
				/>
			</view>
		</view>

		<!-- Dock：稿 y=734 -->
		<view class="dock">
			<view class="glass-pill" @tap.stop="go('/pagesA/topics/topics')">
				<image class="pill-img" src="/static/ui/ico-star.svg" mode="aspectFit" />
			</view>
			<view class="glass-pill prayer" @tap.stop="goAi">
				<image class="pill-img" src="/static/ui/ico-prayer.svg" mode="aspectFit" />
				<text class="prayer-text">{{ t('prayer') }}</text>
			</view>
			<view class="glass-pill" @tap.stop="go('/pagesA/wallpaper/wallpaper')">
				<image class="pill-img" src="/static/ui/ico-paint.svg" mode="aspectFit" />
			</view>
		</view>

		<view v-if="bindBanner" class="bind-banner" @click="openBindBanner">
			<text class="bind-text">{{ t('bind_tip') }}</text>
			<text class="bind-x" @click.stop="dismissBind">×</text>
		</view>

		<!-- 新人任务说明 -->
		<u-popup :show="showLikeSheet" mode="bottom" @close="closeLikeSheet" bgColor="#f5f5f5" round="16">
			<view class="sheet">
				<text class="sheet-title">{{ newcomerTitle }}</text>
				<text class="sheet-desc">{{ newcomerDesc }}</text>
				<view class="sheet-cta" @tap="closeLikeSheet">
					<text class="sheet-cta-text">{{ t('got_it') }}</text>
				</view>
			</view>
		</u-popup>

		<!-- 打卡弹层 -->
		<u-popup :show="!!checkinPopup" mode="center" @close="checkinPopup = null" bgColor="transparent">
			<view class="checkin-pop" v-if="checkinPopup">
				<text class="cp-title">{{ checkinPopup.title }}</text>
				<text class="cp-sub">{{ checkinPopup.subtitle }}</text>
				<text v-if="checkinPopup.quota_line" class="cp-quota">{{ checkinPopup.quota_line }}</text>
				<view class="week">
					<view v-for="d in week" :key="d.date" class="day" :class="d.state">
						<text v-if="d.state === 'checked'">✓</text>
						<text v-else-if="d.state === 'frozen'">❄</text>
					</view>
				</view>
				<view class="sheet-cta" @tap="checkinPopup = null">
					<text class="sheet-cta-text">{{ checkinPopup.cta }}</text>
				</view>
			</view>
		</u-popup>

		<selah-sheet
			v-model:visible="moreSheetOpen"
			:title="t('more') || 'More'"
			:items="moreSheetItems"
			:cancel-text="t('cancel')"
			@select="onMoreSelect"
		/>
		<selah-sheet
			v-model:visible="reportSheetOpen"
			:title="t('report')"
			:items="reportSheetItems"
			:cancel-text="t('cancel')"
			@select="onReportSelect"
		/>
		<selah-sheet
			v-model:visible="folderSheetOpen"
			:title="t('collect')"
			:items="folderSheetItems"
			:cancel-text="t('cancel')"
			@select="onFolderSelect"
		/>

		<!-- 完成动效 -->
		<view v-if="showComplete" class="complete-toast">
			<text>{{ newcomerCongrats }}</text>
		</view>
		<!-- 喜欢爆发 -->
		<view v-if="burstShow" class="burst">
			<text class="burst-heart">♥</text>
		</view>
	</view>
</template>

<script setup>
/**
 * 首页 Feed：预取/缓存、新人点赞进度、VIP 遮罩、签到弹窗、朗读、举报与绑定引导。
 */
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiFeed, apiExpose, apiLike, apiDislike, apiCollect, apiReport, apiNewcomerLike, apiAppConfig, apiFolders, apiContentEnums } from '@/api/content.js'
import { apiCheckinDo } from '@/api/checkin.js'
import { apiDismissBindPrompt } from '@/api/auth.js'
import { ensureLogin, getUser, setUser, shouldForceLoginPage } from '@/utils/session.js'
import { track } from '@/utils/analytics.js'
import { playSfx } from '@/utils/sfx.js'
import { localizeCheckinPopup } from '@/utils/checkinPopup.js'
import { readPageCache, writePageCache, loadWithCache } from '@/utils/pageCache.js'
import { hideNativeTabBar } from '@/utils/tabbar.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { APP_CONFIG_KEY, resolveActiveWallpaper, wallpaperDisplayUrl } from '@/utils/wallpaperCache.js'
import { appConfigRevision } from '@/utils/bootstrap.js'
import { goVip as navigateVip } from '@/utils/vip.js'
import { createTapLock } from '@/utils/tapLock.js'

const HOME_CACHE_KEY = 'home_v1'
/** 首屏条数 */
const FEED_FIRST_PAGE = 12
/** 静默/滑动补货每批 */
const FEED_BATCH = 10
/** 会话内列表软上限（非无限滚动） */
const FEED_SOFT_CAP = 48
/** 前方剩余 ≤ 此值时再补货 */
const FEED_LOW_WATER = 6
/** 首屏就绪后静默预取轮数 */
const FEED_SILENT_ROUNDS = 2

let feedLoading = false
let feedExhausted = false

/** 把 pageCache 中的 feed/newcomer/checkin 状态灌入页面（首屏秒开）。 */

function applyHomeCache(snap) {
	if (!snap || typeof snap !== 'object') return
	if (Array.isArray(snap.list) && snap.list.length) {
		list.value = snap.list
		liked.value = snap.liked || {}
	}
	if (snap.config) config.value = snap.config
	if (Array.isArray(snap.reportReasons) && snap.reportReasons.length) {
		reportReasons.value = snap.reportReasons
	}
	if (snap.bgUrl) bgUrl.value = snap.bgUrl
	if (snap.newcomer) newcomer.value = { ...newcomer.value, ...snap.newcomer }
}

/** 将当前 feed 与相关状态写入 pageCache，供下次进入秒开。 */

function persistHomeCache() {
	writePageCache(HOME_CACHE_KEY, {
		list: list.value.slice(0, FEED_FIRST_PAGE + FEED_BATCH),
		liked: liked.value,
		config: config.value,
		reportReasons: reportReasons.value,
		bgUrl: bgUrl.value,
		newcomer: newcomer.value,
	})
}

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
let audioCtx = null
const burstShow = ref(false)

/** 播放当前语录朗读 audio_url；尊重 muted；切换卡片时停上一段。 */

function playAudio(q) {
	if (!q.audio_url) return
	const u = getUser() || {}
	if (u.muted || u.sound_enabled === false) {
		uni.showToast({ title: t('muted') || 'Muted', icon: 'none' })
		return
	}
	try {
		if (audioCtx) {
			audioCtx.stop()
			audioCtx.destroy()
		}
		audioCtx = uni.createInnerAudioContext()
		audioCtx.src = q.audio_url
		audioCtx.play()
		track('quote_audio_play', { content_id: q.id })
	} catch (e) {
		uni.showToast({ title: t('audio_unavailable'), icon: 'none' })
	}
}

const list = ref([])
const current = ref(0)
const liked = ref({})
const activeQuote = computed(() => list.value[current.value] || null)
const user = ref(getUser())
const newcomer = ref({ current: 0, goal: 5, visible: false, completed: false })
const showLikeSheet = ref(false)
const checkinPopup = ref(null)
const week = ref([])
const showComplete = ref(false)
const bindBanner = ref(false)
const moreSheetOpen = ref(false)
const moreSheetItems = ref([])
const moreTarget = ref(null)
const reportSheetOpen = ref(false)
const reportSheetItems = ref([])
const reportTarget = ref(null)
const folderSheetOpen = ref(false)
const folderSheetItems = ref([])
const folderTarget = ref(null)
const folderList = ref([])
const bgUrl = ref('')
const config = ref({})

function cfgText(key, i18nKey) {
	const v = String((config.value || {})[key] || '').trim()
	return v || t(i18nKey)
}

const brandLabel = computed(() => {
	const bn = String((config.value || {}).brand_name || '').trim()
	return bn || t('brand')
})
const newcomerTitle = computed(() => cfgText('newcomer_intro_title', 'newcomer_title'))
const newcomerDesc = computed(() => cfgText('newcomer_intro_body', 'newcomer_desc'))
const newcomerCongrats = computed(() => cfgText('newcomer_congrats_text', 'newcomer_congrats'))
const newcomerDone = computed(() => cfgText('newcomer_done_text', 'newcomer_done'))
const reportReasons = ref([
	{ value: 'inappropriate', labelKey: 'report_inappropriate' },
	{ value: 'hate', labelKey: 'report_hate' },
	{ value: 'spam', labelKey: 'report_spam' },
	{ value: 'copyright', labelKey: 'report_copyright' },
	{ value: 'other', labelKey: 'report_other' },
])
const REPORT_I18N = {
	inappropriate: 'report_inappropriate',
	hate: 'report_hate',
	spam: 'report_spam',
	copyright: 'report_copyright',
	other: 'report_other',
}

/** 顶栏 / Dock 固定控件防抖；不影响 swiper 滑动 */

const chromeTap = createTapLock(500)

/** 通用分包导航（topics/checkin/share 等）。 */

const go = (url) => chromeTap.run(() => uni.navigateTo({ url }))
const goAi = () => chromeTap.run(() => uni.switchTab({ url: '/pages/ai/ai' }))
const goMe = () => chromeTap.run(() => uni.switchTab({ url: '/pages/profile/profile' }))
/** 跳转 VIP 页（VIP 锁遮罩 / 额度不足引导）。 */

const goVip = (src) => chromeTap.run(() => {
	track('home_enter_vip', { pay_trigger_source: src || 'quote_home' })
	navigateVip(src || 'quote_home')
})
/** 携带当前语录 id 进入分享页。 */

const goShare = (q) => chromeTap.run(() => uni.navigateTo({ url: `/pagesA/share/share?id=${q.id}` }))

let dwellStarted = Date.now()
let dwellContentId = null

/** 打开点赞后的收藏夹选择底栏。 */

function openLikeSheet() {
	showLikeSheet.value = true
	track('newcomer_like_sheet_show')
}
/** 关闭收藏夹选择底栏。 */

function closeLikeSheet() {
	if (showLikeSheet.value) track('newcomer_like_sheet_dismiss')
	showLikeSheet.value = false
}

/** 记录当前卡停留，满足阈值后上报 expose（推荐反馈）。 */

function markDwell(nextId) {
	if (dwellContentId != null) {
		track('quote_dwell', {
			content_id: dwellContentId,
			dwell_ms: Date.now() - dwellStarted,
		})
	}
	dwellContentId = nextId
	dwellStarted = Date.now()
}

/** 组装曝光埋点参数（content_id / 位置 / 来源）。 */

function quoteExposeParams(q) {
	return {
		content_id: q.id,
		interest_tags: (q.interest_tags || []).join(','),
		is_vip_content: !!q.is_vip,
		is_cold_start: !!q.in_cold_start_pool,
	}
}

/** 拉取 Feed（可 refresh）；成功后 merge 并 persist；触发新人进度与签到弹窗逻辑。 */

async function loadFeed({ trackView = true } = {}) {
	feedExhausted = false
	const res = await apiFeed({ pageSize: FEED_FIRST_PAGE })
	list.value = res.results.list || []
	current.value = 0
	const map = {}
	list.value.forEach((q) => { if (q.liked) map[q.id] = true })
	liked.value = map
	if (list.value[0] && trackView) {
		apiExpose(list.value[0].id)
		track('quote_expose', quoteExposeParams(list.value[0]))
		track('home_quote_view', { enter_ts: Date.now(), content_id: list.value[0].id })
		markDwell(list.value[0].id)
	}
}

/** 合并新旧 Feed，按 id 去重，保留已 like 等本地态。 */

function mergeFeedItems(incoming) {
	if (!incoming?.length) return 0
	const seen = new Set(list.value.map((q) => q.id))
	const add = []
	const likePatch = { ...liked.value }
	for (const q of incoming) {
		if (!q?.id || seen.has(q.id)) continue
		seen.add(q.id)
		add.push(q)
		if (q.liked) likePatch[q.id] = true
	}
	if (!add.length) return 0
	const room = Math.max(FEED_SOFT_CAP - list.value.length, 0)
	const slice = add.slice(0, room)
	list.value = list.value.concat(slice)
	liked.value = likePatch
	return slice.length
}

/** 静默补货 / 上拉加载更多：受软上限 FEED_SOFT_CAP 与 feedLoading/feedExhausted 并发锁约束 */
async function fetchMoreFeed(pageSize = FEED_BATCH) {
	if (feedLoading || feedExhausted) return 0
	if (list.value.length >= FEED_SOFT_CAP) return 0
	feedLoading = true
	try {
		const need = Math.min(pageSize, FEED_SOFT_CAP - list.value.length)
		const res = await apiFeed({ pageSize: need })
		const items = res.results?.list || []
		if (!items.length) {
			feedExhausted = true
			return 0
		}
		const n = mergeFeedItems(items)
		// 全是重复也视为本批无增量，避免死循环狂刷
		if (n === 0) feedExhausted = true
		return n
	} catch (e) {
		return 0
	} finally {
		feedLoading = false
	}
}

/** 首屏就绪后后台静默预取有限轮次，写入缓存但不打断当前滑动 */
async function silentPrefetchFeed() {
	for (let i = 0; i < FEED_SILENT_ROUNDS; i++) {
		if (list.value.length >= FEED_SOFT_CAP || feedExhausted) break
		const n = await fetchMoreFeed(FEED_BATCH)
		if (!n) break
	}
	persistHomeCache()
}

/** 滑动接近末尾时触发 silentPrefetch，降低白屏。 */

function maybePrefetchOnSwipe() {
	const ahead = list.value.length - current.value - 1
	if (ahead > FEED_LOW_WATER) return
	if (list.value.length >= FEED_SOFT_CAP || feedExhausted || feedLoading) return
	fetchMoreFeed(FEED_BATCH).then((n) => {
		if (n) persistHomeCache()
	})
}

/** 拉取新人点赞进度（如 0/5）；目标来自 newcomer_like_goal。 */

async function loadNewcomer() {
	const res = await apiNewcomerLike()
	newcomer.value = {
		...res.results,
		visible: !!res.results.visible,
	}
	const seen = !!uni.getStorageSync('newcomer_sheet_seen')
	if (newcomer.value.visible && !newcomer.value.completed && !seen) {
		showLikeSheet.value = true
		uni.setStorageSync('newcomer_sheet_seen', '1')
		track('newcomer_like_sheet_show', { scene: 'auto' })
	}
}

/** 将签到结果交给 localizeCheckinPopup 做 i18n 文案。 */

function localizeCheckinPopupLocal(data) {
	const miss = Number((config.value || {}).streak_miss_reset_days)
	return localizeCheckinPopup(data, t, {
		miss_reset_days: Number.isFinite(miss) && miss > 0 ? miss : undefined,
	})
}

/**
 * 首页首开自动打卡：对接 /checkin/do/
 * - already：今日已打，只埋点不弹层
 * - scenario=revive：爱心冻结漏打日；restart：断签清零；normal：正常 +1
 * - popup 文案经 localizeCheckinPopup 转当前语言后再展示
 */
async function runCheckin() {
	try {
		const res = await apiCheckinDo()
		const data = res.results || {}
		// 周条三态供弹层日历条使用
		week.value = data.week || []
		// 后端可能回写 streak / hearts / free_quota，同步本地会话
		if (data.user) {
			setUser(data.user)
			user.value = data.user
		}
		if (!data.already) {
			track('checkin_success', {
				streak_days: data.streak_days,
				granted_quota: data.granted_quota,
				hit_cap: data.hit_cap,
				vip_level: data.vip_level,
				frozen_days: (data.frozen_days || []).length,
			})
			// 冻结成功单独埋点，便于漏斗看「爱心消耗」
			if ((data.frozen_days || []).length) {
				track('checkin_freeze', { used_hearts: (data.frozen_days || []).length })
			}
			if (data.scenario === 'restart') {
				track('checkin_reset', { streak_days: data.streak_days })
			}
			// 运营可关 auto_popup；关闭时 data.popup 为 null
			if (data.popup) {
				checkinPopup.value = localizeCheckinPopupLocal(data)
				track('checkin_show', { scene: 'auto' })
			}
		} else {
			track('checkin_already')
		}
	} catch (e) {}
}

/**
 * 喜欢/取消喜欢：
 * 1) 乐观更新本地 liked map（立即红心）
 * 2) 喜欢时播音效 + 爆发动效
 * 3) 调 /content/like/；用返回的 newcomer_like 刷新 0/5 进度
 * 4) just_completed=true：播完成层，约 2.2s 后隐藏进度条（已完成不再展示）
 * 注意：取消喜欢会减少后端 current，但 completed 标记不回退
 */
async function toggleLike(q) {
	const next = !liked.value[q.id]
	// 乐观 UI：不等接口回来先翻状态，避免滑动卡顿
	liked.value = { ...liked.value, [q.id]: next }
	if (next) {
		playSfx('like')
		burstShow.value = true
		setTimeout(() => { burstShow.value = false }, 700)
	}
	const res = await apiLike(q.id, next)
	track('quote_like', { content_id: q.id, action: next ? 'like' : 'unlike' })
	const nl = res.results.newcomer_like
	if (nl) {
		// visible：未完成持续显示；刚完成这一次仍显示以便播动效
		newcomer.value = { ...nl, visible: nl.visible && !nl.completed ? true : nl.just_completed }
		track('newcomer_like_progress', { current: nl.current, goal: nl.goal })
		if (nl.just_completed) {
			showComplete.value = true
			track('newcomer_like_complete')
			setTimeout(() => {
				showComplete.value = false
				// 完成后隐藏顶栏进度，避免长期占位
				newcomer.value.visible = false
			}, 2200)
			uni.showToast({
				title: newcomerDone.value,
				icon: 'none',
				duration: 2500,
			})
		}
	}
}

/** 更多菜单：不感兴趣 / 举报 / 收藏（Selah 底栏，非系统 ActionSheet）。 */

function openMore(q) {
	moreTarget.value = q
	const items = [
		{ code: 'dislike', label: t('dislike') },
		{ code: 'collect', label: t('collect') },
		{ code: 'report', label: t('report') },
		{ code: 'share', label: t('share') },
	]
	if (q.audio_url) items.push({ code: 'listen', label: t('listen') || 'Listen' })
	moreSheetItems.value = items
	moreSheetOpen.value = true
}

async function onMoreSelect({ value }) {
	const q = moreTarget.value
	if (!q) return
	if (value === 'dislike') {
		await apiDislike(q.id)
		track('quote_dislike', { content_id: q.id })
		list.value = list.value.filter((x) => x.id !== q.id)
		uni.showToast({ title: t('hide'), icon: 'none' })
	} else if (value === 'collect') {
		collectQuote(q)
	} else if (value === 'report') {
		reportTarget.value = q
		reportSheetItems.value = reportReasons.value.map((r) => ({
			code: r.value,
			label: t(r.labelKey || REPORT_I18N[r.value] || 'report_other'),
		}))
		reportSheetOpen.value = true
	} else if (value === 'share') {
		goShare(q)
	} else if (value === 'listen') {
		playAudio(q)
	}
}

async function onReportSelect({ value }) {
	const q = reportTarget.value
	if (!q) return
	const reason = value || 'other'
	await apiReport(q.id, reason)
	track('quote_report', { content_id: q.id, reason })
	uni.showToast({ title: t('reported'), icon: 'none' })
}

/** 收藏到选定文件夹。 */

async function collectQuote(q) {
	try {
		const res = await apiFolders()
		const folders = res.results || []
		if (!folders.length) {
			await apiCollect(q.id)
			track('quote_collect', { content_id: q.id, action: 'collect' })
			uni.showToast({ title: t('collected'), icon: 'none' })
			return
		}
		folderTarget.value = q
		folderList.value = folders
		folderSheetItems.value = folders.map((f) => ({ code: String(f.id), label: f.name }))
		folderSheetOpen.value = true
	} catch (e) {
		await apiCollect(q.id)
		track('quote_collect', { content_id: q.id, action: 'collect' })
		uni.showToast({ title: t('collected'), icon: 'none' })
	}
}

async function onFolderSelect({ value }) {
	const q = folderTarget.value
	if (!q) return
	const folderId = Number(value)
	await apiCollect(q.id, folderId)
	track('quote_collect', { content_id: q.id, action: 'collect', folder_id: folderId })
	uni.showToast({ title: t('collected'), icon: 'none' })
}

/** 卡片滑动：切换索引、曝光、预取、停音频。 */

function onSwipe(e) {
	current.value = e.detail.current
	const q = list.value[current.value]
	if (q) {
		apiExpose(q.id)
		track('quote_expose', quoteExposeParams(q))
		track('home_scroll', { loaded_count: list.value.length })
		markDwell(q.id)
	}
	maybePrefetchOnSwipe()
}

/** 关闭绑定账号横幅并调 dismiss-bind-prompt。 */

async function dismissBind() {
	bindBanner.value = false
	await apiDismissBindPrompt()
	track('bind_prompt_dismiss', { scene: 'banner' })
	const u = getUser()
	u.bind_prompt_dismissed = true
	setUser(u)
}

/** 展示绑定引导（新用户/未绑 OAuth）。 */

function openBindBanner() {
	track('bind_prompt_click', { scene: 'banner', target: 'settings' })
	uni.navigateTo({ url: '/pagesA/settings/settings' })
}

/** 应用当前壁纸：本地快照秒开；无 token 时禁止拉需鉴权列表，避免抢跑 401。 */

async function applyWallpaper(opts = {}) {
	try {
		const hasToken = !!uni.getStorageSync('token')
		const snap = await resolveActiveWallpaper(user.value, {
			...opts,
			allowNetwork: hasToken && opts.allowNetwork !== false,
		})
		const url = wallpaperDisplayUrl(snap)
		if (url) bgUrl.value = url
	} catch (e) {}
}

onShow(async () => {
	hideNativeTabBar()
	user.value = getUser()
	if (user.value && (user.value.user_id || user.value.wallpaper_id)) {
		// 仅本地缓存秒开；网络刷新留给 onMounted ensureLogin 之后
		try { await applyWallpaper({ allowNetwork: false }) } catch (e) {}
	}
})

/**
 * 首页挂载顺序（刻意设计，勿随意调序）：
 * 1. 灌缓存秒开 → 2. ensureLogin → 3. 绑定弱提示 Banner
 * 4. app-config / 举报枚举 / 壁纸 → 5. 拉 Feed（有缓存则不再重复埋首曝）
 * 6. 新人喜欢进度 → 写缓存 → 静默预取 → 自动打卡（可关）
 */
onMounted(async () => {
	if (shouldForceLoginPage()) {
		uni.reLaunch({ url: '/pagesA/welcome/welcome' })
		return
	}
	// 1) 先灌缓存：网络慢时也能先滑已有语录
	applyHomeCache(readPageCache(HOME_CACHE_KEY))
	try {
		await ensureLogin()
		user.value = getUser()
		// 未绑三方且未主动关闭 → 展示弱提示；不拦截 Feed
		bindBanner.value = !user.value.google_bound && !user.value.apple_bound && !user.value.bind_prompt_dismissed
		if (bindBanner.value) track('bind_prompt_show', { scene: 'banner' })

		try {
			await loadWithCache(
				APP_CONFIG_KEY,
				async () => (await apiAppConfig()).results || {},
				(cfg) => { config.value = cfg || {} },
				{ getRevision: appConfigRevision },
			)
		} catch (e) {}
		try {
			// 举报理由：拉 enums 并缓存；失败时用上次缓存，再回落本地 REPORT_FALLBACK
			await loadWithCache(
				'report_reasons_v1',
				async () => {
					const enums = await apiContentEnums()
					return (enums.results || {}).report_reasons || []
				},
				(reasons) => {
					if (Array.isArray(reasons) && reasons.length) {
						reportReasons.value = reasons.map((r) => ({
							value: r.value,
							labelKey: REPORT_I18N[r.value] || 'report_other',
						}))
					}
				},
			)
		} catch (e) {}
		await applyWallpaper({ allowNetwork: true })
		const hadCache = list.value.length > 0
		// 有缓存：后台静默刷 Feed，拉完直接替换；无缓存才等待首屏
		const feedRefresh = loadFeed({ trackView: !hadCache }).then(() => {
			persistHomeCache()
			return silentPrefetchFeed()
		})
		if (!hadCache) {
			await feedRefresh
		} else {
			feedRefresh.catch(() => {})
		}
		await loadNewcomer()
		persistHomeCache()
		// 用户关了「打卡记录」则不自动 do；与后端 skipped 口径一致
		if (user.value.checkin_record_enabled !== false) {
			runCheckin().catch(() => {})
		}
	} catch (e) {
		console.error('home init failed', e)
		// 无缓存且初始化失败才 toast，避免有缓存时吓人
		if (!list.value.length) {
			uni.showToast({ title: t('load_failed'), icon: 'none' })
		}
	}
})
</script>

<style scoped>
.home {
	position: relative;
	height: 100vh;
	overflow: hidden;
	background-color: #fbf8f2;
	background-image: linear-gradient(180deg, #b6badf 0%, #fff0d9 48%, #f5dfbc 100%);
	color: #191919;
}
.bg {
	position: absolute;
	left: 0;
	top: 0;
	width: 100%;
	height: 100%;
	opacity: 0.22;
}
.veil {
	position: absolute;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	z-index: 1;
	background: linear-gradient(180deg, rgba(251, 248, 242, 0.08), rgba(251, 248, 242, 0.42));
	pointer-events: none;
}
/* 纵向按稿 812 比例（top %），避免 rpx 随屏宽拉伸导致竖向错位 */
.top {
	position: absolute;
	z-index: 5;
	top: 0;
	left: 0;
	right: 0;
	padding-left: 32rpx;
	padding-right: 32rpx;
	padding-bottom: 0;
	box-sizing: border-box;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	min-height: 88rpx;
}
.glass-pill {
	width: 88rpx;
	height: 88rpx;
	flex-shrink: 0;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.56);
	box-shadow: 0 8rpx 40rpx rgba(0, 0, 0, 0.1);
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}
.pill-img {
	width: 48rpx;
	height: 48rpx;
}
.brand-wrap {
	flex: 1;
	display: flex;
	justify-content: center;
	align-items: center;
}
.brand {
	font-family: "SelahDisplay", "Libre Baskerville", "Times New Roman", Georgia, serif;
	font-size: 36rpx;
	font-weight: 700;
	color: #191919;
}
/* 稿 6:1487 — 165×28 */
.progress-pill {
	width: 330rpx;
	height: 56rpx;
	padding: 0 20rpx;
	box-sizing: border-box;
	flex-shrink: 0;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.56);
	box-shadow: 0 8rpx 40rpx rgba(0, 0, 0, 0.1);
	display: flex;
	flex-direction: row;
	align-items: center;
}
.progress-ico {
	width: 40rpx;
	height: 40rpx;
	flex-shrink: 0;
	margin-right: 8rpx;
}
.progress-num {
	font-size: 28rpx;
	line-height: 1;
	color: #191919;
	font-weight: 500;
	flex-shrink: 0;
}
.bar {
	width: 172rpx;
	height: 12rpx;
	background: rgba(175, 178, 186, 0.55);
	margin-left: 16rpx;
	border-radius: 999rpx;
	overflow: hidden;
	flex-shrink: 0;
}
.bar-fill {
	height: 100%;
	background: #c5c3e8;
}
.feed {
	position: relative;
	height: 100%;
	z-index: 2;
}
.card {
	height: 100%;
	position: relative;
	box-sizing: border-box;
}
/* 稿 Frame 36：y=311/812 */
.quote-block {
	position: absolute;
	left: 32rpx;
	right: 32rpx;
	top: calc(100% * 311 / 812);
	z-index: 2;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.lock-mask {
	position: absolute;
	left: 48rpx;
	right: 48rpx;
	top: 42%;
	padding: 32rpx;
	background: rgba(251, 248, 242, 0.95);
	border-radius: 32rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	z-index: 3;
	border: 2rpx solid rgba(25, 25, 25, 0.06);
}
.lock-text { color: #5c5c5c; font-size: 24rpx; }
.lock-cta { color: #191919; margin-top: 12rpx; font-size: 28rpx; font-weight: 600; }
.quote {
	font-family: "SelahDisplay", "Libre Baskerville", "Times New Roman", Georgia, serif;
	font-size: 48rpx;
	line-height: 1.28;
	color: #191919;
	text-align: center;
	font-weight: 700;
	width: 100%;
}
.cite {
	margin-top: 20rpx;
	font-family: "SelahDisplay", "Libre Baskerville", "Times New Roman", Georgia, serif;
	font-size: 28rpx;
	color: #191919;
	text-align: center;
	width: 100%;
}
.quote-hit {
	position: absolute;
	left: 48rpx;
	right: 48rpx;
	top: 30%;
	bottom: 22%;
	z-index: 1;
}
/* 稿 Frame 41：y=662，高 36，间距 40 */
.mid-actions {
	position: absolute;
	left: 0;
	right: 0;
	top: calc(100% * 662 / 812);
	bottom: auto;
	height: 72rpx;
	display: flex;
	flex-direction: row;
	justify-content: center;
	align-items: center;
	z-index: 7;
	pointer-events: auto;
}
.icon-btn {
	width: 72rpx;
	height: 72rpx;
	margin: 0 40rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}
.act-img {
	width: 72rpx;
	height: 72rpx;
}
.icon {
	font-size: 40rpx;
	color: #191919;
}
.icon.more {
	letter-spacing: 2rpx;
}
/* 稿 dock y=734；Prayer 宽 95 */
.dock {
	position: absolute;
	z-index: 6;
	left: 32rpx;
	right: 32rpx;
	top: calc(100% * 734 / 812);
	bottom: auto;
	height: 88rpx;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	filter: drop-shadow(0 8rpx 40rpx rgba(0, 0, 0, 0.12));
}
.dock .prayer {
	width: 190rpx;
	padding: 0 24rpx;
	box-sizing: border-box;
}
.prayer-text {
	margin-left: 8rpx;
	font-size: 28rpx;
	color: #191919;
}
.bind-banner {
	position: absolute;
	z-index: 8;
	left: 24rpx;
	right: 24rpx;
	bottom: 16%;
	padding: 20rpx 28rpx;
	background: rgba(255, 255, 255, 0.92);
	border-radius: 32rpx;
	display: flex;
	flex-direction: row;
	align-items: center;
	border: 2rpx solid rgba(25, 25, 25, 0.06);
}
.bind-text {
	flex: 1;
	font-size: 24rpx;
	color: #191919;
}
.bind-x {
	padding: 8rpx 16rpx;
	font-size: 32rpx;
	color: #191919;
}
.sheet {
	padding: 40rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
	color: #191919;
	background: #f5f5f5;
}
.sheet-title {
	display: block;
	font-family: "SelahDisplay", "Libre Baskerville", "Times New Roman", Georgia, serif;
	font-size: 40rpx;
	font-weight: 700;
	margin-bottom: 16rpx;
	text-align: center;
}
.sheet-desc {
	display: block;
	font-size: 28rpx;
	color: #5c5c5c;
	margin-bottom: 32rpx;
	text-align: center;
	line-height: 1.4;
}
.sheet-cta {
	height: 96rpx;
	border-radius: 32rpx;
	background: #191919;
	display: flex;
	align-items: center;
	justify-content: center;
}
.sheet-cta-text {
	color: #ffffff;
	font-size: 32rpx;
	font-weight: 600;
}
.checkin-pop {
	width: 600rpx;
	padding: 48rpx 40rpx;
	background: #ffffff;
	border-radius: 32rpx;
	color: #191919;
	box-shadow: 0 16rpx 64rpx rgba(0, 0, 0, 0.12);
}
.cp-title {
	display: block;
	font-size: 34rpx;
	text-align: center;
	margin-bottom: 12rpx;
}
.cp-sub {
	display: block;
	font-size: 26rpx;
	color: #5c5c5c;
	text-align: center;
	margin-bottom: 16rpx;
}
.cp-quota {
	display: block;
	font-size: 26rpx;
	color: #191919;
	text-align: center;
	margin-bottom: 28rpx;
}
.week {
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	margin-bottom: 36rpx;
}
.day {
	width: 56rpx;
	height: 56rpx;
	border-radius: 50%;
	border: 2rpx solid rgba(25, 25, 25, 0.15);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 24rpx;
	color: #191919;
}
.day.checked {
	background: #d97b8c;
	border-color: #d97b8c;
	color: #fff;
}
.day.frozen {
	background: #c5c3e8;
	border-color: #c5c3e8;
}
.complete-toast {
	position: absolute;
	z-index: 20;
	left: 40rpx;
	right: 40rpx;
	top: 40%;
	padding: 32rpx;
	background: #191919;
	color: #fff;
	border-radius: 32rpx;
	text-align: center;
}
.burst {
	position: absolute;
	z-index: 25;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	pointer-events: none;
}
.burst-heart {
	font-size: 120rpx;
	color: #d97b8c;
	animation: burstPop 0.7s ease-out forwards;
}
@keyframes burstPop {
	0% { transform: scale(0.3); opacity: 0; }
	40% { transform: scale(1.35); opacity: 1; }
	100% { transform: scale(1.8); opacity: 0; }
}
</style>
