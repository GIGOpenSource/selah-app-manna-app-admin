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
			v-for="item in myCollections"
			:key="item.id"
			class="card"
			hover-class="card--press"
			@click="openItem(item)"
		>
			<view
				v-if="item.image_url"
				class="card__media"
				:style="{ backgroundImage: `url(${item.image_url})` }"
			/>
			<text v-if="item.content" class="card__quote">{{ item.content }}</text>
			<text v-if="item.reference" class="card__ref">--{{ item.reference }}</text>
			<view style="display: flex; justify-content: space-between; align-items: center;">
				<text v-if="item.liked_at" class="card__date">{{ item.liked_at }}</text>
				<image @click="toggleLike(item.target_key, item.target_type)"  src="/static/ui/me/redHeart.png" style="width: 24px; height: 24px;" mode="aspectFit" />
			</view>
			
		</view>

		<text v-if="!myCollections.length && !loading" class="empty">{{ t('collections_empty') }}</text>
	</view>
</template>

<script setup>
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { apiMannaCollections, apiMannaFavoriteToggle } from '@/api/manna.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { apiMyAssets } from '@/api/content.js'
const statusBar = getStatusBarPx()
const myCollections = ref([])
const loading = ref(false)
const toggleLike = async (targetKey, targetType) => {
	try {
		const res = await apiMannaFavoriteToggle({ target_key: targetKey, target_type: targetType })
		if (res?.code === 200 || res?.code === 201) {
			load()
			uni.showToast({ title: '取消收藏成功！', icon: 'none' })
		} else {
			uni.showToast({ title: '取消失败', icon: 'none' })
		}
	} catch (e) {
		uni.showToast({ title: '取消异常', icon: 'none' })
	}
}

function fmtDate(raw) {
	if (!raw) return ''
	const d = new Date(raw)
	if (Number.isNaN(d.getTime())) return String(raw).slice(0, 10).replace(/-/g, '.')
	return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}

function titleCaseBook(raw) {
	const s = String(raw || '').replace(/[_-]+/g, ' ').trim()
	if (!s) return ''
	return s.replace(/\b\w/g, (ch) => ch.toUpperCase())
}

function coverMap() {
	try {
		return uni.getStorageSync('manna_verse_card_covers') || {}
	} catch (e) {
		return {}
	}
}

function parseTargetKey(raw) {
	const parts = String(raw || '').split(':').filter((p) => p !== '')
	if (parts.length < 3) return {}
	const verse = parts.length >= 4 ? Number(parts[3]) || 0 : 0
	const chapter = Number(parts[parts.length - (parts.length >= 4 ? 2 : 1)]) || 0
	const book_key = parts[1] || ''
	return { book_key, chapter, verse }
}

function formatRef(book, ch, v, refRaw) {
	if (book && ch) {
		const name = String(book).toUpperCase()
		if (v > 0) return `-- ${name} ${ch}:${v}`
		return `-- ${name} ${ch}`
	}
	const s = String(refRaw || '').trim().replace(/:0$/, '')
	if (!s) return ''
	return s.startsWith('--') ? s : `-- ${s.toUpperCase()}`
}

function mapRow(row, i) {
	const parsed = parseTargetKey(row.target_key)
	const bookKey = row.book_key || parsed.book_key || ''
	const book = row.book_name || titleCaseBook(bookKey)
	const ch = Number(row.chapter || parsed.chapter) || 0
	const v = Number(row.verse || parsed.verse) || 0
	const quote = String(row.verse_text || row.text || row.body || row.quote || '').trim()
	const ref = formatRef(book, ch, v, row.reference || row.ref || '')
	const heading = quote || (book && ch ? `${book} ${ch}${v > 0 ? ':' + v : ''}` : '') || ref
	if (!heading && !bookKey) return null
	const covers = coverMap()
	return {
		id: row.id || `c-${i}`,
		target_type: row.target_type || '',
		target_key: row.target_key || '',
		book_key: bookKey,
		chapter: ch,
		verse: v,
		quote: heading,
		ref: quote ? ref : '',
		date: fmtDate(row.created_at || row.updated_at),
		cover: row.cover_url || covers[row.target_key] || '',
	}
}
async function load() {
	loading.value = true
	try {
		const res = await apiMyAssets('like')
		myCollections.value = res?.results || []		
		console.log('myCollections', myCollections.value)
	} catch (e) {
		myCollections.value = []
	} finally {
		loading.value = false
	}
}

/**
 * target_key 形如 `${kind}:${reference}`。
 * reference 自己可能带冒号（John 3:16），所以只按首个冒号切；
 * 认不出 kind 就把 ref 也丢掉，交给 prayer 页走默认。
 */
function parsePrayerKey(raw) {
	const s = String(raw || '')
	const i = s.indexOf(':')
	const kind = i > 0 ? s.slice(0, i).trim() : ''
	if (kind !== 'morning' && kind !== 'night') return { kind: '', ref: '' }
	const ref = s.slice(i + 1).trim()
	// 当年没有 reference 时 favoriteKey 落的是字面量 'prayer'，别当 ref 用
	return { kind, ref: ref === 'prayer' ? '' : ref }
}

function openItem(item) {
	const { kind: keyKind, ref } = parsePrayerKey(item.target_key)
	// 老数据（key 无 kind 前缀）沿用原判断
	const kind = keyKind || (String(item.target_key || '').startsWith('night:') ? 'night' : 'morning')
	const wantRef = ref || String(item.reference || '').trim()
	const qs = [`kind=${kind}`]
	if (wantRef) qs.push(`ref=${encodeURIComponent(wantRef)}`)
	// 带卡片封面进去，收藏那篇的底图才连得上
	if (item.image_url) qs.push(`bg=${encodeURIComponent(item.image_url)}`)
	uni.navigateTo({ url: `/pagesA/prayer/prayer?${qs.join('&')}` })
	// if (item.target_type === 'verse_card') {
	// 	try {
	// 		uni.setStorageSync('manna_versecard_payload', {
	// 			text: item.quote || '',
	// 			ref: String(item.ref || '').replace(/^--\s*/, ''),
	// 			brand: 'MANNA',
	// 			shareLine: [item.quote, item.ref].filter(Boolean).join(' '),
	// 		})
	// 	} catch (e) {}
	// 	uni.navigateTo({
	// 		url: '/pagesA/share/versecard',
	// 		fail: () => uni.switchTab({ url: '/pages/bible/bible' }),
	// 	})
	// 	return
	// }
	// try {
	// 	uni.setStorageSync('manna_bible_listen', {
	// 		book: item.book_key || '',
	// 		chapter: Number(item.chapter) || 1,
	// 		autoplay: false,
	// 	})
	// } catch (e) {}
	// uni.switchTab({ url: '/pages/bible/bible' })
}

function back() {
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) })
}

onShow(load)
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
	@include manna-nav-title;
	text-align: center;
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
}

.card--press { opacity: 0.92; }

.card__media {
	width: 100%;
	height: 380rpx;
	border-radius: 16rpx;
	margin-bottom: 24rpx;
	background-size: cover;
	background-position: center;
}

.card__quote {
	font-family: $manna-font-body;
	font-size: 28rpx;
	color: #212121;
	line-height: 1.45;
	margin-bottom: 24rpx;
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
