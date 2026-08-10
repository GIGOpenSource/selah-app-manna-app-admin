<!--
  冷启池：按 App × 语言 × 设备标记冷启语录，监控池内数量与 70/30 占比。
-->
<template>
  <div>
    <div class="container mgb16">
      <ConfigPackList
        title="冷启占比"
        tips="兴趣池 / 运营池占比按维度打包，合计须为 100。空维=看全部占比包。"
        :keys="RATIO_KEYS"
        :defaults="ratioDefaults"
        remark="冷启占比"
        dialog-width="480px"
        :summary-keys="RATIO_KEYS"
        :validate-fn="validateRatios"
      >
        <template #form="{ form: rf }">
          <el-form-item label="兴趣占比">
            <el-input-number v-model="rf.cold_start_interest_ratio" :min="0" :max="100" />
          </el-form-item>
          <el-form-item label="运营池占比">
            <el-input-number v-model="rf.cold_start_ops_ratio" :min="0" :max="100" />
          </el-form-item>
        </template>
        <template #summary="{ pack }">
          兴趣 {{ pack.values.cold_start_interest_ratio ?? '—' }}
          / 运营 {{ pack.values.cold_start_ops_ratio ?? '—' }}
        </template>
      </ConfigPackList>
    </div>

    <div class="container">
      <p class="plugins-tips">
        冷启池语录按正文语言入库（多数为 en）。列表空维=不过滤看全部池内条；选具体语言可精确筛。
        文档建议每语言约 ≥15 条。当前筛选下池内 <strong>{{ total }}</strong> 条。
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
        <div class="pro-toolbar-title">冷启池语录</div>
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
        <el-table-column prop="content" label="内容" />
        <el-table-column prop="interest_tags" label="标签" width="180">
          <template #default="{ row }">{{ tagsZh(row.interest_tags) }}</template>
        </el-table-column>
        <el-table-column prop="sort_weight" label="权重" width="90" />
        <el-table-column label="池内" width="100">
          <template #default="{ row }">
            <el-switch
              :model-value="row.in_cold_start_pool"
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

    <el-dialog v-model="visible" title="编辑冷启语录" width="640px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="内容"><el-input v-model="form.content" type="textarea" rows="4" /></el-form-item>
        <el-form-item label="App">
          <el-select v-model="form.app_key" filterable style="width: 100%">
            <el-option label="全部 App" value="" />
            <el-option v-for="a in APP_KEYS" :key="a" :label="a" :value="a" />
          </el-select>
        </el-form-item>
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
        <el-form-item label="排序权重"><el-input-number v-model="form.sort_weight" /></el-form-item>
        <el-form-item label="冷启池"><el-switch v-model="form.in_cold_start_pool" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
/**
 * 冷启池：占比维度包 + 池内语录列表（browse）。
 */
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchQuotes, saveQuote, fetchContentEnums } from '../api'
import ScopeFilter from '../components/ScopeFilter.vue'
import ConfigPackList from '../components/ConfigPackList.vue'
import { loadWithCache, clearPageCache } from '../utils/pageCache'
import { browseScopeParams, defaultCreateAppKey } from '../utils/scopeParams'
import { APP_KEYS, INTEREST_TAG_ZH, LANG_OPTIONS, langOptionLabel, optionLabelZh, tagsZh } from '../utils/enumZh'

const RATIO_KEYS = ['cold_start_interest_ratio', 'cold_start_ops_ratio']
const ratioDefaults = {
  cold_start_interest_ratio: 70,
  cold_start_ops_ratio: 30,
}

function validateRatios(f) {
  const sum = Number(f.cold_start_interest_ratio || 0) + Number(f.cold_start_ops_ratio || 0)
  if (sum !== 100) return '兴趣占比 + 运营池占比须为 100'
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
const interestTags = ref([])
const interestOpts = ref([])
const langOpts = ref([...LANG_OPTIONS])

function cacheKey(p = page.value) {
  return `cold_start_quotes_p${p}_${appKey.value || 'all'}_${language.value || 'all'}_${platform.value || 'all'}_${q.value || ''}`
}

function onScopeChange() {
  load(1)
}

async function loadEnums() {
  await loadWithCache('content_enums_cold_start', async () => {
    const res = await fetchContentEnums()
    const data = res.results || {}
    return {
      interestOpts: data.interest_tags || [],
      langOpts: data.app_langs || [],
    }
  }, (data) => {
    interestOpts.value = data.interestOpts || []
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
      in_cold_start_pool: 1,
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
    await saveQuote({ id: row.id, in_cold_start_pool: !!v })
    ElMessage.success(v ? '已加入冷启池' : '已移出冷启池')
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
    app_key: row.app_key || '',
    platform: row.platform || '',
  }
  interestTags.value = [...(row.interest_tags || [])]
  visible.value = true
}

async function save() {
  try {
    await saveQuote({
      ...form.value,
      interest_tags: interestTags.value,
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
</style>
