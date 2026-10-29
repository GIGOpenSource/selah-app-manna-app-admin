<template>
	<!-- 各 Tab 页各挂一份；全局 tabUi.key 同步选中高亮，切栏前先改 key -->
	<view
		v-show="show"
		class="mtab"
		:class="{ 'mtab--light': isLight, 'mtab--with-mini': listenSession.mini }"
		:style="{ paddingBottom: padBottom + 'px' }"
	>
		<ListenMiniBar v-if="listenSession.mini" />
		<view class="mtab__bar">
			<view
				v-for="item in items"
				:key="item.key"
				class="mtab__item"
				:class="{ 'is-on': selectedKey === item.key }"
				hover-class="mtab__item--press"
				@click.stop="go(item)"
			>
				<image
					class="mtab__ico"
					:src="selectedKey === item.key ? item.iconOn : item.icon"
					mode="aspectFit"
				/>
			</view>
		</view>
	</view>
</template>

<script setup>
import { computed } from 'vue'
import { getTabBarPaddingBottomPx } from '@/utils/safeArea.js'
import { listenSession } from '@/utils/listenSession.js'
import { openQuizPlayDirect } from '@/utils/quizAttempt.js'
import { markUserTabNavigation } from '@/utils/coldStart.js'
import { tabUi, setTabUiKey, tabVariantFor } from '@/utils/tabbar.js'
import { t } from '@/i18n/index.js'
import ListenMiniBar from '@/components/ListenMiniBar.vue'

const props = defineProps({
	active: { type: String, default: '' },
	variant: { type: String, default: '' },
	/** 子页可强制隐藏；Tab 根页保持 true，切 Tab 不卸 */
	show: { type: Boolean, default: true },
})

const selectedKey = computed(() => tabUi.key || props.active || 'home')
/** 主题跟本页 variant，不跟全局 key 变，避免切栏前玻璃条突然换色闪一下 */
const resolvedVariant = computed(() => props.variant || tabVariantFor(props.active || selectedKey.value))
const isLight = computed(() => resolvedVariant.value === 'light')
const padBottom = computed(() => getTabBarPaddingBottomPx())

const items = [
	{ path: '/pages/home/home', key: 'home', icon: '/static/ui/tab/home.svg', iconOn: '/static/ui/tab/home-on.svg' },
	{ path: '/pages/quiz/quiz', key: 'quiz', icon: '/static/ui/tab/quiz.svg', iconOn: '/static/ui/tab/quiz-on.svg' },
	{ path: '/pages/devotion/list', key: 'devotion', icon: '/static/ui/tab/devotion.svg', iconOn: '/static/ui/tab/devotion-on.svg' },
	{ path: '/pages/bible/bible', key: 'bible', icon: '/static/ui/tab/bible.svg', iconOn: '/static/ui/tab/bible-on.svg' },
	{ path: '/pages/profile/profile', key: 'me', icon: '/static/ui/tab/me.svg', iconOn: '/static/ui/tab/me-on.svg' },
]

async function go(item) {
	if (selectedKey.value === item.key && props.active === item.key) return
	markUserTabNavigation()
	// 先改全局选中，再跳转：当前页底栏立刻切到目标高亮/由目标页接棒，减少空窗
	setTabUiKey(item.key)
	if (item.key === 'quiz') {
		try {
			const r = await openQuizPlayDirect()
			if (r?.ok) return
			if (r?.error?.message === 'locked') {
				uni.showToast({ title: t('quiz_locked'), icon: 'none' })
			} else if (r?.error?.message === 'no_level') {
				uni.showToast({ title: t('quiz_empty'), icon: 'none' })
			} else {
				uni.showToast({ title: t('quiz_start_fail'), icon: 'none' })
			}
			// 开局失败：回到 quiz hub
			uni.switchTab({ url: item.path })
		} catch (e) {
			uni.showToast({ title: e?.message || t('quiz_start_fail'), icon: 'none' })
			uni.switchTab({ url: item.path })
		}
		return
	}
	uni.switchTab({ url: item.path })
}
</script>

<style scoped lang="scss">
@import '../styles/manna-theme.scss';

.mtab {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	z-index: 1000;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-end;
	pointer-events: none;
	padding-left: 40rpx;
	padding-right: 40rpx;
	box-sizing: border-box;
	transform: translateZ(0);
	backface-visibility: hidden;
}

.mtab__bar {
	pointer-events: auto;
	width: 670rpx;
	height: $manna-tab-h;
	@include manna-tab-glass;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 16rpx;
	box-sizing: border-box;
}

.mtab--light .mtab__bar {
	@include manna-tab-glass-light;
}

/* 离态 SVG 为白色，浅色底上不可见 → 统一压成深色 */
.mtab--light .mtab__ico {
	filter: brightness(0) opacity(0.38);
}

.mtab--light .mtab__item.is-on .mtab__ico {
	filter: brightness(0) opacity(1);
}

.mtab__item {
	flex: 1;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
}

.mtab__item--press {
	opacity: 0.75;
}

.mtab__ico {
	width: 64rpx;
	height: 64rpx;
}
</style>
