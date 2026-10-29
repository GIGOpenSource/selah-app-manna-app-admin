<!--
  Manna 规则：维度打包列表。
-->
<template>
  <div class="container">
    <ConfigPackList
      title="Manna 规则"
      tips="Manna 经济、轮换、听经底图、Quiz 枢纽日夜间底图、登录与翻译开关。社交 Follow 链接请到「品牌与法务」填写。新建包 App 必选 manna。AI/商店/翻译密钥不进表单，只走环境变量。ensure 只补缺失键。不做充值，url_subscription 保持空。"
      :keys="KEYS"
      :defaults="defaults"
      remark="Manna 规则"
      dialog-width="760px"
      label-width="180px"
      :summary-keys="['brand_name', 'manna_newcomer_grant', 'manna_verse_rotate']"
      :meta-hint-fn="metaHintFn"
      default-app-key="manna"
    >
      <template #form="{ form }">
        <el-form-item label="品牌名"><el-input v-model="form.brand_name" /></el-form-item>
        <el-form-item label="功能总开关"><el-switch v-model="form.manna_features_enabled" /></el-form-item>
        <el-form-item label="新人赠送 Manna">
          <el-input-number v-model="form.manna_newcomer_grant" :min="0" :max="9999" />
        </el-form-item>
        <el-form-item label="测验通关奖励">
          <el-input-number v-model="form.manna_quiz_pass_reward" :min="0" />
        </el-form-item>
        <el-form-item label="测验失败扣减">
          <el-input-number v-model="form.manna_quiz_fail_penalty" :min="0" />
        </el-form-item>
        <el-form-item label="In Bible 消耗">
          <el-input-number v-model="form.manna_in_bible_cost" :min="0" />
        </el-form-item>
        <el-form-item label="Review 消耗">
          <el-input-number v-model="form.manna_quiz_review_cost" :min="0" />
        </el-form-item>
        <el-form-item label="祷告 Amen 奖励">
          <el-input-number v-model="form.manna_prayer_amen_reward" :min="0" />
        </el-form-item>
        <el-form-item label="灵修完成奖励">
          <el-input-number v-model="form.manna_devotion_amen_reward" :min="0" />
        </el-form-item>
        <el-form-item label="读经达标奖励">
          <el-input-number v-model="form.manna_bible_read_reward" :min="0" />
        </el-form-item>
        <el-form-item label="读经达标秒数">
          <el-input-number v-model="form.manna_bible_read_seconds" :min="0" />
        </el-form-item>
        <el-form-item label="读经每日次数上限">
          <el-input-number v-model="form.manna_bible_read_daily_cap" :min="0" :max="20" />
        </el-form-item>
        <el-form-item label="首页 Amen 奖励">
          <el-input-number v-model="form.manna_home_amen_reward" :min="0" />
        </el-form-item>
        <el-form-item label="测验须全对才通关">
          <el-switch v-model="form.manna_quiz_require_all_correct" />
        </el-form-item>
        <el-form-item label="VIP 开关"><el-switch v-model="form.manna_vip_enabled" /></el-form-item>
        <el-form-item label="VerseCard 品牌"><el-input v-model="form.versecard_brand" /></el-form-item>
        <el-form-item label="分享文案模板">
          <el-input v-model="form.share_text_template" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="Home 嵌入测验奖励">
          <el-input-number v-model="form.home_embed_quiz_manna_reward" :min="0" />
        </el-form-item>
        <el-form-item label="成长卡开关"><el-switch v-model="form.stats_card_enabled" /></el-form-item>
        <el-form-item label="支持邮箱"><el-input v-model="form.support_email" /></el-form-item>
        <el-form-item label="Privacy URL"><el-input v-model="form.url_privacy" /></el-form-item>
        <el-form-item label="Terms URL"><el-input v-model="form.url_terms" /></el-form-item>
        <el-form-item label="Help URL"><el-input v-model="form.url_help" /></el-form-item>
        <el-form-item label="Download URL"><el-input v-model="form.url_download" /></el-form-item>
        <el-form-item label="Subscription URL"><el-input v-model="form.url_subscription" /></el-form-item>

        <el-divider content-position="left">今日经文 / 祷告轮换</el-divider>
        <el-form-item label="经文轮换">
          <el-select v-model="form.manna_verse_rotate" :teleported="false" style="width: 100%">
            <el-option label="按生效日（无则最高排序）" value="date" />
            <el-option label="日历轮换（按天取模）" value="calendar" />
            <el-option label="当日稳定随机" value="daily_random" />
            <el-option label="始终最低排序" value="sort" />
            <el-option label="固定 ID" value="fixed" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.manna_verse_rotate === 'fixed'" label="经文固定 ID">
          <el-input-number v-model="form.manna_verse_fixed_id" :min="0" />
        </el-form-item>
        <el-form-item label="祷告轮换">
          <el-select v-model="form.manna_prayer_rotate" :teleported="false" style="width: 100%">
            <el-option label="按日历日轮换" value="date" />
            <el-option label="当日稳定随机" value="daily_random" />
            <el-option label="始终最低排序" value="sort" />
            <el-option label="固定 ID" value="fixed" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.manna_prayer_rotate === 'fixed'" label="晨祷固定 ID">
          <el-input-number v-model="form.manna_prayer_morning_id" :min="0" />
        </el-form-item>
        <el-form-item v-if="form.manna_prayer_rotate === 'fixed'" label="晚祷固定 ID">
          <el-input-number v-model="form.manna_prayer_night_id" :min="0" />
        </el-form-item>

        <el-divider content-position="left">听经底图</el-divider>
        <el-form-item label="听经底图 URL">
          <el-input v-model="form.bible_listen_bg_url" placeholder="/static/ui/bible/listen/bg-listen.png" />
        </el-form-item>
        <el-form-item label="上传听经底图">
          <el-upload :show-file-list="false" :auto-upload="false" accept="image/*" :on-change="(f) => onUploadBg(f, form, 'bible_listen_bg_url', 'manna/listen')">
            <el-button :loading="uploading === 'bible_listen_bg_url'">上传 COS</el-button>
          </el-upload>
          <el-image v-if="form.bible_listen_bg_url" :src="form.bible_listen_bg_url" class="listen-thumb" fit="cover" />
        </el-form-item>

        <el-divider content-position="left">Quiz 枢纽底图</el-divider>
        <el-form-item label="日间底图">
          <el-input v-model="form.manna_quiz_hub_bg_url" placeholder="空则用本地无字日间场景" />
          <div class="bg-row">
            <el-upload :show-file-list="false" :auto-upload="false" accept="image/*" :on-change="(f) => onUploadBg(f, form, 'manna_quiz_hub_bg_url', 'manna/quiz/morning')">
              <el-button :loading="uploading === 'manna_quiz_hub_bg_url'">上传日间</el-button>
            </el-upload>
            <el-image v-if="form.manna_quiz_hub_bg_url" :src="form.manna_quiz_hub_bg_url" class="listen-thumb" fit="cover" />
          </div>
        </el-form-item>
        <el-form-item label="夜间底图">
          <el-input v-model="form.manna_quiz_hub_bg_night_url" placeholder="空则回落日间或本地夜间场景" />
          <div class="bg-row">
            <el-upload :show-file-list="false" :auto-upload="false" accept="image/*" :on-change="(f) => onUploadBg(f, form, 'manna_quiz_hub_bg_night_url', 'manna/quiz/night')">
              <el-button :loading="uploading === 'manna_quiz_hub_bg_night_url'">上传夜间</el-button>
            </el-upload>
            <el-image v-if="form.manna_quiz_hub_bg_night_url" :src="form.manna_quiz_hub_bg_night_url" class="listen-thumb" fit="cover" />
          </div>
        </el-form-item>

        <el-divider content-position="left">认证 / 翻译 / VIP</el-divider>
        <el-form-item label="设备登录"><el-switch v-model="form.device_login_enabled" /></el-form-item>
        <el-form-item label="Google/Apple 登录"><el-switch v-model="form.oauth_login_enabled" /></el-form-item>
        <el-form-item label="会话天数">
          <el-input-number v-model="form.session_ttl_days" :min="1" :max="365" />
        </el-form-item>
        <el-form-item label="记住我天数">
          <el-input-number v-model="form.session_remember_days" :min="1" :max="365" />
        </el-form-item>
        <el-form-item label="经文翻译开关"><el-switch v-model="form.translate_enabled" /></el-form-item>
        <el-form-item label="IAP 验单"><el-switch v-model="form.iap_verify_enabled" /></el-form-item>
        <el-form-item label="恢复购买"><el-switch v-model="form.iap_restore_enabled" /></el-form-item>
      </template>
    </ConfigPackList>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import ConfigPackList from '../../components/ConfigPackList.vue'
import { uploadFile } from '../../api'

const uploading = ref('')

async function onUploadBg(file, form, key, folder) {
  const raw = file?.raw
  if (!raw || !form || !key) return
  uploading.value = key
  try {
    const res = await uploadFile(raw, folder)
    const url = res.results?.url || res.data?.url || res.url || ''
    if (url) {
      form[key] = url
      ElMessage.success('已上传')
    }
  } catch (e) {
    ElMessage.error(e.message || e.msg || '上传失败')
  } finally {
    uploading.value = ''
  }
}

function metaHintFn(meta) {
  const tr = meta?.translate || {}
  const key = tr.has_key ? '已检测到 GOOGLE_TRANSLATE_API_KEY' : '未检测到翻译 Key（DEBUG 可走 gtx）'
  const audio = tr.env_audio_root ? '；环境变量已设 BIBLE_AUDIO_ROOT' : '；音频根目录可在「圣经译本」页填写，或设环境变量'
  return key + audio
}

const defaults = {
  brand_name: 'Manna',
  manna_features_enabled: true,
  manna_newcomer_grant: 200,
  manna_quiz_pass_reward: 30,
  manna_quiz_fail_penalty: 10,
  manna_in_bible_cost: 10,
  manna_quiz_review_cost: 10,
  manna_prayer_amen_reward: 10,
  manna_devotion_amen_reward: 10,
  manna_bible_read_reward: 10,
  manna_bible_read_seconds: 300,
  manna_bible_read_daily_cap: 2,
  manna_home_amen_reward: 0,
  manna_quiz_require_all_correct: true,
  manna_vip_enabled: false,
  versecard_brand: 'MANNA-DAILY BIBLE',
  share_text_template: '{text} — {reference} · {brand}',
  home_embed_quiz_manna_reward: 0,
  stats_card_enabled: true,
  support_email: 'support@manna.app',
  url_privacy: '',
  url_terms: '',
  url_help: '',
  url_download: '',
  url_subscription: '',
  manna_verse_rotate: 'date',
  manna_prayer_rotate: 'date',
  manna_verse_fixed_id: 0,
  manna_prayer_morning_id: 0,
  manna_prayer_night_id: 0,
  bible_listen_bg_url: '/static/ui/bible/listen/bg-listen.png',
  manna_quiz_hub_bg_url: '',
  manna_quiz_hub_bg_night_url: '',
  device_login_enabled: true,
  oauth_login_enabled: true,
  session_ttl_days: 7,
  session_remember_days: 30,
  translate_enabled: true,
  iap_verify_enabled: true,
  iap_restore_enabled: true,
}
const KEYS = Object.keys(defaults)
</script>
<style scoped>
.listen-thumb { width: 120px; height: 72px; margin-top: 8px; border-radius: 8px; }
.bg-row { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
</style>
