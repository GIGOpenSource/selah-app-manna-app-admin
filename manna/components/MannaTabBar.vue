<template>
	<!-- 由页面 onShow/onHide 控制 v-if，避免 H5 custom-tab-bar 不渲染 / 子组件生命周期丢失 -->
	<view
		class="mtab"
		:class="{ 'mtab--light': isLight }"
		:style="{ paddingBottom: padBottom + 'px' }"
	>
		<view class="mtab__bar">
			<view
				v-for="item in items"
				:key="item.key"
				class="mtab__item"
				:class="{ 'is-on': active === item.key }"
				hover-class="mtab__item--press"
				@click.stop="go(item)"
			>
				<image
					class="mtab__ico"
					:src="active === item.key ? item.iconOn : item.icon"
					mode="aspectFit"
				/>
			</view>
		</view>
	</view>
</template>

<script setup>
import { computed } from 'vue'
import { getTabBarPaddingBottomPx } from '@/utils/safeArea.js'

const props = defineProps({
	active: { type: String, default: '' },
	variant: { type: String, default: 'dark' },
})

const isLight = computed(() => props.variant === 'light')
const padBottom = computed(() => getTabBarPaddingBottomPx())

const items = [
	{ path: '/pages/home/home', key: 'home', icon: '/static/ui/tab/home.svg', iconOn: '/static/ui/tab/home-on.svg' },
	{ path: '/pages/quiz/quiz', key: 'quiz', icon: '/static/ui/tab/quiz.svg', iconOn: '/static/ui/tab/quiz-on.svg' },
	{ path: '/pages/devotion/list', key: 'devotion', icon: '/static/ui/tab/devotion.svg', iconOn: '/static/ui/tab/devotion-on.svg' },
	{ path: '/pages/bible/bible', key: 'bible', icon: '/static/ui/tab/bible.svg', iconOn: '/static/ui/tab/bible-on.svg' },
	{ path: '/pages/profile/profile', key: 'me', icon: '/static/ui/tab/me.svg', iconOn: '/static/ui/tab/me-on.svg' },
]

function go(item) {
	if (props.active === item.key) return
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
	justify-content: center;
	pointer-events: none;
	padding-left: 40rpx;
	padding-right: 40rpx;
	box-sizing: border-box;
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
