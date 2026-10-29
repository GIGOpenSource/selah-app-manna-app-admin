<!--
  AI 对话页：欢迎态 / 快捷开场 / 额度校验 / 思考中 / 失败重试 / 经文赞藏转 / 日历 / 返回挽留。
  背景跟随当前壁纸（同首页）。空态 3 条推荐在输入框上方；发送后新推荐在气泡下，其中一条为绑定经文。
-->
<template>
	<view :class="['ai-page', bgVideoUrl ? 'has-dyn-bg' : '']">
		<image v-if="bgUrl && !bgVideoUrl" class="bg" :src="bgUrl" mode="aspectFill" @error="onBgError" />
		<video
			v-if="bgVideoUrl"
			id="aiBgVideo"
			class="bg bg-video"
			:src="bgVideoUrl"
			:autoplay="true"
			:loop="true"
			:muted="true"
			:controls="false"
			:playsinline="true"
			:show-center-play-btn="false"
			:show-play-btn="false"
			:show-fullscreen-btn="false"
			:show-mute-btn="false"
			:show-loading="false"
			:enable-progress-gesture="false"
			object-fit="cover"
			@error="onBgVideoError"
		/>
		<view class="veil" />

		<view class="custom-nav" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="nav-pill" @tap.stop="goHome">
				<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
			</view>
			<view class="nav-side">
				<text
					v-if="showGetFree"
					class="get"
					@click="goCheckin"
				>{{ t('get_free') }}</text>
				<view class="nav-pill" @tap.stop="goCalendar">
					<image class="nav-ico" src="/static/ui/ico-calendar.svg" mode="aspectFit" />
				</view>
			</view>
		</view>

		<view v-if="!isToday" class="hist-banner" @tap="backToToday">
			<text class="hist-banner-text">{{ historyBannerText }}</text>
			<text class="hist-banner-cta">{{ t('ai_back_today') }}</text>
		</view>

		<scroll-view scroll-y class="msgs" :scroll-into-view="scrollId" :bounces="false">
			<view v-if="showWelcome" class="empty-state">
				<text class="intro">{{ t('ai_intro') }}</text>
				<view class="bubble assistant greet">
					<text class="bubble-text">{{ greetingText }}</text>
				</view>
			</view>

			<view
				v-for="m in messages"
				:key="m.id"
				:id="'m' + m.id"
				:class="['bubble-row', m.role]"
			>
				<view
					v-if="m.status === 'thinking'"
					class="bubble assistant thinking"
				>
					<text class="bubble-text">{{ t('ai_thinking') }}</text>
					<view class="dots">
						<view class="dot" />
						<view class="dot" />
						<view class="dot" />
					</view>
				</view>
				<view
					v-else-if="m.status === 'failed'"
					class="bubble assistant fail"
				>
					<text class="bubble-text">{{ t('ai_fail_hint') }}</text>
					<view class="retry-hit" @tap.stop="retryFailed(m)">
						<image class="retry-ico" src="/static/ui/ico-up.svg" mode="aspectFit" />
					</view>
				</view>
				<view
					v-else-if="m.role === 'assistant' && m.msg_type === 'verse'"
					class="bubble assistant verse"
					@longpress="onMsgLongPress(m)"
				>
					<text class="bubble-text">{{ m.verse_text || m.content }}</text>
					<text v-if="m.source_ref" class="verse-cite">— {{ m.source_ref }}</text>
					<view class="verse-actions">
						<view v-if="m.content_id" class="ico-hit" @tap.stop="onLikeHit(m)">
							<image
								class="row-ico"
								:src="m.liked ? '/static/ui/ico-like-on.svg' : '/static/ui/ico-like.svg'"
								mode="aspectFit"
							/>
						</view>
						<view v-if="m.content_id" class="ico-hit" @tap.stop="onCollectHit(m)">
							<image
								class="row-ico"
								:src="m.collected ? '/static/ui/share/ico-collect-on.svg' : '/static/ui/share/ico-collect.svg'"
								mode="aspectFit"
							/>
						</view>
						<view class="ico-hit" @click.stop="forwardMsg(m)">
							<image class="row-ico" src="/static/ui/ico-share.svg" mode="aspectFit" />
						</view>
					</view>
				</view>
				<view
					v-else
					:class="['bubble', m.role]"
					@longpress="onMsgLongPress(m)"
				>
					<text class="bubble-text">{{ m.content }}</text>
					<view
						v-if="m.role === 'assistant' && !m.safety_blocked"
						class="bubble-share"
						@click.stop="forwardMsg(m)"
					>
						<image class="bubble-share-ico" src="/static/ui/ico-share.svg" mode="aspectFit" />
					</view>
				</view>
			</view>

			<view v-if="hotlines.length" class="hotlines" id="hotlines">
				<text class="hl-title">{{ t('crisis_resources') }}</text>
				<view
					v-for="(h, i) in hotlines"
					:key="i"
					class="hl-row"
					@click="openHotline(h)"
				>
					<text>{{ h.label }} · {{ h.phone_or_url }}</text>
				</view>
			</view>
			<view v-if="underReplyChips.length" id="followups" class="suggests under-reply">
				<view
					v-for="(q, i) in underReplyChips"
					:key="'r' + i + (q.id || q.kind || '') + (q.title || q.prompt)"
					class="suggest"
					@click="onChipTap(q)"
				>
					<text class="suggest-text">{{ q.title || q.prompt }}</text>
					<image class="chev-img" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
			<!-- 键盘弹起后滚到此处，保证最新消息完整露在输入框上方 -->
			<view id="msg-end" class="msg-end" />
		</scroll-view>

		<view v-if="isToday && showWelcome && dockChips.length" class="dock-suggests">
			<view
				v-for="q in dockChips"
				:key="'d' + (q.id || q.title)"
				class="suggest"
				@click="onChipTap(q)"
			>
				<text class="suggest-text">{{ q.title }}</text>
				<image class="chev-img" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
		</view>

		<view v-if="isToday && !historyLoading" class="input-row">
			<input
				v-model="text"
				class="input"
				:placeholder="t('ai_placeholder')"
				:adjust-position="false"
				:hold-keyboard="true"
				confirm-type="send"
				@confirm="send()"
				@focus="onInputFocus"
				@blur="onInputBlur"
			/>
			<view class="send" @click="send()">
				<image class="send-ico" src="/static/ui/ico-send.svg" mode="aspectFit" />
			</view>
		</view>
		<!-- 仅补「系统未压矮」的差额，避免多次 focus 双重抬升 -->
		<view class="kb-spacer" :style="{ height: keyboardPadPx + 'px' }" />

		<view v-if="historyLoading" class="enter-loading">
			<view class="history-spinner" />
		</view>

		<selah-sheet
			v-model:visible="msgSheetOpen"
			:title="t('more') || 'More'"
			:items="msgSheetItems"
			:cancel-text="t('cancel')"
			@select="onMsgSheetSelect"
		/>
		<selah-dialog
			v-model:visible="deleteDialogOpen"
			:title="t('delete')"
			:content="t('ai_delete_confirm')"
			:confirm-text="t('delete')"
			:cancel-text="t('cancel')"
			@confirm="confirmDeleteMsg"
		/>
		<selah-dialog
			v-model:visible="retainDialogOpen"
			:title="t('ai_retain_title')"
			:content="t('ai_retain_body')"
			:confirm-text="t('ai_retain_leave')"
			:cancel-text="t('ai_retain_stay')"
			@confirm="leaveToHome"
			@cancel="retainDialogOpen = false"
		/>
	</view>
</template>

<script setup>
/**
 * AI 聊天：额度预校验、思考中、失败重试、经文赞藏转、按日历史、开场/气泡下追问。
 */
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useKeyboardLift } from '@/utils/keyboardLift.js'
import { onShow, onHide } from '@dcloudio/uni-app'
import { t, getLocale } from '@/i18n/index.js'
import { apiAiChat, apiAiHistory, apiAiQuickPrompts, apiAiDeleteMessage } from '@/api/ai.js'
import { apiCheckinStatus } from '@/api/checkin.js'
import { apiAppConfig, apiLike, apiCollect, apiUncollect } from '@/api/content.js'
import { getUser, setUser } from '@/utils/session.js'
import { hideNativeTabBar } from '@/utils/tabbar.js'
import { goTab } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { loadWithCache } from '@/utils/pageCache.js'
import {
	APP_CONFIG_KEY,
	FALLBACK_WALLPAPER,
	resolveActiveWallpaper,
	wallpaperDisplayUrl,
	wallpaperOverlayVideoUrl,
	playWallpaperVideo,
} from '@/utils/wallpaperCache.js'
import { goVip, isVipActive } from '@/utils/vip.js'
import { markPrayerDoneToday } from '@/utils/prayerLock.js'
import { cmsText } from '@/utils/cmsI18n.js'
import { recordLikeStatus } from '@/utils/likeSync.js'
import { createTapLock } from '@/utils/tapLock.js'
import { openSharePage } from '@/utils/share.js'

const VIEW_DATE_KEY = 'selah_ai_view_date'
const statusBarPx = getStatusBarPx()
const rowTap = createTapLock(420)
let prayerDwellTimer = null
/** 防止 onShow 被 webview setStyle 反复触发时疯狂埋点 / 拉历史 */
let lastAiShowAt = 0
const sending = ref(false)
/** 只补系统还没压矮的差额，避免输入框和键盘之间空出一块 */
let keyboardScrollTimer = null
const {
	liftPx: keyboardPadPx,
	rawPx: keyboardRawPx,
	reset: resetKeyboardLift,
	refresh: refreshKeyboardLift,
} = useKeyboardLift({
	selector: '.ai-page .input-row',
	onChange({ open, prevOpen, lift, prevLift }) {
		if (!open) return
		const heightChanged = Math.abs(lift - prevLift) > 8
		if (!prevOpen || heightChanged) scheduleScrollToLatest()
	},
})

function scrollToLatest() {
	scrollTo('msg-end')
}

function scheduleScrollToLatest() {
	if (keyboardScrollTimer) clearTimeout(keyboardScrollTimer)
	nextTick(() => {
		scrollToLatest()
		keyboardScrollTimer = setTimeout(() => {
			scrollToLatest()
			keyboardScrollTimer = null
		}, 120)
	})
}

function onInputBlur() {
	setTimeout(() => {
		// 再次点输入框会先 blur 再 focus。焦点还在时不要把已经对准的抬升清掉。
		try {
			const el = typeof document !== 'undefined' ? document.activeElement : null
			const tag = String(el && el.tagName || '').toUpperCase()
			if (tag === 'INPUT' || tag === 'TEXTAREA') {
				refreshKeyboardLift()
				return
			}
		} catch (e) {}
		if (keyboardRawPx.value < 40) resetKeyboardLift()
		else refreshKeyboardLift()
	}, 80)
}

function onInputFocus() {
	refreshKeyboardLift()
	nextTick(() => {
		scrollToLatest()
		if (keyboardScrollTimer) clearTimeout(keyboardScrollTimer)
		keyboardScrollTimer = setTimeout(() => {
			refreshKeyboardLift()
			scrollToLatest()
			keyboardScrollTimer = null
		}, 280)
	})
}

const messages = ref([])
const prompts = ref([])
const text = ref('')
const user = ref(getUser())
const quota = ref(user.value.quota || {})
const scrollId = ref('')
const canCheckinToday = ref(true)
const hotlines = ref([])
const conversationId = ref('')
const msgSheetOpen = ref(false)
const msgSheetItems = ref([])
const msgSheetTarget = ref(null)
const deleteDialogOpen = ref(false)
const retainDialogOpen = ref(false)
const aiGreeting = ref('')
const vipDailyQuota = ref(100)
const viewDate = ref(todayStr())
const historyLoading = ref(true)
const bgUrl = ref(FALLBACK_WALLPAPER)
const bgVideoUrl = ref('')
/** 当前屏幕上的对话属于哪一天；切日时用来立刻收起旧内容 */
let shownForDate = ''
let historyLoadSeq = 0

const greetingText = computed(() => cmsText(aiGreeting.value, 'ai_greeting') || t('ai_greeting'))
const isToday = computed(() => viewDate.value === todayStr())
const historyBannerText = computed(() => {
	const date = formatHistoryDate(viewDate.value)
	const raw = t('ai_history_banner', { date })
	return String(raw).replace('{date}', date)
})
const showWelcome = computed(() => isToday.value && !historyLoading.value && !messages.value.length)
const promptList = computed(() => (prompts.value.length ? prompts.value : fallbackPrompts()))
const dockChips = computed(() => {
	if (!isToday.value || !showWelcome.value) return []
	return promptList.value.slice(0, 3)
})
function ensureBibleChip(rows) {
	const list = (rows || []).filter((x) => x && (x.title || x.prompt))
	if (list.some((x) => x.kind === 'bible_verse')) return list.slice(0, 3)
	return [
		{
			kind: 'bible_verse',
			title: t('ai_suggest_verse'),
			prompt: t('ai_suggest_verse_prompt'),
		},
		...list,
	].slice(0, 3)
}

const underReplyChips = computed(() => {
	if (!isToday.value || showWelcome.value) return []
	for (let i = messages.value.length - 1; i >= 0; i--) {
		const m = messages.value[i]
		if (m.role !== 'assistant') continue
		if (m.status === 'thinking' || m.status === 'failed' || m.safety_blocked) return []
		const rows = Array.isArray(m.suggestions) ? m.suggestions : []
		const ensured = ensureBibleChip(rows)
		if (ensured.length) return ensured
		return ensureBibleChip(promptList.value)
	}
	return []
})

const showGetFree = computed(() => {
	if (isVipActive(user.value)) return false
	const left = (quota.value || {}).remaining ?? 0
	return left <= 0 && canCheckinToday.value
})

function todayStr() {
	const d = new Date()
	const m = String(d.getMonth() + 1).padStart(2, '0')
	const day = String(d.getDate()).padStart(2, '0')
	return `${d.getFullYear()}-${m}-${day}`
}

function formatHistoryDate(iso) {
	const s = String(iso || '').trim()
	const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
	if (!m) return s
	const y = Number(m[1])
	const mo = Number(m[2])
	const d = Number(m[3])
	const locMap = {
		zh: 'zh-CN', en: 'en-US', es: 'es', pt: 'pt-BR', ja: 'ja', ko: 'ko',
		ar: 'ar', ru: 'ru', fr: 'fr', de: 'de', fil: 'fil', it: 'it',
	}
	const loc = locMap[getLocale()] || 'en-US'
	try {
		return new Date(y, mo - 1, d).toLocaleDateString(loc, { month: 'short', day: 'numeric' })
	} catch (e) {
		return `${mo}/${d}`
	}
}

function fallbackPrompts() {
	return [
		{ id: 'local-1', kind: 'text', title: t('ai_quick_1'), prompt: t('ai_quick_1_prompt') },
		{ id: 'local-2', kind: 'text', title: t('ai_quick_2'), prompt: t('ai_quick_2_prompt') },
		{ id: 'local-3', kind: 'text', title: t('ai_quick_3'), prompt: t('ai_quick_3_prompt') },
	]
}

function positiveId(v) {
	const n = Number(v)
	return Number.isFinite(n) && n > 0 ? n : null
}

/** 语录类 id（content_id / quote_id）；不含 history 消息 id */
function pickMsgContentId(raw) {
	if (!raw || typeof raw !== 'object') return null
	const candidates = [
		raw.content_id,
		raw.contentId,
		raw.quote_id,
		raw.quoteId,
		raw.quote && raw.quote.id,
		raw.quote && raw.quote.content_id,
		raw.verse && raw.verse.content_id,
		raw.verse && raw.verse.id,
	]
	for (const c of candidates) {
		const n = positiveId(c)
		if (n) return n
	}
	return null
}

/**
 * 分享/收藏用的 content_id：
 * 优先语录字段，否则用 /api/ai/history/ 的 messages[].id
 */
function resolveShareCollectId(m) {
	if (!m) return null
	const verse = m.msg_type === 'verse' ? null : nearbyVerseMsg(m)
	return pickMsgContentId(m)
		|| pickMsgContentId(verse)
		|| (m.role === 'assistant' ? positiveId(m.id) : null)
		|| positiveId(verse?.id)
}

function nearbyVerseMsg(m) {
	const list = messages.value || []
	const idx = list.findIndex((x) => x && m && String(x.id) === String(m.id))
	if (idx < 0) return null
	for (const j of [idx + 1, idx - 1]) {
		const n = list[j]
		if (n && n.role === 'assistant' && n.msg_type === 'verse') return n
	}
	return null
}

function mapMsg(raw) {
	const msgId = positiveId(raw.id)
	// assistant：无语录 content_id 时回落 history 消息 id，供分享收藏
	const contentId = pickMsgContentId(raw)
		|| (raw.role === 'assistant' && !raw.safety_blocked ? msgId : null)
	return {
		id: raw.id,
		role: raw.role,
		content: raw.content || '',
		status: 'ok',
		safety_blocked: !!raw.safety_blocked,
		safety_category: raw.safety_category || '',
		msg_type: raw.msg_type || 'text',
		source_ref: raw.source_ref || '',
		verse_text: raw.verse_text || '',
		content_id: contentId,
		liked: !!raw.liked,
		collected: !!raw.collected,
		verse_origin: raw.verse_origin || '',
		suggestions: Array.isArray(raw.suggested_replies)
			? raw.suggested_replies
			: (Array.isArray(raw.suggestions) ? raw.suggestions : []),
	}
}

function onChipTap(q) {
	if (!q) return
	const quickId = q.kind === 'bible_verse' ? 'suggest' : (q.id != null ? q.id : 'suggest')
	send(q.prompt || q.title, quickId, { chip: q })
}

function scrollTo(id) {
	if (id === undefined || id === null || id === '') return
	const raw = String(id)
	const target = (raw === 'hotlines' || raw === 'followups' || raw === 'msg-end') ? raw : ('m' + id)
	nextTick(() => {
		scrollId.value = ''
		nextTick(() => { scrollId.value = target })
	})
}

async function applyWallpaper() {
	try {
		const hasToken = !!uni.getStorageSync('token')
		const snap = await resolveActiveWallpaper(user.value, { allowNetwork: hasToken })
		const url = wallpaperDisplayUrl(snap) || FALLBACK_WALLPAPER
		if (url) bgUrl.value = url
		bgVideoUrl.value = wallpaperOverlayVideoUrl(snap)
		if (bgVideoUrl.value) nextTick(() => playWallpaperVideo('aiBgVideo'))
	} catch (e) {
		if (!bgUrl.value) bgUrl.value = FALLBACK_WALLPAPER
		bgVideoUrl.value = ''
	}
}

function onBgError() {
	if (bgUrl.value !== FALLBACK_WALLPAPER) bgUrl.value = FALLBACK_WALLPAPER
}

function onBgVideoError() {
	bgVideoUrl.value = ''
}

function remainCount() {
	const n = Number((quota.value || {}).remaining)
	return Number.isFinite(n) ? n : 0
}

function blockIfNoQuota() {
	if (remainCount() > 0) return false
	if (isVipActive(user.value)) {
		uni.showToast({
			title: t('ai_quota_vip_cap', { n: vipDailyQuota.value || 100 }),
			icon: 'none',
		})
		return true
	}
	goVip('ai_quota')
	return true
}

async function load() {
	const seq = ++historyLoadSeq
	const target = viewDate.value
	const switching = shownForDate !== '' && shownForDate !== target
	if (shownForDate === '' || switching) {
		historyLoading.value = true
		if (switching) {
			messages.value = []
			hotlines.value = []
		}
	}
	const date = target === todayStr() ? '' : target
	try {
		const [h, p, st] = await Promise.all([
			apiAiHistory(date || undefined),
			apiAiQuickPrompts(),
			apiCheckinStatus().catch(() => null),
		])
		if (seq !== historyLoadSeq) return
		const data = h.results || {}
		messages.value = (data.messages || []).map(mapMsg)
		quota.value = data.quota || quota.value || {}
		conversationId.value = data.conversation_id || ''
		const rows = p.results || []
		prompts.value = Array.isArray(rows) ? rows.filter((x) => x && (x.title || x.prompt)) : []
		if (st && st.results) {
			canCheckinToday.value = !!st.results.can_checkin_today
		}
		shownForDate = target
		if (messages.value.length) {
			scrollTo(messages.value[messages.value.length - 1].id)
		}
	} finally {
		if (seq === historyLoadSeq) historyLoading.value = false
	}
	try {
		await loadWithCache(
			APP_CONFIG_KEY,
			async () => (await apiAppConfig()).results || {},
			(cfg) => {
				const c = cfg || {}
				if ((c.ai_greeting || '').trim()) aiGreeting.value = c.ai_greeting
				const n = Number(c.vip_daily_quota)
				if (Number.isFinite(n) && n > 0) vipDailyQuota.value = n
			},
		)
	} catch (e) {}
}

/**
 * 发送：先校验额度；有额度则用户消息上屏 + 思考中；成功后扣次由服务端完成。
 */
async function send(preset, quickId, opts = {}) {
	if (!isToday.value) {
		viewDate.value = todayStr()
		try { uni.removeStorageSync(VIEW_DATE_KEY) } catch (e) {}
		await load()
	}
	const content = (preset || text.value || '').trim()
	if (!content || sending.value) return
	if (blockIfNoQuota()) return
	text.value = ''
	sending.value = true
	let userMsg = opts.retryUser || null
	if (!userMsg) {
		userMsg = { id: 'tmp-u-' + Date.now(), role: 'user', content, status: 'ok', msg_type: 'text' }
		messages.value.push(userMsg)
	}
	if (opts.replaceFailId) {
		messages.value = messages.value.filter((x) => String(x.id) !== String(opts.replaceFailId))
	}
	const thinkId = 'tmp-t-' + Date.now()
	messages.value.push({
		id: thinkId,
		role: 'assistant',
		content: '',
		status: 'thinking',
		msg_type: 'text',
	})
	scrollTo(thinkId)
	const requestStarted = Date.now()
	try {
		const chip = opts.chip || {}
		const res = await apiAiChat(content, {
			retry: !!opts.retry,
			kind: chip.kind || '',
			content_id: pickMsgContentId(chip) || undefined,
			source_ref: chip.source_ref || '',
		})
		const data = res.results || {}
		if (data.user_message_id && userMsg) userMsg.id = data.user_message_id
		if (data.quota) quota.value = data.quota
		if (data.user) {
			setUser(data.user)
			user.value = data.user
		}
		messages.value = messages.value.filter((x) => x.id !== thinkId)
		if (data.code === 'ai_safety_blocked' || res.message === 'ai_safety_blocked') {
			hotlines.value = data.hotlines || []
			messages.value.push(mapMsg({
				id: data.message_id || Date.now(),
				role: 'assistant',
				content: data.reply,
				safety_blocked: true,
				safety_category: data.safety_category,
			}))
			if (hotlines.value.length) scrollTo('hotlines')
			else scrollTo(data.message_id)
			return
		}
		hotlines.value = []
		conversationId.value = data.conversation_id || conversationId.value
		const batch = (Array.isArray(data.messages) && data.messages.length)
			? data.messages
			: [{
				id: data.message_id || Date.now(),
				role: 'assistant',
				content: data.reply,
				msg_type: data.msg_type,
				source_ref: data.source_ref,
				verse_text: data.verse_text,
				content_id: data.content_id,
				liked: data.liked,
				collected: data.collected,
			}]
		const mapped = batch.map((row, idx) => mapMsg({
			...row,
			content_id: row.content_id || data.content_id,
			contentId: row.contentId || data.contentId,
			quote_id: row.quote_id || data.quote_id,
			quoteId: row.quoteId || data.quoteId,
			suggested_replies: idx === batch.length - 1
				? (row.suggested_replies || data.suggested_replies)
				: (row.suggested_replies || []),
		}))
		messages.value.push(...mapped)
		const last = mapped[mapped.length - 1]
		if (last && last.suggestions && last.suggestions.length) scrollTo('followups')
		else if (last) scrollTo(last.id)
		markPrayerDoneToday().catch(() => {})
	} catch (e) {
		messages.value = messages.value.filter((x) => x.id !== thinkId)
		if (e && e.code === 402) {
			messages.value = messages.value.filter((x) => x.id !== userMsg.id)
			const info = (e.data && e.data.quota) || e.results?.quota || {}
			if (info.remaining != null) quota.value = info
			if (isVipActive(user.value)) {
				uni.showToast({
					title: t('ai_quota_vip_cap', { n: vipDailyQuota.value || 100 }),
					icon: 'none',
				})
			} else {
				goVip('ai_quota')
			}
			return
		}
		const failId = 'fail-' + Date.now()
		messages.value.push({
			id: failId,
			role: 'assistant',
			content: '',
			status: 'failed',
			msg_type: 'text',
			retryContent: content,
			retryUser: userMsg,
		})
		scrollTo(failId)
	} finally {
		sending.value = false
	}
}

function retryFailed(m) {
	if (!m || sending.value) return
	send(m.retryContent, null, { retry: true, retryUser: m.retryUser, replaceFailId: m.id })
}

function posterTextFromMsg(m) {
	let body = String((m && (m.verse_text || m.content)) || '').trim()
	body = body.replace(/(?:^|\n)\s*(?:```(?:json)?\s*)?(?:<<<selah_suggest>>>|SUGGEST:)\s*[\s\S]*$/i, '').trim()
	return body
}

function forwardMsg(m) {
	rowTap.run(() => {
		const content = posterTextFromMsg(m)
		if (!content) return
		const verse = nearbyVerseMsg(m)
		const cid = resolveShareCollectId(m)
		openSharePage({
			id: cid,
			content_id: cid,
			mode: 'ai',
			text: content,
			cite: m.source_ref || (verse && verse.source_ref) || '',
			collected: !!m.collected,
			historyDate: viewDate.value === todayStr() ? '' : viewDate.value,
		})
	})
}

function onLikeHit(m) {
	const cid = resolveShareCollectId(m)
	if (!cid) return
	rowTap.run(async () => {
		const next = !m.liked
		const extra = { target_type: 'ai_message' }
		try {
			await apiLike(cid, next, extra)
			recordLikeStatus(cid, next)
			m.liked = next
		} catch (e) {
			uni.showToast({ title: t('request_failed'), icon: 'none' })
		}
	})
}

function onCollectHit(m) {
	const cid = resolveShareCollectId(m)
	if (!cid) return
	rowTap.run(async () => {
		const extra = { target_type: 'ai_message' }
		try {
			if (m.collected) {
				await apiUncollect(cid, extra)
				m.collected = false
				return
			}
			await apiCollect(cid, null, extra)
			m.collected = true
		} catch (e) {
			uni.showToast({ title: t('request_failed'), icon: 'none' })
		}
	})
}

function onMsgLongPress(m) {
	if (m.status === 'thinking' || m.status === 'failed') return
	msgSheetTarget.value = m
	msgSheetItems.value = [
		{ code: 'copy', label: t('copy_text') || 'Copy' },
		{ code: 'delete', label: t('delete') },
	]
	msgSheetOpen.value = true
}

function onMsgSheetSelect({ value }) {
	const m = msgSheetTarget.value
	if (!m) return
	if (value === 'copy') {
		uni.setClipboardData({ data: (m.verse_text || m.content || '') })
		return
	}
	if (value === 'delete') {
		deleteDialogOpen.value = true
	}
}

async function confirmDeleteMsg() {
	const m = msgSheetTarget.value
	if (!m) return
	const id = m.id
	if (typeof id === 'number' || String(id).match(/^\d+$/)) {
		try {
			await apiAiDeleteMessage(id)
		} catch (e) {
			uni.showToast({ title: t('request_failed'), icon: 'none' })
			return
		}
	}
	messages.value = messages.value.filter((x) => x.id !== id)
}

function openHotline(h) {
	const url = h.phone_or_url || ''
	if (/^https?:/i.test(url)) {
		// #ifdef H5
		window.open(url)
		// #endif
		// #ifndef H5
		uni.setClipboardData({ data: url })
		// #endif
	} else {
		uni.makePhoneCall({ phoneNumber: String(url).replace(/[^\d+]/g, '') })
	}
}

function goCheckin() {
	uni.navigateTo({ url: '/pagesA/checkin/checkin' })
}

function goCalendar() {
	uni.navigateTo({ url: '/pagesA/calendar/calendar' })
}

function backToToday() {
	viewDate.value = todayStr()
	try { uni.removeStorageSync(VIEW_DATE_KEY) } catch (e) {}
	load()
}

function goHome() {
	if (messages.value.length) {
		retainDialogOpen.value = true
		return
	}
	leaveToHome()
}

function leaveToHome() {
	retainDialogOpen.value = false
	goTab('/pages/home/home')
}

onShow(() => {
	hideNativeTabBar()
	user.value = getUser()
	const now = Date.now()
	const freshShow = now - lastAiShowAt > 800
	lastAiShowAt = now
	try {
		const stored = uni.getStorageSync(VIEW_DATE_KEY)
		if (stored) viewDate.value = String(stored)
		else if (!isToday.value && viewDate.value !== todayStr()) {
			/* keep */
		} else {
			viewDate.value = todayStr()
		}
	} catch (e) {
		viewDate.value = todayStr()
	}
	if (freshShow && !bgUrl.value) applyWallpaper()
	if (freshShow && !sending.value && (shownForDate !== viewDate.value || !messages.value.length)) load()
	if (prayerDwellTimer) clearTimeout(prayerDwellTimer)
	prayerDwellTimer = setTimeout(() => {
		markPrayerDoneToday().catch(() => {})
	}, 20000)
})

onHide(() => {
	resetKeyboardLift()
	if (keyboardScrollTimer) {
		clearTimeout(keyboardScrollTimer)
		keyboardScrollTimer = null
	}
	if (prayerDwellTimer) {
		clearTimeout(prayerDwellTimer)
		prayerDwellTimer = null
	}
})

onMounted(() => {
	hideNativeTabBar()
})

onBeforeUnmount(() => {
	if (keyboardScrollTimer) {
		clearTimeout(keyboardScrollTimer)
		keyboardScrollTimer = null
	}
})
</script>

<style scoped>
.ai-page {
	position: fixed;
	top: 0;
	right: 0;
	bottom: 0;
	left: 0;
	width: auto;
	height: auto;
	display: flex;
	flex-direction: column;
	padding: 0 32rpx 24rpx;
	background-color: #fbf8f2;
	background-image: linear-gradient(180deg, #b6badf 0%, #fff0d9 52%, #f5dfbc 100%);
	color: #191919;
	box-sizing: border-box;
	overflow: hidden;
	overscroll-behavior: none;
}
.bg {
	/* fixed 铺满视口，不随键盘 padding 压缩 */
	position: fixed;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	z-index: 0;
	width: 100%;
	height: 100%;
	opacity: 0.22;
	pointer-events: none;
}
.bg.bg-video {
	z-index: 0;
	opacity: 1;
}
.bg.bg-video :deep(video),
.bg.bg-video :deep(.uni-video-container),
.bg.bg-video :deep(.uni-video-video) {
	position: absolute !important;
	left: 0 !important;
	top: 0 !important;
	width: 100% !important;
	height: 100% !important;
	object-fit: cover !important;
	opacity: 1 !important;
	background: transparent !important;
}
.bg-video :deep(.uni-video-cover),
.bg-video :deep(.uni-video-bar),
.bg-video :deep(.uni-video-progress) {
	display: none !important;
	opacity: 0 !important;
	pointer-events: none !important;
}
.veil {
	position: fixed;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	z-index: 1;
	background: linear-gradient(180deg, rgba(251, 248, 242, 0.08), rgba(251, 248, 242, 0.42));
	pointer-events: none;
}
.has-dyn-bg .veil {
	background: linear-gradient(180deg, rgba(251, 248, 242, 0.58), rgba(251, 248, 242, 0.72));
}
.custom-nav {
	position: relative;
	z-index: 20;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	padding: 0 0 8rpx;
	box-sizing: border-box;
	min-height: 88rpx;
}
.nav-pill {
	width: 88rpx;
	height: 88rpx;
	border-radius: 999rpx;
	background: rgba(255, 255, 255, 0.56);
	box-shadow: 0 8rpx 80rpx rgba(0, 0, 0, 0.1);
	display: flex;
	align-items: center;
	justify-content: center;
}
.nav-ico {
	width: 48rpx;
	height: 48rpx;
}
.nav-side {
	display: flex;
	flex-direction: row;
	align-items: center;
}
.get {
	color: #191919;
	font-weight: 500;
	font-size: 22rpx;
	margin-right: 12rpx;
}
.hist-banner {
	position: relative;
	z-index: 8;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	padding: 16rpx 24rpx;
	margin-bottom: 8rpx;
	background: rgba(255, 255, 255, 0.56);
	border-radius: 24rpx;
}
.hist-banner-text {
	flex: 1;
	min-width: 0;
	margin-right: 16rpx;
	font-size: 24rpx;
	color: #191919;
}
.hist-banner-cta {
	flex-shrink: 0;
	font-size: 24rpx;
	color: rgba(25, 25, 25, 0.55);
}
.msgs {
	position: relative;
	z-index: 8;
	flex: 1;
	height: 0;
	min-height: 0;
}
.msg-end {
	width: 100%;
	height: 8rpx;
}
.enter-loading {
	position: absolute;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	z-index: 9;
	display: flex;
	align-items: center;
	justify-content: center;
	pointer-events: none;
}
.history-spinner {
	width: 48rpx;
	height: 48rpx;
	border: 4rpx solid rgba(25, 25, 25, 0.12);
	border-top-color: #191919;
	border-radius: 50%;
	animation: history-spin 0.7s linear infinite;
}
@keyframes history-spin {
	to { transform: rotate(360deg); }
}
.bubble-row {
	display: flex;
	flex-direction: row;
	width: 100%;
	margin-bottom: 16rpx;
}
.bubble-row.user {
	justify-content: flex-end;
}
.bubble-row.assistant {
	justify-content: flex-start;
}
.bubble {
	display: inline-flex;
	flex-direction: column;
	box-sizing: border-box;
	padding: 24rpx 32rpx;
	border-radius: 32rpx;
	max-width: 596rpx;
	width: fit-content;
}
.bubble-text {
	display: block;
	font-size: 28rpx;
	line-height: 36rpx;
	color: #191919;
	word-break: break-word;
	white-space: pre-wrap;
}
.bubble.user {
	align-items: flex-end;
	background: linear-gradient(180deg, #fff0d9 0%, #ffffff 100%);
}
.bubble.user .bubble-text {
	text-align: right;
}
.bubble.assistant {
	align-items: flex-end;
	background: rgba(255, 255, 255, 0.6);
}
.bubble.verse {
	align-items: stretch;
}
.verse-cite {
	display: block;
	margin-top: 12rpx;
	font-size: 22rpx;
	color: #5c5c5c;
}
.verse-actions {
	display: flex;
	flex-direction: row;
	align-items: center;
	margin-top: 16rpx;
}
.ico-hit {
	width: 56rpx;
	height: 56rpx;
	margin-right: 8rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}
.row-ico {
	width: 40rpx;
	height: 40rpx;
}
.bubble-share {
	width: 40rpx;
	height: 40rpx;
	flex-shrink: 0;
	align-self: flex-end;
	margin-top: 16rpx;
}
.bubble-share-ico {
	width: 40rpx;
	height: 40rpx;
	display: block;
}
.thinking .dots {
	display: flex;
	flex-direction: row;
	margin-top: 12rpx;
}
.dot {
	width: 10rpx;
	height: 10rpx;
	margin-right: 8rpx;
	border-radius: 999rpx;
	background: #191919;
	opacity: 0.35;
}
.retry-hit {
	align-self: flex-end;
	margin-top: 12rpx;
	width: 56rpx;
	height: 56rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	transform: rotate(180deg);
}
.retry-ico {
	width: 40rpx;
	height: 40rpx;
}
.empty-state {
	padding-top: 24rpx;
}
.intro {
	display: block;
	font-size: 26rpx;
	line-height: 36rpx;
	color: #5c5c5c;
	margin-bottom: 24rpx;
	padding: 0 8rpx;
}
.greet {
	max-width: 596rpx;
	margin-bottom: 24rpx;
}
.suggests {
	margin-top: 0;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
}
.under-reply {
	padding: 8rpx 0 32rpx;
}
.dock-suggests {
	position: relative;
	z-index: 8;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	padding: 8rpx 0 16rpx;
}
.suggest {
	display: inline-flex;
	flex-direction: row;
	align-items: center;
	justify-content: flex-start;
	padding: 24rpx 32rpx;
	margin-bottom: 16rpx;
	background: rgba(255, 255, 255, 0.6);
	border-radius: 32rpx;
	max-width: 576rpx;
	box-sizing: border-box;
}
.suggest-text {
	font-size: 28rpx;
	line-height: 36rpx;
	color: #191919;
	padding-right: 16rpx;
}
.chev-img {
	width: 48rpx;
	height: 48rpx;
	flex-shrink: 0;
}
.input-row {
	position: relative;
	z-index: 8;
	display: flex;
	flex-direction: row;
	align-items: center;
	padding-bottom: 16rpx;
}
.kb-spacer {
	flex-shrink: 0;
	width: 100%;
	pointer-events: none;
}
.input {
	flex: 1;
	height: 92rpx;
	background: rgba(255, 255, 255, 0.56);
	padding: 0 32rpx;
	border-radius: 999rpx;
	color: #191919;
	font-size: 32rpx;
	box-shadow: 0 8rpx 80rpx rgba(0, 0, 0, 0.1);
	box-sizing: border-box;
}
.send {
	margin-left: 24rpx;
	width: 92rpx;
	height: 92rpx;
	background: rgba(255, 255, 255, 0.56);
	border-radius: 999rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 8rpx 80rpx rgba(0, 0, 0, 0.1);
	flex-shrink: 0;
}
.send-ico {
	width: 48rpx;
	height: 48rpx;
}
.hotlines {
	margin: 16rpx 8rpx 32rpx;
	padding: 24rpx;
	background: rgba(255, 255, 255, 0.72);
	border-radius: 32rpx;
	border: 2rpx solid rgba(25, 25, 25, 0.06);
	box-sizing: border-box;
}
.hl-title {
	display: block;
	font-size: 24rpx;
	color: #5c5c5c;
	margin-bottom: 12rpx;
}
.hl-row {
	padding: 14rpx 0;
	color: #191919;
	font-size: 26rpx;
	border-top: 1rpx solid rgba(25, 25, 25, 0.06);
}
</style>
