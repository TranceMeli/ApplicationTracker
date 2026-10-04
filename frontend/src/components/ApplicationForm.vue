<script setup>
import { reactive } from 'vue'
import { today } from '../constants'
import { FIELDS, FORM_FIELDS, visibleFormFields } from '../fields'
import { t } from '../i18n'

const props = defineProps({ item: Object }) // {} = new application
const emit = defineEmits(['save', 'close'])

// Hidden fields stay in the form object, so their saved data is sent back unchanged.
const form = reactive({
  ...Object.fromEntries(FORM_FIELDS.map((f) => [f.key, ''])),
  date: today(),
  status: 'applied',
  is_favorite: false,
  ...props.item,
})

function submit() {
  const data = { ...form }
  for (const f of FIELDS) if (f.type === 'date') data[f.key] = data[f.key] || null
  emit('save', props.item.id, data)
}
</script>

<template>
  <div class="overlay" @click.self="$emit('close')">
    <form class="dialog" @submit.prevent="submit">
      <h2>{{ item.id ? t('form.edit') : t('form.new') }}</h2>

      <label v-for="f in visibleFormFields" :key="f.key" :class="{ wide: f.wide }">
        {{ t(f.label) }}
        <select v-if="f.type === 'select'" v-model="form[f.key]">
          <option v-if="f.key !== 'status'" value="">–</option>
          <option v-for="o in f.options" :key="o" :value="o">{{ t(`${f.optionsPrefix}.${o}`) }}</option>
        </select>
        <textarea v-else-if="f.type === 'textarea'" v-model="form[f.key]" rows="3" />
        <input
          v-else
          v-model="form[f.key]"
          :type="f.type"
          :required="f.required"
          :autocomplete="f.autocomplete"
          :inputmode="f.inputmode"
          :maxlength="f.maxlength"
        />
      </label>

      <label class="wide check"><input v-model="form.is_favorite" type="checkbox" /> {{ t('field.favoriteMark') }}</label>
      <div class="buttons">
        <button type="button" @click="$emit('close')">{{ t('btn.cancel') }}</button>
        <button class="primary" type="submit">{{ t('btn.save') }}</button>
      </div>
    </form>
  </div>
</template>