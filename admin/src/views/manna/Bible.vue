<!--
  圣经译本：一种 code 一套 content 文件，language 控制可见性。
  男女声靠音频路径 male/female，不按界面语言拆字段。
-->
<template>
  <div class="container">
    <ScopeFilter mode="browse" v-model:app-key="appKey" v-model:language="language" v-model:platform="platform" @change="onScopeChange" />
    <p class="plugins-tips">
      一种正式译本对应一个 code 和一套 <code>content/bible</code> 文件，并用 language 控制 App 可见性（空=全语言兜底，中文正式本用 zh）。
      男女声靠音频路径里的 male / female。机翻不落库。
      听经音频根目录可在本页填写（优先于环境变量 <code>BIBLE_AUDIO_ROOT</code>）。翻译 Key 只走环境变量。
    </p>
    <el-form class="runtime-row" label-width="100px" v-loading="runtimeLoading">
      <div class="runtime-grid">
        <el-form-item label="音频根目录">
          <el-input v-model="runtime.bible_audio_root" placeholder="空则用环境变量 BIBLE_AUDIO_ROOT" />
        </el-form-item>
        <el-form-item label="经文翻译">
          <el-switch v-model="runtime.translate_enabled" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveRuntime">保存接入配置</el-button>
        </el-form-item>
      </div>
    </el-form>
    <p class="runtime-hint">{{ translateHint }}</p>
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">圣经译本</div>
      <div class="pro-toolbar-actions">
        <el-button @click="openContentImport">导入 zip</el-button>
        <el-button type="primary" :icon="CirclePlusFilled" @click="open()">新建译本</el-button>
      </div>
    </div>
    <el-table :data="rows" v-loading="loading">
      <el-table-column prop="code" label="代码" width="100" />
      <el-table-column prop="title" label="名称" min-width="160" />
      <el-table-column prop="language" label="语言" min-width="140" width="150">
        <template #default="{ row }">{{ formatLang(row.language) }}</template>
      </el-table-column>
      <el-table-column prop="app_key" label="App" min-width="110" width="110">
        <template #default="{ row }">{{ row.app_key || '空维' }}</template>
      </el-table-column>
      <el-table-column prop="platform" label="设备" min-width="100" width="100">
        <template #default="{ row }">{{ row.platform || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="sort_order" label="排序" min-width="80" width="80" />
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

    <el-dialog v-model="visible" :title="form.id ? '编辑译本' : '新建译本'" width="520px" destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="代码"><el-input v-model="form.code" placeholder="web / cuv" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.title" placeholder="World English Bible / 和合本" /></el-form-item>
        <el-form-item label="语言">
          <el-select v-model="form.language" style="width: 100%">
            <el-option label="全部（空，全语言兜底）" value="" />
            <el-option v-for="l in LANG_OPTIONS" :key="l.value" :label="l.label" :value="l.value" />
          </el-select>
          <p class="field-hint">英文 WEB/KJV 保持「全部」，不要选英语。中文正式本选中文。</p>
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

    <el-dialog v-model="contentVisible" title="导入译本 zip" width="640px" destroy-on-close>
      <p class="hint">
        zip 内放英文书卷目录，例如 <code>Genesis/001.json</code>。音频可选：<code>male/Genesis/001.mp3</code>、<code>female/Genesis/001.mp3</code>。
        也兼容 <code>CUV/</code>、<code>data/</code>、<code>audio/</code> 前缀。文件需为 .zip，且不超过 200MB。
      </p>
      <el-form label-width="110px" class="import-form" v-loading="contentLoading">
        <el-form-item label="译本" required>
          <el-select v-model="zipVersion" filterable placeholder="选择 VERSION" style="width: 100%" :disabled="contentImporting" @change="onZipVersion">
            <el-option v-for="v in contentVersions" :key="versionValue(v)" :label="versionOptionLabel(v)" :value="versionValue(v)" />
          </el-select>
        </el-form-item>
        <el-form-item label="语言">
          <el-select v-model="zipLanguage" filterable style="width: 100%" :disabled="contentImporting" @change="onZipLanguage">
            <el-option label="不传（按译本默认）" :value="ZIP_LANG_OMIT" />
            <el-option label="全部（空，全语言兜底）" value="" />
            <el-option v-for="l in zipLanguageOptions" :key="l.language" :label="localeOptionLabel(l)" :value="l.language" />
          </el-select>
        </el-form-item>
        <el-form-item label="标题">
          <el-input v-model="zipTitle" placeholder="可选，自动建译本时使用" :disabled="contentImporting" />
        </el-form-item>
        <el-form-item label="zip" required>
          <div class="zip-file">
            <el-upload
              :auto-upload="false"
              :show-file-list="false"
              accept=".zip,application/zip"
              :disabled="contentImporting"
              :on-change="onZipPicked"
            >
              <el-button :disabled="contentImporting">选择 zip</el-button>
            </el-upload>
            <span v-if="zipFile" class="inline-hint">{{ zipFile.name }}（{{ formatZipSize(zipFile.size) }}）</span>
          </div>
        </el-form-item>
        <el-form-item label="包内音频">
          <el-switch v-model="uploadAudio" :disabled="contentImporting" />
          <span class="inline-hint">导入 zip 里的 mp3</span>
        </el-form-item>
      </el-form>
      <div v-if="zipResult" class="import-result">
        <p>{{ zipResult.version || zipVersion }} · language {{ formatLang(zipResult.language) }}</p>
        <p>章节 {{ zipResult.chapters ?? 0 }} · 经文 {{ zipResult.verses ?? 0 }} · 音频 {{ zipResult.audio_files ?? 0 }} · 跳过 {{ zipResult.skipped ?? 0 }}</p>
      </div>
      <ul v-if="zipErrors.length" class="import-errors">
        <li v-for="(item, index) in zipErrors" :key="index">{{ item }}</li>
      </ul>
      <template #footer>
        <el-button type="primary" :loading="contentImporting" :disabled="contentImporting" @click="importZip">开始导入</el-button>
      </template>
    </el-dialog>

    <div class="browse-block">
      <el-divider content-position="left">书卷 / 章 / 节改错</el-divider>
      <p class="hint">选译本后可改书卷名，以及每章的 audio_url_male / audio_url_female，并按男声/女声上传 mp3。节正文在「经文」里改错；批量灌库用「导入 zip」。</p>
    <el-select v-model="browseTrId" placeholder="选择译本" filterable clearable style="width: 280px; margin-bottom: 12px" @change="loadBooks">
      <el-option v-for="r in rows" :key="r.id" :label="`${r.code} · ${r.title}`" :value="r.id" />
    </el-select>
    <el-table :data="books" v-loading="booksLoading" class="allow-wrap" max-height="360">
      <el-table-column prop="book_key" label="key" width="140" />
      <el-table-column prop="name" label="名称" min-width="160">
        <template #default="{ row }">
          <el-input v-model="row.name" size="small" @change="saveBook(row)" />
        </template>
      </el-table-column>
      <el-table-column prop="testament" label="约" width="80" />
      <el-table-column label="操作" width="100">
        <template #default="{ row }">
          <el-button link type="primary" @click="openChapters(row)">章节</el-button>
        </template>
      </el-table-column>
    </el-table>
    </div>

    <el-dialog v-model="chVisible" :title="chTitle" width="1080px" destroy-on-close>
      <p class="hint">男声、女声分开保存。男声只改 audio_url_male，女声只改 audio_url_female，上传也不会互相覆盖。</p>
      <el-table :data="chapters" v-loading="chLoading" class="chapter-table" max-height="440">
        <el-table-column prop="chapter_num" label="章" width="64" />
        <el-table-column label="男声 URL" min-width="280">
          <template #default="{ row }">
            <div class="audio-cell">
              <el-input v-model="row.audio_url_male" size="small" placeholder="audio_url_male" :title="row.audio_url_male" @change="saveChapter(row, 'male')" />
              <el-tag v-if="audioPathGender(row.audio_url_male)" size="small" :type="audioPathGender(row.audio_url_male) === 'male' ? 'primary' : 'warning'">
                {{ audioPathGender(row.audio_url_male) }}
              </el-tag>
              <el-upload
                class="chapter-upload"
                :show-file-list="false"
                :auto-upload="false"
                accept=".mp3,audio/mpeg"
                :disabled="!!row._uploadingMale"
                :on-change="(file) => onChapterAudio(row, file, 'male')"
              >
                <el-button link type="primary" :loading="!!row._uploadingMale">上传</el-button>
              </el-upload>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="女声 URL" min-width="280">
          <template #default="{ row }">
            <div class="audio-cell">
              <el-input v-model="row.audio_url_female" size="small" placeholder="audio_url_female" :title="row.audio_url_female" @change="saveChapter(row, 'female')" />
              <el-tag v-if="audioPathGender(row.audio_url_female)" size="small" :type="audioPathGender(row.audio_url_female) === 'female' ? 'danger' : 'warning'">
                {{ audioPathGender(row.audio_url_female) }}
              </el-tag>
              <el-upload
                class="chapter-upload"
                :show-file-list="false"
                :auto-upload="false"
                accept=".mp3,audio/mpeg"
                :disabled="!!row._uploadingFemale"
                :on-change="(file) => onChapterAudio(row, file, 'female')"
              >
                <el-button link type="primary" :loading="!!row._uploadingFemale">上传</el-button>
              </el-upload>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="秒" width="120" class-name="sec-col">
          <template #default="{ row }">
            <el-input-number
              v-model="row.audio_duration_sec"
              class="sec-input"
              size="small"
              :min="0"
              controls-position="right"
              @change="saveChapter(row)"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="72" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openVerses(row)">经文</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="vsVisible" :title="vsTitle" width="760px" destroy-on-close>
      <el-table :data="verses" v-loading="vsLoading" class="allow-wrap" max-height="480">
        <el-table-column prop="verse_num" label="节" width="70" />
        <el-table-column label="正文" min-width="420">
          <template #default="{ row }">
            <el-input v-model="row.text" type="textarea" :rows="2" @change="saveVerse(row)" />
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import { fetchBibleTranslations, saveBibleTranslation, fetchBibleImportContent, importBibleZip, uploadBibleChapterAudio, fetchBibleBooks, saveBibleBook, fetchBibleChapters, saveBibleChapter, fetchBibleVerses, saveBibleVerse, fetchConfigs, saveConfig } from '../../api'
import ScopeFilter from '../../components/ScopeFilter.vue'
import { browseScopeParams, defaultCreateAppKey } from '../../utils/scopeParams'
import { LANG_OPTIONS, LANG_ZH, langOptionLabel } from '../../utils/enumZh'
import { getAdminProduct } from '../../utils/productContext'

const ZIP_LANG_OMIT = '__omit__'
const ZIP_MAX_BYTES = 200 * 1024 * 1024

const appKey = ref(getAdminProduct())
const language = ref('')
const platform = ref('')
const rows = ref([])
const page = ref(1)
const total = ref(0)
const loading = ref(false)
const visible = ref(false)
const form = ref({})
const contentVisible = ref(false)
const contentLoading = ref(false)
const contentImporting = ref(false)
const contentVersions = ref([])
const localeOptions = ref([])
const zipVersion = ref('')
const zipLanguage = ref(ZIP_LANG_OMIT)
const zipTitle = ref('')
const zipFile = ref(null)
const uploadAudio = ref(true)
const zipResult = ref(null)
const zipErrors = ref([])
let zipSyncing = false
const browseTrId = ref(null)
const books = ref([])
const booksLoading = ref(false)
const chVisible = ref(false)
const chTitle = ref('')
const chapters = ref([])
const chLoading = ref(false)
const vsVisible = ref(false)
const vsTitle = ref('')
const verses = ref([])
const vsLoading = ref(false)
const runtimeLoading = ref(false)
const translateHint = ref('翻译 Key 检测中…')
const runtime = ref({
  bible_audio_root: '',
  translate_enabled: true,
})

function formatLang(code) {
  if (code == null || code === '') return '全部（兜底）'
  return langOptionLabel(code)
}

function localeOptionLabel(item) {
  const name = LANG_ZH[item.language] || langOptionLabel(item.language)
  const primary = item.primary_versions?.[0]
  return primary ? `${name} · ${primary}` : name
}

const zipLanguageOptions = computed(() => localeOptions.value.filter((item) => item.language))

function versionValue(row) {
  return row?.version || String(row?.code || '').toUpperCase()
}

function versionOptionLabel(row) {
  const flags = [
    row.has_data ? '有经文' : '无经文',
    row.has_audio ? '有音频' : '无音频',
  ].join(' / ')
  return `${versionValue(row)} · ${row.title || ''}（${flags}）`
}

function findVersionRow(code) {
  const key = String(code || '')
  return contentVersions.value.find((row) => row.version === key || row.code === key || row.code === key.toLowerCase())
}

function normalizeLocales(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    const primary = item.primary_versions || []
    const all = item.all_versions || primary
    return {
      language: item.language ?? '',
      primary_versions: primary,
      all_versions: all,
    }
  }).filter((item) => item.language)
}

function defaultTranslationLanguage() {
  const lang = language.value || ''
  return lang === 'en' ? '' : lang
}

function onScopeChange() {
  load(1)
  loadRuntime()
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
        app_key: defaultCreateAppKey(),
        language: defaultTranslationLanguage(),
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
    await saveBibleTranslation({ ...form.value, app_key: defaultCreateAppKey() })
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

function applyZipVersion(version) {
  const row = findVersionRow(version)
  if (!row) return
  zipSyncing = true
  zipLanguage.value = row.default_language ?? ''
  zipTitle.value = row.title || ''
  zipSyncing = false
}

function onZipVersion(version) {
  if (zipSyncing) return
  applyZipVersion(version)
}

function onZipLanguage(language) {
  if (zipSyncing || language === ZIP_LANG_OMIT) return
  const loc = localeOptions.value.find((item) => item.language === language)
  const primary = loc?.primary_versions?.[0]
  if (!primary || primary === zipVersion.value) return
  zipSyncing = true
  zipVersion.value = primary
  const row = findVersionRow(primary)
  if (row?.title) zipTitle.value = row.title
  zipSyncing = false
}

function formatZipSize(size) {
  const mb = size / (1024 * 1024)
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.ceil(size / 1024)} KB`
}

function formatImportError(item) {
  if (item == null) return ''
  if (typeof item === 'string') return item
  return item.message || item.error || item.path || JSON.stringify(item)
}

function onZipPicked(file) {
  const raw = file?.raw
  if (!raw) return
  const name = raw.name || ''
  if (!/\.zip$/i.test(name)) {
    zipFile.value = null
    ElMessage.warning('请选择 .zip 文件')
    return
  }
  if (raw.size > ZIP_MAX_BYTES) {
    zipFile.value = null
    ElMessage.warning('zip 不能超过 200MB')
    return
  }
  zipFile.value = raw
}

async function openContentImport() {
  contentVisible.value = true
  zipResult.value = null
  zipErrors.value = []
  zipFile.value = null
  contentLoading.value = true
  try {
    const res = await fetchBibleImportContent({ app_key: defaultCreateAppKey() })
    const body = res.results && typeof res.results === 'object' ? res.results : res
    contentVersions.value = body.versions || []
    localeOptions.value = normalizeLocales(body.locales)
    if (!findVersionRow(zipVersion.value) && contentVersions.value.length) {
      zipVersion.value = versionValue(contentVersions.value[0])
    }
    if (zipVersion.value) applyZipVersion(zipVersion.value)
  } catch (e) {
    contentVersions.value = []
    localeOptions.value = []
    ElMessage.error(e.message || e.msg || '读取可用译本失败')
  } finally {
    contentLoading.value = false
  }
}

async function importZip() {
  if (contentImporting.value) return
  if (!zipVersion.value) {
    ElMessage.warning('请选择译本')
    return
  }
  if (!zipFile.value) {
    ElMessage.warning('请选择 zip')
    return
  }
  const fd = new FormData()
  fd.append('file', zipFile.value)
  fd.append('version', zipVersion.value)
  fd.append('app_key', defaultCreateAppKey())
  if (zipLanguage.value !== ZIP_LANG_OMIT) fd.append('language', zipLanguage.value)
  const title = zipTitle.value.trim()
  if (title) fd.append('title', title)
  fd.append('upload_audio', uploadAudio.value ? '1' : '0')
  contentImporting.value = true
  zipResult.value = null
  zipErrors.value = []
  try {
    const res = await importBibleZip(fd)
    const body = res.results && typeof res.results === 'object' ? res.results : {}
    zipResult.value = body
    zipErrors.value = (Array.isArray(body.errors) ? body.errors : []).slice(0, 5).map(formatImportError).filter(Boolean)
    ElMessage.success(`已导入 ${body.chapters ?? 0} 章 / ${body.verses ?? 0} 节 / ${body.audio_files ?? 0} 个音频`)
    load()
    if (browseTrId.value) loadBooks()
  } catch (e) {
    const body = e?.results && typeof e.results === 'object' ? e.results : {}
    zipErrors.value = (Array.isArray(body.errors) ? body.errors : []).slice(0, 5).map(formatImportError).filter(Boolean)
    ElMessage.error(e.message || e.msg || 'zip 导入失败')
  } finally {
    contentImporting.value = false
  }
}

async function loadBooks() {
  books.value = []
  if (!browseTrId.value) return
  booksLoading.value = true
  try {
    const res = await fetchBibleBooks({ translation_id: browseTrId.value, pageSize: 80, currentPage: 1 })
    books.value = res.results || []
  } catch (e) {
    ElMessage.error(e.message || e.msg || '书卷加载失败')
  } finally {
    booksLoading.value = false
  }
}

async function saveBook(row) {
  try {
    await saveBibleBook({ id: row.id, name: row.name })
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

async function openChapters(row) {
  chTitle.value = `${row.book_key} · ${row.name}`
  chVisible.value = true
  chLoading.value = true
  try {
    const res = await fetchBibleChapters({ book_id: row.id, pageSize: 200, currentPage: 1 })
    chapters.value = res.results || []
  } catch (e) {
    ElMessage.error(e.message || e.msg || '章节加载失败')
  } finally {
    chLoading.value = false
  }
}

function audioPathGender(url) {
  const value = String(url || '')
  if (/\/female\//i.test(value)) return 'female'
  if (/\/male\//i.test(value)) return 'male'
  return ''
}

async function saveChapter(row, gender) {
  const payload = {
    id: row.id,
    audio_duration_sec: row.audio_duration_sec,
  }
  if (gender !== 'female') payload.audio_url_male = row.audio_url_male || ''
  if (gender !== 'male') payload.audio_url_female = row.audio_url_female || ''
  try {
    await saveBibleChapter(payload)
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

async function onChapterAudio(row, file, gender) {
  const raw = file?.raw
  if (!raw) return
  const name = raw.name || ''
  if (!/\.mp3$/i.test(name) && raw.type && raw.type !== 'audio/mpeg') {
    ElMessage.warning('请上传 mp3')
    return
  }
  const voice = gender === 'female' ? '女声' : '男声'
  const field = gender === 'female' ? 'audio_url_female' : 'audio_url_male'
  const loadingKey = gender === 'female' ? '_uploadingFemale' : '_uploadingMale'
  row[loadingKey] = true
  try {
    const res = await uploadBibleChapterAudio({
      id: row.id,
      file: raw,
      gender,
    })
    const body = res.results && typeof res.results === 'object' ? res.results : {}
    const uploaded = body.uploaded_url || body[field] || ''
    if (gender === 'female') {
      row.audio_url_female = body.audio_url_female || uploaded || row.audio_url_female
    } else {
      row.audio_url_male = body.audio_url_male || uploaded || row.audio_url_male
    }
    if (body.audio_duration_sec != null) row.audio_duration_sec = body.audio_duration_sec
    const stored = body.storage === 'local' ? '本地 content/bible/audio' : '对象存储'
    ElMessage.success(`${voice}已上传并写入 ${field}（${stored}）`)
  } catch (e) {
    ElMessage.error(e.message || e.msg || '上传失败')
  } finally {
    row[loadingKey] = false
  }
}

async function openVerses(row) {
  vsTitle.value = `第 ${row.chapter_num} 章`
  vsVisible.value = true
  vsLoading.value = true
  try {
    const res = await fetchBibleVerses({ chapter_id: row.id, pageSize: 200, currentPage: 1 })
    verses.value = res.results || []
  } catch (e) {
    ElMessage.error(e.message || e.msg || '经文加载失败')
  } finally {
    vsLoading.value = false
  }
}

async function saveVerse(row) {
  try {
    await saveBibleVerse({ id: row.id, text: row.text })
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

const RUNTIME_KEYS = 'bible_audio_root,translate_enabled'

function runtimeScope() {
  return {
    app_key: defaultCreateAppKey(),
    language: language.value || '',
    platform: platform.value || '',
  }
}

async function loadRuntime() {
  runtimeLoading.value = true
  try {
    const res = await fetchConfigs({ keys: RUNTIME_KEYS, ...runtimeScope() })
    const rows = res.results || []
    const map = {}
    for (const r of rows) map[r.key] = r.value
    runtime.value = {
      bible_audio_root: map.bible_audio_root || '',
      translate_enabled: map.translate_enabled !== false,
    }
    const tr = res.meta?.translate || {}
    translateHint.value = tr.has_key
      ? '已检测到 GOOGLE_TRANSLATE_API_KEY；开关只控制是否调用，密钥不进后台。'
      : '未检测到 GOOGLE_TRANSLATE_API_KEY；经文翻译不可用（只走 Google Translate API，不调用 AI）。'
  } catch (e) {
    ElMessage.error(e.message || e.msg || '接入配置加载失败')
  } finally {
    runtimeLoading.value = false
  }
}

async function saveRuntime() {
  const scope = runtimeScope()
  try {
    await saveConfig('bible_audio_root', runtime.value.bible_audio_root || '', '听经音频根目录', scope)
    await saveConfig('translate_enabled', !!runtime.value.translate_enabled, '经文翻译开关', scope)
    ElMessage.success('接入配置已保存')
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

onMounted(() => {
  load()
  loadRuntime()
})
</script>

<style scoped>
.hint { margin: 0 0 12px; color: var(--pro-text-tertiary); font-size: 12px; line-height: 1.5; }
.field-hint { margin: 6px 0 0; color: var(--pro-text-tertiary); font-size: 12px; line-height: 1.5; }
.inline-hint { margin-left: 8px; color: var(--pro-text-tertiary); font-size: 12px; }
.import-form { margin-top: 16px; }
.import-result {
  margin: 0 0 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--pro-fill, #f6f7f9);
  font-size: 12px;
  line-height: 1.45;
}
.import-result p { margin: 0; }
.import-errors {
  margin: 0;
  padding-left: 18px;
  color: var(--el-color-danger);
  font-size: 12px;
  line-height: 1.5;
}
.zip-file { display: flex; align-items: center; gap: 8px; }
.audio-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.audio-cell .el-input { flex: 1; min-width: 0; }
.chapter-upload { display: inline-flex; flex-shrink: 0; }
.runtime-hint { margin: 0; padding: 0 24px 12px; color: var(--pro-text-tertiary); font-size: 12px; line-height: 1.5; }
.browse-block { padding: 8px 24px 24px; }
.runtime-row {
  padding: 12px 24px 4px;
  margin: 0;
  border-bottom: 1px solid var(--pro-border);
}
.runtime-grid {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px 20px;
}
.runtime-row :deep(.el-form-item) {
  margin-bottom: 8px;
  margin-right: 0;
}
.chapter-table :deep(.sec-col .cell) {
  overflow: hidden;
}
.chapter-table :deep(.sec-input) {
  width: 100%;
  max-width: 100%;
  --el-input-number-width: 100%;
}
.chapter-table :deep(.sec-input .el-input) {
  width: 100%;
}
</style>
