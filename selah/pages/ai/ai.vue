<!--
  AI 对话页：快捷开场、聊天发送、AI 回复转发。
  UI 对齐 Figma 25:5023；交互逻辑保持原业务分支。
-->
<template>
	<view class="ai-page">
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
			</view>
		</view>
		<scroll-view scroll-y class="msgs" :scroll-into-view="scrollId">
			<view
				v-for="m in messages"
				:key="m.id"
				:id="'m' + m.id"
				:class="['bubble-row', m.role]"
			>
				<view
					:class="['bubble', m.role]"
					@longpress="onMsgLongPress(m)"
				>
					<text class="bubble-text">{{ m.content }}</text>
					<view
						v-if="m.role === 'assistant'"
						class="bubble-share"
						@tap.stop="forwardMsg(m)"
					>
						<image class="bubble-share-ico" src="/static/ui/ico-share.svg" mode="aspectFit" />
					</view>
				</view>
			</view>
			<view v-if="!messages.length" class="empty-state">
				<view class="bubble assistant greet">
					<text class="bubble-text">{{ greetingText }}</text>
				</view>
				<view v-if="prompts.length" class="suggests">
					<view
						v-for="q in prompts"
						:key="q.id"
						class="suggest"
						@click="send(q.prompt)"
					>
						<text class="suggest-text">{{ q.title }}</text>
						<image class="chev-img" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
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
		</scroll-view>
		<scroll-view v-if="messages.length" scroll-x class="quick">
			<view
				v-for="q in prompts"
				:key="q.id"
				class="chip"
				@click="send(q.prompt)"
			>{{ q.title }}</view>
		</scroll-view>
		<view class="input-row">
			<input v-model="text" class="input" :placeholder="t('ai_placeholder')" @confirm="send()" />
			<view class="send" @click="send()">
				<image class="send-ico" src="/static/ui/ico-send.svg" mode="aspectFit" />
			</view>
		</view>

		<selah-sheet
			v-model:visible="msgSheetOpen"
			:title="t('more') || 'More'"
			:items="msgSheetItems"
			:cancel-text="t('cancel')"
			@select="onMsgSheetSelect"
		/>
		<selah-dialog
			v-model:visible="quotaDialogOpen"
			:title="t('no_quota') || 'No quota'"
			:content="quotaDialogContent"
			:confirm-text="quotaDialogConfirm"
			:cancel-text="quotaDialogCancel"
			:show-cancel="quotaDialogShowCancel"
			@confirm="onQuotaConfirm"
			@cancel="onQuotaCancel"
		/>
	</view>
</template>

<script setup>
/**
 * AI 聊天：额度校验、安全拒答+热线、按日历史、开场快捷提示。
 */
import { ref, computed, onMounted } from 'vue'
import { onShow, onHide } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiAiChat, apiAiHistory, apiAiQuickPrompts, apiAiDeleteMessage } from '@/api/ai.js'
import { apiCheckinStatus } from '@/api/checkin.js'
import { apiAppConfig } from '@/api/content.js'
import { getUser, setUser } from '@/utils/session.js'
import { track } from '@/utils/analytics.js'
import { hideNativeTabBar } from '@/utils/tabbar.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { loadWithCache } from '@/utils/pageCache.js'
import { APP_CONFIG_KEY } from '@/utils/wallpaperCache.js'
import { goVip } from '@/utils/vip.js'
import { markPrayerDoneToday } from '@/utils/prayerLock.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
let prayerDwellTimer = null

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
const quotaDialogOpen = ref(false)
const quotaDialogContent = ref('')
const quotaDialogConfirm = ref('OK')
const quotaDialogCancel = ref('Cancel')
const quotaDialogShowCancel = ref(true)
const quotaDialogMode = ref('checkin') // checkin | vip_only
const aiGreeting = ref('')
const vipDailyQuota = ref(100)

const greetingText = computed(() => (aiGreeting.value || '').trim() || t('ai_greeting'))
const vipBannerText = computed(() => t('vip_banner', { n: vipDailyQuota.value || 100 }))

const showGetFree = computed(() => {
	if (user.value.vip_level !== 'free') return false
	const left = (quota.value || {}).remaining ?? 0
	return left <= 0 && canCheckinToday.value
})

async function load() {
	track('ai_page_view')
	const [h, p, st] = await Promise.all([
		apiAiHistory(),
		apiAiQuickPrompts(),
		apiCheckinStatus().catch(() => null),
	])
	messages.value = h.results?.messages || h.results || []
	if (!Array.isArray(messages.value)) messages.value = []
	quota.value = h.results?.quota || quota.value || {}
	prompts.value = p.results || []
	if (st && st.results) {
		canCheckinToday.value = !!st.results.can_checkin_today
	}
	if (messages.value.length) {
		scrollId.value = 'm' + messages.value[messages.value.length - 1].id
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
 * 发送消息完整分支：
 * 1) 乐观插入临时 user 气泡
 * 2) /ai/chat/：安全拒答仍 HTTP 200，靠 data.code / message === ai_safety_blocked 识别
 * 3) 自残类可能带回 hotlines，滚到热线锚点
 * 4) 业务码 402：VIP 仅 toast；Free 按 can_checkin 分流「去打卡」或「去 VIP」
 * 5) 成功后用服务端 quota / user 覆盖本地，避免账本漂移
 */
async function send(preset) {
	const content = (preset || text.value || '').trim()
	if (!content) return
	text.value = ''
	const q = quota.value || {}
	const remainBefore = q.remaining ?? 0
	const quotaType = q.ledger === 'vip_daily_remaining' ? 'vip_daily' : 'free'
	if (preset) {
		const hit = prompts.value.find((p) => p.prompt === preset)
		track('ai_quick_click', { quick_id: hit?.id || 0 })
	}
	track('ai_send', {
		has_quota: remainBefore > 0,
		quota_type: quotaType,
		remain_before: remainBefore,
	})
	messages.value.push({ id: 'tmp' + Date.now(), role: 'user', content })
	try {
		const res = await apiAiChat(content)
		const data = res.results || {}
		if (data.code === 'ai_safety_blocked' || res.message === 'ai_safety_blocked') {
			track('ai_safety_block', {
				safety_category: data.safety_category,
				stage: data.stage || 'input',
			})
			hotlines.value = data.hotlines || []
			if (hotlines.value.length) scrollId.value = 'hotlines'
		} else {
			conversationId.value = data.conversation_id || conversationId.value
			track('ai_success', {
				session_id: data.conversation_id || conversationId.value || '',
				remain_after: (data.quota || {}).remaining ?? quota.value.remaining,
			})
			hotlines.value = []
		}
		messages.value.push({
			id: data.message_id || Date.now(),
			role: 'assistant',
			content: data.reply,
		})
		quota.value = data.quota || quota.value
		if (data.user) {
			setUser(data.user)
			user.value = data.user
		}
		if (!(data.code === 'ai_safety_blocked' || res.message === 'ai_safety_blocked')) {
			scrollId.value = 'm' + (data.message_id || '')
			markPrayerDoneToday().catch(() => {})
		}
	} catch (e) {
		if (e && e.code === 402) {
			const info = (e.data && e.data.quota) || {}
			const can = !!(e.data && e.data.can_checkin)
			if (typeof can === 'boolean') canCheckinToday.value = can || canCheckinToday.value
			track('ai_quota_exhaust', {
				quota_type: info.ledger === 'vip_daily_remaining' ? 'vip_daily' : 'free',
				can_checkin: canCheckinToday.value,
			})
			const isVip = user.value.vip_level !== 'free'
			if (isVip) {
				uni.showToast({ title: t('vip_quota_used') || t('no_quota'), icon: 'none' })
				return
			}
			quotaDialogMode.value = canCheckinToday.value ? 'checkin' : 'vip_only'
			quotaDialogContent.value = canCheckinToday.value
				? (t('checkin_for_quota') || '')
				: vipBannerText.value
			quotaDialogConfirm.value = canCheckinToday.value ? t('checkin') : t('vip')
			quotaDialogCancel.value = canCheckinToday.value ? t('vip') : 'OK'
			quotaDialogShowCancel.value = !!canCheckinToday.value
			quotaDialogOpen.value = true
		} else {
			track('ai_fail', { error_code: String((e && e.code) || 'unknown') })
		}
	}
}

function onQuotaConfirm() {
	if (quotaDialogMode.value === 'checkin') {
		track('ai_get_free_quota_click')
		goCheckin()
		return
	}
	goVip('ai_quota')
}

function onQuotaCancel() {
	if (quotaDialogMode.value === 'checkin') {
		goVip('ai_quota')
	}
}

function forwardMsg(m) {
	const content = (m?.content || '').trim()
	if (!content) return
	try {
		uni.setStorageSync('share_draft_text', content)
	} catch (e) {}
	uni.navigateTo({ url: '/pagesA/share/share?mode=ai' })
}

function onMsgLongPress(m) {
	msgSheetTarget.value = m
	const items = [{ code: 'copy', label: t('copy_text') || 'Copy' }]
	if (m.role === 'assistant') {
		items.push({ code: 'share', label: t('share') })
	}
	items.push({ code: 'delete', label: t('delete') })
	msgSheetItems.value = items
	msgSheetOpen.value = true
}

async function onMsgSheetSelect({ value }) {
	const m = msgSheetTarget.value
	if (!m) return
	if (value === 'copy') {
		uni.setClipboardData({ data: m.content || '' })
		return
	}
	if (value === 'share') {
		forwardMsg(m)
		return
	}
	if (value === 'delete' && (typeof m.id === 'number' || String(m.id).match(/^\d+$/))) {
		await apiAiDeleteMessage(m.id)
		messages.value = messages.value.filter((x) => x.id !== m.id)
		uni.showToast({ title: t('delete'), icon: 'none' })
	}
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
	track('ai_get_free_quota_click')
	uni.navigateTo({ url: '/pagesA/checkin/checkin' })
}

function goHome() {
	uni.switchTab({ url: '/pages/home/home' })
}

onShow(() => {
	hideNativeTabBar()
	user.value = getUser()
	track('home_enter_ai', { from: 'tab' })
	if (prayerDwellTimer) clearTimeout(prayerDwellTimer)
	// 停留约 20s 视为今日已祷告（App 内锁解锁）
	prayerDwellTimer = setTimeout(() => {
		markPrayerDoneToday().catch(() => {})
	}, 20000)
})

onHide(() => {
	if (prayerDwellTimer) {
		clearTimeout(prayerDwellTimer)
		prayerDwellTimer = null
	}
})

onMounted(() => {
	hideNativeTabBar()
	load()
})
</script>

<style scoped>
.ai-page {
	height: 100vh;
	display: flex;
	flex-direction: column;
	padding: 0 32rpx 24rpx;
	background-color: #fbf8f2;
	background-image: linear-gradient(180deg, #b6badf 0%, #fff0d9 52%, #f5dfbc 100%);
	color: #191919;
	box-sizing: border-box;
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
}
.msgs {
	flex: 1;
	height: 0;
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
	/* 随文案变宽；超过上限再换行 */
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
	gap: 24rpx;
	background: rgba(255, 255, 255, 0.6);
}
.bubble-share {
	width: 40rpx;
	height: 40rpx;
	flex-shrink: 0;
	align-self: flex-end;
}
.bubble-share-ico {
	width: 40rpx;
	height: 40rpx;
	display: block;
}
.empty-state {
	padding-top: 24rpx;
}
.greet {
	max-width: 596rpx;
	margin-bottom: 24rpx;
	gap: 0;
}
.suggests {
	margin-top: 0;
	display: flex;
	flex-direction: column;
	align-items: flex-start;
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
.quick {
	white-space: nowrap;
	margin: 12rpx 0;
}
.chip {
	display: inline-block;
	padding: 16rpx 28rpx;
	margin-right: 12rpx;
	background: rgba(255, 255, 255, 0.6);
	border-radius: 32rpx;
	font-size: 24rpx;
	color: #191919;
}
.input-row {
	display: flex;
	flex-direction: row;
	align-items: center;
	padding-bottom: 16rpx;
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
