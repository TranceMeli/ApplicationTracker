# Development

How the project is built, and how to extend it. Running and testing are described in the [README](../README.md) and in [TESTING.md](../TESTING.md).

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3 (Composition API), Vite, Leaflet, plain CSS |
| Backend | Django, Django REST Framework, django-cors-headers |
| Database | SQLite |
| File storage | Local filesystem (`backend/media/`) |
| Import | openpyxl for Excel files, standard library for CSV, ODS and JSON |

## Dependencies

### Backend (Python)

Listed in `backend/requirements.txt`:

| Package | Version | Purpose |
|---|---|---|
| Django | >= 5.0 | Web framework, ORM, migrations, admin |
| djangorestframework | >= 3.15 | REST API (serializers, viewsets, routers) |
| django-cors-headers | >= 4.4 | Allows the Vite dev server to call the API |
| openpyxl | >= 3.1 | Reads Excel files (.xlsx, .xlsm) during import |

Django pulls in `asgiref`, `sqlparse` and (on Windows) `tzdata` automatically. SQLite needs no separate installation, it ships with Python. ODS files are read with the standard library, no extra package is needed.

```bash
pip install -r requirements.txt
# or
pip install django djangorestframework django-cors-headers openpyxl
```

### Frontend (Node.js)

Listed in `frontend/package.json`:

| Package | Version | Type | Purpose |
|---|---|---|---|
| vue | ^3.5.42 | dependency | UI framework |
| leaflet | ^1.9.4 | dependency | Interactive map |
| vite | ^8.3.0 | dev dependency | Dev server and build tool |
| @vitejs/plugin-vue | ^6.0.8 | dev dependency | Vue single-file component support for Vite |

```bash
npm install
# or, when setting the project up from scratch
npm install vue leaflet
npm install -D vite @vitejs/plugin-vue
```

No router, state management library or HTTP client is used. Routing is not needed, state lives in `App.vue` and requests use the built-in `fetch`.

## Project structure

```
application-tracker/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/                 Django project settings and root URLs
│   └── application/
│       ├── models.py           Application and Attachment models
│       ├── serializers.py      API serializers and upload validation
│       ├── views.py            ViewSets, filtering, statistics, import endpoint
│       ├── importer.py         File readers and company list import
│       ├── geocoding.py        Address lookup with OpenStreetMap Nominatim
│       ├── logos.py            Company icons from DuckDuckGo, cached in media/logos/
│       ├── backup.py           Zip backups of the database and the uploaded files
│       ├── launcher.py         Start program: data folder, database, free port, browser
│       ├── urls.py             API routes
│       ├── admin.py            Admin with attachments as inline
│       └── tests.py            API, attachment, import and statistics tests
└── frontend/
    ├── package.json
    ├── vite.config.js          Dev server with proxy to the backend
    └── src/
        ├── main.js
        ├── App.vue             Layout (header, footer), state and data loading
        ├── api.js              API client
        ├── constants.js        Status keys and date helpers
        ├── geo.js              Map state, geocoding and distance helpers
        ├── logo.js             Company domain, initials and logo setting
        ├── status.js           Status keys, open and sent statuses
        ├── theme.js            Light and dark theme
        ├── toast.js            Short messages with an undo action
        ├── calendar.js         iCalendar (.ics) export
        ├── confirm.js          Confirmation dialog instead of window.confirm
        ├── backdrop.js         Closes dialogs only on a real click on the backdrop
        ├── fields.js           Field catalog and visibility settings
        ├── icons.js            Line icons for the statuses and a few actions
        ├── exporter.js         CSV export and import template download
        ├── i18n.js             German and English texts
        ├── inbox.js            Company, kind and name proposed for dropped files
        ├── today.js            What the Today panel lists
        ├── validate.js         Checks of form fields
        ├── draft.js            Draft of the quick dialog in the browser
        ├── unsaved.js          Asks before unsaved entries are thrown away
        ├── style.css           Color palette (CSS variables) and layout
        └── components/
            ├── FilterBar.vue
            ├── ApplicationTable.vue
            ├── ApplicationForm.vue
            ├── FormField.vue
            ├── DetailModal.vue
            ├── DocumentViewer.vue
            ├── Icon.vue
            ├── SankeyChart.vue
            ├── FieldSettings.vue
            ├── ImportDialog.vue
            ├── InboxDialog.vue
            ├── QuickAddDialog.vue
            ├── TodayPanel.vue
            ├── DiscardGuard.vue
            ├── LanguageSwitch.vue
            ├── CompanyCards.vue
            ├── CompanyLogo.vue
            ├── ApplicationBoard.vue
            ├── StatsPage.vue
            ├── BulkBar.vue
            ├── ToastBar.vue
            ├── ConfirmDialog.vue
            ├── CompanyMap.vue
            └── GeoBar.vue
```

## Extending the app

To add a new field:

1. Add it to the `Application` model in `backend/application/models.py` and run `python manage.py makemigrations application` followed by `python manage.py migrate`.
2. Add an entry to the `FIELDS` list in `frontend/src/fields.js`.
3. Add its label to both languages in `frontend/src/i18n.js`.
4. Optionally add column aliases to `FIELD_ALIASES` in `backend/application/importer.py` so the field is recognized during import.

The table, form, detail view, field settings dialog and the CSV export pick it up automatically. A new language is added as another block in `i18n.js`.
