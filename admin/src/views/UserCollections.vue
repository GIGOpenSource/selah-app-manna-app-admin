<!--
  用户收藏：按 App × 类型区分（语录夹 / 喜欢 / Manna 收藏 / 高亮 / 笔记）。
-->
<template>
  <div>
    <div class="container">
      <ScopeFilter
        mode="browse"
        v-model:app-key="appKey"
        v-model:language="language"
        v-model:platform="platform"
        @change="onFilterChange"
      />
      <div class="pro-search">
        <el-select v-model="kind" placeholder="类型" style="width: 150px" @change="onKindChange">
          <el-option v-for="k in KIND_OPTIONS" :key="k.value" :label="k.label" :value="k.value" />
        </el-select>
        <el-input
          v-model="q"
          clearable
          :placeholder="searchPlaceholder"
          style="width: 200px"
          :disabled="!!folderId"
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
          <el-button v-if="folderId" @click="backFolders">返回夹列表</el-button>
        </div>
      </div>

      <div class="pro-toolbar">
        <div class="pro-toolbar-title">{{ toolbarTitle }}</div>
      </div>

      <!-- 语录收藏夹 -->
      <el-table v-if="kind === 'folder' && !folderId" :data="rows" v-loading="loading">
        <el-table-column prop="id" label="夹ID" width="80" />
        <el-table-column label="App" min-width="110" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="row.app_key === 'manna' ? 'warning' : 'primary'">
              {{ row.app_key || '—' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.is_default" size="small" type="success">默认夹</el-tag>
            <el-tag v-else size="small" type="info">自定义</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="用户" min-width="160">
          <template #default="{ row }">
            <div>{{ row.display_name || row.username || '-' }}</div>
            <div class="sub">uid {{ row.user_id }} · {{ row.device_id || '-' }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="name" label="夹名" width="160" />
        <el-table-column prop="item_count" label="条目" width="80" />
        <el-table-column prop="created_at" label="创建" width="170" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openFolder(row)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 夹内语录 -->
      <el-table v-else-if="kind === 'folder' && folderId" :data="items" v-loading="loading">
        <el-table-column prop="id" label="条目ID" width="90" />
        <el-table-column label="App" min-width="110" width="110">
          <template #default="{ row }">{{ row.app_key || '—' }}</template>
        </el-table-column>
        <el-table-column prop="content_id" label="语录ID" width="90" />
        <el-table-column label="语录" min-width="280">
          <template #default="{ row }">
            <div>{{ row.quote_content || '-' }}</div>
            <div v-if="row.quote_deleted" class="sub">已下架</div>
          </template>
        </el-table-column>
        <el-table-column prop="user_id" label="用户" width="90" />
        <el-table-column prop="created_at" label="收藏时间" width="170" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="danger" @click="onDelete(row, 'folder_item')">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 语录喜欢 -->
      <el-table v-else-if="kind === 'like'" :data="rows" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="App" min-width="110" width="110">
          <template #default="{ row }">
            <el-tag size="small">{{ row.app_key || '—' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="用户" min-width="160">
          <template #default="{ row }">
            <div>{{ row.display_name || row.username || '-' }}</div>
            <div class="sub">uid {{ row.user_id }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="content_id" label="语录ID" width="90" />
        <el-table-column label="语录" min-width="280">
          <template #default="{ row }">
            <div>{{ row.quote_content || '-' }}</div>
            <div v-if="row.quote_deleted" class="sub">已下架</div>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="时间" width="170" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="danger" @click="onDelete(row, 'like')">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- Manna 收藏 / 高亮 / 笔记 -->
      <el-table v-else :data="rows" v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column label="App" min-width="110" width="110">
          <template #default="{ row }">
            <el-tag size="small" type="warning">{{ row.app_key || '—' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default>
            {{ kindLabel(kind) }}
          </template>
        </el-table-column>
        <el-table-column label="用户" min-width="160">
          <template #default="{ row }">
            <div>{{ row.display_name || row.username || '-' }}</div>
            <div class="sub">uid {{ row.user_id }}</div>
          </template>
        </el-table-column>
        <el-table-column v-if="kind === 'favorite'" label="目标类型" width="120" prop="target_type" />
        <el-table-column v-if="kind === 'favorite'" label="目标键" min-width="180" prop="target_key" />
        <el-table-column v-if="kind !== 'favorite'" label="经文" min-width="140">
          <template #default="{ row }">{{ row.summary || '—' }}</template>
        </el-table-column>
        <el-table-column v-if="kind === 'highlight'" prop="color" label="颜色" width="100" />
        <el-table-column v-if="kind === 'note'" label="笔记" min-width="220" prop="body" />
        <el-table-column prop="created_at" label="时间" width="170" />
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="danger" @click="onDelete(row, kind)">删除</el-button>
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
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchUserCollections, deleteUserCollectionItem } from '../api'
import ScopeFilter from '../components/ScopeFilter.vue'
import { browseScopeParams } from '../utils/scopeParams'

const KIND_OPTIONS = [
  { value: 'folder', label: '语录收藏夹' },
  { value: 'like', label: '语录喜欢' },
  { value: 'favorite', label: 'Manna 收藏' },
  { value: 'highlight', label: '圣经高亮' },
  { value: 'note', label: '圣经笔记' },
]

const route = useRoute()
const q = ref('')
const userId = ref('')
const appKey = ref('')
const language = ref('')
const platform = ref('')
const kind = ref('folder')
const folderId = ref(null)
const rows = ref([])
const items = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)

const searchPlaceholder = computed(() => {
  if (kind.value === 'folder') return '搜索夹名'
  if (kind.value === 'like') return '搜索语录正文'
  if (kind.value === 'favorite') return '搜索 target'
  if (kind.value === 'highlight') return '搜索书卷/颜色'
  return '搜索书卷/笔记'
})

const toolbarTitle = computed(() => {
  if (folderId.value) return `收藏条目 · 夹 #${folderId.value}`
  return `用户收藏 · ${kindLabel(kind.value)}`
})

function kindLabel(k) {
  return KIND_OPTIONS.find((x) => x.value === k)?.label || k
}

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    const params = {
      currentPage: page.value,
      pageSize: 20,
      kind: kind.value,
    }
    if (userId.value) params.user_id = userId.value
    Object.assign(params, browseScopeParams({ appKey: appKey.value, language: language.value, platform: platform.value }))
    if (kind.value === 'folder' && folderId.value) {
      params.folder_id = folderId.value
    } else if (q.value) {
      params.q = q.value
    }
    const res = await fetchUserCollections(params)
    if (kind.value === 'folder' && folderId.value) {
      items.value = res.results || []
      rows.value = []
    } else {
      rows.value = res.results || []
      items.value = []
    }
    total.value = res.pagination?.total || 0
  } catch (e) {
    ElMessage.error(e.message || e.msg || '加载失败')
  } finally {
    loading.value = false
  }
}

function onFilterChange() {
  folderId.value = null
  load(1)
}

function onKindChange() {
  folderId.value = null
  q.value = ''
  load(1)
}

function openFolder(row) {
  folderId.value = row.id
  page.value = 1
  load(1)
}

function backFolders() {
  folderId.value = null
  page.value = 1
  load(1)
}

function onReset() {
  q.value = ''
  userId.value = ''
  appKey.value = ''
  language.value = ''
  platform.value = ''
  kind.value = 'folder'
  folderId.value = null
  load(1)
}

async function onDelete(row, deleteKind) {
  try {
    await ElMessageBox.confirm('确认删除该条记录？', '删除', { type: 'warning' })
    await deleteUserCollectionItem(row.id, deleteKind)
    ElMessage.success('已删除')
    load()
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || e.msg || '删除失败')
  }
}

watch(
  () => route.query,
  (query) => {
    let changed = false
    if (query.user_id != null && String(query.user_id) !== userId.value) {
      userId.value = String(query.user_id)
      changed = true
    }
    if (query.app_key != null && String(query.app_key) !== appKey.value) {
      appKey.value = String(query.app_key)
      changed = true
    }
    if (query.kind && KIND_OPTIONS.some((k) => k.value === query.kind) && query.kind !== kind.value) {
      kind.value = String(query.kind)
      changed = true
    }
    if (changed || query.user_id || query.app_key || query.kind) {
      folderId.value = null
      load(1)
    }
  },
  { immediate: true, deep: true },
)

onMounted(() => {
  const qy = route.query
  if (!qy.user_id && !qy.app_key && !qy.kind) load(1)
})
</script>

<style scoped>
.sub { font-size: 12px; color: var(--el-text-color-secondary); }
</style>
