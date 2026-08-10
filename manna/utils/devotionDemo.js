/**
 * Devotion 列表空数据时的结构占位（封面必须来自 API cover_url / COS，不使用本地 static 图）。
 */
export const DEMO_SERIES = [
	{
		id: 'demo-anxiety',
		title: 'Overcoming Anxiety',
		subtitle: 'Experiencing Peace That Surpasses Understanding',
		cover_url: '',
		tags: ['Anxiety', 'Peace'],
		session_count: 5,
		locked: false,
		preview_sessions: [
			{ id: 'd1', title: 'Acknowledging Helplessness', scripture_ref: 'Matthew 6:27', completed: true },
			{ id: 'd2', title: 'Thinking on What Is True', scripture_ref: 'Philippians 4:6‑8', completed: false },
		],
	},
	{
		id: 'demo-love',
		title: 'Learning to Love',
		subtitle: '',
		cover_url: '',
		tags: ['Love'],
		session_count: 7,
		locked: false,
		preview_sessions: [],
	},
	{
		id: 'demo-family',
		title: 'Building the Family',
		subtitle: '',
		cover_url: '',
		tags: ['Family'],
		session_count: 10,
		locked: false,
		preview_sessions: [],
	},
	{
		id: 'demo-hope',
		title: 'Rekindling Hope',
		subtitle: '',
		cover_url: '',
		tags: ['Hope'],
		session_count: 3,
		locked: false,
		preview_sessions: [],
	},
	{
		id: 'demo-fear',
		title: 'From Fear to Faith',
		subtitle: '',
		cover_url: '',
		tags: ['Healing', 'Hope'],
		session_count: 4,
		locked: false,
		preview_sessions: [],
	},
]

/** API 空列表时用结构占位；封面仍只展示 results.cover_url */
export function withDemoSeriesList(list) {
	const rows = Array.isArray(list) ? list.slice() : []
	if (!rows.length) return DEMO_SERIES.map((s) => ({ ...s }))
	return rows.map((s, i) => {
		const demo = DEMO_SERIES[i % DEMO_SERIES.length]
		return {
			...s,
			title: s.title || demo.title,
			cover_url: s.cover_url || '',
			tags: (s.tags && s.tags.length) ? s.tags : (demo.tags || []),
			session_count: s.session_count || demo.session_count || 0,
			preview_sessions: (s.preview_sessions && s.preview_sessions.length)
				? s.preview_sessions
				: (i === 0 ? (demo.preview_sessions || []) : []),
		}
	})
}
