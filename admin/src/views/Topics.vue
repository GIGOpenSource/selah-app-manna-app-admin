<!--
  主题管理：App × 语言 × 设备三维；主题 CRUD、排序与 VIP 锁定。
-->
<template>
  <div class="container">
    <ScopeFilter
      mode="browse"
      v-model:app-key="appKey"
      v-model:language="language"
      v-model:platform="platform"
      @change="load(1)"
    />
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">主题列表</div>
      <div class="pro-toolbar-actions">
        <el-button type="primary" :icon="CirclePlusFilled" @click="open()">新建</el-button>
      </div>
    </div>
    <el-table :data="rows">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column prop="name" label="名称" />
      <el-table-column label="分类" width="120">
        <template #default="{ row }">{{ labelZh(TOPIC_CATEGORY_ZH, row.category) }}</template>
      </el-table-column>
      <el-table-column prop="app_key" label="App" width="90">
        <template #default="{ row }">{{ row.app_key || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="language" label="语言" width="80">
        <template #default="{ row }">{{ row.language || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="platform" label="设备" width="90">
        <template #default="{ row }">{{ row.platform || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="is_vip" label="VIP" width="80">
        <template #default="{ row }">
          <el-tag :type="row.is_vip ? 'warning' : 'info'" size="small">{{ row.is_vip ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="sort_weight" label="权重" width="80" />
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

    <el-dialog v-model="visible" title="主题" width="520px" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="App">
          <el-select v-model="form.app_key" filterable style="width: 100%">
            <el-option label="全局（两 App 可见）" value="" />
            <el-option v-for="a in APP_KEYS" :key="a" :label="a" :value="a" />
          </el-select>
        </el-form-item>
        <el-form-item label="语言">
          <el-select v-model="form.language" style="width: 100%">
            <el-option label="全部语言" value="" />
            <el-option v-for="l in LANG_OPTIONS" :key="l.value" :label="l.label" :value="l.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="设备">
          <el-select v-model="form.platform" style="width: 100%">
            <el-option label="全部设备" value="" />
            <el-option label="iOS" value="ios" />
            <el-option label="Android" value="android" />
          </el-select>
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category" clearable style="width: 100%" placeholder="选择分类">
            <el-option
              v-for="c in categoryOpts"
              :key="c.value"
              :label="optionLabelZh(c.value, c.label, TOPIC_CATEGORY_ZH)"
              :value="c.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" /></el-form-item>
        <el-form-item label="封面">
          <el-upload
            :show-file-list="false"
            :auto-upload="false"
            accept="image/*"
            :on-change="onUploadCover"
          >
            <el-button :loading="uploading" size="small">上传 COS</el-button>
          </el-upload>
          <el-input v-model="form.cover_url" placeholder="上传后自动填入 URL" style="margin-top: 8px" />
        </el-form-item>
        <el-form-item label="权重"><el-input-number v-model="form.sort_weight" /></el-form-item>
        <el-form-item label="VIP"><el-switch v-model="form.is_vip" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
/**
 * 主题管理：分页列表 + 封面上传（type=selah/topics）+ VIP 标志；
 * 列表空维省略参数=不过滤看全部；选具体维才精确筛。
 */
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import { fetchTopics, saveTopic, deleteTopic, fetchContentEnums, uploadFile } from '../api'
import ScopeFilter from '../components/ScopeFilter.vue'
import { loadWithCache, clearPageCache } from '../utils/pageCache'
import { browseScopeParams, defaultCreateAppKey } from '../utils/scopeParams'
import { APP_KEYS, LANG_OPTIONS, TOPIC_CATEGORY_ZH, labelZh, optionLabelZh } from '../utils/enumZh'

const appKey = ref('')
const language = ref('')
const platform = ref('')
const rows = ref([])
const page = ref(1)
const total = ref(0)
const visible = ref(false)
const form = ref({})
const categoryOpts = ref([])
const uploading = ref(false)

function cacheKey() {
  return `topics_p${page.value}_${appKey.value || ''}_${language.value || ''}_${platform.value || ''}`
}

async function loadEnums() {
  await loadWithCache('content_enums_topics', async () => {
    const res = await fetchContentEnums()
    return (res.results || {}).topic_categories || []
  }, (data) => { categoryOpts.value = data || [] })
}

async function load(p = page.value) {
  page.value = p
  await loadWithCache(cacheKey(), async () => {
    const params = {
      currentPage: page.value,
      pageSize: 20,
      ...browseScopeParams({
        appKey: appKey.value,
        language: language.value,
        platform: platform.value,
      }),
    }
    const res = await fetchTopics(params)
    return {
      rows: res.results || [],
      total: res.pagination?.total || (res.results || []).length,
    }
  }, (data) => {
    rows.value = data.rows || []
    total.value = data.total || 0
  })
}

function open(row) {
  form.value = row
    ? {
        ...row,
        app_key: row.app_key || '',
        language: row.language || '',
        platform: row.platform || '',
      }
    : {
        name: '',
        category: '',
        description: '',
        cover_url: '',
        app_key: defaultCreateAppKey(appKey.value),
        language: language.value || '',
        platform: platform.value || '',
        sort_weight: 0,
        is_vip: false,
      }
  visible.value = true
}

async function onUploadCover(file) {
  const raw = file?.raw
  if (!raw) return
  uploading.value = true
  try {
    const res = await uploadFile(raw, 'selah/topics')
    const url = res.results?.url || res.data?.url
    if (!url) throw new Error('未返回 URL')
    form.value.cover_url = url
    ElMessage.success('已上传，封面 URL 已填入')
  } catch (e) {
    ElMessage.error(e.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

async function save() {
  try {
    await saveTopic(form.value)
    ElMessage.success('已保存')
    visible.value = false
    clearPageCache(cacheKey())
    load()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  }
}

async function onDelete(id) {
  try {
    await deleteTopic(id)
    ElMessage.success('已删除')
    clearPageCache(cacheKey())
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}

onMounted(async () => {
  await Promise.all([loadEnums(), load()])
})
</script>
