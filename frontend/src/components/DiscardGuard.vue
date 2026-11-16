<script setup>
import { onMounted, ref } from 'vue'
import { t } from '../i18n'

defineEmits(['keep', 'discard'])
const keepButton = ref(null)
onMounted(() => keepButton.value?.focus())
</script>

<template>
  <div class="guard" role="alertdialog" aria-labelledby="guard-title" aria-describedby="guard-text">
    <strong id="guard-title">{{ t('guard.title') }}</strong>
    <p id="guard-text">{{ t('guard.text') }}</p>
    <div class="guard-actions">
      <button ref="keepButton" type="button" @click="$emit('keep')">{{ t('guard.keep') }}</button>
      <button type="button" class="danger" @click="$emit('discard')">{{ t('guard.discard') }}</button>
    </div>
  </div>
</template>
