<script setup>
import { computed } from 'vue'
import { SENT_STATUSES, STATUS_KEYS, daysBetween } from '../constants'
import { comboLabel, kindIndex, knownKinds } from '../kind'
import { t } from '../i18n'

const props = defineProps({ items: Array, due: Array })

const COLORS = { rejected: 'var(--danger)' }
const colorOf = (key) => COLORS[key] ?? `var(--${key})`

const sent = computed(() => props.items.filter((i) => SENT_STATUSES.includes(i.status)))
const answered = computed(() =>
  sent.value.filter((i) => ['interview', 'rejected', 'offer'].includes(i.status) || i.response_date),
)
const interviews = computed(() => sent.value.filter((i) => ['interview', 'offer'].includes(i.status) || i.interview_date))
const offers = computed(() => sent.value.filter((i) => i.status === 'offer'))

const rate = computed(() => (sent.value.length ? Math.round((answered.value.length / sent.value.length) * 100) : null))

const avgDays = computed(() => {
  const spans = props.items
    .filter((i) => i.date && i.response_date)
    .map((i) => daysBetween(i.date, i.response_date))
    .filter((n) => n >= 0)
  return spans.length ? Math.round(spans.reduce((a, b) => a + b, 0) / spans.length) : null
})

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const weekStart = (isoDate) => {
  const d = new Date(`${isoDate}T00:00:00`)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)) // weeks start on Monday
  return iso(d)
}

// Applications sent per week, the last eight weeks including the current one.
const weeks = computed(() => {
  const starts = []
  const d = new Date(`${weekStart(iso(new Date()))}T00:00:00`)
  for (let n = 0; n < 8; n++) {
    starts.unshift(iso(d))
    d.setDate(d.getDate() - 7)
  }
  const counts = Object.fromEntries(starts.map((s) => [s, 0]))
  for (const i of sent.value) if (i.date && weekStart(i.date) in counts) counts[weekStart(i.date)]++
  const max = Math.max(1, ...Object.values(counts))
  return starts.map((s) => ({ start: s, n: counts[s], height: Math.round((counts[s] / max) * 100) }))
})

const funnel = computed(() => {
  const base = Math.max(1, sent.value.length)
  return [
    ['sent', sent.value.length, 'var(--planned)'],
    ['answered', answered.value.length, 'var(--applied)'],
    ['interviews', interviews.value.length, 'var(--interview)'],
    ['offers', offers.value.length, 'var(--offer)'],
  ].map(([key, n, color]) => ({ key, n, color, width: Math.max(n ? 3 : 0, Math.round((n / base) * 100)) }))
})

const byStatus = computed(() => {
  const max = Math.max(1, ...STATUS_KEYS.map((k) => props.items.filter((i) => i.status === k).length))
  return STATUS_KEYS.map((key) => {
    const n = props.items.filter((i) => i.status === key).length
    return { key, n, width: Math.round((n / max) * 100) }
  })
})

// Planned and applied, each combined with every type in use (at least "Stelle" and "Initiativ").
const combos = computed(() => {
  const counts = {}
  for (const i of props.items) counts[i.kind] = (counts[i.kind] ?? 0) + 1
  const kinds = knownKinds(counts).map((k) => k.key)
  const list = ['planned', 'applied'].flatMap((status) =>
    kinds.map((kind) => ({
      key: `${status}-${kind}`,
      status,
      kind,
      n: props.items.filter((i) => i.status === status && (i.kind || '').toLowerCase() === kind.toLowerCase()).length,
    })),
  )
  const max = Math.max(1, ...list.map((c) => c.n))
  return list.map((c) => ({ ...c, label: comboLabel(c.status, c.kind), color: `var(--kt${kindIndex(c.kind)})`, width: Math.round((c.n / max) * 100) }))
})

const short = (isoDate) => isoDate.slice(8, 10) + '.' + isoDate.slice(5, 7) + '.'
</script>

<template>
  <section class="stats">
    <div class="tiles">
      <div class="tile"><strong>{{ items.length }}</strong><span>{{ t('stats.total') }}</span></div>
      <div class="tile"><strong>{{ rate === null ? t('stats.none') : `${rate} %` }}</strong><span>{{ t('stats.rate') }}</span></div>
      <div class="tile"><strong>{{ avgDays === null ? t('stats.none') : avgDays }}</strong><span>{{ t('stats.avgDays') }}</span></div>
      <div class="tile" :class="{ warn: due.length }"><strong>{{ due.length }}</strong><span>{{ t('stats.due') }}</span></div>
    </div>

    <p v-if="!sent.length" class="empty">{{ t('stats.noData') }}</p>
    <template v-else>
      <h2>{{ t('stats.weekly') }}</h2>
      <div class="week-chart" role="img" :aria-label="t('stats.weekly')">
        <div v-for="w in weeks" :key="w.start" class="week">
          <span class="week-n">{{ w.n }}</span>
          <div class="week-bar" :style="{ height: `${w.height}%` }" :class="{ zero: !w.n }"></div>
          <span class="week-label">{{ short(w.start) }}</span>
        </div>
      </div>

      <h2>{{ t('stats.funnel') }}</h2>
      <div class="funnel">
        <div v-for="f in funnel" :key="f.key" class="funnel-row">
          <span class="funnel-label">{{ t(`stats.${f.key}`) }}</span>
          <div class="funnel-track"><div class="funnel-bar" :style="{ width: `${f.width}%`, background: f.color }"></div></div>
          <strong>{{ f.n }}</strong>
        </div>
      </div>
    </template>

    <h2>{{ t('stats.byKind') }}</h2>
    <div class="funnel">
      <div v-for="c in combos" :key="c.key" class="funnel-row">
        <span class="funnel-label">{{ c.label }}</span>
        <div class="funnel-track"><div class="funnel-bar" :style="{ width: `${c.width}%`, background: c.color }"></div></div>
        <strong>{{ c.n }}</strong>
      </div>
    </div>

    <h2>{{ t('stats.byStatus') }}</h2>
    <div class="funnel">
      <div v-for="s in byStatus" :key="s.key" class="funnel-row">
        <span class="funnel-label">{{ t(`status.${s.key}`) }}</span>
        <div class="funnel-track"><div class="funnel-bar" :style="{ width: `${s.width}%`, background: colorOf(s.key) }"></div></div>
        <strong>{{ s.n }}</strong>
      </div>
    </div>
  </section>
</template>
