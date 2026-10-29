<!--
  安全词/热线：开关+拒答为维度打包；关键词/热线为内容列表。
-->
<template>
  <div>
    <div class="container mgb20" v-if="packKeys.length">
      <ConfigPackList
        title="安全开关与拒答文案"
        tips="类别开关与拒答文案按维度打包；空维=看全部包。下方关键词/热线为空维看全部列表。"
        :keys="packKeys"
        :defaults="packDefaults"
        remark="安全配置"
        dialog-width="720px"
        :summary-keys="summaryKeys"
      >
        <template #form="{ form }">
          <el-divider content-position="left">类别开关</el-divider>
          <el-form-item
            v-for="c in safetyCats"
            :key="c.config_key"
            :label="c.label || labelZh(SAFETY_CATEGORY_ZH, c.value)"
          >
            <el-switch v-model="form[c.config_key]" />
            <span class="key-en">{{ c.config_key }}</span>
          </el-form-item>
          <el-divider content-position="left">拒答 / 危机文案</el-divider>
          <el-form-item
            v-for="r in refuseDefs"
            :key="r.key"
            :label="r.label"
          >
            <el-input v-model="form[r.key]" type="textarea" :rows="2" />
          </el-form-item>
        </template>
      </ConfigPackList>
    </div>

    <div class="container mgb20">
      <ScopeFilter
        mode="browse"
        v-model:app-key="appKey"
        v-model:language="language"
        v-model:platform="platform"
        @change="onScopeChange"
      />
      <div class="pro-toolbar">
        <div class="pro-toolbar-title">安全关键词</div>
      </div>
      <el-form inline class="pro-search">
        <el-form-item>
          <el-select v-model="kw.category" style="width: 180px" placeholder="类别">
            <el-option
              v-for="c in safetyCats"
              :key="c.value"
              :label="c.label || labelZh(SAFETY_CATEGORY_ZH, c.value)"
              :value="c.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-input v-model="kw.keyword" placeholder="关键词" style="width:200px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="addKw">添加（挂当前筛选维，空=全局）</el-button>
        </el-form-item>
      </el-form>
      <el-table :data="keywords">
        <el-table-column label="类别" width="140">
          <template #default="{ row }">{{ labelZh(SAFETY_CATEGORY_ZH, row.category) }}</template>
        </el-table-column>
        <el-table-column prop="keyword" label="关键词" />
        <el-table-column prop="app_key" label="App" min-width="110" width="110">
          <template #default="{ row }">{{ row.app_key || '全部' }}</template>
        </el-table-column>
        <el-table-column prop="language" label="语言" min-width="100" width="100">
          <template #default="{ row }">{{ row.language || '全部' }}</template>
        </el-table-column>
        <el-table-column v-if="showPlat" prop="platform" label="设备" min-width="100" width="100">
          <template #default="{ row }">{{ row.platform || '全部' }}</template>
        </el-table-column>
        <el-table-column label="启用" min-width="100" width="100">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" @change="(v) => toggleKw(row, v)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button link type="danger" @click="delKw(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        class="pagination"
        background
        layout="total, prev, pager, next"
        :total="kwTotal"
        v-model:current-page="kwPage"
        @current-change="loadKeywords"
      />
    </div>

    <div class="container">
      <div class="pro-toolbar">
        <div class="pro-toolbar-title">危机热线</div>
      </div>
      <el-form inline class="pro-search">
        <el-form-item>
          <el-select v-model="hl.country" filterable style="width: 200px" placeholder="国家/地区">
            <el-option
              v-for="c in COUNTRY_OPTIONS"
              :key="c.value"
              :label="c.label"
              :value="c.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-input v-model="hl.label" placeholder="label" style="width:180px" />
        </el-form-item>
        <el-form-item>
          <el-input v-model="hl.phone_or_url" placeholder="phone" style="width:160px" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="addHl">添加（挂当前筛选维，空=全局）</el-button>
        </el-form-item>
      </el-form>
      <el-table :data="hotlines">
        <el-table-column prop="country" label="国家" width="80" />
        <el-table-column prop="label" label="标签" />
        <el-table-column prop="phone_or_url" label="电话/链接" />
        <el-table-column prop="app_key" label="App" min-width="110" width="110">
          <template #default="{ row }">{{ row.app_key || '全部' }}</template>
        </el-table-column>
        <el-table-column prop="language" label="语言" min-width="100" width="100">
          <template #default="{ row }">{{ row.language || '全部' }}</template>
        </el-table-column>
        <el-table-column v-if="showPlat" prop="platform" label="设备" min-width="100" width="100">
          <template #default="{ row }">{{ row.platform || '全部' }}</template>
        </el-table-column>
        <el-table-column label="启用" min-width="100" width="100">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" @change="(v) => toggleHl(row, v)" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{ row }">
            <el-button link type="danger" @click="delHl(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination
        class="pagination"
        background
        layout="total, prev, pager, next"
        :total="hlTotal"
        v-model:current-page="hlPage"
        @current-change="loadHotlines"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  fetchSafety, saveSafety, fetchHotlines, saveHotline, fetchContentEnums,
} from '../api'
import ScopeFilter from '../components/ScopeFilter.vue'
import ConfigPackList from '../components/ConfigPackList.vue'
import { browseScopeParams, defaultCreateAppKey } from '../utils/scopeParams'
import { labelZh, SAFETY_CATEGORY_ZH, COUNTRY_OPTIONS } from '../utils/enumZh'
import { shouldHidePlatform } from '../utils/productContext'

const REFUSE_EXTRA = [
  { key: 'ai_refuse_general', label: '通用拒答' },
  { key: 'ai_crisis_footer', label: '危机尾注' },
]

const appKey = ref('')
const language = ref('')
const platform = ref('')
const keywords = ref([])
const hotlines = ref([])
const kwPage = ref(1)
const kwTotal = ref(0)
const hlPage = ref(1)
const hlTotal = ref(0)
const safetyCats = ref([])
const kw = ref({ category: 'self_harm', keyword: '' })
const showPlat = !shouldHidePlatform()
const hl = ref({ country: 'US', label: '', phone_or_url: '' })

const refuseDefs = computed(() => [
  ...REFUSE_EXTRA.slice(0, 1),
  ...safetyCats.value.map((d) => ({ key: d.refuse_key, label: `${d.label || d.value}拒答` })),
  ...REFUSE_EXTRA.slice(1),
])

const packKeys = computed(() => [
  ...safetyCats.value.map((d) => d.config_key).filter(Boolean),
  ...refuseDefs.value.map((d) => d.key).filter(Boolean),
])

const packDefaults = computed(() => {
  const d = {}
  for (const c of safetyCats.value) {
    if (c.config_key) d[c.config_key] = true
  }
  for (const r of refuseDefs.value) {
    d[r.key] = ''
  }
  return d
})

const summaryKeys = computed(() => [
  safetyCats.value[0]?.config_key,
  'ai_refuse_general',
].filter(Boolean))

function onScopeChange() {
  kwPage.value = 1
  hlPage.value = 1
  loadLists()
}

async function loadEnums() {
  const res = await fetchContentEnums()
  safetyCats.value = (res.results || {}).safety_categories || []
  if (safetyCats.value.length && !kw.value.category) {
    kw.value.category = safetyCats.value[0].value
  }
}

async function loadKeywords(p = kwPage.value) {
  kwPage.value = p
  const res = await fetchSafety({
    currentPage: kwPage.value,
    pageSize: 20,
    ...browseScopeParams({
      appKey: appKey.value,
      language: language.value,
      platform: platform.value,
    }),
  })
  keywords.value = res.results || []
  kwTotal.value = res.pagination?.total || keywords.value.length
}

async function loadHotlines(p = hlPage.value) {
  hlPage.value = p
  const res = await fetchHotlines({
    currentPage: hlPage.value,
    pageSize: 20,
    ...browseScopeParams({
      appKey: appKey.value,
      language: language.value,
      platform: platform.value,
    }),
  })
  hotlines.value = res.results || []
  hlTotal.value = res.pagination?.total || hotlines.value.length
}

async function loadLists() {
  await Promise.all([loadKeywords(), loadHotlines()])
}

async function addKw() {
  try {
    await saveSafety({
      ...kw.value,
      app_key: defaultCreateAppKey(appKey.value),
      language: language.value || '',
      platform: platform.value || '',
    })
    kw.value.keyword = ''
    loadKeywords(1)
  } catch (e) {
    ElMessage.error(e.message || '添加失败')
  }
}

async function toggleKw(row, v) {
  try {
    await saveSafety({ id: row.id, enabled: !!v })
    loadKeywords()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '更新失败')
    loadKeywords()
  }
}

async function delKw(id) {
  try {
    await saveSafety({ delete_id: id })
    loadKeywords()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}

async function addHl() {
  try {
    await saveHotline({
      ...hl.value,
      app_key: defaultCreateAppKey(appKey.value),
      language: language.value || '',
      platform: platform.value || '',
    })
    hl.value = { country: 'US', label: '', phone_or_url: '' }
    loadHotlines(1)
  } catch (e) {
    ElMessage.error(e.message || e.msg || '添加失败')
  }
}

async function toggleHl(row, v) {
  try {
    await saveHotline({ id: row.id, enabled: !!v })
    loadHotlines()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '更新失败')
    loadHotlines()
  }
}

async function delHl(id) {
  try {
    await saveHotline({ delete_id: id })
    loadHotlines()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}

onMounted(async () => {
  await loadEnums()
  await loadLists()
})
</script>

<style scoped>
.mgb20 { margin-bottom: 16px; }
.key-en {
  margin-left: 8px;
  color: #8a8a8a;
  font-size: 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
</style>
