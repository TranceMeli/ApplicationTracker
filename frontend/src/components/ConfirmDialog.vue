<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { vBackdropClose } from '../backdrop'
import { answerConfirm, confirmState } from '../confirm'
import { t } from '../i18n'

const cancelButton = ref(null)

function onKey(e) {
  if (e.key === 'Escape') answerConfirm(false)
}

// Focus starts on "Cancel", so a stray Enter key never deletes anything.
onMounted(() => {
  window.addEventListener('keydown', onKey)
  cancelButton.value?.focus()
})
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="overlay confirm" v-backdrop-close="() => answerConfirm(false)">
    <section class="dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-text">
      <p id="confirm-text" class="wide">{{ confirmState.message }}</p>
      <div class="buttons">
        <button ref="cancelButton" type="button" @click="answerConfirm(false)">{{ t('btn.cancel') }}</button>
        <button class="danger" type="button" @click="answerConfirm(true)">{{ t('btn.delete') }}</button>
      </div>
    </section>
  </div>
</template>
