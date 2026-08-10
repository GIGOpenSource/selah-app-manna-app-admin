<!--
  Compose：新建自我肯定（1–160）→ 可选壁纸/主题 → 保存 → 可选分享。
-->
<template>
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="custom-nav">
				<view class="nav-pill" @tap.stop="goBack">
					<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
				</view>
				<text class="nav-title">{{ t('compose_title') }}</text>
				<view class="nav-spacer" />
			</view>
		</view>

		<view class="card">
			<textarea
				v-model="draft"
				class="input"
				:maxlength="160"
				:placeholder="t('compose_placeholder')"
				:auto-height="true"
				@input="onDraftInput"
			/>
			<text class="count" :class="{ over: draftLen > 160 }">{{ draftLen }}/160</text>
		</view>

		<text class="section-label">{{ t('compose_wallpaper') }}</text>
		<scroll-view scroll-x class="chip-scroll" :show-scrollbar="false">
			<view class="chip-row">
				<view :class="['chip', wallpaperId == null ? 'on' : '']" @tap="pickWallpaper(null)">
					<text>{{ t('compose_skip') }}</text>
				</view>
				<view
					v-for="w in wallpapers"
					:key="w.id"
					:class="['chip', 'chip-media', wallpaperId === w.id ? 'on' : '']"
					@tap="pickWallpaper(w.id)"
				>
					<image class="chip-img" :src="w.image_url || w.poster_url" mode="aspectFill" />
				</view>
			</view>
		</scroll-view>

		<text class="section-label">{{ t('compose_theme') }}</text>
		<scroll-view scroll-x class="chip-scroll" :show-scrollbar="false">
			<view class="chip-row">
				<view :class="['chip', themeId == null ? 'on' : '']" @tap="pickTheme(null)">
					<text>{{ t('compose_skip') }}</text>
				</view>
				<view
					v-for="tp in topics"
					:key="tp.id"
					:class="['chip', themeId === tp.id ? 'on' : '']"
					@tap="pickTheme(tp.id)"
				>
					<text class="chip-text">{{ tp.name }}</text>
				</view>
			</view>
		</scroll-view>

		<view class="footer">
			<view :class="['cta', !canSave || saving ? 'disabled' : '']" @tap="onSave">
				<text class="cta-text">{{ t('compose_save') }}</text>
			</view>
			<view v-if="savedId" class="cta ghost" @tap="goShare">
				<text class="cta-text ghost-text">{{ t('compose_share') }}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
	apiAffirmationSave,
	apiWallpapers,
	apiTopics,
} from '@/api/content.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { track } from '@/utils/analytics.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const draft = ref('')
const wallpaperId = ref(null)
const themeId = ref(null)
const wallpapers = ref([])
const topics = ref([])
const saving = ref(false)
const savedId = ref(null)

const draftLen = computed(() => (draft.value || '').length)
const canSave = computed(() => {
	const s = (draft.value || '').trim()
	return s.length >= 1 && s.length <= 160
})

function goBack() {
	safeBack('/pages/profile/profile')
}

function onDraftInput() {
	track('compose_edit', { len: draftLen.value })
}

function pickWallpaper(id) {
	wallpaperId.value = id
	track('compose_pick_wallpaper', { wallpaper_id: id || 0 })
}

function pickTheme(id) {
	themeId.value = id
	track('compose_pick_theme', { theme_id: id || 0 })
}

async function loadOptions() {
	try {
		const [wpRes, tpRes] = await Promise.all([
			apiWallpapers({ currentPage: 1, pageSize: 12, media_type: 'static' }),
			apiTopics({ currentPage: 1, pageSize: 12 }),
		])
		wallpapers.value = (wpRes.results || []).filter((w) => !w.locked).slice(0, 12)
		topics.value = (tpRes.results || []).slice(0, 12)
	} catch (e) {}
}

async function onSave() {
	if (!canSave.value || saving.value) return
	saving.value = true
	track('compose_save_tap', { len: draftLen.value })
	try {
		const content = draft.value.trim()
		const res = await apiAffirmationSave({
			content,
			theme_id: themeId.value,
			wallpaper_id: wallpaperId.value,
			meta: {
				source: 'compose',
				skipped_wallpaper: wallpaperId.value == null,
				skipped_theme: themeId.value == null,
			},
		})
		savedId.value = res.results?.id || null
		track('compose_publish', {
			affirmation_id: savedId.value,
			theme_id: themeId.value || 0,
			wallpaper_id: wallpaperId.value || 0,
		})
		uni.showToast({ title: t('saved'), icon: 'none' })
	} catch (e) {
		uni.showToast({ title: e?.message || t('request_failed'), icon: 'none' })
	} finally {
		saving.value = false
	}
}

function goShare() {
	const text = encodeURIComponent(draft.value.trim())
	track('compose_share_tap', { affirmation_id: savedId.value })
	uni.navigateTo({ url: `/pagesA/share/share?mode=affirmation&text=${text}` })
}

onMounted(() => {
	track('compose_open', {})
	loadOptions()
})
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page {
	min-height: 100vh;
	padding: 0 32rpx 200rpx;
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
	padding-bottom: 12rpx;
}
.nav-pill {
	@include selah-nav-circle;
	flex-shrink: 0;
}
.nav-ico {
	width: 48rpx;
	height: 48rpx;
}
.nav-title {
	@include selah-display-title;
	font-size: 36rpx;
}
.nav-spacer {
	width: 88rpx;
	height: 88rpx;
	visibility: hidden;
}
.card {
	background: $selah-card;
	border-radius: $selah-radius-card;
	padding: 28rpx 32rpx;
	box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.04);
}
.input {
	width: 100%;
	min-height: 220rpx;
	font-size: 32rpx;
	line-height: 1.45;
	color: $selah-ink;
}
.count {
	display: block;
	text-align: right;
	margin-top: 12rpx;
	font-size: 24rpx;
	color: $selah-muted;
}
.count.over {
	color: #b43030;
}
.section-label {
	display: block;
	margin: 32rpx 0 12rpx;
	font-size: 28rpx;
	color: $selah-ink-soft;
}
.chip-scroll {
	width: 100%;
	white-space: nowrap;
}
.chip-row {
	display: inline-flex;
	flex-direction: row;
	align-items: center;
	padding-bottom: 8rpx;
}
.chip {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	height: 72rpx;
	padding: 0 28rpx;
	margin-right: 16rpx;
	border-radius: 999rpx;
	background: $selah-card;
	border: 2rpx solid transparent;
	box-sizing: border-box;
	font-size: 26rpx;
	color: $selah-ink;
}
.chip.on {
	border-color: $selah-ink;
}
.chip-media {
	width: 96rpx;
	height: 96rpx;
	padding: 0;
	border-radius: 24rpx;
	overflow: hidden;
}
.chip-img {
	width: 100%;
	height: 100%;
}
.chip-text {
	max-width: 200rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.footer {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	padding: 24rpx 32rpx calc(24rpx + env(safe-area-inset-bottom));
	background: linear-gradient(180deg, rgba(245, 245, 245, 0) 0%, $selah-bg-gray 28%);
	box-sizing: border-box;
}
.cta {
	height: 96rpx;
	border-radius: $selah-radius-btn;
	background: $selah-ink;
	display: flex;
	align-items: center;
	justify-content: center;
	margin-bottom: 16rpx;
}
.cta.disabled {
	opacity: 0.4;
}
.cta.ghost {
	background: transparent;
	border: 2rpx solid rgba(25, 25, 25, 0.15);
	margin-bottom: 0;
}
.cta-text {
	color: #fff;
	font-size: 32rpx;
	font-weight: 600;
}
.ghost-text {
	color: $selah-ink;
}
</style>
