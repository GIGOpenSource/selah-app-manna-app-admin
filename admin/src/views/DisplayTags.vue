<!--
  显性标签：语录模块/合集、壁纸筛选/合集，编辑态与统一发布。
-->
<template>
  <div class="cms-page">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="模块和合集标题默认露出英/西/葡。西语、葡语留空时保存会机翻；改完后仍需发布，App 才会看到新标题。手机预览读取已发布版本。"
    />

    <div v-show="!editing" class="cms-display-switch">
      <el-radio-group v-model="surface" @change="onSurfaceChange">
        <el-radio-button label="quote">语录显性标签</el-radio-button>
        <el-radio-button label="wallpaper">壁纸显性标签</el-radio-button>
      </el-radio-group>
    </div>

    <div v-show="!editing" class="cms-display-layout">
      <div class="cms-display-intro">
        <h2>{{ surface === 'quote' ? '语录显性标签结构' : '壁纸显性标签结构' }}</h2>
        <p v-if="surface === 'quote'">
          App 中先显示语录模块标题，下面展示语录合集标题。
        </p>
        <p v-else>
          在手机预览中点击筛选标签，就能查看对应的壁纸和合集。这里只展示已发布的壁纸<br>
          合集、标签里没有符合条件的壁纸时，会自动隐藏。
        </p>
        <div class="cms-display-legend">
          <template v-if="surface === 'quote'">
            <div>
              <strong>Words Column（语录模块标题）</strong>
              <span>用来把多个语录合集归在一起，方便用户查找。</span>
            </div>
            <div>
              <strong>Words Collection Title（语录合集标题）</strong>
              <span>把相关语录放进同一个合集。每个合集都需要选择一个所属语录模块。</span>
            </div>
          </template>
          <template v-else>
            <div>
              <strong>Wallpaper Filter Tags（壁纸筛选标签）</strong>
              <span>用户在 App 中通过这些标签筛选壁纸。<br>这里的标签来自「隐性标签」中适用于壁纸的二级标签，一级分类只用于后台分组。标签需要已启用，并打开「前端展示」，才会出现在 App 中。</span>
            </div>
            <div>
              <strong>Wallpaper Collection Title（壁纸合集标题）</strong>
              <span>把一组壁纸放在同一个合集里，在这里设置合集名称，以及是否在 App 中展示。<br>进入合集后，可以手动选择要放入的壁纸，也可以按隐性标签自动收录壁纸。</span>
            </div>
          </template>
        </div>
      </div>
      <div>
        <PhonePreview
          :kind="surface"
          :preview-lang="previewLang"
          :published-rows="store.publishedRows.value"
          :published-filters="store.publishedWallpaperFilters.value"
          :wallpaper-items="store.wallpaperItems.value"
        />
        <p class="cms-hint cms-preview-note">空译文回落英文，与 App 按系统语言取展示名的规则一致。</p>
      </div>
    </div>

    <div v-show="surface === 'quote' && !editing" class="container cms-structure-panel" style="margin-top: 16px">
      <div class="pro-toolbar">
        <div>
          <div class="pro-toolbar-title">Words Column（语录模块标题）</div>
          <p class="cms-hint">用于 App 语录页的一级内容分组。</p>
        </div>
        <el-button type="primary" :icon="CirclePlusFilled" @click="quoteRef?.openColumn()">＋ 新建文字模块标题</el-button>
      </div>
      <div class="pro-form-pad">
        <div class="cms-lang-row">
          <LangSwitch v-model="previewLang" />
          <span class="cms-lang-miss">
            <el-icon><WarningFilled /></el-icon>
            缺少翻译：西语 {{ quoteMiss.es }} 个、葡语 {{ quoteMiss.pt }} 个
          </span>
        </div>
        <QuoteStructure
          ref="quoteRef"
          :lang="previewLang"
          :columns="store.columns.value"
          :collections="store.collections.value"
          :types="store.types.value"
          :dirty="store.dirty.value"
          :publishing="publishing"
          :discarding="discarding"
          :moving="store.moving.value"
          @publish="onPublish"
          @discard="onDiscard"
          @move="onMove"
          @move-parent="onMoveParent"
          @add-collection="openQuoteCollection"
          @edit-collection="openQuoteCollection"
          @save-column="saveColumn"
          @delete-column="onDeleteColumn"
          @delete-collection="onDeleteCollection"
        />
      </div>
    </div>

    <div v-show="surface === 'wallpaper' && !editing">
      <div class="cms-display-type-tabs">
        <button type="button" :class="{ active: wpTab === 'filter' }" @click="wpTab = 'filter'">
          <strong>Wallpaper Filter Tags（壁纸筛选标签）</strong>
          <span>由隐性标签同步，配置前端展示</span>
        </button>
        <button type="button" :class="{ active: wpTab === 'collection' }" @click="wpTab = 'collection'">
          <strong>Wallpaper Collection Title（壁纸合集标题）</strong>
          <span>运营合集，手动或自动收录</span>
        </button>
      </div>
      <div class="container cms-structure-panel">
        <div class="pro-form-pad cms-structure-body cms-structure-publish">
          <StructurePublishBar
            :dirty="store.dirty.value"
            :publishing="publishing"
            :discarding="discarding"
            dirty-title="有未发布的壁纸结构调整"
            idle-hint="调整筛选标签或合集后，需要统一确认发布。"
            dirty-hint="筛选标签或合集已调整，需要统一确认发布后才会同步 App。"
            @publish="onPublish"
            @discard="onDiscard"
          />
        </div>
        <div v-if="wpTab === 'filter'" class="pro-form-pad">
          <div class="cms-lang-row">
            <LangSwitch v-model="previewLang" />
            <span class="cms-lang-miss">
              <el-icon><WarningFilled /></el-icon>
              缺少翻译：西语 {{ filterMiss.es }} 个、葡语 {{ filterMiss.pt }} 个
            </span>
          </div>
          <WallpaperFilters
            :lang="previewLang"
            :filters="store.wallpaperFilters.value"
            @toggle="onToggleFilter"
          />
        </div>
        <template v-else>
          <div class="pro-toolbar">
            <div>
              <div class="pro-toolbar-title">Wallpaper Collection Title（壁纸合集标题）</div>
              <p class="cms-hint">在外层维护合集名称与展示状态；点击「进入合集」配置收录规则。</p>
            </div>
            <el-button type="primary" :icon="CirclePlusFilled" @click="wpRef?.openGroup()">＋ 新建壁纸合集标题</el-button>
          </div>
          <div class="pro-form-pad">
            <div class="cms-lang-row">
              <LangSwitch v-model="previewLang" />
              <span class="cms-lang-miss">
                <el-icon><WarningFilled /></el-icon>
                缺少翻译：西语 {{ groupMiss.es }} 个、葡语 {{ groupMiss.pt }} 个
              </span>
            </div>
            <WallpaperCollections
              ref="wpRef"
              :lang="previewLang"
              :groups="store.wallpaperGroups.value"
              :types="store.types.value"
              :moving="store.moving.value"
              @move="onMove"
              @enter="openWallpaperCollection"
              @save-group="saveWallpaperGroup"
            />
          </div>
        </template>
      </div>
    </div>

    <QuoteCollectionEditor
      v-if="editing === 'quote-collection'"
      ref="quoteEditorRef"
      :model="editorModel"
      :visible-columns="store.visibleColumns.value"
      :applicable-types="store.applicableTypes.value"
      :tags="store.allTags.value"
      :items="store.quoteItems.value"
      :preview="preview"
      @cancel="editing = ''"
      @save="saveQuoteCollection"
      @delete="onDeleteEditingCollection"
    />
    <WallpaperCollectionEditor
      v-if="editing === 'wallpaper-collection'"
      ref="wpEditorRef"
      :model="editorModel"
      :applicable-types="store.applicableTypes.value"
      :tags="store.allTags.value"
      :items="store.wallpaperItems.value"
      :preview="preview"
      @cancel="editing = ''"
      @save="saveWallpaperCollection"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled, WarningFilled } from '@element-plus/icons-vue'
import { useDisplayStructure } from './display/useDisplayStructure'
import PhonePreview from './display/PhonePreview.vue'
import StructurePublishBar from './display/StructurePublishBar.vue'
import QuoteStructure from './display/QuoteStructure.vue'
import QuoteCollectionEditor from './display/QuoteCollectionEditor.vue'
import WallpaperFilters from './display/WallpaperFilters.vue'
import WallpaperCollections from './display/WallpaperCollections.vue'
import WallpaperCollectionEditor from './display/WallpaperCollectionEditor.vue'
import { validateDisplayForm } from '../utils/tagLibrary'
import { localeNamePayload } from '../utils/locales'
import LangSwitch from '../components/LangSwitch.vue'

const store = useDisplayStructure()
const surface = ref('quote')
const wpTab = ref('filter')
const editing = ref('')
const publishing = ref(false)
const discarding = ref(false)
const quoteRef = ref(null)
const wpRef = ref(null)
const quoteEditorRef = ref(null)
const wpEditorRef = ref(null)
const editorModel = ref({})
const previewLang = ref('en')

function missCount(list) {
  const rows = list || []
  return {
    es: rows.filter((row) => !String(row.name_es || '').trim()).length,
    pt: rows.filter((row) => !String(row.name_pt || '').trim()).length,
  }
}
const quoteMiss = computed(() => missCount([...(store.columns.value || []), ...(store.collections.value || [])]))
const groupMiss = computed(() => missCount(store.wallpaperGroups.value))
const filterMiss = computed(() => missCount(store.wallpaperFilters.value))
const preview = reactive({ items: [], count: 0, enabled_count: 0 })
let previewTimer

async function onSurfaceChange() {
  editing.value = ''
  await store.load(surface.value)
}

async function onPublish() {
  publishing.value = true
  try {
    await store.publish()
  } catch (e) {
    ElMessage.error(e.message || '发布失败')
  } finally {
    publishing.value = false
  }
}

async function onDiscard() {
  const isQuote = store.kind.value === 'quote'
  try {
    await ElMessageBox.confirm(
      isQuote
        ? '将丢弃语录显性结构的未发布调整，恢复为当前已发布版本。'
        : '将丢弃壁纸显性结构的未发布调整，恢复为当前已发布版本。',
      '取消发布',
      { type: 'warning', confirmButtonText: '取消发布', cancelButtonText: '再想想' },
    )
  } catch {
    return
  }
  discarding.value = true
  try {
    await store.discard()
  } catch (e) {
    ElMessage.error(e.message || '取消发布失败')
  } finally {
    discarding.value = false
  }
}

async function onMove(id, direction) {
  try { await store.move(id, direction) }
  catch (e) { ElMessage.error(e.message || '调整失败') }
}

async function onMoveParent(id, parentId) {
  try { await store.moveParent(id, parentId) }
  catch (e) { ElMessage.error(e.message || '移动失败') }
}

async function confirmDeleteDisplayTags(message, title) {
  try {
    await ElMessageBox.confirm(message, title, {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    return true
  } catch {
    return false
  }
}

async function onDeleteColumn(column) {
  const children = store.collections.value.filter((c) => Number(c.parent_id) === Number(column.id))
  const ids = [column.id, ...children.map((c) => c.id)]
  const ok = await confirmDeleteDisplayTags(
    children.length
      ? `删除文字模块标题「${column.name_en}」及其下 ${children.length} 个文字合集标题？删除后需确认发布才同步 App。`
      : `删除文字模块标题「${column.name_en}」？删除后需确认发布才同步 App。`,
    '删除文字模块标题',
  )
  if (!ok) return
  try {
    await store.deleteTags(ids.length > 1 ? ids : column.id)
    ElMessage.success('已删除，确认发布后同步前端')
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}

async function onDeleteCollection(col) {
  const ok = await confirmDeleteDisplayTags(
    `删除文字合集标题「${col.name_en}」？删除后需确认发布才同步 App。`,
    '删除文字合集标题',
  )
  if (!ok) return
  try {
    await store.deleteTags(col.id)
    if (editing.value === 'quote-collection' && editorModel.value?.id === col.id) editing.value = ''
    ElMessage.success('已删除，确认发布后同步前端')
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}

async function onDeleteEditingCollection() {
  const form = quoteEditorRef.value?.form
  if (!form?.id) return
  await onDeleteCollection({ id: form.id, name_en: form.name_en })
}

async function saveColumn(form) {
  try {
    const siblings = store.columns.value
    await store.saveRow({
      id: form.id,
      display_type: 'column',
      name_en: form.name_en.trim(),
      ...localeNamePayload(form),
      sort: form.id ? (siblings.find((c) => c.id === form.id)?.sort || 1) : Math.max(0, ...siblings.map((c) => c.sort || 0)) + 1,
      status: form.visible ? 'published' : 'disabled',
      mode: 'manual',
    })
    ElMessage.success(`文字模块标题${form.id ? '更新' : '新建'}成功，确认发布后同步前端`)
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  }
}

function emptyCollection(parentId) {
  const siblings = store.collections.value.filter((c) => Number(c.parent_id) === Number(parentId))
  return {
    id: null, name_en: '', name_es: '', name_pt: '', parent_id: parentId, vip: false,
    sort: Math.max(0, ...siblings.map((c) => c.sort || 0)) + 1,
    mode: 'auto', match: 'any', conditions: [], manual_ids: [], status: 'disabled',
  }
}

function openQuoteCollection(row) {
  if (row?.display_type === 'collection') {
    editorModel.value = {
      id: row.id, name_en: row.name_en, name_es: row.name_es || '', name_pt: row.name_pt || '', parent_id: row.parent_id, vip: !!row.vip,
      sort: row.sort, mode: row.mode, match: row.match,
      conditions: [...(row.conditions || [])],
      manual_ids: [...(row.manual_ids || [])],
      status: row.status,
    }
  } else {
    editorModel.value = emptyCollection(row?.id)
  }
  editing.value = 'quote-collection'
}

async function saveQuoteCollection(status) {
  const form = quoteEditorRef.value?.form
  if (!form) return
  const err = validateDisplayForm(form, '语录')
  if (err) {
    ElMessage.warning(err)
    return
  }
  if (!form.parent_id) {
    ElMessage.warning('请选择所属文字模块')
    return
  }
  try {
    await store.saveRow({
      id: form.id,
      display_type: 'collection',
      name_en: form.name_en.trim(),
      ...localeNamePayload(form),
      parent_id: form.parent_id,
      vip: !!form.vip,
      sort: form.sort,
      mode: form.mode,
      match: form.match,
      conditions: form.conditions,
      manual_ids: form.manual_ids,
      status,
    })
    ElMessage.success('文字合集标题保存成功，确认发布后同步前端')
    editing.value = ''
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  }
}

async function saveWallpaperGroup(form) {
  try {
    const siblings = store.wallpaperGroups.value
    await store.saveRow({
      id: form.id,
      display_type: 'collection_group',
      name_en: form.name_en.trim(),
      ...localeNamePayload(form),
      sort: form.id ? (siblings.find((g) => g.id === form.id)?.sort || 1) : Math.max(0, ...siblings.map((g) => g.sort || 0)) + 1,
      status: form.visible ? 'published' : 'disabled',
      mode: form.id ? (siblings.find((g) => g.id === form.id)?.mode || 'manual') : 'manual',
      match: form.id ? (siblings.find((g) => g.id === form.id)?.match || 'any') : 'any',
      conditions: form.id ? (siblings.find((g) => g.id === form.id)?.conditions || []) : [],
      manual_ids: form.id ? (siblings.find((g) => g.id === form.id)?.manual_ids || []) : [],
      cover_url: form.cover_url || '',
    })
    ElMessage.success(`壁纸合集标题${form.id ? '更新' : '新建'}成功，确认发布后同步前端`)
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  }
}

function openWallpaperCollection(row) {
  editorModel.value = {
    id: row.id, name_en: row.name_en, name_es: row.name_es || '', name_pt: row.name_pt || '', sort: row.sort,
    mode: row.mode || 'manual', match: row.match || 'any',
    conditions: [...(row.conditions || [])],
    manual_ids: [...(row.manual_ids || [])],
    status: row.status,
    cover_url: row.cover_url || '',
  }
  editing.value = 'wallpaper-collection'
}

async function saveWallpaperCollection() {
  const form = wpEditorRef.value?.form
  if (!form) return
  const err = validateDisplayForm({ ...form, name_en: form.name_en || editorModel.value.name_en }, '壁纸')
  if (err) {
    ElMessage.warning(err)
    return
  }
  try {
    await store.saveRow({
      id: form.id || editorModel.value.id,
      display_type: 'collection_group',
      name_en: editorModel.value.name_en,
      ...localeNamePayload(editorModel.value),
      sort: editorModel.value.sort,
      status: editorModel.value.status,
      mode: form.mode,
      match: form.match,
      conditions: form.conditions,
      manual_ids: form.manual_ids,
      cover_url: form.cover_url || editorModel.value.cover_url || '',
    })
    ElMessage.success('合集内容已保存，确认发布后同步前端')
    editing.value = ''
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  }
}

async function onToggleFilter(tag, enabled) {
  try { await store.toggleFilter(tag, enabled) }
  catch (e) { ElMessage.error(e.message || '操作失败') }
}

async function refreshPreview() {
  const form = (editing.value === 'quote-collection' ? quoteEditorRef.value?.form : wpEditorRef.value?.form)
  if (!form) {
    preview.items = []
    return
  }
  try {
    const data = await store.preview({
      mode: form.mode,
      match: form.match,
      conditions: form.conditions,
      manual_ids: form.manual_ids,
    })
    preview.items = data.items || []
    preview.count = data.count || 0
    preview.enabled_count = data.enabled_count || 0
  } catch {
    preview.items = []
  }
}

watch(editing, () => {
  if (editing.value) refreshPreview()
  else preview.items = []
})
watch(
  () => [
    quoteEditorRef.value?.form?.mode,
    quoteEditorRef.value?.form?.match,
    quoteEditorRef.value?.form?.conditions,
    quoteEditorRef.value?.form?.manual_ids,
    wpEditorRef.value?.form?.mode,
    wpEditorRef.value?.form?.match,
    wpEditorRef.value?.form?.conditions,
    wpEditorRef.value?.form?.manual_ids,
  ],
  () => {
    clearTimeout(previewTimer)
    previewTimer = setTimeout(refreshPreview, 200)
  },
  { deep: true },
)

onMounted(async () => {
  await Promise.all([store.loadMeta(), store.loadPickers(), store.load('quote')])
})
</script>

<style scoped>
.cms-display-switch {
  display: flex;
  align-items: center;
  gap: 12px;
}
.cms-lang-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  margin-bottom: 16px;
}
.cms-lang-miss {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #f5222d;
  font-size: 13px;
  font-weight: 500;
}
.cms-preview-note {
  margin: 8px 0 0;
  max-width: 280px;
}
</style>
