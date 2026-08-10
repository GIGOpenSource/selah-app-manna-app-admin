<!--
  我的资产：喜欢/收藏/历史/肯定语；收藏夹管理、模板空态、清空历史。
-->
<template>
	<view class="page">
		<view class="page-head" :style="{ paddingTop: statusBarPx + 'px' }">
			<view class="head-glass" />
			<view class="custom-nav">
				<view class="nav-pill" @tap.stop="goBack">
					<image class="nav-ico" src="/static/ui/ico-back.svg" mode="aspectFit" />
				</view>
				<text class="nav-title" :style="titleStyle">{{ pageTitle }}</text>
				<view class="nav-spacer" />
			</view>
			<view class="tabs">
				<text
					v-for="tab in tabs"
					:key="tab.key"
					:class="['tab', kind===tab.key ? 'on':'']"
					@click="switchKind(tab.key)"
				>{{ tab.label }}</text>
			</view>
		</view>

		<view v-if="kind === 'affirmation'" class="aff-pane">
			<view class="composer">
				<textarea
					v-model="draft"
					class="composer-input"
					:maxlength="160"
					:placeholder="t('write_affirm')"
					:auto-height="true"
					:show-confirm-bar="false"
				/>
				<view class="composer-foot">
					<text class="composer-count">{{ draftLen }}/160</text>
					<view class="composer-actions">
						<text v-if="editingId" class="composer-cancel" @click="cancelEditAff">{{ t('cancel') }}</text>
						<view
							:class="['composer-save', (!draft.trim() || savingAff) ? 'disabled' : '']"
							@click="saveAff"
						>
							<text class="composer-save-text">{{ editingId ? t('update') : t('save') }}</text>
						</view>
					</view>
				</view>
			</view>

			<view v-for="a in affirmations" :key="a.id" class="q">
				<text class="q-body">{{ a.content }}</text>
				<view class="row-actions">
					<text class="link" @click="editAff(a)">{{ t('edit') }}</text>
					<text class="del" @click="delAff(a.id)">{{ t('delete') }}</text>
				</view>
			</view>

			<view v-if="!loadingMore && !affirmations.length" class="empty empty-soft">
				<text class="empty-title">{{ t('empty') }}</text>
				<view v-if="templates.length" class="tpl-block">
					<text class="tpl-hint">{{ t('use_template') }}</text>
					<view
						v-for="tpl in templates"
						:key="tpl.id"
						class="tpl-chip"
						@click="useTemplate(tpl)"
					>
						<text class="tpl-text">{{ tpl.content }}</text>
					</view>
				</view>
			</view>
		</view>

		<view v-else-if="kind === 'collect'">
			<view class="folder-bar">
				<scroll-view scroll-x class="folders" :show-scrollbar="false" enable-flex>
					<view class="folders-inner">
						<text
							v-for="f in folders"
							:key="f.id"
							:class="['folder', folderId===f.id ? 'on':'']"
							@click="selectFolder(f.id)"
							@longpress="folderActions(f)"
						>{{ f.name }}</text>
					</view>
				</scroll-view>
				<text class="add" @click="openFolderDialog('create')">{{ t('add_folder') }}</text>
			</view>
			<view v-for="q in list" :key="q.id" class="q">
				<text class="q-body">{{ q.content }}</text>
				<text v-if="q.source_ref" class="q-cite">— {{ q.source_ref }}</text>
				<view class="row-actions">
					<text class="link" @click="goShare(q)">{{ t('share') }}</text>
					<text class="link" @click="moveCollect(q)">{{ t('move_folder') }}</text>
					<text class="del" @click="uncollect(q.id)">{{ t('remove') }}</text>
				</view>
			</view>
			<view v-if="!loadingMore && !list.length" class="empty">
				<image class="empty-art" src="/static/ui/themes/fy-3.jpg" mode="aspectFill" />
				<text>{{ t('empty') }}</text>
			</view>
		</view>

		<view v-else>
			<view v-if="kind === 'history' && list.length" class="hist-bar">
				<text class="hist-clear" @click="clearHistoryConfirm">{{ t('clear_history') }}</text>
			</view>
			<view v-for="q in list" :key="q.id" class="q">
				<text class="q-body">{{ q.content }}</text>
				<text v-if="q.source_ref" class="q-cite">— {{ q.source_ref }}</text>
				<view class="row-actions">
					<text class="link" @click="goShare(q)">{{ t('share') }}</text>
					<text v-if="kind === 'like'" class="del" @click="unlike(q.id)">{{ t('unlike') }}</text>
				</view>
			</view>
			<view v-if="!loadingMore && !list.length" class="empty">
				<image class="empty-art" src="/static/ui/themes/fy-1.jpg" mode="aspectFill" />
				<text>{{ t('empty') }}</text>
			</view>
		</view>
		<view v-if="loadingMore" class="tip">...</view>

		<selah-sheet
			v-model:visible="folderSheetOpen"
			:title="t('more')"
			:items="folderSheetItems"
			:cancel-text="t('cancel')"
			@select="onFolderSheetSelect"
		/>
		<selah-sheet
			v-model:visible="moveSheetOpen"
			:title="t('move_folder')"
			:items="moveSheetItems"
			:cancel-text="t('cancel')"
			@select="onMoveSheetSelect"
		/>
		<selah-dialog
			v-model:visible="folderDialogOpen"
			:title="folderDialogMode === 'rename' ? t('rename') : t('new_folder')"
			:confirm-text="t('ok')"
			:cancel-text="t('cancel')"
			@confirm="onFolderDialogConfirm"
		>
			<input
				v-model="folderDialogName"
				class="folder-dialog-input"
				:placeholder="t('folder_name')"
				:maxlength="64"
			/>
		</selah-dialog>
		<selah-dialog
			v-model:visible="clearDialogOpen"
			:title="t('clear_history')"
			:content="t('clear_history_confirm')"
			:confirm-text="t('ok')"
			:cancel-text="t('cancel')"
			@confirm="doClearHistory"
		/>
	</view>
</template>

<script setup>
/**
 * 我的资产：点赞/收藏/历史/肯定语；收藏夹 CRUD 与移动；模板空态。
 */
import { ref, computed } from 'vue'
import { onLoad, onReachBottom, onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import {
	apiMyAssets, apiAffirmations, apiAffirmationSave, apiAffirmationDelete,
	apiFolders, apiFolderSave, apiFolderDelete, apiUncollect, apiCollect,
	apiLike, apiAffirmationTemplates, apiHistoryClear,
} from '@/api/content.js'
import { safeBack } from '@/utils/nav.js'
import { getStatusBarPx } from '@/utils/safeArea.js'
import { useCollapsingTitle } from '@/utils/collapsingTitle.js'
import { silentListRefresh, clearPageCache } from '@/utils/pageCache.js'
import { ASSETS_FOLDERS_KEY, assetsListKey } from '@/utils/wallpaperCache.js'

const { t } = useI18n()
const statusBarPx = getStatusBarPx()
const { titleStyle } = useCollapsingTitle({
	mode: 'bar',
	statusBarPx,
	fontStartRpx: 40,
	fontEndRpx: 34,
	leftStartPercent: 16,
})
const kind = ref('like')
const tabs = computed(() => [
	{ key: 'like', label: t('tab_like') },
	{ key: 'collect', label: t('tab_collect') },
	{ key: 'history', label: t('tab_history') },
	{ key: 'affirmation', label: t('tab_affirmation') },
])
const pageTitle = computed(() => {
	if (kind.value === 'affirmation') return t('affirmations')
	if (kind.value === 'collect') return t('collections')
	if (kind.value === 'history') return t('history')
	if (kind.value === 'like') return t('likes')
	return t('my_content')
})
const list = ref([])
const affirmations = ref([])
const templates = ref([])
const draft = ref('')
const editingId = ref(null)
const savingAff = ref(false)
const draftLen = computed(() => (draft.value || '').length)
const folders = ref([])
const folderId = ref(null)
const page = ref(1)
const hasMore = ref(true)
const loadingMore = ref(false)
const PAGE_SIZE = 20
const folderSheetOpen = ref(false)
const folderSheetItems = ref([])
const folderSheetTarget = ref(null)
const moveSheetOpen = ref(false)
const moveSheetItems = ref([])
const moveSheetQuote = ref(null)
const folderDialogOpen = ref(false)
const folderDialogMode = ref('create')
const folderDialogName = ref('')
const folderDialogTarget = ref(null)
const clearDialogOpen = ref(false)
/** 防止 H5 onShow 与 onLoad 首屏双拉 */
let booted = false
let skipNextShow = false
let loading = false

onLoad((q) => {
	// 必须在 onLoad 里设 kind 并拉数：H5 上 onMounted 可能早于 onLoad，
	// 否则会按默认 like 拉完再切到 collect，列表/文件夹错位。
	kind.value = (q && q.kind) || 'like'
	booted = true
	skipNextShow = true
	load(true)
})

onShow(() => {
	if (!booted || loading) return
	if (skipNextShow) {
		skipNextShow = false
		return
	}
	if (kind.value === 'collect' || kind.value === 'like' || kind.value === 'affirmation') {
		load(true)
	}
})

function goBack() {
	safeBack('/pages/profile/profile')
}

function cacheKey() {
	return assetsListKey(kind.value, kind.value === 'collect' ? folderId.value : 0)
}

/** 拉取收藏夹：缓存秒开 + 静默刷新 */
function loadFoldersSilent() {
	const { refresh } = silentListRefresh(
		ASSETS_FOLDERS_KEY,
		async () => {
			const res = await apiFolders()
			return { results: res.results || [] }
		},
		(payload) => {
			folders.value = payload?.results || []
			if (!folderId.value && folders.value.length) {
				folderId.value = folders.value[0].id
			}
		},
	)
	return refresh
}

async function loadFolders() {
	try {
		await loadFoldersSilent()
	} catch (e) {}
}

async function loadTemplates() {
	try {
		const res = await apiAffirmationTemplates()
		templates.value = res.results || []
	} catch (e) {
		templates.value = []
	}
}

function applyListPage1(payload) {
	const rows = payload?.results || []
	if (kind.value === 'affirmation') {
		affirmations.value = rows
		if (!rows.length) loadTemplates()
	} else {
		list.value = rows
	}
	page.value = 2
	const totalPages = payload?.pagination?.total_pages || 1
	hasMore.value = 1 < totalPages
}

/** 首屏静默刷新当前 kind；有缓存不挡 UI */
function bootstrapList() {
	const key = cacheKey()
	const { hydrated, refresh } = silentListRefresh(
		key,
		async () => {
			const params = { currentPage: 1, pageSize: PAGE_SIZE }
			if (kind.value === 'affirmation') {
				const res = await apiAffirmations(params)
				return { results: res.results || [], pagination: res.pagination || null }
			}
			if (kind.value === 'collect') {
				const res = await apiMyAssets('collect', folderId.value, params)
				return { results: res.results || [], pagination: res.pagination || null }
			}
			const res = await apiMyAssets(kind.value, null, params)
			return { results: res.results || [], pagination: res.pagination || null }
		},
		applyListPage1,
	)
	if (!hydrated) loadingMore.value = true
	return refresh
		.catch(() => {})
		.finally(() => { loadingMore.value = false })
}

/** 按 kind/folder 拉取；reset=首页静默，翻页才 loading */
async function load(reset = true) {
	if (!reset) {
		if (loadingMore.value || !hasMore.value || loading) return
		loadingMore.value = true
		try {
			const next = page.value
			const params = { currentPage: next, pageSize: PAGE_SIZE }
			if (kind.value === 'affirmation') {
				const res = await apiAffirmations(params)
				const rows = res.results || []
				affirmations.value = affirmations.value.concat(rows)
				const totalPages = res.pagination?.total_pages || 1
				hasMore.value = next < totalPages
			} else if (kind.value === 'collect') {
				if (!folderId.value) await loadFolders()
				const res = await apiMyAssets('collect', folderId.value, params)
				const rows = res.results || []
				list.value = list.value.concat(rows)
				const totalPages = res.pagination?.total_pages || 1
				hasMore.value = next < totalPages
			} else {
				const res = await apiMyAssets(kind.value, null, params)
				const rows = res.results || []
				list.value = list.value.concat(rows)
				const totalPages = res.pagination?.total_pages || 1
				hasMore.value = next < totalPages
			}
			page.value = next + 1
		} finally {
			loadingMore.value = false
		}
		return
	}

	if (loading) return
	loading = true
	hasMore.value = true
	page.value = 1
	try {
		if (kind.value === 'collect') {
			await loadFolders()
			if (!folderId.value) {
				list.value = []
				return
			}
		}
		await bootstrapList()
	} finally {
		loading = false
	}
}

function switchKind(next) {
	kind.value = next
	editingId.value = null
	draft.value = ''
	savingAff.value = false
	if (next === 'affirmation') list.value = []
	else affirmations.value = []
	hasMore.value = true
	load(true)
}

function selectFolder(id) {
	folderId.value = id
	hasMore.value = true
	load(true)
}

function invalidateListCache() {
	clearPageCache(cacheKey())
	if (kind.value === 'collect') clearPageCache(ASSETS_FOLDERS_KEY)
}

function openFolderDialog(mode, folder = null) {
	folderDialogMode.value = mode
	folderDialogTarget.value = folder
	folderDialogName.value = folder?.name || ''
	folderDialogOpen.value = true
}

async function onFolderDialogConfirm() {
	const name = (folderDialogName.value || '').trim()
	if (!name) return
	if (folderDialogMode.value === 'rename' && folderDialogTarget.value) {
		await apiFolderSave({ id: folderDialogTarget.value.id, name })
		clearPageCache(ASSETS_FOLDERS_KEY)
		loadFolders()
		return
	}
	const res = await apiFolderSave({ name })
	invalidateListCache()
	await loadFolders()
	folderId.value = res.results?.id || folderId.value
	hasMore.value = true
	load(true)
}

function folderActions(f) {
	folderSheetTarget.value = f
	folderSheetItems.value = f.is_default
		? [{ code: 'rename', label: t('rename') }]
		: [
			{ code: 'rename', label: t('rename') },
			{ code: 'delete', label: t('delete') },
		]
	folderSheetOpen.value = true
}

async function onFolderSheetSelect({ value }) {
	const f = folderSheetTarget.value
	if (!f) return
	if (value === 'rename') {
		openFolderDialog('rename', f)
		return
	}
	if (value === 'delete' && !f.is_default) {
		await apiFolderDelete(f.id)
		invalidateListCache()
		folderId.value = null
		hasMore.value = true
		load(true)
	}
}

function moveCollect(q) {
	const targets = folders.value.filter((f) => f.id !== folderId.value)
	if (!targets.length) {
		uni.showToast({ title: t('empty'), icon: 'none' })
		return
	}
	moveSheetQuote.value = q
	moveSheetItems.value = targets.map((f) => ({ code: String(f.id), label: f.name }))
	moveSheetOpen.value = true
}

async function onMoveSheetSelect({ value }) {
	const q = moveSheetQuote.value
	if (!q) return
	await apiCollect(q.id, Number(value))
	invalidateListCache()
	hasMore.value = true
	load(true)
}

async function uncollect(id) {
	await apiUncollect(id)
	invalidateListCache()
	hasMore.value = true
	load(true)
}

async function unlike(id) {
	try {
		await apiLike(id, false)
		invalidateListCache()
		hasMore.value = true
		await load(true)
	} catch (e) {}
}

function clearHistoryConfirm() {
	clearDialogOpen.value = true
}

async function doClearHistory() {
	try {
		await apiHistoryClear()
		invalidateListCache()
		list.value = []
		hasMore.value = false
		uni.showToast({ title: t('cleared'), icon: 'none' })
	} catch (e) {}
}

function useTemplate(tpl) {
	draft.value = (tpl.content || '').slice(0, 160)
	editingId.value = null
}

function editAff(a) {
	editingId.value = a.id
	draft.value = a.content || ''
}

function cancelEditAff() {
	editingId.value = null
	draft.value = ''
}

async function saveAff() {
	const content = (draft.value || '').trim()
	if (!content || savingAff.value) return
	if (content.length > 160) {
		uni.showToast({ title: t('write_affirm'), icon: 'none' })
		return
	}
	savingAff.value = true
	try {
		const payload = { content }
		if (editingId.value) payload.id = editingId.value
		await apiAffirmationSave(payload)
		draft.value = ''
		editingId.value = null
		invalidateListCache()
		hasMore.value = true
		await load(true)
	} catch (e) {
		// http 层已 toast
	} finally {
		savingAff.value = false
	}
}

async function delAff(id) {
	try {
		await apiAffirmationDelete(id)
		if (editingId.value === id) cancelEditAff()
		invalidateListCache()
		hasMore.value = true
		await load(true)
	} catch (e) {}
}

function goShare(q) {
	uni.navigateTo({
		url: `/pagesA/share/share?id=${q.id}`,
	})
}

onReachBottom(() => load(false))
</script>

<style lang="scss" scoped>
@import '../../styles/selah-theme.scss';

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
	padding: 0 0 16rpx;
	box-sizing: border-box;
	min-height: 88rpx;
}
.nav-pill {
	@include selah-nav-circle;
	position: relative;
	z-index: 2;
	flex-shrink: 0;
}
.nav-ico { width: 48rpx; height: 48rpx; }
.nav-title {
	@include selah-display-title;
}
.nav-spacer {
	width: 88rpx;
	height: 88rpx;
	flex-shrink: 0;
	visibility: hidden;
}
.tabs {
	position: relative;
	z-index: 1;
	display: flex;
	flex-direction: row;
	margin-bottom: 24rpx;
	flex-wrap: wrap;
}
.tab {
	margin-right: 12rpx;
	margin-bottom: 12rpx;
	padding: 16rpx 28rpx;
	border-radius: 32rpx;
	background: $selah-card;
	color: $selah-muted;
	font-size: 26rpx;
}
.tab.on { background: $selah-ink; color: #ffffff; }
.folder-bar {
	display: flex;
	flex-direction: row;
	align-items: center;
	margin-bottom: 20rpx;
	gap: 12rpx;
}
.folders {
	flex: 1;
	width: 0;
	white-space: nowrap;
}
.folders-inner {
	display: inline-flex;
	flex-direction: row;
	align-items: center;
	padding: 4rpx 0;
}
.folder {
	display: inline-flex;
	align-items: center;
	padding: 12rpx 24rpx;
	margin-right: 12rpx;
	background: $selah-card;
	border-radius: 32rpx;
	font-size: 24rpx;
	flex-shrink: 0;
}
.folder.on { background: $selah-ink; color: #fff; }
.add {
	color: $selah-ink;
	font-size: 24rpx;
	font-weight: 600;
	flex-shrink: 0;
	white-space: nowrap;
}
.hist-bar {
	display: flex;
	justify-content: flex-end;
	margin-bottom: 12rpx;
}
.hist-clear {
	font-size: 24rpx;
	color: $selah-muted;
	padding: 8rpx 4rpx;
}
.q {
	padding: 32rpx;
	margin-bottom: 16rpx;
	background: $selah-card;
	border-radius: $selah-radius-card;
	color: $selah-ink;
}
.q-body {
	display: block;
	font-family: $selah-font-display;
	font-size: 32rpx;
	line-height: 1.45;
	color: $selah-ink;
}
.q-cite {
	display: block;
	margin-top: 12rpx;
	font-size: 22rpx;
	color: $selah-muted;
}
.aff-pane {
	display: flex;
	flex-direction: column;
}
.composer {
	background: $selah-card;
	border-radius: $selah-radius-card;
	padding: 28rpx 32rpx 24rpx;
	margin-bottom: 24rpx;
}
.composer-input {
	width: 100%;
	min-height: 160rpx;
	font-family: $selah-font-display;
	font-size: 32rpx;
	line-height: 1.45;
	color: $selah-ink;
	box-sizing: border-box;
}
.composer-foot {
	display: flex;
	flex-direction: row;
	align-items: center;
	justify-content: space-between;
	margin-top: 20rpx;
	padding-top: 16rpx;
	border-top: 1rpx solid $selah-divider;
}
.composer-count {
	font-size: 22rpx;
	color: $selah-muted;
}
.composer-actions {
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 20rpx;
}
.composer-cancel {
	font-size: 26rpx;
	color: $selah-muted;
	padding: 12rpx 8rpx;
}
.composer-save {
	min-width: 140rpx;
	padding: 16rpx 36rpx;
	border-radius: $selah-radius-pill;
	background: $selah-ink;
	display: flex;
	align-items: center;
	justify-content: center;
}
.composer-save.disabled {
	opacity: 0.35;
}
.composer-save-text {
	font-size: 26rpx;
	font-weight: 600;
	color: #ffffff;
}
.empty-soft {
	margin-top: 48rpx;
}
.empty-title {
	display: block;
	margin-bottom: 28rpx;
}
.tpl-block {
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: stretch;
	gap: 16rpx;
	padding: 0 8rpx;
	box-sizing: border-box;
}
.tpl-hint {
	font-size: 24rpx;
	color: $selah-muted;
	text-align: left;
	margin-bottom: 4rpx;
}
.tpl-chip {
	background: $selah-card;
	border-radius: $selah-radius-card;
	padding: 28rpx 32rpx;
	text-align: left;
}
.tpl-text {
	font-family: $selah-font-display;
	font-size: 28rpx;
	line-height: 1.45;
	color: $selah-ink;
}
.folder-dialog-input {
	width: 100%;
	margin: 8rpx 0 28rpx;
	padding: 20rpx 24rpx;
	background: #f5f5f5;
	border-radius: 20rpx;
	font-size: 28rpx;
	color: #191919;
	box-sizing: border-box;
}
.row-actions {
	display: flex;
	flex-direction: row;
	margin-top: 12rpx;
}
.del {
	color: #e07a7a;
	font-size: 22rpx;
	margin-left: 24rpx;
	flex-shrink: 0;
}
.link {
	color: $selah-ink-soft;
	font-size: 22rpx;
	display: inline-block;
	margin-top: 16rpx;
}
.row-actions .link {
	margin-top: 0;
	margin-right: 24rpx;
	display: inline-block;
}
.row-actions .del {
	margin-left: 0;
}
.empty {
	color: $selah-muted;
	text-align: center;
	margin-top: 80rpx;
	font-size: 26rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
}
.empty-art {
	width: 200rpx;
	height: 200rpx;
	border-radius: 32rpx;
	margin-bottom: 20rpx;
	opacity: 0.85;
}
.tip { color: $selah-muted; text-align: center; padding: 16rpx; font-size: 22rpx; }
</style>
