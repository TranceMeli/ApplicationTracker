<script setup>
import { dismissToast, toast } from '../toast'
import { t } from '../i18n'

function act() {
  const action = toast.value?.onAction
  dismissToast()
  action?.()
}
</script>

<template>
  <div v-if="toast" class="toast" role="status">
    <span>{{ toast.message }}</span>
    <button v-if="toast.actionLabel" class="link" @click="act">{{ toast.actionLabel }}</button>
    <button class="toast-close" :aria-label="t('toast.close')" @click="dismissToast">×</button>
  </div>
</template>
