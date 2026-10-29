<!--
  同池排序：分享/点赞权重 + 时间衰减等可配参数。
-->
<template>
  <div>
    <div class="container">
      <ConfigPackList
        title="同池排序"
        tips="只决定已进同一箱子的语录谁排前面，不改变三池比例。未看过优先始终生效。"
        :keys="RANK_KEYS"
        :defaults="rankDefaults"
        remark="同池排序"
        dialog-width="560px"
        :summary-keys="['pool_rank_enabled', 'pool_rank_share_weight', 'pool_rank_like_weight', 'pool_rank_half_life_days']"
        :validate-fn="validateRank"
      >
        <template #toolbar>
          <el-tooltip
            content="改权重/半衰期后也可等日更；立即重算会扫全库日互动。"
            placement="bottom"
          >
            <el-button type="primary" plain :loading="recomputing" @click="onRecompute">立即重算得分</el-button>
          </el-tooltip>
        </template>
        <template #form="{ form: rf }">
          <el-form-item label="启用互动排序">
            <el-switch v-model="rf.pool_rank_enabled" />
          </el-form-item>
          <el-form-item label="分享权重(%)">
            <el-input-number v-model="rf.pool_rank_share_weight" :min="0" :max="100" />
          </el-form-item>
          <el-form-item label="点赞权重(%)">
            <el-input-number v-model="rf.pool_rank_like_weight" :min="0" :max="100" />
          </el-form-item>
          <el-form-item label="半衰期(天)">
            <el-input-number v-model="rf.pool_rank_half_life_days" :min="1" :max="30" />
          </el-form-item>
          <el-form-item label="统计天数">
            <el-input-number v-model="rf.pool_rank_window_days" :min="1" :max="180" />
          </el-form-item>
          <el-form-item label="点赞平滑分子">
            <el-input-number v-model="rf.pool_rank_like_alpha" :min="0" :step="0.1" />
          </el-form-item>
          <el-form-item label="点赞平滑分母">
            <el-input-number v-model="rf.pool_rank_like_beta" :min="1" />
          </el-form-item>
          <el-form-item label="分享平滑分子">
            <el-input-number v-model="rf.pool_rank_share_alpha" :min="0" :step="0.1" />
          </el-form-item>
          <el-form-item label="分享平滑分母">
            <el-input-number v-model="rf.pool_rank_share_beta" :min="1" />
          </el-form-item>
          <el-form-item label="信仰微调">
            <el-input-number v-model="rf.pool_rank_faith_bonus" :min="0" :max="0.01" :step="0.001" />
          </el-form-item>
          <el-form-item label="同分规则">
            <el-select v-model="rf.pool_rank_tie_break" style="width: 100%">
              <el-option label="随机" value="random" />
              <el-option label="按编号" value="id" />
            </el-select>
          </el-form-item>
        </template>
        <template #summary="{ pack }">
          {{ pack.values.pool_rank_enabled === false ? '关' : '开' }}
          · 分享 {{ pack.values.pool_rank_share_weight ?? '—' }}
          / 点赞 {{ pack.values.pool_rank_like_weight ?? '—' }}
          · 半衰期 {{ pack.values.pool_rank_half_life_days ?? '—' }}天
        </template>
      </ConfigPackList>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import ConfigPackList from '../components/ConfigPackList.vue'
import { recomputePoolRank } from '../api'

const RANK_KEYS = [
  'pool_rank_enabled',
  'pool_rank_share_weight',
  'pool_rank_like_weight',
  'pool_rank_half_life_days',
  'pool_rank_window_days',
  'pool_rank_like_alpha',
  'pool_rank_like_beta',
  'pool_rank_share_alpha',
  'pool_rank_share_beta',
  'pool_rank_faith_bonus',
  'pool_rank_tie_break',
]

const rankDefaults = {
  pool_rank_enabled: true,
  pool_rank_share_weight: 65,
  pool_rank_like_weight: 35,
  pool_rank_half_life_days: 7,
  pool_rank_window_days: 56,
  pool_rank_like_alpha: 1,
  pool_rank_like_beta: 50,
  pool_rank_share_alpha: 0.5,
  pool_rank_share_beta: 100,
  pool_rank_faith_bonus: 0.002,
  pool_rank_tie_break: 'random',
}

function validateRank(f) {
  const sw = Number(f.pool_rank_share_weight || 0)
  const lw = Number(f.pool_rank_like_weight || 0)
  if (sw + lw !== 100) return '分享权重 + 点赞权重须为 100'
  const half = Number(f.pool_rank_half_life_days || 0)
  const win = Number(f.pool_rank_window_days || 0)
  if (half <= 0) return '半衰期须为正整数'
  if (win < half) return '统计天数须 ≥ 半衰期'
  if (Number(f.pool_rank_like_beta || 0) <= 0 || Number(f.pool_rank_share_beta || 0) <= 0) {
    return '平滑分母须大于 0'
  }
  return ''
}

const recomputing = ref(false)
async function onRecompute() {
  recomputing.value = true
  try {
    const res = await recomputePoolRank()
    ElMessage.success(`已重算 ${res.results?.updated ?? res.updated ?? 0} 条`)
  } catch (e) {
    ElMessage.error(e.message || '重算失败')
  } finally {
    recomputing.value = false
  }
}
</script>
