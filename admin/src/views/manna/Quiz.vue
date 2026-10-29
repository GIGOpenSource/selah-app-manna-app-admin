<!--
  Manna 测验：关卡 + 题目两级 CRUD。
-->
<template>
  <div class="container">
    <ScopeFilter mode="browse" v-model:app-key="appKey" v-model:language="language" v-model:platform="platform" @change="onScopeChange" />
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">测验关卡</div>
      <div class="pro-toolbar-actions">
        <el-button type="primary" :icon="CirclePlusFilled" @click="openLevel()">新建关卡</el-button>
      </div>
    </div>
    <el-table :data="levelRows" v-loading="loading" row-key="id">
      <el-table-column prop="level_no" label="关卡" width="80" />
      <el-table-column prop="title" label="标题" min-width="160" />
      <el-table-column prop="time_limit_sec" label="时限(s)" width="90" />
      <el-table-column prop="reward_manna" label="奖励/题" width="80" />
      <el-table-column prop="fail_penalty" label="失败扣" width="80" />
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
          <el-button link type="primary" @click.stop="openLevel(row)">编辑</el-button>
          <el-button link type="primary" @click.stop="openQuestions(row)">题目</el-button>
          <el-button link type="danger" @click.stop="onDeleteLevel(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination
      class="pagination"
      background
      layout="total, prev, pager, next"
      :total="levelTotal"
      v-model:current-page="levelPage"
      @current-change="loadLevels"
    />

    <el-dialog
      v-model="questionsVisible"
      :title="activeLevel ? `题目 · L${activeLevel.level_no} ${activeLevel.title || ''}` : '题目'"
      width="860px"
      destroy-on-close
    >
      <div class="pro-toolbar" style="margin-top: 0">
        <div class="pro-toolbar-title">共 {{ qRows.length }} 题</div>
        <div class="pro-toolbar-actions">
          <el-button type="primary" @click="onNewQuestion">新建题目</el-button>
        </div>
      </div>
      <el-table :data="qRows" v-loading="qLoading" row-key="id">
        <el-table-column prop="stem" label="题干" min-width="180" />
        <el-table-column label="经文" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ formatBibleRef(row.bible_ref) }}</template>
        </el-table-column>
        <el-table-column prop="qtype" label="类型" width="90" />
        <el-table-column prop="answer_key" label="答案" width="90" />
        <el-table-column prop="sort_order" label="排序" min-width="80" width="80" />
        <el-table-column prop="enabled" label="启用" min-width="90" width="90">
          <template #default="{ row }">
            <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '是' : '否' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button link type="primary" @click="openQuestion(row)">编辑</el-button>
            <el-button link type="danger" @click="onDeleteQuestion(row.id)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>暂无题目，点击「新建题目」添加</template>
      </el-table>
    </el-dialog>

    <el-dialog v-model="levelVisible" :title="levelForm.id ? '编辑关卡' : '新建关卡'" width="560px" destroy-on-close>
      <el-form label-width="110px">
        <el-form-item label="关卡号"><el-input-number v-model="levelForm.level_no" :min="1" /></el-form-item>
        <el-form-item label="标题"><el-input v-model="levelForm.title" /></el-form-item>
        <el-form-item label="时限(s)"><el-input-number v-model="levelForm.time_limit_sec" :min="0" /></el-form-item>
        <el-form-item label="奖励/题"><el-input-number v-model="levelForm.reward_manna" /></el-form-item>
        <el-form-item label="失败扣减"><el-input-number v-model="levelForm.fail_penalty" /></el-form-item>
        <el-form-item label="语言">
          <el-select v-model="levelForm.language" style="width: 100%">
            <el-option label="全部" value="" />
            <el-option v-for="l in LANG_OPTIONS" :key="l.value" :label="l.label" :value="l.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="设备">
          <el-select v-model="levelForm.platform" style="width: 100%">
            <el-option label="全部" value="" />
            <el-option label="iOS" value="ios" />
            <el-option label="Android" value="android" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="levelForm.sort_order" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="levelForm.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="saveLevel">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="qVisible" :title="qForm.id ? '编辑题目' : '新建题目'" width="720px" append-to-body destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="题干"><el-input v-model="qForm.stem" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="类型">
          <el-select v-model="qForm.qtype" style="width: 160px" @change="onQtypeChange">
            <el-option label="单选" value="single" />
            <el-option label="判断" value="tf" />
          </el-select>
        </el-form-item>
        <el-form-item label="选项" required>
          <div class="opt-list">
            <div v-for="(opt, i) in qForm.options" :key="i" class="opt-row">
              <el-radio v-model="qForm.answer_key" :value="opt.key" class="opt-radio">&nbsp;</el-radio>
              <el-input
                class="opt-key"
                :model-value="opt.key"
                maxlength="8"
                placeholder="A"
                @update:model-value="(v) => renameOption(opt, v)"
              />
              <el-input v-model="opt.text" placeholder="选项文案" />
              <el-button
                class="opt-del"
                circle
                plain
                type="danger"
                :icon="Delete"
                :disabled="qForm.qtype === 'tf' || (qForm.options || []).length <= 2"
                @click="removeOption(i)"
              />
            </div>
            <el-button
              v-if="qForm.qtype !== 'tf'"
              size="small"
              :icon="CirclePlusFilled"
              @click="addOption"
            >添加选项</el-button>
            <p class="opt-hint">左侧圆点选正确答案，字母可自定义（如 A / a / 1）。</p>
          </div>
        </el-form-item>
        <el-form-item label="解析" required>
          <div class="bible-ref">
            <el-select
              v-model="bibleTranslation"
              placeholder="译本"
              style="width: 128px"
              @change="onTranslationChange"
            >
              <el-option
                v-for="t in bibleTranslations"
                :key="t.code"
                :label="t.title || t.code"
                :value="t.code"
              />
            </el-select>
            <el-select
              v-model="biblePick.book"
              filterable
              placeholder="书卷"
              style="width: 168px"
              :loading="bibleBooksLoading"
              @change="onBookChange"
            >
              <el-option
                v-for="b in bibleBooks"
                :key="b.book_key"
                :label="b.name || b.book_key"
                :value="b.book_key"
              />
            </el-select>
            <el-select
              v-model="biblePick.chapter"
              placeholder="章"
              style="width: 96px"
              :disabled="!biblePick.book"
              @change="onChapterChange"
            >
              <el-option v-for="n in chapterOptions" :key="n" :label="`${n}`" :value="n" />
            </el-select>
            <el-select
              v-model="biblePick.verse_start"
              placeholder="起始节"
              clearable
              filterable
              style="width: 108px"
              :disabled="!biblePick.chapter"
              :loading="bibleVersesLoading"
              @change="onVerseStartChange"
            >
              <el-option v-for="v in verseOptions" :key="`s-${v}`" :label="`${v}`" :value="v" />
            </el-select>
            <el-select
              v-model="biblePick.verse_end"
              placeholder="结束节"
              clearable
              filterable
              style="width: 108px"
              :disabled="!biblePick.chapter"
              @change="onVerseEndChange"
            >
              <el-option
                v-for="v in verseOptions"
                :key="`e-${v}`"
                :label="`${v}`"
                :value="v"
                :disabled="!!biblePick.verse_start && v < biblePick.verse_start"
              />
            </el-select>
          </div>
          <p class="opt-hint">In Bible 打开对应书卷章节；书卷、章必选，节可选。译本只用于选经，不会写入题目。</p>
        </el-form-item>
        <el-form-item label="排序"><el-input-number v-model="qForm.sort_order" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="qForm.enabled" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="saveQuestion">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { CirclePlusFilled, Delete } from '@element-plus/icons-vue'
import {
  fetchMannaQuizLevels, saveMannaQuizLevel,
  fetchMannaQuizQuestions, saveMannaQuizQuestion,
  fetchAppBibleTranslations, fetchAppBibleBooks, fetchAppBibleChapter,
} from '../../api'
import ScopeFilter from '../../components/ScopeFilter.vue'
import { browseScopeParams, defaultCreateAppKey } from '../../utils/scopeParams'
import { LANG_OPTIONS } from '../../utils/enumZh'

const DEFAULT_BIBLE_TRANSLATION = 'web'
const appKey = ref('manna')
const language = ref('')
const platform = ref('')
const levelRows = ref([])
const levelPage = ref(1)
const levelTotal = ref(0)
const loading = ref(false)
const activeLevel = ref(null)
const qRows = ref([])
const qLoading = ref(false)
const levelVisible = ref(false)
const questionsVisible = ref(false)
const levelForm = ref({})
const qVisible = ref(false)
const qForm = ref({})
const OPTION_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

const bibleTranslation = ref(DEFAULT_BIBLE_TRANSLATION)
const bibleTranslations = ref([{ code: DEFAULT_BIBLE_TRANSLATION, title: 'WEB' }])
const bibleBooks = ref([])
const bibleBooksLoading = ref(false)
const bibleVerses = ref([])
const bibleVersesLoading = ref(false)
const biblePick = ref(emptyBiblePick())
let translationsLoaded = false

function emptyBiblePick() {
  return { book: '', chapter: null, verse_start: null, verse_end: null }
}

function asList(res) {
  const r = res?.results
  if (Array.isArray(r)) return r
  if (Array.isArray(r?.books)) return r.books
  if (Array.isArray(res)) return res
  return []
}

function asTranslations(res) {
  const r = res?.results
  const list = Array.isArray(r) ? r : (Array.isArray(r?.translations) ? r.translations : [])
  return list
    .map((t) => ({
      code: String(t.code || t.key || t.value || '').trim(),
      title: t.title || t.name || t.code || t.key || '',
    }))
    .filter((t) => t.code)
}

function parseBibleRef(raw) {
  let r = raw
  if (typeof r === 'string') {
    try { r = JSON.parse(r) } catch { r = {} }
  }
  if (!r || typeof r !== 'object') r = {}
  const book = String(r.book || r.book_key || '').trim()
  const chapter = Number(r.chapter) || null
  const verseStart = Number(r.verse_start || r.verse) || null
  const verseEnd = Number(r.verse_end) || null
  return {
    book,
    chapter,
    verse_start: verseStart,
    verse_end: verseEnd,
  }
}

function formatBibleRef(raw) {
  const r = parseBibleRef(raw)
  if (!r.book || !r.chapter) return '—'
  let s = `${r.book} ${r.chapter}`
  if (r.verse_start) {
    s += `:${r.verse_start}`
    if (r.verse_end && r.verse_end !== r.verse_start) s += `-${r.verse_end}`
  }
  return s
}

function buildBibleRef() {
  const book = String(biblePick.value.book || '').trim()
  const chapter = Number(biblePick.value.chapter)
  if (!book || !chapter) return null
  const ref = { book, chapter }
  const vs = Number(biblePick.value.verse_start)
  const ve = Number(biblePick.value.verse_end)
  if (vs > 0) ref.verse_start = vs
  if (vs > 0 && ve > 0) ref.verse_end = ve
  return ref
}

const chapterOptions = computed(() => {
  const b = bibleBooks.value.find((x) => x.book_key === biblePick.value.book)
  const n = Math.max(0, Number(b?.chapter_count) || 0)
  return Array.from({ length: n }, (_, i) => i + 1)
})

const verseOptions = computed(() => {
  const nums = (bibleVerses.value || [])
    .map((v, i) => Number(v?.verse) || i + 1)
    .filter((n) => n > 0)
  return [...new Set(nums)]
})

async function ensureTranslations() {
  if (translationsLoaded) return
  translationsLoaded = true
  try {
    const list = asTranslations(await fetchAppBibleTranslations())
    if (list.length) bibleTranslations.value = list
  } catch {
    /* 译本列表失败时保留 WEB */
  }
  if (!bibleTranslations.value.some((t) => t.code === bibleTranslation.value)) {
    bibleTranslation.value = bibleTranslations.value[0]?.code || DEFAULT_BIBLE_TRANSLATION
  }
}

async function loadBibleBooks() {
  bibleBooksLoading.value = true
  try {
    bibleBooks.value = asList(await fetchAppBibleBooks({
      translation: bibleTranslation.value || DEFAULT_BIBLE_TRANSLATION,
    }))
  } catch (e) {
    bibleBooks.value = []
    ElMessage.error(e.message || e.msg || '书卷目录加载失败')
  } finally {
    bibleBooksLoading.value = false
  }
}

async function loadBibleVerses() {
  const book = String(biblePick.value.book || '').trim()
  const chapter = Number(biblePick.value.chapter)
  if (!book || !chapter) {
    bibleVerses.value = []
    return
  }
  bibleVersesLoading.value = true
  try {
    const res = await fetchAppBibleChapter({
      translation: bibleTranslation.value || DEFAULT_BIBLE_TRANSLATION,
      book,
      chapter,
    })
    const d = res?.results || {}
    bibleVerses.value = Array.isArray(d.verses) ? d.verses : []
  } catch (e) {
    bibleVerses.value = []
    ElMessage.error(e.message || e.msg || '章节加载失败')
  } finally {
    bibleVersesLoading.value = false
  }
}

async function onTranslationChange() {
  await loadBibleBooks()
  if (biblePick.value.book && !bibleBooks.value.some((b) => b.book_key === biblePick.value.book)) {
    biblePick.value = emptyBiblePick()
    bibleVerses.value = []
    return
  }
  if (biblePick.value.book && biblePick.value.chapter) {
    await loadBibleVerses()
  }
}

function onBookChange() {
  biblePick.value.chapter = null
  biblePick.value.verse_start = null
  biblePick.value.verse_end = null
  bibleVerses.value = []
}

async function onChapterChange() {
  biblePick.value.verse_start = null
  biblePick.value.verse_end = null
  await loadBibleVerses()
}

function onVerseStartChange(v) {
  const start = Number(v) || null
  biblePick.value.verse_start = start
  if (start && biblePick.value.verse_end && biblePick.value.verse_end < start) {
    biblePick.value.verse_end = start
  }
}

function onVerseEndChange(v) {
  const end = Number(v) || null
  biblePick.value.verse_end = end
  if (end && biblePick.value.verse_start && end < biblePick.value.verse_start) {
    biblePick.value.verse_end = biblePick.value.verse_start
  }
}

function onScopeChange() {
  activeLevel.value = null
  qRows.value = []
  questionsVisible.value = false
  loadLevels(1)
}

async function loadLevels(p = levelPage.value) {
  levelPage.value = p
  loading.value = true
  try {
    const res = await fetchMannaQuizLevels({
      ...browseScopeParams({
        appKey: appKey.value,
        language: language.value,
        platform: platform.value,
      }),
      currentPage: levelPage.value,
      pageSize: 20,
    })
    levelRows.value = res.results || []
    levelTotal.value = res.pagination?.total || 0
  } catch (e) {
    ElMessage.error(e.message || e.msg || '加载失败')
  } finally {
    loading.value = false
  }
}

async function selectAndLoadQuestions(row) {
  if (!row?.id) {
    ElMessage.warning('该关卡缺少 ID，无法加载题目')
    return
  }
  activeLevel.value = row
  qLoading.value = true
  try {
    const res = await fetchMannaQuizQuestions({ level_id: row.id, currentPage: 1, pageSize: 100 })
    qRows.value = res.results || []
  } catch (e) {
    qRows.value = []
    ElMessage.error(e.message || e.msg || '题目加载失败')
  } finally {
    qLoading.value = false
  }
}

async function openQuestions(row) {
  questionsVisible.value = true
  await selectAndLoadQuestions(row)
}

function openLevel(row) {
  levelForm.value = row
    ? { ...row }
    : {
        level_no: 1,
        title: '',
        time_limit_sec: 120,
        pass_score: 1,
        reward_manna: 30,
        fail_penalty: 10,
        sort_order: 0,
        enabled: true,
        app_key: defaultCreateAppKey(),
        language: language.value || '',
        platform: platform.value || '',
      }
  levelVisible.value = true
}

async function saveLevel() {
  if (!(levelForm.value.title || '').trim()) {
    ElMessage.warning('请填写标题')
    return
  }
  try {
    levelForm.value.app_key = defaultCreateAppKey()
    await saveMannaQuizLevel(levelForm.value)
    ElMessage.success('已保存')
    levelVisible.value = false
    loadLevels()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

async function onDeleteLevel(id) {
  try {
    await ElMessageBox.confirm('确认删除该关卡？', '提示', { type: 'warning' })
    await saveMannaQuizLevel({ delete_id: id })
    ElMessage.success('已删除')
    if (activeLevel.value?.id === id) {
      activeLevel.value = null
      qRows.value = []
      questionsVisible.value = false
    }
    loadLevels()
  } catch (e) {
    if (e === 'cancel' || e?.action === 'cancel') return
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}

function nextOptionKey(list) {
  const used = new Set((list || []).map((o) => String(o.key || '').toUpperCase()))
  return [...OPTION_KEYS].find((k) => !used.has(k)) || String((list || []).length + 1)
}

function normalizeOptions(raw) {
  let list = raw
  if (typeof list === 'string') {
    try { list = JSON.parse(list) } catch { list = [] }
  }
  if (!Array.isArray(list)) list = []
  const mapped = list.map((o, i) => ({
    key: String(o?.key || OPTION_KEYS[i] || i + 1).trim(),
    text: String(o?.text ?? o?.label ?? '').trim(),
  })).filter((o) => o.key)
  if (mapped.length >= 2) return mapped
  return [
    { key: 'A', text: mapped[0]?.text || '' },
    { key: 'B', text: mapped[1]?.text || '' },
  ]
}

function addOption() {
  const list = qForm.value.options || []
  list.push({ key: nextOptionKey(list), text: '' })
  qForm.value.options = list
}

function renameOption(opt, val) {
  const next = String(val ?? '')
  if (qForm.value.answer_key === opt.key) qForm.value.answer_key = next
  opt.key = next
}

function removeOption(i) {
  const list = [...(qForm.value.options || [])]
  if (list.length <= 2) return
  const removed = list.splice(i, 1)[0]
  qForm.value.options = list
  if (qForm.value.answer_key === removed?.key) {
    qForm.value.answer_key = list[0]?.key || ''
  }
}

function onQtypeChange(v) {
  if (v === 'tf') {
    const cur = qForm.value.options || []
    qForm.value.options = [
      { key: 'T', text: cur[0]?.text || 'True' },
      { key: 'F', text: cur[1]?.text || 'False' },
    ]
    if (!['T', 'F'].includes(qForm.value.answer_key)) qForm.value.answer_key = 'T'
    return
  }
  if ((qForm.value.options || []).length < 2) {
    qForm.value.options = normalizeOptions(qForm.value.options)
  }
}

async function openQuestion(row) {
  if (!activeLevel.value) {
    ElMessage.warning('请先点操作列「题目」打开关卡')
    return
  }
  qForm.value = row
    ? { ...row, options: normalizeOptions(row.options) }
    : {
        level_id: activeLevel.value.id,
        qtype: 'single',
        stem: '',
        options: [
          { key: 'A', text: '' },
          { key: 'B', text: '' },
        ],
        answer_key: 'A',
        bible_ref: {},
        sort_order: 0,
        enabled: true,
      }
  if (!qForm.value.answer_key) {
    qForm.value.answer_key = qForm.value.options[0]?.key || 'A'
  }
  biblePick.value = row?.bible_ref ? parseBibleRef(row.bible_ref) : emptyBiblePick()
  bibleVerses.value = []
  qVisible.value = true
  await ensureTranslations()
  await loadBibleBooks()
  if (biblePick.value.book && biblePick.value.chapter) {
    await loadBibleVerses()
  }
}

function onNewQuestion() {
  openQuestion()
}

async function saveQuestion() {
  if (!(qForm.value.stem || '').trim()) {
    ElMessage.warning('请填写题干')
    return
  }
  const options = (qForm.value.options || [])
    .map((o) => ({ key: String(o.key || '').trim(), text: String(o.text || '').trim() }))
    .filter((o) => o.key && o.text)
  if (options.length < 2) {
    ElMessage.warning('至少填写 2 个选项')
    return
  }
  if (!options.some((o) => o.key === qForm.value.answer_key)) {
    ElMessage.warning('请点选正确答案')
    return
  }
  const bible_ref = buildBibleRef()
  if (!bible_ref) {
    ElMessage.warning('请选择书卷和章')
    return
  }
  qForm.value.options = options
  const payload = { ...qForm.value, options, bible_ref }
  delete payload.explanation
  try {
    await saveMannaQuizQuestion(payload)
    ElMessage.success('已保存')
    qVisible.value = false
    selectAndLoadQuestions(activeLevel.value)
  } catch (e) {
    ElMessage.error(e.message || e.msg || '保存失败')
  }
}

async function onDeleteQuestion(id) {
  try {
    await ElMessageBox.confirm('确认删除该题目？', '提示', { type: 'warning' })
    await saveMannaQuizQuestion({ delete_id: id })
    ElMessage.success('已删除')
    selectAndLoadQuestions(activeLevel.value)
  } catch (e) {
    if (e === 'cancel' || e?.action === 'cancel') return
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}

onMounted(loadLevels)
</script>

<style scoped>
.opt-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.opt-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.opt-radio {
  margin-right: 0;
  flex: none;
}
.opt-radio :deep(.el-radio__label) {
  display: none;
}
.opt-key {
  width: 72px;
  flex: none;
}
.opt-row .el-input:not(.opt-key) {
  flex: 1;
}
.opt-del {
  flex: none;
}
.opt-hint {
  margin: 0;
  color: #909399;
  font-size: 12px;
  line-height: 1.4;
}
.bible-ref {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}
</style>
