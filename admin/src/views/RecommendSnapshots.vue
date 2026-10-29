<!--
  推荐快照：按 batch / user / content 追溯「为何推荐」。
-->
<template>
  <div>
    <div class="container">
      <div class="pro-search">
        <el-input
          v-model="batchId"
          clearable
          placeholder="batch_id（Feed 返回）"
          style="width: 220px"
          @keyup.enter="load"
        />
        <el-input
          v-model="userId"
          clearable
          placeholder="user_id"
          style="width: 140px"
          @keyup.enter="load"
        />
        <el-input
          v-model="contentId"
          clearable
          placeholder="content_id"
          style="width: 140px"
          @keyup.enter="load"
        />
        <div class="pro-search-actions">
          <el-button type="primary" @click="load">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </div>
      </div>

      <div class="pro-toolbar">
        <div class="pro-toolbar-title">推荐快照</div>
      </div>
      <p class="plugins-tips">
        最多返回 100 条。需策略开启 <code>write_snapshot</code>。detail 含 *_raw / *_applied / *_enabled / *_weight 便于验收。
      </p>

      <el-alert
        v-if="!hasQuery"
        class="mgb12"
        type="info"
        show-icon
        :closable="false"
        title="请至少填写 batch_id、user_id 或 content_id 之一再查询"
      />

      <el-table :data="rows" v-loading="loading" empty-text="无数据">
        <el-table-column prop="batch_id" label="batch" min-width="160" show-overflow-tooltip />
        <el-table-column prop="user_id" label="用户" width="100" />
        <el-table-column prop="content_id" label="内容" width="100" />
        <el-table-column prop="recall_source" label="召回源" width="120" show-overflow-tooltip />
        <el-table-column label="质量" width="90">
          <template #default="{ row }">{{ fmt(row.base_quality_score) }}</template>
        </el-table-column>
        <el-table-column label="偏好" width="80">
          <template #default="{ row }">{{ fmt(row.user_preference_coefficient) }}</template>
        </el-table-column>
        <el-table-column label="时间" width="80">
          <template #default="{ row }">{{ fmt(row.time_scene_coefficient) }}</template>
        </el-table-column>
        <el-table-column label="新鲜" width="80">
          <template #default="{ row }">{{ fmt(row.freshness_coefficient) }}</template>
        </el-table-column>
        <el-table-column label="重复" width="80">
          <template #default="{ row }">{{ fmt(row.repeat_exposure_coefficient) }}</template>
        </el-table-column>
        <el-table-column label="最终分" width="100">
          <template #default="{ row }">
            <strong>{{ fmt(row.final_score) }}</strong>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="detailVisible" title="快照详情" width="720px" destroy-on-close>
      <template v-if="current">
        <el-descriptions :column="2" border size="small" class="mgb12">
          <el-descriptions-item label="batch">{{ current.batch_id }}</el-descriptions-item>
          <el-descriptions-item label="召回源">{{ current.recall_source }}</el-descriptions-item>
          <el-descriptions-item label="user_id">{{ current.user_id }}</el-descriptions-item>
          <el-descriptions-item label="content_id">{{ current.content_id }}</el-descriptions-item>
          <el-descriptions-item label="最终分">{{ fmt(current.final_score) }}</el-descriptions-item>
          <el-descriptions-item label="质量">{{ fmt(current.base_quality_score) }}</el-descriptions-item>
        </el-descriptions>
        <pre class="detail-json">{{ detailText }}</pre>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchRecommendSnapshots } from '../api'

const batchId = ref('')
const userId = ref('')
const contentId = ref('')
const rows = ref([])
const loading = ref(false)
const detailVisible = ref(false)
const current = ref(null)

const hasQuery = computed(() =>
  !!(batchId.value?.trim() || userId.value?.trim() || contentId.value?.trim()),
)

const detailText = computed(() => {
  const d = current.value?.detail
  if (d == null) return '—'
  try {
    return typeof d === 'string' ? d : JSON.stringify(d, null, 2)
  } catch {
    return String(d)
  }
})

function fmt(v) {
  if (v == null || v === '') return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return String(v)
  return Number.isInteger(n) ? String(n) : n.toFixed(4)
}

async function load() {
  if (!hasQuery.value) {
    ElMessage.warning('请至少填写一个查询条件')
    return
  }
  loading.value = true
  try {
    const params = {}
    if (batchId.value?.trim()) params.batch_id = batchId.value.trim()
    if (userId.value?.trim()) params.user_id = userId.value.trim()
    if (contentId.value?.trim()) params.content_id = contentId.value.trim()
    const res = await fetchRecommendSnapshots(params)
    const data = res.results || res
    rows.value = data.list || (Array.isArray(data) ? data : [])
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

function onReset() {
  batchId.value = ''
  userId.value = ''
  contentId.value = ''
  rows.value = []
}

function openDetail(row) {
  current.value = row
  detailVisible.value = true
}
</script>

<style scoped>
.mgb12 { margin-bottom: 12px; }
.plugins-tips code {
  font-size: 12px;
  background: #f4f4f5;
  padding: 1px 4px;
  border-radius: 3px;
}
.detail-json {
  margin: 0;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  max-height: 420px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
