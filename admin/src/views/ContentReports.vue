<!--
  内容举报：审核用户举报，可处理状态并可选软删语录。
-->
<template>
  <div>
    <div class="container">
      <ScopeFilter
        mode="browse"
        v-model:app-key="appKey"
        v-model:language="language"
        v-model:platform="platform"
        @change="load(1)"
      />
      <div class="pro-search">
        <el-input
          v-model="q"
          clearable
          placeholder="搜索语录/用户/详情"
          style="width: 240px"
          @keyup.enter="load(1)"
        />
        <el-select v-model="status" clearable placeholder="状态" style="width: 120px" @change="load(1)">
          <el-option label="待处理" value="pending" />
          <el-option label="已处理" value="handled" />
          <el-option label="已忽略" value="dismissed" />
        </el-select>
        <el-select v-model="reason" clearable placeholder="原因" style="width: 160px" @change="load(1)">
          <el-option
            v-for="r in reasonOpts"
            :key="r"
            :label="labelZh(REPORT_REASON_ZH, r)"
            :value="r"
          />
        </el-select>
        <div class="pro-search-actions">
          <el-button type="primary" @click="load(1)">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </div>
      </div>

      <div class="pro-toolbar">
        <div class="pro-toolbar-title">内容举报</div>
      </div>

      <el-table :data="rows" v-loading="loading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="App" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.app_key" size="small" :type="row.app_key === 'manna' ? 'warning' : 'primary'">
              {{ row.app_key }}
            </el-tag>
            <span v-else class="sub">—</span>
          </template>
        </el-table-column>
        <el-table-column label="用户" min-width="140">
          <template #default="{ row }">
            <div>{{ row.display_name || '-' }}</div>
            <div class="sub">uid {{ row.user_id }} · {{ row.device_id || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="语录" min-width="220">
          <template #default="{ row }">
            <div>#{{ row.content_id }} {{ row.quote_deleted ? '(已下架)' : '' }}</div>
            <div class="sub">{{ row.quote_content || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="原因" width="120">
          <template #default="{ row }">{{ labelZh(REPORT_REASON_ZH, row.reason) }}</template>
        </el-table-column>
        <el-table-column prop="detail" label="详情" min-width="140" />
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="时间" width="170" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'pending'">
              <el-button link type="primary" @click="onStatus(row, 'handled', false)">已处理</el-button>
              <el-button link type="danger" @click="onStatus(row, 'handled', true)">下架语录</el-button>
              <el-button link @click="onStatus(row, 'dismissed', false)">忽略</el-button>
            </template>
            <span v-else class="sub">—</span>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="pagination"
        background
        layout="total, prev, pager, next, jumper"
        :total="total"
        v-model:current-page="page"
        @current-change="load"
      />
    </div>
  </div>
</template>

<script setup>
/**
 * 内容举报处理：默认筛 pending；
 * onStatus 第三参 softDelete=true 时同时软删被举报语录（soft_delete_quote）。
 */
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchContentReports, updateContentReportStatus } from '../api'
import ScopeFilter from '../components/ScopeFilter.vue'
import { browseScopeParams } from '../utils/scopeParams'
import { labelZh, REPORT_REASON_ZH } from '../utils/enumZh'

const reasonOpts = ['inappropriate', 'hate', 'spam', 'copyright', 'other']
const rows = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const q = ref('')
/** 默认只看待处理，避免淹没已归档 */
const status = ref('pending')
const reason = ref(null)
const appKey = ref('')
const language = ref('')
const platform = ref('')

function statusLabel(s) {
  return { pending: '待处理', handled: '已处理', dismissed: '已忽略' }[s] || s
}
function statusType(s) {
  return { pending: 'warning', handled: 'success', dismissed: 'info' }[s] || 'info'
}

/** 分页加载举报列表 */
async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    const params = { currentPage: page.value, pageSize: 20 }
    if (q.value) params.q = q.value
    if (status.value) params.status = status.value
    if (reason.value) params.reason = reason.value
    Object.assign(params, browseScopeParams({ appKey: appKey.value, language: language.value, platform: platform.value }))
    const res = await fetchContentReports(params)
    rows.value = res.results || []
    total.value = res.pagination?.total || rows.value.length
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

/** 重置为默认「待处理」筛选项 */
function onReset() {
  q.value = ''
  status.value = 'pending'
  reason.value = null
  appKey.value = ''
  language.value = ''
  platform.value = ''
  load(1)
}

/**
 * 更新举报状态。
 * @param next handled|dismissed 等
 * @param softDelete true=处理并下架语录（soft_delete_quote）
 */
async function onStatus(row, next, softDelete) {
  const tip = softDelete
    ? `处理举报 #${row.id} 并下架语录 #${row.content_id}？`
    : `将举报 #${row.id} 标记为「${statusLabel(next)}」？`
  await ElMessageBox.confirm(tip, '确认', { type: softDelete ? 'warning' : 'info' })
  await updateContentReportStatus(row.id, next, softDelete)
  ElMessage.success('已更新')
  load()
}

onMounted(() => load(1))
</script>

<style scoped>
.sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
