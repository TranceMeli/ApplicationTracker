<script setup>
import { computed } from 'vue'
import { domainOf, failedDomains, initials, logoUrl, logosEnabled } from '../logo'

const props = defineProps({ item: Object, large: Boolean, always: Boolean }) // always: also when logos are switched off, then as initials

const domain = computed(() => domainOf(props.item))
const showImage = computed(() => logosEnabled.value && domain.value && !failedDomains.has(domain.value))
</script>

<template>
  <span v-if="logosEnabled || always" class="logo" :class="[large ? 'large' : '', showImage ? '' : `initials ${item.status}`]" aria-hidden="true">
    <img
      v-if="showImage"
      :src="logoUrl(domain)"
      alt=""
      loading="lazy"
      @error="failedDomains.add(domain)"
    />
    <template v-else>{{ initials(item.company) }}</template>
  </span>
</template>
