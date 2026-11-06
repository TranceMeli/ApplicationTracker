import { ref, watch } from 'vue'

const KEY = 'tracker.theme'

function stored() {
  try {
    const value = localStorage.getItem(KEY)
    return value === 'dark' || value === 'light' ? value : null
  } catch {
    return null
  }
}

const media = window.matchMedia?.('(prefers-color-scheme: dark)')
const system = () => (media?.matches ? 'dark' : 'light')

// Follows the system setting until the switch in the header is used once.
export const theme = ref(stored() ?? system())

const apply = (value) => { document.documentElement.dataset.theme = value }
apply(theme.value)

watch(theme, (value) => {
  apply(value)
  try {
    localStorage.setItem(KEY, value)
  } catch {
    /* storage may be blocked, the choice then lasts for this session */
  }
})

media?.addEventListener?.('change', () => {
  if (!stored()) theme.value = system()
})

export const toggleTheme = () => { theme.value = theme.value === 'dark' ? 'light' : 'dark' }
