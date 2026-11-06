<script setup>
import { computed, ref } from 'vue'
import { vBackdropClose } from '../backdrop'
import {
  FIELDS,
  GROUPS,
  addSection,
  moveField,
  moveFieldTo,
  moveSection,
  removeSection,
  renameSection,
  resetSettings,
  settings,
} from '../fields'
import { t } from '../i18n'
import { logosEnabled } from '../logo'

defineEmits(['close'])

// Fields without a section (company, position, status, type, number) are always in the header of the detail view.
const HEADER = 'header'
const headerFields = FIELDS.filter((f) => !f.group)

const current = ref(settings.layout[0]?.id ?? HEADER)
const section = computed(() => settings.layout.find((s) => s.id === current.value))
const title = (s) => s.name || t(`group.${s.id}`)
const currentTitle = computed(() => (current.value === HEADER ? t('group.header') : title(section.value)))
const fieldsOf = computed(() =>
  current.value === HEADER ? headerFields : section.value.fields.map((key) => FIELDS.find((f) => f.key === key)),
)
const isCustom = (id) => !GROUPS.includes(id)

const newName = ref('')
function create() {
  const name = newName.value.trim()
  if (!name) return
  current.value = addSection(name)
  newName.value = ''
}

function remove(id) {
  removeSection(id)
  current.value = settings.layout[0].id
}

function rename(event) {
  const name = event.target.value.trim()
  if (name) renameSection(current.value, name)
  else event.target.value = section.value.name
}

function toggle(list, key) {
  const i = list.indexOf(key)
  i === -1 ? list.push(key) : list.splice(i, 1)
}

const inForm = (f) => f.locked || settings.form.includes(f.key)
const inTable = (f) => f.locked || settings.table.includes(f.key)
</script>

<template>
  <div class="overlay" v-backdrop-close="() => $emit('close')">
    <section class="dialog settings">
      <h2>{{ t('settings.title') }}</h2>
      <p class="sub wide">{{ t('settings.hint') }}</p>

      <div class="settings-grid wide">
        <nav class="section-list" :aria-label="t('settings.sections')">
          <p class="sub">{{ t('settings.sections') }}</p>
          <div v-for="(s, i) in settings.layout" :key="s.id" class="section-item" :class="{ active: current === s.id }">
            <button class="section-pick" :aria-current="current === s.id" @click="current = s.id">
              {{ title(s) }} <span class="count">{{ s.fields.length }}</span>
            </button>
            <span class="arrows">
              <button :disabled="i === 0" :aria-label="t('settings.moveUp')" :title="t('settings.moveUp')" @click="moveSection(s.id, -1)">▲</button>
              <button :disabled="i === settings.layout.length - 1" :aria-label="t('settings.moveDown')" :title="t('settings.moveDown')" @click="moveSection(s.id, 1)">▼</button>
            </span>
          </div>
          <div class="section-item" :class="{ active: current === HEADER }">
            <button class="section-pick" :aria-current="current === HEADER" @click="current = HEADER">
              {{ t('group.header') }} <span class="count">{{ headerFields.length }}</span>
            </button>
          </div>
          <form class="add-section" @submit.prevent="create">
            <input v-model="newName" type="text" :placeholder="t('settings.newSection')" :aria-label="t('settings.newSection')" />
            <button type="submit" :aria-label="t('settings.addSection')" :title="t('settings.addSection')">+</button>
          </form>
        </nav>

        <div class="section-fields">
          <div class="section-head">
            <h3>{{ t('settings.fieldsIn', { name: currentTitle }) }}</h3>
            <template v-if="current !== HEADER && isCustom(current)">
              <input :value="section.name" class="section-name" :aria-label="t('settings.renameSection')" @change="rename" />
              <button @click="remove(current)">{{ t('settings.deleteSection') }}</button>
            </template>
          </div>

          <p v-if="current !== HEADER && !fieldsOf.length" class="sub">{{ t('settings.emptySection') }}</p>
          <table v-else>
            <thead>
              <tr>
                <th>{{ t('settings.colField') }}</th>
                <th>{{ t('settings.colForm') }}</th>
                <th>{{ t('settings.colTable') }}</th>
                <th v-if="current !== HEADER">{{ t('settings.colSection') }}</th>
                <th v-if="current !== HEADER"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="f in fieldsOf" :key="f.key">
                <td>{{ t(f.label) }}</td>
                <td>
                  <input
                    type="checkbox"
                    :checked="inForm(f)"
                    :disabled="f.locked || f.formable === false"
                    :aria-label="`${t(f.label)}: ${t('settings.colForm')}`"
                    @change="toggle(settings.form, f.key)"
                  />
                </td>
                <td>
                  <input
                    v-if="f.tableable"
                    type="checkbox"
                    :checked="inTable(f)"
                    :disabled="f.locked"
                    :aria-label="`${t(f.label)}: ${t('settings.colTable')}`"
                    @change="toggle(settings.table, f.key)"
                  />
                </td>
                <td v-if="current !== HEADER">
                  <select :value="current" :aria-label="`${t(f.label)}: ${t('settings.colSection')}`" @change="moveFieldTo(f.key, $event.target.value)">
                    <option v-for="s in settings.layout" :key="s.id" :value="s.id">{{ title(s) }}</option>
                  </select>
                </td>
                <td v-if="current !== HEADER" class="arrows">
                  <button :aria-label="t('settings.moveUp')" :title="t('settings.moveUp')" @click="moveField(f.key, -1)">▲</button>
                  <button :aria-label="t('settings.moveDown')" :title="t('settings.moveDown')" @click="moveField(f.key, 1)">▼</button>
                </td>
              </tr>
            </tbody>
          </table>

          <label class="check hide-empty">
            <input v-model="settings.hideEmpty" type="checkbox" />
            {{ t('settings.hideEmpty') }}
          </label>
          <p class="sub">{{ t('settings.autoHint') }}</p>
        </div>
      </div>

      <fieldset class="wide">
        <legend>{{ t('settings.logos') }}</legend>
        <label class="check">
          <input v-model="logosEnabled" type="checkbox" />
          {{ t('settings.logosShow') }}
        </label>
        <p class="sub">{{ t('settings.logosHint') }}</p>
      </fieldset>

      <div class="buttons">
        <button @click="resetSettings">{{ t('settings.reset') }}</button>
        <button class="primary" @click="$emit('close')">{{ t('btn.close') }}</button>
      </div>
    </section>
  </div>
</template>
