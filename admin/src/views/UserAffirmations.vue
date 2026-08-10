<!--
  用户肯定语：检索与审核删除。
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
          placeholder="搜索正文"
          style="width: 220px"
          @keyup.enter="load(1)"
        />
        <el-input
          v-model="userId"
          clearable
          placeholder="用户 ID"
          style="width: 120px"
          @keyup.enter="load(1)"
        />
        <div class="pro-search-actions">
          <el-button type="primary" @click="load(1)">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </div>
      </div>

      <div class="pro-toolbar">
        <div class="pro-toolbar-title">用户肯定语</div>
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
        <el-table-column label="用户" min-width="160">
          <template #default="{ row }">
            <div>{{ row.display_name || row.username || '-' }}</div>
            <div class="sub">uid {{ row.user_id }} · {{ row.device_id || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="content" label="正文" min-width="280" />
        <el-table-column prop="created_at" label="创建" width="170" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="danger" @click="onDelete(row)">删除</el-button>
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
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchUserAffirmations, deleteUserAffirmation } from '../api'
import ScopeFilter from '../components/ScopeFilter.vue'
import { browseScopeParams } from '../utils/scopeParams'

const route = useRoute()
const q = ref('')
const userId = ref('')
const appKey = ref('')
const language = ref('')
const platform = ref('')
const rows = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    const params = { currentPage: page.value, pageSize: 20 }
    if (q.value) params.q = q.value
    if (userId.value) params.user_id = userId.value
    Object.assign(params, browseScopeParams({ appKey: appKey.value, language: language.value, platform: platform.value }))
    const res = await fetchUserAffirmations(params)
    rows.value = res.results || []
    total.value = res.pagination?.total || 0
  } catch (e) {
    ElMessage.error(e.message || e.msg || '加载失败')
  } finally {
    loading.value = false
  }
}

function onReset() {
  q.value = ''
  userId.value = ''
  appKey.value = ''
  language.value = ''
  platform.value = ''
  load(1)
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm('确认删除该用户肯定语？', '删除', { type: 'warning' })
    await deleteUserAffirmation(row.id)
    ElMessage.success('已删除')
    load()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || e.msg || '删除失败')
  }
}

watch(
  () => route.query.user_id,
  (v) => {
    if (v) {
      userId.value = String(v)
      load(1)
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (!route.query.user_id) load(1)
})
</script>

<style scoped>
.sub { font-size: 12px; color: var(--el-text-color-secondary); }
</style>
