<template>
	<!-- Figma Bible 312:2493 / 329:742 / 书卷·章节选择器 -->
	<view
		class="page"
		:class="['theme-' + themeId, { 'page--act': !!selectedVerse, 'page--mini': listenSession.mini }]"
		:style="pageChromeStyle"
	>
		<view class="page__bar">
			<view class="page__title-wrap" hover-class="page__press" @tap.stop="openBooks">
				<text class="page__title">{{ bookName }} {{ chapterNum }}</text>
			</view>
			<view class="page__tools">
				<view class="page__aa" hover-class="page__press" @tap.stop="openFont">
					<text class="page__aa-txt">Aa</text>
				</view>
				<!-- <view class="page__tool-hit" hover-class="page__press" @tap.stop="openChapters">
					<image class="page__tool" src="/static/ui/bible/ico-list.svg" mode="aspectFit" />
				</view> -->
				<view class="page__tool-hit" hover-class="page__press" @tap.stop="openSearch">
					<image class="page__tool" src="/static/ui/bible/ico-search.svg" mode="aspectFit" />
				</view>
				<view class="page__tool-hit" hover-class="page__press" @tap.stop="onBookmark">
					<image
						class="page__tool"
						:src="bookmarkActive ? '/static/ui/bible/ico-bookmark-on.svg' : '/static/ui/bible/ico-bookmark.svg'"
						mode="aspectFit"
					/>
				</view>
			</view>
		</view>

		<scroll-view
			scroll-y
			class="reader"
			:scroll-into-view="scrollInto"
			scroll-with-animation
			:lower-threshold="80"
			@scroll="onReaderScroll"
			@scrolltolower="onReaderScrollToLower"
			@touchstart="onReaderTouchStart"
			@touchmove="onReaderTouchMove"
			@touchend="onReaderTouchEnd"
			@touchcancel="onReaderTouchEnd"
		>
			<view
				v-for="v in verses"
				:id="'verse-' + v.verse"
				:key="bookKey + '-' + chapterNum + '-' + v.verse"
				class="reader__v"
				:class="{
					'is-hi': !!highlightMap[v.verse],
					'is-hi-gold': hiColor(v) === 'gold',
					'is-hi-green': hiColor(v) === 'green',
					'is-hi-pink': hiColor(v) === 'pink',
					'is-hi-peach': hiColor(v) === 'peach',
					'is-hi-cyan': hiColor(v) === 'cyan',
					'is-hi-blue': hiColor(v) === 'blue',
					'is-hi-purple': hiColor(v) === 'purple',
					'is-hi-line': hiColor(v) === 'line',
					'is-sel': selectedVerse && selectedVerse.verse === v.verse,
					'is-amen': !!amenMap[v.verse],
					'is-listening': listeningVerse === v.verse,
					'is-heard': listeningVerse > 0 && v.verse < listeningVerse,
				}"
				@touchstart="onVerseTouchStart"
				@touchmove="onVerseTouchMove"
				@touchend="onVerseTouchEnd"
				@touchcancel="onVerseTouchEnd"
				@longpress="onLongPress(v)"
				@click="onTapVerse(v)"
			>
				<text class="n">{{ v.verse }}</text>
				<view class="reader__v-main">
					<text class="t" :style="readerFaceStyle">{{ verseText(v) }}</text>
					<view v-if="amenMap[v.verse]" class="amen-pill">
						<image class="amen-pill__ico" src="/static/ui/bible/ico-amen.svg" mode="aspectFit" />
						<text class="amen-pill__n">{{ amenMap[v.verse] }}</text>
					</view>
				</view>
			</view>
			<text v-if="!verses.length && !loading" class="reader__empty">{{ emptyHint }}</text>
			<text v-if="hasTranslated" class="reader__credit">{{ t('bible_translate_credit') }}</text>
			<!-- 章末只留一行轻提示：翻章交给上拉手势与停顿自动进入，不做可点按钮 -->
			<view v-if="verses.length && !loading" class="reader__end">
				<text class="reader__end-sub">{{ endHintText }}</text>
			</view>
			<view class="reader__pad" />
		</scroll-view>
		<view
			v-if="showPullNudge"
			class="reader__pull"
			:class="{
				'reader__pull--ready': pullProgress >= 1 || pullFlash,
				'reader__pull--loading': pullLoading,
			}"
			:style="pullIndicatorStyle"
		>
			<view class="reader__pull-spin" :class="{ 'reader__pull-spin--on': pullLoading || pullProgress >= 1 }" />
			<text class="reader__pull-txt">{{ pullHintText }}</text>
		</view>

		<view
			v-if="verses.length && translateEnabled"
			class="fab fab--translate"
			:class="{ 'fab--translate-on': showTranslated }"
			hover-class="fab--press-side"
			@click="onTranslateTap"
		>
			<view class="fab__glass fab__glass--side" aria-hidden="true" />
			<image
				class="fab__ico"
				src="/static/ui/bible/ico-globe.svg"
				mode="aspectFit"
			/>
		</view>

		<view
			v-if="!listenSession.mini"
			class="fab"
			:class="{ 'fab--playing': audioPlaying, 'fab--flow': fabFlow }"
			hover-class="fab--press"
			@click.stop="onFabTap"
			@tap.stop="onFabTap"
		>
			<image
				v-if="!audioPlaying"
				class="fab__full"
				src="/static/ui/bible/fab-play.png"
				mode="aspectFit"
				@click.stop="onFabTap"
				@tap.stop="onFabTap"
			/>
			<template v-else>
				<view class="fab__glass" aria-hidden="true" />
				<image
					class="fab__ico"
					src="/static/ui/bible/ico-pause.svg"
					mode="aspectFit"
				/>
			</template>
		</view>

		<!-- 字体 / 主题 -->
		<view v-if="sheet === 'font'" class="mask" @touchmove.stop.prevent="noop">
			<view v-if="sheetMaskReady" class="mask__hit" @tap.stop="onMaskClose" />
			<view class="sheet sheet--font" @click.stop @touchstart="onSheetTouchStart" @touchend="onSheetTouchEnd">
				<view class="sheet__handle" />
				<text class="sheet__label">{{ t('bible_font') }}</text>
				<view class="seg" :style="segTrackStyle">
					<view
						v-for="ff in FONT_FACES"
						:key="ff.id"
						class="seg__btn"
						:class="{ 'seg__btn--on': fontFace === ff.id }"
						:style="segBtnStyle(fontFace === ff.id, '50%')"
						@click="setFontFace(ff.id)"
					>
						<text class="seg__txt" :style="segTxtStyle(fontFace === ff.id)">{{ ff.label }}</text>
					</view>
				</view>
				<!-- <view class="sheet__preview-box">
					<text class="sheet__preview" :style="previewFaceStyle">{{ t('bible_font_preview') }}</text>
				</view> -->
				<view class="size-row" :style="segTrackStyle">
					<text class="size-row__aa">Aa</text>
					<view class="seg seg--size" :style="segGrowStyle">
						<view
							v-for="sz in FONT_STEPS"
							:key="sz"
							class="seg__btn"
							:class="{ 'seg__btn--on': fontPx === sz }"
							:style="segBtnStyle(fontPx === sz, '25%')"
							@click="setFont(sz)"
						>
							<text class="seg__txt" :style="segTxtStyle(fontPx === sz)">{{ sz }}</text>
						</view>
					</view>
				</view>
				<view class="theme-row" :style="segTrackStyle">
					<view
						v-for="th in THEMES"
						:key="th.id"
						class="theme-swatch"
						:class="['theme-swatch--' + th.id, { 'theme-swatch--on': themeId === th.id }]"
						@click="setTheme(th.id)"
					>
						<view class="theme-swatch__check" />
					</view>
				</view>
			</view>
		</view>

		<!-- 书卷 → 章节（合并选择器） -->
		<view v-if="sheet === 'books'" class="mask" @touchmove.stop.prevent="noop">
			<view v-if="sheetMaskReady" class="mask__hit" @tap.stop="onMaskClose" />
			<view class="sheet sheet--tall" @click.stop>
				<view class="sheet__handle" />
				<template v-if="pickerView === 'books'">
					<view class="tags">
						<view
							v-for="tg in bookTags"
							:key="tg.id"
							class="tag"
							:class="{ 'tag--on': bookTag === tg.id }"
							@click="bookTag = tg.id"
						>
							{{ tg.label }}
						</view>
					</view>
					<scroll-view scroll-y class="sheet__scroll">
						<view class="book-grid">
							<view
								v-for="b in filteredBooks"
								:key="b.book_key"
								class="book-cell"
								:class="{ 'book-cell--on': b.book_key === bookKey }"
								@click="pickBook(b)"
							>
								{{ b.name || b.book_key }}
							</view>
						</view>
					</scroll-view>
				</template>
				<template v-else>
					<view class="picker__head">
						<view class="picker__back" hover-class="page__press" @click="backToBooks">
							<text class="picker__back-ico">‹</text>
							<text class="picker__back-txt">{{ t('bible_books') }}</text>
						</view>
						<view class="picker__title-row">
							<text class="picker__title">{{ pickerBookName }}</text>
							<text class="picker__count">{{ t('bible_chapters') }} · {{ pickerChapterNums.length }}</text>
						</view>
					</view>
					<scroll-view scroll-y class="sheet__scroll">
						<view class="chap-grid">
							<view
								v-for="n in pickerChapterNums"
								:key="n"
								class="chap-cell"
								:class="{ 'chap-cell--on': pickerOnCurrentBook && n === chapterNum }"
								@click="selectChapter(n)"
							>
								{{ n }}
							</view>
						</view>
					</scroll-view>
				</template>
			</view>
		</view>

		<!-- 写笔记 -->
		<view v-if="sheet === 'note'" class="mask" @touchmove.stop.prevent="noop">
			<view v-if="sheetMaskReady" class="mask__hit" @tap.stop="onMaskClose" />
			<view class="sheet sheet--note" :style="noteSheetStyle" @click.stop>
				<view class="sheet__handle" />
				<view class="note-sheet__title">{{ t('bible_notes') }}</view>
				<view v-if="selectedVerse" class="note-sheet__ref">{{ bookName }} {{ chapterNum }}:{{ selectedVerse.verse }}</view>
				<textarea
					class="note-sheet__input"
					v-model="noteDraft"
					:placeholder="t('bible_note_placeholder')"
					placeholder-class="note-sheet__ph"
					:placeholder-style="notePlaceholderStyle"
					:maxlength="2000"
					:auto-height="false"
					:adjust-position="false"
					:cursor-spacing="16"
					@keyboardheightchange="onNoteKeyboard"
				/>
				<view
					class="note-sheet__save"
					:class="{ 'note-sheet__save--disabled': noteBusy }"
					hover-class="note-sheet__save--press"
					@click="saveNote"
				>
					<text class="note-sheet__save-txt">{{ t('bible_note_save') }}</text>
				</view>
			</view>
		</view>

		<!-- 翻译：Google Translate API 实时展示，不保存译本 -->
		<view v-if="sheet === 'translate'" class="mask" @touchmove.stop.prevent="noop">
			<view v-if="sheetMaskReady" class="mask__hit" @tap.stop="onMaskClose" />
			<view class="sheet sheet--translate" @click.stop>
				<view class="sheet__handle" />
				<text class="sheet__label">{{ t('bible_translate') }}</text>
				<scroll-view scroll-y enable-flex class="sheet__t-scroll" :show-scrollbar="false">
					<view class="sheet__t-inner">
						<view class="sheet__legal">
							<text class="sheet__legal-txt">{{ t('bible_translate_legal') }}</text>
						</view>
						<text class="sheet__preview">{{ t('bible_translate_target') }}</text>
						<view class="lang-grid">
							<view
								v-for="opt in translateLangOptions"
								:key="opt.code"
								class="lang-grid__cell"
								:class="{ 'lang-grid__cell--on': translateTarget === opt.code }"
								hover-class="page__press"
								@click="translateTarget = opt.code"
							>
								<text class="lang-grid__abbr">{{ opt.abbr }}</text>
								<text class="lang-grid__name">{{ opt.label }}</text>
							</view>
						</view>
						<text class="sheet__meta">{{ translateHint }}</text>
						<text class="sheet__meta">{{ translateScopeLabel }}</text>
					</view>
				</scroll-view>
				<view
					class="sheet__cta"
					:class="{ 'sheet__cta--disabled': translateBusy }"
					hover-class="sheet__cta--press"
					@click="confirmTranslate"
				>
					<text class="sheet__cta-txt">{{ t('bible_translate_go') }}</text>
				</view>
				<view
					v-if="showTranslated"
					class="sheet__cta sheet__cta--ghost"
					:class="{ 'sheet__cta--disabled': translateBusy }"
					hover-class="sheet__cta--press"
					@click="restoreOriginal"
				>
					<text class="sheet__cta-txt">{{ t('bible_translate_original') }}</text>
				</view>
			</view>
		</view>

		<!-- 搜索 -->
		<view v-if="sheet === 'search'" class="mask mask--search" @touchmove.stop.prevent="noop">
			<view class="search-page" @click.stop>
				<view class="search-page__bar">
					<view class="search-page__back" hover-class="page__press" @click="onMaskClose">
						<image class="search-page__back-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
					</view>
					<view class="search-page__field">
						<view class="search-page__ico-hit" hover-class="page__press" @click.stop="runSearch">
							<image class="search-page__ico" src="/static/ui/bible/ico-search.svg" mode="aspectFit" />
						</view>
						<input
							class="search-page__input"
							:value="searchQ"
							:placeholder="t('bible_search_ph')"
							placeholder-class="search-page__ph"
							confirm-type="search"
							@input="onSearchInput"
							@confirm="runSearch"
						/>
					</view>
				</view>
				<view v-if="searchRecent.length && !searchHits.length" class="search-hist">
					<view class="search-hist__head">
						<text class="search-hist__title">{{ t('bible_search_recent') }}</text>
						<view class="search-hist__clear" hover-class="page__press" @click="clearSearchRecent">
							<image class="search-hist__clear-ico" src="/static/ui/bible/rabish.png" mode="aspectFit" />
						</view>
					</view>
					<view class="search-hist__chips">
						<view
							v-for="q in searchRecent"
							:key="'rq-' + q"
							class="search-hist__chip"
							hover-class="page__press"
							@click="pickSearchRecent(q)"
						>
							<text class="search-hist__chip-txt">{{ q }}</text>
							<text class="search-hist__chip-x" @click.stop="removeSearchRecent(q)">×</text>
						</view>
					</view>
				</view>
				<text v-if="searchHits.length" class="search-page__meta">{{ t('bible_search_n', { n: searchHits.length }) }}</text>
				<scroll-view scroll-y class="search-page__scroll">
					<view class="search-page__list">
						<view
							v-for="(hit, i) in searchHits"
							:key="'s' + i"
							class="search-hit"
							hover-class="page__press"
							@click="openSearchHit(hit)"
						>
							<text class="search-hit__t">{{ hit.book_name }} {{ hit.chapter }}:{{ hit.verse }}</text>
							<text class="search-hit__m">
								<text
									v-for="(part, pi) in highlightSearchParts(hit.text)"
									:key="'sp' + i + '-' + pi"
									:class="{ 'search-hit__em': part.em }"
								>{{ part.t }}</text>
							</text>
						</view>
						<text v-if="searchDone && !searchHits.length" class="search-page__empty">{{ t('bible_search_empty') }}</text>
					</view>
				</scroll-view>
			</view>
		</view>

		<view v-if="sheet === 'verse'" class="mask" @touchmove.stop.prevent="noop">
			<view v-if="sheetMaskReady" class="mask__hit" @tap.stop="onMaskClose" />
			<view class="sheet sheet--verse" @click.stop @touchstart="onSheetTouchStart" @touchend="onSheetTouchEnd">
				<view class="sheet__handle sheet__handle--hit" hover-class="page__press" @click.stop="onMaskClose" />
				<view class="verse-act">
					<view class="verse-act__item" hover-class="page__press" @click="onVerseAct('amen')">
						<image class="verse-act__ico" src="/static/ui/bible/amen.png" mode="aspectFit" />
						<text class="verse-act__label">{{ t('amen') }}</text>
					</view>
					<view class="verse-act__item" hover-class="page__press" @click="onVerseAct('note')">
						<image class="verse-act__ico" src="/static/ui/bible/note.png" mode="aspectFit" />
						<text class="verse-act__label">{{ t('bible_note') }}</text>
					</view>
					<view class="verse-act__item" hover-class="page__press" @click="onVerseAct('card')">
						<image class="verse-act__ico" src="/static/ui/bible/versecard.png" mode="aspectFit" />
						<text class="verse-act__label">{{ t('bible_versecard') }}</text>
					</view>
					<view class="verse-act__item" hover-class="page__press" @click="onVerseAct('copy')">
						<image class="verse-act__ico" src="/static/ui/bible/copy.png" mode="aspectFit" />
						<text class="verse-act__label">{{ t('bible_copy') }}</text>
					</view>
				</view>
				<view class="verse-hi">
					<view
						v-for="c in verseHiColors"
						:key="c.id"
						class="verse-hi__dot"
						:class="{ 'is-on': hiColor(selectedVerse) === c.id }"
						:style="{ background: c.hex }"
						hover-class="page__press"
						@click="applyHighlight(selectedVerse, c.id)"
					>
						<image
							v-if="hiColor(selectedVerse) === c.id"
							class="verse-hi__cha"
							src="/static/ui/bible/cha.png"
							mode="aspectFit"
						/>
					</view>
				</view>
			</view>
		</view>

		<!-- 单击经文工具条：暂隐藏，保留便于恢复
		<view v-if="selectedVerse" class="act">
			<view class="act__btn" hover-class="page__press" @click="amenVerse(selectedVerse)">
				<text class="act__txt">{{ t('amen') }}</text>
			</view>
			<view
				class="act__dot act__dot--gold"
				:class="{ 'is-on': hiColor(selectedVerse) === 'gold' }"
				hover-class="page__press"
				@click="applyHighlight(selectedVerse, 'gold')"
			/>
			<view
				class="act__dot act__dot--green"
				:class="{ 'is-on': hiColor(selectedVerse) === 'green' }"
				hover-class="page__press"
				@click="applyHighlight(selectedVerse, 'green')"
			/>
			<view
				class="act__dot act__dot--pink"
				:class="{ 'is-on': hiColor(selectedVerse) === 'pink' }"
				hover-class="page__press"
				@click="applyHighlight(selectedVerse, 'pink')"
			/>
			<view
				class="act__dot act__dot--line"
				:class="{ 'is-on': hiColor(selectedVerse) === 'line' }"
				hover-class="page__press"
				@click="applyHighlight(selectedVerse, 'line')"
			>
				<text class="act__dot-u">U</text>
			</view>
			<view class="act__btn" hover-class="page__press" @click="openNoteSheet(selectedVerse)">
				<text class="act__txt">{{ t('bible_notes') }}</text>
			</view>
			<view class="act__btn" hover-class="page__press" @click="openVerseCard">
				<text class="act__txt">{{ t('versecard_title') }}</text>
			</view>
			<view class="act__btn" hover-class="page__press" @click="copyVerse(selectedVerse)">
				<text class="act__txt">{{ t('bible_copy') }}</text>
			</view>
		</view>
		-->

		<MannaTabBar v-show="tabOn" active="bible" variant="light" />
		<!-- <manna-badge-toast v-model:visible="badgeOpen" :items="badgeItems" /> -->
	</view>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { t } from '@/i18n/index.js'
import MannaTabBar from '@/components/MannaTabBar.vue'
import { useBibleReader } from './useBibleReader.js'
import { useBibleAudio } from './useBibleAudio.js'
import { useBibleTranslate } from './useBibleTranslate.js'

const hooks = {}
const reader = useBibleReader(hooks)
const translate = useBibleTranslate({
	verses: reader.verses,
	bookKey: reader.bookKey,
	bookName: reader.bookName,
	chapterNum: reader.chapterNum,
	sheet: reader.sheet,
	closeSheet: reader.closeSheet,
})
const audio = useBibleAudio({
	verses: reader.verses,
	audioUrl: reader.audioUrl,
	audioDurationSec: reader.audioDurationSec,
	scrollInto: reader.scrollInto,
	audioPlaying: reader.audioPlaying,
	listeningVerse: reader.listeningVerse,
	bookKey: reader.bookKey,
	bookName: reader.bookName,
	chapterNum: reader.chapterNum,
	selectedVerse: reader.selectedVerse,
	translation: reader.translation,
	loadChapter: reader.loadChapter,
})

hooks.stopAudio = audio.stopAudio
hooks.clearTranslation = translate.clearTranslation
hooks.confirmTranslate = translate.confirmTranslate
hooks.applyDefaultScriptureLanguage = translate.applyDefaultScriptureLanguage
hooks.translateActive = translate.translateActive
hooks.translateEnabled = translate.translateEnabled
hooks.translateBusy = translate.translateBusy
hooks.applyListenIntent = audio.applyListenIntent
hooks.clearFabFlowTimer = audio.clearFabFlowTimer
hooks.bindMiniListenFollow = audio.bindMiniListenFollow
hooks.unbindMiniListenFollow = audio.unbindMiniListenFollow

const {
	FONT_STEPS,
	FONT_FACES,
	THEMES,
	tabOn,
	fontPx,
	themeId,
	fontFace,
	searchQ,
	searchHits,
	searchDone,
	searchRecent,
	pickSearchRecent,
	removeSearchRecent,
	clearSearchRecent,
	highlightSearchParts,
	bookKey,
	bookName,
	chapterNum,
	verses,
	audioUrl,
	audioPlaying,
	listeningVerse,
	scrollInto,
	loading,
	emptyHint,
	showNextHint,
	showPullNudge,
	isLastChapter,
	pullLoading,
	pullFlash,
	pullProgress,
	pullHintText,
	highlightMap,
	selectedVerse,
	sheet,
	sheetMaskReady,
	bookTag,
	noteDraft,
	noteBusy,
	amenMap,
	badgeOpen,
	badgeItems,
	bookmarkActive,
	readerFaceStyle,
	previewFaceStyle,
	pageChromeStyle,
	bookTags,
	filteredBooks,
	pickerView,
	pickerBookName,
	pickerChapterNums,
	pickerOnCurrentBook,
	segTrackStyle,
	segGrowStyle,
	listenSession,
	noop,
	onMaskClose,
	openFont,
	openSearch,
	onSearchInput,
	onSheetTouchStart,
	onSheetTouchEnd,
	setFontFace,
	openBooks,
	openChapters,
	setFont,
	setTheme,
	segBtnStyle,
	segTxtStyle,
	hiColor,
	verseHiColors,
	pickBook,
	backToBooks,
	selectChapter,
	onReaderScroll,
	onReaderScrollToLower,
	onReaderTouchStart,
	onReaderTouchMove,
	onReaderTouchEnd,
	onTapVerse,
	applyHighlight,
	onLongPress,
	onVerseTouchStart,
	onVerseTouchMove,
	onVerseTouchEnd,
	onVerseAct,
	openNoteSheet,
	saveNote,
	amenVerse,
	onBookmark,
	runSearch,
	openSearchHit,
	openVerseCard,
	copyVerse,
} = reader

/** 章末提示：末章说明到底了，其余提示「上拉并松手」才翻章 */
const endHintText = computed(() => (
	isLastChapter.value ? t('bible_last_chapter') : t('bible_at_bottom')
))

const pullIndicatorStyle = computed(() => {
	const p = Number(pullProgress.value) || 0
	const hold = pullLoading.value || pullFlash.value
	const lift = Math.round(Math.min(1.15, Math.max(p, hold ? 0.85 : 0)) * 40)
	const op = hold ? 1 : Math.min(1, Math.max(0, (p - 0.06) / 0.4))
	return {
		transform: `translateX(-50%) translateY(${-lift}rpx)`,
		opacity: String(op),
	}
})

const {
	translatedMap,
	showTranslated,
	hasTranslated,
	translateActive,
	translateBusy,
	translateTarget,
	translateEnabled,
	translateLangOptions,
	translateScopeLabel,
	translateHint,
	verseText,
	onTranslateTap,
	restoreOriginal,
	confirmTranslate,
} = translate

const { fabFlow, onFabTap } = audio

/** App 端 textarea 占位符需 inline style，避免字脚被裁 */
const notePlaceholderStyle =
	"font-size:14px;line-height:22px;color:rgba(33,33,33,0.35);font-family:PingFang SC,SF Pro Text,Helvetica Neue,sans-serif;"

const noteKeyboardPx = ref(0)
function onNoteKeyboard(e) {
	noteKeyboardPx.value = Math.max(0, Number(e?.detail?.height || 0))
}
const noteSheetStyle = computed(() => {
	const h = noteKeyboardPx.value
	if (!h) return {}
	return {
		bottom: `${h}px`,
		paddingBottom: '24rpx',
	}
})
watch(sheet, (name) => {
	if (name !== 'note') noteKeyboardPx.value = 0
})
</script>

<style scoped lang="scss">
@import './bible.scss';
</style>

<!-- placeholder-class 在原生组件上不带 scoped，需额外全局规则 -->
<style lang="scss">
.note-sheet__ph {
	font-family: "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif !important;
	font-size: 28rpx !important;
	font-weight: 400 !important;
	line-height: 44rpx !important;
	color: rgba(33, 33, 33, 0.35) !important;
}

.search-page__ph {
	font-family: "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif !important;
	font-size: 30rpx !important;
	font-weight: 400 !important;
	color: rgba(33, 33, 33, 0.35) !important;
}
</style>
