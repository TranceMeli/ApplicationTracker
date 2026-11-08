<script setup>
import { ICON_PATHS } from '../icons'

defineProps({ name: { type: String, required: true } })
</script>

<template>
  <svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path :d="ICON_PATHS[name] ?? ICON_PATHS.planned" /></svg>
</template>
