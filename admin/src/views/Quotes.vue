<!--
  语录列表 / 编辑 / 批量归类。显性归属只在「显性标签」维护。
-->
<template>
  <div class="cms-page">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="英语是语录正文的钥匙。西语、葡语留空时，保存和导入会按英文机翻补上；已有译文会保留。"
    />

    <el-tabs v-show="!editing" v-model="panel" style="margin-bottom: 8px" @tab-change="onPanelChange">
      <el-tab-pane label="语录配置" name="list" />
      <el-tab-pane label="回收站" name="trash" />
    </el-tabs>

    <div v-show="!editing" class="container">
      <p v-if="panel === 'trash'" class="plugins-tips">软删除的语录在此恢复；恢复后回到「语录配置」列表。</p>
      <p v-else class="plugins-tips">一级、二级标签来自隐性标签。语录进入哪个前端合集，请到「显性标签」维护。</p>
      <div class="pro-search quote-filters">
        <LangSwitch v-if="panel === 'list'" v-model="listLang" />
        <el-input
          v-model="q"
          clearable
          placeholder="搜索三语内容或 ID"
          style="width: 220px"
          @keyup.enter="load(1)"
        />
        <template v-if="panel === 'list'">
          <el-select v-model="tagType" style="width: 160px" @change="onPrimaryChange">
            <el-option label="全部一级标签" value="all" />
            <el-option
              v-for="t in textTypes"
              :key="t.key"
              :label="`${zhTypeLabel(t)}（${t.tag_count || 0}）`"
              :value="t.key"
            />
          </el-select>
          <el-select
            v-model="tagName"
            filterable
            :disabled="tagType === 'all'"
            placeholder="全部二级标签"
            style="width: 160px"
            @change="load(1)"
          >
            <el-option label="全部二级标签" value="all" />
            <el-option v-for="opt in secondaryOpts" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
          <el-select v-model="status" style="width: 120px" @change="load(1)">
            <el-option label="全部状态" value="all" />
            <el-option label="已启用" value="published" />
            <el-option label="已停用" value="disabled" />
          </el-select>
          <el-select v-model="translationStatus" style="width: 120px" @change="load(1)">
            <el-option label="翻译状态" value="all" />
            <el-option label="三语齐全" value="complete" />
            <el-option label="非三语齐全" value="incomplete" />
          </el-select>
          <el-select v-model="requiredTags" style="width: 120px" @change="load(1)">
            <el-option label="必填标签" value="all" />
            <el-option label="必填齐全" value="complete" />
            <el-option label="缺必填标签" value="missing" />
          </el-select>
        </template>
      </div>
      <div class="quote-list-bar">
        <div class="quote-summary">
          <span>共 {{ total }} 条</span>
          <template v-if="panel === 'list' && summary">
            <span class="quote-miss">
              <el-icon><WarningFilled /></el-icon>
              缺西语 {{ summary.missing_es ?? 0 }} 条、缺葡语 {{ summary.missing_pt ?? 0 }} 条（保存或导入时自动机翻）
            </span>
            <span class="quote-miss">
              <el-icon><WarningFilled /></el-icon>
              缺必填标签 {{ summary.missing_required_tags ?? 0 }} 条
            </span>
          </template>
        </div>
        <div class="quote-list-actions">
          <template v-if="panel === 'list'">
            <el-button :icon="Operation" @click="toggleBulk">{{ bulkMode ? '退出管理' : '管理' }}</el-button>
            <el-dropdown trigger="click" popper-class="import-drop" @command="openImport">
              <el-button>
                <el-icon><Upload /></el-icon>
                导入
                <el-icon class="el-icon--right"><ArrowDown /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="create">
                    <span class="drop-item">
                      <strong>导入新内容</strong>
                      <span>下载模板（不带ID），批量新增语录</span>
                    </span>
                  </el-dropdown-item>
                  <el-dropdown-item command="replace">
                    <span class="drop-item">
                      <strong>导入替换旧内容</strong>
                      <span>上传「管理」导出的表格（带ID），覆盖修改</span>
                    </span>
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button type="primary" :icon="CirclePlusFilled" @click="openEditor()">新建语录</el-button>
          </template>
          <el-button v-else @click="load(1)">刷新回收站</el-button>
        </div>
      </div>
      <div v-if="bulkMode" class="cms-batch-bar">
        <strong>已选 {{ selectedIds.length }}</strong>
        <div>
          <el-button :disabled="!selectedIds.length" @click="openBatch('add')">加标签</el-button>
          <el-button :disabled="!selectedIds.length" @click="openBatch('remove')">移除标签</el-button>
          <el-button :disabled="!selectedIds.length" :loading="exporting" @click="runExport">导出</el-button>
          <el-button type="danger" :disabled="!selectedIds.length" @click="onBulkDelete">批量删除</el-button>
        </div>
      </div>
      <el-table
        ref="tableRef"
        :data="rows"
        v-loading="loading"
        class="quote-table"
        row-key="id"
        table-layout="fixed"
        @selection-change="onSelectionChange"
      >
        <el-table-column v-if="bulkMode" type="selection" width="48" />
        <el-table-column type="index" label="序号" width="72" align="center" :index="rowNo" />
        <el-table-column label="ID" width="96" align="center" sortable :sort-method="sortById">
          <template #default="{ row }">
            <span class="cms-id">#{{ row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="contentColumnLabel" min-width="280" class-name="col-quote">
          <template #default="{ row }">
            <div v-if="contentCell(row).missing" class="quote-missing">
              <div class="quote-untranslated">未翻译</div>
              <div v-if="contentCell(row).original" class="quote-en">
                <span class="en-badge">EN</span>
                <el-tooltip :content="contentCell(row).original" placement="top" :show-after="300">
                  <span class="quote-en-text">{{ contentCell(row).original }}</span>
                </el-tooltip>
              </div>
            </div>
            <el-tooltip v-else :content="contentCell(row).primary" placement="top" :show-after="300">
              <span class="quote-line">{{ contentCell(row).primary }}</span>
            </el-tooltip>
          </template>
        </el-table-column>
        <el-table-column label="翻译" width="132" align="center">
          <template #default="{ row }">
            <div v-if="translationChips(row).length" class="pill-row">
              <el-tag v-for="chip in translationChips(row)" :key="chip" type="danger" size="small" effect="light">
                {{ chip }}
              </el-tag>
            </div>
            <el-tag v-else type="success" size="small" effect="light">齐全</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="必填标签" min-width="280" show-overflow-tooltip>
          <template #default="{ row }">
            <el-tag v-if="requiredCell(row).missing.length" type="danger" size="small" effect="light" class="cell-tag">
              缺 {{ requiredCell(row).missing.join('、') }}
            </el-tag>
            <el-tag v-else type="success" size="small" effect="light">齐全</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status === 1 ? '已启用' : '已停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="168" align="center" fixed="right">
          <template #default="{ row }">
            <span v-if="bulkMode">—</span>
            <template v-else-if="panel === 'trash'">
              <el-button link type="primary" @click="onRestore(row)">恢复</el-button>
            </template>
            <template v-else>
              <el-button link type="primary" @click="openEditor(row)">编辑</el-button>
              <el-button link type="primary" @click="toggleStatus(row)">
                {{ row.status === 1 ? '停用' : '启用' }}
              </el-button>
              <el-button link type="danger" @click="onSoftDelete(row)">删除</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="!loading && !rows.length" class="cms-empty">
        {{ hasFilters ? '没有找到符合条件的语录' : '还没有语录，点击右上角新建' }}
      </div>
      <el-pagination
        class="pagination"
        background
        layout="total, prev, pager, next, jumper"
        :total="total"
        v-model:current-page="page"
        :page-size="PAGE_SIZE"
        @current-change="load"
      />
    </div>

    <div v-if="editing" class="container">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="这里选择的标签全部来自隐性标签"
        description="停用标签不会出现在新内容选择器中，但历史已选会保留并标注已停用。"
      />
      <div class="pro-toolbar">
        <div>
          <div class="pro-toolbar-title">{{ form.id ? '编辑语录' : '新建语录' }}</div>
          <p class="cms-hint">维护英语正文和西/葡译文，以及后台归类。前端合集归属在「显性标签」中统一配置。</p>
        </div>
      </div>
      <div class="pro-form-pad">
        <div class="cms-form-grid">
          <LocaleCopyFields
            class="full"
            textarea
            en-label="英语内容"
            es-label="西语内容"
            pt-label="葡语内容"
            :en="form.content"
            :es="form.content_es"
            :pt="form.content_pt"
            @update:en="form.content = $event"
            @update:es="form.content_es = $event"
            @update:pt="form.content_pt = $event"
          />
          <div class="cms-section-head">
            <strong>后台归类</strong>
            <span>选项来自「隐性标签」。主主题驱动首页推荐。</span>
          </div>
          <div>
            <label class="cms-field-label">文字内容类型 <span :class="reqClass('content')">{{ reqText('content') }}</span></label>
            <TagSelector
              v-model="form.content_type"
              :options="withSelectedTags(allTags, 'content', form.content_type)"
              placeholder="选择内容类型"
            />
          </div>
          <div>
            <label class="cms-field-label">主主题 <span :class="reqClass('theme')">{{ reqText('theme') }}</span></label>
            <TagSelector
              v-model="form.theme"
              :options="withSelectedTags(allTags, 'theme', form.theme)"
              placeholder="选择主主题"
            />
          </div>
          <div>
            <label class="cms-field-label">生活场景 <span :class="reqClass('scenario')">{{ reqText('scenario', true) }}</span></label>
            <TagSelector
              v-model="form.scenario_tags"
              multiple
              :options="withSelectedTags(allTags, 'scenario', form.scenario_tags)"
              placeholder="搜索并选择生活场景"
            />
          </div>
          <div>
            <label class="cms-field-label">情绪 <span :class="reqClass('emotion')">{{ reqText('emotion', true) }}</span></label>
            <TagSelector
              v-model="form.emotion_tags"
              multiple
              :options="withSelectedTags(allTags, 'emotion', form.emotion_tags)"
              placeholder="搜索并选择情绪"
            />
          </div>
          <div v-for="t in customTextTypes" :key="t.key">
            <label class="cms-field-label">
              {{ zhTypeLabel(t) }}
              <span :class="t.required ? 'cms-req' : 'cms-hint'">{{ t.required ? '* 必填，可多选' : '选填，可多选' }}</span>
            </label>
            <TagSelector
              v-model="form.taxonomy[t.key]"
              multiple
              :options="withSelectedTags(allTags, t.key, form.taxonomy[t.key])"
              :placeholder="`搜索并选择${zhTypeLabel(t)}`"
            />
          </div>
        </div>
        <div class="cms-editor-foot">
          <span class="cms-editor-state">{{ footerState }}</span>
          <div>
            <el-button @click="editing = false">取消</el-button>
            <el-button v-if="form.status === 1" @click="save(0)">停用</el-button>
            <el-button v-if="form.status !== 1" @click="save(0)">保存为已停用</el-button>
            <el-button type="primary" @click="save(1)">{{ form.status === 1 ? '发布更新' : '发布' }}</el-button>
          </div>
        </div>
      </div>
    </div>

    <BatchTagDialog
      v-model="batchOpen"
      :op="batchOp"
      :types="textTypes"
      :tags="allTags"
      :count="selectedIds.length"
      @apply="applyBatch"
    />

    <el-dialog v-model="importOpen" :title="importKind === 'create' ? '导入新内容' : '导入替换旧内容'" width="760px" destroy-on-close>
      <template v-if="importKind === 'create'">
        <div class="import-block">
          <strong>1. 下载模板</strong>
          <p class="cms-hint">只有表头：英语内容、西语内容、葡语内容、标签、状态，不带 ID。下面两行只是预览，不会写进文件。</p>
          <el-button :loading="downloadingTemplate" @click="downloadTemplate('create')">下载模板</el-button>
          <el-table :data="createSamples" size="small" style="margin-top: 12px">
            <el-table-column prop="en" label="英语内容" min-width="160" />
            <el-table-column prop="es" label="西语内容" min-width="120" />
            <el-table-column prop="pt" label="葡语内容" min-width="120" />
            <el-table-column prop="tags" label="标签" min-width="140" />
            <el-table-column prop="status" label="状态" width="80" />
          </el-table>
        </div>
        <div class="import-block">
          <strong>2. 上传内容</strong>
          <ul class="import-rules">
            <li>每一行都是新增，不能带语录 ID。</li>
            <li>英语必填，不能和库内或表内英语重复（忽略大小写）。</li>
            <li>西语、葡语留空则按英文机翻。</li>
            <li>标签写成「一级/二级」，多个用英文逗号隔开，例如 Theme/Peace。必填的一级都要有。</li>
            <li>状态留空则停用。</li>
          </ul>
        </div>
      </template>
      <template v-else>
        <p class="cms-hint" style="margin-top: 0">表格要从「管理」导出得到。按语录 ID 覆盖，不能新增。</p>
        <ul class="import-rules">
          <li>西语、葡语留空则按英文机翻；其他空格子不修改。</li>
          <li>标签填了就整格替换，写成「一级/二级」，逗号隔开。</li>
          <li>状态留空则停用。回收站里的 ID、重复 ID 都会失败。</li>
        </ul>
      </template>
      <el-upload
        :auto-upload="false"
        :limit="1"
        accept=".csv,.xlsx,.xlsm,text/csv"
        :on-change="onImportFile"
        :on-remove="() => { importFile = null }"
      >
        <el-button>选择 CSV / Excel</el-button>
      </el-upload>
      <p class="cms-hint">有任何一行报错，整张表都不会导入。</p>
      <el-table v-if="importErrors.length" :data="importErrors" size="small" max-height="240" class="import-error-table">
        <el-table-column label="行" width="72" prop="row" />
        <el-table-column label="列" width="120" prop="column" />
        <el-table-column label="说明" min-width="240" prop="message" />
      </el-table>
      <template #footer>
        <el-button @click="importOpen = false">取消</el-button>
        <el-button type="primary" :loading="importing" @click="runImport">开始导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown, CirclePlusFilled, Operation, Upload, WarningFilled } from '@element-plus/icons-vue'
import {
  fetchQuotes, saveQuote, deleteQuote, restoreQuote,
  importQuotesFile, exportQuotes, downloadQuoteImportTemplate,
  fetchTagTypes, fetchLibraryTags, bulkQuoteTags,
} from '../api'
import TagSelector from '../components/TagSelector.vue'
import LocaleCopyFields from '../components/LocaleCopyFields.vue'
import LangSwitch from '../components/LangSwitch.vue'
import BatchTagDialog from '../components/BatchTagDialog.vue'
import { defaultCreateAppKey } from '../utils/scopeParams'
import {
  typeApplies, missingRequiredTypes, missingEnglish, quoteValues, zhTypeLabel,
  withSelectedTags,
} from '../utils/tagLibrary'
import { localeCell, normalizeImportErrors } from '../utils/locales'
import { usePageSelection } from '../utils/pageSelection'

const panel = ref('list')
const route = useRoute()
const editing = ref(false)
const bulkMode = ref(false)
const rows = ref([])
const page = ref(1)
const total = ref(0)
const PAGE_SIZE = 50
const q = ref('')
const tagType = ref('all')
const tagName = ref('all')
const status = ref('all')
const translationStatus = ref('all')
const requiredTags = ref('all')
const listLang = ref('en')
const summary = ref(null)
const loading = ref(false)
const types = ref([])
const allTags = ref([])
const form = ref(emptyForm())
const batchOpen = ref(false)
const batchOp = ref('add')
const importOpen = ref(false)
const importing = ref(false)
const exporting = ref(false)
const downloadingTemplate = ref(false)
const importKind = ref('create')
const importFile = ref(null)
const importErrors = ref([])
const createSamples = [
  { en: 'Peace begins with a quiet heart.', es: '', pt: '', tags: 'Theme/Peace', status: '停用' },
  { en: 'Morning light finds you here.', es: 'La luz de la mañana te encuentra.', pt: '', tags: 'Emotion/Hope', status: '启用' },
]

const textTypes = computed(() => types.value.filter((t) => typeApplies(t, 'text')))
const customTextTypes = computed(() =>
  types.value.filter((t) => typeApplies(t, 'text') && !['content', 'theme', 'scenario', 'emotion', 'visual'].includes(t.key)),
)
const secondaryOpts = computed(() => {
  if (tagType.value === 'all') return []
  return allTags.value
    .filter((t) => t.type === tagType.value)
    .map((t) => ({
      value: `${t.type}::${t.name}`,
      label: t.enabled ? t.name : `${t.name}（已停用）`,
    }))
})
const contentColumnLabel = computed(() => ({ en: '语录内容（英语）', es: '语录内容（西语）', pt: '语录内容（葡语）' }[listLang.value]))
const {
  tableRef, selectedIds, onSelectionChange, restoreSelection, clearSelection,
} = usePageSelection(rows)

function contentCell(row) {
  return localeCell(row, listLang.value, { en: 'content', es: 'content_es', pt: 'content_pt' })
}
function translationChips(row) {
  if (row?.translation_status === 'complete') return []
  const es = String(row?.content_es || '').trim()
  const pt = String(row?.content_pt || '').trim()
  const listed = Array.isArray(row?.missing_langs) ? row.missing_langs.map(String) : null
  const missEs = listed?.length
    ? listed.some((code) => code === 'es' || code === '西语')
    : !es
  const missPt = listed?.length
    ? listed.some((code) => code === 'pt' || code === '葡语')
    : !pt
  const chips = []
  if (missEs) chips.push('西缺')
  if (missPt) chips.push('葡缺')
  return chips
}
function requiredCell(row) {
  if (row.required_tags === 'complete') return { missing: [] }
  const missing = missingRequiredTypes(types.value, 'text', (key) => quoteValues(row, key))
  return { missing }
}
const footerState = computed(() => {
  if (!form.value.id) return '尚未保存'
  return form.value.status === 1 ? '已启用 · App 正在展示' : '已停用 · App 不展示'
})
const hasFilters = computed(() => !!(
  q.value
  || tagType.value !== 'all'
  || tagName.value !== 'all'
  || status.value !== 'all'
  || translationStatus.value !== 'all'
  || requiredTags.value !== 'all'
))

function rowNo(index) {
  return (page.value - 1) * PAGE_SIZE + index + 1
}
function sortById(a, b) {
  return Number(a.id) - Number(b.id)
}
function reqClass(key) {
  return types.value.find((x) => x.key === key)?.required ? 'cms-req' : 'cms-hint'
}
function reqText(key, multi = false) {
  const t = types.value.find((x) => x.key === key)
  if (t?.required) return multi ? '* 必填，可多选' : '*'
  return multi ? '选填，可多选' : '选填'
}
function emptyForm() {
  return {
    content: '', content_es: '', content_pt: '', auto_translate: true, language: 'en',
    app_key: defaultCreateAppKey('selah'),
    content_type: '', theme: '', scenario_tags: [], emotion_tags: [],
    taxonomy: {}, status: 0,
    interest_tags: [], faith_tags: [], topic_id: null,
    in_ops_pool: false, is_vip: false, sort_weight: 0,
  }
}

async function loadMeta() {
  const [tr, tagsRes] = await Promise.all([
    fetchTagTypes(),
    fetchLibraryTags({ currentPage: 1, pageSize: 500 }),
  ])
  types.value = tr.results || []
  allTags.value = tagsRes.results || []
}

function quoteFilterParams() {
  const params = { app_key: 'selah' }
  if (panel.value === 'trash') params.trashed = 1
  if (q.value) params.q = q.value
  if (panel.value !== 'list') return params
  if (status.value !== 'all') params.status = status.value
  if (translationStatus.value !== 'all') params.translation_status = translationStatus.value
  if (requiredTags.value !== 'all') params.required_tags = requiredTags.value
  if (tagType.value !== 'all') params.tag_type = tagType.value
  if (tagName.value !== 'all') {
    const [tt, tn] = String(tagName.value).split('::')
    if (tt) params.tag_type = tt
    if (tn) params.tag_name = tn
  }
  return params
}

async function load(p = page.value) {
  page.value = p
  const params = { ...quoteFilterParams(), currentPage: page.value, pageSize: PAGE_SIZE }
  loading.value = true
  try {
    const res = await fetchQuotes(params)
    rows.value = res.results || []
    total.value = res.pagination?.total || rows.value.length
    summary.value = res.meta?.summary || null
    if (bulkMode.value) await restoreSelection()
  } finally {
    loading.value = false
  }
}

function onPanelChange() {
  editing.value = false
  bulkMode.value = false
  clearSelection()
  load(1)
}
function onPrimaryChange() {
  tagName.value = 'all'
  load(1)
}
function toggleBulk() {
  bulkMode.value = !bulkMode.value
  clearSelection()
}
function openBatch(op) {
  if (!selectedIds.value.length) return
  batchOp.value = op
  batchOpen.value = true
}

async function applyBatch({ type, names }) {
  if (!selectedIds.value.length || !type || !names?.length) return
  try {
    await bulkQuoteTags({
      ids: selectedIds.value,
      operation: batchOp.value,
      taxonomy: { [type]: names },
    })
    ElMessage.success(`已为 ${selectedIds.value.length} 条语录${batchOp.value === 'add' ? '追加' : '移除'}标签，发布状态未改变`)
    load()
  } catch (e) {
    ElMessage.error(e.message || '批量失败')
  }
}

function openEditor(row) {
  if (row) {
    const tax = { ...(row.taxonomy || {}) }
    customTextTypes.value.forEach((t) => { if (!tax[t.key]) tax[t.key] = [] })
    form.value = {
      ...emptyForm(),
      id: row.id,
      content: row.content || '',
      content_es: row.content_es || '',
      content_pt: row.content_pt || '',
      auto_translate: row.auto_translate !== false,
      content_type: row.content_type || '',
      theme: row.theme || '',
      scenario_tags: [...(row.scenario_tags || [])],
      emotion_tags: [...(row.emotion_tags || [])],
      taxonomy: tax,
      status: row.status,
      interest_tags: [...(row.interest_tags || [])],
      faith_tags: [...(row.faith_tags || [])],
      topic_id: row.topic_id || null,
      in_ops_pool: !!row.in_ops_pool,
      is_vip: !!row.is_vip,
      sort_weight: row.sort_weight || 0,
    }
  } else {
    const tax = {}
    customTextTypes.value.forEach((t) => { tax[t.key] = [] })
    form.value = { ...emptyForm(), taxonomy: tax }
  }
  editing.value = true
}

function saveMessage(statusVal) {
  if (statusVal === 1) return '语录发布成功！'
  if (form.value.status === 1) return '语录停用成功！'
  return '语录保存成功！'
}

async function save(statusVal) {
  if (!String(form.value.content || '').trim()) {
    ElMessage.warning('请填写 English 内容')
    return
  }
  if (statusVal === 1) {
    const missing = missingRequiredTypes(types.value, 'text', (k) => quoteValues(form.value, k))
    if (missing.length) {
      ElMessage.warning(`发布前请先选择必填标签：${missing.join('、')}`)
      return
    }
  }
  try {
    await saveQuote({
      ...form.value,
      content: String(form.value.content || '').trim(),
      content_es: String(form.value.content_es || '').trim(),
      content_pt: String(form.value.content_pt || '').trim(),
      auto_translate: form.value.auto_translate !== false,
      app_key: defaultCreateAppKey('selah'),
      platform: '',
      language: 'en',
      status: statusVal,
    })
    ElMessage.success(saveMessage(statusVal))
    editing.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  }
}

async function toggleStatus(row) {
  if (row.status === 1) {
    try {
      await saveQuote({ id: row.id, status: 0 })
      ElMessage.success('语录已停用，App 不再展示')
      load()
    } catch (e) {
      ElMessage.error(e.message || '操作失败')
    }
    return
  }
  if (missingEnglish(row.content).length) {
    ElMessage.warning('启用前请补充 English 内容')
    return
  }
  const missing = missingRequiredTypes(types.value, 'text', (k) => quoteValues(row, k))
  if (missing.length) {
    ElMessage.warning(`启用前请先补充必填标签：${missing.join('、')}`)
    return
  }
  try {
    await saveQuote({
      id: row.id, status: 1, content: row.content,
      content_es: row.content_es || '',
      content_pt: row.content_pt || '',
      auto_translate: true,
      content_type: row.content_type, theme: row.theme,
      scenario_tags: row.scenario_tags, emotion_tags: row.emotion_tags,
      taxonomy: row.taxonomy,
    })
    ElMessage.success('语录已启用，App 将展示该内容')
    load()
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  }
}

async function onSoftDelete(row) {
  try {
    await ElMessageBox.confirm('删除后进入回收站，可随时恢复。若只需下架请用「停用」。', '确认删除语录', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
    })
  } catch { return }
  try {
    await deleteQuote(row.id)
    ElMessage.success('已移入回收站')
    load()
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}

async function onBulkDelete() {
  if (!selectedIds.value.length) return
  const names = selectedIds.value.slice(0, 8).map((id) => `#${id}`).join('、')
  try {
    await ElMessageBox.confirm(
      `将 ${selectedIds.value.length} 条语录移入回收站：${names}${selectedIds.value.length > 8 ? '…' : ''}。可随时恢复。`,
      '批量删除语录',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
  } catch { return }
  try {
    await deleteQuote(selectedIds.value)
    ElMessage.success(`已将 ${selectedIds.value.length} 条移入回收站`)
    clearSelection()
    load()
  } catch (e) {
    ElMessage.error(e.message || '批量删除失败')
  }
}

async function onRestore(row) {
  try {
    await restoreQuote(row.id)
    ElMessage.success('已恢复')
    load()
  } catch (e) {
    ElMessage.error(e.message || '恢复失败')
  }
}

function onImportFile(file) {
  importFile.value = file?.raw || null
}

function openImport(kind) {
  importKind.value = kind === 'replace' ? 'replace' : 'create'
  importFile.value = null
  importErrors.value = []
  importOpen.value = true
}

async function downloadTemplate(mode = 'create') {
  downloadingTemplate.value = true
  try {
    await downloadQuoteImportTemplate(mode === 'replace' ? 'replace' : 'create')
    ElMessage.success(mode === 'replace' ? '已下载替换模板' : '已下载新建模板')
  } catch (e) {
    ElMessage.error(e.message || e.msg || '模板下载失败')
  } finally {
    downloadingTemplate.value = false
  }
}

async function runExport() {
  exporting.value = true
  try {
    const params = quoteFilterParams()
    if (selectedIds.value.length) params.ids = selectedIds.value.join(',')
    await exportQuotes(params)
    ElMessage.success(selectedIds.value.length ? `已导出所选 ${selectedIds.value.length} 条` : '已导出当前筛选结果')
  } catch (e) {
    ElMessage.error(e.message || e.msg || '导出失败')
  } finally {
    exporting.value = false
  }
}

function showImportErrors(payload, fallback) {
  const data = payload?.results || payload?.data || payload || {}
  const errors = normalizeImportErrors(data.errors || payload?.errors)
  importErrors.value = errors
  ElMessage.error(payload?.message || payload?.msg || fallback || '有一行校验失败，整表未导入')
}

async function runImport() {
  const app = 'selah'
  const mode = importKind.value === 'replace' ? 'replace' : 'create'
  if (!importFile.value) {
    ElMessage.warning('请选择要上传的文件')
    return
  }
  importing.value = true
  importErrors.value = []
  try {
    const res = await importQuotesFile(importFile.value, app, mode)
    const data = res.results || res.data || {}
    const errors = normalizeImportErrors(data.errors)
    if (errors.length) {
      showImportErrors(res, '有一行校验失败，整表未导入')
      return
    }
    const imported = data.imported ?? data.updated ?? data.created ?? data.count ?? 0
    const filled = data.auto_filled
    const filledNote = filled ? '，空缺西/葡已机翻' : ''
    ElMessage.success(imported
      ? `成功${mode === 'replace' ? '替换' : '导入'} ${imported} 条${filledNote}`
      : (res.message || '导入成功'))
    importOpen.value = false
    importFile.value = null
    load(1)
  } catch (e) {
    const errors = normalizeImportErrors(e?.results?.errors || e?.errors || e?.data?.errors)
    if (errors.length) showImportErrors(e, '有一行校验失败，整表未导入')
    else ElMessage.error(e.message || e.msg || '导入失败')
  } finally {
    importing.value = false
  }
}

watch(panel, () => { editing.value = false })
let quoteSearchTimer
watch(q, () => {
  clearTimeout(quoteSearchTimer)
  quoteSearchTimer = setTimeout(() => load(1), 200)
})
onMounted(async () => {
  if (route.query.panel === 'trash') panel.value = 'trash'
  await loadMeta()
  await load(1)
})
</script>

<style scoped>
.quote-table :deep(td.col-quote .cell) {
  white-space: normal;
}
.quote-line {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.quote-missing {
  min-width: 0;
}
.quote-untranslated {
  color: #f5222d;
  font-weight: 500;
  line-height: 22px;
}
.quote-en {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin-top: 2px;
}
.quote-en :deep(.el-tooltip__trigger) {
  display: block;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.en-badge {
  flex: none;
  padding: 0 4px;
  border-radius: 2px;
  background: #f0f0f0;
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  line-height: 18px;
}
.quote-en-text {
  min-width: 0;
  overflow: hidden;
  color: rgba(0, 0, 0, 0.65);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pill-row {
  display: inline-flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.quote-table :deep(.cell-tag) {
  max-width: 100%;
  vertical-align: middle;
}
.quote-table :deep(.el-table__cell) {
  vertical-align: middle;
}
.cell-tag {
  max-width: 100%;
  box-sizing: border-box;
}
.cell-tag :deep(.el-tag__content) {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.quote-filters.pro-search {
  flex-wrap: nowrap;
}
.quote-list-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 24px 16px;
  border-bottom: 1px solid var(--pro-border);
}
.quote-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  color: var(--pro-text-secondary, #606266);
  font-size: 13px;
}
.quote-miss {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #f5222d;
  font-weight: 500;
}
.quote-miss :deep(.el-icon) {
  color: #f5222d;
}
.quote-list-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.quote-list-actions .el-button > .el-icon:first-child {
  margin-right: 4px;
}
.import-rules {
  margin: 0 0 16px;
  padding-left: 18px;
  color: var(--pro-text-secondary, #606266);
  font-size: 13px;
  line-height: 1.6;
}
.import-error-table {
  margin-top: 8px;
}
.is-missing {
  color: var(--el-color-warning);
}
.import-block + .import-block {
  margin-top: 20px;
}
</style>
