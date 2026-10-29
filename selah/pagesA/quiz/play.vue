<!--
  Quiz 答题：逐题选择 → 提交 answer（接口返回对错与正解）→ 全部完成后进结果页。
-->
<template>
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="custom-nav">
				<view class="nav-pill" @tap.stop="goBack">
					<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
				</view>
				<text class="progress">{{ index + 1 }}/{{ questions.length || total }}</text>
				<view class="nav-spacer" />
			</view>
			<text class="page-title">{{ title }}</text>
		</view>

		<view v-if="current" class="card">
			<text class="stem">{{ current.stem }}</text>
			<view
				v-for="opt in current.options || []"
				:key="String(opt.key)"
				:class="['opt', optClass(opt.key)]"
				hover-class="opt-press"
				@click.stop="onPick(opt.key)"
			>
				<text class="opt-key">{{ String(opt.key || '').toUpperCase() }}</text>
				<text class="opt-text">{{ opt.text }}</text>
			</view>
			<view v-if="feedback" class="feedback">
				<text :class="['fb-title', feedback.correct ? 'ok' : 'bad']">
					{{ feedback.correct ? t('quiz_correct') : t('quiz_wrong') }}
				</text>
				<text v-if="!feedback.correct" class="fb-explain">
					{{ t('quiz_your_answer') }}: {{ labelFor(picked) }}
				</text>
				<text v-if="!feedback.correct" class="fb-explain">
					{{ t('quiz_correct_answer') }}: {{ labelFor(feedback.correct_key) }}
				</text>
				<text v-if="feedback.explain" class="fb-explain">{{ feedback.explain }}</text>
			</view>
		</view>
		<view v-else class="empty">{{ t('quiz_empty') }}</view>

		<view class="footer">
			<view :class="['cta', ctaDisabled ? 'disabled' : '']" @click.stop="onNext">
				<text class="cta-text">{{
					submitting ? t('quiz_next') : (isLast ? t('quiz_see_result') : t('quiz_next'))
				}}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { apiQuizAnswer } from '@/api/content.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { createTapLock } from '@/utils/tapLock.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const attemptId = ref(0)
const title = ref('')
const total = ref(0)
const questions = ref([])
const index = ref(0)
const picked = ref('')
const submitting = ref(false)
const feedback = ref(null)
const pickLock = createTapLock(420)
const nextLock = createTapLock(420)

const current = computed(() => questions.value[index.value] || null)
const isLast = computed(() => index.value >= questions.value.length - 1)
const ctaDisabled = computed(() => submitting.value || !feedback.value)

function normKey(key) {
	return String(key ?? '').trim().toLowerCase()
}

function goBack() {
	safeBack('/pagesA/quiz/quiz')
}

function labelFor(key) {
	const opts = current.value?.options || []
	const hit = opts.find((o) => normKey(o.key) === normKey(key))
	const displayKey = hit ? hit.key : key
	return hit ? `${String(displayKey || '').toUpperCase()}. ${hit.text}` : (key || '—')
}

function optClass(key) {
	if (!feedback.value) return normKey(picked.value) === normKey(key) ? 'on' : ''
	if (normKey(key) === normKey(feedback.value.correct_key)) return 'correct'
	if (normKey(key) === normKey(picked.value) && !feedback.value.correct) return 'wrong'
	return ''
}

function onPick(key) {
	pickLock.run(() => {
		if (submitting.value || feedback.value) return
		picked.value = key
		submitAnswer()
	})
}

async function submitAnswer() {
	if (picked.value === '' || picked.value == null || submitting.value || !current.value || feedback.value) return
	submitting.value = true
	try {
		const res = await apiQuizAnswer(attemptId.value, current.value.id, picked.value)
		const data = res.results || res || {}
		feedback.value = {
			correct: !!data.correct,
			correct_key: data.correct_key || '',
			explain: data.explain || '',
		}
	} catch (e) {
		uni.showToast({ title: e?.message || t('request_failed'), icon: 'none' })
		picked.value = ''
	} finally {
		submitting.value = false
	}
}

function onNext() {
	nextLock.run(() => {
		if (ctaDisabled.value || !current.value) return
		if (isLast.value) {
			try {
				uni.removeStorageSync('quiz_play_payload')
			} catch (e) {}
			uni.redirectTo({
				url: `/pagesA/quiz/result?attempt_id=${attemptId.value}`,
			})
			return
		}
		index.value += 1
		picked.value = ''
		feedback.value = null
	})
}

onLoad((q) => {
	attemptId.value = Number(q?.attempt_id || 0)
	let payload = null
	try {
		payload = uni.getStorageSync('quiz_play_payload')
	} catch (e) {}
	if (payload && Number(payload.attempt_id) === attemptId.value) {
		title.value = payload.title || t('quiz_title')
		total.value = payload.total || (payload.questions || []).length
		questions.value = payload.questions || []
	} else {
		title.value = t('quiz_title')
		questions.value = []
	}
})
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page {
	min-height: 100vh;
	padding: 0 32rpx 180rpx;
	background: $selah-bg-gray;
	color: $selah-ink;
	box-sizing: border-box;
}
.page-head {
	@include selah-sticky-head;
}
.head-glass {
	@include selah-sticky-head-glass($selah-bg-gray);
}
.custom-nav {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	min-height: 88rpx;
}
.nav-pill {
	@include selah-nav-circle;
}
.nav-ico {
	width: 48rpx;
	height: 48rpx;
}
.progress {
	font-size: 28rpx;
	color: $selah-ink-soft;
	font-weight: 600;
}
.nav-spacer {
	width: 88rpx;
	height: 88rpx;
	visibility: hidden;
}
.page-title {
	display: block;
	position: relative;
	z-index: 1;
	@include selah-display-title;
	font-size: 40rpx;
	margin: 8rpx 0 24rpx;
}
.card {
	background: $selah-card;
	border-radius: $selah-radius-card;
	padding: 32rpx;
	box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.04);
}
.stem {
	display: block;
	font-size: 32rpx;
	font-weight: 600;
	line-height: 1.4;
	margin-bottom: 28rpx;
}
.opt {
	display: flex;
	flex-direction: row;
	align-items: center;
	min-height: 96rpx;
	padding: 20rpx 24rpx;
	margin-bottom: 16rpx;
	border-radius: 24rpx;
	background: #f7f4f1;
	border: 2rpx solid transparent;
	box-sizing: border-box;
	cursor: pointer;
	user-select: none;
	-webkit-tap-highlight-color: transparent;
}
.opt-press {
	opacity: 0.86;
}
.opt.on {
	border-color: $selah-ink;
	background: #fff;
}
.opt.correct {
	border-color: #1f8a4c;
	background: #eaf7ef;
}
.opt.correct .opt-key {
	background: #1f8a4c;
}
.opt.wrong {
	border-color: #c0392b;
	background: #fdecea;
}
.opt.wrong .opt-key {
	background: #c0392b;
}
.feedback {
	margin-top: 12rpx;
	padding-top: 8rpx;
}
.fb-title {
	display: block;
	font-size: 28rpx;
	font-weight: 700;
	margin-bottom: 8rpx;
}
.fb-title.ok { color: #1f8a4c; }
.fb-title.bad { color: #c0392b; }
.fb-explain {
	display: block;
	font-size: 26rpx;
	line-height: 1.45;
	color: $selah-ink-soft;
}
.opt-key {
	width: 48rpx;
	height: 48rpx;
	border-radius: 50%;
	background: $selah-ink;
	color: #fff;
	font-size: 22rpx;
	font-weight: 700;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-right: 20rpx;
	flex-shrink: 0;
	text-align: center;
	line-height: 48rpx;
}
.opt-text {
	flex: 1;
	font-size: 28rpx;
	line-height: 1.35;
}
.empty {
	text-align: center;
	color: $selah-muted;
	padding: 80rpx 24rpx;
}
.footer {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	padding: 24rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
	background: linear-gradient(180deg, rgba(245, 245, 245, 0) 0%, $selah-bg-gray 28%);
}
.cta {
	height: 96rpx;
	border-radius: $selah-radius-btn;
	background: $selah-ink;
	display: flex;
	align-items: center;
	justify-content: center;
}
.cta.disabled {
	opacity: 0.4;
}
.cta-text {
	color: #fff;
	font-size: 32rpx;
	font-weight: 600;
}
</style>
