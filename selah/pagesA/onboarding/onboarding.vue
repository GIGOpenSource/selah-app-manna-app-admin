<!--
  新用户 Onboarding：按 sort_order 逐步答题或跳过；支持 2.0 扩展题与多选。
-->
<template>
	<view class="ob">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="top-bar">
			<text class="skip" :class="{ disabled: busy }" @click="skip">{{ t('skip') }}</text>
		</view>
		<text class="title">{{ current.title }}</text>
		</view>
		<view v-if="!isBasicStep" class="opts">
			<view
				v-for="o in current.options || []"
				:key="o.value"
				:class="['opt', isSelected(o.value) ? 'on' : '']"
				@click="select(o.value)"
			>
				<text class="opt-label">{{ o.label }}</text>
				<image
					class="radio-img"
					:src="isSelected(o.value) ? '/static/ui/radio-on.svg' : '/static/ui/radio-off.svg'"
					mode="aspectFit"
				/>
			</view>
		</view>
		<view v-if="isBasicStep" class="basic">
			<input v-model="form.display_name" class="inp" :placeholder="t('call_me')" />
			<text class="sub">{{ t('gender_opt') }}</text>
			<view class="opts">
				<view
					v-for="g in genderOpts"
					:key="g.value"
					:class="['opt', form.gender === g.value ? 'on' : '']"
					@click="form.gender = g.value"
				>
					<text class="opt-label">{{ g.label }}</text>
					<image
						class="radio-img"
						:src="form.gender === g.value ? '/static/ui/radio-on.svg' : '/static/ui/radio-off.svg'"
						mode="aspectFit"
					/>
				</view>
			</view>
			<text class="sub">{{ t('age_opt') }}</text>
			<view class="opts">
				<view
					v-for="a in ageOpts"
					:key="a.value"
					:class="['opt', form.age_range === a.value ? 'on' : '']"
					@click="form.age_range = a.value"
				>
					<text class="opt-label">{{ a.label }}</text>
					<image
						class="radio-img"
						:src="form.age_range === a.value ? '/static/ui/radio-on.svg' : '/static/ui/radio-off.svg'"
						mode="aspectFit"
					/>
				</view>
			</view>
		</view>
		<view class="footer">
			<view class="cta" :class="{ disabled: busy }" @click="next">
				<text class="cta-text">{{ isLast ? t('start') : t('next') }}</text>
			</view>
		</view>
	</view>
</template>

<script setup>
/**
 * Onboarding 问卷：多题选择、basic_info 本地表单、完成/跳过；2.0 answers 对象提交。
 */
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
	apiOnboardingQuestions,
	apiOnboardingComplete,
	apiOnboardingSkip,
	apiAppConfig,
} from '@/api/content.js'
import { setUser } from '@/utils/session.js'
import { track } from '@/utils/analytics.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { loadWithCache } from '@/utils/pageCache.js'
import { ONBOARDING_Q_KEY, APP_CONFIG_KEY } from '@/utils/wallpaperCache.js'
import {
	appConfigRevision,
	onboardingRevision,
	unwrapOnboardingCache,
} from '@/utils/bootstrap.js'
import { runBusy } from '@/utils/tapLock.js'

/** Selah 2.0 扩展题 key（与后端 ONBOARDING_KEYS_2_0 对齐） */
const KEYS_2_0 = [
	'acquisition_channel',
	'emotion_status',
	'faith_transition',
	'scripture_familiarity',
	'faith_practice',
	'closeness_to_god',
	'denomination_pref',
	'habit_help_style',
	'relationship_with_god',
	'recent_feeling',
	'current_struggle',
	'current_goal',
]
const KEYS_2_0_SET = new Set(KEYS_2_0)
const LEGACY_MULTI = new Set(['interest_tags'])

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const busy = ref(false)
const questions = ref([])
const idx = ref(0)
const form = ref({
	faith_type: '',
	prayer_frequency: '',
	interest_tags: [],
	display_name: '',
	gender: '',
	age_range: '',
})
const answers = ref({})

const GENDER_I18N = {
	prefer_not: 'gender_prefer',
	female: 'gender_female',
	male: 'gender_male',
	non_binary: 'gender_nb',
}
const AGE_I18N = {
	u18: 'age_u18',
	'18-24': 'age_1824',
	'25-34': 'age_2534',
	'35-44': 'age_3544',
	'45-54': 'age_4554',
	'55+': 'age_55',
}
const FALLBACK_GENDERS = []
const FALLBACK_AGES = []

const current = computed(() => questions.value[idx.value] || { title: '', options: [], question_key: '' })
const stepKey = computed(() => current.value.question_key)
const isBasicStep = computed(() => stepKey.value === 'basic_info')
const isLast = computed(() => idx.value >= questions.value.length - 1)

const isMultiStep = computed(() => {
	const key = stepKey.value
	if (LEGACY_MULTI.has(key)) return true
	const opts = current.value.options || []
	return opts.some((o) => o.type === 'multi')
})

const genderOpts = computed(() => {
	const meta = current.value.meta?.genders || []
	const list = meta.length ? meta : FALLBACK_GENDERS
	return list.map((g) => ({
		value: g.value,
		label: GENDER_I18N[g.value] ? t(GENDER_I18N[g.value]) : (g.label || g.value),
	}))
})
const ageOpts = computed(() => {
	const meta = current.value.meta?.age_ranges || []
	const list = meta.length ? meta : FALLBACK_AGES
	return list.map((a) => ({
		value: a.value,
		label: AGE_I18N[a.value] ? t(AGE_I18N[a.value]) : (a.label || a.value),
	}))
})

function ensureAnswerSlot(key, multi) {
	if (key === 'basic_info') return
	if (answers.value[key] === undefined) {
		answers.value[key] = multi ? [] : ''
	}
	if (form.value[key] === undefined) {
		form.value[key] = multi ? [] : ''
	}
}

function isSelected(v) {
	const key = stepKey.value
	if (isMultiStep.value) {
		const arr = answers.value[key] || form.value[key] || []
		return Array.isArray(arr) && arr.includes(v)
	}
	return (answers.value[key] ?? form.value[key]) === v
}

function select(v) {
	const key = stepKey.value
	ensureAnswerSlot(key, isMultiStep.value)
	if (isMultiStep.value) {
		const arr = Array.isArray(answers.value[key]) ? [...answers.value[key]] : []
		const i = arr.indexOf(v)
		if (i >= 0) arr.splice(i, 1)
		else arr.push(v)
		answers.value[key] = arr
		form.value[key] = arr
		track('onboarding_step_answer', { question_key: key })
		if (key === 'interest_tags') {
			track('onboarding_interest_select', { interest_tags: arr.join(',') })
		}
	} else {
		answers.value[key] = v
		form.value[key] = v
		track('onboarding_step_answer', { question_key: key })
		if (key === 'faith_type') track('onboarding_faith_select', { faith_type: v })
		if (key === 'prayer_frequency') {
			track('onboarding_prayer_frequency_select', { prayer_frequency: v })
		}
	}
}

function canAdvance() {
	const key = stepKey.value
	if (key === 'basic_info') return true
	if (isMultiStep.value) {
		const arr = answers.value[key] || form.value[key] || []
		return Array.isArray(arr) && arr.length > 0
	}
	const val = answers.value[key] ?? form.value[key]
	return !!val
}

function buildPayload() {
	const payload = {
		faith_type: form.value.faith_type || answers.value.faith_type || '',
		prayer_frequency: form.value.prayer_frequency || answers.value.prayer_frequency || '',
		interest_tags: form.value.interest_tags || answers.value.interest_tags || [],
		display_name: form.value.display_name || '',
		gender: form.value.gender || '',
		age_range: form.value.age_range || '',
		answers: { ...answers.value },
	}
	if (payload.display_name || payload.gender || payload.age_range) {
		payload.answers.basic_info = {
			display_name: payload.display_name,
			gender: payload.gender,
			age_range: payload.age_range,
		}
	}
	return payload
}

async function next() {
	if (busy.value) return
	if (!canAdvance()) {
		uni.showToast({ title: t('choose_option'), icon: 'none' })
		return
	}
	await runBusy(async () => {
		if (isLast.value) {
			track('onboarding_basic_info', {
				gender: form.value.gender || '',
				age_group: form.value.age_range || '',
			})
			const payload = buildPayload()
			const res = await apiOnboardingComplete(payload)
			setUser(res.results)
			track('onboarding_complete', {
				faith_type: payload.faith_type,
				prayer_frequency: payload.prayer_frequency,
				interest_tags: (payload.interest_tags || []).join(','),
			})
			uni.reLaunch({ url: '/pages/home/home' })
			return
		}
		idx.value += 1
		const n = questions.value[idx.value] || {}
		ensureAnswerSlot(n.question_key, (n.options || []).some((o) => o.type === 'multi') || LEGACY_MULTI.has(n.question_key))
		track('onboarding_step_view', {
			question_key: n.question_key || String(idx.value),
			step_id: n.question_key || String(idx.value),
			step_name: n.title || '',
		})
	}, { busy, cooldownMs: 300 })
}

async function skip() {
	if (busy.value) return
	await runBusy(async () => {
		const cur = questions.value[idx.value] || {}
		const res = await apiOnboardingSkip()
		setUser(res.results)
		track('onboarding_skip', {
			step_id: cur.question_key || String(idx.value),
			step_name: cur.title || '',
		})
		uni.reLaunch({ url: '/pages/home/home' })
	}, { busy, cooldownMs: 800 })
}

function normalizeQuestions(list) {
	return (list || []).map((q) => {
		if (q.question_key === 'display_basics') {
			return { ...q, question_key: 'basic_info' }
		}
		return q
	})
}

function sortAndFilter(rows, featuresEnabled) {
	let list = normalizeQuestions(rows || [])
	list = list.slice().sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
	if (featuresEnabled === false) {
		list = list.filter((q) => !KEYS_2_0_SET.has(q.question_key))
	}
	return list
}

onMounted(async () => {
	let featuresEnabled = true
	try {
		await loadWithCache(
			APP_CONFIG_KEY,
			async () => (await apiAppConfig()).results || {},
			(cfg) => {
				if (cfg && cfg.selah_2_0_features_enabled === false) featuresEnabled = false
			},
			{ getRevision: appConfigRevision },
		)
	} catch (e) {}

	await loadWithCache(
		ONBOARDING_Q_KEY,
		async () => {
			const res = await apiOnboardingQuestions()
			const questions = res.results || []
			return {
				revision: (res.meta && res.meta.revision) || '',
				questions,
			}
		},
		(data) => {
			const wrapped = unwrapOnboardingCache(data)
			questions.value = sortAndFilter(wrapped.questions || [], featuresEnabled)
		},
		{ getRevision: onboardingRevision },
	)
	const n = questions.value[0] || {}
	ensureAnswerSlot(
		n.question_key,
		(n.options || []).some((o) => o.type === 'multi') || LEGACY_MULTI.has(n.question_key),
	)
	track('onboarding_step_view', {
		question_key: n.question_key || '0',
		step_id: n.question_key || '0',
		step_name: n.title || '',
	})
})
</script>

<style scoped lang="scss">
@import '@/styles/selah-theme.scss';

.ob {
	min-height: 100vh;
	padding: 0 32rpx 80rpx;
	box-sizing: border-box;
	background: #f5f5f5;
	color: #191919;
}
.page-head {
	position: sticky;
	top: 0;
	z-index: 100;
}
.head-glass {
	position: absolute;
	top: 0;
	bottom: 0;
	left: 50%;
	width: 100vw;
	margin-left: -50vw;
	z-index: 0;
	pointer-events: none;
	-webkit-backdrop-filter: blur(32rpx) saturate(1.2);
	backdrop-filter: blur(32rpx) saturate(1.2);
	background-color: transparent;
	background-image: linear-gradient(
		180deg,
		rgba(245, 245, 245, 0.94) 0%,
		rgba(245, 245, 245, 0.82) 55%,
		rgba(245, 245, 245, 0.35) 82%,
		rgba(245, 245, 245, 0) 100%
	);
	-webkit-mask-image: linear-gradient(
		180deg,
		#000 0%,
		#000 48%,
		rgba(0, 0, 0, 0.45) 75%,
		transparent 100%
	);
	mask-image: linear-gradient(
		180deg,
		#000 0%,
		#000 48%,
		rgba(0, 0, 0, 0.45) 75%,
		transparent 100%
	);
}
.top-bar {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: row;
	justify-content: flex-start;
	align-items: center;
	padding-bottom: 20rpx;
	min-height: 88rpx;
	box-sizing: border-box;
}
.skip {
	font-size: 30rpx;
	color: rgba(25, 25, 25, 0.45);
	padding: 16rpx 8rpx;
}
.skip.disabled {
	opacity: 0.4;
	pointer-events: none;
}
.title {
	position: relative;
	z-index: 1;
	display: block;
	font-family: $selah-font-display;
	font-size: 48rpx;
	font-weight: 700;
	text-align: center;
	line-height: 1.3;
	padding: 24rpx 56rpx 48rpx;
	color: #191919;
}
.opts {
	width: 100%;
}
.opt {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	padding: 32rpx;
	margin-bottom: 16rpx;
	background: #ffffff;
	border-radius: 32rpx;
	border: 2rpx solid transparent;
	box-shadow: 0 8rpx 28rpx rgba(25, 25, 25, 0.06);
	box-sizing: border-box;
}
.opt.on {
	border-color: rgba(25, 25, 25, 0.12);
}
.opt-label {
	font-size: 32rpx;
	color: #191919;
	flex: 1;
	padding-right: 16rpx;
}
.radio-img {
	width: 48rpx;
	height: 48rpx;
	flex-shrink: 0;
}
.sub {
	display: block;
	color: #5c5c5c;
	font-size: 26rpx;
	margin: 12rpx 0;
}
.inp {
	background: #ffffff;
	padding: 28rpx 32rpx;
	border-radius: 32rpx;
	margin-bottom: 16rpx;
	color: #191919;
	font-size: 32rpx;
}
.footer {
	margin-top: 48rpx;
	padding-bottom: 40rpx;
}
.cta {
	height: 96rpx;
	border-radius: 32rpx;
	background: #191919;
	display: flex;
	align-items: center;
	justify-content: center;
}
.cta.disabled {
	opacity: 0.55;
	pointer-events: none;
}
.cta-text {
	color: #ffffff;
	font-size: 32rpx;
	font-weight: 600;
}
</style>
