<!-- 冷静期提示：保留账号 / 继续注销。冷启排队后弹一次。 -->
<template>
	<selah-dialog
		v-model:visible="open"
		:title="t('deletion_pending_title')"
		:content="body"
		:confirm-text="t('deletion_keep')"
		:cancel-text="t('deletion_continue')"
		:close-on-mask="false"
		@confirm="onKeep"
		@cancel="onContinue"
	/>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useI18n } from 'vue-i18n'
import { getUser } from '@/utils/session.js'
import {
	takeDeletionPrompt,
	deletionPromptContent,
	cancelAccountDeletion,
} from '@/utils/accountDeletion.js'

const { t } = useI18n()
const open = ref(false)
const body = ref('')
const busy = ref(false)

function maybeOpen() {
	if (!takeDeletionPrompt()) return
	body.value = deletionPromptContent(getUser())
	open.value = true
}

onMounted(maybeOpen)
onShow(maybeOpen)

function onContinue() {}

async function onKeep() {
	if (busy.value) return
	busy.value = true
	try {
		await cancelAccountDeletion()
		uni.showToast({ title: t('deletion_keep_ok'), icon: 'none' })
	} catch (e) {
		uni.showToast({ title: e?.message || t('request_failed'), icon: 'none' })
	} finally {
		busy.value = false
	}
}
</script>
