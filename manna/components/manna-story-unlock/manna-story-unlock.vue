<template>
	<!-- 原 pagesA/quiz/story-unlock 页，改为全屏弹层盖在通关结果页之上 -->
	<view v-if="visible" class="su-root" :style="{ paddingTop: statusBar + 'px' }" @touchmove.stop.prevent>
		<view class="su-mask" @click="onClose" />
		<view class="su-glow" />

		<view class="su-nav">
			<view class="su-nav__back" hover-class="su-press" @click="onClose">
				<image class="su-nav__back-ico" src="/static/ui/quiz/ico-back-light.svg" mode="aspectFit" />
			</view>
			<view class="su-balance">
				<image class="su-balance__ico" src="/static/ui/quiz/ico-manna.png" mode="aspectFit" />
				<text class="su-balance__n">{{ balanceDisplay }}</text>
			</view>
		</view>
		<view class="su-close" :style="{ top: statusBar + 20 + 'px' }" hover-class="su-press" @click="onClose">
			<image class="su-close__ico" src="/static/ui/quiz/ico-close-light.svg" mode="aspectFit" />
		</view>

		<text class="su-kicker">{{ t('quiz_unlocking') }}</text>
		<text class="su-title">「{{ titleDisplay }}」</text>

		<view class="su-cover-wrap">
			<image class="su-cover" :src="cover" mode="aspectFill" />
		</view>

		<view class="su-actions">
			<button class="su-btn su-btn--ghost" hover-class="su-btn--press" @click="onClose">{{ t('quiz_give_up') }}</button>
			<button class="su-btn su-btn--solid" hover-class="su-btn--press" :disabled="busy" @click="onLearn">
				{{ t('quiz_learn') }}
			</button>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { t } from '@/i18n/index.js'
import { apiQuizStoryDetail } from '@/api/quiz.js'
import { getStatusBarPx } from '@/utils/safeArea.js'

const props = defineProps({
	visible: { type: Boolean, default: false },
	storyId: { type: [String, Number], default: '' },
	title: { type: String, default: '' },
	balance: { type: [String, Number], default: '' },
})

const emit = defineEmits(['update:visible', 'learn'])

const statusBar = getStatusBarPx()
const localTitle = ref('')
const cover = ref('')
const busy = ref(false)

const titleDisplay = computed(() => localTitle.value || props.title || '')
const balanceDisplay = computed(() => {
	const b = props.balance
	return b === '' || b === undefined || b === null ? '0' : String(b)
})

watch(
	() => props.visible,
	async (v) => {
		busy.value = false
		if (!v) return
		localTitle.value = props.title || ''
		cover.value = ''
		const id = String(props.storyId || '')
		if (!id) {
			uni.showToast({ title: t('quiz_stories_empty'), icon: 'none' })
			return
		}
		try {
			const res = await apiQuizStoryDetail({ id })
			const d = res?.results || {}
			if (d.title) localTitle.value = d.title
			cover.value = d.card_url || d.cover_url || ''
		} catch (e) {
			uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
		}
	},
)

function onClose() {
	if (busy.value) return
	emit('update:visible', false)
}

function onLearn() {
	if (busy.value) return
	const id = String(props.storyId || '')
	if (!id) {
		uni.showToast({ title: t('quiz_stories_empty'), icon: 'none' })
		return
	}
	busy.value = true
	emit('learn', { id, title: titleDisplay.value })
}
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.su-root {
	position: fixed;
	left: 0;
	top: 0;
	right: 0;
	bottom: 0;
	box-sizing: border-box;
	padding: 0 48rpx 64rpx;
	overflow: hidden;
	color: $manna-white;
	font-family: $manna-font-body;
	display: flex;
	flex-direction: column;
	align-items: center;
	z-index: 9999;
}

.su-mask {
	position: absolute;
	inset: 0;
	z-index: 0;
	background: rgba(10, 7, 6, 0.6);
}

.su-glow {
	position: absolute;
	inset: 0;
	z-index: 0;
	pointer-events: none;
	background:
		radial-gradient(ellipse 70% 45% at 50% 40%, rgba(170, 97, 75, 0.55) 0%, transparent 70%),
		radial-gradient(ellipse 50% 40% at 10% 0%, rgba(170, 97, 75, 0.35) 0%, transparent 60%);
}

.su-nav, .su-close, .su-kicker, .su-title, .su-cover-wrap, .su-actions { position: relative; z-index: 1; }

.su-nav {
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 20rpx 0;
}

.su-nav__back, .su-close {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.su-close {
	position: absolute;
	right: 48rpx;
	z-index: 2;
	border-radius: 50%;
	background: rgba(0, 0, 0, 0.35);
}

.su-nav__back-ico, .su-close__ico { width: 48rpx; height: 48rpx; }
.su-press { opacity: 0.7; }

.su-balance {
	display: flex;
	align-items: center;
	& > *:not(:first-child) { margin-left: 12rpx; }
	padding: 16rpx 24rpx;
	border-radius: 80rpx;
	background: rgba(255, 255, 255, 0.1);
}

.su-balance__ico { width: 40rpx; height: 40rpx; }
.su-balance__n { font-weight: 300; font-size: 28rpx; }

.su-kicker {
	margin-top: 48rpx;
	font-weight: 700;
	font-size: 48rpx;
	letter-spacing: 0.04em;
}

.su-title {
	margin-top: 16rpx;
	font-weight: 300;
	font-size: 32rpx;
	opacity: 0.95;
}

.su-cover-wrap {
	margin-top: 48rpx;
	width: 474rpx;
	height: 646rpx;
	border-radius: 32rpx;
	padding: 4rpx;
	background: linear-gradient(160deg, #fad02c, #aa614b 55%, #5a2e22);
	box-shadow: 0 0 40rpx rgba(250, 208, 44, 0.25);
}

.su-cover {
	width: 100%;
	height: 100%;
	border-radius: 28rpx;
	background: #2a1812;
}

.su-actions {
	margin-top: auto;
	width: 100%;
	display: flex;
	& > *:not(:first-child) { margin-left: 24rpx; }
	padding-top: 48rpx;
}

.su-btn {
	flex: 1;
	height: 104rpx;
	border-radius: 500rpx;
	border: none;
	font-family: $manna-font-body;
	font-size: 36rpx;
	line-height: 104rpx;
	box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
}
.su-btn::after { border: none; }
.su-btn--ghost {
	background: transparent;
	border: 2rpx solid rgba(255, 255, 255, 0.7);
	color: rgba(255, 255, 255, 0.7);
	font-weight: 300;
}
.su-btn--solid {
	background: rgba(255, 255, 255, 0.9);
	color: $manna-btn-text;
	font-weight: 700;
}
.su-btn--press { opacity: 0.88; }
</style>
