<!--
  设置页：昵称、语言、签到提醒、账号绑定等。
  UI 对齐 Figma 9:1222（圆形返回 + 分组白卡）；业务逻辑不变。
-->
<template>
	<view class="page-wrap">
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="custom-nav">
				<view class="nav-pill" @click="goBack">
					<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
				</view>
				<text class="nav-title" :style="titleStyle">{{ t('settings') }}</text>
				<view class="nav-spacer" />
			</view>
		</view>

		<text class="section-label">{{ t('section_premium') }}</text>
		<view class="card">
			<view class="row last" @click="goVip">
				<text class="row-label">{{ t('manage_subscription') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
		</view>

		<text class="section-label">{{ t('section_about_you') }}</text>
		<view class="card">
			<view class="row" hover-class="row-hover" @click="openNameDialog">
				<text class="row-label">{{ t('settings_name') }}</text>
				<view class="row-trail">
					<text class="val">{{ displayName || t('display_name_empty') }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
			<view class="row" hover-class="row-hover" @click="openChoice('gender')">
				<text class="row-label">{{ t('gender') }}</text>
				<view class="row-trail">
					<text class="val">{{ genderLabel }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
			<view class="row" hover-class="row-hover" @click="openChoice('age')">
				<text class="row-label">{{ t('age') }}</text>
				<view class="row-trail">
					<text class="val">{{ ageLabel }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
			<view class="row" hover-class="row-hover" @click="openChoice('relationship')">
				<text class="row-label">{{ t('relationship_status') }}</text>
				<view class="row-trail">
					<text class="val">{{ relationshipLabel }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
			<view class="row last" hover-class="row-hover" @click="openChoice('denomination')">
				<text class="row-label">{{ t('denomination') }}</text>
				<view class="row-trail">
					<text class="val">{{ denominationLabel }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
		</view>

		<text class="section-label">{{ t('section_make_yours') }}</text>
		<view class="card">
			<view class="row" @click="go('/pagesA/settings/muted')">
				<text class="row-label">{{ t('muted_content') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
			<view class="row" hover-class="row-hover" @click="pickLang">
				<text class="row-label">{{ t('language') }}</text>
				<view class="row-trail">
					<text class="val">{{ langDisplay }}</text>
					<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
				</view>
			</view>
			<view class="row last sound-row">
				<text class="row-label">{{ t('sound') }}</text>
				<slider
					class="sound-slider"
					:value="musicVolume"
					:min="0"
					:max="100"
					:step="1"
					activeColor="#191919"
					backgroundColor="#e4e1da"
					block-color="#191919"
					:block-size="16"
					@changing="onMusicVolume"
					@change="onMusicVolume"
				/>
			</view>
		</view>

		<text class="section-label">{{ t('section_account') }}</text>
		<view class="card">
			<view class="row last" @click="go('/pagesA/settings/account')">
				<text class="row-label">{{ t('login_settings') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
		</view>

		<text class="section-label">{{ t('support_us') }}</text>
		<view class="card">
			<view class="row" @click="onSupportShare">
				<text class="row-label">{{ shareLabel }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
			<view class="row" @click="onSupportMore">
				<text class="row-label">{{ moreByLabel }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
			<view class="row last" @click="onSupportRate">
				<text class="row-label">{{ rateLabel }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
		</view>

		<text class="section-label">{{ t('section_help') }}</text>
		<view class="card">
			<view class="row last" @click="openLegalPage('help', cfg)">
				<text class="row-label">{{ t('legal_help') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
		</view>

		<text v-if="socialLinks.length" class="section-label">{{ t('section_follow') }}</text>
		<view v-if="socialLinks.length" class="card">
			<view
				v-for="(s, i) in socialLinks"
				:key="'follow-' + s.key"
				:class="['row', i === socialLinks.length - 1 ? 'last' : '']"
				@click="openSocial(s)"
			>
				<text class="row-label">{{ s.label }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
		</view>

		<text class="section-label">{{ t('other') }}</text>
		<view class="card">
			<view class="row" @click="openLegalPage('privacy', cfg)">
				<text class="row-label">{{ t('legal_privacy') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
			<view class="row" @click="openLegalPage('terms', cfg)">
				<text class="row-label">{{ t('legal_terms_full') }}</text>
				<image class="chev" src="/static/ui/ico-chevron.svg" mode="aspectFit" />
			</view>
			<!-- <view class="row last">
				<text class="row-label">{{ t('marketing_analytics') }}</text>
				<switch :checked="marketingOn" @change="onMarketing" color="#191919" />
			</view> -->
		</view>

		<view class="meta" @click="copyUserId">
			<view class="meta-copy">
				<text>{{ versionLine }}</text>
				<text>{{ userIdLine }}</text>
			</view>
			<image class="meta-ico" src="/static/ui/copy.png" mode="aspectFit" />
		</view>
	</view>

		<!-- 弹层放在 .page 外，避免 App 内 fixed 被页面容器影响 -->
		<selah-sheet
			v-model:visible="langSheetOpen"
			v-model="lang"
			:title="t('language')"
			:items="langOptions"
			:cancel-text="t('cancel')"
			@select="onLangSelect"
		/>
		<selah-sheet
			v-model:visible="choiceSheetOpen"
			:title="choiceTitle"
			:items="choiceItems"
			:cancel-text="t('cancel')"
			@select="onChoiceSelect"
		/>
		<selah-dialog
			v-model:visible="nameDialogOpen"
			v-model:prompt-value="nameDraft"
			editable
			:title="t('edit_display_name')"
			:placeholder="t('display_name')"
			:confirm-text="t('ok')"
			:cancel-text="t('cancel')"
			@confirm="onNameDialogConfirm"
		/>
		<selah-dialog
			v-model:visible="bindDialogOpen"
			:title="bindDialogTitle"
			:content="bindDialogContent"
			:confirm-text="t('ok') || 'OK'"
			:cancel-text="t('cancel')"
			@confirm="onBindDialogConfirm"
		/>
		<selah-dialog
			v-model:visible="clearAccountOpen"
			:title="t('clear_account')"
			:content="t('clear_account_confirm')"
			:confirm-text="t('clear_account_confirm_btn')"
			:cancel-text="t('cancel')"
			@confirm="onClearAccountConfirm"
		/>
	</view>
</template>

<script setup>
/**
 * 设置：资料、首页音乐音量、语言、签到提醒。
 */
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { apiAppConfig } from '@/api/content.js'
import { apiCheckinSettings } from '@/api/checkin.js'
import { apiUpdateProfile, apiBindOauth, apiLogout } from '@/api/auth.js'
import { loadWithCache, readPageCache, writePageCache } from '@/utils/pageCache.js'
import { APP_CONFIG_KEY } from '@/utils/wallpaperCache.js'
import { getUser, setUser, clearLocalAccount } from '@/utils/session.js'
import { getOrCreateDeviceId } from '@/utils/device.js'
import { getSandboxOauthId } from '@/utils/oauth.js'
import { t, setLocale, getLocale, SUPPORTED } from '@/i18n/index.js'
import { cmsText } from '@/utils/cmsI18n.js'
import { applyTabBarLocale } from '@/utils/tabbar.js'
import { scheduleCheckinReminder, clearCheckinReminder } from '@/utils/reminder.js'
import { safeBack } from '@/utils/nav.js'
import { goVip as navigateVip } from '@/utils/vip.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { useCollapsingTitle } from '@/utils/collapsingTitle.js'
import { openLegalPage } from '@/utils/openLegal.js'
import { systemShare } from '@/utils/share.js'
import { getCurrentLanguage, setCurrentLanguage } from '@/utils/storageKeys.js'
import { getHomeMusicVolume, setHomeMusicVolume } from '@/utils/homeMusic.js'

const statusBarPx = getStatusBarPx()
const { titleStyle } = useCollapsingTitle({
	mode: 'bar',
	statusBarPx,
	fontStartRpx: 40,
	fontEndRpx: 34,
	leftStartPercent: 16,
})

const cfg = ref({})
const user = ref(getUser())
const recordOn = ref(true)
const remindOn = ref(true)
const soundOn = ref(true)
const mutedOn = ref(false)
const musicVolume = ref(getHomeMusicVolume())
const marketingOn = ref(true)
const displayName = ref('')
const gender = ref('')
const ageRange = ref('')
const relationship = ref('')
const denomination = ref('')
const nameDialogOpen = ref(false)
const nameDraft = ref('')
const lang = ref('en')
const version = ref('1.0.0')
const deviceHint = ref('')

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
const langSheetOpen = ref(false)
const choiceSheetOpen = ref(false)
const choiceField = ref('')
const choiceTitle = ref('')
const choiceItems = ref([])
const bindDialogOpen = ref(false)
const bindDialogTitle = ref('')
const bindDialogContent = ref('')
const bindDialogMode = ref('prompt')
const bindProvider = ref('google')
const clearAccountOpen = ref(false)
const clearAccountBusy = ref(false)

const langOptions = computed(() =>
	SUPPORTED.map((code) => ({ code, label: t('lang_' + code) })),
)

const LANG_CODES = SUPPORTED

/** 归一化 zh-CN / en_US → zh / en，避免与选项 code 对不上 */
function normalizeLang(raw) {
	const s = String(raw || '').trim().toLowerCase().replace(/_/g, '-')
	if (!s) return ''
	const ALIAS = { tl: 'fil', tgl: 'fil' }
	const mapped = ALIAS[s] || s
	if (LANG_CODES.includes(mapped)) return mapped
	const base = ALIAS[s.split('-')[0]] || s.split('-')[0]
	return LANG_CODES.includes(base) ? base : ''
}

/** 以当前 i18n 为准，再回落本地存储 / 用户画像 */
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
	// 治好 storage 与 UI 不一致，避免下次再漂
	if (normalizeLang(stored) !== next) {
		try {
			setCurrentLanguage(next)
		} catch (e) {}
	}
}

const langDisplay = computed(() => {
	const code = normalizeLang(lang.value) || 'en'
	const hit = langOptions.value.find((x) => x.code === code)
	return hit ? hit.label : code
})

const GENDER_OPTS = [
	{ code: 'prefer_not', labelKey: 'gender_prefer' },
	{ code: 'female', labelKey: 'gender_female' },
	{ code: 'male', labelKey: 'gender_male' },
	{ code: 'non_binary', labelKey: 'gender_nb' },
]
const AGE_OPTS = [
	{ code: 'u18', labelKey: 'age_u18' },
	{ code: '18_24', labelKey: 'age_1824' },
	{ code: '25_34', labelKey: 'age_2534' },
	{ code: '35_44', labelKey: 'age_3544' },
	{ code: '45_54', labelKey: 'age_4554' },
	{ code: '55_plus', labelKey: 'age_55' },
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

function optionLabel(opts, code) {
	const hit = opts.find((x) => x.code === code)
	return hit ? t(hit.labelKey) : (code || t('display_name_empty'))
}
const genderLabel = computed(() => optionLabel(GENDER_OPTS, gender.value))
const ageLabel = computed(() => optionLabel(AGE_OPTS, ageRange.value))
const relationshipLabel = computed(() => optionLabel(REL_OPTS, relationship.value))
const denominationLabel = computed(() => optionLabel(DEN_OPTS, denomination.value))

/** 社交行：仅展示运营台已配置的 URL。 */
const socialLinks = computed(() => {
	const c = cfg.value || {}
	return [
		{ key: 'instagram', label: 'Instagram', url: c.url_instagram },
		{ key: 'tiktok', label: 'TikTok', url: c.url_tiktok },
		{ key: 'facebook', label: 'Facebook', url: c.url_facebook },
	].filter((s) => String(s.url || '').trim())
})

const brandName = computed(() => String(cfg.value.brand_name || t('brand') || 'Selah').trim() || 'Selah')

/** 发行方展示名：不要用法律主体占位符（如 [Pending legal entity name]） */
function displayPublisher(raw) {
	const s = String(raw || '').trim()
	if (!s) return ''
	if (/pending/i.test(s) || /^\[.+\]$/.test(s)) return ''
	return s
}

const publisherName = computed(() => (
	displayPublisher(cfg.value.publisher_name) || brandName.value
))
const shareLabel = computed(() => cmsText(
	cfg.value.support_share_label,
	'support_share',
	{ brand: brandName.value },
))
const moreByLabel = computed(() => t('support_more_by', { name: publisherName.value }))
const rateLabel = computed(() => cmsText(cfg.value.support_rate_label, 'support_rate'))
const versionLine = computed(() => t('app_version_line', { brand: brandName.value, version: version.value }))
const userIdLine = computed(() => t('user_id_line', { id: shortUserId(user.value?.user_id) }))

function shortUserId(raw) {
	const s = String(raw || '').trim()
	if (!s) return '—'
	if (s.length <= 22) return s
	return `${s.slice(0, 7)}...${s.slice(-13)}`
}

function refreshLocalUserState() {
	user.value = getUser() || {}
	recordOn.value = user.value.checkin_record_enabled !== false
	remindOn.value = !!user.value.checkin_remind_enabled
	soundOn.value = user.value.sound_enabled !== false
	mutedOn.value = !!user.value.muted
	musicVolume.value = getHomeMusicVolume()
	marketingOn.value = user.value.marketing_opt_in !== false
	displayName.value = user.value.display_name || ''
	gender.value = user.value.gender || ''
	ageRange.value = user.value.age_range || ''
	const answers = user.value.profile_answers || {}
	relationship.value = answers.emotion_status || ''
	denomination.value = answers.denomination_pref || ''
	syncLangDisplay()
	const did = getOrCreateDeviceId()
	deviceHint.value = did ? `${did.slice(0, 8)}…` : '—'
}

onShow(() => {
	refreshLocalUserState()
	loadAppConfig().catch(() => {})
})

onMounted(async () => {
	resolveAppVersion()
	refreshLocalUserState()
	await loadAppConfig().catch(() => {})
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

function goBack() {
	safeBack('/pages/profile/profile')
}

function bindOauth(provider) {
	bindProvider.value = provider
	bindDialogMode.value = 'prompt'
	bindDialogTitle.value = provider === 'apple' ? t('bind_apple') : t('bind_google')
	bindDialogContent.value = t('bind_sandbox')
	bindDialogOpen.value = true
}

async function onBindDialogConfirm() {
	const provider = bindProvider.value
	const oauth_id = getSandboxOauthId(provider)
	if (bindDialogMode.value === 'conflict') {
		try {
			const res2 = await apiBindOauth({
				provider,
				oauth_id,
				confirm_switch: true,
			}, { silentBizCodes: [409] })
			if (res2.results.token) uni.setStorageSync('token', res2.results.token)
			setUser(res2.results.user)
			user.value = res2.results.user
			uni.showToast({ title: t('bound'), icon: 'none' })
		} catch (e) {}
		return
	}
	try {
		const res = await apiBindOauth({
			provider,
			oauth_id,
			confirm_switch: false,
		}, { silentBizCodes: [409] })
		setUser(res.results.user)
		user.value = res.results.user
		uni.showToast({ title: t('bound'), icon: 'none' })
	} catch (e) {
		if (e && e.code === 409) {
			bindDialogMode.value = 'conflict'
			bindDialogTitle.value = t('account_exists')
			bindDialogContent.value = e.message || t('bind_conflict_hint')
			bindDialogOpen.value = true
		}
	}
}

async function persistProfile(patch) {
	try {
		const res = await apiUpdateProfile(patch)
		setUser(res.results)
		user.value = res.results
		return true
	} catch (e) {
		uni.showToast({ title: t('request_failed'), icon: 'none' })
		refreshLocalUserState()
		return false
	}
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
		gender.value = value
		patch.gender = value
	} else if (field === 'age') {
		ageRange.value = value
		patch.age_range = value
	} else if (field === 'relationship') {
		relationship.value = value
		patch.emotion_status = value
	} else if (field === 'denomination') {
		denomination.value = value
		patch.denomination_pref = value
	}
	const ok = await persistProfile(patch)
	if (!ok) {
		gender.value = prev.gender
		ageRange.value = prev.age
		relationship.value = prev.relationship
		denomination.value = prev.denomination
	}
}

function openNameDialog() {
	if (nameDialogOpen.value) return
	nameDraft.value = displayName.value || ''
	nameDialogOpen.value = true
}

async function onNameDialogConfirm() {
	const next = (nameDraft.value || '').trim()
	const prev = displayName.value
	displayName.value = next
	const ok = await persistProfile({ display_name: next })
	if (ok) {
		uni.showToast({ title: t('saved'), icon: 'none' })
	} else {
		displayName.value = prev
	}
}

function onMusicVolume(e) {
	const v = Number(e?.detail?.value)
	if (!Number.isFinite(v)) return
	musicVolume.value = v
	setHomeMusicVolume(v)
}

function onMuted(e) {
	mutedOn.value = e.detail.value
	if (mutedOn.value) soundOn.value = false
	persistProfile({ muted: mutedOn.value, sound_enabled: soundOn.value })
}

function onMarketing(e) {
	marketingOn.value = e.detail.value
	persistProfile({ marketing_opt_in: marketingOn.value })
}

function pickLang() {
	if (langSheetOpen.value) return
	langSheetOpen.value = true
}

function onLangSelect({ value }) {
	if (!value) return
	const next = normalizeLang(value) || 'en'
	lang.value = next
	setLocale(next)
	applyTabBarLocale(t)
	persistProfile({ system_lang: next })
}

async function onRecord(e) {
	recordOn.value = e.detail.value
	if (!recordOn.value) {
		remindOn.value = false
		user.value.checkin_record_enabled = false
		user.value.checkin_remind_enabled = false
		setUser(user.value)
		clearCheckinReminder()
	}
	const res = await apiCheckinSettings({
		checkin_record_enabled: recordOn.value,
		checkin_remind_enabled: remindOn.value,
	})
	Object.assign(user.value, res.results)
	user.value.checkin_record_enabled = !!recordOn.value
	user.value.checkin_remind_enabled = !!recordOn.value && !!remindOn.value
	setUser(user.value)
}

async function onRemind(e) {
	remindOn.value = e.detail.value
	const res = await apiCheckinSettings({ checkin_remind_enabled: remindOn.value })
	Object.assign(user.value, res.results)
	user.value.checkin_remind_enabled = !!remindOn.value
	setUser(user.value)
	if (remindOn.value) {
		scheduleCheckinReminder({ enabled: true })
		uni.showToast({ title: t('reminder_on'), icon: 'none' })
	} else {
		clearCheckinReminder()
		uni.showToast({ title: t('reminder_off'), icon: 'none' })
	}
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
	uni.showToast({ title: t('coming_soon') || 'Soon', icon: 'none' })
}

async function shareApp() {
	// 接口返回啥就分享啥，不拼 /legal/download/、不加参数
	const brand = brandName.value
	const href = await resolveShareDownloadUrl()
	if (!href) {
		uni.showToast({ title: t('coming_soon'), icon: 'none' })
		return
	}
	systemShare({
		title: brand,
		summary: brand,
		href,
	})
}

function goVip() {
	navigateVip('settings')
}

function go(url) {
	uni.navigateTo({ url })
}

function goReminders() {
	uni.navigateTo({ url: '/pagesA/reminders/reminders' })
}

function goWidget() {
	uni.navigateTo({ url: '/pagesA/widgets/widgets' })
}

function goIcon() {
	uni.navigateTo({ url: '/pagesA/icons/icons' })
}

function onSupportRate() {
	const url = cfg.value.url_rate || cfg.value.url_download || ''
	if (url) {
		open(url)
		return
	}
	uni.showToast({ title: t('coming_soon'), icon: 'none' })
}

async function onSupportShare() {
	await shareApp()
}

function onSupportMore() {
	const url = cfg.value.url_more_apps || cfg.value.url_download || ''
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

function openClearAccount() {
	if (clearAccountBusy.value || clearAccountOpen.value) return
	clearAccountOpen.value = true
}

async function onClearAccountConfirm() {
	if (clearAccountBusy.value) return
	clearAccountBusy.value = true
	try {
		try {
			await apiLogout()
		} catch (e) {
			/* 本地注销仍继续：网络失败不阻断清会话 */
		}
		const { device_id } = await clearLocalAccount()
		deviceHint.value = device_id ? `${device_id.slice(0, 8)}…` : '—'
		user.value = {}
		uni.showToast({ title: t('clear_account_done'), icon: 'none' })
		uni.reLaunch({ url: '/pagesA/welcome/welcome' })
	} catch (e) {
		clearAccountBusy.value = false
		uni.showToast({ title: e.message || e.msg || 'Failed', icon: 'none' })
	}
}
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

.page-wrap {
	min-height: 100vh;
	position: relative;
}
.page {
	min-height: 100vh;
	padding: 0 32rpx 80rpx;
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
	padding: 0 0 12rpx;
	box-sizing: border-box;
	min-height: 88rpx;
}
.nav-pill {
	@include selah-nav-circle;
	position: relative;
	z-index: 2;
	flex-shrink: 0;
}
.nav-ico {
	width: 48rpx;
	height: 48rpx;
}
.nav-title {
	@include selah-display-title;
}
.nav-spacer {
	width: 88rpx;
	height: 88rpx;
	flex-shrink: 0;
	visibility: hidden;
}
.section-label {
	display: block;
	margin-top: 24rpx;
	margin-bottom: 8rpx;
	padding: 16rpx 16rpx 8rpx;
	font-size: 28rpx;
	color: $selah-ink;
	opacity: 0.6;
}
.card {
	background: $selah-card;
	border-radius: $selah-radius-card;
	overflow: hidden;
}
.row {
	display: flex;
	flex-direction: row;
	justify-content: space-between;
	align-items: center;
	min-height: 112rpx;
	padding: 32rpx;
	border-bottom: 1rpx solid $selah-divider;
	box-sizing: border-box;
}
.row-hover {
	background: rgba(25, 25, 25, 0.04);
}
.row.last,
.card .row:last-child {
	border-bottom: none;
}
.row.tip {
	display: block;
	font-size: 24rpx;
	color: #8a8a8a;
	line-height: 1.4;
	background: #fafafa;
}
.row-label {
	font-size: 32rpx;
	color: #191919;
	flex-shrink: 0;
}
.sound-row {
	gap: 24rpx;
}
.sound-slider {
	flex: 1;
	margin: 0;
}
.row-trail {
	display: flex;
	flex-direction: row;
	align-items: center;
}
.chev {
	width: 48rpx;
	height: 48rpx;
	margin-left: 8rpx;
	flex-shrink: 0;
}
.val {
	color: #8a8a8a;
	font-size: 28rpx;
	max-width: 360rpx;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.val.tiny {
	font-size: 22rpx;
	max-width: 360rpx;
	overflow: hidden;
}
.meta {
	margin-top: 40rpx;
	padding: 24rpx 32rpx;
	background: #f2f1ed;
	border: 2rpx solid rgba(25, 25, 25, 0.1);
	border-radius: 32rpx;
	display: flex;
	flex-direction: row;
	align-items: center;
	box-sizing: border-box;
}
.meta-copy {
	flex: 1;
	display: flex;
	flex-direction: column;
	color: #5c5c5c;
	font-size: 22rpx;
}
.meta-copy text {
	margin-bottom: 6rpx;
}
.meta-ico {
	width: 36rpx;
	height: 36rpx;
	opacity: 0.55;
	margin-left: 16rpx;
}
.clear-account {
	margin-top: 48rpx;
	padding-bottom: 48rpx;
	display: flex;
	flex-direction: column;
	align-items: stretch;
}
.clear-account-btn {
	min-height: 96rpx;
	padding: 28rpx 32rpx;
	border-radius: 32rpx;
	border: 2rpx solid rgba(180, 48, 48, 0.35);
	background: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	box-sizing: border-box;
}
.clear-account-btn-text {
	font-size: 30rpx;
	color: #b43030;
	font-weight: 600;
}
.clear-account-hint {
	margin-top: 16rpx;
	padding: 0 8rpx;
	font-size: 22rpx;
	line-height: 1.4;
	color: #8a8a8a;
	text-align: center;
}
</style>
