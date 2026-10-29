<!--
  晨晚祷内容 CRUD。背景按 kind 区分场景：晨祷配日间图，晚祷配夜间图。
-->
<template>
  <div class="container">
    <ScopeFilter mode="browse" v-model:app-key="appKey" v-model:language="language" v-model:platform="platform" @change="onScopeChange" />
    <p class="plugins-tips">
      背景必须按类型区分：<strong>晨祷</strong>配日间无字场景图，<strong>晚祷</strong>配夜间无字场景图。
      空则 App 使用对应时段本地底图。首页经文卡图带字，不要填到祷告页。
      轮换算法在「成长规则」（日历日 / 当日随机 / 排序 / 固定 ID）。
    </p>
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">晨晚祷</div>
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
      <el-table-column prop="kind" label="类型" width="100" />
      <el-table-column prop="title" label="标题" min-width="140" />
      <el-table-column prop="body" label="正文" min-width="200" />
      <el-table-column prop="reference" label="出处" width="120" />
      <el-table-column prop="version" label="版本" width="70" />
      <el-table-column prop="app_key" label="App名" min-width="110" width="110">
        <template #default="{ row }">{{ row.app_key || '空维' }}</template>
      </el-table-column>
      <el-table-column prop="language" label="语言" min-width="100" width="100">
        <template #default="{ row }">{{ row.language || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="platform" label="设备" min-width="100" width="100">
        <template #default="{ row }">{{ row.platform || '全部' }}</template>
      </el-table-column>
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

    <el-dialog v-model="visible" :title="form.id ? '编辑祷告' : '新建祷告'" width="640px" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="类型">
          <el-select v-model="form.kind" style="width: 100%">
            <el-option label="晨祷 morning" value="morning" />
            <el-option label="晚祷 night" value="night" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="正文"><el-input v-model="form.body" type="textarea" :rows="5" /></el-form-item>
        <el-form-item label="经文"><el-input v-model="form.verse_text" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="出处"><el-input v-model="form.reference" /></el-form-item>
        <el-form-item label="背景URL">
          <el-input v-model="form.image_url" :placeholder="bgPlaceholder" />
        </el-form-item>
        <el-form-item label="上传背景">
          <el-upload :show-file-list="false" :auto-upload="false" accept="image/*" :on-change="onUpload">
            <el-button :loading="uploading">上传 COS</el-button>
          </el-upload>
          <el-image v-if="form.image_url" :src="form.image_url" class="form-thumb" fit="cover" />
        </el-form-item>
        <el-form-item label="版本"><el-input-number v-model="form.version" :min="1" /></el-form-item>
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
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import { fetchPrayerContents, savePrayerContent, uploadFile } from '../../api'
import ScopeFilter from '../../components/ScopeFilter.vue'
import { browseScopeParams, defaultCreateAppKey } from '../../utils/scopeParams'
import { LANG_OPTIONS } from '../../utils/enumZh'

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

const bgPlaceholder = computed(() =>
  form.value.kind === 'night'
    ? '晚祷：夜间场景图'
    : '晨祷：日间场景图',
)

function onScopeChange() {
  load(1)
}

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    const res = await fetchPrayerContents({
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
        kind: 'morning',
        title: '',
        body: '',
        verse_text: '',
        reference: '',
        image_url: '',
        version: 1,
        sort_order: 0,
        enabled: true,
        app_key: defaultCreateAppKey(),
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
    const folder = form.value.kind === 'night' ? 'manna/prayer/night' : 'manna/prayer/morning'
    const res = await uploadFile(raw, folder)
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
  if (!(form.value.title || '').trim() || !(form.value.body || '').trim()) {
    ElMessage.warning('请填写标题与正文')
    return
  }
  try {
    await savePrayerContent({ ...form.value, app_key: defaultCreateAppKey() })
    ElMessage.success('已保存')
    visible.value = false
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

async function onDelete(id) {
  try {
    await ElMessageBox.confirm('确认删除该祷告？', '提示', { type: 'warning' })
    await savePrayerContent({ delete_id: id })
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
.form-thumb { width: 120px; height: 80px; border-radius: 8px; margin-left: 12px; vertical-align: middle; }
.table-td-thumb { width: 48px; height: 48px; border-radius: 6px; }
</style>
