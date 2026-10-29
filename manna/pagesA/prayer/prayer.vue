<template>
	<!-- Figma 540:951 Morning / 110:1162 Night；空库与失败走空态 -->
	<view class="page" :class="'page--' + kind">
		<image class="page__bg" :src="bgSrc" mode="aspectFill" />

		<view v-if="loading" class="bg-loading">
			<view class="bg-loading__spin" />
		</view>

		<view class="top" :style="{ paddingTop: statusBar + 'px' }">
			<view class="top__tools">
				<view
					class="top__btn"
					:class="{ 'is-spinning': listening }"
					hover-class="press"
					@click.stop="onMusic"
				>
					<image
						class="top__ico"
						:class="{ 'is-listening': listening }"
						:src="listening ? '/static/ui/home/ico-music.png' : '/static/ui/home/ico-nomusic.png'"
						mode="aspectFit"
					/>
				</view>
				<view class="top__btn" hover-class="press" @click.stop="onShare">
					<image class="top__ico" src="/static/ui/home/ico-share.svg" mode="aspectFit" />
				</view>
				<view
					class="top__btn"
					:class="{ 'is-liked': liked }"
					hover-class="press"
					@click.stop="onLike"
				>
					<image
						class="top__ico"
						:src="liked ? '/static/ui/home/heart-on.png' : '/static/ui/home/heart.png'" 
						mode="aspectFit"
					/>
				</view>
			</view>
			<view class="top__close" hover-class="press" @click="back">
				<image class="top__ico" src="/static/ui/prayer/ico-close.svg" mode="aspectFit" />
			</view>
		</view>

		<view class="hero">
			<text v-if="quote" class="hero__quote">{{ quote }}</text>
			<text v-if="refLine" class="hero__ref">{{ refLine }}</text>
		</view>

		<view class="sheet">
			<view class="sheet__title-row">
				<text class="sheet__title">{{ kindPeriod }}</text>
				<text class="sheet__prayer">{{ t('prayer_word') }}</text>
				<image
					class="sheet__kind-ico"
					:src="kind === 'morning' ? '/static/ui/prayer/ico-sun.png' : '/static/ui/prayer/ico-moon.png'"
					mode="aspectFit"
				/>
			</view>
			<scroll-view scroll-y class="sheet__body">
				<text v-if="body" class="sheet__txt">{{ body }}</text>
				<text v-else-if="!loading" class="sheet__empty">{{ t('prayer_empty') }}</text>
				<view class="sheet__bottom-gap" />
			</scroll-view>
			<button
				class="amen"
				:class="{
					'amen--night': kind === 'night',
					'amen--done': amenDone,
					'amen--closed': !periodOpen,
				}"
				hover-class="amen--press"
				:disabled="busy || !periodOpen || (!body && !loading)"
				@click="onAmen"
			>
				<image class="amen__ico" src="/static/ui/prayer/ico-amen.svg" mode="aspectFit" />
				<text class="amen__txt">{{ !periodOpen ? t('prayer_period_closed') : (amenDone ? t('amen_done') : t('amen')) }}</text>
			</button>
		</view>

		<!-- 离屏长图：全部绝对定位，避免 painter 嵌套 flex 叠字/裁切 -->
		<l-painter
			ref="painter"
			:key="paintKey"
			:width="posterLayout.width + 'rpx'"
			:height="posterLayout.height + 'rpx'"
			path-type="url"
			:hidden="true"
			:pixel-ratio="2"
			:useCORS="true"
		>
			<l-painter-view :css="posterRootCss">
				<l-painter-image :src="bgSrc" :css="cssHeroImg" />
				<l-painter-view :css="cssHeroScrim" />
				<l-painter-image :src="BRAND_ICO" :css="cssBrandIcoTop" />
				<l-painter-text :text="brandName" :css="cssBrandNameTop" />
				<l-painter-text :text="brandTagline" :css="cssBrandTagTop" />
				<l-painter-view :css="cssDashTop" />
				<l-painter-text
					v-for="(line, i) in posterVerseLines"
					:key="'v' + i"
					:text="line"
					:css="verseLineCss(i)"
				/>
				<l-painter-text v-if="shareRefLine" :text="shareRefLine" :css="cssRef" />
				<l-painter-view :css="cssSheet" />
				<l-painter-text
					v-for="(line, i) in posterBodyLines"
					:key="'b' + i"
					:text="line"
					:css="bodyLineCss(i)"
				/>
				<l-painter-view :css="cssDashBottom" />
				<l-painter-image :src="BRAND_ICO" :css="cssBrandIcoBottom" />
				<l-painter-text :text="brandName" :css="cssBrandNameBottom" />
				<l-painter-text :text="brandTagline" :css="cssBrandTagBottom" />
			</l-painter-view>
		</l-painter>
	</view>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { onLoad, onUnload } from '@dcloudio/uni-app'
import { t } from '@/i18n/index.js'
import { apiMannaPrayer, apiMannaPrayerAmen, apiMannaFavoriteToggle, apiMannaCollections } from '@/api/manna.js'
import { track } from '@/utils/analytics.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { decodeAssetPath, bgKindOf, isHomePoolBg, pickBgForKind } from '@/utils/homeBg.js'
import { homeBgm, stopHomeBgm, toggleHomeBgm } from '@/utils/homeBgm.js'
import { stashNewlyEarned } from '@/utils/badges.js'
import { markPeriodPrayerDone, periodKind, periodDateKey } from '@/utils/dayPeriod.js'
import { ensureMannaRemindersScheduled } from '@/utils/reminder.js'
import { copyShareText, systemShare } from '@/utils/share.js'
import { getTimezone } from '@/utils/device.js'
import LPainter from 'lime-painter/components/l-painter/l-painter.vue'
import LPainterView from 'lime-painter/components/l-painter-view/l-painter-view.vue'
import LPainterImage from 'lime-painter/components/l-painter-image/l-painter-image.vue'
import LPainterText from 'lime-painter/components/l-painter-text/l-painter-text.vue'

const BRAND_ICO = '/static/ui/share/iOS_logo_1024.png'
const POSTER_W = 750
const SIDE = 56
const CONTENT_W = POSTER_W - SIDE * 2
const HERO_MIN = 560
const VERSE_SIZE = 40
const VERSE_LH = 56
const REF_SIZE = 26
const REF_LH = 36
const BODY_SIZE = 30
const BODY_LH = 48
const BRAND_BLOCK = 96

const statusBar = getStatusBarPx()
const kind = ref(periodKind())
const quote = ref('')
const reference = ref('')
const body = ref('')
const title = ref('')
const busy = ref(false)
const loading = ref(false)
const amenDone = ref(false)
/** 进页面时当前时段是否就是本篇所属时段；否 = 回顾态，可看不可 Amen
 *  用快照而不是 computed，避免停在页面上跨过 18:00 时按钮中途变灰 */
const periodOpen = ref(true)
const entryBg = ref('')
const contentBg = ref('')
const liked = ref(false)
const exportBusy = ref(false)
const painter = ref(null)
const listening = computed(() => homeBgm.playing)
const poolBgByKind = { morning: '', night: '' }
let opened = Date.now()
/** 收藏卡带进来的 ref：命中则显示被收藏的那一篇 */
let wantRef = ''
let lastAmen = { delta: 0, balance: '', sec: 0 }

const brandName = computed(() => t('manna_prayer_brand'))
const brandTagline = computed(() => t('manna_prayer_tagline'))
const shareRefLine = computed(() => {
	const r = String(reference.value || '').trim()
	if (!r) return ''
	if (r.startsWith('--')) return r
	return `--  ${r}`
})

function absCss(left, top, width, height) {
	return `position: absolute; left: ${left}rpx; top: ${top}rpx; width: ${width}rpx; height: ${height}rpx;`
}

/** 估算绘制宽度，尽量铺满内容区（两侧留 SIDE 边距） */
function measureTextW(str, fontSize) {
	return Array.from(str).reduce((n, ch) => {
		if (/\s/.test(ch)) return n + fontSize * 0.32
		if (/[\u0000-\u00ff]/.test(ch)) return n + fontSize * 0.5
		return n + fontSize
	}, 0)
}

/** 按单词换行，避免 painter 把 made/steps 拆成 ma/de */
function wrapByWords(text, fontSize, maxWidth) {
	const src = String(text || '').trim()
	if (!src) return []
	const out = []
	src.split(/\r?\n/).forEach((para) => {
		const raw = para.trim()
		if (!raw) {
			out.push('')
			return
		}
		const tokens = raw.split(/(\s+)/)
		let line = ''
		const flush = () => {
			const s = line.replace(/\s+$/g, '')
			if (s) out.push(s)
			line = ''
		}
		tokens.forEach((tok) => {
			if (!tok) return
			const trial = line + tok
			if (line && measureTextW(trial, fontSize) > maxWidth) {
				flush()
				line = tok.replace(/^\s+/g, '')
			} else {
				line = trial
			}
		})
		flush()
	})
	return out.length ? out : ['']
}

const posterVerseLines = computed(() => wrapByWords(quote.value, VERSE_SIZE, CONTENT_W))
const posterBodyLines = computed(() => wrapByWords(body.value, BODY_SIZE, CONTENT_W))

const posterLayout = computed(() => {
	const verseLines = posterVerseLines.value
	const bodyLines = posterBodyLines.value
	const verseH = Math.max(VERSE_LH, verseLines.length * VERSE_LH)
	const bodyH = Math.max(BODY_LH, bodyLines.length * BODY_LH)
	const verseTop = 188
	const refTop = verseTop + (quote.value ? verseH + 24 : 0)
	const heroBottom = refTop + (shareRefLine.value ? REF_LH : 0) + 64
	const heroH = Math.max(HERO_MIN, heroBottom)
	const sheetTop = heroH - 48
	const bodyTop = sheetTop + 56
	const dotsBottomTop = bodyTop + (body.value ? bodyH + 48 : 0)
	const brandBottomTop = dotsBottomTop + 40
	const sheetH = (brandBottomTop - sheetTop) + BRAND_BLOCK + 64
	const height = sheetTop + sheetH
	return {
		width: POSTER_W,
		height,
		heroH,
		sheetTop,
		sheetH,
		verseTop,
		verseH,
		refTop,
		bodyTop,
		bodyH,
		dotsBottomTop,
		brandBottomTop,
	}
})

function verseLineCss(i) {
	const top = posterLayout.value.verseTop + i * VERSE_LH
	return `${absCss(SIDE, top, CONTENT_W, VERSE_LH)} font-size: ${VERSE_SIZE}rpx; font-weight: 700; color: #ffffff; line-height: ${VERSE_LH}rpx; text-align: left; white-space: nowrap;`
}
function bodyLineCss(i) {
	const top = posterLayout.value.bodyTop + i * BODY_LH
	return `${absCss(SIDE, top, CONTENT_W, BODY_LH)} font-size: ${BODY_SIZE}rpx; font-weight: 400; color: #222222; line-height: ${BODY_LH}rpx; text-align: left; white-space: nowrap;`
}

const paintKey = computed(() =>
	`${bgSrc.value}|${posterVerseLines.value.join('|')}|${shareRefLine.value}|${posterBodyLines.value.join('|')}|${brandName.value}|${brandTagline.value}|${posterLayout.value.height}|v9`,
)
const posterRootCss = computed(() =>
	`width: ${posterLayout.value.width}rpx; height: ${posterLayout.value.height}rpx; position: relative; background: #121212; overflow: hidden;`,
)
const cssHeroImg = computed(() =>
	`${absCss(0, 0, POSTER_W, posterLayout.value.heroH)} object-fit: cover;`,
)
const cssHeroScrim = computed(() =>
	`${absCss(0, 0, POSTER_W, posterLayout.value.heroH)} background: linear-gradient(180deg, rgba(12,12,14,0.45) 0%, rgba(12,12,14,0.6) 50%, rgba(12,12,14,0.82) 100%);`,
)
const cssBrandIcoTop = `${absCss(SIDE, 48, 72, 72)} border-radius: 16rpx;`
const cssBrandNameTop = `${absCss(SIDE + 92, 52, CONTENT_W - 92, 40)} font-size: 32rpx; font-weight: 700; color: #ffffff; line-height: 40rpx; white-space: nowrap;`
const cssBrandTagTop = `${absCss(SIDE + 92, 96, CONTENT_W - 92, 28)} font-size: 20rpx; font-weight: 300; color: rgba(255,255,255,0.72); line-height: 28rpx; white-space: nowrap;`
const cssDashTop = `${absCss(SIDE, 160, CONTENT_W, 2)} border-top: 2rpx dashed rgba(255,255,255,0.45);`
const cssRef = computed(() =>
	`${absCss(SIDE, posterLayout.value.refTop, CONTENT_W, REF_LH)} font-size: ${REF_SIZE}rpx; font-weight: 300; color: rgba(220,190,180,0.9); line-height: ${REF_LH}rpx; text-align: left; white-space: nowrap;`,
)
const cssSheet = computed(() =>
	`${absCss(0, posterLayout.value.sheetTop, POSTER_W, posterLayout.value.sheetH)} background: #ffffff; border-radius: 36rpx 36rpx 0 0;`,
)
const cssDashBottom = computed(() =>
	`${absCss(SIDE, posterLayout.value.dotsBottomTop + 12, CONTENT_W, 2)} border-top: 2rpx dashed rgba(33,33,33,0.28);`,
)
const cssBrandIcoBottom = computed(() =>
	`${absCss(SIDE, posterLayout.value.brandBottomTop, 72, 72)} border-radius: 16rpx;`,
)
const cssBrandNameBottom = computed(() =>
	`${absCss(SIDE + 92, posterLayout.value.brandBottomTop + 6, CONTENT_W - 92, 40)} font-size: 32rpx; font-weight: 700; color: #212121; line-height: 40rpx; white-space: nowrap;`,
)
const cssBrandTagBottom = computed(() =>
	`${absCss(SIDE + 92, posterLayout.value.brandBottomTop + 48, CONTENT_W - 92, 28)} font-size: 20rpx; font-weight: 300; color: rgba(33,33,33,0.55); line-height: 28rpx; white-space: nowrap;`,
)

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

function painterInst() {
	const p = painter.value
	if (!p) return null
	if (typeof p.canvasToTempFilePathSync === 'function') return p
	if (p.$vm && typeof p.$vm.canvasToTempFilePathSync === 'function') return p.$vm
	return null
}

function painterToPath(inst, pathType) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error('timeout')), 4000)
		try {
			inst.canvasToTempFilePathSync({
				fileType: 'png',
				pathType,
				quality: 1,
				success: (res) => {
					clearTimeout(timer)
					const path = res?.tempFilePath || res?.path || (typeof res === 'string' ? res : '')
					if (path) resolve(path)
					else reject(new Error('empty'))
				},
				fail: (err) => {
					clearTimeout(timer)
					reject(err || new Error('fail'))
				},
			})
		} catch (e) {
			clearTimeout(timer)
			reject(e)
		}
	})
}

async function composePrayerPoster() {
	if (!quote.value && !body.value) return ''
	await nextTick()
	await sleep(200)
	const inst = painterInst()
	if (!inst) return ''
	const types = []
	// #ifdef APP-PLUS
	types.push('local')
	// #endif
	// #ifndef APP-PLUS
	types.push('url')
	// #endif
	for (let i = 0; i < types.length; i++) {
		try {
			const path = await painterToPath(inst, types[i])
			if (path) return path
		} catch (e) {}
	}
	return ''
}

function sceneBg(src) {
	if (!src) return ''
	if (isHomePoolBg(src)) return ''
	const scene = bgKindOf(src)
	if (scene && scene !== kind.value) return ''
	return src
}

function poolBg(k) {
	if (!poolBgByKind[k]) poolBgByKind[k] = pickBgForKind(k)
	return poolBgByKind[k]
}

const bgSrc = computed(() => {
	return sceneBg(entryBg.value) || sceneBg(contentBg.value) || poolBg(kind.value)
})
const kindPeriod = computed(() =>
	kind.value === 'night' ? t('prayer_night') : t('prayer_morning'),
)
const refLine = computed(() => {
	const r = String(reference.value || '').trim()
	if (!r) return ''
	return r.startsWith('--') ? r : `-- ${r}`
})

onLoad((q) => {
	if (q?.kind === 'night' || q?.kind === 'morning') kind.value = q.kind
	periodOpen.value = kind.value === periodKind()
	if (!periodOpen.value) {
		// 收藏卡/旧链接可能把非当前时段的祷告带进来：给出原因，别让用户以为按钮坏了
		uni.showToast({ title: t('prayer_period_closed'), icon: 'none' })
	}
	wantRef = safeDecode(q?.ref || '')
	let bg = q?.bg ? decodeAssetPath(q.bg) : ''
	if (!bg) {
		try {
			const st = uni.getStorageSync('manna_prayer_entry') || {}
			if (st.bg && (!st.kind || st.kind === kind.value)) bg = decodeAssetPath(st.bg)
		} catch (e) {}
	}
	entryBg.value = bg
	track('page_view', { page_name: 'prayer' })
})

function clearContent() {
	quote.value = ''
	reference.value = ''
	body.value = ''
	title.value = ''
	contentBg.value = ''
	liked.value = false
}

function applyRow(row) {
	title.value = row.title || ''
	body.value = row.body || row.content || ''
	quote.value = row.verse_text || row.quote || ''
	reference.value = row.reference || ''
	contentBg.value = row.image_url || ''
}

/** 只解一层，且仅在看起来是编码串时才解，避免把正常 ref 解坏 */
function safeDecode(s) {
	const v = String(s || '')
	if (!/%[0-9a-f]{2}/i.test(v)) return v.trim()
	try {
		return decodeURIComponent(v).trim()
	} catch (e) {
		return v.trim()
	}
}

/** ref 归一：去前缀横线、压空格、忽略大小写，便于和接口返回的 reference 对上 */
function normRef(s) {
	return String(s || '')
		.replace(/^--\s*/, '')
		.trim()
		.replace(/\s+/g, ' ')
		.toLowerCase()
}

/** 从列表里挑出收藏卡指定的那一篇（认不出就返回 null，由调用方退回默认） */
function matchFavorited(list, ref) {
	const want = normRef(ref)
	if (!want) return null
	return list.find((r) => normRef(r.reference) === want || normRef(r.title) === want) || null
}

async function fetchPrayerList(params) {
	const res = await apiMannaPrayer(params)
	return Array.isArray(res?.results) ? res.results : []
}

async function load() {
	amenDone.value = false
	lastAmen = { delta: 0, balance: '', sec: 0 }
	opened = Date.now()
	loading.value = true
	try {
		// 收藏卡带了 ref：先按 ref 取那一篇；后端不认这个参数或没命中时退回当日默认
		let list = []
		if (wantRef) {
			try {
				list = await fetchPrayerList({ kind: kind.value, ref: wantRef })
			} catch (e) {
				list = []
			}
		}
		if (!list.length) list = await fetchPrayerList({ kind: kind.value })
		const row = matchFavorited(list, wantRef) || list[0]
		if (!row) {
			clearContent()
			return
		}
		applyRow(row)
		await restoreLiked()
		track('prayer_content_show', {
			verse_id: reference.value || '',
			prayer_period: kind.value,
		})
	} catch (e) {
		clearContent()
	} finally {
		loading.value = false
	}
}

function favoriteKey() {
	return `${kind.value}:${reference.value || title.value || 'prayer'}`
}

async function restoreLiked() {
	try {
		const res = await apiMannaCollections()
		const favs = res?.results?.favorites || []
		const key = favoriteKey()
		liked.value = favs.some((f) => f.target_type === 'prayer' && f.target_key === key)
	} catch (e) {
		liked.value = false
	}
}

function onMusic() {
	if (listening.value) {
		stopHomeBgm()
		return
	}
	track('manna_home_listen', { bgm: true, scene: 'prayer' })
	toggleHomeBgm()
}

async function onShare() {
	const verse = String(quote.value || '').trim()
	const prayer = String(body.value || '').trim()
	const ref = String(reference.value || '').trim()
	if (!verse && !prayer) {
		uni.showToast({ title: t('prayer_empty'), icon: 'none' })
		return
	}
	if (exportBusy.value) return
	exportBusy.value = true
	uni.showLoading({ title: t('poster_preparing'), mask: true })
	try {
		const imageUrl = await composePrayerPoster()
		try { uni.hideLoading() } catch (e) {}
		const summary = [verse, ref ? `--  ${ref}` : '', prayer].filter(Boolean).join('\n\n')
		if (!imageUrl) {
			copyShareText(summary)
			uni.showToast({ title: t('share_failed'), icon: 'none' })
			return
		}
		track('verse_share', { verse_id: ref || '', share_platform: 'system', scene: 'prayer' })
		systemShare({
			title: brandName.value,
			summary,
			imageUrl,
		})
	} catch (e) {
		try { uni.hideLoading() } catch (err) {}
		uni.showToast({ title: e?.message || t('share_failed'), icon: 'none' })
	} finally {
		exportBusy.value = false
	}
}

async function onAmen() {
	if (busy.value || !periodOpen.value) return
	busy.value = true
	try {
		if (!amenDone.value) {
			const sec = Math.max(0, Math.round((Date.now() - opened) / 1000))
			// 日期口径与本地打卡（markPeriodPrayerDone）、推送判断保持一致：
			// 归属时刻统一用「进页面时刻」opened，与 markPeriodPrayerDone(kind, opened) 同源；
			// 若用点击时刻，23:50 打开晚祷、06:05 才点 Amen 会和服务端记录分成两天。
			const localDate = periodDateKey(new Date(opened))
			try {
				const res = await apiMannaPrayerAmen({
					kind: kind.value,
					seconds: sec,
					ref: reference.value || title.value || '',
					local_date: localDate,
					tz: getTimezone(),
				})
				const d = res?.results || {}
				lastAmen = {
					delta: Number(d.manna_delta || 0),
					balance: d.balance ?? '',
					sec,
				}
				amenDone.value = true
				// 归属时段用「进页面时刻」，不要用点击时刻：
				// 23:50 打开晚祷、06:05 才点 Amen 时，点击时刻已跨进早祷窗口，
				// periodDateKey 不再减一天，会把这次祷告写成「今天晚祷」。
				markPeriodPrayerDone(kind.value, new Date(opened))
				try { ensureMannaRemindersScheduled() } catch (e) {}
				track('prayer_complete', {
					verse_id: reference.value || '',
					prayer_period: kind.value,
				})
				track('manna_amen', { scene: `prayer:${kind.value}` })
				stashNewlyEarned(d.newly_earned)
			} catch (e) {
				uni.showToast({ title: e?.message || t('amen_fail'), icon: 'none' })
				return
			}
		}
		uni.navigateTo({
			// url: `/pagesA/prayer/result?kind=${kind.value}&delta=${lastAmen.delta}&balance=${lastAmen.balance}&sec=${lastAmen.sec}&scene=prayer`,
			url: `/pagesA/devotion/result?kind=${kind.value}&delta=${lastAmen.delta}&balance=${lastAmen.balance}&sec=${lastAmen.sec}&scene=prayer`,
		})
	} finally {
		busy.value = false
	}
}

async function onLike() {
	try {
		const res = await apiMannaFavoriteToggle({
			target_type: 'prayer',
			target_key: favoriteKey(),
		})
		liked.value = !!res?.results?.liked
		try {
			const covers = uni.getStorageSync('manna_verse_card_covers') || {}
			const key = favoriteKey()
			if (liked.value) covers[key] = bgSrc.value
			else delete covers[key]
			uni.setStorageSync('manna_verse_card_covers', covers)
		} catch (e) {}
		track('manna_favorite', { liked: liked.value, scene: 'prayer' })
	} catch (e) {
		uni.showToast({ title: e?.message || t('network_error'), icon: 'none' })
	}
}

function back() {
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) })
}

onMounted(load)

onUnload(() => {
	const sec = Math.max(0, Math.round((Date.now() - opened) / 1000))
	track('prayer_content_show', {
		verse_id: reference.value || '',
		prayer_period: kind.value,
		duration_seconds: sec,
	})
})
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page {
	position: relative;
	min-height: 100vh;
	height: 100vh;
	overflow: hidden;
	font-family: $manna-font-body;
	background: #fff;
	display: flex;
	flex-direction: column;
}

.page__bg {
	position: fixed;
	inset: 0;
	width: 100%;
	height: 100%;
	z-index: 0;
	filter: blur(10px);
	transform: scale(1.05);
}

.bg-loading {
	position: fixed;
	inset: 0;
	z-index: 5;
	display: flex;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.38);
	pointer-events: none;
}

.bg-loading__spin {
	width: 76rpx;
	height: 76rpx;
	border: 6rpx solid rgba(255, 255, 255, 0.45);
	border-top-color: #fff;
	border-radius: 50%;
	animation: bg-spin 0.8s linear infinite;
}

@keyframes bg-spin {
	to { transform: rotate(360deg); }
}

.top, .hero, .sheet, .amen { position: relative; z-index: 1; }

.top {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 20rpx 40rpx 0;
}

.top__tools {
	display: flex;
	align-items: center;
}

.top__tools .top__btn + .top__btn {
	margin-left: 32rpx;
}

.top__btn {
	width: 64rpx;
	height: 64rpx;
	border-radius: 50%;
	overflow: hidden;
	background: transparent;
	flex-shrink: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	transform: translateZ(0);
}

.top__btn.is-spinning {
	animation: prayer-spin 4.5s linear infinite;
}

.top__ico {
	width: 64rpx;
	height: 64rpx;
	background: transparent;
}



.top__close {
	width: 64rpx;
	height: 64rpx;
}

@keyframes prayer-spin {
	from { transform: rotate(0deg); }
	to { transform: rotate(360deg); }
}

.hero {
	padding: 48rpx 48rpx 24rpx;
	color: #fff;
}

.hero__quote {
	display: block;
	font-weight: 700;
	font-size: 36rpx;
	line-height: 56rpx;
	margin-bottom: 32rpx;
	color: #fff;
	text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.85), 0 0 24rpx rgba(0, 0, 0, 0.55);
}

.hero__ref {
	display: block;
	font-weight: 300;
	font-size: 24rpx;
	letter-spacing: 0.24rpx;
	color: #fff;
	opacity: 0.92;
	text-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.85), 0 0 24rpx rgba(0, 0, 0, 0.55);
}

/* 早祷（浅色草场底图）转深色字；晚祷沿用上面的白字。
   底图亮，投影换成白色柔光，压字边、避免深影糊在深字上。 */
.page--morning .hero__quote,
.page--morning .hero__ref {
	color: #212121;
	text-shadow: 0 2rpx 8rpx rgba(255, 255, 255, 0.85), 0 0 24rpx rgba(255, 255, 255, 0.6);
}

.sheet {
	flex: 1;
	min-height: 0;
	margin-top: 24rpx;
	background: #fff;
	border-radius: 32rpx 32rpx 0 0;
	padding: 40rpx 40rpx calc(24rpx + env(safe-area-inset-bottom, 0px));
	box-sizing: border-box;
	display: flex;
	flex-direction: column;
}

.sheet__title-row {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 12rpx;
	margin-bottom: 24rpx;
}

.sheet__title,
.sheet__prayer {
	font-family: $manna-font-body;
	font-weight: 700;
	font-size: 40rpx;
	color: #212121;
	line-height: 1.2;
}

.sheet__kind-ico {
	width: 48rpx;
	height: 48rpx;
	flex-shrink: 0;
}

.sheet__body {
	flex: 1;
	min-height: 0;
	height: 100%;
}

.sheet__bottom-gap {
	height: calc(168rpx + env(safe-area-inset-bottom, 0px));
	flex-shrink: 0;
}

.sheet__txt {
	display: block;
	font-weight: 300;
	font-size: 32rpx;
	line-height: 56rpx;
	letter-spacing: 0.32rpx;
	color: #212121;
	white-space: pre-wrap;
}

.sheet__empty {
	display: block;
	margin-top: 24rpx;
	font-weight: 300;
	font-size: 28rpx;
	color: rgba(33, 33, 33, 0.45);
}

.amen {
	position: absolute;
	left: 50%;
	bottom: calc(40rpx + env(safe-area-inset-bottom, 0px));
	transform: translateX(-50%);
	z-index: 2;
	width: 630rpx;
	height: 104rpx;
	border-radius: 1000rpx;
	/* 晨间 Morning：深草绿 */
	background: $manna-amen-morning;
	box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.12);
	display: flex;
	align-items: center;
	justify-content: center;
	border: none;
	padding: 0;
	margin: 0;
	line-height: 1;
	box-sizing: border-box;
}

/* 夜间 Night：暖陶土色 */
.amen--night { background: $manna-amen-solid; }
/* 回顾态（非当前时段）：浅灰描边胶囊、灰字、去图标 —— 明确「看得到但点不了」 */
.amen--closed {
	background: rgba(33, 33, 33, 0.05);
	border: 2rpx solid rgba(33, 33, 33, 0.12);
	box-shadow: none;
}
.amen--closed .amen__ico { display: none; }
.amen--closed .amen__txt {
	color: rgba(33, 33, 33, 0.42);
	font-weight: 600;
	font-size: 30rpx;
}
.amen--done { opacity: 0.7; }
.amen--press { opacity: 0.85; }
.amen::after { border: none; }

.amen__ico { width: 48rpx; height: 48rpx; margin-right: 8rpx; }
.amen__txt {
	font-weight: 700;
	font-size: 36rpx;
	color: #fff;
}

.press { opacity: 0.7; }
</style>
