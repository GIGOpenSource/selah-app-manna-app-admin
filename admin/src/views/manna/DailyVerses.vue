<!--
  今日经文 CRUD：按 app×language×platform 维护；App Home 读取同 scope。
-->
<template>
  <div class="container">
    <ScopeFilter mode="browse" v-model:app-key="appKey" v-model:language="language" v-model:platform="platform" @change="onScopeChange" />
    <p class="plugins-tips">建议 Scope 切到 <code>manna</code>。删除走 POST <code>{ delete_id }</code>。</p>
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">今日经文</div>
      <div class="pro-toolbar-actions">
        <el-button type="primary" :icon="CirclePlusFilled" @click="open()">新建</el-button>
      </div>
    </div>
    <el-table :data="rows" v-loading="loading">
      <el-table-column label="预览" width="72">
        <template #default="{ row }">
          <el-image
            v-if="row.image_url"
            class="table-td-thumb"
            :src="row.image_url"
            :preview-src-list="[row.image_url]"
            preview-teleported
            fit="cover"
          />
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="verse_text" label="经文" min-width="220" />
      <el-table-column prop="reference" label="出处" width="140" />
      <el-table-column prop="active_date" label="生效日" width="120" />
      <el-table-column prop="app_key" label="App" width="90">
        <template #default="{ row }">{{ row.app_key || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="language" label="语言" width="80">
        <template #default="{ row }">{{ row.language || '全部' }}</template>
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

    <el-dialog v-model="visible" :title="form.id ? '编辑今日经文' : '新建今日经文'" width="640px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="经文"><el-input v-model="form.verse_text" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="出处"><el-input v-model="form.reference" placeholder="Isaiah 41:10" /></el-form-item>
        <el-form-item label="书卷"><el-input v-model="form.bible_book" placeholder="Isaiah" /></el-form-item>
        <el-form-item label="章/节">
          <el-input-number v-model="form.chapter" :min="0" />
          <el-input-number v-model="form.verse_start" :min="0" class="ml" />
          <el-input-number v-model="form.verse_end" :min="0" class="ml" />
        </el-form-item>
        <el-form-item label="背景URL"><el-input v-model="form.image_url" placeholder="可选壁纸图" /></el-form-item>
        <el-form-item label="上传背景">
          <el-upload :show-file-list="false" :auto-upload="false" accept="image/*" :on-change="onUpload">
            <el-button :loading="uploading">上传 COS</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item label="生效日"><el-date-picker v-model="form.active_date" type="date" value-format="YYYY-MM-DD" /></el-form-item>
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import { fetchDailyVerses, saveDailyVerse, uploadFile } from '../../api'
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
const uploading = ref(false)

function onScopeChange() {
  load(1)
}

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    const res = await fetchDailyVerses({
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
        verse_text: '',
        reference: '',
        bible_book: '',
        chapter: 0,
        verse_start: 0,
        verse_end: 0,
        image_url: '',
        wallpaper_id: null,
        active_date: null,
        sort_order: 0,
        enabled: true,
        app_key: appKey.value || 'manna',
        language: language.value || '',
        platform: platform.value || '',
      }
  visible.value = true
}

async function onUpload(file) {
  const raw = file?.raw
  if (!raw) return
  uploading.value = true
  try {
    const res = await uploadFile(raw, 'manna/daily-verse')
    const url = res.results?.url || res.data?.url
    if (!url) throw new Error('未返回 URL')
    form.value.image_url = url
    ElMessage.success('已上传')
  } catch (e) {
    ElMessage.error(e.message || e.msg || '上传失败')
  } finally {
    uploading.value = false
  }
}

async function save() {
  if (!(form.value.verse_text || '').trim()) {
    ElMessage.warning('请填写经文')
    return
  }
  try {
    await saveDailyVerse(form.value)
    ElMessage.success('已保存')
    visible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

async function onDelete(id) {
  try {
    await ElMessageBox.confirm('确认删除该今日经文？', '提示', { type: 'warning' })
    await saveDailyVerse({ delete_id: id })
    ElMessage.success('已删除')
    load()
  } catch (e) {
    if (e === 'cancel' || e?.action === 'cancel') return
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}

onMounted(load)
</script>

<style scoped>
.muted { color: #999; font-size: 12px; }
.plugins-tips { margin: 0 0 12px; color: #666; font-size: 13px; line-height: 1.5; }
.ml { margin-left: 8px; }
</style>
