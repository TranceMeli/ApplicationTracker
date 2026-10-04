<script setup>
import { TABLE_FIELDS, FORM_FIELDS, settings, resetSettings } from '../fields'
import { t } from '../i18n'

defineEmits(['close'])

function toggle(list, key) {
  const i = list.indexOf(key)
  i === -1 ? list.push(key) : list.splice(i, 1)
}
</script>

<template>
  <div class="overlay" @click.self="$emit('close')">
    <section class="dialog settings">
      <h2>{{ t('settings.title') }}</h2>
      <p class="sub wide">{{ t('settings.hint') }}</p>

      <fieldset>
        <legend>{{ t('settings.table') }}</legend>
        <label v-for="f in TABLE_FIELDS" :key="f.key" class="check">
          <input
            type="checkbox"
            :checked="f.locked || settings.table.includes(f.key)"
            :disabled="f.locked"
            @change="toggle(settings.table, f.key)"
          />
          {{ t(f.label) }}
        </label>
      </fieldset>

      <fieldset>
        <legend>{{ t('settings.form') }}</legend>
        <label v-for="f in FORM_FIELDS" :key="f.key" class="check">
          <input
            type="checkbox"
            :checked="f.locked || settings.form.includes(f.key)"
            :disabled="f.locked"
            @change="toggle(settings.form, f.key)"
          />
          {{ t(f.label) }}
        </label>
      </fieldset>

      <div class="buttons">
        <button @click="resetSettings">{{ t('settings.reset') }}</button>
        <button class="primary" @click="$emit('close')">{{ t('btn.close') }}</button>
      </div>
    </section>
  </div>
</template>