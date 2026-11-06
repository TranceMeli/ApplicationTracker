<script setup>
import { computed, ref } from 'vue'
import { OPEN_STATUSES, STATUS_KEYS, daysBetween, isDue, today } from '../constants'
import { t } from '../i18n'
import CompanyLogo from './CompanyLogo.vue'
import KindBadge from './KindBadge.vue'

const props = defineProps({ items: Array })
const emit = defineEmits(['open', 'status'])

const columns = computed(() =>
  STATUS_KEYS.map((key) => ({ key, items: props.items.filter((i) => i.status === key) })),
)

const dragOver = ref('')

function onDrop(event, status) {
  dragOver.value = ''
  const id = Number(event.dataTransfer.getData('text/plain'))
  const item = props.items.find((i) => i.id === id)
  if (item && item.status !== status) emit('status', item, status)
}

// "since 21 days" for applications that wait for an answer
const waiting = (i) => (OPEN_STATUSES.includes(i.status) && i.date ? daysBetween(i.date, today()) : null)
</script>

<template>
  <div class="board">
    <section
      v-for="col in columns"
      :key="col.key"
      class="board-col"
      :class="{ over: dragOver === col.key }"
      @dragover.prevent="dragOver = col.key"
      @dragleave="dragOver = ''"
      @drop.prevent="onDrop($event, col.key)"
    >
      <h3>
        <span><span class="swatch" :class="col.key" aria-hidden="true"></span>{{ t(`status.${col.key}`) }}</span>
        <span class="count">{{ col.items.length }}</span>
      </h3>
      <article
        v-for="i in col.items"
        :key="i.id"
        class="board-card"
        :class="i.status"
        draggable="true"
        tabindex="0"
        @dragstart="$event.dataTransfer.setData('text/plain', String(i.id))"
        @click="$emit('open', i)"
        @keydown.enter.self="$emit('open', i)"
      >
        <div class="company">
          <CompanyLogo :item="i" />
          <strong class="card-title">{{ i.company }}</strong>
        </div>
        <p v-if="i.position" class="card-position">{{ i.position }}</p>
        <KindBadge :item="i" />
        <p v-if="waiting(i) !== null" class="sub" :class="{ due: isDue(i) }">{{ t('stats.days', { n: waiting(i) }) }}</p>
        <select
          class="badge"
          :class="i.status"
          :value="i.status"
          :aria-label="t('field.status')"
          @click.stop
          @change="$emit('status', i, $event.target.value)"
        >
          <option v-for="key in STATUS_KEYS" :key="key" :value="key">{{ t(`status.${key}`) }}</option>
        </select>
      </article>
    </section>
  </div>
</template>
