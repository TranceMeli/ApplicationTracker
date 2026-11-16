import { onMounted, onUnmounted, ref } from 'vue'

// Protects a dialog against closing by accident. isDirty() says whether there are unsaved entries, close() really
// closes. request() is for the Cancel button and the backdrop: with unsaved entries it asks first (asking = true).
// Escape does the same, and Escape while asked goes back to the form. Without unsaved entries Escape is left alone,
// so the app closes the dialog as before.
export function useUnsaved(isDirty, close) {
  const asking = ref(false)

  const request = () => (isDirty() ? (asking.value = true) : close())
  const keep = () => (asking.value = false)

  function onKey(e) {
    if (e.key !== 'Escape' || !isDirty()) return
    e.stopImmediatePropagation()
    e.preventDefault()
    asking.value = !asking.value
  }
  onMounted(() => window.addEventListener('keydown', onKey, true))
  onUnmounted(() => window.removeEventListener('keydown', onKey, true))

  return { asking, request, keep }
}
