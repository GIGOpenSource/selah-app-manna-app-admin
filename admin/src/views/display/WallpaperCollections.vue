<template>
  <div>
    <div v-loading="moving" class="cms-hierarchy" element-loading-text="正在调整顺序">
      <section v-for="(group, index) in groups" :key="group.id" class="cms-column-card" :class="{ disabled: group.status !== 'published' }">
        <div class="cms-column-head">
          <div class="cms-column-title">
            <span class="cms-column-order">{{ index + 1 }}</span>
            <el-image
              v-if="group.cover_url"
              class="cms-thumb"
              :src="group.cover_url"
              :preview-src-list="[group.cover_url]"
              preview-teleported
              fit="cover"
            />
            <div>
              <div class="cms-name-line">
                <strong>{{ displayName(group) }}</strong>
                <el-tag v-for="chip in missChips(group)" :key="chip" type="danger" size="small" effect="light">{{ chip }}</el-tag>
              </div>
              <span>{{ group.count || 0 }} 张命中 / {{ group.enabled_count || 0 }} 张前台有效 · {{ group.status === 'published' ? '已展示' : '未展示' }}</span>
            </div>
          </div>
          <div class="cms-structure-actions">
            <el-button size="small" :disabled="moving || index === 0" @click="$emit('move', group.id, -1)">上移</el-button>
            <el-button size="small" :disabled="moving || index === groups.length - 1" @click="$emit('move', group.id, 1)">下移</el-button>
            <el-button link type="primary" @click="openGroup(group)">编辑合集</el-button>
            <el-button @click="$emit('enter', group)">进入合集</el-button>
          </div>
        </div>
        <div class="cms-collection-row">
          <div class="cms-collection-source">
            <b>{{ group.mode === 'manual' ? '直接选择具体壁纸' : '映射隐性标签' }}</b>
            <div>{{ conditionText(group, types) }}</div>
          </div>
        </div>
      </section>
      <div v-if="!groups.length" class="cms-empty">还没有壁纸合集标题，点击右上角新建。</div>
    </div>

    <el-dialog v-model="visible" :title="form.id ? '编辑壁纸合集标题' : '新建壁纸合集标题'" width="640px" destroy-on-close>
      <el-form label-width="180px">
        <LocaleCopyFields
          variant="form"
          en-label="展示名称（英语）"
          es-label="展示名称（西语）"
          pt-label="展示名称（葡语）"
          :en="form.name_en"
          :es="form.name_es"
          :pt="form.name_pt"
          @update:en="form.name_en = $event"
          @update:es="form.name_es = $event"
          @update:pt="form.name_pt = $event"
        />
        <el-form-item required label="合集封面">
          <div class="cover-field" v-loading="uploading">
            <el-upload
              class="cover-uploader"
              :show-file-list="false"
              :auto-upload="false"
              accept="image/jpeg,image/png,image/gif,image/webp,image/avif,image/bmp"
              :on-change="onUploadCover"
            >
              <div v-if="form.cover_url" class="cover-tile">
                <el-image :src="form.cover_url" fit="cover" />
                <span class="cover-tile-mask">更换封面</span>
              </div>
              <div v-else class="cover-tile cover-tile-empty">
                <span class="cover-plus">+</span>
                <span>上传封面</span>
              </div>
            </el-upload>
            <div class="cover-side">
              <p class="cover-tip">必填，用于 App 壁纸合集卡片</p>
              <p class="cover-tip cover-tip-ratio">请上传 3:4 比例的图片</p>
              <el-button v-if="form.cover_url" link type="danger" @click="form.cover_url = ''">移除</el-button>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="前端展示">
          <el-switch v-model="form.visible" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { uploadFile } from '../../api'
import { conditionText, missingEnglish } from '../../utils/tagLibrary'
import LocaleCopyFields from '../../components/LocaleCopyFields.vue'

const props = defineProps({
  lang: { type: String, default: 'en' },
  groups: { type: Array, default: () => [] },
  types: { type: Array, default: () => [] },
  moving: { type: Boolean, default: false },
})
const emit = defineEmits(['move', 'enter', 'save-group'])

function displayName(row) {
  const english = String(row?.name_en || '').trim()
  if (props.lang === 'es') return String(row?.name_es || '').trim() || english
  if (props.lang === 'pt') return String(row?.name_pt || '').trim() || english
  return english
}
function missChips(row) {
  const chips = []
  if (!String(row?.name_es || '').trim()) chips.push('西缺')
  if (!String(row?.name_pt || '').trim()) chips.push('葡缺')
  return chips
}

const visible = ref(false)
const uploading = ref(false)
const form = ref({ id: null, name_en: '', name_es: '', name_pt: '', visible: true, cover_url: '' })

function openGroup(row = null) {
  form.value = row
    ? {
      id: row.id,
      name_en: row.name_en,
      name_es: row.name_es || '',
      name_pt: row.name_pt || '',
      visible: row.status === 'published',
      cover_url: row.cover_url || '',
    }
    : { id: null, name_en: '', name_es: '', name_pt: '', visible: true, cover_url: '' }
  visible.value = true
}

async function onUploadCover(file) {
  const raw = file?.raw
  if (!raw) return
  if (!String(raw.type || '').startsWith('image/')) {
    ElMessage.warning('封面只支持图片')
    return
  }
  uploading.value = true
  try {
    const res = await uploadFile(raw, 'selah/wallpaper-collections')
    const url = res.results?.url || res.data?.url || (typeof res.results === 'string' ? res.results : '')
    if (!url) throw new Error('未返回 URL')
    form.value.cover_url = url
    ElMessage.success('封面已上传')
  } catch (e) {
    ElMessage.error(e.message || '上传失败')
  } finally {
    uploading.value = false
  }
}

function save() {
  if (uploading.value) return
  if (missingEnglish(form.value.name_en).length) {
    ElMessage.warning('请填写 English 名称')
    return
  }
  if (!String(form.value.cover_url || '').trim()) {
    ElMessage.warning('请上传合集封面')
    return
  }
  const dup = props.groups.find((g) => (
    g.id !== form.value.id
    && String(g.name_en || '').toLowerCase() === form.value.name_en.trim().toLowerCase()
  ))
  if (dup) {
    ElMessage.warning('已存在相同的 English 壁纸合集标题')
    return
  }
  emit('save-group', { ...form.value })
  visible.value = false
}

defineExpose({ openGroup })
</script>

<style scoped>
.cover-field {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 128px;
}
.cover-uploader :deep(.el-upload) {
  display: block;
}
.cover-tile {
  width: 96px;
  height: 128px;
  aspect-ratio: 3 / 4;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  background: #f4f5f7;
  cursor: pointer;
}
.cover-tile :deep(.el-image) {
  width: 100%;
  height: 100%;
  display: block;
}
.cover-tile-empty {
  border: 1px dashed #c0c4cc;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: #606266;
  font-size: 12px;
  box-sizing: border-box;
}
.cover-tile-empty:hover {
  border-color: #409eff;
  color: #409eff;
}
.cover-plus {
  font-size: 22px;
  line-height: 1;
  color: #909399;
}
.cover-tile-empty:hover .cover-plus {
  color: #409eff;
}
.cover-tile-mask {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 6px 0;
  text-align: center;
  font-size: 12px;
  line-height: 1;
  color: #fff;
  background: rgba(25, 25, 25, 0.55);
}
.cover-side {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.cover-tip {
  margin: 0;
  color: #909399;
  font-size: 12px;
  line-height: 1.5;
}
.cover-tip-ratio {
  color: #606266;
  font-weight: 600;
}
</style>
