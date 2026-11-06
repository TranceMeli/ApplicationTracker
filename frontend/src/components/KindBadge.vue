<script setup>
import { kindClass, kindLabel } from '../kind'

defineProps({ item: Object })
</script>

<template>
  <span v-if="item.kind" class="kind-badge" :class="kindClass(item.kind)">{{ kindLabel(item) }}</span>
</template>
