<script setup>
import { STATUS_KEYS, fmt, today } from '../constants'
import { visibleTableFields } from '../fields'
import { t } from '../i18n'

defineProps({ items: Array })
defineEmits(['open', 'edit', 'remove', 'status', 'favorite'])

const overdue = (i) => i.follow_up && i.follow_up <= today() && i.status === 'applied'
</script>

<template>
  <table>
    <thead>
      <tr>
        <th></th>
        <th v-for="f in visibleTableFields" :key="f.key">{{ t(f.label) }}</th>
        <th></th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="i in items" :key="i.id" :class="i.status" @click="$emit('open', i)">
        <td class="fav" @click.stop>
          <button
            class="star"
            :class="{ on: i.is_favorite }"
            :aria-label="i.is_favorite ? t('fav.remove') : t('fav.add')"
            @click="$emit('favorite', i)"
          >{{ i.is_favorite ? '★' : '☆' }}</button>
        </td>

        <td
          v-for="f in visibleTableFields"
          :key="f.key"
          :class="{ overdue: f.key === 'follow_up' && overdue(i), clip: f.type === 'textarea' }"
        >
          <template v-if="f.key === 'company'">
            <a v-if="i.link" :href="i.link" target="_blank" rel="noopener" @click.stop>{{ i.company }}</a>
            <span v-else class="name">{{ i.company }}</span>
          </template>
          <select
            v-else-if="f.key === 'status'"
            :value="i.status"
            @click.stop
            @change="$emit('status', i, $event.target.value)"
          >
            <option v-for="key in STATUS_KEYS" :key="key" :value="key">{{ t(`status.${key}`) }}</option>
          </select>
          <a v-else-if="f.type === 'email' && i.email" :href="`mailto:${i.email}`" @click.stop>{{ i.email }}</a>
          <a v-else-if="f.type === 'url' && i[f.key]" :href="i[f.key]" target="_blank" rel="noopener" @click.stop>↗</a>
          <template v-else-if="f.type === 'date'">{{ fmt(i[f.key]) }}</template>
          <template v-else-if="f.type === 'select'">
            {{ i[f.key] ? t(`${f.optionsPrefix}.${i[f.key]}`) : '–' }}
          </template>
          <template v-else>{{ i[f.key] || '–' }}</template>
        </td>

        <td class="actions" @click.stop>
          <button @click="$emit('edit', i)">{{ t('btn.edit') }}</button>
          <button @click="$emit('remove', i)">{{ t('btn.delete') }}</button>
        </td>
      </tr>
    </tbody>
  </table>
</template>