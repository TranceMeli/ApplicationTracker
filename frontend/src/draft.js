// The unsent entries of the quick dialog are kept in this browser, so a closed tab or an accidental click on the
// backdrop does not lose them.
const KEY = 'tracker.draft'

export function loadDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(KEY))
    return draft && typeof draft === 'object' ? draft : null
  } catch {
    return null
  }
}

export function saveDraft(draft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft))
  } catch {
    /* storage may be blocked, the draft then only lives as long as the dialog */
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(KEY)
  } catch {}
}
