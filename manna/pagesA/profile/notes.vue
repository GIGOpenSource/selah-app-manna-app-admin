<template>
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<view class="nav">
			<view class="nav__back" hover-class="press" @click="back">
				<image class="nav__back-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
			</view>
			<text class="nav__title">{{ t('bible_notes') }}</text>
			<view class="nav__spacer" />
		</view>
		<view v-for="n in notes" :key="n.id" class="card">
			<text class="card__t">{{ n.body }}</text>
			<text class="card__m">{{ n.book_key }} {{ n.chapter }}:{{ n.verse }}</text>
			<text class="card__del" hover-class="press" @click="remove(n)">{{ t('clear_account_confirm_btn') }}</text>
		</view>
		<text v-if="!notes.length && !loading" class="empty">{{ t('notes_empty') }}</text>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { t } from '@/i18n/index.js'
import { apiBibleNotes, apiBibleNoteSave } from '@/api/bible.js'
import { getStatusBarPx } from '@/utils/safeArea.js'

const statusBar = getStatusBarPx()
const notes = ref([])
const loading = ref(false)

async function load() {
	loading.value = true
	try {
		const res = await apiBibleNotes()
		notes.value = Array.isArray(res?.results) ? res.results : []
	} catch (e) {
		notes.value = []
	} finally {
		loading.value = false
	}
}

async function remove(n) {
	try {
		await apiBibleNoteSave({ delete_id: n.id })
		notes.value = notes.value.filter((x) => x.id !== n.id)
	} catch (e) {
		uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
	}
}

function back() {
	uni.navigateBack({ fail: () => uni.navigateTo({ url: '/pagesA/profile/bible-hub' }) })
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
.card__t { display: block; font-size: 28rpx; color: $manna-btn-text; }
.card__m { display: block; margin-top: 8rpx; font-size: 22rpx; opacity: 0.5; }
.card__del { display: block; margin-top: 12rpx; font-size: 22rpx; color: #aa614b; }
.empty { display: block; margin-top: 48rpx; text-align: center; opacity: 0.45; }
</style>
