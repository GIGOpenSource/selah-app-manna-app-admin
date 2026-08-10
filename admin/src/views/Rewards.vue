<!--
  签到/额度：维度打包列表。
-->
<template>
  <div class="container">
    <ConfigPackList
      title="签到与额度"
      tips="签到领次、冻结爱心、新人额度、免费上限。空维=看全部包；试用天数请在「会员 SKU」页配置。"
      :keys="KEYS"
      :defaults="defaults"
      remark="签到/额度"
      dialog-width="640px"
      :summary-keys="['newcomer_bonus', 'checkin_reward', 'free_quota_cap']"
    >
      <template #form="{ form }">
        <el-form-item label="新人登录 +N">
          <el-input-number v-model="form.newcomer_bonus" :min="0" :max="20" />
        </el-form-item>
        <el-form-item label="Free 签到奖励">
          <el-input-number v-model="form.checkin_reward" :min="0" :max="10" />
        </el-form-item>
        <el-form-item label="Free 余额上限">
          <el-input-number v-model="form.free_quota_cap" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="自动打卡弹层">
          <el-switch v-model="form.checkin_auto_popup" />
        </el-form-item>
        <el-form-item label="新人喜欢目标">
          <el-input-number v-model="form.newcomer_like_goal" :min="1" :max="20" />
        </el-form-item>
        <el-form-item label="新人说明标题">
          <el-input v-model="form.newcomer_intro_title" placeholder="空=App i18n" maxlength="120" />
        </el-form-item>
        <el-form-item label="新人说明正文">
          <el-input v-model="form.newcomer_intro_body" type="textarea" :rows="2" placeholder="空=App i18n" maxlength="400" />
        </el-form-item>
        <el-form-item label="新人完成 Toast">
          <el-input v-model="form.newcomer_done_text" placeholder="空=App i18n" maxlength="200" />
        </el-form-item>
        <el-form-item label="新人完成祝贺">
          <el-input v-model="form.newcomer_congrats_text" placeholder="空=App i18n" maxlength="200" />
        </el-form-item>
        <el-form-item label="断签清零天数">
          <el-input-number v-model="form.streak_miss_reset_days" :min="1" :max="30" />
        </el-form-item>
        <el-form-item label="初始冻结爱心">
          <el-input-number v-model="form.streak_heart_initial" :min="0" :max="20" />
        </el-form-item>
        <el-form-item label="爱心上限">
          <el-input-number v-model="form.streak_heart_max" :min="1" :max="20" />
        </el-form-item>
        <el-form-item label="每 N 天补爱心">
          <el-input-number v-model="form.streak_heart_refill_every" :min="0" :max="30" />
        </el-form-item>
        <el-form-item label="每次补发数量">
          <el-input-number v-model="form.streak_heart_refill_amount" :min="0" :max="5" />
        </el-form-item>
        <el-form-item label="喜欢标签软信号">
          <el-switch v-model="form.like_soft_signal" />
        </el-form-item>
        <el-form-item label="试用夹层（进 VIP 前）">
          <el-switch v-model="form.trial_intro_enabled" />
        </el-form-item>
        <el-form-item label="Selah 2.0 扩展题">
          <el-switch v-model="form.selah_2_0_features_enabled" />
        </el-form-item>
      </template>
    </ConfigPackList>
  </div>
</template>

<script setup>
import ConfigPackList from '../components/ConfigPackList.vue'

const defaults = {
  newcomer_bonus: 3,
  checkin_reward: 1,
  free_quota_cap: 10,
  checkin_auto_popup: true,
  newcomer_like_goal: 5,
  newcomer_intro_title: '',
  newcomer_intro_body: '',
  newcomer_done_text: '',
  newcomer_congrats_text: '',
  streak_miss_reset_days: 3,
  streak_heart_initial: 3,
  streak_heart_max: 5,
  streak_heart_refill_every: 7,
  streak_heart_refill_amount: 1,
  like_soft_signal: true,
  trial_intro_enabled: true,
  selah_2_0_features_enabled: true,
}
const KEYS = Object.keys(defaults)
</script>
