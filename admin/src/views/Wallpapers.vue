<!--
  壁纸管理：App × 语言 × 设备三维；静态 / 动态（video）壁纸与 VIP 锁定。
-->
<template>
  <div class="container">
    <ScopeFilter
      mode="browse"
      v-model:app-key="appKey"
      v-model:language="language"
      v-model:platform="platform"
      @change="load(1)"
    />
    <div class="pro-toolbar">
      <div class="pro-toolbar-title">壁纸列表</div>
      <div class="pro-toolbar-actions">
        <el-select
          v-model="mediaTypeFilter"
          clearable
          placeholder="媒体类型"
          style="width: 140px; margin-right: 8px"
          @change="load(1)"
        >
          <el-option label="全部" value="" />
          <el-option
            v-for="m in MEDIA_TYPE_OPTIONS"
            :key="m.value"
            :label="m.label"
            :value="m.value"
          />
        </el-select>
        <el-button type="primary" :icon="CirclePlusFilled" @click="open()">新建</el-button>
      </div>
    </div>
    <el-table :data="rows">
      <el-table-column prop="id" label="ID" width="70" />
      <el-table-column label="预览" width="100">
        <template #default="{ row }">
          <el-image
            class="table-td-thumb"
            :src="thumbUrl(row)"
            :preview-src-list="[thumbUrl(row)].filter(Boolean)"
            preview-teleported
            fit="cover"
          />
        </template>
      </el-table-column>
      <el-table-column label="类型" width="80">
        <template #default="{ row }">
          {{ labelZh(MEDIA_TYPE_ZH, row.media_type || 'static') }}
        </template>
      </el-table-column>
      <el-table-column prop="image_url" label="URL" />
      <el-table-column prop="app_key" label="App" width="90">
        <template #default="{ row }">{{ row.app_key || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="language" label="语言" width="80">
        <template #default="{ row }">{{ row.language || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="platform" label="设备" width="90">
        <template #default="{ row }">{{ row.platform || '全部' }}</template>
      </el-table-column>
      <el-table-column prop="is_vip" label="VIP" width="80">
        <template #default="{ row }">
          <el-tag :type="row.is_vip ? 'warning' : 'info'" size="small">{{ row.is_vip ? '是' : '否' }}</el-tag>
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

    <el-dialog v-model="visible" title="壁纸" width="560px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="媒体类型">
          <el-select v-model="form.media_type" style="width: 100%">
            <el-option
              v-for="m in MEDIA_TYPE_OPTIONS"
              :key="m.value"
              :label="m.label"
              :value="m.value"
            />
          </el-select>
        </el-form-item>

        <template v-if="form.media_type === 'video'">
          <el-form-item label="视频URL" required>
            <el-input v-model="form.video_url" placeholder="粘贴视频 URL（COS 或 CDN）" />
          </el-form-item>
          <el-form-item label="封面海报" required>
            <el-upload
              :show-file-list="false"
              :auto-upload="false"
              accept="image/*"
              :on-change="onUploadPoster"
            >
              <el-button :loading="uploading">上传海报图</el-button>
            </el-upload>
            <el-input
              v-model="form.poster_url"
              placeholder="上传后自动填入；亦可手填"
              style="margin-top: 8px"
            />
            <div v-if="form.poster_url" class="preview">
              <el-image :src="form.poster_url" fit="cover" style="width: 72px; height: 108px; border-radius: 4px" />
            </div>
          </el-form-item>
          <el-form-item label="时长(秒)">
            <el-input-number v-model="form.duration_sec" :min="1" :max="15" />
            <span class="hint">最长 15 秒</span>
          </el-form-item>
          <el-form-item label="图片URL">
            <el-input v-model="form.image_url" placeholder="可选；空则回落海报 URL" />
          </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="上传">
            <el-upload
              :show-file-list="false"
              :auto-upload="false"
              accept="image/*"
              :on-change="onUpload"
            >
              <el-button :loading="uploading">选择图片上传 COS</el-button>
            </el-upload>
            <div v-if="form.image_url" class="preview">
              <el-image :src="form.image_url" fit="cover" style="width: 72px; height: 108px; border-radius: 4px" />
            </div>
          </el-form-item>
          <el-form-item label="图片URL" required>
            <el-input v-model="form.image_url" placeholder="上传后自动填入" />
          </el-form-item>
        </template>

        <el-form-item label="App">
          <el-select v-model="form.app_key" filterable style="width: 100%">
            <el-option label="全局（两 App 可见）" value="" />
            <el-option v-for="a in APP_KEYS" :key="a" :label="a" :value="a" />
          </el-select>
        </el-form-item>
        <el-form-item label="语言">
          <el-select v-model="form.language" filterable style="width: 100%">
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
        <el-form-item label="标签">
          <el-select
            v-model="tags"
            multiple
            filterable
            clearable
            style="width: 100%"
            placeholder="选择标签（主题分类 / 兴趣）"
          >
            <el-option
              v-for="t in tagOptions"
              :key="t.value"
              :label="t.label"
              :value="t.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="权重"><el-input-number v-model="form.sort_weight" /></el-form-item>
        <el-form-item label="VIP"><el-switch v-model="form.is_vip" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { CirclePlusFilled } from '@element-plus/icons-vue'
import { fetchWallpapers, saveWallpaper, deleteWallpaper, uploadFile } from '../api'
import ScopeFilter from '../components/ScopeFilter.vue'
import { loadWithCache, clearPageCache } from '../utils/pageCache'
import { browseScopeParams, defaultCreateAppKey } from '../utils/scopeParams'
import {
  APP_KEYS,
  LANG_OPTIONS,
  WALLPAPER_TAG_OPTIONS,
  WALLPAPER_TAG_ZH,
  MEDIA_TYPE_ZH,
  MEDIA_TYPE_OPTIONS,
  labelZh,
} from '../utils/enumZh'

const appKey = ref('')
const language = ref('')
const platform = ref('')
const mediaTypeFilter = ref('')
const rows = ref([])
const page = ref(1)
const total = ref(0)
const visible = ref(false)
const form = ref({})
const tags = ref([])
const uploading = ref(false)

/** 标准选项 + 历史自定义标签（只读展示，不可新建） */
const tagOptions = computed(() => {
  const base = [...WALLPAPER_TAG_OPTIONS]
  const known = new Set(base.map((t) => t.value))
  for (const t of tags.value) {
    if (t && !known.has(t)) {
      base.push({ value: t, label: `${labelZh(WALLPAPER_TAG_ZH, t)}（${t}）` })
      known.add(t)
    }
  }
  return base
})

function thumbUrl(row) {
  if ((row.media_type || 'static') === 'video') {
    return row.poster_url || row.image_url || ''
  }
  return row.image_url || ''
}

function cacheKey() {
  return `wallpapers_p${page.value}_${appKey.value || ''}_${language.value || ''}_${platform.value || ''}_${mediaTypeFilter.value || ''}`
}

async function load(p = page.value) {
  page.value = p
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
    if (mediaTypeFilter.value) params.media_type = mediaTypeFilter.value
    const res = await fetchWallpapers(params)
    let list = res.results || []
    // 后端若未按 media_type 过滤，前端兜底
    if (mediaTypeFilter.value) {
      list = list.filter((r) => (r.media_type || 'static') === mediaTypeFilter.value)
    }
    return {
      rows: list,
      total: res.pagination?.total || list.length,
    }
  }, (data) => {
    rows.value = data.rows || []
    total.value = data.total || 0
  })
}

function open(row) {
  form.value = row
    ? {
        ...row,
        media_type: row.media_type || 'static',
        video_url: row.video_url || '',
        poster_url: row.poster_url || '',
        duration_sec: row.duration_sec ?? null,
        app_key: row.app_key || '',
        language: row.language || '',
        platform: row.platform || '',
      }
    : {
        image_url: '',
        media_type: 'static',
        video_url: '',
        poster_url: '',
        duration_sec: null,
        sort_weight: 0,
        is_vip: false,
        tags: [],
        app_key: defaultCreateAppKey(appKey.value),
        language: language.value || '',
        platform: platform.value || '',
      }
  tags.value = [...(form.value.tags || [])]
  visible.value = true
}

async function onUpload(file) {
  const raw = file?.raw
  if (!raw) return
  uploading.value = true
  try {
    const res = await uploadFile(raw, 'selah/wallpapers')
    const url = res.results?.url || res.data?.url
    if (!url) throw new Error('未返回 URL')
    form.value.image_url = url
    ElMessage.success('已上传，URL 已填入')
  } catch (e) {
    ElMessage.error(e.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

async function onUploadPoster(file) {
  const raw = file?.raw
  if (!raw) return
  uploading.value = true
  try {
    const res = await uploadFile(raw, 'selah/wallpapers')
    const url = res.results?.url || res.data?.url
    if (!url) throw new Error('未返回 URL')
    form.value.poster_url = url
    if (!form.value.image_url) form.value.image_url = url
    ElMessage.success('已上传，海报 URL 已填入')
  } catch (e) {
    ElMessage.error(e.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

async function save() {
  const mt = form.value.media_type || 'static'
  if (mt === 'video') {
    if (!(form.value.video_url || '').trim()) {
      ElMessage.warning('请填写视频 URL')
      return
    }
    if (!(form.value.poster_url || form.value.image_url || '').trim()) {
      ElMessage.warning('请上传或填写海报 URL')
      return
    }
    const dur = form.value.duration_sec
    if (dur != null && Number(dur) > 15) {
      ElMessage.warning('视频时长不能超过 15 秒')
      return
    }
  } else if (!form.value.image_url) {
    ElMessage.warning('请先上传图片或填写 URL')
    return
  }
  try {
    await saveWallpaper({
      ...form.value,
      media_type: mt,
      tags: tags.value,
    })
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
    await deleteWallpaper(id)
    ElMessage.success('已删除')
    clearPageCache(cacheKey())
    load()
  } catch (e) {
    ElMessage.error(e.message || e.msg || '删除失败')
  }
}

onMounted(load)
</script>

<style scoped>
.table-td-thumb {
  width: 48px;
  height: 72px;
  border-radius: 4px;
}
.preview {
  margin-top: 8px;
}
.hint {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}
</style>
