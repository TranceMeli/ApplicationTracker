<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'

defineProps({
  label: String,
  ariaLabel: String,
  triggerClass: String,
  panelClass: String,
  align: { type: String, default: 'left' },
  arrow: { type: Boolean, default: true },
})

const open = ref(false)
const root = ref(null)
const trigger = ref(null)

const close = () => { open.value = false }

function onPointerDown(e) {
  if (root.value && !root.value.contains(e.target)) close()
}

function onKey(e) {
  if (e.key !== 'Escape') return
  close()
  trigger.value?.focus()
}

watch(open, (value) => {
  const method = value ? 'addEventListener' : 'removeEventListener'
  document[method]('mousedown', onPointerDown)
  document[method]('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onPointerDown)
  document.removeEventListener('keydown', onKey)
})

defineExpose({ close })
</script>

<template>
  <div ref="root" class="menu-wrap">
    <button
      ref="trigger"
      type="button"
      class="menu-trigger"
      :class="triggerClass"
      aria-haspopup="true"
      :aria-expanded="open"
      :aria-label="ariaLabel || undefined"
      :title="ariaLabel || undefined"
      @click="open = !open"
    >
      <slot name="label">{{ label }}</slot>
      <span v-if="arrow" class="menu-arrow" aria-hidden="true">▾</span>
    </button>
    <div v-if="open" class="menu-panel" :class="[panelClass, `align-${align}`]">
      <slot :close="close" />
    </div>
  </div>
</template>
