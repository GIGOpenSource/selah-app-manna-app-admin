<template>
	<!-- Figma 994:2328 收藏；成功空列表走空态，网络失败才用 demo -->
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<view class="cross" aria-hidden="true">
			<view class="cross__v" />
			<view class="cross__h" />
		</view>

		<view class="nav">
			<view class="nav__back" hover-class="press" @click="back">
				<image class="nav__back-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
			</view>
			<text class="nav__title">{{ t('me_collections') }}</text>
			<view class="nav__spacer" />
		</view>

		<view
			v-for="item in items"
			:key="item.id"
			class="card"
			hover-class="card--press"
			@click="openItem(item)"
		>
			<view
				class="card__media"
				:style="item.cover ? { backgroundImage: `url(${item.cover})` } : {}"
			/>
			<text class="card__quote">{{ item.quote }}</text>
			<text class="card__ref">{{ item.ref }}</text>
			<text class="card__date">{{ item.date }}</text>
		</view>

		<text v-if="!items.length && !loading" class="empty">{{ t('collections_empty') }}</text>
	</view>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { t } from '@/i18n/index.js'
import { apiMannaCollections } from '@/api/manna.js'
import { getStatusBarPx } from '@/utils/safeArea.js'

const DEMO_ITEMS = [
	{
		id: 'demo-c1',
		book_key: 'isaiah',
		chapter: 41,
		verse: 10,
		quote: 'God is with you in every storm, offering peace, strength, and safety',
		ref: '-- ISAIAH 41:10',
		date: '2026.8.8',
		cover: '',
	},
]

const statusBar = getStatusBarPx()
const items = ref([])
const loading = ref(false)

function fmtDate(raw) {
	if (!raw) return '2026.8.8'
	const d = new Date(raw)
	if (Number.isNaN(d.getTime())) return String(raw).slice(0, 10).replace(/-/g, '.')
	return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}

function mapRow(row, i) {
	const book = row.book_name || row.book_key || ''
	const ch = row.chapter || 0
	const v = row.verse || 0
	const quote = row.text || row.body || row.verse_text || ''
	const ref = book && ch
		? `-- ${String(book).toUpperCase()} ${ch}:${v || ''}`
		: ''
	return {
		id: row.id || `c-${i}`,
		book_key: row.book_key || '',
		chapter: ch,
		verse: v,
		quote,
		ref,
		date: fmtDate(row.created_at || row.updated_at),
		cover: row.cover_url || '',
	}
}

async function load() {
	loading.value = true
	try {
		const res = await apiMannaCollections()
		const d = res?.results || {}
		const hi = (d.highlights || []).map(mapRow)
		const notes = (d.notes || []).map(mapRow)
		const fav = (d.favorites || []).map(mapRow)
		items.value = [...hi, ...notes, ...fav]
	} catch (e) {
		items.value = DEMO_ITEMS.map((x) => ({ ...x }))
	} finally {
		loading.value = false
	}
}

function openItem(item) {
	try {
		uni.setStorageSync('manna_bible_listen', {
			book: item.book_key || '',
			chapter: Number(item.chapter) || 1,
			autoplay: false,
		})
	} catch (e) {}
	uni.switchTab({ url: '/pages/bible/bible' })
}

function back() {
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) })
}

onMounted(load)
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	position: relative;
	min-height: 100vh;
	padding: 8rpx 40rpx 80rpx;
	box-sizing: border-box;
	@include manna-peach-page;
	overflow-x: hidden;
}

.cross {
	position: absolute;
	right: 24rpx;
	top: 76rpx;
	width: 192rpx;
	height: 288rpx;
	pointer-events: none;
	z-index: 0;
}

.cross__v {
	position: absolute;
	left: 50%;
	top: 0;
	transform: translateX(-50%);
	width: 20rpx;
	height: 256rpx;
	border-radius: 6rpx;
	background: linear-gradient(180deg, #fff1e7, #ffdabf);
}

.cross__h {
	position: absolute;
	left: 50%;
	top: 72rpx;
	transform: translateX(-50%);
	width: 160rpx;
	height: 20rpx;
	border-radius: 6rpx;
	background: linear-gradient(90deg, #ffddc4, #fff1e9, #ffddc4);
}

.nav {
	position: relative;
	z-index: 1;
	display: flex;
	align-items: center;
	gap: 12rpx;
	margin-bottom: 28rpx;
}

.nav__back {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.nav__back-ico { width: 48rpx; height: 48rpx; }

.nav__title {
	flex: 1;
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 36rpx;
	color: #000;
}

.nav__spacer { width: 64rpx; }

.card {
	position: relative;
	z-index: 1;
	background: #fff;
	border-radius: 40rpx;
	padding: 40rpx 32rpx;
	margin-bottom: 24rpx;
	display: flex;
	flex-direction: column;
	align-items: stretch;
	gap: 24rpx;
}

.card--press { opacity: 0.92; }

.card__media {
	width: 100%;
	height: 380rpx;
	border-radius: 16rpx;
	background: #d9d9d9 linear-gradient(135deg, #f0d0b8, #c8a090);
	background-size: cover;
	background-position: center;
}

.card__quote {
	font-family: $manna-font-body;
	font-size: 28rpx;
	color: #212121;
	line-height: 1.45;
}

.card__ref {
	font-size: 24rpx;
	color: rgba(33, 33, 33, 0.5);
}

.card__date {
	font-weight: 300;
	font-size: 24rpx;
	color: rgba(33, 33, 33, 0.3);
}

.empty {
	margin-top: 48rpx;
	text-align: center;
	font-size: 26rpx;
	color: rgba(33, 33, 33, 0.45);
}

.press { opacity: 0.7; }
</style>
