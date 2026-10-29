<!--
  首页推荐：三池占比 + 运营推荐池语录列表。
-->
<template>
  <div>
    <div class="container mgb16">
      <ConfigPackList
        title="三池占比"
        tips="命中 / 运营推荐 / 纯随机合计须为 100。跳过引导用户：命中比例并入运营推荐。空维=看全部占比包。旧键 cold_start_interest_ratio / cold_start_ops_ratio 已弃用，请只改本页 pool_*_ratio。"
        :keys="RATIO_KEYS"
        :defaults="ratioDefaults"
        remark="首页三池占比"
        dialog-width="520px"
        :summary-keys="RATIO_KEYS"
        :validate-fn="validateRatios"
      >
        <template #form="{ form: rf }">
          <el-form-item label="命中比例">
            <el-input-number v-model="rf.pool_hit_ratio" :min="0" :max="100" />
          </el-form-item>
          <el-form-item label="运营推荐比例">
            <el-input-number v-model="rf.pool_ops_ratio" :min="0" :max="100" />
          </el-form-item>
          <el-form-item label="纯随机比例">
            <el-input-number v-model="rf.pool_random_ratio" :min="0" :max="100" />
          </el-form-item>
        </template>
        <template #summary="{ pack }">
          命中 {{ pack.values.pool_hit_ratio ?? '—' }}
          / 运营 {{ pack.values.pool_ops_ratio ?? '—' }}
          / 随机 {{ pack.values.pool_random_ratio ?? '—' }}
        </template>
      </ConfigPackList>
      <p class="plugins-tips muted">
        旧「兴趣/运营 70/30」已迁移为三池，不再驱动首页。命中策略与同池排序见侧栏对应页面。
      </p>
    </div>

    <div class="container">
      <p class="plugins-tips">
        运营推荐池语录（原冷启池勾选）。列表空维=不过滤；选具体语言可精确筛。
        当前筛选下池内 <strong>{{ total }}</strong> 条。
      </p>
      <ScopeFilter
        mode="browse"
        v-model:app-key="appKey"
        v-model:language="language"
        v-model:platform="platform"
        @change="onScopeChange"
      />
      <div class="pro-search">
        <el-input v-model="q" clearable placeholder="搜索内容" style="width: 200px" @keyup.enter="load(1)" />
        <div class="pro-search-actions">
          <el-button type="primary" @click="load(1)">查询</el-button>
        </div>
      </div>

      <div class="pro-toolbar">
        <div class="pro-toolbar-title">运营推荐池语录</div>
      </div>

      <el-table :data="rows">
        <el-table-column prop="id" label="ID" width="88" show-overflow-tooltip />
        <el-table-column prop="app_key" label="App" min-width="110" width="110">
          <template #default="{ row }">{{ row.app_key || '全部' }}</template>
        </el-table-column>
        <el-table-column prop="language" label="语言" min-width="100" width="100" />
        <el-table-column prop="platform" label="设备" min-width="100" width="100">
          <template #default="{ row }">{{ row.platform || '全部' }}</template>
        </el-table-column>
        <el-table-column prop="content" label="内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="theme" label="主主题" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.theme || '—' }}</template>
        </el-table-column>
        <el-table-column prop="sort_weight" label="权重" width="90" />
        <el-table-column label="池内" width="100">
          <template #default="{ row }">
            <el-switch
              :model-value="row.in_ops_pool"
              @change="(v) => togglePool(row, v)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
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

    <el-dialog v-model="visible" title="编辑运营推荐语录" width="640px" destroy-on-close>
      <el-form label-width="130px" class="cold-start-form">
        <el-form-item label="内容"><el-input v-model="form.content" type="textarea" rows="4" /></el-form-item>
        <el-form-item label="语言">
          <el-select v-model="form.language" style="width: 100%">
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
        <el-form-item label="主主题（推荐）">
          <el-select v-model="form.theme" clearable filterable style="width: 100%" placeholder="标签库主主题">
            <el-option
              v-for="t in themeOpts"
              :key="t.value"
              :label="t.label || t.value"
              :value="t.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="排序权重"><el-input-number v-model="form.sort_weight" /></el-form-item>
        <el-form-item label="运营推荐池"><el-switch v-model="form.in_ops_pool" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchQuotes, saveQuote, fetchContentEnums } from '../api'
import ScopeFilter from '../components/ScopeFilter.vue'
import ConfigPackList from '../components/ConfigPackList.vue'
import { loadWithCache, clearPageCache } from '../utils/pageCache'
import { browseScopeParams, defaultCreateAppKey } from '../utils/scopeParams'
import { LANG_OPTIONS, langOptionLabel } from '../utils/enumZh'

const RATIO_KEYS = ['pool_hit_ratio', 'pool_ops_ratio', 'pool_random_ratio']
const ratioDefaults = {
  pool_hit_ratio: 50,
  pool_ops_ratio: 30,
  pool_random_ratio: 20,
}

function validateRatios(f) {
  const sum =
    Number(f.pool_hit_ratio || 0) + Number(f.pool_ops_ratio || 0) + Number(f.pool_random_ratio || 0)
  if (sum !== 100) return '三池比例合计须为 100'
  return ''
}

const rows = ref([])
const page = ref(1)
const total = ref(0)
const q = ref('')
const appKey = ref('')
const platform = ref('')
const language = ref('')
const visible = ref(false)
const form = ref({})
const themeOpts = ref([])
const langOpts = ref([...LANG_OPTIONS])

function cacheKey(p = page.value) {
  return `ops_pool_quotes_p${p}_${appKey.value || 'all'}_${language.value || 'all'}_${platform.value || 'all'}_${q.value || ''}`
}

function onScopeChange() {
  load(1)
}

async function loadEnums() {
  await loadWithCache('content_enums_cold_start', async () => {
    const res = await fetchContentEnums()
    const data = res.results || {}
    return {
      themeOpts: data.interest_tags || [],
      langOpts: data.app_langs || [],
    }
  }, (data) => {
    themeOpts.value = data.themeOpts || []
    const langs = data.langOpts || []
    langOpts.value = langs.length
      ? langs.map((l) => ({
          value: l.value || l,
          label: langOptionLabel(l.value || l),
        }))
      : [...LANG_OPTIONS]
  })
}

async function load(p = page.value) {
  page.value = p
  await loadWithCache(cacheKey(), async () => {
    const params = {
      currentPage: page.value,
      pageSize: 20,
      in_ops_pool: 1,
      q: q.value || undefined,
      ...browseScopeParams({
        appKey: appKey.value,
        language: language.value,
        platform: platform.value,
      }),
    }
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

async function togglePool(row, v) {
  try {
    await saveQuote({ id: row.id, in_ops_pool: !!v })
    ElMessage.success(v ? '已加入运营推荐池' : '已移出运营推荐池')
    clearPageCache(cacheKey())
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '更新失败')
    load()
  }
}

function openEdit(row) {
  form.value = {
    ...row,
    app_key: defaultCreateAppKey(),
    platform: row.platform || '',
    theme: row.theme || '',
  }
  visible.value = true
}

async function save() {
  try {
    await saveQuote({
      ...form.value,
      app_key: defaultCreateAppKey(),
      theme: form.value.theme || '',
    })
    ElMessage.success('已保存')
    visible.value = false
    clearPageCache(cacheKey())
    load()
  } catch (e) {
    ElMessage.error(e.message || '保存失败')
  }
}

onMounted(async () => {
  await Promise.all([loadEnums(), load(1)])
})
</script>

<style scoped>
.mgb16 { margin-bottom: 16px; }
.muted { color: #667085; }
.cold-start-form :deep(.el-form-item__label) {
  white-space: nowrap;
}
</style>
