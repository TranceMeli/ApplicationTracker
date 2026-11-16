<script setup>
import { computed, ref } from 'vue'
import { fmt } from '../constants'
import { t } from '../i18n'
import { WAITING_DAYS, buildToday } from '../today'
import Icon from './Icon.vue'

const props = defineProps({ items: Array, due: Array })
const emit = defineEmits(['open', 'show-due', 'show-waiting'])

const KEY = 'tracker.today'
const read = () => {
  try {
    return localStorage.getItem(KEY) !== 'hidden'
  } catch {
    return true
  }
}
const open = ref(read())
function toggle() {
  open.value = !open.value
  try {
    localStorage.setItem(KEY, open.value ? 'shown' : 'hidden')
  } catch {}
}

const SHOWN = 3
const lists = computed(() => buildToday(props.items, props.due))
const nothing = computed(() => !lists.value.due.length && !lists.value.interviews.length && !lists.value.waiting.length)
const dueText = (days) => (days === 0 ? t('today.dueToday') : t('today.dueSince', { n: days }))
const date = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
</script>

<template>
  <section v-if="items.length" class="today" :aria-label="t('today.title')">
    <div class="today-head">
      <h2>{{ t('today.title') }} <span class="sub">{{ date }}</span></h2>
      <button class="link" :aria-expanded="open" @click="toggle">{{ open ? t('today.hide') : t('today.show') }}</button>
    </div>

    <template v-if="open">
      <p v-if="nothing" class="today-done"><Icon name="offer" /> {{ t('today.nothing') }}</p>
      <div v-else class="today-cards">
        <div v-if="lists.due.length" class="today-card due">
          <h3><Icon name="interview" /> {{ t('today.due') }} · {{ lists.due.length }}</h3>
          <ul>
            <li v-for="d in lists.due.slice(0, SHOWN)" :key="d.id">
              <button class="link" @click="emit('open', d.id)">{{ d.company }}</button>
              <span>{{ dueText(d.days) }}</span>
            </li>
          </ul>
          <button @click="emit('show-due')">{{ t('today.showAll', { n: lists.due.length }) }}</button>
        </div>

        <div v-if="lists.interviews.length" class="today-card">
          <h3><Icon name="interview" /> {{ t('today.interviews') }} · {{ lists.interviews.length }}</h3>
          <ul>
            <li v-for="i in lists.interviews.slice(0, SHOWN)" :key="i.id">
              <button class="link" @click="emit('open', i.id)">{{ i.company }}</button>
              <span>{{ fmt(i.date) }}</span>
            </li>
          </ul>
        </div>

        <div v-if="lists.waiting.length" class="today-card">
          <h3><Icon name="applied" /> {{ t('today.waiting', { n: WAITING_DAYS }) }} · {{ lists.waiting.length }}</h3>
          <ul>
            <li v-for="w in lists.waiting.slice(0, SHOWN)" :key="w.id">
              <button class="link" @click="emit('open', w.id)">{{ w.company }}</button>
              <span>{{ t('today.days', { n: w.days }) }}</span>
            </li>
          </ul>
          <button @click="emit('show-waiting')">{{ t('today.showAll', { n: lists.waiting.length }) }}</button>
        </div>
      </div>
    </template>
  </section>
</template>
