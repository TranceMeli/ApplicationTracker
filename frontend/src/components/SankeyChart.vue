<script setup>
import { computed } from 'vue'

// A Sankey diagram drawn as plain SVG. Columns of nodes from left to right, links as ribbons whose width is the count.
// columns: [[{ id, label, value, color }]], links: [{ from, to, value }]
const props = defineProps({ columns: Array, links: Array, label: String })

const W = 1100
const H = 320
const NODE_W = 14
const GAP = 16
const LABEL_W = 150
const MAX_UNIT = 44 // one application is never drawn taller than this, so a tiny list does not become a block

const layout = computed(() => {
  const cols = props.columns.map((nodes) => nodes.filter((n) => n.value > 0))
  const scale = Math.min(
    MAX_UNIT,
    ...cols.filter((c) => c.length).map((c) => (H - GAP * (c.length - 1)) / c.reduce((sum, n) => sum + n.value, 0)),
  )
  const step = cols.length > 1 ? (W - LABEL_W * 2 - NODE_W) / (cols.length - 1) : 0
  const nodes = new Map()
  cols.forEach((col, ci) => {
    const height = col.reduce((sum, n) => sum + n.value * scale, 0) + GAP * (col.length - 1)
    let y = (H - height) / 2
    for (const n of col) {
      nodes.set(n.id, { ...n, col: ci, x: LABEL_W + ci * step, y, h: n.value * scale, out: 0, in: 0 })
      y += n.value * scale + GAP
    }
  })

  // Ribbons leave and arrive in the vertical order of the nodes they connect, so they do not cross needlessly.
  const order = (id) => nodes.get(id).y
  const links = props.links
    .filter((l) => l.value > 0 && nodes.has(l.from) && nodes.has(l.to))
    .sort((a, b) => order(a.from) - order(b.from) || order(a.to) - order(b.to))
  const ribbons = []
  for (const l of links) {
    const from = nodes.get(l.from)
    const to = nodes.get(l.to)
    const w = l.value * scale
    const y0 = from.y + from.out + w / 2
    const y1 = to.y + to.in + w / 2
    from.out += w
    to.in += w
    const x0 = from.x + NODE_W
    const x1 = to.x
    const mid = (x0 + x1) / 2
    ribbons.push({ key: `${l.from}-${l.to}`, d: `M${x0},${y0} C${mid},${y0} ${mid},${y1} ${x1},${y1}`, w, color: to.color, from: from.label, to: to.label, value: l.value })
  }
  // The first column is named on its left, all others on their right.
  return { nodes: [...nodes.values()].map((n) => ({ ...n, labelLeft: n.col === 0 && cols.length > 1 })), ribbons }
})
</script>

<template>
  <div class="sankey-scroll">
    <svg class="sankey" :viewBox="`0 0 ${W} ${H}`" role="img" :aria-label="label">
      <path v-for="r in layout.ribbons" :key="r.key" class="ribbon" :d="r.d" :style="{ stroke: r.color }" :stroke-width="r.w">
        <title>{{ r.from }} → {{ r.to }}: {{ r.value }}</title>
      </path>
      <g v-for="n in layout.nodes" :key="n.id">
        <rect :x="n.x" :y="n.y" :width="NODE_W" :height="n.h" :style="{ fill: n.color }" />
        <text
          :x="n.labelLeft ? n.x - 8 : n.x + NODE_W + 8"
          :y="n.y + n.h / 2"
          :text-anchor="n.labelLeft ? 'end' : 'start'"
          dominant-baseline="middle"
        >
          <tspan class="sankey-name">{{ n.label }}</tspan><tspan class="sankey-n" dx="6">{{ n.value }}</tspan>
        </text>
      </g>
    </svg>
    <ul class="sr-only">
      <li v-for="r in layout.ribbons" :key="r.key">{{ r.from }} → {{ r.to }}: {{ r.value }}</li>
    </ul>
  </div>
</template>
