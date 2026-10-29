<template>
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<view class="nav">
			<view class="nav__back" hover-class="press" @click="back">
				<image class="nav__back-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
			</view>
			<text class="nav__title">{{ t('quiz_review') }}</text>
			<view class="nav__spacer" />
		</view>

		<view v-for="(item, i) in items" :key="item.id || i" class="card">
			<text class="card__n">{{ i + 1 }}. {{ item.stem }}</text>
			<text class="card__m" :class="item.correct ? 'is-ok' : 'is-bad'">
				{{ item.correct ? t('quiz_passed') : t('quiz_correct_is') + ' ' + item.answer_key }}
			</text>
			<text v-if="!item.correct && item.picked" class="card__p">{{ t('quiz_your_pick') }} {{ item.picked }}</text>
		</view>
		<text v-if="!items.length" class="empty">{{ t('quiz_review_empty') }}</text>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { apiQuizResult } from '@/api/quiz.js'
import { getStatusBarPx } from '@/utils/safeArea.js'

const statusBar = getStatusBarPx()
const items = ref([])
const attemptId = ref(0)

onLoad((q) => {
	attemptId.value = Number(q?.attempt_id || 0)
})

onMounted(async () => {
	const local = uni.getStorageSync('manna_quiz_review') || {}
	const id = Number(attemptId.value || local.attempt_id || 0)
	if (
		Array.isArray(local.items) &&
		local.items.length &&
		(!id || Number(local.attempt_id || 0) === id)
	) {
		items.value = local.items
		return
	}
	if (!id) return
	try {
		const res = await apiQuizResult({ attempt_id: id })
		const d = res?.results || {}
		items.value = (d.detail || []).map((row) => ({
			id: row.question_id,
			stem: row.stem,
			picked: row.picked,
			correct: row.correct,
			answer_key: row.answer_key,
		}))
	} catch (e) {}
})

function back() {
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/quiz/quiz' }) })
}
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	min-height: 100vh;
	padding: 24rpx 40rpx 80rpx;
	box-sizing: border-box;
	@include manna-peach-page;
}

.nav { @include manna-sub-nav; }
.nav__back {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}
.nav__back-ico { width: 48rpx; height: 48rpx; }
.nav__title { @include manna-nav-title; flex: 1; text-align: center; }
.nav__spacer { width: 64rpx; }
.press { opacity: 0.7; }

.card {
	@include manna-white-card;
	padding: 28rpx 32rpx;
	margin-bottom: 16rpx;
}

.card__n { display: block; font-weight: 700; font-size: 28rpx; color: $manna-btn-text; }
.card__m { display: block; margin-top: 8rpx; font-size: 24rpx; }
.card__p { display: block; margin-top: 4rpx; font-size: 22rpx; color: rgba(33, 33, 33, 0.45); }
.is-ok { color: #52aa4b; }
.is-bad { color: #aa614b; }
.empty { display: block; margin-top: 48rpx; text-align: center; color: rgba(33, 33, 33, 0.45); }
</style>
