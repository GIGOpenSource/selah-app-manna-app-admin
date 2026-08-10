/**
 * 听经 / InBible 演示数据：章节 API 空或缺字段时填充，保证贴稿可验收。
 */
export const DEMO_LISTEN = {
	book: 'genesis',
	book_name: 'Genesis',
	chapter: 1,
	audio_url: '',
	audio_duration_sec: 314,
	verses: [
		{ verse: 1, text: 'In the beginning God created the heavens and the earth.' },
		{ verse: 2, text: 'He was with God in the beginning.' },
		{ verse: 3, text: 'Through him all things were made; without him nothing was made that has been made.' },
		{ verse: 4, text: 'In him was life, and that life was the light of all mankind.' },
		{ verse: 5, text: 'The light shines in the darkness, and the darkness has not overcome it.' },
	],
}

export const DEMO_IN_BIBLE = {
	book: 'romans',
	book_name: 'Romans',
	chapter: 7,
	focus_verse: 3,
	verses: [
		{ verse: 1, text: 'In the beginning was the Word, and the Word was with God, and the Word was God.' },
		{ verse: 2, text: 'He was with God in the beginning.' },
		{ verse: 3, text: 'For I know that in me, that is, in my flesh, dwells no good thing.' },
		{ verse: 4, text: 'In him was life, and that life was the light of all mankind.' },
		{ verse: 5, text: 'The light shines in the darkness, and the darkness has not overcome it.' },
	],
}

export function withDemoChapter(raw, fallback = DEMO_LISTEN) {
	const d = raw && typeof raw === 'object' ? raw : {}
	const verses = Array.isArray(d.verses) && d.verses.length ? d.verses : fallback.verses
	return {
		book: d.book || d.book_key || fallback.book,
		book_name: d.book_name || d.book_title || fallback.book_name,
		chapter: Number(d.chapter) || fallback.chapter,
		audio_url: d.audio_url || '',
		audio_duration_sec: Number(d.audio_duration_sec) || fallback.audio_duration_sec,
		verses: verses.map((v, i) => ({
			verse: Number(v.verse) || i + 1,
			text: v.text || v.content || fallback.verses[i % fallback.verses.length].text,
		})),
	}
}
