/**
 * Onboarding 题干/选项：按 question_key + option value 映射到 i18n。
 * 包内 bootstrap / 接口若仍返回英文，非英语言下也能完整展示。
 */

const TITLE_KEYS = {
	faith_type: 'ob_q_faith_type',
	prayer_frequency: 'ob_q_prayer_frequency',
	interest_tags: 'ob_q_interest_tags',
	basic_info: 'ob_q_basic_info',
	display_basics: 'ob_q_basic_info',
	acquisition_channel: 'ob_q_acquisition_channel',
	emotion_status: 'ob_q_emotion_status',
	faith_transition: 'ob_q_faith_transition',
	scripture_familiarity: 'ob_q_scripture_familiarity',
	faith_practice: 'ob_q_faith_practice',
	closeness_to_god: 'ob_q_closeness_to_god',
	denomination_pref: 'ob_q_denomination_pref',
	habit_help_style: 'ob_q_habit_help_style',
	relationship_with_god: 'ob_q_relationship_with_god',
	recent_feeling: 'ob_q_recent_feeling',
	current_struggle: 'ob_q_current_struggle',
	current_goal: 'ob_q_current_goal',
}

/** question_key → value → i18n key */
const OPTION_KEYS = {
	faith_type: {
		new: 'ob_faith_new',
		old: 'ob_faith_old',
		other: 'ob_opt_other',
		learning: 'ob_faith_learning',
	},
	prayer_frequency: {
		daily: 'ob_pray_daily',
		weekly: 'ob_pray_weekly',
		occasionally: 'ob_pray_occasionally',
		just_started: 'ob_pray_just_started',
	},
	interest_tags: {
		prayer: 'ob_tag_prayer',
		Prayer: 'ob_tag_prayer',
		family: 'ob_tag_family',
		Family: 'ob_tag_family',
		anxiety: 'ob_tag_anxiety',
		'Anxiety Relief': 'ob_tag_anxiety',
		gratitude: 'ob_tag_gratitude',
		Gratitude: 'ob_tag_gratitude',
		courage: 'ob_tag_courage',
		Courage: 'ob_tag_courage',
		work: 'ob_tag_work',
		'Work & Purpose': 'ob_tag_work',
		peace: 'ob_tag_peace',
		Peace: 'ob_tag_peace',
		hope: 'ob_tag_hope',
		Hope: 'ob_tag_hope',
		relationships: 'ob_tag_relationships',
		Relationships: 'ob_tag_relationships',
		healing: 'ob_tag_healing',
		Healing: 'ob_tag_healing',
		Faith: 'ob_tag_faith',
		Strength: 'ob_tag_strength',
		Love: 'ob_tag_love',
		Guidance: 'ob_tag_guidance',
		Growth: 'ob_tag_growth',
		'Self-Worth': 'ob_tag_self_worth',
	},
	acquisition_channel: {
		tiktok: 'ob_ch_tiktok',
		instagram: 'ob_ch_instagram',
		friend: 'ob_ch_friend',
		search: 'ob_ch_search',
		store: 'ob_ch_store',
		other: 'ob_opt_other',
	},
	emotion_status: {
		single: 'ob_rel_single',
		dating: 'ob_rel_dating',
		married: 'ob_rel_married',
		prefer_not: 'gender_prefer',
	},
	faith_transition: {
		growing: 'ob_ft_growing',
		returning: 'ob_ft_returning',
		exploring: 'ob_ft_exploring',
		steady: 'ob_ft_steady',
	},
	scripture_familiarity: {
		new: 'ob_sf_new',
		some: 'ob_sf_some',
		deep: 'ob_sf_deep',
	},
	faith_practice: {
		prayer: 'ob_fp_prayer',
		study: 'ob_fp_study',
		community: 'ob_fp_community',
		other: 'ob_opt_other',
	},
	closeness_to_god: {
		close: 'ob_cg_close',
		seeking: 'ob_cg_seeking',
		distant: 'ob_cg_distant',
	},
	denomination_pref: {
		none: 'ob_den_none',
		protestant: 'ob_den_protestant',
		catholic: 'ob_den_catholic',
		orthodox: 'ob_den_orthodox',
		other: 'ob_opt_other',
	},
	habit_help_style: {
		reminders: 'ob_hh_reminders',
		streaks: 'ob_hh_streaks',
		community: 'ob_hh_community',
		quiet: 'ob_hh_quiet',
	},
	relationship_with_god: {
		friend: 'ob_rg_friend',
		father: 'ob_rg_father',
		guide: 'ob_rg_guide',
		mystery: 'ob_rg_mystery',
	},
	recent_feeling: {
		peaceful: 'ob_feel_peaceful',
		anxious: 'ob_feel_anxious',
		grateful: 'ob_feel_grateful',
		tired: 'ob_feel_tired',
		hopeful: 'ob_feel_hopeful',
	},
	current_struggle: {
		anxiety: 'ob_st_anxiety',
		loneliness: 'ob_st_loneliness',
		work: 'ob_st_work',
		family: 'ob_st_family',
		faith: 'ob_st_faith',
	},
	current_goal: {
		peace: 'ob_goal_peace',
		prayer: 'ob_goal_prayer',
		habits: 'ob_goal_habits',
		healing: 'ob_goal_healing',
		purpose: 'ob_goal_purpose',
	},
}

function tr(t, key, fallback) {
	if (!key) return fallback
	const v = t(key)
	if (!v || v === key) return fallback
	return v
}

/**
 * @param {object} q 单题
 * @param {(k: string) => string} t vue-i18n t
 * @returns {object} 本地化后的题（不改原对象）
 */
export function localizeOnboardingQuestion(q, t) {
	if (!q || typeof q !== 'object') return q
	const key = q.question_key || ''
	const titleKey = TITLE_KEYS[key]
	const title = tr(t, titleKey, q.title || '')
	const optMap = OPTION_KEYS[key] || {}
	const options = (q.options || []).map((o) => {
		const labelKey = optMap[o.value]
		return {
			...o,
			label: tr(t, labelKey, o.label || o.value || ''),
		}
	})
	return { ...q, title, options }
}
