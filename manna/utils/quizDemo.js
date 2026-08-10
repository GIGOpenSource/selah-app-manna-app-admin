/**
 * Quiz 故事链路演示数据：API 空或缺字段时填充，保证贴稿 UI 可验收。
 */
export const DEMO_STORY = {
	id: 'demo-moses',
	title: 'Moses Opening the Sea',
	cover_url: '/static/ui/quiz/story-bg-moses.png',
	unlock_cost: 30,
	unlocked: true,
	body: 'God parted the waters so His people could walk through on dry ground.',
	cards: [
		{ title: 'Staff', body: 'Moses parted the Red Sea with his staff.' },
		{ title: 'Faith', body: 'Israel walked through on dry ground by faith.' },
		{ title: 'Deliverance', body: 'The Lord fights for His people and delivers them.' },
	],
}

export const DEMO_STORIES_LIST = [
	{ ...DEMO_STORY, unlocked: false },
	{
		id: 'demo-shepherd',
		title: 'Welcome · The Good Shepherd',
		cover_url: '',
		unlock_cost: 0,
		unlocked: true,
		body: 'The Lord is my shepherd; I shall not want.',
		cards: [
			{ title: 'Care', body: 'He makes me lie down in green pastures.' },
			{ title: 'Guide', body: 'He leads me beside still waters.' },
			{ title: 'Rest', body: 'He restores my soul.' },
		],
	},
]

export function withDemoStories(list) {
	const rows = Array.isArray(list) ? list.slice() : []
	if (!rows.length) return DEMO_STORIES_LIST.map((s) => ({ ...s }))
	return rows.map((s, i) => ({
		...s,
		title: s.title || DEMO_STORIES_LIST[i % DEMO_STORIES_LIST.length].title,
		cover_url: s.cover_url || (i === 0 ? DEMO_STORY.cover_url : ''),
	}))
}

export function withDemoStoryDetail(raw, fallbackTitle = '') {
	const d = raw && typeof raw === 'object' ? raw : {}
	const cards = Array.isArray(d.cards) && d.cards.length
		? d.cards
		: Array.isArray(d.knowledge_cards) && d.knowledge_cards.length
			? d.knowledge_cards
			: DEMO_STORY.cards
	return {
		id: d.id || DEMO_STORY.id,
		title: d.title || fallbackTitle || DEMO_STORY.title,
		cover_url: d.cover_url || DEMO_STORY.cover_url,
		body: d.body || d.content || DEMO_STORY.body,
		cards: cards.map((c, i) => ({
			title: c.title || c.heading || DEMO_STORY.cards[i % 3].title,
			body: c.body || c.text || DEMO_STORY.cards[i % 3].body,
		})),
		linked_level_id: d.linked_level_id || d.level_id || null,
	}
}
