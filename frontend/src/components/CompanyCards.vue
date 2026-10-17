<script setup>
import { fmt } from '../constants'
import { distanceLabel, home } from '../geo'
import { t } from '../i18n'

defineProps({ items: Array })
defineEmits(['open', 'favorite'])

const place = (i) => [i.postal_code, i.city].filter(Boolean).join(' ')
</script>

<template>
  <ul class="cards">
    <li
      v-for="i in items"
      :key="i.id"
      class="card"
      :class="i.status"
      tabindex="0"
      @click="$emit('open', i)"
      @keydown.enter.self="$emit('open', i)"
    >
      <div class="card-head">
        <h3 class="card-title">{{ i.company }}</h3>
        <button
          class="star"
          :class="{ on: i.is_favorite }"
          :aria-label="i.is_favorite ? t('fav.remove') : t('fav.add')"
          @click.stop="$emit('favorite', i)"
        >{{ i.is_favorite ? '★' : '☆' }}</button>
      </div>

      <p v-if="i.position" class="card-position">{{ i.position }}</p>
      <span class="badge" :class="i.status">{{ t(`status.${i.status}`) }}</span>

      <dl class="card-facts">
        <template v-if="place(i)">
          <dt>{{ t('field.city') }}</dt>
          <dd>{{ place(i) }}</dd>
        </template>
        <template v-if="home && distanceLabel(i)">
          <dt>{{ t('geo.away') }}</dt>
          <dd>{{ distanceLabel(i) }}</dd>
        </template>
        <template v-if="i.date">
          <dt>{{ t('field.date') }}</dt>
          <dd>{{ fmt(i.date) }}</dd>
        </template>
        <template v-if="i.contact_person">
          <dt>{{ t('field.contactPerson') }}</dt>
          <dd>{{ i.contact_person }}</dd>
        </template>
      </dl>
    </li>
  </ul>
</template>