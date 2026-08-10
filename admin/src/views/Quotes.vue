<!--
  语录管理：App × 语言 × 设备三维筛选、增删改、CSV 导入。
-->
<template>
  <div>
    <div class="container">
      <p class="plugins-tips">
        空维=不过滤（看全部）；选具体维才精确筛。语录正文语言不可为空，新建默认用当前筛选语言或 en。
      </p>
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
          placeholder="搜索内容"
          style="width: 220px"
          @keyup.enter="load(1)"
        />
        <el-select
          v-model="coldFilter"
          clearable
          placeholder="冷启池"
          style="width: 120px"
          @change="load(1)"
        >
          <el-option label="池内" :value="1" />
          <el-option label="池外" :value="0" />
        </el-select>

        <div class="pro-search-actions">
          <el-button type="primary" @click="load(1)">查询</el-button>
          <el-button @click="onReset">重置</el-button>
        </div>
      </div>

      <div class="pro-toolbar">
        <div class="pro-toolbar-title">语录列表</div>
        <div class="pro-toolbar-actions">
          <el-button @click="showImport = true">Excel / CSV 导入</el-button>
          <el-button type="primary" :icon="CirclePlusFilled" @click="openEdit()">新建</el-button>
        </div>
      </div>

      <el-table :data="rows">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="app_key" label="App" width="90">
          <template #default="{ row }">{{ row.app_key || '全部' }}</template>
        </el-table-column>
        <el-table-column prop="language" label="语言" width="80" />
        <el-table-column prop="platform" label="设备" width="90">
          <template #default="{ row }">{{ row.platform || '全部' }}</template>
        </el-table-column>
        <el-table-column prop="content" label="内容" min-width="240" />
        <el-table-column prop="source_ref" label="出处" width="140" />
        <el-table-column prop="interest_tags" label="标签" width="180">
          <template #default="{ row }">{{ tagsZh(row.interest_tags) }}</template>
        </el-table-column>
        <el-table-column label="主题" width="100">
          <template #default="{ row }">{{ topicName(row.topic_id) }}</template>
        </el-table-column>
        <el-table-column prop="in_cold_start_pool" label="冷启池" width="90">
          <template #default="{ row }">
            <el-tag :type="row.in_cold_start_pool ? 'success' : 'info'" size="small">
              {{ row.in_cold_start_pool ? '是' : '否' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
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
    </div>

    <el-dialog v-model="visible" :title="form.id ? '编辑语录' : '新建语录'" width="640px" destroy-on-close>
      <el-form label-width="110px">
        <el-form-item label="内容"><el-input v-model="form.content" type="textarea" rows="4" /></el-form-item>
        <el-form-item label="App">
          <el-select v-model="form.app_key" filterable style="width: 100%">
            <el-option label="全局（两 App 可见）" value="" />
            <el-option v-for="a in APP_KEYS" :key="a" :label="a" :value="a" />
          </el-select>
        </el-form-item>
        <el-form-item label="语言">
          <el-select v-model="form.language" filterable style="width: 100%">
            <el-option v-for="l in langOpts" :key="l.value" :label="l.label" :value="l.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="设备">
          <el-select v-model="form.platform" style="width: 100%">
            <el-option label="全部设备" value="" />
            <el-option label="iOS" value="ios" />
            <el-option label="Android" value="android" />
          </el-select>
        </el-form-item>

        <el-form-item label="兴趣标签">
          <el-select v-model="interestTags" multiple filterable style="width: 100%" placeholder="选择兴趣标签">
            <el-option
              v-for="t in interestOpts"
              :key="t.value"
              :label="optionLabelZh(t.value, t.label, INTEREST_TAG_ZH)"
              :value="t.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="信仰标签">
          <el-select v-model="faithTags" multiple filterable style="width: 100%" placeholder="选择信仰标签">
            <el-option
              v-for="t in faithOpts"
              :key="t.value"
              :label="optionLabelZh(t.value, t.label, FAITH_TAG_ZH)"
              :value="t.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="国家限制">
          <el-select
            v-model="countries"
            multiple
            filterable
            clearable
            style="width: 100%"
            placeholder="空=全球；多选 ISO 国家码"
          >
            <el-option
              v-for="c in COUNTRY_OPTIONS.filter((x) => x.value !== 'GLOBAL')"
              :key="c.value"
              :label="c.label"
              :value="c.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="出处">
          <el-input v-model="form.source_ref" maxlength="120" placeholder="如 Scripture / Author" />
        </el-form-item>
        <el-form-item label="朗读 URL"><el-input v-model="form.audio_url" placeholder="https://..." /></el-form-item>
        <el-form-item label="所属主题">
          <el-select v-model="form.topic_id" clearable filterable style="width: 100%" placeholder="不挂主题">
            <el-option v-for="t in topicOpts" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序权重"><el-input-number v-model="form.sort_weight" :min="0" /></el-form-item>
        <el-form-item label="冷启池"><el-switch v-model="form.in_cold_start_pool" /></el-form-item>
        <el-form-item label="VIP"><el-switch v-model="form.is_vip" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showImport" title="导入语录" width="640px" destroy-on-close>
      <p class="plugins-tips">表头需含 content；可选 language / app_key / platform / interest_tags / faith_tags / is_vip / in_cold_start_pool / sort_weight / topic_id（标签与语言须对齐枚举）</p>
      <el-upload drag :auto-upload="false" :limit="1" accept=".xlsx,.csv" :on-change="onFile">
        <div>拖拽或选择 .xlsx / .csv</div>
      </el-upload>
      <el-divider>或粘贴 CSV 文本</el-divider>
      <el-input v-model="csv" type="textarea" rows="8" placeholder="content,language,app_key,platform,interest_tags,in_cold_start_pool" />
      <template #footer>
        <el-button type="primary" :loading="importing" @click="doImport">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
/**
 * 语录管理：列表带 pageCache；枚举/主题单独缓存；
 * 三维筛选有值才传给后端（空=不过滤，看全部）；新建继承当前筛选维。
 */
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import { fetchQuotes, saveQuote, deleteQuote, importQuotes, importQuotesFile, fetchContentEnums, fetchTopics } from '../api'
import ScopeFilter from '../components/ScopeFilter.vue'
import { loadWithCache } from '../utils/pageCache'
import { browseScopeParams, defaultCreateAppKey } from '../utils/scopeParams'
import { tagsZh, optionLabelZh, INTEREST_TAG_ZH, FAITH_TAG_ZH, APP_KEYS, COUNTRY_OPTIONS, LANG_OPTIONS, langOptionLabel } from '../utils/enumZh'

const rows = ref([])
const page = ref(1)
const total = ref(0)
const visible = ref(false)
const showImport = ref(false)
const csv = ref('')
const form = ref({})
const interestTags = ref([])
const faithTags = ref([])
/** 国家限制多选；空=全球投放 */
const countries = ref([])
/** el-upload 选中的原始 File；优先于粘贴 CSV */
const fileRaw = ref(null)
const importing = ref(false)
const q = ref('')
const appKey = ref('')
const platform = ref('')
const language = ref('')
/** 冷启池筛：1=池内 / 0=池外 / null=不过滤 */
const coldFilter = ref(null)
const interestOpts = ref([])
const faithOpts = ref([])
const langOpts = ref([...LANG_OPTIONS])
const topicOpts = ref([])

function topicName(id) {
  if (!id) return '—'
  const hit = topicOpts.value.find((t) => t.id === id)
  return hit?.name || `#${id}`
}

async function loadEnums() {
  await loadWithCache('quotes_enums', async () => {
    const [enumsRes, topicsRes] = await Promise.all([
      fetchContentEnums(),
      fetchTopics({ currentPage: 1, pageSize: 999 }),
    ])
    const data = enumsRes.results || {}
    return {
      interestOpts: data.interest_tags || [],
      faithOpts: data.faith_types || [],
      langOpts: data.app_langs || [],
      topicOpts: topicsRes.results || [],
    }
  }, (data) => {
    interestOpts.value = data.interestOpts || []
    faithOpts.value = data.faithOpts || []
    const langs = data.langOpts || []
    langOpts.value = langs.length
      ? langs.map((l) => ({
          value: l.value || l,
          label: langOptionLabel(l.value || l),
        }))
      : [...LANG_OPTIONS]
    topicOpts.value = data.topicOpts || []
  })
}

async function load(p = page.value) {
  page.value = p
  const params = {
    currentPage: page.value,
    pageSize: 20,
    ...browseScopeParams({
      appKey: appKey.value,
      language: language.value,
      platform: platform.value,
    }),
  }
  if (q.value) params.q = q.value
  if (coldFilter.value === 0 || coldFilter.value === 1) params.in_cold_start_pool = coldFilter.value
  const cacheKey = `quotes_p${page.value}_${q.value || ''}_${appKey.value || ''}_${language.value || ''}_${platform.value || ''}_${coldFilter.value ?? 'all'}`
  await loadWithCache(cacheKey, async () => {
    const res = await fetchQuotes(params)
    return {
      rows: res.results || [],
      total: res.pagination?.total || (res.results || []).length,
    }
  }, (data) => {
    rows.value = data.rows || []
    total.value = data.total || 0
  })
}

function onReset() {
  q.value = ''
  coldFilter.value = null
  appKey.value = ''
  platform.value = ''
  language.value = ''
  load(1)
}

function openEdit(row) {
  form.value = row
    ? {
        ...row,
        app_key: row.app_key || '',
        platform: row.platform || '',
        sort_weight: row.sort_weight || 0,
        audio_url: row.audio_url || '',
        source_ref: row.source_ref || '',
        topic_id: row.topic_id || null,
      }
    : {
        content: '',
        language: language.value || 'en',
        app_key: defaultCreateAppKey(appKey.value),
        platform: platform.value || '',
        in_cold_start_pool: false,
        is_vip: false,
        sort_weight: 0,
        audio_url: '',
        source_ref: '',
        topic_id: null,
      }
  interestTags.value = [...(form.value.interest_tags || [])]
  faithTags.value = [...(form.value.faith_tags || [])]
  countries.value = [...(form.value.countries || [])]
  visible.value = true
}

async function save() {
  try {
    const payload = {
      ...form.value,
      interest_tags: interestTags.value,
      faith_tags: faithTags.value,
      countries: countries.value,
      topic_id: form.value.topic_id || null,
    }
    await saveQuote(payload)
    ElMessage.success('已保存')
    visible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  }
}

async function onDelete(id) {
  try {
    await deleteQuote(id)
    ElMessage.success('已删除')
    load()
  } catch (e) {
    ElMessage.error(e.message || '删除失败')
  }
}

function onFile(file) {
  fileRaw.value = file.raw
}

async function doImport() {
  importing.value = true
  try {
    let res
    if (fileRaw.value) {
      res = await importQuotesFile(fileRaw.value)
    } else {
      res = await importQuotes(csv.value)
    }
    const imported = res.results?.imported ?? 0
    const errs = res.results?.errors || []
    ElMessage.success(errs.length ? `导入 ${imported} 条，${errs.length} 行跳过` : `导入 ${imported} 条`)
    showImport.value = false
    csv.value = ''
    fileRaw.value = null
    load()
  } catch (e) {
    ElMessage.error(e.message || '导入失败')
  } finally {
    importing.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadEnums(), load()])
})
</script>
