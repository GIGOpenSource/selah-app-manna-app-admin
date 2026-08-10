<!--
  Quiz 答题：逐题选择 → 提交 answer → 全部完成后进 result。
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
				:key="opt.key"
				:class="['opt', picked === opt.key ? 'on' : '']"
				@tap="picked = opt.key"
			>
				<text class="opt-key">{{ String(opt.key || '').toUpperCase() }}</text>
				<text class="opt-text">{{ opt.text }}</text>
			</view>
		</view>
		<view v-else class="empty">{{ t('quiz_empty') }}</view>

		<view class="footer">
			<view :class="['cta', !picked || submitting ? 'disabled' : '']" @tap="onNext">
				<text class="cta-text">{{
					isLast ? t('quiz_see_result') : t('quiz_next')
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
import { track } from '@/utils/analytics.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const attemptId = ref(0)
const title = ref('')
const total = ref(0)
const questions = ref([])
const index = ref(0)
const picked = ref('')
const submitting = ref(false)

const current = computed(() => questions.value[index.value] || null)
const isLast = computed(() => index.value >= questions.value.length - 1)

function goBack() {
	safeBack('/pagesA/quiz/quiz')
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

async function onNext() {
	if (!picked.value || submitting.value || !current.value) return
	submitting.value = true
	try {
		await apiQuizAnswer(attemptId.value, current.value.id, picked.value)
		track('quiz_answer', {
			attempt_id: attemptId.value,
			question_id: current.value.id,
			index: index.value,
		})
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
	} catch (e) {
		uni.showToast({ title: e?.message || t('request_failed'), icon: 'none' })
	} finally {
		submitting.value = false
	}
}
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
}
.opt.on {
	border-color: $selah-ink;
	background: #fff;
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
