<!--
  安全审计：查询 AI/内容安全触发记录。
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
          placeholder="搜索用户/类别"
          style="width: 220px"
          @keyup.enter="load(1)"
        />
        <el-select v-model="category" clearable placeholder="安全类别" style="width: 180px" @change="load(1)">
          <el-option v-for="c in catOpts" :key="c.value" :label="c.label" :value="c.value" />
        </el-select>
        <div class="pro-search-actions">
          <el-button type="primary" @click="load(1)">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </div>
      </div>

      <div class="pro-toolbar">
        <div class="pro-toolbar-title">AI 安全审计</div>
      </div>

      <el-table :data="rows" v-loading="loading">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column label="App" min-width="110" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.app_key" size="small" :type="row.app_key === 'manna' ? 'warning' : 'primary'">
              {{ row.app_key }}
            </el-tag>
            <span v-else class="sub">—</span>
          </template>
        </el-table-column>
        <el-table-column label="用户" min-width="160">
          <template #default="{ row }">
            <div>{{ row.display_name || '-' }}</div>
            <div class="sub">uid {{ row.user_id }} · {{ row.device_id || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="safety_category" label="类别" width="180">
          <template #default="{ row }">
            <el-tag type="danger" size="small">{{ catLabel(row.safety_category) }}</el-tag>
          </template>
        </el-table-column>
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
  </div>
</template>

<script setup>
/**
 * 安全审计日志：用户触发敏感词的只读列表，可按类别筛选。
 */
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchSafetyAudits, fetchContentEnums } from '../api'
import ScopeFilter from '../components/ScopeFilter.vue'
import { browseScopeParams } from '../utils/scopeParams'

const rows = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const q = ref('')
const category = ref(null)
const appKey = ref('')
const language = ref('')
const platform = ref('')
const catOpts = ref([])

/** 类别码转中文标签 */
function catLabel(v) {
  const hit = catOpts.value.find((c) => c.value === v)
  return hit?.label || v
}

/** 加载安全类别枚举供筛选下拉 */
async function loadEnums() {
  try {
    const res = await fetchContentEnums()
    catOpts.value = res.results?.safety_categories || []
  } catch {
    catOpts.value = []
  }
}

/** 分页拉取审计记录 */
async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    const params = { currentPage: page.value, pageSize: 20 }
    if (q.value) params.q = q.value
    if (category.value) params.category = category.value
    Object.assign(params, browseScopeParams({ appKey: appKey.value, language: language.value, platform: platform.value }))
    const res = await fetchSafetyAudits(params)
    rows.value = res.results || []
    total.value = res.pagination?.total || rows.value.length
  } catch (e) {
    ElMessage.error(e.message || '加载失败')
  } finally {
    loading.value = false
  }
}

/** 清空筛选 */
function onReset() {
  q.value = ''
  category.value = null
  appKey.value = ''
  language.value = ''
  platform.value = ''
  load(1)
}

onMounted(async () => {
  await loadEnums()
  await load(1)
})
</script>

<style scoped>
.sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
