<!--
  App 图标目录（Selah 3.0）：Alternate Icon CRUD；icon_key 须与原生资源一致。
-->
<template>
  <div class="container">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="page-tip"
      title="icon_key 须与原生 Alternate Icon / activity-alias 一致；改 key 需发版。"
    />
    <ScopeFilter
      mode="browse"
      v-model:app-key="appKey"
      v-model:language="language"
      v-model:platform="platform"
      @change="load(1)"
    />
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">App 图标</div>
      <div class="pro-toolbar-actions">
        <el-button type="primary" :icon="CirclePlusFilled" @click="open()">新建</el-button>
      </div>
    </div>
    <el-table :data="rows" v-loading="loading">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="预览" width="80">
        <template #default="{ row }">
          <el-image
            v-if="row.preview_url"
            class="table-td-thumb"
            :src="row.preview_url"
            :preview-src-list="[row.preview_url]"
            preview-teleported
            fit="cover"
          />
          <span v-else>—</span>
        </template>
      </el-table-column>
      <el-table-column prop="icon_key" label="icon_key" min-width="120" />
      <el-table-column prop="title" label="标题" min-width="120" />
      <el-table-column prop="is_vip" label="VIP" width="70">
        <template #default="{ row }">
          <el-tag :type="row.is_vip ? 'warning' : 'info'" size="small">{{ row.is_vip ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="sort_order" label="排序" width="70" />
      <el-table-column prop="enabled" label="启用" width="70">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '是' : '否' }}</el-tag>
        </template>
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
      <el-table-column label="操作" width="160" fixed="right">
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

    <el-dialog v-model="visible" :title="form.id ? '编辑图标' : '新建图标'" width="560px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="icon_key" required>
          <el-input v-model="form.icon_key" placeholder="如 default / cross_light" />
        </el-form-item>
        <el-form-item label="标题" required>
          <el-input v-model="form.title" maxlength="64" />
        </el-form-item>
        <el-form-item label="预览图" required>
          <el-upload
            :show-file-list="false"
            :auto-upload="false"
            accept="image/*"
            :on-change="onUpload"
          >
            <el-button :loading="uploading" size="small">上传 COS</el-button>
          </el-upload>
          <el-input v-model="form.preview_url" placeholder="上传后自动填入 URL" style="margin-top: 8px" />
          <div v-if="form.preview_url" class="preview">
            <el-image :src="form.preview_url" fit="cover" style="width: 64px; height: 64px; border-radius: 12px" />
          </div>
        </el-form-item>
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
        <el-form-item label="排序"><el-input-number v-model="form.sort_order" :min="0" /></el-form-item>
        <el-form-item label="VIP"><el-switch v-model="form.is_vip" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import { fetchAppIcons, saveAppIcon, deleteAppIcon, uploadFile } from '../api'
import ScopeFilter from '../components/ScopeFilter.vue'
import { loadWithCache, clearPageCache } from '../utils/pageCache'
import { browseScopeParams, defaultCreateAppKey } from '../utils/scopeParams'
import { APP_KEYS, LANG_OPTIONS } from '../utils/enumZh'

const appKey = ref('')
const language = ref('')
const platform = ref('')
const rows = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const visible = ref(false)
const form = ref({})
const uploading = ref(false)

function cacheKey() {
  return `app_icons_p${page.value}_${appKey.value || ''}_${language.value || ''}_${platform.value || ''}`
}

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
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
      const res = await fetchAppIcons(params)
      return {
        rows: res.results || [],
        total: res.pagination?.total || (res.results || []).length,
      }
    }, (data) => {
      rows.value = data.rows || []
      total.value = data.total || 0
    })
  } catch (e) {
    ElMessage.error(e.message || e.msg || '加载失败')
  } finally {
    loading.value = false
  }
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
        icon_key: '',
        title: '',
        preview_url: '',
        is_vip: false,
        sort_order: 0,
        enabled: true,
        app_key: defaultCreateAppKey(appKey.value),
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
    const res = await uploadFile(raw, 'selah/app-icons')
    const url = res.results?.url || res.data?.url
    if (!url) throw new Error('未返回 URL')
    form.value.preview_url = url
    ElMessage.success('已上传，URL 已填入')
  } catch (e) {
    ElMessage.error(e.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

async function save() {
  const key = (form.value.icon_key || '').trim()
  if (!key) {
    ElMessage.warning('请填写 icon_key')
    return
  }
  if (!/^[a-z0-9_-]+$/i.test(key)) {
    ElMessage.warning('icon_key 建议仅含字母数字下划线与连字符')
    return
  }
  if (!(form.value.title || '').trim()) {
    ElMessage.warning('请填写标题')
    return
  }
  if (!(form.value.preview_url || '').trim()) {
    ElMessage.warning('请上传或填写预览图 URL')
    return
  }
  try {
    await saveAppIcon({ ...form.value, icon_key: key })
    ElMessage.success('已保存')
    visible.value = false
    clearPageCache(cacheKey())
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

async function onDelete(id) {
  try {
    await ElMessageBox.confirm('确认删除该图标？', '删除确认', { type: 'warning' })
    await deleteAppIcon(id)
    ElMessage.success('已删除')
    clearPageCache(cacheKey())
    load()
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}

onMounted(load)
</script>

<style scoped>
.page-tip {
  margin-bottom: 12px;
}
.table-td-thumb {
  width: 40px;
  height: 40px;
  border-radius: 8px;
}
.preview {
  margin-top: 8px;
}
</style>
