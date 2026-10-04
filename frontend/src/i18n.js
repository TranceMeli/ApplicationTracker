import { ref } from 'vue'

const messages = {
  de: {
    'app.title': 'Bewerbungen',
    'app.new': 'Neue Bewerbung',
    'app.empty': 'Keine Bewerbungen gefunden. Lege mit „Neue Bewerbung“ die erste an.',
    'app.backendDown': 'Backend nicht erreichbar. Läuft "python manage.py runserver"?',
    'app.confirmDelete': '„{name}“ löschen?',
    'lang.label': 'Sprache',

    'filter.all': 'Alle',
    'filter.favorites': '★ Favoriten',
    'filter.search': 'Suchen',

    'status.planned': 'Geplant',
    'status.unsure': 'Unsicher',
    'status.applied': 'Beworben',
    'status.interview': 'Gespräch',
    'status.rejected': 'Absage',
    'status.offer': 'Zusage',

    'channel.email': 'E-Mail',
    'channel.portal': 'Portal',
    'channel.post': 'Post',
    'channel.phone': 'Telefon',
    'channel.personal': 'Persönlich',
    'workmode.onsite': 'Vor Ort',
    'workmode.hybrid': 'Hybrid',
    'workmode.remote': 'Remote',

    'table.nr': 'Nr.',

    'btn.edit': 'Bearbeiten',
    'btn.delete': 'Löschen',
    'btn.close': 'Schließen',
    'btn.cancel': 'Abbrechen',
    'btn.save': 'Speichern',
    'fav.add': 'Als Favorit markieren',
    'fav.remove': 'Favorit entfernen',

    'form.new': 'Neue Bewerbung',
    'form.edit': 'Bewerbung bearbeiten',
    'field.company': 'Unternehmen',
    'field.position': 'Stelle',
    'field.date': 'Datum',
    'field.status': 'Status',
    'field.contactPerson': 'Ansprechpartner',
    'field.email': 'E-Mail',
    'field.phone': 'Telefon',
    'field.followUp': 'Nachfassen am',
    'field.interviewDate': 'Gespräch am',
    'field.responseDate': 'Antwort erhalten am',
    'field.source': 'Gefunden über',
    'field.channel': 'Bewerbungsweg',
    'field.workMode': 'Arbeitsmodell',
    'field.salary': 'Gehalt',
    'field.link': 'Link zur Stelle',
    'field.street': 'Straße und Hausnummer',
    'field.postalCode': 'PLZ',
    'field.city': 'Ort',
    'field.rejectionReason': 'Absagegrund',
    'field.notes': 'Notizen',
    'field.favorite': 'Favorit',
    'field.favoriteMark': 'Als Favorit markieren',
    'field.address': 'Anschrift',

    'detail.noPosition': 'Keine Stelle angegeben',
    'detail.yes': 'Ja',

    'settings.fields': 'Felder',
    'settings.title': 'Felder auswählen',
    'settings.hint': 'Ausgeblendete Felder werden nur nicht angezeigt, ihre Daten bleiben gespeichert.',
    'settings.table': 'Tabellenspalten',
    'settings.form': 'Formular und Detailansicht',
    'settings.reset': 'Zurücksetzen',

    'attachment.title': 'Unterlagen',
    'attachment.none': 'Noch keine Unterlagen angehängt.',
    'attachment.add': 'Datei anhängen',
    'attachment.uploading': 'Wird hochgeladen …',
    'attachment.confirmDelete': '„{name}“ entfernen?',
    'attachment.error.file_type': 'Dateityp nicht erlaubt (erlaubt: PDF, Word, ODT, TXT, PNG, JPG).',
    'attachment.error.file_size': 'Datei ist zu groß (maximal 10 MB).',
    'kind.cover_letter': 'Anschreiben',
    'kind.cv': 'Lebenslauf',
    'kind.certificate': 'Zeugnis',
    'kind.other': 'Sonstiges',
  },
  en: {
    'app.title': 'Applications',
    'app.new': 'New application',
    'app.empty': 'No applications found. Create the first one with “New application”.',
    'app.backendDown': 'Backend unreachable. Is "python manage.py runserver" running?',
    'app.confirmDelete': 'Delete “{name}”?',
    'lang.label': 'Language',

    'filter.all': 'All',
    'filter.favorites': '★ Favorites',
    'filter.search': 'Search',

    'status.planned': 'Planned',
    'status.unsure': 'Unsure',
    'status.applied': 'Applied',
    'status.interview': 'Interview',
    'status.rejected': 'Rejected',
    'status.offer': 'Offer',

    'channel.email': 'Email',
    'channel.portal': 'Portal',
    'channel.post': 'Mail',
    'channel.phone': 'Phone',
    'channel.personal': 'In person',
    'workmode.onsite': 'On-site',
    'workmode.hybrid': 'Hybrid',
    'workmode.remote': 'Remote',

    'table.nr': 'No.',

    'btn.edit': 'Edit',
    'btn.delete': 'Delete',
    'btn.close': 'Close',
    'btn.cancel': 'Cancel',
    'btn.save': 'Save',
    'fav.add': 'Mark as favorite',
    'fav.remove': 'Remove favorite',

    'form.new': 'New application',
    'form.edit': 'Edit application',
    'field.company': 'Company',
    'field.position': 'Position',
    'field.date': 'Date',
    'field.status': 'Status',
    'field.contactPerson': 'Contact person',
    'field.email': 'Email',
    'field.phone': 'Phone',
    'field.followUp': 'Follow up on',
    'field.interviewDate': 'Interview on',
    'field.responseDate': 'Response received on',
    'field.source': 'Found via',
    'field.channel': 'Application channel',
    'field.workMode': 'Work model',
    'field.salary': 'Salary',
    'field.link': 'Job posting link',
    'field.street': 'Street and number',
    'field.postalCode': 'Postal code',
    'field.city': 'City',
    'field.rejectionReason': 'Rejection reason',
    'field.notes': 'Notes',
    'field.favorite': 'Favorite',
    'field.favoriteMark': 'Mark as favorite',
    'field.address': 'Address',

    'detail.noPosition': 'No position given',
    'detail.yes': 'Yes',

    'settings.fields': 'Fields',
    'settings.title': 'Choose fields',
    'settings.hint': 'Hidden fields are just not shown, their data stays saved.',
    'settings.table': 'Table columns',
    'settings.form': 'Form and detail view',
    'settings.reset': 'Reset',

    'attachment.title': 'Documents',
    'attachment.none': 'No documents attached yet.',
    'attachment.add': 'Attach file',
    'attachment.uploading': 'Uploading …',
    'attachment.confirmDelete': 'Remove “{name}”?',
    'attachment.error.file_type': 'File type not allowed (allowed: PDF, Word, ODT, TXT, PNG, JPG).',
    'attachment.error.file_size': 'File is too large (max. 10 MB).',
    'kind.cover_letter': 'Cover letter',
    'kind.cv': 'CV',
    'kind.certificate': 'Certificate',
    'kind.other': 'Other',
  },
}

export const LOCALES = Object.keys(messages)

const stored = localStorage.getItem('locale')
export const locale = ref(LOCALES.includes(stored) ? stored : 'de')
document.documentElement.lang = locale.value

export function setLocale(l) {
  locale.value = l
  localStorage.setItem('locale', l)
  document.documentElement.lang = l
}

// Reads locale.value, so every template that calls t() re-renders on language change.
export function t(key, params = {}) {
  const text = messages[locale.value][key] ?? messages.de[key] ?? key
  return text.replace(/\{(\w+)\}/g, (_, k) => params[k] ?? '')
}