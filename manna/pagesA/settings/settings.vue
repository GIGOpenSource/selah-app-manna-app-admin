<template>
	<!-- Settings：ABOUT YOU / MAKE IT YOURS / ACCOUNT / SUPPORT / HELP / FOLLOW / OTHER + footer -->
	<view class="page-wrap">
	<view class="page" :style="{ paddingTop: statusBar + 'px' }">
		<view class="nav">
			<view class="nav__back" hover-class="nav__press" @click="back">
				<image class="nav__back-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
			</view>
			<text class="nav__title">{{ t('settings') }}</text>
		</view>

		<text class="section">{{ t('section_about_you') }}</text>
		<view class="group">
			<view class="row" hover-class="row-hover" @click="openNameDialog">
				<text class="row__lab">{{ t('settings_name') }}</text>
				<view class="row__trail">
					<text class="row__val">{{ displayName || t('settings_name_empty') }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
			<view class="row" hover-class="row-hover" @click="openChoice('gender')">
				<text class="row__lab">{{ t('gender') }}</text>
				<view class="row__trail">
					<text class="row__val">{{ genderLabel }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
			<view class="row" hover-class="row-hover" @click="openChoice('age')">
				<text class="row__lab">{{ t('age') }}</text>
				<view class="row__trail">
					<text class="row__val">{{ ageLabel }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
			<view class="row" hover-class="row-hover" @click="openChoice('relationship')">
				<text class="row__lab">{{ t('relationship_status') }}</text>
				<view class="row__trail">
					<text class="row__val">{{ relationshipLabel }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
			<view class="row last" hover-class="row-hover" @click="openChoice('denomination')">
				<text class="row__lab">{{ t('denomination') }}</text>
				<view class="row__trail">
					<text class="row__val">{{ denominationLabel }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
		</view>

		<text class="section">{{ t('section_make_yours') }}</text>
		<view class="group">
			<view class="row" hover-class="row-hover" @click="pickLang">
				<text class="row__lab">{{ t('language') }}</text>
				<view class="row__trail">
					<text class="row__val">{{ langDisplay }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
			<view class="row last">
				<text class="row__lab">{{ t('settings_daily_remind') }}</text>
				<switch :checked="dailyRemindOn" @change="onDailyRemind" color="#212121" />
			</view>
		</view>

		<text class="section">{{ t('section_account') }}</text>
		<view class="group">
			<view class="row last" hover-class="row-hover" @click="go('/pagesA/settings/account')">
				<text class="row__lab">{{ t('login_setting') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
		</view>

		<text class="section">{{ t('support_us') }}</text>
		<view class="group">
			<view class="row" hover-class="row-hover" @click="onSupportShare">
				<text class="row__lab">{{ shareLabel }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
			<view class="row" hover-class="row-hover" @click="onSupportMore">
				<text class="row__lab">{{ moreByLabel }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
			<view class="row last" hover-class="row-hover" @click="onSupportRate">
				<text class="row__lab">{{ rateLabel }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
		</view>

		<text class="section">{{ t('section_help') }}</text>
		<view class="group">
			<view class="row last" hover-class="row-hover" @click="openLegalPage('help', cfg)">
				<text class="row__lab">{{ t('legal_help') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
		</view>

		<text v-if="socialLinks.length" class="section">{{ t('section_follow') }}</text>
		<view v-if="socialLinks.length" class="group">
			<view
				v-for="(s, i) in socialLinks"
				:key="'follow-' + s.key"
				:class="['row', i === socialLinks.length - 1 ? 'last' : '']"
				hover-class="row-hover"
				@click="openSocial(s)"
			>
				<text class="row__lab">{{ s.label }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
		</view>

		<text class="section">{{ t('other') }}</text>
		<view class="group">
			<view class="row" hover-class="row-hover" @click="openLegalPage('privacy', cfg)">
				<text class="row__lab">{{ t('legal_privacy') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
			<view class="row" hover-class="row-hover" @click="openLegalPage('terms', cfg)">
				<text class="row__lab">{{ t('legal_terms') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
			<!-- <view class="row last">
				<text class="row__lab">{{ t('marketing_analytics') }}</text>
				<switch :checked="marketingOn" @change="onMarketing" color="#212121" />
			</view> -->
		</view>

		<view class="meta" @click="copyUserId">
			<view class="meta__copy">
				<text>{{ versionLine }}</text>
				<text>{{ userIdLine }}</text>
			</view>
			<image class="meta__ico" src="/static/ui/copy.png" mode="aspectFit" />
		</view>
	</view>

		<manna-sheet
			v-model:visible="langSheetOpen"
			v-model="lang"
			:title="t('language')"
			:items="langOptions"
			:cancel-text="t('cancel')"
			@select="onLangSelect"
		/>
		<manna-sheet
			v-model:visible="choiceSheetOpen"
			:title="choiceTitle"
			:items="choiceItems"
			:cancel-text="t('cancel')"
			@select="onChoiceSelect"
		/>
		<manna-dialog
			v-model:visible="nameDialogOpen"
			v-model:prompt-value="nameDraft"
			editable
			:title="t('edit_display_name')"
			:placeholder="t('display_name')"
			:confirm-text="t('ok')"
			:cancel-text="t('cancel')"
			@confirm="onNameDialogConfirm"
		/>
	</view>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
	t as tRaw,
	setLocale,
	getLocale,
	LANG_PICKER_OPTIONS,
	NATIVE_LANG_LABELS,
	UI_LOCALES,
} from '@/i18n/index.js'
import { apiAuthMe, apiUpdateProfile } from '@/api/auth.js'
import { apiAppConfig } from '@/api/content.js'
import { getUser, setUser } from '@/utils/session.js'
import { getCurrentLanguage, setCurrentLanguage } from '@/utils/storageKeys.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { applyTabBarLocale } from '@/utils/tabbar.js'
import { track, getAppPlatform } from '@/utils/analytics.js'
import { openLegalPage } from '@/utils/openLegal.js'
import { isDailyRemindOn, setDailyRemindEnabled } from '@/utils/reminder.js'
import { loadWithCache, readPageCache, writePageCache } from '@/utils/pageCache.js'
import { APP_CONFIG_KEY } from '@/utils/wallpaperCache.js'
import { systemShare } from '@/utils/share.js'

const statusBar = getStatusBarPx()
const cfg = ref({})
const user = ref(getUser() || {})
const displayName = ref('')
const gender = ref('')
const ageRange = ref('')
const relationship = ref('')
const denomination = ref('')
const dailyRemindOn = ref(true)
const marketingOn = ref(true)
const lang = ref('en')
const version = ref('1.0.0')
function t(key, params = {}) {
	void lang.value
	return tRaw(key, params)
}
const langSheetOpen = ref(false)
const nameDialogOpen = ref(false)
const nameDraft = ref('')
const choiceSheetOpen = ref(false)
const choiceField = ref('')
const choiceTitle = ref('')
const choiceItems = ref([])

const langOptions = LANG_PICKER_OPTIONS

const GENDER_OPTS = [
	{ code: 'prefer_not', labelKey: 'gender_prefer' },
	{ code: 'female', labelKey: 'gender_female' },
	{ code: 'male', labelKey: 'gender_male' },
	{ code: 'non_binary', labelKey: 'gender_nb' },
]
const AGE_OPTS = [
	{ code: 'u18', labelKey: 'age_u18' },
	{ code: '18-24', labelKey: 'age_1824' },
	{ code: '25-34', labelKey: 'age_2534' },
	{ code: '35-44', labelKey: 'age_3544' },
	{ code: '45-54', labelKey: 'age_4554' },
	{ code: '55+', labelKey: 'age_55' },
]
const REL_OPTS = [
	{ code: 'single', labelKey: 'ob_rel_single' },
	{ code: 'dating', labelKey: 'ob_rel_dating' },
	{ code: 'married', labelKey: 'ob_rel_married' },
]
const DEN_OPTS = [
	{ code: 'none', labelKey: 'ob_den_none' },
	{ code: 'protestant', labelKey: 'ob_den_protestant' },
	{ code: 'catholic', labelKey: 'ob_den_catholic' },
	{ code: 'orthodox', labelKey: 'ob_den_orthodox' },
]
const AGE_ALIAS = {
	'18_24': '18-24',
	'25_34': '25-34',
	'35_44': '35-44',
	'45_54': '45-54',
	'55_plus': '55+',
}

function normalizeLang(raw) {
	const s = String(raw || '').trim().toLowerCase().replace(/_/g, '-')
	if (!s) return ''
	if (UI_LOCALES.includes(s)) return s
	const base = s.split('-')[0]
	return UI_LOCALES.includes(base) ? base : ''
}

function normalizeAge(raw) {
	const s = String(raw || '').trim()
	return AGE_ALIAS[s] || s
}

function syncLangDisplay() {
	let stored = ''
	try {
		stored = getCurrentLanguage() || ''
	} catch (e) {}
	const next =
		normalizeLang(getLocale()) ||
		normalizeLang(stored) ||
		normalizeLang(user.value?.system_lang) ||
		'en'
	lang.value = next
	if (String(stored) !== next) {
		try {
			setCurrentLanguage(next)
		} catch (e) {}
	}
	if (getLocale() !== next) setLocale(next)
}

const langDisplay = computed(() => {
	const code = normalizeLang(lang.value) || 'en'
	return NATIVE_LANG_LABELS[code] || code
})

function optionLabel(opts, code) {
	const hit = opts.find((x) => x.code === code)
	return hit ? t(hit.labelKey) : (code || t('settings_name_empty'))
}
const genderLabel = computed(() => optionLabel(GENDER_OPTS, gender.value))
const ageLabel = computed(() => optionLabel(AGE_OPTS, ageRange.value))
const relationshipLabel = computed(() => optionLabel(REL_OPTS, relationship.value))
const denominationLabel = computed(() => optionLabel(DEN_OPTS, denomination.value))

function cmsSocialUrl(raw) {
	const u = String(raw || '').trim()
	if (!u) return ''
	const compact = u.replace(/\/+$/, '').toLowerCase()
	const dummy = [
		'https://instagram.com/manna',
		'https://www.instagram.com/manna',
		'https://www.tiktok.com/@manna',
		'https://tiktok.com/@manna',
		'https://facebook.com/manna',
		'https://www.facebook.com/manna',
	]
	if (dummy.includes(compact)) return ''
	return u
}

const socialLinks = computed(() => {
	const c = cfg.value || {}
	return [
		{ key: 'instagram', label: 'Instagram', url: cmsSocialUrl(c.url_instagram) },
		{ key: 'tiktok', label: 'TikTok', url: cmsSocialUrl(c.url_tiktok) },
		{ key: 'facebook', label: 'Facebook', url: cmsSocialUrl(c.url_facebook) },
	].filter((s) => s.url)
})

const brandName = computed(() => String(cfg.value.brand_name || t('brand') || 'Manna').trim() || 'Manna')

function displayPublisher(raw) {
	const s = String(raw || '').trim()
	if (!s) return ''
	if (/pending/i.test(s) || /^\[.+\]$/.test(s) || /\{[a-z0-9_]+\}/i.test(s)) return ''
	return s
}

const publisherName = computed(() => (
	displayPublisher(cfg.value.publisher_name) || brandName.value
))
const shareLabel = computed(() => {
	void lang.value
	return cfg.value.support_share_label || tRaw('support_share', { brand: brandName.value })
})
const moreByLabel = computed(() => {
	void lang.value
	return tRaw('support_more_by', { name: publisherName.value })
})
const rateLabel = computed(() => cfg.value.support_rate_label || t('support_rate'))
const versionLine = computed(() => {
	void lang.value
	return tRaw('app_version_line', { brand: brandName.value, version: version.value })
})
const userIdLine = computed(() => {
	void lang.value
	return tRaw('user_id_line', { id: shortUserId(user.value?.user_id) })
})

function shortUserId(raw) {
	const s = String(raw || '').trim()
	if (!s) return '—'
	if (s.length <= 22) return s
	return `${s.slice(0, 7)}...${s.slice(-13)}`
}

function resolveAppVersion() {
	try {
		const info = uni.getSystemInfoSync?.() || {}
		const v = info.appVersion || info.appWgtVersion || info.hostVersion || ''
		if (v) {
			version.value = String(v)
			return
		}
	} catch (e) {}
	// #ifdef APP-PLUS
	try {
		plus.runtime.getProperty(plus.runtime.appid, (inf) => {
			if (inf && (inf.version || inf.versionCode)) {
				version.value = String(inf.version || inf.versionCode)
			}
		})
	} catch (e) {}
	// #endif
}

function applyUser(u) {
	user.value = u || {}
	displayName.value = user.value.display_name || ''
	gender.value = user.value.gender || ''
	ageRange.value = normalizeAge(user.value.age_range || '')
	const answers = user.value.profile_answers || {}
	relationship.value = answers.emotion_status || ''
	denomination.value = answers.denomination_pref || ''
	marketingOn.value = user.value.marketing_opt_in !== false
	syncLangDisplay()
}

/** 先渲染本地缓存，再拉 /auth/me/ 换最新资料（与 account.vue 同模式）。 */
async function refreshUser() {
	applyUser(getUser())
	try {
		const plat = getAppPlatform()
		const res = await apiAuthMe(plat ? { platform: plat } : {}, { skipAuthRetry: true })
		if (res?.results) {
			setUser(res.results)
			applyUser(res.results)
		}
	} catch (e) {}
}

onMounted(async () => {
	resolveAppVersion()
	refreshUser()
	try { dailyRemindOn.value = isDailyRemindOn() } catch (e) {}
	await loadAppConfig().catch(() => {})
})
onShow(() => {
	refreshUser()
	loadAppConfig().catch(() => {})
})
/** 拉取 app-config；失败时保留已有 cfg，不整表清空。 */
async function loadAppConfig() {
	try {
		await loadWithCache(
			APP_CONFIG_KEY,
			async () => (await apiAppConfig()).results || {},
			(results) => {
				if (results && typeof results === 'object') cfg.value = results
			},
		)
	} catch (e) {
		const cached = readPageCache(APP_CONFIG_KEY)
		if (cached && typeof cached === 'object' && !Object.keys(cfg.value || {}).length) {
			cfg.value = cached
		}
	}
}

/** 分享用下载链：现场拉 app-config，接口返回啥用啥；失败再回落内存/缓存。 */
async function resolveShareDownloadUrl() {
	try {
		const res = await apiAppConfig()
		const fresh = (res && res.results) || {}
		if (fresh && typeof fresh === 'object') {
			cfg.value = fresh
			writePageCache(APP_CONFIG_KEY, fresh)
			const href = String(fresh.url_download || '').trim()
			if (href) return href
		}
	} catch (e) {}
	const href = String(cfg.value?.url_download || '').trim()
	if (href) return href
	return String(readPageCache(APP_CONFIG_KEY)?.url_download || '').trim()
}

function back() {
	uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) })
}

function go(url) {
	uni.navigateTo({ url })
}

function pickLang() {
	langSheetOpen.value = true
}

async function onLangSelect({ value }) {
	if (!value) return
	const prev = getLocale()
	const next = setLocale(normalizeLang(value) || 'en')
	lang.value = next
	applyTabBarLocale(t)
	if (next === prev) return
	// 全局语言以服务端 system_lang 为准：上报失败要回滚，别让本机与后台不一致
	const ok = await persistProfile({ system_lang: next })
	if (!ok) {
		setLocale(prev)
		lang.value = prev
		applyTabBarLocale(t)
	}
}

const PROFILE_SAVE_LOADING = {
	showLoading: true,
	loadingMask: true,
	loadingTime: 0,
}

async function persistProfile(patch, requestOpts = {}) {
	try {
		const res = await apiUpdateProfile(patch, requestOpts)
		setUser(res.results)
		user.value = res.results
		return true
	} catch (e) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
		refreshUser()
		return false
	}
}

function openNameDialog() {
	nameDraft.value = displayName.value || ''
	nameDialogOpen.value = true
}

async function onNameDialogConfirm() {
	const next = (nameDraft.value || '').trim()
	const prev = displayName.value
	if (next === prev) return
	displayName.value = next
	const ok = await persistProfile({ display_name: next }, PROFILE_SAVE_LOADING)
	if (ok) uni.showToast({ title: t('saved'), icon: 'none' })
	else displayName.value = prev
}

function openChoice(field) {
	choiceField.value = field
	const map = {
		gender: { title: t('gender'), items: GENDER_OPTS },
		age: { title: t('age'), items: AGE_OPTS },
		relationship: { title: t('relationship_status'), items: REL_OPTS },
		denomination: { title: t('denomination'), items: DEN_OPTS },
	}
	const hit = map[field]
	if (!hit) return
	choiceTitle.value = hit.title
	choiceItems.value = hit.items.map((x) => ({ code: x.code, label: t(x.labelKey) }))
	choiceSheetOpen.value = true
}

async function onChoiceSelect({ value }) {
	if (!value) return
	const field = choiceField.value
	const prev = {
		gender: gender.value,
		age: ageRange.value,
		relationship: relationship.value,
		denomination: denomination.value,
	}
	const patch = {}
	if (field === 'gender') {
		if (value === gender.value) return
		gender.value = value
		patch.gender = value
	} else if (field === 'age') {
		if (value === ageRange.value) return
		ageRange.value = value
		patch.age_range = value
	} else if (field === 'relationship') {
		if (value === relationship.value) return
		relationship.value = value
		patch.emotion_status = value
	} else if (field === 'denomination') {
		if (value === denomination.value) return
		denomination.value = value
		patch.denomination_pref = value
	} else {
		return
	}
	const ok = await persistProfile(patch, PROFILE_SAVE_LOADING)
	if (!ok) {
		gender.value = prev.gender
		ageRange.value = prev.age
		relationship.value = prev.relationship
		denomination.value = prev.denomination
	}
}

function onDailyRemind(e) {
	dailyRemindOn.value = !!e.detail.value
	try { setDailyRemindEnabled(dailyRemindOn.value) } catch (err) {}
}

function onMarketing(e) {
	marketingOn.value = e.detail.value
	persistProfile({ marketing_opt_in: marketingOn.value })
}

function open(url) {
	if (!url) return
	// #ifdef H5
	window.open(url, '_blank')
	// #endif
	// #ifdef APP-PLUS
	plus.runtime.openURL(url)
	// #endif
}

function openSocial(s) {
	if (s.url) {
		open(s.url)
		return
	}
	uni.showToast({ title: t('coming_soon'), icon: 'none' })
}

async function onSupportShare() {
	track('support_action', { action: 'share' })
	// 接口返回啥就分享啥，不拼落地页、不加参数
	const brand = brandName.value
	const href = await resolveShareDownloadUrl()
	if (!href) {
		uni.showToast({ title: t('coming_soon'), icon: 'none' })
		return
	}
	systemShare({ title: brand, summary: brand, href })
}

function onSupportMore() {
	track('support_action', { action: 'more_apps' })
	const url = cfg.value.url_more_apps || cfg.value.url_download || ''
	if (url) {
		open(url)
		return
	}
	uni.showToast({ title: t('coming_soon'), icon: 'none' })
}

function onSupportRate() {
	track('support_action', { action: 'rate' })
	const url = cfg.value.url_rate || cfg.value.url_download || ''
	if (url) {
		open(url)
		return
	}
	uni.showToast({ title: t('coming_soon'), icon: 'none' })
}

function copyUserId() {
	const id = String(user.value.user_id || '')
	if (!id) return
	uni.setClipboardData({ data: id })
}
</script>

<style scoped lang="scss">
@import '../../styles/manna-theme.scss';

.page-wrap {
	min-height: 100vh;
	position: relative;
}

.page {
	min-height: 100vh;
	padding: 24rpx 40rpx 80rpx;
	box-sizing: border-box;
	@include manna-peach-page;
}

.row-hover {
	opacity: 0.72;
}

.nav {
	display: flex;
	align-items: center;
	margin-bottom: 24rpx;
}

.nav__back {
	width: 64rpx;
	height: 64rpx;
	margin-right: 8rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.nav__back-ico {
	width: 48rpx;
	height: 48rpx;
}

.nav__press {
	opacity: 0.7;
}

.nav__title {
	@include manna-nav-title;
}

.section {
	display: block;
	margin: 8rpx 8rpx 16rpx;
	font-family: $manna-font-body;
	font-size: 24rpx;
	color: rgba(33, 33, 33, 0.5);
	letter-spacing: 0.04em;
	text-transform: uppercase;
}

.group {
	@include manna-white-card;
	overflow: hidden;
	margin-bottom: 28rpx;
}

.row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 32rpx 28rpx;
	border-bottom: 1rpx solid rgba(33, 33, 33, 0.06);
}

.row.last,
.group .row:last-child {
	border-bottom: none;
}

.row__lab {
	font-family: $manna-font-body;
	font-size: 30rpx;
	color: $manna-btn-text;
}

.row__trail {
	display: flex;
	flex-direction: row;
	align-items: center;
}

.row__val {
	font-family: $manna-font-body;
	font-size: 26rpx;
	color: rgba(33, 33, 33, 0.5);
	max-width: 320rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.chev {
	width: 32rpx;
	height: 32rpx;
	margin-left: 8rpx;
	flex-shrink: 0;
}

.meta {
	margin-top: 12rpx;
	margin-bottom: 24rpx;
	padding: 24rpx 28rpx;
	background: rgba(255, 255, 255, 0.55);
	border: 2rpx solid rgba(33, 33, 33, 0.08);
	border-radius: 32rpx;
	display: flex;
	flex-direction: row;
	align-items: center;
	box-sizing: border-box;
}

.meta__copy {
	flex: 1;
	display: flex;
	flex-direction: column;
	color: rgba(33, 33, 33, 0.55);
	font-size: 22rpx;
}

.meta__copy text {
	margin-bottom: 6rpx;
}

.meta__ico {
	width: 36rpx;
	height: 36rpx;
	opacity: 0.55;
	margin-left: 16rpx;
}
</style>
