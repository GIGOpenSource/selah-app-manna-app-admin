<template>
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<view class="nav">
			<view class="nav__back" hover-class="press" @click="back">
				<image class="nav__back-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
			</view>
			<text class="nav__title">{{ t('bible_highlight') }}</text>
			<view class="nav__spacer" />
		</view>
		<view v-for="h in rows" :key="h.id" class="card" hover-class="press" @click="openHighlight(h)">
			<text class="card__t">{{ h.book_key }} {{ h.chapter }}:{{ h.verse }}</text>
			<text class="card__m">{{ h.color || t('bible_highlight') }}</text>
			<text class="card__del" hover-class="press" @click.stop="remove(h)">{{ t('clear_account_confirm_btn') }}</text>
		</view>
		<text v-if="!rows.length && !loading" class="empty">{{ t('highlights_empty') }}</text>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { t } from '@/i18n/index.js'
import { apiBibleHighlights, apiBibleHighlightSave } from '@/api/bible.js'
import { getStatusBarPx } from '@/utils/safeArea.js'

const statusBar = getStatusBarPx()
const rows = ref([])
const loading = ref(false)

async function load() {
	loading.value = true
	try {
		const res = await apiBibleHighlights()
		rows.value = Array.isArray(res?.results) ? res.results : []
	} catch (e) {
		rows.value = []
	} finally {
		loading.value = false
	}
}

async function remove(h) {
	try {
		await apiBibleHighlightSave({ delete_id: h.id })
		rows.value = rows.value.filter((x) => x.id !== h.id)
	} catch (e) {
		uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
	}
}

function back() {
	uni.navigateBack({ fail: () => uni.navigateTo({ url: '/pagesA/profile/bible-hub' }) })
}

/** 点击高亮卡片：写跳转意图并切到读经 Tab，由读经页 onShow 消费并滚动到对应节 */
function openHighlight(h) {
	if (!h) return
	try {
		uni.setStorageSync('manna_bible_open_ref', {
			book_key: h.book_key,
			chapter: Number(h.chapter) || 1,
			verse: Number(h.verse) || 0,
			translation_code: h.translation_code || undefined,
		})
	} catch (e) {}
	uni.switchTab({ url: '/pages/bible/bible' })
}

onMounted(load)
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';
.page { min-height: 100vh; padding: 24rpx 40rpx 80rpx; box-sizing: border-box; @include manna-peach-page; }
.nav { @include manna-sub-nav; }
.nav__back { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; }
.nav__back-ico { width: 48rpx; height: 48rpx; }
.nav__title { @include manna-nav-title; flex: 1; text-align: center; }
.nav__spacer { width: 64rpx; }
.press { opacity: 0.7; }
.card { @include manna-white-card; padding: 28rpx 32rpx; margin-bottom: 14rpx; }
.card__t { display: block; font-weight: 700; font-size: 28rpx; }
.card__m { display: block; margin-top: 8rpx; font-size: 22rpx; opacity: 0.5; }
.card__del { display: block; margin-top: 12rpx; font-size: 22rpx; color: #aa614b; }
.empty { display: block; margin-top: 48rpx; text-align: center; opacity: 0.45; }
</style>
