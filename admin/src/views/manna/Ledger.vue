<!--
  Manna 流水只读列表（GET，需 user_id）。
-->
<template>
  <div class="container">
    <ScopeFilter mode="browse" v-model:app-key="appKey" v-model:language="language" v-model:platform="platform" @change="onScopeChange" />
    <div class="pro-search" style="margin-top: 12px">
      <el-input
        v-model="userId"
        clearable
        placeholder="用户 ID（必填）"
        style="width: 160px"
        @keyup.enter="load(1)"
      />
      <div class="pro-search-actions">
        <el-button type="primary" @click="load(1)">查询</el-button>
        <el-button @click="onReset">重置</el-button>
      </div>
    </div>
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">Manna 流水</div>
    </div>
    <p class="plugins-tips">只读查询：接口要求 <code>user_id</code>；空维=不过滤，默认筛选 manna 可清空为不限。</p>
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
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { fetchMannaLedger } from '../../api'
import ScopeFilter from '../../components/ScopeFilter.vue'
import { browseScopeParams } from '../../utils/scopeParams'

const route = useRoute()
const appKey = ref('manna')
const language = ref('')
const platform = ref('')
const userId = ref('')
const rows = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)

function onScopeChange() {
  if (userId.value) load(1)
}

function onReset() {
  userId.value = ''
  rows.value = []
  total.value = 0
  page.value = 1
}

async function load(p = page.value) {
  const uid = String(userId.value || '').trim()
  if (!uid) {
    ElMessage.warning('请填写用户 ID')
    rows.value = []
    total.value = 0
    return
  }
  page.value = p
  loading.value = true
  try {
    const res = await fetchMannaLedger({
      user_id: uid,
      ...browseScopeParams({
        appKey: appKey.value,
        language: language.value,
        platform: platform.value,
      }),
      currentPage: page.value,
      pageSize: 20,
    })
    rows.value = res.results || []
    total.value = res.pagination?.total || 0
  } catch (e) {
    ElMessage.error(e.message || e.msg || '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (route.query.user_id) {
    userId.value = String(route.query.user_id)
    load(1)
  }
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
