<script setup>
import { LOCALES, locale, setLocale, t } from '../i18n'
</script>

<template>
  <div class="lang" role="group" :aria-label="t('lang.label')">
    <button
      v-for="l in LOCALES"
      :key="l"
      :class="{ active: locale === l }"
      :aria-pressed="locale === l"
      @click="setLocale(l)"
    >{{ l.toUpperCase() }}</button>
  </div>
</template>