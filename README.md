# Application Tracker

![Status](https://img.shields.io/badge/WORK%20IN%20PROGRESS-F4CE14?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)
![Django](https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=white)
![Vue.js](https://img.shields.io/badge/Vue.js-4FC08D?style=for-the-badge&logo=vuedotjs&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)

## Preview

<img width="auto" height="800" alt="Minimalistisches Bewerbungsdashboard mit Filtertabelle" src="https://github.com/user-attachments/assets/6098ac2c-ef52-42c6-9d00-a36b379ea283" />


A web app to keep track of job applications, from the first contact to the final answer. The backend is a Django REST API with a SQLite database, the frontend is a Vue 3 single-page app built with Vite.

This project is under active development. Features and the data model may still change.

A web app to keep track of job applications, from the first contact to the final answer. The backend is a Django REST API with a SQLite database, the frontend is a Vue 3 single-page app built with Vite.

## Features

- Track applications with company, position, contact person, dates, status, notes and more
- Status workflow: planned, unsure, applied, interview, rejected, offer
- Favorites with a star marker and a favorites filter
- Live search and status filter with counters
- Detail view in a modal dialog
- Highlighting of overdue follow-ups
- Configurable fields: choose which columns appear in the table and which fields appear in the form and detail view. Hidden fields are not deleted, their data stays stored and can be shown again at any time
- Extra fields: source, application channel, work model, salary, interview date, response date, rejection reason
- Document attachments per application (cover letter, CV, certificate, other)
- German and English interface with a language switch, the choice is remembered in the browser

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vue 3 (Composition API), Vite, plain CSS |
| Backend | Django, Django REST Framework, django-cors-headers |
| Database | SQLite |
| File storage | Local filesystem (`backend/media/`) |

## Dependencies

### Backend (Python)

Listed in `backend/requirements.txt`:

| Package | Version | Purpose |
|---|---|---|
| Django | >= 5.0 | Web framework, ORM, migrations, admin |
| djangorestframework | >= 3.15 | REST API (serializers, viewsets, routers) |
| django-cors-headers | >= 4.4 | Allows the Vite dev server to call the API |

Django pulls in `asgiref`, `sqlparse` and (on Windows) `tzdata` automatically. SQLite needs no separate installation, it ships with Python.

Install everything at once from the requirements file, or package by package when setting the project up from scratch:

```bash
pip install -r requirements.txt
# or
pip install django djangorestframework django-cors-headers
```

### Frontend (Node.js)

Listed in `frontend/package.json`:

| Package | Version | Type | Purpose |
|---|---|---|---|
| vue | ^3.5.0 | dependency | UI framework |
| vite | ^6.0.0 | dev dependency | Dev server and build tool |
| @vitejs/plugin-vue | ^5.2.0 | dev dependency | Vue single-file component support for Vite |

```bash
npm install
# or, when setting the project up from scratch
npm install vue
npm install -D vite @vitejs/plugin-vue
```

No router, state management library or HTTP client is used. Routing is not needed, state lives in `App.vue` and requests use the built-in `fetch`.

## Project Structure

```
application-tracker/
├── backend/
│   ├── manage.py
│   ├── requirements.txt
│   ├── config/                 Django project settings and root URLs
│   └── application/
│       ├── models.py           Application and Attachment models
│       ├── serializers.py      API serializers and upload validation
│       ├── views.py            ViewSets, filtering, statistics
│       ├── urls.py             API routes
│       └── admin.py
└── frontend/
    ├── package.json
    ├── vite.config.js          Dev server with proxy to the backend
    └── src/
        ├── main.js
        ├── App.vue             State and data loading
        ├── api.js              API client
        ├── constants.js        Status keys and date helpers
        ├── fields.js           Field catalog and visibility settings
        ├── i18n.js             German and English texts
        ├── style.css
        └── components/
            ├── FilterBar.vue
            ├── ApplicationTable.vue
            ├── ApplicationForm.vue
            ├── DetailModal.vue
            ├── FieldSettings.vue
            └── LanguageSwitch.vue
```

## Getting Started

### Prerequisites

- Python 3 (a recent version, 3.12 or newer recommended) with `pip` and `venv`
- Node.js 20 or newer with `npm`

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows
# source .venv/bin/activate       # macOS and Linux

pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

The API runs on http://localhost:8000. An admin user is optional and only needed for `/admin`:

```bash
python manage.py createsuperuser
```

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. The dev server proxies `/api` and `/media` to Django on port 8000, so both servers must be running.

## Usage

- **New application:** use the button in the header. Only the company is required.
- **Status:** change it directly in the table, or filter by it with the buttons above the table.
- **Favorites:** click the star in the table. The favorites button filters the list.
- **Details:** click a row to open the detail dialog. There you can also edit, delete and manage documents.
- **Fields:** the Fields button lets you choose the visible table columns and the visible form fields. The company and the status are always shown. The selection is stored in the browser.
- **Documents:** open an application, pick a type and attach files. Allowed types are PDF, Word, ODT, TXT, PNG and JPG, up to 10 MB per file.
- **Language:** switch between DE and EN in the header.

## API

| Method | Endpoint | Description |
|---|---|---|
| GET, POST | `/api/applications/` | List (`?search=`, `?status=`, `?favorite=1`) and create |
| GET, PATCH, DELETE | `/api/applications/<id>/` | Read, update and delete one application |
| GET | `/api/applications/stats/` | Number of applications per status |
| POST | `/api/attachments/` | Upload a file (multipart: `application`, `file`, `kind`) |
| DELETE | `/api/attachments/<id>/` | Remove an attachment and its file |

Uploaded files are served under `/media/` while `DEBUG` is on.

## Extending the App

To add a new field:

1. Add it to the `Application` model in `backend/application/models.py` and run `python manage.py makemigrations application` followed by `python manage.py migrate`.
2. Add an entry to the `FIELDS` list in `frontend/src/fields.js`.
3. Add its label to both languages in `frontend/src/i18n.js`.

The table, form, detail view and the field settings dialog pick it up automatically. A new language is added as another block in `i18n.js`.

## Notes

- The app has no authentication and is meant for local use. Uploaded documents are served without login. Add authentication before exposing it to a network.
- A backup consists of `backend/db.sqlite3` and the folder `backend/media/`.
- The `.gitignore` excludes the virtual environment, `node_modules`, the SQLite database and the media folder, so personal data stays out of the repository.
