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

// The choice is 'system' (the default), 'light' or 'dark'. The theme is the one that is really shown.
export const themeChoice = ref(stored() ?? 'system')
export const theme = ref(themeChoice.value === 'system' ? system() : themeChoice.value)

const apply = (value) => { document.documentElement.dataset.theme = value }
apply(theme.value)

watch(themeChoice, (choice) => {
  try {
    if (choice === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    /* storage may be blocked, the choice then lasts for this session */
  }
  theme.value = choice === 'system' ? system() : choice
})
watch(theme, apply)

media?.addEventListener?.('change', () => {
  if (themeChoice.value === 'system') theme.value = system()
})

// The sun or moon button in the header switches between light and dark.
export const toggleTheme = () => { themeChoice.value = theme.value === 'dark' ? 'light' : 'dark' }
