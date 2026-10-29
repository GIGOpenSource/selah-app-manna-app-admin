<template>
  <div class="cms-structure-toolbar">
    <div class="cms-structure-state" :class="{ pending: dirty }">
      <strong>{{ dirty ? dirtyTitle : '当前结构已发布' }}</strong>
      <span>{{ dirty ? dirtyHint : idleHint }}</span>
    </div>
    <div class="cms-structure-toolbar-actions">
      <span :title="dirty ? '' : idleHint">
        <el-button :disabled="!dirty || publishing || discarding" :loading="discarding" @click="$emit('discard')">取消发布</el-button>
      </span>
      <span :title="dirty ? '' : idleHint">
        <el-button type="primary" :disabled="!dirty || publishing || discarding" :loading="publishing" @click="$emit('publish')">确认发布</el-button>
      </span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  dirty: { type: Boolean, default: false },
  publishing: { type: Boolean, default: false },
  discarding: { type: Boolean, default: false },
  dirtyTitle: { type: String, default: '有未发布的结构调整' },
  idleHint: { type: String, default: '调整模块或合集后，需要统一确认发布。' },
  dirtyHint: { type: String, default: '模块或合集已调整，需要统一确认发布后才会同步 App。' },
})
defineEmits(['publish', 'discard'])
</script>
