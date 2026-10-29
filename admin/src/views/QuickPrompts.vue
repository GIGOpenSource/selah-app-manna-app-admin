<!--
  AI 快捷开场：按语言×设备维护 AI 页开场提示词。
-->
<template>
  <div class="container">
    <ScopeFilter
      mode="browse"
      v-model:app-key="appKey"
      v-model:language="language"
      v-model:platform="platform"
      @change="onScopeChange"
    />
    <p class="plugins-tips">空维=不过滤（看全部）；选具体维才精确筛。这里只管理进入聊天页、出现在输入框上方的 3 条开场；服务端会按用户标签排序。回复后的追问在气泡下方，其中一条固定为「推荐经文」。</p>
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">快捷开场</div>
      <div class="pro-toolbar-actions">
        <el-button type="primary" :icon="CirclePlusFilled" @click="open()">新建</el-button>
      </div>
    </div>
    <el-table :data="rows" v-loading="loading">
      <el-table-column prop="title" label="标题" width="180" />
      <el-table-column prop="prompt" label="Prompt" />
      <el-table-column prop="app_key" label="App" min-width="110" width="110">
        <template #default="{ row }">{{ row.app_key || '空维' }}</template>
      </el-table-column>
      <el-table-column prop="language" label="语言" min-width="100" width="100">
        <template #default="{ row }">{{ row.language || '全部' }}</template>
      </el-table-column>
      <el-table-column v-if="showPlat" prop="platform" label="设备" min-width="100" width="100">
        <template #default="{ row }">{{ row.platform || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="sort_order" label="排序" min-width="80" width="80" />
      <el-table-column prop="enabled" label="启用" min-width="90" width="90">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button link type="primary" @click="open(row)">编辑</el-button>
          <el-button link type="danger" @click="onDelete(row.id)">删除</el-button>
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

    <el-dialog v-model="visible" :title="form.id ? '编辑开场' : '快捷开场'" width="560px" destroy-on-close>
      <el-form label-width="80px">
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="Prompt"><el-input v-model="form.prompt" type="textarea" rows="4" /></el-form-item>
        <el-form-item label="语言">
          <el-select v-model="form.language" style="width: 100%">
            <el-option label="全部" value="" />
            <el-option v-for="l in LANG_OPTIONS" :key="l.value" :label="l.label" :value="l.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sort_order" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
/**
 * AI 开场快捷提示词：按 app×language×platform 维度管理；新建继承当前筛选维度。
 */
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import { fetchQuickPrompts, saveQuickPrompt } from '../api'
import ScopeFilter from '../components/ScopeFilter.vue'
import { loadWithCache, clearPageCache } from '../utils/pageCache'
import { browseScopeParams, defaultCreateAppKey } from '../utils/scopeParams'
import { LANG_OPTIONS } from '../utils/enumZh'
import { shouldHidePlatform } from '../utils/productContext'

const appKey = ref('')
const language = ref('')
const platform = ref('')
const rows = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const visible = ref(false)
const form = ref({})
const showPlat = !shouldHidePlatform()

/** 缓存键含维度与页码 */
function cacheKey() {
  return `quick_prompts_${appKey.value || ''}_${language.value || ''}_${platform.value || ''}_p${page.value}`
}

/** 维度变更回到第 1 页 */
function onScopeChange() {
  load(1)
}

/** 按当前维度分页拉取开场提示 */
async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    await loadWithCache(cacheKey(), async () => {
      const res = await fetchQuickPrompts({
        ...browseScopeParams({
          appKey: appKey.value,
          language: language.value,
          platform: platform.value,
        }),
        currentPage: page.value,
        pageSize: 20,
      })
      return {
        rows: res.results || [],
        total: res.pagination?.total || (res.results || []).length,
      }
    }, (data) => {
      rows.value = data.rows || []
      total.value = data.total || 0
    })
  } finally {
    loading.value = false
  }
}
/** 打开编辑；新建写入当前 language/platform */
function open(row) {
  form.value = row
    ? { ...row }
    : {
        title: '',
        prompt: '',
        sort_order: 0,
        enabled: true,
        app_key: defaultCreateAppKey(appKey.value),
        language: language.value || '',
        platform: platform.value || '',
      }
  visible.value = true
}
/** 保存开场提示并清维度缓存 */
async function save() {
  try {
    await saveQuickPrompt({
      ...form.value,
      app_key: defaultCreateAppKey(appKey.value),
      platform: '',
    })
    ElMessage.success('已保存')
    visible.value = false
    clearPageCache(cacheKey())
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}
/** 删除：传 delete_id */
async function onDelete(id) {
  try {
    await saveQuickPrompt({ delete_id: id })
    ElMessage.success('已删除')
    clearPageCache(cacheKey())
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}
onMounted(load)
</script>
