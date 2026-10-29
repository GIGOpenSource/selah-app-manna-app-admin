/**
 * Explore / Follow 共用目录分组：按类型、按译本、主题分类。
 * 锁定主题留在原分组（右侧锁标），不再拆到单独 VIP 栏。
 */

import { cmsLabel } from '@/utils/cmsI18n.js'

export const FALLBACK_BIBLE_VERSIONS = [
	{ code: 'niv', title: 'New International Version' },
	{ code: 'esv', title: 'English Standard Version' },
	{ code: 'kjv', title: 'King James Version' },
]

const ICON = '/static/ui/explore/'

const VERSION_TITLES = {
	niv: 'New International Version',
	esv: 'English Standard Version',
	kjv: 'King James Version',
	nlt: 'New Living Translation',
	web: 'World English Bible',
	nasb: 'New American Standard Bible',
	csb: 'Christian Standard Bible',
	nkjv: 'New King James Version',
}

export function isBibleTopic(topic) {
	const slug = String(topic?.slug || '').toLowerCase().replace(/-/g, '_')
	if (slug === 'bible_verses' || slug === 'bible') return true
	const name = String(topic?.name || '').toLowerCase()
	const cat = String(topic?.category || '').toLowerCase()
	return (
		name.includes('bible')
		|| cat.includes('bible')
		|| name.includes('圣经')
		|| cat.includes('圣经')
		|| name.includes('聖書')
		|| name.includes('성경')
		|| name.includes('versículo')
		|| name.includes('versiculo')
		|| name.includes('verset')
		|| name.includes('bibel')
		|| name.includes('библ')
		|| name.includes('talata')
		|| name.includes('versett')
		|| name.includes('كتاب')
		|| name.includes('إنجيل')
		|| name.includes('آية')
		|| cat.includes('كتاب')
	)
}

export function normalizeTranslations(raw) {
	const rows = Array.isArray(raw) ? raw : []
	const out = rows
		.map((r) => ({
			code: String(r.code || r.id || '').trim(),
			title: String(r.title || r.name || r.code || '').trim(),
		}))
		.filter((r) => r.code)
	return out.length ? out : FALLBACK_BIBLE_VERSIONS
}

function nameIs(topic, ...words) {
	const n = String(topic?.name || '').trim().toLowerCase()
	const slug = String(topic?.slug || '').trim().toLowerCase().replace(/-/g, '_')
	const cat = String(topic?.category || '').trim().toLowerCase()
	return words.some((w) => {
		const forms = [w, `${w}s`, String(w).replace(/-/g, '_')]
		return forms.some((f) => n === f || slug === f || cat === f || n.includes(f) || slug.includes(f))
	})
}

function topicBySlug(topics, ...slugs) {
	const want = new Set(slugs.map((s) => String(s).toLowerCase().replace(/-/g, '_')))
	return (topics || []).find((x) => want.has(String(x?.slug || '').toLowerCase().replace(/-/g, '_'))) || null
}

function versionTitle(tr, t) {
	const code = String(tr.code || '').toLowerCase()
	const key = 'bible_ver_' + code
	if (typeof t === 'function') {
		const localized = String(t(key) || '')
		if (localized && localized !== key) return localized
	}
	const title = String(tr.title || '')
	const mapped = VERSION_TITLES[code]
	if (mapped && (title.length <= 5 || title.toUpperCase() === code.toUpperCase())) return mapped
	return cmsLabel(title || mapped || String(tr.code || '').toUpperCase())
}

export function iconForItem(item) {
	if (item?.icon) return item.icon
	const n = String(item?.name || item?.slug || '').toLowerCase()
	const target = item?.target || ''
	if (target === 'bible' || target === 'bible-version' || n.includes('bible') || n.includes('version')) {
		return ICON + 'ico-book.svg'
	}
  if (n.includes('prayer') || n.includes('祷告') || n.includes('祈祷')) return ICON + 'ico-hands.svg'
	if (n.includes('quote') || n.includes('语录')) return ICON + 'ico-quote.svg'
	if (n.includes('affirm') || n.includes('肯定')) return ICON + 'ico-bubble.svg'
	if (n.includes('love') || n === '爱' || n === '愛') return ICON + 'ico-heart.svg'
	if (n.includes('hope') || n.includes('盼望')) return ICON + 'ico-anchor.svg'
	if (n.includes('peace') || n.includes('inner') || n.includes('平安')) return ICON + 'ico-eye.svg'
	if (n.includes('heal') || n.includes('医治')) return ICON + 'ico-heart.svg'
	if (n.includes('grief') || n.includes('哀伤') || n.includes('悲伤')) return ICON + 'ico-cloud.svg'
	if (n.includes('gratitude') || n.includes('grateful') || n.includes('感恩')) return ICON + 'ico-leaf.svg'
	if (n.includes('kind') || n.includes('良善')) return ICON + 'ico-hands.svg'
	if (n.includes('bless') || n.includes('蒙福')) return ICON + 'ico-cup.svg'
	if (n.includes('uplift') || n.includes('鼓舞')) return ICON + 'ico-sun.svg'
	if (n.includes('mental') || n.includes('心理') || n.includes('心志')) return ICON + 'ico-mind.svg'
	return ICON + 'ico-spark.svg'
}

function withIcon(row) {
	return { ...row, icon: iconForItem(row) }
}

export function buildExploreGroups({ t, topics = [], translations = [], lockVersions = false }) {
	const bibleTopic = topicBySlug(topics, 'bible_verses', 'bible') || topics.find(isBibleTopic) || null
	const bibleFollowed = !!bibleTopic?.followed
	const usedIds = new Set()
	if (bibleTopic?.id) usedIds.add(bibleTopic.id)

	const typeDefs = [
		{
			key: 'bible-verses',
			slug: 'bible-verses',
			name: t('bible_verses'),
			target: 'bible',
			icon: ICON + 'ico-book.svg',
			topic: bibleTopic,
			locked: !!bibleTopic?.locked,
		},
		{
			key: 'prayers',
			slug: 'prayers',
			name: t('prayers'),
			target: 'topic',
			icon: ICON + 'ico-hands.svg',
			topic: topicBySlug(topics, 'prayers', 'prayer') || topics.find((x) => nameIs(
				x, 'prayer', 'prayers', '祷告', '祈祷', 'oración', 'oracion', 'oraciones',
				'orações', 'oracao', '祈り', '기도',
				'prière', 'prieres', 'prières', 'gebet', 'gebete',
				'panalangin', 'preghier', 'preghiere', 'молитв', 'молитвы',
				'صلاة', 'صلوات',
			)) || null,
		},
		{
			key: 'quotes',
			slug: 'quotes',
			name: t('quotes_type'),
			target: 'topic',
			icon: ICON + 'ico-quote.svg',
			topic: topicBySlug(topics, 'quotes', 'quote') || topics.find((x) => nameIs(
				x, 'quote', 'quotes', '语录', 'citas', 'citações', 'citacoes', '引用', '인용',
				'citation', 'citations', 'zitat', 'zitate',
				'sipi', 'citazion', 'citazioni', 'цитат', 'цитаты',
				'اقتباس', 'اقتباسات',
			)) || null,
		},
		{
			key: 'affirmations',
			slug: 'affirmations',
			name: t('content_affirmations'),
			target: 'topic',
			icon: ICON + 'ico-bubble.svg',
			topic: topicBySlug(topics, 'affirmations', 'affirmation') || topics.find((x) => nameIs(
				x, 'affirmation', 'affirmations', '肯定语', 'afirmaciones', 'afirmações',
				'afirmacoes', 'アファメーション', '확언',
				'afirmasyon', 'affermazion', 'affermazioni',
				'аффирмац', 'аффирмации', 'تأكيد', 'تأكيدات',
			)) || null,
		},
	]

	const typeItems = typeDefs.map((def) => {
		const topic = def.topic
		if (topic?.id) usedIds.add(topic.id)
		const locked = def.locked != null ? def.locked : (topic ? !!topic.locked : true)
		return withIcon({
			key: def.key,
			id: topic?.id || 0,
			slug: def.slug,
			name: def.name,
			locked,
			followed: !!topic?.followed,
			target: def.target,
			icon: def.icon,
			raw: topic,
		})
	})

	const versionItems = normalizeTranslations(translations).map((tr) => withIcon({
		key: 'bv-' + tr.code,
		id: bibleTopic?.id || 0,
		slug: tr.code.toLowerCase(),
		name: versionTitle(tr, t),
		locked: !!lockVersions,
		followed: bibleFollowed,
		target: 'bible-version',
		version: tr.code,
		icon: ICON + 'ico-book.svg',
		raw: bibleTopic,
	}))

	const CAT_KEYS = [
		{
			key: 'draw_near',
			i18n: 'explore_cat_draw_near',
			aliases: [
				'draw near to god', 'draw_near',
				'亲近神', 'acercarse a dios', 'aproximar-se de deus',
				'神に近づく', '하나님께 가까이',
				'اقترب من الله',
				'приблизьтесь к богу',
				'approche de dieu', 'rapprochez-vous de dieu',
				'gott nahe kommen', 'gott näherkommen',
				'lumapit sa diyos',
				'avvicinati a dio',
			],
		},
		{
			key: 'health',
			i18n: 'explore_cat_health',
			aliases: [
				'health and well-being', 'health',
				'健康与身心', 'salud y bienestar', 'saúde e bem-estar',
				'健康とウェルビーイング', '건강과 웰빙',
				'الصحة والعافية',
				'здоровье и благополучие',
				'santé et bien-être',
				'gesundheit und wohlbefinden',
				'kalusugan at kaginhawahan', 'kalusugan at kagalingan',
				'salute e benessere',
			],
		},
		{
			key: 'journey',
			i18n: 'explore_cat_journey',
			aliases: [
				'light for your journey', 'journey',
				'旅途之光', 'luz para tu camino', 'luz para a jornada',
				'旅路の光', '여정을 비추는 빛',
				'نور لرحلتك',
				'свет на твоём пути', 'свет на вашем пути',
				'lumière pour ton chemin', 'lumière pour votre chemin',
				'licht für deinen weg',
				'liwanag sa iyong lakbay', 'liwanag sa iyong paglalakbay',
				'luce per il tuo cammino',
			],
		},
	]

	function catMeta(raw) {
		const s = String(raw || '').trim().toLowerCase()
		return CAT_KEYS.find((row) => row.aliases.includes(s)) || null
	}

	function catTitle(raw) {
		const meta = catMeta(raw)
		if (meta) {
			const loc = String(t(meta.i18n) || '')
			if (loc && loc !== meta.i18n) return loc
		}
		return cmsLabel(String(raw || '').trim()) || t('themes')
	}

	const TOPIC_I18N = {
		Faith: 'topic_faith', 信仰: 'topic_faith', Fe: 'topic_faith', Fé: 'topic_faith', 믿음: 'topic_faith',
		إيمان: 'topic_faith', Вера: 'topic_faith', Foi: 'topic_faith', Glaube: 'topic_faith',
		Pananampalataya: 'topic_faith', Fede: 'topic_faith',
		Grace: 'topic_grace', 恩典: 'topic_grace', Gracia: 'topic_grace', Graça: 'topic_grace', 恵み: 'topic_grace', 은혜: 'topic_grace',
		نعمة: 'topic_grace', Благодать: 'topic_grace', Grâce: 'topic_grace', Gnade: 'topic_grace',
		Biyaya: 'topic_grace', Grazia: 'topic_grace',
		God: 'topic_god', 神: 'topic_god', Dios: 'topic_god', Deus: 'topic_god', 하나님: 'topic_god',
		الله: 'topic_god', Бог: 'topic_god', Dieu: 'topic_god', Gott: 'topic_god',
		Diyos: 'topic_god', Dio: 'topic_god',
		'Self-worth': 'topic_self_worth', 自我价值: 'topic_self_worth', Autoestima: 'topic_self_worth', 自己価値: 'topic_self_worth', 자존감: 'topic_self_worth',
		'قيمة الذات': 'topic_self_worth', Самоценность: 'topic_self_worth', 'Estime de soi': 'topic_self_worth',
		Selbstwert: 'topic_self_worth', 'Sariling halaga': 'topic_self_worth', Autostima: 'topic_self_worth',
		'Letting go': 'topic_letting_go', 放下: 'topic_letting_go', Soltar: 'topic_letting_go', 手放す: 'topic_letting_go', 내려놓음: 'topic_letting_go',
		الإفلات: 'topic_letting_go', Отпускание: 'topic_letting_go', 'Lâcher prise': 'topic_letting_go',
		Loslassen: 'topic_letting_go', Pagbitaw: 'topic_letting_go', 'Lasciare andare': 'topic_letting_go', 'Lasciar andare': 'topic_letting_go',
		Healing: 'topic_healing', 医治: 'topic_healing', Sanidad: 'topic_healing', Cura: 'topic_healing', 癒し: 'topic_healing', 치유: 'topic_healing',
		شفاء: 'topic_healing', Исцеление: 'topic_healing', Guérison: 'topic_healing',
		Heilung: 'topic_healing', Paghilom: 'topic_healing', Guarigione: 'topic_healing',
		'Mental health': 'topic_mental_health', 心理健康: 'topic_mental_health', 'Salud mental': 'topic_mental_health', 'Saúde mental': 'topic_mental_health', メンタルヘルス: 'topic_mental_health', '정신 건강': 'topic_mental_health',
		'الصحة النفسية': 'topic_mental_health', 'Психическое здоровье': 'topic_mental_health', 'Santé mentale': 'topic_mental_health',
		'Mentale Gesundheit': 'topic_mental_health', 'Kalusugang pangkaisipan': 'topic_mental_health', 'Salute mentale': 'topic_mental_health',
		Kindness: 'topic_kindness', 良善: 'topic_kindness', Bondad: 'topic_kindness', Bondade: 'topic_kindness', 親切: 'topic_kindness', 친절: 'topic_kindness',
		لطف: 'topic_kindness', Доброта: 'topic_kindness', Bonté: 'topic_kindness',
		Güte: 'topic_kindness', Freundlichkeit: 'topic_kindness', Kabaitan: 'topic_kindness', Gentilezza: 'topic_kindness',
		'Inner peace': 'topic_inner_peace', 内心平安: 'topic_inner_peace', 'Paz interior': 'topic_inner_peace', 内なる平安: 'topic_inner_peace', '내면의 평화': 'topic_inner_peace',
		'سلام داخلي': 'topic_inner_peace', 'Внутренний покой': 'topic_inner_peace', 'Paix intérieure': 'topic_inner_peace',
		'Innerer Frieden': 'topic_inner_peace', 'Panloob na kapayapaan': 'topic_inner_peace', 'Pace interiore': 'topic_inner_peace',
		Hope: 'topic_hope', 盼望: 'topic_hope', Esperanza: 'topic_hope', Esperança: 'topic_hope', 希望: 'topic_hope', 소망: 'topic_hope',
		رجاء: 'topic_hope', Надежда: 'topic_hope', Espérance: 'topic_hope',
		Hoffnung: 'topic_hope', 'Pag-asa': 'topic_hope', Speranza: 'topic_hope',
		Uplifting: 'topic_uplifting', 鼓舞: 'topic_uplifting', Ánimo: 'topic_uplifting', Ânimo: 'topic_uplifting', 励まし: 'topic_uplifting', 격려: 'topic_uplifting',
		تشجيع: 'topic_uplifting', Воодушевление: 'topic_uplifting', Encouragement: 'topic_uplifting',
		Ermutigung: 'topic_uplifting', Aufbauend: 'topic_uplifting', 'Pag-angat': 'topic_uplifting', Incoraggiamento: 'topic_uplifting',
		'Feeling blessed': 'topic_feeling_blessed', 蒙福: 'topic_feeling_blessed', 'Sentirse bendecido': 'topic_feeling_blessed', 'Sentir-se abençoado': 'topic_feeling_blessed', 祝福されている: 'topic_feeling_blessed', 축복: 'topic_feeling_blessed',
		بركة: 'topic_feeling_blessed', Благословение: 'topic_feeling_blessed', 'Se sentir béni': 'topic_feeling_blessed',
		Gesegnet: 'topic_feeling_blessed', 'Sich gesegnet fühlen': 'topic_feeling_blessed', Pagpapala: 'topic_feeling_blessed', 'Sentirsi benedetti': 'topic_feeling_blessed',
		'Mental toughness': 'topic_mental_toughness', 心志刚强: 'topic_mental_toughness', 'Fortaleza mental': 'topic_mental_toughness', 精神的な強さ: 'topic_mental_toughness', '정신적 강인함': 'topic_mental_toughness',
		'صلابة ذهنية': 'topic_mental_toughness', 'Ментальная стойкость': 'topic_mental_toughness', 'Force mentale': 'topic_mental_toughness',
		'Mentale Stärke': 'topic_mental_toughness', 'Katatagang pangkaisipan': 'topic_mental_toughness', 'Forza mentale': 'topic_mental_toughness',
		Love: 'topic_love', 爱: 'topic_love', Amor: 'topic_love', 愛: 'topic_love', 사랑: 'topic_love',
		محبة: 'topic_love', Любовь: 'topic_love', Amour: 'topic_love',
		Liebe: 'topic_love', 'Pag-ibig': 'topic_love', Amore: 'topic_love',
		Gratitude: 'topic_gratitude', 感恩: 'topic_gratitude', Gratitud: 'topic_gratitude', Gratidão: 'topic_gratitude', 感謝: 'topic_gratitude', 감사: 'topic_gratitude',
		امتنان: 'topic_gratitude', Благодарность: 'topic_gratitude',
		Dankbarkeit: 'topic_gratitude', Pasasalamat: 'topic_gratitude', Gratitudine: 'topic_gratitude',
		Grief: 'topic_grief', 哀伤: 'topic_grief', Duelo: 'topic_grief', Luto: 'topic_grief', 悲しみ: 'topic_grief', 슬픔: 'topic_grief',
		حزن: 'topic_grief', Горе: 'topic_grief', Deuil: 'topic_grief',
		Trauer: 'topic_grief', Pagluluksa: 'topic_grief',
	}

	function topicTitle(name) {
		const key = TOPIC_I18N[String(name || '').trim()]
		if (key) {
			const loc = String(t(key) || '')
			if (loc && loc !== key) return loc
		}
		return cmsLabel(name)
	}

	const byCat = {}
	topics.forEach((topic) => {
		if (usedIds.has(topic.id) || isBibleTopic(topic)) return
		const row = withIcon({
			key: 't' + topic.id,
			id: topic.id,
			slug: topic.slug || String(topic.id),
			name: topicTitle(topic.name),
			locked: !!topic.locked,
			followed: !!topic.followed,
			target: 'topic',
			category: topic.category || '',
			raw: topic,
		})
		const rawCat = String(topic.category || '').trim()
		if (!rawCat) return
		const cat = catTitle(rawCat)
		if (!byCat[cat]) byCat[cat] = []
		byCat[cat].push(row)
	})

	const out = [
		{ key: 'content_type', title: t('content_type'), items: typeItems },
		{ key: 'bible_versions', title: t('bible_versions'), items: versionItems },
	]
	Object.keys(byCat)
		.sort((a, b) => {
			const ra = CAT_KEYS.findIndex((row) => row.aliases.includes(a.toLowerCase()) || t(row.i18n) === a)
			const rb = CAT_KEYS.findIndex((row) => row.aliases.includes(b.toLowerCase()) || t(row.i18n) === b)
			const ia = ra === -1 ? 99 : ra
			const ib = rb === -1 ? 99 : rb
			return ia - ib
		})
		.forEach((cat) => {
			out.push({ key: 'cat-' + cat, title: cat, items: byCat[cat] })
		})
	return out.filter((g) => g.items.length)
}

/** Explore「Calm」栏目：子页用首页同款纵向滑动，而不是白卡列表 */
export function isCalmCategory(value) {
	const s = String(value || '').trim().toLowerCase()
	return s === 'calm' || s === '平静' || s === '安静'
}
