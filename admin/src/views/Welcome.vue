<!--
  Welcome 冷启页：标题/副标题/CTA/背景图，按语言×设备维护；version 上调可强制再看。
-->
<template>
  <div>
    <div class="container mgb16">
      <ConfigPackList
        title="Welcome 开关"
        tips="按维度控制是否展示冷启欢迎页；空维=看全部开关包。"
        :keys="['welcome_enabled']"
        :defaults="{ welcome_enabled: true }"
        remark="Welcome 开关"
        dialog-width="480px"
        :summary-keys="['welcome_enabled']"
      >
        <template #form="{ form: sw }">
          <el-form-item label="启用 Welcome">
            <el-switch v-model="sw.welcome_enabled" />
          </el-form-item>
        </template>
        <template #summary="{ pack }">
          {{ pack.values.welcome_enabled === false ? '关闭' : '开启' }}
        </template>
      </ConfigPackList>
    </div>

    <div class="container">
    <ScopeFilter
      mode="browse"
      v-model:app-key="appKey"
      v-model:language="language"
      v-model:platform="platform"
      @change="onScopeChange"
    />
    <p class="plugins-tips">
      冷启全屏欢迎页内容。空维=不过滤（看全部）；选具体维才精确筛。上调 <strong>version</strong> 可让已看过的用户再次看到。
      同维多条时 App 只读 <strong>priority</strong> 数字更大的一条。Terms/Privacy 链接走「品牌与法务」。
    </p>
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">Welcome 内容</div>
      <div class="pro-toolbar-actions">
        <el-button type="primary" :icon="CirclePlusFilled" @click="open()">新建</el-button>
      </div>
    </div>
    <el-table :data="rows" v-loading="loading">
      <el-table-column label="预览" width="88">
        <template #default="{ row }">
          <el-image
            v-if="row.image_url"
            class="table-td-thumb"
            :src="row.image_url"
            :preview-src-list="[row.image_url]"
            preview-teleported
            fit="cover"
          />
          <span v-else class="muted">本地底图</span>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" width="140" />
      <el-table-column prop="subtitle" label="副标题" />
      <el-table-column prop="cta_text" label="CTA" width="100" />
      <el-table-column prop="version" label="版本" width="70" />
      <el-table-column prop="app_key" label="App" width="90">
        <template #default="{ row }">{{ row.app_key || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="language" label="语言" width="80">
        <template #default="{ row }">{{ row.language || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="platform" label="设备" width="90">
        <template #default="{ row }">{{ row.platform || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="priority" label="优先级" width="80" />
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

    <el-dialog v-model="visible" :title="form.id ? '编辑 Welcome' : '新建 Welcome'" width="640px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="上传背景">
          <el-upload
            :show-file-list="false"
            :auto-upload="false"
            accept="image/*"
            :on-change="onUpload"
          >
            <el-button :loading="uploading">选择图片上传 COS</el-button>
          </el-upload>
          <div v-if="form.image_url" class="preview">
            <el-image :src="form.image_url" fit="cover" style="width: 72px; height: 128px; border-radius: 4px" />
          </div>
        </el-form-item>
        <el-form-item label="背景URL"><el-input v-model="form.image_url" placeholder="空则 App 用本地底图" /></el-form-item>
        <el-form-item label="标题"><el-input v-model="form.title" placeholder="Selah" /></el-form-item>
        <el-form-item label="副标题"><el-input v-model="form.subtitle" placeholder="Grow closer to God" /></el-form-item>
        <el-form-item label="按钮文案"><el-input v-model="form.cta_text" placeholder="Continue" /></el-form-item>
        <el-form-item label="版本">
          <el-input-number v-model="form.version" :min="1" />
          <span class="hint">上调后已看过的用户会再看一次</span>
        </el-form-item>
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
        <el-form-item label="优先级">
          <el-input-number v-model="form.priority" />
          <span class="hint">同维冲突时数字大优先</span>
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sort_order" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
    </div>
  </div>
</template>

<script setup>
/**
 * Welcome 冷启页运营：开关维度包 + 内容列表。
 */
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import { fetchWelcomeScreens, saveWelcomeScreen, uploadFile } from '../api'
import ScopeFilter from '../components/ScopeFilter.vue'
import ConfigPackList from '../components/ConfigPackList.vue'
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
  return `welcome_screens_${appKey.value || ''}_${language.value || ''}_${platform.value || ''}_p${page.value}`
}

function onScopeChange() {
  load(1)
}

async function load(p = page.value) {
  page.value = p
  loading.value = true
  try {
    await loadWithCache(cacheKey(), async () => {
      const res = await fetchWelcomeScreens({
        ...browseScopeParams({
          appKey: appKey.value,
          language: language.value,
          platform: platform.value,
        }),
        currentPage: page.value,
        pageSize: 20,
      })
      return {
        rows: res.results || [],
        total: res.pagination?.total || (res.results || []).length,
      }
    }, (data) => {
      rows.value = data.rows || []
      total.value = data.total || 0
    })
  } finally {
    loading.value = false
  }
}

function open(row) {
  form.value = row
    ? { ...row }
    : {
        title: 'Selah',
        subtitle: 'Grow closer to God',
        cta_text: 'Continue',
        image_url: '',
        version: 1,
        priority: 0,
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
    const res = await uploadFile(raw, 'selah/welcome')
    const url = res.results?.url || res.data?.url
    if (!url) throw new Error('未返回 URL')
    form.value.image_url = url
    ElMessage.success('已上传，URL 已填入')
  } catch (e) {
    ElMessage.error(e.message || e.msg || '上传失败')
  } finally {
    uploading.value = false
  }
}

async function save() {
  if (!(form.value.title || '').trim()) {
    ElMessage.warning('请填写标题')
    return
  }
  try {
    await saveWelcomeScreen(form.value)
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
    await ElMessageBox.confirm('确认删除该 Welcome？', '提示', { type: 'warning' })
    await saveWelcomeScreen({ delete_id: id })
    ElMessage.success('已删除')
    clearPageCache(cacheKey())
    load()
  } catch (e) {
    if (e === 'cancel' || e?.action === 'cancel') return
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}

onMounted(() => {
  load()
})
</script>

<style scoped>
.muted {
  color: #999;
  font-size: 12px;
}
.preview {
  margin-top: 8px;
}
.hint {
  margin-left: 12px;
  color: #999;
  font-size: 12px;
}
.plugins-tips {
  margin: 0 0 12px;
  color: #666;
  font-size: 13px;
  line-height: 1.5;
}
.mgb16 {
  margin-bottom: 16px;
}
</style>
