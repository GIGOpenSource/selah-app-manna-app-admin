<!--
  Manna 流水：有 user_id 看明细；无 user_id 看按日×reason 汇总。
-->
<template>
  <div class="container">
    <ScopeFilter mode="browse" v-model:app-key="appKey" v-model:language="language" v-model:platform="platform" @change="onScopeChange" />
    <div class="pro-search" style="margin-top: 12px">
      <el-input
        v-model="userId"
        clearable
        placeholder="用户 ID（可空=汇总）"
        style="width: 160px"
        @keyup.enter="load(1)"
      />
      <el-select v-model="reason" clearable placeholder="原因" style="width: 180px">
        <el-option v-for="r in REASONS" :key="r" :label="r" :value="r" />
      </el-select>
      <div class="pro-search-actions">
        <el-button type="primary" @click="load(1)">查询</el-button>
        <el-button @click="onReset">重置</el-button>
      </div>
    </div>
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">{{ userId.trim() ? 'Manna 流水' : '按日 × 原因汇总' }}</div>
    </div>
    <p class="plugins-tips">填用户 ID 看明细；不填则按近 30 日汇总 delta（与功课看板同源）。reason 白名单见币方案。</p>

    <el-table v-if="!userId.trim()" :data="summaryRows" v-loading="loading">
      <el-table-column prop="date" label="日期" width="140" />
      <el-table-column prop="reason" label="原因" min-width="160" />
      <el-table-column prop="delta_sum" label="delta 合计" width="120">
        <template #default="{ row }">
          <span :style="{ color: row.delta_sum >= 0 ? '#67c23a' : '#f56c6c' }">
            {{ row.delta_sum >= 0 ? `+${row.delta_sum}` : row.delta_sum }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="count" label="笔数" width="100" />
    </el-table>

    <template v-else>
      <el-table :data="rows" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="delta" label="变动" width="90">
          <template #default="{ row }">
            <span :style="{ color: row.delta >= 0 ? '#67c23a' : '#f56c6c' }">
              {{ row.delta >= 0 ? `+${row.delta}` : row.delta }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="balance_after" label="余额" width="90" />
        <el-table-column prop="reason" label="原因" min-width="140" />
        <el-table-column prop="ref_type" label="关联类型" width="110" />
        <el-table-column prop="ref_id" label="关联ID" width="100" />
        <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
        <el-table-column prop="created_at" label="时间" width="180" />
      </el-table>
      <el-pagination
        class="pagination"
        background
        layout="total, prev, pager, next, jumper"
        :total="total"
        v-model:current-page="page"
        @current-change="load"
      />
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { fetchMannaLedger } from '../../api'
import ScopeFilter from '../../components/ScopeFilter.vue'
import { browseScopeParams } from '../../utils/scopeParams'

const REASONS = [
  'grant_newcomer',
  'prayer_amen',
  'devotion_amen',
  'bible_read',
  'quiz_pass',
  'quiz_fail',
  'quiz_in_bible',
  'quiz_review',
  'story_unlock',
]

const route = useRoute()
const appKey = ref('manna')
const language = ref('')
const platform = ref('')
const userId = ref('')
const reason = ref('')
const rows = ref([])
const summaryRows = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)

function onScopeChange() {
  load(1)
}

function onReset() {
  userId.value = ''
  reason.value = ''
  rows.value = []
  summaryRows.value = []
  total.value = 0
  page.value = 1
}

async function load(p = page.value) {
  const uid = String(userId.value || '').trim()
  page.value = p
  loading.value = true
  try {
    const params = {
      ...browseScopeParams({
        appKey: appKey.value,
        language: language.value,
        platform: platform.value,
      }),
      reason: reason.value || undefined,
    }
    if (uid) {
      const res = await fetchMannaLedger({
        user_id: uid,
        ...params,
        currentPage: page.value,
        pageSize: 20,
      })
      rows.value = res.results || []
      total.value = res.pagination?.total || 0
      summaryRows.value = []
    } else {
      const res = await fetchMannaLedger(params)
      summaryRows.value = res.results || []
      rows.value = []
      total.value = 0
    }
  } catch (e) {
    ElMessage.error(e.message || e.msg || '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (route.query.user_id) {
    userId.value = String(route.query.user_id)
  }
  load(1)
})

watch(
  () => route.query.user_id,
  (v) => {
    if (v) {
      userId.value = String(v)
      load(1)
    }
  },
)
</script>
