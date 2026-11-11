<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { vBackdropClose } from '../backdrop'
import { fmt } from '../constants'
import { t } from '../i18n'

// Shows an attached document in a dialog on top of the detail view, so nobody has to leave the page.
const props = defineProps({ files: { type: Array, required: true }, index: { type: Number, default: 0 } })
const emit = defineEmits(['close', 'update:index'])

const file = computed(() => props.files[props.index])
// Only the path is used: the frame must stay on the page's own origin, whatever host the API reports.
const url = computed(() => new URL(file.value.file, window.location.origin).pathname)
const ext = computed(() => (file.value.name.split('.').pop() || '').toLowerCase())
const type = computed(() => {
  if (ext.value === 'pdf' || ext.value === 'txt') return 'frame'
  if (['png', 'jpg', 'jpeg'].includes(ext.value)) return 'image'
  return 'none' // Word and ODT files cannot be shown by a browser
})

const step = (n) => {
  const next = props.index + n
  if (next >= 0 && next < props.files.length) emit('update:index', next)
}

// Runs before the handlers of the detail view and the page, so Escape closes only the viewer.
function onKey(e) {
  if (e.key === 'Escape') emit('close')
  else if (e.key === 'ArrowLeft') step(-1)
  else if (e.key === 'ArrowRight') step(1)
  else return
  e.preventDefault()
  e.stopImmediatePropagation()
}
onMounted(() => window.addEventListener('keydown', onKey, true))
onUnmounted(() => window.removeEventListener('keydown', onKey, true))
</script>

<template>
  <div class="overlay viewer-overlay" v-backdrop-close="() => $emit('close')">
    <section class="viewer" role="dialog" aria-modal="true" :aria-label="file.name">
      <header class="viewer-head">
        <div class="viewer-title">
          <strong>{{ file.name }}</strong>
          <span class="sub">{{ t(`kind.${file.kind}`) }} · {{ fmt(file.uploaded_at) }}</span>
        </div>
        <div v-if="files.length > 1" class="pager">
          <button :disabled="index === 0" :aria-label="t('viewer.prev')" :title="t('viewer.prev')" @click="step(-1)">‹</button>
          <span>{{ index + 1 }} / {{ files.length }}</span>
          <button :disabled="index === files.length - 1" :aria-label="t('viewer.next')" :title="t('viewer.next')" @click="step(1)">›</button>
        </div>
        <a class="viewer-download" :href="url" :download="file.name">{{ t('viewer.download') }}</a>
        <button class="close" :aria-label="t('btn.close')" @click="$emit('close')">✕</button>
      </header>
      <div class="viewer-body">
        <iframe v-if="type === 'frame'" :key="url" :src="url" :title="file.name"></iframe>
        <img v-else-if="type === 'image'" :key="url" :src="url" :alt="file.name" />
        <div v-else class="viewer-none">
          <p>{{ t('viewer.noPreview') }}</p>
          <a class="viewer-download" :href="url" :download="file.name">{{ t('viewer.download') }}</a>
        </div>
      </div>
    </section>
  </div>
</template>
