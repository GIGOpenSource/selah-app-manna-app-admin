<!--
  灵修：系列 + 课时两级 CRUD。
-->
<template>
  <div class="container">
    <ScopeFilter mode="browse" v-model:app-key="appKey" v-model:language="language" v-model:platform="platform" @change="onScopeChange" />
    <p class="plugins-tips">
      系列封面请在「编辑」里上传到 COS 后保存；App 灵修列表精选大图与缩略图都读数据库 <code>cover_url</code>。
    </p>
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">灵修系列</div>
      <div class="pro-toolbar-actions">
        <el-button type="primary" :icon="CirclePlusFilled" @click="openSeries()">新建系列</el-button>
      </div>
    </div>
    <el-table :data="seriesRows" v-loading="loading" highlight-current-row @current-change="onSelectSeries">
      <el-table-column label="封面" width="88">
        <template #default="{ row }">
          <el-image
            v-if="row.cover_url"
            :src="row.cover_url"
            fit="cover"
            style="width: 56px; height: 56px; border-radius: 8px"
            :preview-src-list="[row.cover_url]"
            preview-teleported
          />
          <span v-else class="cover-empty">未上传</span>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="160" />
      <el-table-column prop="subtitle" label="副标题" min-width="140" show-overflow-tooltip />
      <el-table-column prop="session_count" label="课时" width="70" />
      <el-table-column prop="is_vip" label="VIP" width="70">
        <template #default="{ row }">{{ row.is_vip ? '是' : '否' }}</template>
      </el-table-column>
      <el-table-column prop="app_key" label="App名" width="90">
        <template #default="{ row }">{{ row.app_key || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="language" label="语言" width="90">
        <template #default="{ row }">{{ row.language || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="platform" label="设备" width="90">
        <template #default="{ row }">{{ row.platform || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="enabled" label="启用" width="80">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button link type="primary" @click="openSeries(row)">编辑</el-button>
          <el-button link type="primary" @click="selectAndLoadSessions(row)">课时</el-button>
          <el-button link type="danger" @click="onDeleteSeries(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      class="pagination"
      background
      layout="total, prev, pager, next"
      :total="seriesTotal"
      v-model:current-page="seriesPage"
      @current-change="loadSeries"
    />

    <div class="pro-toolbar" style="margin-top: 24px">
      <div class="pro-toolbar-title">课时{{ activeSeries ? ` · ${activeSeries.title}` : '' }}</div>
      <div class="pro-toolbar-actions">
        <el-button type="primary" :disabled="!activeSeries" @click="openSession()">新建课时</el-button>
      </div>
    </div>
    <el-table :data="sessionRows" v-loading="sessionLoading">
      <el-table-column prop="title" label="标题" min-width="160" />
      <el-table-column prop="scripture_ref" label="经文" width="140" />
      <el-table-column prop="sort_order" label="排序" width="70" />
      <el-table-column prop="duration_hint_sec" label="时长(s)" width="90" />
      <el-table-column prop="enabled" label="启用" width="80">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '是' : '否' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button link type="primary" @click="openSession(row)">编辑</el-button>
          <el-button link type="danger" @click="onDeleteSession(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="seriesVisible" :title="seriesForm.id ? '编辑系列' : '新建系列'" width="640px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="标题" required><el-input v-model="seriesForm.title" /></el-form-item>
        <el-form-item label="副标题"><el-input v-model="seriesForm.subtitle" /></el-form-item>
        <el-form-item label="封面" required>
          <div class="cover-field">
            <el-upload
              class="cover-uploader"
              :show-file-list="false"
              :auto-upload="false"
              accept="image/*"
              :on-change="onUploadCover"
            >
              <div v-if="seriesForm.cover_url" class="cover-preview">
                <img :src="seriesForm.cover_url" alt="cover" />
                <div class="cover-preview__mask">点击更换</div>
              </div>
              <el-button v-else type="primary" plain :loading="uploading">上传封面到 COS</el-button>
            </el-upload>
            <div class="cover-actions">
              <el-button
                v-if="seriesForm.cover_url"
                size="small"
                :loading="uploading"
                @click="triggerCoverPick"
              >重新上传</el-button>
              <el-button
                v-if="seriesForm.cover_url"
                size="small"
                type="danger"
                plain
                @click="seriesForm.cover_url = ''"
              >清除</el-button>
            </div>
            <el-input
              v-model="seriesForm.cover_url"
              placeholder="上传后自动填入 COS URL，也可粘贴已有地址"
              style="margin-top: 8px"
            />
            <p class="field-hint">App 灵修列表精选大图与行缩略图均读取此字段，保存后客户端刷新即生效。</p>
          </div>
        </el-form-item>
        <el-form-item label="Tags">
          <el-input v-model="tagsText" placeholder="逗号分隔，如 Anxiety,Peace" />
        </el-form-item>
        <el-form-item label="VIP"><el-switch v-model="seriesForm.is_vip" /></el-form-item>
        <el-form-item label="App">
          <el-select v-model="seriesForm.app_key" filterable style="width: 100%">
            <el-option label="全局（两 App 可见）" value="" />
            <el-option v-for="a in APP_KEYS" :key="a" :label="a" :value="a" />
          </el-select>
        </el-form-item>
        <el-form-item label="语言">
          <el-select v-model="seriesForm.language" style="width: 100%">
            <el-option label="全部" value="" />
            <el-option v-for="l in LANG_OPTIONS" :key="l.value" :label="l.label" :value="l.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="设备">
          <el-select v-model="seriesForm.platform" style="width: 100%">
            <el-option label="全部" value="" />
            <el-option label="iOS" value="ios" />
            <el-option label="Android" value="android" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="seriesForm.sort_order" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="seriesForm.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="saveSeries">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="sessionVisible" :title="sessionForm.id ? '编辑课时' : '新建课时'" width="640px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="标题"><el-input v-model="sessionForm.title" /></el-form-item>
        <el-form-item label="经文出处"><el-input v-model="sessionForm.scripture_ref" /></el-form-item>
        <el-form-item label="正文"><el-input v-model="sessionForm.body" type="textarea" :rows="8" /></el-form-item>
        <el-form-item label="时长(s)"><el-input-number v-model="sessionForm.duration_hint_sec" :min="0" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="sessionForm.sort_order" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="sessionForm.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="saveSession">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import {
  fetchDevotionSeries, saveDevotionSeries,
  fetchDevotionSessions, saveDevotionSession,
  uploadFile,
} from '../../api'
import ScopeFilter from '../../components/ScopeFilter.vue'
import { browseScopeParams } from '../../utils/scopeParams'
import { APP_KEYS, LANG_OPTIONS } from '../../utils/enumZh'

const appKey = ref('manna')
const language = ref('')
const platform = ref('')
const seriesRows = ref([])
const seriesPage = ref(1)
const seriesTotal = ref(0)
const loading = ref(false)
const uploading = ref(false)
const activeSeries = ref(null)
const sessionRows = ref([])
const sessionLoading = ref(false)
const seriesVisible = ref(false)
const seriesForm = ref({})
const tagsText = ref('')
const sessionVisible = ref(false)
const sessionForm = ref({})

function onScopeChange() {
  activeSeries.value = null
  sessionRows.value = []
  loadSeries(1)
}

async function loadSeries(p = seriesPage.value) {
  seriesPage.value = p
  loading.value = true
  try {
    const res = await fetchDevotionSeries({
      ...browseScopeParams({
        appKey: appKey.value,
        language: language.value,
        platform: platform.value,
      }),
      currentPage: seriesPage.value,
      pageSize: 20,
    })
    seriesRows.value = res.results || []
    seriesTotal.value = res.pagination?.total || 0
  } catch (e) {
    ElMessage.error(e.message || e.msg || '加载失败')
  } finally {
    loading.value = false
  }
}

function onSelectSeries(row) {
  if (row) selectAndLoadSessions(row)
}

async function selectAndLoadSessions(row) {
  activeSeries.value = row
  sessionLoading.value = true
  try {
    const res = await fetchDevotionSessions({ series_id: row.id, currentPage: 1, pageSize: 100 })
    sessionRows.value = res.results || []
  } catch (e) {
    ElMessage.error(e.message || e.msg || '课时加载失败')
  } finally {
    sessionLoading.value = false
  }
}

function openSeries(row) {
  seriesForm.value = row
    ? { ...row }
    : {
        title: '',
        subtitle: '',
        cover_url: '',
        tags: [],
        is_vip: false,
        session_count: 0,
        sort_order: 0,
        enabled: true,
        app_key: appKey.value || 'manna',
        language: language.value || '',
        platform: platform.value || '',
      }
  tagsText.value = Array.isArray(seriesForm.value.tags) ? seriesForm.value.tags.join(',') : ''
  seriesVisible.value = true
}

async function onUploadCover(file) {
  const raw = file?.raw
  if (!raw) return
  uploading.value = true
  try {
    const res = await uploadFile(raw, 'manna/devotion')
    const url = res.results?.url || res.data?.url || res?.url || ''
    if (!url) throw new Error('未返回 URL')
    seriesForm.value.cover_url = url
    ElMessage.success('封面已上传到 COS，请点保存写入数据库')
  } catch (e) {
    ElMessage.error(e.message || e.msg || '上传失败')
  } finally {
    uploading.value = false
  }
}

function triggerCoverPick() {
  const input = document.querySelector('.cover-uploader input[type="file"]')
  if (input) input.click()
}

async function saveSeries() {
  if (!(seriesForm.value.title || '').trim()) {
    ElMessage.warning('请填写标题')
    return
  }
  if (!(seriesForm.value.cover_url || '').trim()) {
    ElMessage.warning('请先上传封面')
    return
  }
  seriesForm.value.tags = tagsText.value.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
  try {
    await saveDevotionSeries(seriesForm.value)
    ElMessage.success('已保存')
    seriesVisible.value = false
    loadSeries()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

async function onDeleteSeries(row) {
  try {
    await ElMessageBox.confirm(`确认删除系列「${row.title}」及其课时关联？`, '提示', { type: 'warning' })
    await saveDevotionSeries({ delete_id: row.id })
    ElMessage.success('已删除')
    if (activeSeries.value?.id === row.id) {
      activeSeries.value = null
      sessionRows.value = []
    }
    loadSeries()
  } catch (e) {
    if (e === 'cancel' || e?.action === 'cancel') return
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}

function openSession(row) {
  if (!activeSeries.value) return
  sessionForm.value = row
    ? { ...row }
    : {
        series_id: activeSeries.value.id,
        title: '',
        scripture_ref: '',
        body: '',
        sort_order: 0,
        duration_hint_sec: 300,
        enabled: true,
      }
  sessionVisible.value = true
}

async function saveSession() {
  if (!(sessionForm.value.title || '').trim() || !(sessionForm.value.body || '').trim()) {
    ElMessage.warning('请填写标题与正文')
    return
  }
  try {
    await saveDevotionSession(sessionForm.value)
    ElMessage.success('已保存')
    sessionVisible.value = false
    await selectAndLoadSessions(activeSeries.value)
    loadSeries()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

async function onDeleteSession(id) {
  try {
    await ElMessageBox.confirm('确认删除该课时？', '提示', { type: 'warning' })
    await saveDevotionSession({ delete_id: id })
    ElMessage.success('已删除')
    await selectAndLoadSessions(activeSeries.value)
    loadSeries()
  } catch (e) {
    if (e === 'cancel' || e?.action === 'cancel') return
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}

onMounted(loadSeries)
</script>

<style scoped>
.cover-empty {
  color: #909399;
  font-size: 12px;
}
.cover-field {
  width: 100%;
}
.cover-preview {
  position: relative;
  width: 200px;
  height: 120px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid #ebeef5;
  cursor: pointer;
}
.cover-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.cover-preview__mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.35);
  color: #fff;
  font-size: 13px;
  opacity: 0;
  transition: opacity 0.15s ease;
}
.cover-preview:hover .cover-preview__mask {
  opacity: 1;
}
.cover-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
.field-hint {
  margin: 6px 0 0;
  color: #909399;
  font-size: 12px;
  line-height: 1.4;
}
</style>
