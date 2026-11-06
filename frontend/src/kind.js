import { t } from './i18n'
import { BUILTIN_KINDS } from './status'

// The type of an application is free text. "posting" (Stelle) and "initiative" (Initiativ) are built in and
// translated, every other type is shown as it was typed.
export const isBuiltin = (kind) => BUILTIN_KINDS.includes(kind)
export const kindName = (kind) => (isBuiltin(kind) ? t(`apptype.${kind}`) : kind || '')
export const kindLabel = (item) => kindName(item.kind)

// For example "Geplant - Initiativ" or "Beworben - Stelle".
export const comboLabel = (status, kind) => `${t(`status.${status}`)} - ${kindName(kind)}`

// Six colors: rose for "Stelle", teal for "Initiativ", the other four are picked from the name of any other type,
// so a type always has the same color.
const COLORS = 6
const hash = (text) => [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

export function kindIndex(kind) {
  if (kind === 'posting') return 0
  if (kind === 'initiative') return 1
  return 2 + (hash((kind || '').toLowerCase()) % (COLORS - 2))
}

export const kindClass = (kind) => (kind ? `kt-${kindIndex(kind)}` : '')

// The types in use with their counts: the built-in ones first (also when unused), then the others alphabetically.
// Types that only differ in upper or lower case count as one.
export function knownKinds(byKind = {}) {
  const merged = new Map(BUILTIN_KINDS.map((key) => [key, { key, n: 0 }]))
  for (const [key, n] of Object.entries(byKind)) {
    if (!key) continue
    const id = isBuiltin(key) ? key : key.toLowerCase()
    const entry = merged.get(id) ?? { key, n: 0 }
    entry.n += n
    merged.set(id, entry)
  }
  const builtin = BUILTIN_KINDS.map((key) => merged.get(key))
  const custom = [...merged.values()].filter((entry) => !isBuiltin(entry.key))
  return [...builtin, ...custom.sort((a, b) => a.key.localeCompare(b.key))]
}
