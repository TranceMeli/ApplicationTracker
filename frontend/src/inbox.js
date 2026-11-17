// Logic of the inbox: which company and which kind of document a dropped file belongs to, and the name it gets.

export const ALLOWED = ['.pdf', '.doc', '.docx', '.odt', '.txt', '.png', '.jpg', '.jpeg']
export const MAX_SIZE = 10 * 1024 * 1024

const LEGAL_FORMS = new Set(['gmbh', 'ag', 'kg', 'se', 'ug', 'mbh', 'co', 'ohg', 'gbr', 'ltd', 'inc', 'llc', 'bv', 'sa', 'und', 'haftungsbeschraenkt'])

const fold = (text) =>
  (text || '')
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/\p{M}/gu, '')

const words = (text) => fold(text).split(/[^a-z0-9]+/).filter(Boolean)

// The name of a company without legal forms: "Müller GmbH & Co. KG" -> "mueller".
export const companyKey = (name) => words(name).filter((w) => !LEGAL_FORMS.has(w)).join('')

export const extensionOf = (filename) => {
  const dot = (filename || '').lastIndexOf('.')
  return dot > 0 ? filename.slice(dot).toLowerCase() : ''
}
export const baseName = (filename) => {
  const dot = (filename || '').lastIndexOf('.')
  return dot > 0 ? filename.slice(0, dot) : filename || ''
}

// Why a file cannot be stored, or '' when it can. The texts are keys of attachment.error.*.
export function checkFile(file) {
  if (!ALLOWED.includes(extensionOf(file.name))) return 'file_type'
  if (file.size > MAX_SIZE) return 'file_size'
  return ''
}

// The kind of document from words in the file name. Longer, more specific words come first.
const KIND_WORDS = [
  ['certificate', ['zeugnis', 'zertifikat', 'certificate', 'diplom', 'abschluss', 'urkunde']],
  ['complete', ['gesamt', 'komplett', 'bewerbungsmappe', 'mappe', 'complete', 'application']],
  ['cover_letter', ['anschreiben', 'motivationsschreiben', 'cover', 'letter', 'motivation']],
  ['cv', ['lebenslauf', 'resume', 'curriculum', 'cv']],
]

export function guessKind(filename) {
  const found = words(baseName(filename))
  const text = fold(baseName(filename))
  for (const [kind, hints] of KIND_WORDS) {
    if (hints.some((hint) => (hint.length > 3 ? text.includes(hint) : found.includes(hint)))) return kind
  }
  return 'other'
}

// The application a file belongs to, found by the company name in the file name. The longest name wins, so
// "Müller Logistik" is preferred to "Müller". Several applications of one company: the newest one (highest id).
export function guessCompany(filename, companies) {
  const text = fold(baseName(filename)).replace(/[^a-z0-9]+/g, '')
  let best = null
  for (const c of companies) {
    const key = companyKey(c.company)
    if (key.length < 3 || !text.includes(key)) continue
    if (!best || key.length > best.key.length || (key.length === best.key.length && c.id > best.id)) best = { ...c, key }
  }
  return best ? { id: best.id, company: best.company } : null
}

// The application for typed text: an existing company (newest first) or null when it has to be created.
export function findCompany(text, companies) {
  const key = companyKey(text)
  if (!key) return null
  let found = null
  for (const c of companies) if (companyKey(c.company) === key && (!found || c.id > found.id)) found = c
  return found
}

// Characters that file systems do not accept are removed, spaces become underscores.
const clean = (text) =>
  (text || '')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.]+|[_.]+$/g, '')

// "2026-11-17_Müller_GmbH_Anschreiben.pdf". Without a known kind the part for the kind says "Sonstiges".
export function buildName({ date, company, kindLabel, filename }) {
  const parts = [date, clean(company), clean(kindLabel)].filter(Boolean)
  return `${parts.join('_')}${extensionOf(filename)}`
}

// Equal names within one batch get " (2)", " (3)" ... before the extension. Names stay unique for the application too:
// the ones already attached are passed in as `taken`.
export function uniqueNames(names, taken = []) {
  const used = new Set(taken.map((n) => n.toLowerCase()))
  return names.map((name) => {
    let candidate = name
    let n = 2
    while (used.has(candidate.toLowerCase())) {
      candidate = `${baseName(name)} (${n})${extensionOf(name)}`
      n++
    }
    used.add(candidate.toLowerCase())
    return candidate
  })
}
