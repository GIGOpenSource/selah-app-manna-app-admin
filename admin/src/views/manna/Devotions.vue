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
    <el-table :data="seriesRows" v-loading="loading" row-key="id">
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
      <el-table-column label="牧师介绍" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ row.pastor_bio || row.subtitle || '—' }}</template>
      </el-table-column>
      <el-table-column prop="pastor_name" label="牧师" width="120" show-overflow-tooltip />
      <el-table-column label="课时" width="80">
        <template #default="{ row }">
          <el-button link type="primary" @click.stop="openSessions(row)">{{ row.session_count ?? 0 }}</el-button>
        </template>
      </el-table-column>
      <el-table-column prop="is_vip" label="VIP" width="70">
        <template #default="{ row }">{{ row.is_vip ? '是' : '否' }}</template>
      </el-table-column>
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
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click.stop="openSeries(row)">编辑</el-button>
          <el-button link type="primary" @click.stop="openSessions(row)">课时</el-button>
          <el-button link type="danger" @click.stop="onDeleteSeries(row)">删除</el-button>
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

    <el-dialog
      v-model="sessionsVisible"
      :title="activeSeries ? `课时 · ${activeSeries.title}` : '课时'"
      width="880px"
      destroy-on-close
    >
      <div class="pro-toolbar" style="margin-top: 0">
        <div class="pro-toolbar-title">共 {{ sessionRows.length }} 节</div>
        <div class="pro-toolbar-actions">
          <el-button type="primary" @click="openSession()">新建课时</el-button>
        </div>
      </div>
      <el-table :data="sessionRows" v-loading="sessionLoading" row-key="id">
        <el-table-column prop="title" label="标题" min-width="140" />
        <el-table-column prop="scripture_ref" label="经文出处" width="140" show-overflow-tooltip />
        <el-table-column prop="scripture_text" label="经文" min-width="180" show-overflow-tooltip />
        <el-table-column prop="sort_order" label="排序" min-width="80" width="80" />
        <el-table-column prop="duration_hint_sec" label="时长(s)" width="90" />
        <el-table-column prop="enabled" label="启用" min-width="90" width="90">
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
        <template #empty>暂无课时，点击「新建课时」添加</template>
      </el-table>
    </el-dialog>

    <el-dialog v-model="seriesVisible" :title="seriesForm.id ? '编辑系列' : '新建系列'" width="640px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="标题" required><el-input v-model="seriesForm.title" /></el-form-item>
        <el-form-item label="牧师姓名"><el-input v-model="seriesForm.pastor_name" maxlength="128" placeholder="详情页作者简介" /></el-form-item>
        <el-form-item label="牧师介绍">
          <el-input v-model="seriesForm.pastor_bio" type="textarea" :rows="4" placeholder="牧师介绍" />
        </el-form-item>
        <el-form-item label="牧师头像">
          <div class="cover-field">
            <el-upload
              class="avatar-uploader"
              :show-file-list="false"
              :auto-upload="false"
              accept="image/*"
              :on-change="onUploadAvatar"
            >
              <div v-if="seriesForm.pastor_avatar_url" class="avatar-preview">
                <img :src="seriesForm.pastor_avatar_url" alt="pastor avatar" />
                <div class="cover-preview__mask">点击更换</div>
              </div>
              <el-button v-else type="primary" plain :loading="uploading === 'avatar'">上传头像</el-button>
            </el-upload>
            <div class="cover-actions">
              <el-button
                v-if="seriesForm.pastor_avatar_url"
                size="small"
                :loading="uploading === 'avatar'"
                @click="triggerFilePick('.avatar-uploader')"
              >重新上传</el-button>
              <el-button
                v-if="seriesForm.pastor_avatar_url"
                size="small"
                type="danger"
                plain
                @click="seriesForm.pastor_avatar_url = ''"
              >清除</el-button>
            </div>
            <p class="field-hint">上传牧师头像到 COS；可留空，App 详情页会回落用封面。</p>
          </div>
        </el-form-item>
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
              <el-button v-else type="primary" plain :loading="uploading === 'cover'">上传封面到 COS</el-button>
            </el-upload>
            <div class="cover-actions">
              <el-button
                v-if="seriesForm.cover_url"
                size="small"
                :loading="uploading === 'cover'"
                @click="triggerFilePick('.cover-uploader')"
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

    <el-dialog v-model="sessionVisible" :title="sessionForm.id ? '编辑课时' : '新建课时'" width="640px" append-to-body destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="标题"><el-input v-model="sessionForm.title" /></el-form-item>
        <el-form-item label="经文出处"><el-input v-model="sessionForm.scripture_ref" placeholder="如 John 3:16" /></el-form-item>
        <el-form-item label="经文">
          <el-input v-model="sessionForm.scripture_text" type="textarea" :rows="4" placeholder="经文" />
        </el-form-item>
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
import { browseScopeParams, defaultCreateAppKey } from '../../utils/scopeParams'
import { LANG_OPTIONS } from '../../utils/enumZh'

const appKey = ref('manna')
const language = ref('')
const platform = ref('')
const seriesRows = ref([])
const seriesPage = ref(1)
const seriesTotal = ref(0)
const loading = ref(false)
const uploading = ref('')
const activeSeries = ref(null)
const sessionRows = ref([])
const sessionLoading = ref(false)
const seriesVisible = ref(false)
const sessionsVisible = ref(false)
const seriesForm = ref({})
const tagsText = ref('')
const sessionVisible = ref(false)
const sessionForm = ref({})

function onScopeChange() {
  activeSeries.value = null
  sessionRows.value = []
  sessionsVisible.value = false
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

async function selectAndLoadSessions(row) {
  if (!row?.id) {
    ElMessage.warning('该系列缺少 ID，无法加载课时')
    return
  }
  activeSeries.value = row
  sessionLoading.value = true
  try {
    const res = await fetchDevotionSessions({
      series_id: row.id,
      currentPage: 1,
      pageSize: 100,
    })
    sessionRows.value = res.results || []
  } catch (e) {
    sessionRows.value = []
    ElMessage.error(e.message || e.msg || '课时加载失败')
  } finally {
    sessionLoading.value = false
  }
}

async function openSessions(row) {
  sessionsVisible.value = true
  await selectAndLoadSessions(row)
}

function openSeries(row) {
  if (row) {
    const next = { ...row }
    next.pastor_bio = row.pastor_bio || row.subtitle || ''
    delete next.subtitle
    seriesForm.value = next
  } else {
    seriesForm.value = {
        title: '',
        pastor_bio: '',
        pastor_name: '',
        pastor_avatar_url: '',
        cover_url: '',
        tags: [],
        is_vip: false,
        session_count: 0,
        sort_order: 0,
        enabled: true,
        app_key: defaultCreateAppKey(),
        language: language.value || '',
        platform: platform.value || '',
      }
  }
  tagsText.value = Array.isArray(seriesForm.value.tags) ? seriesForm.value.tags.join(',') : ''
  seriesVisible.value = true
}

async function uploadSeriesImage(file, slot, folder, field) {
  const raw = file?.raw
  if (!raw) return
  uploading.value = slot
  try {
    const res = await uploadFile(raw, folder)
    const url = res.results?.url || res.data?.url || res?.url || ''
    if (!url) throw new Error('未返回 URL')
    seriesForm.value[field] = url
    ElMessage.success(slot === 'avatar' ? '头像已上传，请点保存' : '封面已上传到 COS，请点保存写入数据库')
  } catch (e) {
    ElMessage.error(e.message || e.msg || '上传失败')
  } finally {
    uploading.value = ''
  }
}

function onUploadCover(file) {
  return uploadSeriesImage(file, 'cover', 'manna/devotion', 'cover_url')
}

function onUploadAvatar(file) {
  return uploadSeriesImage(file, 'avatar', 'manna/devotion/avatar', 'pastor_avatar_url')
}

function triggerFilePick(selector) {
  const input = document.querySelector(`${selector} input[type="file"]`)
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
  const payload = { ...seriesForm.value, app_key: defaultCreateAppKey() }
  payload.pastor_bio = String(payload.pastor_bio || '').trim()
  delete payload.subtitle
  try {
    await saveDevotionSeries(payload)
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
      sessionsVisible.value = false
    }
    loadSeries()
  } catch (e) {
    if (e === 'cancel' || e?.action === 'cancel') return
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}

function openSession(row) {
  if (!activeSeries.value) {
    ElMessage.warning('请先选择系列')
    return
  }
  sessionForm.value = row
    ? { ...row, scripture_text: row.scripture_text || '' }
    : {
        series_id: activeSeries.value.id,
        title: '',
        scripture_ref: '',
        scripture_text: '',
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
    const payload = { ...sessionForm.value }
    payload.scripture_text = String(payload.scripture_text || '').trim()
    payload.scripture_ref = String(payload.scripture_ref || '').trim()
    await saveDevotionSession(payload)
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
.avatar-preview {
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid #ebeef5;
  cursor: pointer;
}
.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.avatar-preview:hover .cover-preview__mask {
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
