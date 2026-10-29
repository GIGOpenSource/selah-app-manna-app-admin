<template>
	<!-- Figma 664:1867 Quiz-InBible；空经文或失败走空态 -->
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<image class="page__bg" src="/static/ui/quiz/inbible/bg-openbook.png" mode="aspectFill" />
		<view class="page__fade" />

		<view class="nav">
			<view class="nav__back" hover-class="press" @click="back">
				<image class="nav__back-ico" src="/static/ui/quiz/inbible/ico-back.svg" mode="aspectFit" />
			</view>
			<text class="nav__title">{{ levelTitle }}</text>
			<view class="balance">
				<image class="balance__ico" src="/static/ui/quiz/inbible/ico-manna.png" mode="aspectFit" />
				<text class="balance__n">{{ balance }}</text>
			</view>
		</view>

		<view class="sheet">
			<view class="sheet__handle" @click="back" />
			<text class="sheet__title">{{ bookName }} {{ chapter }}</text>
			<scroll-view
				scroll-y
				class="sheet__scroll"
				:scroll-into-view="anchor"
				:scroll-with-animation="false"
			>
				<view
					v-for="v in verses"
					:key="v.verse"
					:id="'v' + v.verse"
					class="verse"
					:class="{ 'verse--focus': inFocus(v.verse) }"
				>
					<text class="verse__n">{{ v.verse }}</text>
					<text class="verse__t">{{ v.text }}</text>
				</view>
				<text v-if="!verses.length && !loading" class="empty">{{ t('bible_empty') }}</text>
			</scroll-view>
			<view class="cta" hover-class="press" @click="goBible">
				<image class="cta__ico" src="/static/ui/quiz/inbible/ico-bible.svg" mode="aspectFit" />
				<text class="cta__txt">{{ t('quiz_go_bible') }}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { apiBibleChapter } from '@/api/bible.js'
import { apiMannaBalance } from '@/api/manna.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
const statusBar = getStatusBarPx()
const bookKey = ref('romans')
const bookName = ref('')
const chapter = ref(1)
const focusVerse = ref(1)
// 经文区间终点（接口 bible_ref 可能给 verse_start/verse_end）
const focusEnd = ref(1)
// scroll-view 的滚动锚点，必须等经文渲染完再赋值才会生效
const anchor = ref('')
const verses = ref([])
const balance = ref(0)
const levelTitle = ref(t('quiz_level_n', { n: 2 }))
const attemptId = ref('')
const loading = ref(false)

onLoad((q) => {
	if (q?.book) bookKey.value = String(q.book)
	if (q?.chapter) chapter.value = Number(q.chapter) || 1
	if (q?.verse) focusVerse.value = Number(q.verse) || 1
	focusEnd.value = Number(q?.end || q?.verse_end) || focusVerse.value
	if (focusEnd.value < focusVerse.value) focusEnd.value = focusVerse.value
	if (q?.name) bookName.value = decodeURIComponent(String(q.name))
	if (q?.level) levelTitle.value = decodeURIComponent(String(q.level))
	if (q?.attempt_id) attemptId.value = String(q.attempt_id)
	if (q?.balance != null && q.balance !== '') balance.value = Number(q.balance) || balance.value
})

onMounted(async () => {
	try {
		const bal = await apiMannaBalance()
		if (typeof bal?.results?.balance === 'number') balance.value = bal.results.balance
	} catch (e) {}
	loading.value = true
	try {
		const res = await apiBibleChapter({
			translation: uni.getStorageSync('manna_bible_translation') || 'web',
			book: bookKey.value,
			chapter: chapter.value,
			verse: focusVerse.value,
		})
		const d = res?.results || {}
		if (d.book_name || d.book_title) bookName.value = d.book_name || d.book_title
		if (d.chapter) chapter.value = Number(d.chapter) || chapter.value
		const list = Array.isArray(d.verses) ? d.verses : []
		verses.value = list.map((v, i) => ({
			verse: Number(v.verse) || i + 1,
			text: v.text || v.content || '',
		}))
		ensureFocusInRange()
	} catch (e) {
		verses.value = []
	} finally {
		loading.value = false
	}
	if (verses.value.length) scrollToFocus()
})

/** 焦点节是否落在高亮区间内 */
function inFocus(n) {
	return n >= focusVerse.value && n <= focusEnd.value
}

/** URL 里的节号若超出本章节数（书卷/章节传错或译本节数不同），回退到首节，避免整章看不到焦点 */
function ensureFocusInRange() {
	const list = verses.value
	if (!list.length) return
	const first = Number(list[0].verse) || 1
	const last = Number(list[list.length - 1].verse) || first
	if (focusVerse.value < first || focusVerse.value > last) {
		console.warn('[in-bible] verse out of range', focusVerse.value, first, last)
		focusVerse.value = first
		focusEnd.value = first
	}
	if (focusEnd.value > last) focusEnd.value = last
	if (focusEnd.value < focusVerse.value) focusEnd.value = focusVerse.value
}

/** scroll-into-view 必须在节点渲染完成后赋值；先清空再设，保证重复进入也能触发 */
async function scrollToFocus() {
	const id = `v${focusVerse.value}`
	anchor.value = ''
	await nextTick()
	setTimeout(() => {
		anchor.value = id
	}, 50)
}

function goBible() {
	try {
		uni.setStorageSync('manna_bible_listen', {
			book: bookKey.value,
			chapter: chapter.value,
			autoplay: false,
			from: 'quiz-inbible',
			attempt_id: attemptId.value,
		})
	} catch (e) {}
	uni.switchTab({ url: '/pages/bible/bible' })
}

function back() {
	uni.navigateBack({
		fail: () => {
			if (attemptId.value) {
				uni.redirectTo({ url: `/pagesA/quiz/play?attempt_id=${attemptId.value}` })
				return
			}
			uni.switchTab({ url: '/pages/quiz/quiz' })
		},
	})
}
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	position: relative;
	min-height: 100vh;
	height: 100vh;
	overflow: hidden;
	font-family: $manna-font-body;
	display: flex;
	flex-direction: column;
}

.page__bg {
	position: fixed;
	inset: 0;
	width: 100%;
	height: 100%;
	z-index: 0;
}

.page__fade {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	height: 60%;
	z-index: 0;
	background: linear-gradient(180deg, rgba(255, 244, 238, 0) 0%, #fff4ee 31%);
}

.nav, .sheet { position: relative; z-index: 1; }

.nav {
	display: flex;
	align-items: center;
	padding: 20rpx 40rpx;
	& > *:not(:first-child) { margin-left: 8rpx; }
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
	color: #000;
}

.balance {
	display: flex;
	align-items: center;
	& > *:not(:first-child) { margin-left: 12rpx; }
	padding: 16rpx 24rpx;
	border-radius: 80rpx;
	background: rgba(33, 33, 33, 0.5);
	border: 1rpx solid rgba(0, 0, 0, 0.5);
}

.balance__ico { width: 40rpx; height: 40rpx; }
.balance__n {
	font-weight: 300;
	font-size: 28rpx;
	color: #fff;
}

.sheet {
	margin-top: auto;
	min-height: 68%;
	background: linear-gradient(180deg, rgba(255, 255, 255, 0.7) 0%, #fff 47%);
	backdrop-filter: blur(10px);
	border: 1rpx solid #fff;
	border-radius: 56rpx 56rpx 0 0;
	box-shadow: 0 0 40rpx rgba(170, 97, 75, 0.1);
	padding: 0 40rpx 48rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	box-sizing: border-box;
}

.sheet__handle {
	width: 96rpx;
	height: 12rpx;
	border-radius: 20rpx;
	background: rgba(33, 33, 33, 0.3);
	margin: 20rpx 0 32rpx;
}

.sheet__title {
	font-weight: 700;
	font-size: 48rpx;
	color: #212121;
	margin-bottom: 24rpx;
}

.sheet__scroll {
	flex: 1;
	width: 100%;
	min-height: 0;
	height: 520rpx;
}

.verse {
	display: flex;
	& > *:not(:first-child) { margin-left: 16rpx; }
	padding: 20rpx 8rpx;
	opacity: 0.5;
}

.verse--focus { opacity: 1; }

.verse__n {
	font-weight: 300;
	font-size: 24rpx;
	color: rgba(33, 33, 33, 0.5);
	flex-shrink: 0;
	padding-top: 4rpx;
}

.verse__t {
	flex: 1;
	font-weight: 300;
	font-size: 32rpx;
	line-height: 56rpx;
	color: #212121;
	letter-spacing: 0.32rpx;
}

.verse--focus .verse__t { font-weight: 400; }

.empty {
	display: block;
	margin: 48rpx 8rpx;
	text-align: center;
	font-size: 26rpx;
	color: rgba(33, 33, 33, 0.45);
}

.cta {
	margin-top: 24rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	& > *:not(:first-child) { margin-left: 8rpx; }
	padding: 16rpx 24rpx;
	border-radius: 80rpx;
	background: rgba(255, 255, 255, 0.5);
	border: 1rpx solid rgba(0, 0, 0, 0.1);
}

.cta__ico { width: 40rpx; height: 40rpx; }
.cta__txt {
	font-weight: 500;
	font-size: 24rpx;
	color: #212121;
}

.press { opacity: 0.75; }
</style>
