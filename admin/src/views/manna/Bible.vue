<!--
  圣经译本列表 + 单章 JSON 导入。全库导入请走 seed / 脚本。
-->
<template>
  <div class="container">
    <ScopeFilter mode="browse" v-model:app-key="appKey" v-model:language="language" v-model:platform="platform" @change="onScopeChange" />
    <p class="plugins-tips">
      译本 CRUD + 单章 JSON 导入。仓库已 vendoring WEB/KJV 正文于 <code>fast_base/content/bible</code>；
      可点「导入 content」写入 DB。全量听经请设环境变量 <code>BIBLE_AUDIO_ROOT</code> 指向外挂音频目录。
    </p>
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">圣经译本</div>
      <div class="pro-toolbar-actions">
        <el-button :loading="contentImporting" @click="importFromContent">导入 content（Genesis+John）</el-button>
        <el-button @click="openImport">导入章节 JSON</el-button>
        <el-button type="primary" :icon="CirclePlusFilled" @click="open()">新建译本</el-button>
      </div>
    </div>
    <el-table :data="rows" v-loading="loading">
      <el-table-column prop="code" label="代码" width="100" />
      <el-table-column prop="title" label="名称" min-width="160" />
      <el-table-column prop="language" label="语言" width="80">
        <template #default="{ row }">{{ row.language || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="app_key" label="App" width="90">
        <template #default="{ row }">{{ row.app_key || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="platform" label="设备" width="90">
        <template #default="{ row }">{{ row.platform || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="sort_order" label="排序" width="70" />
      <el-table-column prop="enabled" label="启用" width="80">
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

    <el-dialog v-model="visible" :title="form.id ? '编辑译本' : '新建译本'" width="520px" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="代码"><el-input v-model="form.code" placeholder="web" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.title" placeholder="World English Bible" /></el-form-item>
        <el-form-item label="App">
          <el-select v-model="form.app_key" filterable style="width: 100%">
            <el-option label="全局（两 App 可见）" value="" />
            <el-option v-for="a in APP_KEYS" :key="a" :label="a" :value="a" />
          </el-select>
        </el-form-item>
        <el-form-item label="语言">
          <el-select v-model="form.language" style="width: 100%">
            <el-option label="全部" value="" />
            <el-option v-for="l in LANG_OPTIONS" :key="l.value" :label="l.label" :value="l.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="设备">
          <el-select v-model="form.platform" style="width: 100%">
            <el-option label="全部" value="" />
            <el-option label="iOS" value="ios" />
            <el-option label="Android" value="android" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sort_order" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importVisible" title="导入章节 JSON" width="680px" destroy-on-close>
      <p class="hint">示例字段：translation_code, book_key, book_name, chapter_num, verses[{verse,text}], audio_url</p>
      <el-input v-model="importJson" type="textarea" :rows="14" placeholder='{"translation_code":"web","book_key":"Genesis","book_name":"Genesis","chapter_num":1,"verses":[{"verse":1,"text":"..."}]}' />
      <template #footer>
        <el-button type="primary" :loading="importing" @click="doImport">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import { fetchBibleTranslations, saveBibleTranslation, importBibleChapter, importBibleContent } from '../../api'
import ScopeFilter from '../../components/ScopeFilter.vue'
import { browseScopeParams } from '../../utils/scopeParams'
import { APP_KEYS, LANG_OPTIONS } from '../../utils/enumZh'

const appKey = ref('manna')
const language = ref('')
const platform = ref('')
const rows = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const visible = ref(false)
const form = ref({})
const importVisible = ref(false)
const importJson = ref('')
const importing = ref(false)
const contentImporting = ref(false)

function onScopeChange() {
  load(1)
}

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    const res = await fetchBibleTranslations({
      ...browseScopeParams({
        appKey: appKey.value,
        language: language.value,
        platform: platform.value,
      }),
      currentPage: page.value,
      pageSize: 20,
    })
    rows.value = res.results || []
    total.value = res.pagination?.total || 0
  } catch (e) {
    ElMessage.error(e.message || e.msg || '加载失败')
  } finally {
    loading.value = false
  }
}

function open(row) {
  form.value = row
    ? { ...row }
    : {
        code: 'web',
        title: 'World English Bible',
        sort_order: 0,
        enabled: true,
        app_key: appKey.value || 'manna',
        language: language.value || '',
        platform: platform.value || '',
      }
  visible.value = true
}

async function save() {
  if (!(form.value.code || '').trim()) {
    ElMessage.warning('请填写译本代码')
    return
  }
  try {
    await saveBibleTranslation(form.value)
    ElMessage.success('已保存')
    visible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

async function onDelete(id) {
  try {
    await ElMessageBox.confirm('确认删除该译本？', '提示', { type: 'warning' })
    await saveBibleTranslation({ delete_id: id })
    ElMessage.success('已删除')
    load()
  } catch (e) {
    if (e === 'cancel' || e?.action === 'cancel') return
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}

function openImport() {
  importJson.value = JSON.stringify({
    translation_code: 'web',
    translation_title: 'World English Bible',
    book_key: 'Genesis',
    book_name: 'Genesis',
    chapter_num: 1,
    app_key: appKey.value || 'manna',
    language: language.value || '',
    platform: platform.value || '',
    verses: [{ verse: 1, text: 'In the beginning God created the heavens and the earth.' }],
  }, null, 2)
  importVisible.value = true
}

async function doImport() {
  let payload
  try {
    payload = JSON.parse(importJson.value)
  } catch (e) {
    ElMessage.warning('JSON 无法解析')
    return
  }
  importing.value = true
  try {
    const res = await importBibleChapter(payload)
    ElMessage.success(`已导入 ${res.results?.verse_count ?? ''} 节`)
    importVisible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '导入失败')
  } finally {
    importing.value = false
  }
}

async function importFromContent() {
  contentImporting.value = true
  try {
    const res = await importBibleContent({
      seed_core: true,
      app_key: appKey.value || 'manna',
      language: language.value || '',
      platform: platform.value || '',
    })
    ElMessage.success(`content 导入完成：${JSON.stringify(res.results || {})}`)
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || 'content 导入失败')
  } finally {
    contentImporting.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.plugins-tips { margin: 0 0 12px; color: #666; font-size: 13px; line-height: 1.5; }
.hint { margin: 0 0 8px; color: #999; font-size: 12px; }
</style>
