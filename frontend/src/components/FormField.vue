<script setup>
import { t } from '../i18n'
import { kindName } from '../kind'

// One labelled field of the application form. The form object is edited in place.
defineProps({ f: Object, form: Object, kindOptions: { type: Array, default: () => [] }, duplicates: { type: Array, default: () => [] } })
</script>

<template>
  <label :class="{ wide: f.wide }">
    {{ t(f.label) }}{{ f.required ? ' *' : '' }}
    <select v-if="f.key === 'kind'" v-model="form.kind">
      <option value="">–</option>
      <option v-for="k in kindOptions" :key="k" :value="k">{{ kindName(k) }}</option>
    </select>
    <select v-else-if="f.type === 'select'" v-model="form[f.key]">
      <option v-if="!f.noEmpty" value="">–</option>
      <option v-for="o in f.options" :key="o" :value="o">{{ t(`${f.optionsPrefix}.${o}`) }}</option>
    </select>
    <textarea v-else-if="f.type === 'textarea'" v-model="form[f.key]" rows="3" />
    <input
      v-else
      v-model="form[f.key]"
      :type="f.type"
      :placeholder="f.placeholder ? t(f.placeholder) : undefined"
      :required="f.required"
      :autocomplete="f.autocomplete"
      :inputmode="f.inputmode"
      :maxlength="f.maxlength"
    />
    <small v-if="f.key === 'company' && duplicates.length" class="notice">
      {{ t('form.duplicate', { name: duplicates[0].company, n: duplicates[0].id }) }}
    </small>
  </label>
</template>
