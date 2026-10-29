<!--
  日常 PUSH 文案库：CRUD、库存统计红标、批量启用（≥30）。
  App 跟顶栏 currentAppKey，数据按 app_key 隔离。
-->
<template>
  <div>
    <div class="container">
      <!-- <el-alert
        v-if="shortageStats.length"
        type="error"
        :closable="false"
        show-icon
        style="margin-bottom: 12px"
        :title="`启用文案不足 ${minRequired} 条（语言×时段）`"
      >
        <div class="stats-wrap">
          <el-tag
            v-for="s in shortageStats"
            :key="`${s.lang}-${s.slot}`"
            type="danger"
            size="small"
            class="stats-tag"
          >
            {{ s.lang }} × {{ slotLabel(s.slot) }}：{{ s.enabled_count }}/{{ s.min_required || minRequired }}
          </el-tag>
        </div>
      </el-alert>
      <el-alert
        v-else-if="statsLoaded"
        type="success"
        :closable="false"
        show-icon
        style="margin-bottom: 12px"
        :title="`当前 App 各语言×时段启用文案均已 ≥ ${minRequired}`"
      /> -->

      <div class="pro-search">
        <el-input
          v-model="q"
          clearable
          placeholder="搜索标题/正文"
          style="width: 200px"
          @keyup.enter="load(1)"
        />
        <el-select v-model="lang" clearable filterable placeholder="语言" style="width: 130px" @change="load(1)">
          <el-option v-for="l in LANG_OPTIONS" :key="l.value" :label="l.label" :value="l.value" />
        </el-select>
        <el-select v-model="slot" clearable placeholder="时段" style="width: 150px" @change="load(1)">
          <el-option v-for="s in PUSH_SLOT_OPTIONS" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
        <el-select v-model="status" clearable placeholder="状态" style="width: 110px" @change="load(1)">
          <el-option label="启用" :value="1" />
          <el-option label="停用" :value="0" />
        </el-select>
        <el-input
          v-model="creator"
          clearable
          placeholder="创建人"
          style="width: 140px"
          @keyup.enter="load(1)"
        />
        <div class="pro-search-actions">
          <el-button type="primary" @click="load(1)">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </div>
      </div>

      <div class="pro-toolbar">
        <div class="pro-toolbar-title">日常 PUSH 文案库</div>
        <div class="pro-toolbar-actions">
          <el-button @click="openBatchEnable">批量启用</el-button>
          <el-button type="primary" :icon="CirclePlusFilled" @click="openEdit()">新建</el-button>
        </div>
      </div>

      <el-table :data="rows" v-loading="loading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="title" label="标题" min-width="140" />
        <el-table-column prop="body" label="正文" min-width="220" show-overflow-tooltip />
        <el-table-column prop="lang" label="语言" width="90" />
        <el-table-column label="时段" width="130">
          <template #default="{ row }">{{ slotLabel(row.slot) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="row.status === 1 ? 'success' : 'info'" size="small">
              {{ row.status_label || (row.status === 1 ? '启用' : '停用') }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="sort_order" label="排序" width="80" />
        <el-table-column prop="creator_name" label="创建人" width="100" />
        <el-table-column label="更新时间" width="178" fixed="right">
          <template #default="{ row }">{{ formatDateTime(row.updated_at) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button
              link
              :type="row.status === 1 ? 'warning' : 'success'"
              @click="onToggleStatus(row)"
            >
              {{ row.status === 1 ? '停用' : '启用' }}
            </el-button>
            <el-button link type="danger" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="pagination"
        background
        layout="total, prev, pager, next, jumper"
        :total="total"
        :page-size="pageSize"
        v-model:current-page="page"
        @current-change="load"
      />
    </div>

    <el-dialog v-model="visible" :title="form.id ? '编辑文案' : '新建文案'" width="560px" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="标题" required>
          <el-input v-model="form.title" maxlength="120" show-word-limit />
        </el-form-item>
        <el-form-item label="正文" required>
          <el-input v-model="form.body" type="textarea" :rows="4" maxlength="500" show-word-limit />
        </el-form-item>
        <el-form-item label="语言" required>
          <el-select v-model="form.lang" filterable style="width: 100%">
            <el-option v-for="l in LANG_OPTIONS" :key="l.value" :label="l.label" :value="l.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="时段" required>
          <el-select v-model="form.slot" style="width: 100%">
            <el-option v-for="s in PUSH_SLOT_OPTIONS" :key="s.value" :label="s.label" :value="s.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="form.sort_order" :min="0" />
        </el-form-item>
        <el-form-item label="状态">
          <div class="status-field">
            <el-radio-group v-model="form.status">
              <el-radio-button :label="0">停用</el-radio-button>
              <el-radio-button :label="1">启用</el-radio-button>
            </el-radio-group>
            <div class="sub status-tip">建议先停用录入，再点「批量启用」按语言×时段勾选启用</div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <!-- 批量启用：筛选停用文案后勾选提交 ids -->
    <el-dialog
      v-model="batchVisible"
      title="批量启用"
      width="860px"
      destroy-on-close
      top="6vh"
      @closed="onBatchClosed"
    >
      <el-alert
        :closable="false"
        show-icon
        :type="batchGateOk ? 'success' : 'warning'"
        style="margin-bottom: 12px"
        :title="batchRuleTitle"
      />
      <div class="pro-search" style="margin-bottom: 12px">
        <el-select
          v-model="batchLang"
          filterable
          placeholder="语言"
          style="width: 140px"
          @change="onBatchFilterChange"
        >
          <el-option v-for="l in LANG_OPTIONS" :key="l.value" :label="l.label" :value="l.value" />
        </el-select>
        <el-select
          v-model="batchSlot"
          placeholder="时段"
          style="width: 160px"
          @change="onBatchFilterChange"
        >
          <el-option v-for="s in PUSH_SLOT_OPTIONS" :key="s.value" :label="s.label" :value="s.value" />
        </el-select>
        <el-button type="primary" @click="loadBatchList(1, { resetSelection: true })">查询停用文案</el-button>
        <span class="sub" style="margin-left: 8px">
          {{ appKey() }} · 仅停用 · 已选 {{ batchSelectedIds.length }}
          <template v-if="!batchGateOk"> · 本次至少勾 {{ batchNeedSelect }} 条</template>
        </span>
      </div>
      <el-table
        ref="batchTableRef"
        :data="batchRows"
        v-loading="batchLoading"
        row-key="id"
        max-height="420"
        @selection-change="onBatchSelectionChange"
      >
        <el-table-column type="selection" width="48" :reserve-selection="true" />
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="title" label="标题" min-width="120" />
        <el-table-column prop="body" label="正文" min-width="180" show-overflow-tooltip />
        <el-table-column prop="lang" label="语言" width="80" />
        <el-table-column label="时段" width="120">
          <template #default="{ row }">{{ slotLabel(row.slot) }}</template>
        </el-table-column>
      </el-table>
      <el-pagination
        class="pagination"
        small
        background
        layout="total, prev, pager, next"
        :total="batchTotal"
        :page-size="batchPageSize"
        :pager-count="7"
        v-model:current-page="batchPage"
        @current-change="loadBatchList"
      />
      <template #footer>
        <el-button @click="batchVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="batchSaving"
          :disabled="!batchSelectedIds.length"
          @click="confirmBatchEnable"
        >
          启用选中（{{ batchSelectedIds.length }}）
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import {
  fetchPushCopies,
  savePushCopy,
  batchEnablePushCopies,
  fetchPushCopyStats,
} from '../api'
import { getAdminProduct } from '../utils/productContext'
import { LANG_OPTIONS, PUSH_SLOT_OPTIONS, PUSH_SLOT_ZH, labelZh } from '../utils/enumZh'

const rows = ref([])
const page = ref(1)
/** 与接口 page_size 对齐（默认 10），避免 total=37 却只显示 2 页 */
const pageSize = ref(10)
const total = ref(0)
const loading = ref(false)
const saving = ref(false)
const q = ref('')
const lang = ref('')
const slot = ref('')
const status = ref(null)
const creator = ref('')
const visible = ref(false)
const form = ref({})
const statsList = ref([])
const minRequired = ref(30)
const statsLoaded = ref(false)

const batchVisible = ref(false)
const batchLang = ref('en')
const batchSlot = ref('morning')
const batchRows = ref([])
const batchPage = ref(1)
/** 与接口默认 page_size 对齐，避免 total=31 却只算出 2 页 */
const batchPageSize = ref(10)
const batchTotal = ref(0)
const batchLoading = ref(false)
const batchSaving = ref(false)
const batchTableRef = ref(null)
/** 跨页勾选：id → row 摘要 */
const batchSelectedMap = ref(new Map())
const batchSelectedIds = computed(() => [...batchSelectedMap.value.keys()])
const syncingBatchSelection = ref(false)
/** 打开弹窗赋值语言/时段时跳过 @change，避免连续请求 */
const batchFilterSilent = ref(false)
/** 同语言×时段已启用条数 */
const batchEnabledCount = ref(0)
/** 同语言×时段文案总条数（启用+停用） */
const batchAllCount = ref(0)

/** 已启用 ≥30：可任意条数启用；否则需先凑满库并一次勾满差额 */
const batchGateOk = computed(() => batchEnabledCount.value >= minRequired.value)
const batchNeedSelect = computed(() =>
  batchGateOk.value ? 1 : Math.max(minRequired.value - batchEnabledCount.value, 1),
)
const batchRuleTitle = computed(() => {
  const langSlot = `${batchLang.value || '—'} × ${slotLabel(batchSlot.value || '')}`
  const enabled = batchEnabledCount.value
  const all = batchAllCount.value
  const min = minRequired.value
  if (batchGateOk.value) {
    return `${langSlot}：已启用 ${enabled} 条（≥${min}），本次可任意勾选启用`
  }
  return `${langSlot}：已启用 ${enabled}/${min}，文案共 ${all} 条。未满 ${min} 前须先录满 ${min} 条，且本次至少勾选 ${batchNeedSelect.value} 条一起启用`
})

const shortageStats = computed(() => (statsList.value || []).filter((s) => !s.ok))

function slotLabel(v) {
  return labelZh(PUSH_SLOT_ZH, v, v)
}

function formatDateTime(v) {
  if (!v) return '—'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return String(v).replace('T', ' ').slice(0, 19)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function appKey() {
  return getAdminProduct() || 'selah'
}

async function loadStats() {
  try {
    const res = await fetchPushCopyStats({ app_key: appKey() })
    const data = res.results || res
    statsList.value = data.list || []
    minRequired.value = data.min_required || 30
    statsLoaded.value = true
  } catch {
    statsList.value = []
    statsLoaded.value = false
  }
}

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    const params = {
      app_key: appKey(),
      currentPage: page.value,
      pageSize: pageSize.value,
    }
    if (q.value) params.q = q.value
    if (lang.value) params.lang = lang.value
    if (slot.value) params.slot = slot.value
    if (status.value !== null && status.value !== '') params.status = status.value
    if (creator.value) params.creator = creator.value
    const res = await fetchPushCopies(params)
    rows.value = Array.isArray(res.results) ? res.results : res.results ? [res.results] : []
    const pg = res.pagination || {}
    total.value = pg.total || rows.value.length
    if (pg.page_size) pageSize.value = Number(pg.page_size) || pageSize.value
  } catch (e) {
    ElMessage.error(e.message || e.msg || '加载失败')
  } finally {
    loading.value = false
  }
}

function onReset() {
  q.value = ''
  lang.value = ''
  slot.value = ''
  status.value = null
  creator.value = ''
  load(1)
}

function clearBatchSelection() {
  batchSelectedMap.value = new Map()
  batchTableRef.value?.clearSelection?.()
}

function onBatchFilterChange() {
  if (batchFilterSilent.value) return
  loadBatchList(1, { resetSelection: true })
}

async function openBatchEnable() {
  batchFilterSilent.value = true
  batchLang.value = lang.value || 'en'
  batchSlot.value = slot.value || 'morning'
  clearBatchSelection()
  batchVisible.value = true
  await nextTick()
  batchFilterSilent.value = false
  await loadBatchList(1)
}

function onBatchClosed() {
  batchRows.value = []
  clearBatchSelection()
  batchTotal.value = 0
  batchPage.value = 1
  batchEnabledCount.value = 0
  batchAllCount.value = 0
}

function onBatchSelectionChange(selection) {
  if (syncingBatchSelection.value) return
  const pageIds = new Set(batchRows.value.map((r) => r.id))
  const next = new Map(batchSelectedMap.value)
  for (const id of pageIds) {
    if (![...selection].some((r) => r.id === id)) next.delete(id)
  }
  for (const row of selection) {
    next.set(row.id, { id: row.id, title: row.title, lang: row.lang, slot: row.slot })
  }
  batchSelectedMap.value = next
}

async function syncBatchSelection() {
  const table = batchTableRef.value
  if (!table) return
  syncingBatchSelection.value = true
  await nextTick()
  for (const row of batchRows.value) {
    table.toggleRowSelection(row, batchSelectedMap.value.has(row.id))
  }
  syncingBatchSelection.value = false
}

/** 已启用数用列表接口 meta.enabled_count；总数 = 已启用 + 停用 total */
function applyBatchCounts(disabledTotal, enabledCount) {
  batchEnabledCount.value = Number(enabledCount) || 0
  batchAllCount.value = batchEnabledCount.value + (Number(disabledTotal) || 0)
}

/** 弹窗列表：每次只请求一次 push-copies（status=0）；翻页保留勾选 */
async function loadBatchList(p = batchPage.value, { resetSelection = false } = {}) {
  if (!batchLang.value || !batchSlot.value) {
    ElMessage.warning('请选择语言和时段')
    return
  }
  if (resetSelection) clearBatchSelection()
  batchPage.value = p
  batchLoading.value = true
  try {
    const res = await fetchPushCopies({
      app_key: appKey(),
      lang: batchLang.value,
      slot: batchSlot.value,
      status: 0,
      currentPage: batchPage.value,
      pageSize: batchPageSize.value,
    })
    batchRows.value = Array.isArray(res.results) ? res.results : []
    const pg = res.pagination || {}
    batchTotal.value = pg.total || batchRows.value.length
    // 以后端实际 page_size 为准，保证页数 = ceil(total / page_size)
    if (pg.page_size) batchPageSize.value = Number(pg.page_size) || batchPageSize.value
    applyBatchCounts(batchTotal.value, res.meta?.enabled_count)
    await syncBatchSelection()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '加载停用文案失败')
  } finally {
    batchLoading.value = false
  }
}

async function confirmBatchEnable() {
  const ids = batchSelectedIds.value
  if (!ids.length) {
    ElMessage.warning('请勾选要启用的文案')
    return
  }
  // 用弹窗内已写入的 meta.enabled_count 校验
  const enabled = batchEnabledCount.value
  const all = batchAllCount.value
  const min = minRequired.value
  const need = Math.max(min - enabled, 0)

  // 未满 30：库内同语言×时段须先有 ≥30 条记录
  if (enabled < min && all < min) {
    ElMessage.warning(
      `当前 ${batchLang.value} × ${slotLabel(batchSlot.value)} 仅有 ${all} 条文案，须先录满 ${min} 条后再批量启用`,
    )
    return
  }
  // 未满 30：本次勾选须至少补足到 30
  if (enabled < min && ids.length < need) {
    ElMessage.warning(
      `当前已启用 ${enabled} 条，未满 ${min} 前本次至少勾选 ${need} 条一起启用（已选 ${ids.length}）`,
    )
    return
  }

  batchSaving.value = true
  try {
    const res = await batchEnablePushCopies({
      app_key: appKey(),
      ids,
    })
    const data = res.results || res
    ElMessage.success(`已启用 ${data.enabled ?? ids.length} 条`)
    batchVisible.value = false
    await Promise.all([load(), loadStats()])
  } catch (e) {
    ElMessage.error(e.message || e.msg || '批量启用失败')
  } finally {
    batchSaving.value = false
  }
}

function openEdit(row) {
  form.value = row
    ? { ...row }
    : {
        title: '',
        body: '',
        lang: lang.value || 'en',
        slot: slot.value || 'morning',
        status: 0,
        sort_order: 10,
      }
  visible.value = true
}

async function save() {
  if (!(form.value.title || '').trim() || !(form.value.body || '').trim()) {
    ElMessage.warning('请填写标题和正文')
    return
  }
  if (!form.value.lang || !form.value.slot) {
    ElMessage.warning('请选择语言和时段')
    return
  }
  saving.value = true
  try {
    await savePushCopy({
      ...form.value,
      app_key: appKey(),
      title: form.value.title.trim(),
      body: form.value.body.trim(),
    })
    ElMessage.success('已保存')
    visible.value = false
    await Promise.all([load(), loadStats()])
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  } finally {
    saving.value = false
  }
}

async function onToggleStatus(row) {
  const next = row.status === 1 ? 0 : 1
  if (next === 1) {
    // 单条启用：仅当该语言×时段已启用 ≥30 才允许
    try {
      const res = await fetchPushCopies({
        app_key: appKey(),
        lang: row.lang,
        slot: row.slot,
        status: 1,
        currentPage: 1,
        pageSize: 1,
      })
      const enabled = res.pagination?.total ?? 0
      if (enabled < minRequired.value) {
        ElMessage.warning(
          `该语言×时段已启用 ${enabled}/${minRequired.value}，未满 ${minRequired.value} 请用「批量启用」一次勾满`,
        )
        return
      }
    } catch {
      /* 接口失败时仍走后端校验 */
    }
  }
  const tip = next === 1
    ? `启用文案 #${row.id}？`
    : `停用文案 #${row.id}？若会使启用数低于 ${minRequired.value} 将被拒绝。`
  try {
    await ElMessageBox.confirm(tip, '确认', { type: 'warning' })
    await savePushCopy({
      id: row.id,
      app_key: appKey(),
      lang: row.lang,
      slot: row.slot,
      title: row.title,
      body: row.body,
      status: next,
    })
    ElMessage.success(next === 1 ? '已启用' : '已停用')
    await Promise.all([load(), loadStats()])
  } catch (e) {
    if (e === 'cancel' || e?.action === 'cancel') return
    ElMessage.error(e?.message || e?.msg || '操作失败')
  }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm(`删除文案 #${row.id}？`, '提示', { type: 'warning' })
    await savePushCopy({ delete_id: row.id })
    ElMessage.success('已删除')
    await Promise.all([load(), loadStats()])
  } catch (e) {
    if (e === 'cancel' || e?.action === 'cancel') return
    ElMessage.error(e?.message || e?.msg || '删除失败')
  }
}

onMounted(async () => {
  await Promise.all([load(1), loadStats()])
})
</script>

<style scoped>
.sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.tip {
  margin: -4px 0 12px;
}
.status-field {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.status-tip {
  line-height: 1.4;
}
.stats-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}
.stats-tag {
  margin: 0;
}
</style>
