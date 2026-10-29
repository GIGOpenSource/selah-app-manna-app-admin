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
    <p class="plugins-tips">
      这是 <strong>Explore 栏目主题（t_topic）</strong>，与语录「标签库主主题」不是同一套。
      类型主题填 slug、分类留空；栏目主题选 draw_near / health / journey。
    </p>
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">主题列表</div>
      <div class="pro-toolbar-actions">
        <el-switch v-model="showTrash" active-text="回收站" @change="load(1)" />
        <el-button v-if="!showTrash" type="primary" :icon="CirclePlusFilled" @click="open()">新建</el-button>
      </div>
    </div>
    <el-table :data="rows" class="topic-table" style="width: 100%">
      <el-table-column prop="id" label="ID" width="100" />
      <el-table-column label="名称" min-width="180" class-name="col-name">
        <template #default="{ row }">
          <el-tooltip
            :content="row.name || '—'"
            placement="top"
            :disabled="!row.name"
            :show-after="300"
          >
            <span class="name-ellipsis">{{ row.name || '—' }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column prop="slug" label="slug" min-width="140">
        <template #default="{ row }">{{ row.slug || '—' }}</template>
      </el-table-column>
      <el-table-column label="分类" min-width="140">
        <template #default="{ row }">{{ labelZh(TOPIC_CATEGORY_ZH, row.category) }}</template>
      </el-table-column>
      <el-table-column prop="app_key" label="App" min-width="110" width="110">
        <template #default="{ row }">{{ row.app_key || '空维' }}</template>
      </el-table-column>
      <el-table-column prop="language" label="语言" min-width="100" width="100">
        <template #default="{ row }">{{ row.language || '全部' }}</template>
      </el-table-column>
      <el-table-column v-if="showPlat" prop="platform" label="设备" min-width="100" width="100">
        <template #default="{ row }">{{ row.platform || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="is_vip" label="VIP" width="90">
        <template #default="{ row }">
          <el-tag :type="row.is_vip ? 'warning' : 'info'" size="small">{{ row.is_vip ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="sort_weight" label="权重" width="90" />
      <el-table-column label="操作" width="168" fixed="right">
        <template #default="{ row }">
          <template v-if="showTrash">
            <el-button link type="primary" @click="onRestore(row.id)">恢复</el-button>
          </template>
          <template v-else>
            <el-button link type="primary" @click="open(row)">编辑</el-button>
            <el-button link type="danger" @click="onDelete(row.id)">删除</el-button>
          </template>
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
        <el-form-item label="slug">
          <el-select
            v-model="form.slug"
            filterable
            allow-create
            clearable
            default-first-option
            style="width: 100%"
            placeholder="类型主题必填：bible_verses / prayers / quotes / affirmations"
          >
            <el-option
              v-for="s in TOPIC_TYPE_SLUGS"
              :key="s.value"
              :label="s.label"
              :value="s.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="语言">
          <el-select v-model="form.language" style="width: 100%">
            <el-option label="全部语言" value="" />
            <el-option v-for="l in LANG_OPTIONS" :key="l.value" :label="l.label" :value="l.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category" clearable style="width: 100%" placeholder="空=Explore 按类型">
            <el-option
              v-for="c in TOPIC_CATEGORY_CANONICAL"
              :key="c.value"
              :label="c.label"
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import { fetchTopics, saveTopic, deleteTopic, restoreTopic, uploadFile } from '../api'
import ScopeFilter from '../components/ScopeFilter.vue'
import { loadWithCache, clearPageCache } from '../utils/pageCache'
import { browseScopeParams, defaultCreateAppKey } from '../utils/scopeParams'
import {
  LANG_OPTIONS, TOPIC_CATEGORY_ZH, TOPIC_CATEGORY_CANONICAL, TOPIC_TYPE_SLUGS,
  labelZh, canonicalTopicCategory,
} from '../utils/enumZh'
import { shouldHidePlatform } from '../utils/productContext'

const appKey = ref('')
const language = ref('')
const platform = ref('')
const rows = ref([])
const page = ref(1)
const showTrash = ref(false)
const total = ref(0)
const visible = ref(false)
const form = ref({})
const uploading = ref(false)
const showPlat = !shouldHidePlatform()

function cacheKey() {
  return `topics_p${page.value}_${appKey.value || ''}_${language.value || ''}_${platform.value || ''}_t${showTrash.value ? 1 : 0}`
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
    if (showTrash.value) params.trashed = 1
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
        slug: row.slug || '',
        category: canonicalTopicCategory(row.category),
        app_key: row.app_key || '',
        language: row.language || '',
        platform: row.platform || '',
      }
    : {
        name: '',
        slug: '',
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
  const typeSlugs = new Set(TOPIC_TYPE_SLUGS.map((s) => s.value))
  const slug = String(form.value.slug || '').trim()
  try {
    await saveTopic({
      ...form.value,
      slug,
      category: typeSlugs.has(slug) ? '' : canonicalTopicCategory(form.value.category),
      app_key: defaultCreateAppKey(appKey.value),
      platform: '',
    })
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
    await ElMessageBox.confirm('确认移入回收站？', '删除主题', { type: 'warning' })
    await deleteTopic(id)
    ElMessage.success('已移入回收站')
    clearPageCache(cacheKey())
    load()
  } catch (e) {
    if (e !== 'cancel' && e?.message !== 'cancel') {
      ElMessage.error(e.message || e.msg || '删除失败')
    }
  }
}

async function onRestore(id) {
  try {
    await restoreTopic(id)
    ElMessage.success('已恢复')
    clearPageCache(cacheKey())
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '恢复失败')
  }
}

onMounted(async () => {
  await load()
})
</script>

<style scoped>
.topic-table :deep(.cell) {
  text-overflow: clip;
}
.topic-table :deep(.col-name .cell) {
  overflow: hidden;
  text-overflow: ellipsis;
}
.name-ellipsis {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
