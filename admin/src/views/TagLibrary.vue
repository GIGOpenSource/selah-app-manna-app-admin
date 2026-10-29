<!--
  标签管理：类型 Tab、当前类型上下文、标签列表。交互对齐原型，样式走后台标准。
-->
<template>
  <div class="cms-page">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      title="隐性标签仅维护 selah。英文名是打标钥匙；西语、葡语留空时，保存会按英文机翻补上。"
    />

    <div class="container">
      <div class="cms-type-head">
        <el-tabs v-model="activeKey" class="cms-type-tabs" @tab-change="selectType">
          <el-tab-pane v-for="t in types" :key="t.key" :name="t.key">
            <template #label>
              <span class="cms-tab-label">
                <span class="cms-tab-name">{{ typeName(t) }}</span>
                <i v-if="t.translation_status === 'incomplete'" class="cms-tab-dot" title="西语或葡语未齐" />
                <span class="cms-tab-count">{{ t.tag_count || 0 }}</span>
              </span>
            </template>
          </el-tab-pane>
        </el-tabs>
        <el-button type="primary" plain :icon="CirclePlusFilled" @click="openTypeModal()">
          新建一级标签
        </el-button>
      </div>

      <div v-if="currentType" class="cms-type-bar">
        <div class="cms-type-meta">
          <span class="cms-type-meta-label">当前标签类型</span>
          <strong>{{ typeName(currentType) }}</strong>
          <el-tag size="small" type="primary">适用内容：{{ currentType.scope_label || scopeLabel(currentType.scope) }}</el-tag>
          <el-tag size="small" :type="currentType.required ? 'warning' : 'info'">
            {{ currentType.required ? '必填' : '选填' }}
          </el-tag>
          <el-tag v-if="currentType.locked" size="small">系统固定</el-tag>
          <el-tag
            v-if="translationStatusView(currentType)"
            size="small"
            :type="translationStatusView(currentType).type"
          >
            {{ translationStatusView(currentType).label }}
          </el-tag>
        </div>
        <el-button
          link
          type="primary"
          :disabled="!!currentType.locked"
          @click="openTypeModal(currentType)"
        >
          {{ currentType.locked ? '系统固定，不可编辑' : '编辑一级标签' }}
        </el-button>
      </div>

      <div class="pro-search">
        <LangSwitch v-model="listLang" />
        <el-input
          v-model="q"
          clearable
          placeholder="搜索三语内容或 ID"
          style="width: 240px"
          @keyup.enter="loadTags(1)"
        />
        <el-select v-model="status" style="width: 140px" @change="loadTags(1)">
          <el-option label="全部状态" value="all" />
          <el-option label="已启用" value="enabled" />
          <el-option label="已停用" value="disabled" />
        </el-select>
        <el-select v-model="translationStatus" style="width: 140px" @change="loadTags(1)">
          <el-option label="翻译状态" value="all" />
          <el-option label="三语齐全" value="complete" />
          <el-option label="非三语齐全" value="incomplete" />
        </el-select>
        <div class="pro-search-actions">
          <el-button @click="toggleManage">{{ managing ? '退出管理' : '管理' }}</el-button>
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
                    <span>下载模板（不带ID），批量新增二级标签</span>
                  </span>
                </el-dropdown-item>
                <el-dropdown-item command="replace">
                  <span class="drop-item">
                    <strong>导入替换旧内容</strong>
                    <span>上传「导出管理」导出的表格（带ID），覆盖修改</span>
                  </span>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button type="primary" :icon="CirclePlusFilled" @click="openTagModal()">
            新建「{{ currentType ? typeName(currentType) : '' }}」标签
          </el-button>
        </div>
      </div>

      <div v-if="managing" class="cms-batch-bar">
        <strong>已选 {{ selectedIds.length }}</strong>
        <div>
          <el-button :disabled="!selectedIds.length" @click="runExport">批量导出</el-button>
          <el-button type="danger" :disabled="!selectedIds.length" @click="onBulkDelete">批量删除</el-button>
        </div>
      </div>

      <el-table
        ref="tableRef"
        :data="rows"
        v-loading="loading"
        class="allow-wrap"
        row-key="id"
        @selection-change="onSelectionChange"
      >
        <el-table-column v-if="managing" type="selection" width="48" />
        <el-table-column type="index" label="序号" width="72" :index="rowNo" />
        <el-table-column label="ID" width="96" sortable :sort-method="sortById">
          <template #default="{ row }">
            <span class="cms-id">#{{ row.id }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="nameColumnLabel" min-width="220">
          <template #default="{ row }">
            <div :class="{ 'is-missing': nameCell(row).missing }">{{ nameCell(row).primary }}</div>
            <div v-if="nameCell(row).missing && nameCell(row).original" class="cms-hint">{{ nameCell(row).original }}</div>
          </template>
        </el-table-column>
        <el-table-column label="翻译" width="128">
          <template #default="{ row }">
            <el-tag v-if="translationStatusView(row)" :type="translationStatusView(row).type" size="small">
              {{ translationStatusView(row).label }}
            </el-tag>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="使用次数" width="120">
          <template #default="{ row }">{{ row.uses || 0 }} 次</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">
              {{ row.enabled ? '已启用' : '已停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openTagModal(row)">编辑</el-button>
            <el-button link type="primary" @click="toggleTag(row)">
              {{ row.enabled ? '停用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        class="pagination"
        background
        layout="total, prev, pager, next, jumper"
        :total="total"
        v-model:current-page="page"
        :page-size="PAGE_SIZE"
        @current-change="loadTags"
      />
    </div>

    <el-dialog v-model="tagVisible" :title="tagForm.id ? '编辑标签' : '新建标签'" width="640px" destroy-on-close>
      <p class="cms-hint" style="margin: -8px 0 16px">当前类型：{{ currentType ? typeName(currentType) : '' }}</p>
      <el-form label-width="168px">
        <LocaleCopyFields
          variant="form"
          en-label="标签名称（英语）"
          es-label="标签名称（西语）"
          pt-label="标签名称（葡语）"
          en-placeholder="例如：Peace"
          es-placeholder="例如：Paz"
          pt-placeholder="例如：Paz"
          :en="tagForm.name"
          :es="tagForm.name_es"
          :pt="tagForm.name_pt"
          @update:en="tagForm.name = $event"
          @update:es="tagForm.name_es = $event"
          @update:pt="tagForm.name_pt = $event"
        />
        <el-form-item label="启用标签">
          <el-switch v-model="tagForm.enabled" />
          <div class="cms-hint">停用后不再出现在新内容的选择器中。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="tagVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTag">保存标签</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="typeVisible" :title="typeForm.key ? '编辑一级标签' : '新建一级标签'" width="640px" destroy-on-close>
      <p class="cms-hint" style="margin: -8px 0 16px">
        {{ typeForm.key ? '修改后，该类型下所有具体标签自动继承新的适用内容。' : '新一级标签建立后，可继续在该类型下新增具体标签。' }}
      </p>
      <el-form label-width="180px">
        <LocaleCopyFields
          variant="form"
          en-label="类型名称（英语）"
          es-label="类型名称（西语）"
          pt-label="类型名称（葡语）"
          en-placeholder="例如：Faith Stage"
          es-placeholder="例如：Etapa de fe"
          pt-placeholder="例如：Etapa da fé"
          :en="typeForm.label"
          :es="typeForm.label_es"
          :pt="typeForm.label_pt"
          @update:en="typeForm.label = $event"
          @update:es="typeForm.label_es = $event"
          @update:pt="typeForm.label_pt = $event"
        />
        <el-form-item required label="适用内容">
          <el-select v-model="typeForm.scope" style="width: 100%">
            <el-option label="文字" value="text" />
            <el-option label="壁纸" value="wallpaper" />
            <el-option label="文字／壁纸" value="both" />
          </el-select>
          <div class="cms-hint">选择“文字”或“文字／壁纸”后，该类型会出现在上传语录页面。</div>
        </el-form-item>
        <el-form-item label="上传内容时必填">
          <el-switch v-model="typeForm.required" />
          <div class="cms-hint">开启后，对应范围的内容在发布时必须至少选择一个该类型的标签。</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="typeVisible = false">取消</el-button>
        <el-button type="primary" @click="saveType">
          {{ typeForm.key ? '保存修改' : '创建并进入' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importOpen" :title="importKind === 'create' ? '导入新内容' : '导入替换旧内容'" width="720px" destroy-on-close>
      <template v-if="importKind === 'create'">
        <div class="import-block">
          <strong>1. 下载模板</strong>
          <p class="cms-hint">表头为英语名称、西语名称、葡语名称、状态，不带 ID。下面两行只是预览，不会写进文件。</p>
          <el-button :loading="downloadingTemplate" @click="downloadTemplate('create')">下载模板</el-button>
          <el-table :data="createSamples" size="small" style="margin-top: 12px">
            <el-table-column prop="en" label="英语名称" />
            <el-table-column prop="es" label="西语名称" />
            <el-table-column prop="pt" label="葡语名称" />
            <el-table-column prop="status" label="状态" width="80" />
          </el-table>
        </div>
        <div class="import-block">
          <strong>2. 上传内容</strong>
          <p class="cms-hint">只导入到当前一级「{{ currentType ? typeName(currentType) : '' }}」。</p>
          <ul class="import-rules">
            <li>每一行都是新增，不能带二级 ID。</li>
            <li>英语名称必填，不能和已有标签或表内其他行重名（忽略大小写）。</li>
            <li>西语、葡语留空则保存时按英文机翻。</li>
            <li>状态填「是 / 否」，留空按「否」处理。</li>
          </ul>
        </div>
      </template>
      <template v-else>
        <p class="cms-hint" style="margin-top: 0">表格要从「管理」里的批量导出得到，表头须为：二级 ID、英语名称、西语名称、葡语名称、状态。</p>
        <ul class="import-rules">
          <li>按二级 ID 覆盖，不能新增。</li>
          <li>空格子不修改。改了英语名称后，引用这个标签的内容会跟着变。</li>
          <li>二级 ID 必须属于当前一级标签，且不能重复。</li>
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
      <el-table v-if="importErrors.length" :data="importErrors" size="small" max-height="240" style="margin-top: 12px">
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import {
  fetchTagTypes, saveTagType, fetchLibraryTags, saveLibraryTag, setLibraryTagStatus,
  deleteLibraryTags, exportLibraryTags, downloadTagImportTemplate, importTagsFile,
} from '../api'
import LocaleCopyFields from '../components/LocaleCopyFields.vue'
import LangSwitch from '../components/LangSwitch.vue'
import { scopeLabel } from '../utils/tagLibrary'
import { localeCell, normalizeImportErrors, translationStatusView } from '../utils/locales'
import { usePageSelection } from '../utils/pageSelection'

const types = ref([])
const activeKey = ref('theme')
const rows = ref([])
const total = ref(0)
const page = ref(1)
const PAGE_SIZE = 50
const q = ref('')
const status = ref('all')
const translationStatus = ref('all')
const listLang = ref('en')
const managing = ref(false)
const loading = ref(false)
const importOpen = ref(false)
const importKind = ref('create')
const importFile = ref(null)
const importErrors = ref([])
const importing = ref(false)
const downloadingTemplate = ref(false)
const createSamples = [
  { en: 'Peace', es: 'Paz', pt: '', status: '是' },
  { en: 'Morning', es: '', pt: 'Manhã', status: '否' },
]
const tagVisible = ref(false)
const typeVisible = ref(false)
const tagForm = ref({})
const typeForm = ref({})
const allTags = ref([])

const currentType = computed(() => types.value.find((t) => t.key === activeKey.value))
const {
  tableRef, selectedIds, onSelectionChange, restoreSelection, clearSelection,
} = usePageSelection(rows)
const nameColumnLabel = computed(() => ({ en: '标签名称（英语）', es: '标签名称（西语）', pt: '标签名称（葡语）' }[listLang.value]))

function nameCell(row) {
  return localeCell(row, listLang.value, { en: 'name', es: 'name_es', pt: 'name_pt' })
}

function typeName(t) {
  return t?.label || ''
}

function rowNo(index) {
  return (page.value - 1) * PAGE_SIZE + index + 1
}
function sortById(a, b) {
  return Number(a.id) - Number(b.id)
}

async function loadTypes() {
  const res = await fetchTagTypes()
  types.value = res.results || []
  if (!types.value.some((t) => t.key === activeKey.value) && types.value[0]) {
    activeKey.value = types.value[0].key
  }
}

async function loadTags(p = page.value) {
  page.value = typeof p === 'number' ? Math.max(1, p) : 1
  const params = { type: activeKey.value, currentPage: page.value, pageSize: PAGE_SIZE }
  if (q.value) params.q = q.value
  if (status.value === 'enabled') params.enabled = 1
  if (status.value === 'disabled') params.enabled = 0
  if (translationStatus.value !== 'all') params.translation_status = translationStatus.value
  loading.value = true
  try {
    const res = await fetchLibraryTags(params)
    rows.value = res.results || []
    total.value = res.pagination?.total || rows.value.length
    if (managing.value) await restoreSelection()
  } finally {
    loading.value = false
  }
}

async function loadAllTags() {
  const res = await fetchLibraryTags({ currentPage: 1, pageSize: 500 })
  allTags.value = res.results || []
}

function selectType(key) {
  activeKey.value = key
  q.value = ''
  status.value = 'all'
  translationStatus.value = 'all'
  page.value = 1
  clearSelection()
  loadTags(1)
}

function toggleManage() {
  managing.value = !managing.value
  clearSelection()
}

async function runExport() {
  if (!selectedIds.value.length) return
  try {
    await exportLibraryTags({ ids: selectedIds.value.join(','), type: activeKey.value })
    try {
      await ElMessageBox.confirm('已导出带二级 ID 的表格。', '导出完成', {
        confirmButtonText: '完成并退出导出管理',
        cancelButtonText: '留在管理',
      })
      managing.value = false
      clearSelection()
    } catch { /* 留在管理 */ }
  } catch (e) {
    ElMessage.error(e.message || e.msg || '导出失败')
  }
}

async function onBulkDelete() {
  const picked = selectedIds.value
  if (!picked.length) return
  const names = rows.value.filter((row) => picked.includes(row.id)).map((row) => row.name)
  const extra = picked.length - names.length
  const list = names.concat(extra > 0 ? [`以及其他 ${extra} 个已选标签`] : []).join('、')
  try {
    await ElMessageBox.confirm(`删除后不可从本页恢复：${list}`, '确认删除二级标签', {
      type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消',
    })
  } catch { return }
  try {
    await deleteLibraryTags(picked)
    ElMessage.success(`已删除 ${picked.length} 个标签`)
    clearSelection()
    await Promise.all([loadTypes(), loadTags(), loadAllTags()])
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}

function openImport(kind) {
  importKind.value = kind === 'replace' ? 'replace' : 'create'
  importFile.value = null
  importErrors.value = []
  importOpen.value = true
}

function onImportFile(file) {
  importFile.value = file?.raw || null
}

async function downloadTemplate(mode) {
  downloadingTemplate.value = true
  try {
    await downloadTagImportTemplate(mode)
    ElMessage.success('已下载模板')
  } catch (e) {
    ElMessage.error(e.message || e.msg || '模板下载失败')
  } finally {
    downloadingTemplate.value = false
  }
}

async function runImport() {
  if (!importFile.value) {
    ElMessage.warning('请选择要上传的文件')
    return
  }
  importing.value = true
  importErrors.value = []
  try {
    const res = await importTagsFile(importFile.value, { mode: importKind.value, type: activeKey.value })
    const data = res.results || res.data || {}
    const errors = normalizeImportErrors(data.errors)
    if (errors.length) {
      importErrors.value = errors
      ElMessage.error(res.message || '有一行校验失败，整表未导入')
      return
    }
    ElMessage.success(importKind.value === 'replace' ? '已按二级 ID 覆盖' : '已导入新标签')
    importOpen.value = false
    await Promise.all([loadTypes(), loadTags(1), loadAllTags()])
  } catch (e) {
    const errors = normalizeImportErrors(e?.results?.errors || e?.errors)
    if (errors.length) {
      importErrors.value = errors
      ElMessage.error(e.message || e.msg || '有一行校验失败，整表未导入')
    } else {
      ElMessage.error(e.message || e.msg || '导入失败')
    }
  } finally {
    importing.value = false
  }
}

function openTagModal(row) {
  tagForm.value = row
    ? { id: row.id, name: row.name, name_es: row.name_es || '', name_pt: row.name_pt || '', enabled: row.enabled }
    : { name: '', name_es: '', name_pt: '', enabled: true }
  tagVisible.value = true
}

async function saveTag() {
  if (!String(tagForm.value.name || '').trim()) {
    ElMessage.warning('请填写 English 标签名称')
    return
  }
  const dup = (allTags.value || []).find((t) => (
    t.type === activeKey.value
    && t.id !== tagForm.value.id
    && String(t.name || '').toLowerCase() === tagForm.value.name.trim().toLowerCase()
  ))
  if (dup) {
    ElMessage.warning('当前类型下已存在同名标签')
    return
  }
  try {
    const name = String(tagForm.value.name || '').trim()
    const payload = {
      type: activeKey.value,
      name,
      name_en: name,
      name_es: String(tagForm.value.name_es || '').trim(),
      name_pt: String(tagForm.value.name_pt || '').trim(),
      enabled: !!tagForm.value.enabled,
    }
    if (tagForm.value.id) payload.id = tagForm.value.id
    await saveLibraryTag(payload)
    ElMessage.success(tagForm.value.id ? '标签已更新' : '标签已创建，并可在语录中选择')
    tagVisible.value = false
    await Promise.all([loadTypes(), loadTags(), loadAllTags()])
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  }
}

async function toggleTag(row) {
  try {
    await setLibraryTagStatus(row.id, !row.enabled)
    ElMessage.success(row.enabled ? '标签已停用' : '标签已启用')
    await Promise.all([loadTypes(), loadTags(), loadAllTags()])
  } catch (e) {
    ElMessage.error(e.message || '操作失败')
  }
}

function openTypeModal(row) {
  if (row?.locked) {
    ElMessage.warning('该类型为系统固定类型，不能修改')
    return
  }
  typeForm.value = row
    ? {
      key: row.key,
      label: row.label,
      label_es: row.label_es || '',
      label_pt: row.label_pt || '',
      scope: row.scope,
      required: !!row.required,
    }
    : { label: '', label_es: '', label_pt: '', scope: 'text', required: false }
  typeVisible.value = true
}

async function saveType() {
  const label = String(typeForm.value.label || '').trim()
  if (!label) {
    ElMessage.warning('请填写 English 类型名称')
    return
  }
  const dup = types.value.find((t) => (
    t.key !== typeForm.value.key
    && String(t.label || '').toLowerCase() === label.toLowerCase()
  ))
  if (dup) {
    ElMessage.warning('已存在同名标签类型')
    return
  }
  try {
    const payload = {
      label,
      label_en: label,
      label_es: String(typeForm.value.label_es || '').trim(),
      label_pt: String(typeForm.value.label_pt || '').trim(),
      scope: typeForm.value.scope,
      required: !!typeForm.value.required,
    }
    if (typeForm.value.key) payload.key = typeForm.value.key
    const res = await saveTagType(payload)
    const key = res.results?.key
    ElMessage.success(typeForm.value.key ? '一级标签已更新，下方标签已自动继承' : `“${label}”已创建，请继续新增具体标签`)
    typeVisible.value = false
    await loadTypes()
    if (key) selectType(key)
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  }
}

onMounted(async () => {
  await loadTypes()
  await Promise.all([loadTags(1), loadAllTags()])
})

let searchTimer
watch(q, () => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => loadTags(1), 200)
})
</script>

<style scoped>
.cms-tab-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-warning);
  flex: none;
}
.is-missing {
  color: var(--el-color-warning);
}
.import-block + .import-block {
  margin-top: 20px;
}
.import-rules {
  margin: 8px 0 12px;
  padding-left: 18px;
  color: var(--pro-text-secondary, #606266);
  font-size: 13px;
  line-height: 1.6;
}
</style>
