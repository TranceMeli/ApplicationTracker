# API

The backend is a Django REST API under `/api/`. The root URL shows the built frontend when `frontend/dist` exists (`npm run build`), otherwise it redirects to the browsable overview of the API.

| Method | Endpoint | Description |
|---|---|---|
| GET, POST | `/api/applications/` | List (`?search=`, `?status=`, `?kind=` (`posting`, `initiative`, another stored type or `__none__` for no type), `?channel=`, `?work_mode=`, `?favorite=1`, `?ordering=`) and create |
| GET, PATCH, DELETE | `/api/applications/<id>/` | Read, update and delete one application; deleting moves it to the trash, it is purged with its files after 7 days (`?tag=` filters by tag) |
| GET | `/api/applications/stats/` | Number of applications per status and per type, the follow-ups that are due and the tags with their counts |
| GET | `/api/applications/companies/` | Id and name of every application |
| POST | `/api/applications/bulk/` | Several applications at once: `{"ids": [...], "action": "status" \| "kind" \| "delete" \| "restore", "status": "...", "kind": "..."}` |
| GET, POST | `/api/events/` | History entries (`?application=<id>`); POST adds a note (`application`, `text`, `date`) |
| DELETE | `/api/events/<id>/` | Remove a note (entries written by the app cannot be removed) |
| GET | `/api/backup/` | Zip with the database and the uploaded files |
| POST | `/api/applications/import/` | Preview or import a company list (multipart: `file`, optional `dry_run`, `default_status`, `mode`) |
| POST | `/api/applications/geocode/` | Geocode a batch of application addresses; send `{"retry":"1"}` to retry failed lookups |
| POST | `/api/geocode/` | Look up one address without saving it on the server |
| GET | `/api/logo/?domain=<domain>` | Icon of a company domain from the local cache or DuckDuckGo, 404 when there is none |
| GET, POST | `/api/attachments/` | List (`?application=<id>`) and upload a file (multipart: `application`, `file`, `kind`, optional `name`, which is kept instead of the file name) |
| PATCH | `/api/attachments/<id>/` | Rename an attachment (`name`, JSON; the file extension is kept) or change its `kind` |
| DELETE | `/api/attachments/<id>/` | Remove an attachment and its file |

Uploaded files are served under `/media/` while `DEBUG` is on. Files are removed from disk whenever their attachment is deleted, also through the admin or when the application is deleted.
Error responses carry codes (for example `file_type` or `no_company_column`) that the frontend translates.
Geocoding uses the external OpenStreetMap Nominatim service and must follow its usage policy. It is rate-limited and is not intended for high-volume geocoding.
Company logos are optional. The domain comes from the link of an application, or from its e-mail address unless it belongs to a free mail provider. The server asks DuckDuckGo for the icon of that domain (only the domain is sent, not the browser's address) and stores found icons in `backend/media/logos/`; companies without an icon are not asked again for a week.

## Notes

- The app has no authentication and is meant for local use. Uploaded documents are served without login. Session authentication is switched off for the API, so a login to the Django admin does not cause CSRF errors in the app. Add authentication and configure production settings (including `DEBUG`, `SECRET_KEY` and `ALLOWED_HOSTS`) before exposing it to a network.
- A backup consists of `backend/db.sqlite3` and the folder `backend/media/`. The Backup entry in the Data menu and `python manage.py backup` create a zip with both; `runserver` also creates one once a day in `backend/backups/`.
- The `.gitignore` excludes the virtual environment, `node_modules`, the build output, the SQLite database, the media folder, `.env` files and local editor and Claude Code settings, so personal data stays out of the repository.
