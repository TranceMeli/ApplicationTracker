# Testing

The tracker has three layers of automated tests. Each layer catches a different kind of mistake, so they complement each other instead of repeating each other.

| Layer | Tool | Where | Tests | Runs against | Takes |
|---|---|---|---|---|---|
| Backend | Django `TestCase` | `backend/application/tests.py` | 38 | the API with a temporary test database | a few seconds |
| Frontend logic | Vitest + jsdom | `frontend/tests/` | 41 | single functions, no browser | about 5 seconds |
| Browser (end to end) | Playwright + Microsoft Edge | `frontend/e2e/` | 34 | the real app with its own backend and database | about 1 minute |

## Quick start

```bash
# Backend (from the project root)
cd backend
python manage.py test

# Frontend logic
cd frontend
npm test

# Browser tests
cd frontend
npm run test:e2e
```

Requirements: the Python packages from `backend/requirements.txt`, `npm install` in `frontend/`, and Microsoft Edge for the browser tests (it is part of Windows). To use the bundled Chromium instead, run `npx playwright install chromium` once and start the tests with `E2E_BROWSER=chromium`.

Useful variations:

```bash
python manage.py test application.tests.KindTests      # one backend test class
npx vitest                                             # frontend logic in watch mode, reruns on every save
npx vitest run tests/calendar.test.js                  # one frontend file
npx playwright test e2e/documents.spec.js              # one browser file
npx playwright test -g "viewer"                        # browser tests whose name contains "viewer"
npx playwright test --headed                           # watch the browser while the tests run
npx playwright test --ui                               # interactive runner with time travel
```

If a browser test fails, Playwright keeps a screenshot and a trace in `frontend/test-results/`. Open the trace with `npx playwright show-trace <path>/trace.zip` to step through the test and see what the page looked like at every action.

## Your real data is safe

The browser tests never touch your own applications:

- They start their own backend on port **8021** and their own frontend on port **5190**, so a running tracker on 8000/8001 and 5173 does not interfere.
- The backend gets `TRACKER_DATA_DIR`, which points to a new folder in the temporary directory. The database, the uploads and the backups of the tests all live there. `backend/config/settings.py` reads this variable, without it the real folders are used.
- Every browser test starts by emptying that test database.

The Django tests use Django's own temporary test database and a temporary media folder.

## Backend tests

`backend/application/tests.py` calls the REST API the way the frontend does and checks the responses and what ends up in the database. Uploaded files and outgoing network requests (logo lookup) are replaced or placed in temporary folders.

| Test class | What it protects |
|---|---|
| `AttachmentApiTests` | Upload of documents including the type "complete application", validation of file type and size, renaming a document (the file extension stays, bad names are rejected), attachments are part of the application response. |
| `ApplicationApiTests` | Search also finds the contact person, ordering by a relation is ignored (no leaking of other tables), files are removed with an application that is purged from the trash, the admin session works without a CSRF token. |
| `ImportTests` | Duplicates are skipped without warnings, a dry run saves nothing, an update changes existing rows and resets stale coordinates. |
| `LogoApiTests` | Invalid domains are rejected without a request, an icon is fetched once and then served from disk, a missing icon is remembered, an unreachable service is not remembered (so it is tried again later). |
| `TrashAndBulkTests` | Delete moves to the trash and restore brings it back, entries older than seven days are removed for good, bulk status change and bulk delete, bad bulk input is rejected, an import does not touch companies in the trash. |
| `HistoryTests` | Creation and status changes are logged automatically, notes can be added and removed but system entries cannot, an import writes creation entries. |
| `TagAndDueTests` | Tags are cleaned, filtered and counted, due follow-ups show up in the statistics, the company list. |
| `BackupTests` | The backup zip contains the database and the uploads. |
| `KindTests` | The type is empty by default, filters combine with the status, entries without a type can be listed, the built-in names (Stelle, Initiativ, Vermittler and their English or alternative spellings such as Recruiter) become their keys, custom types filter independent of case, a too long type is rejected, the bulk type change, the import reads the type column and the old status word, the statistics count the types. |
| `UpdatedAtTests` | The change date follows every save and cannot be set by hand, also for bulk changes. |

## Frontend logic tests

These tests call plain functions from `frontend/src/` and compare the result with the expected value. jsdom provides `localStorage` and `document`, so no real browser is needed. The Vue components themselves are covered by the browser tests.

| File | What it protects |
|---|---|
| `kind.test.js` | Type names and their translation, the fixed colours of the built-in types and the stable colour of every other type (independent of case), the list of known types with counts. |
| `fields.test.js` | Field settings: defaults, broken or old stored settings, locked fields stay visible, fields added in a later version are switched on once, a damaged layout is repaired, moving fields and sections, own sections can be added, renamed and removed (built-in sections cannot), reset. The module is loaded fresh for each test because it reads the browser storage at import time. |
| `calendar.test.js` | The `.ics` export: follow-ups only while an answer is awaited, interviews always, escaping of special characters, month and year change, lines of at most 75 bytes even with umlauts. |
| `exporter.test.js` | The CSV export: header, translation of status and type, quoting of semicolons, quotes and line breaks, favourites. |
| `logo.test.js` | Which domain is used for the logo (link or e-mail, but not job boards or free mail providers), the company name guessed from a link including applicant portals, initials, adding `https://`. |
| `geo.test.js` | Straight-line distance, the "ca." label for an approximate location, the home address stays in the browser, an unknown or broken stored view falls back to the list. |
| `constants.test.js` | Today's local date, days between two dates also across the change to summer time, date format per language, when a follow-up is due. Time is faked, so the tests give the same result every day. |
| `i18n.test.js` | Placeholders, fallback to the key, switching the language. One test compares German and English in the source and fails when a text exists in only one language. |

## Browser tests

The tests in `frontend/e2e/` open the real app in Edge and click through it like a person. Test data is created directly through the API (`api.create(...)` in `e2e/helpers.js`), the result of an action is then checked both on the page and, where it matters, by asking the API what was saved.

Every test starts with an empty database, German, the light theme and the list view. A test also **fails when the browser console shows an error**, even if the page looks fine.

| File | What it covers |
|---|---|
| `list.spec.js` | Search and "reset filters", the empty state, sorting in three steps, the quick add dialog with duplicate warning and the type "Vermittler", changing status and type in the detail dialog, the history with notes and the empty note error, deleting with confirmation and undo, bulk status change, the banner for due follow-ups and its filter. |
| `documents.spec.js` | Attaching a file with the chosen type, rejecting a file type that is not allowed, the viewer (PDF, text, Word without preview), switching with the arrow keys, Escape closing first the viewer and then the detail view, renaming with the extension kept and cancelling with Escape, pasting a screenshot with Ctrl+V from any tab, dropping a file on the detail view, copying an image as an image and a PDF as its address, deleting a document. |
| `stats.spec.js` | The top tile counts only applications that were really sent, the response rate and the days until the answer (from the response date and, as a fallback, from the logged status change), the Sankey diagram uses only sent applications, the type counts including "Vermittler". |
| `data.spec.js` | CSV export (with the byte order mark Excel needs), the calendar file, the backup zip, a CSV import that skips duplicates, hiding a table column in the field settings. |
| `views.spec.js` | The board (drag and drop and the status select as the keyboard alternative), the remembered view, dark mode that survives a reload, switching to English, phone width without horizontal scrolling and with the floating add button, opening the detail view from the card view. |

### How the browser tests are built

- `playwright.config.js` starts both servers, sets the browser, the viewport and the German locale, and runs the tests one after another (`workers: 1`) because they share one database.
- `e2e/helpers.js` has the `api` helper (create, change, list, upload, clear), the shared `test` that resets the app state and watches the console, and a few small helpers such as `rowOf(page, 'Company')`.
- `e2e/fixtures/sample.pdf` is a minimal valid PDF. Other files (a PNG, a Word stand-in, CSV text) are created inside the tests, so no further binary files are needed.
- The texts the tests look for are the German interface texts. When you rename a label in `frontend/src/i18n.js`, the matching test has to be updated.

## Writing new tests

- **A new backend rule or endpoint:** add a method to a fitting class in `tests.py` (or a new `TestCase`). Name it after the behaviour, for example `test_bulk_kind_change_sets_and_clears`.
- **A new helper function in `frontend/src`:** add `frontend/tests/<name>.test.js` and import the function directly. If the module reads the browser storage when it loads, import it fresh as `fields.test.js` does (`vi.resetModules()` and a dynamic `import`).
- **A new screen or interaction:** add a test to the matching `e2e/*.spec.js`, create the data with `api.create`, and prefer roles and visible texts (`getByRole`, `getByText`) over CSS classes. Use `expect.poll(...)` against the API when something is saved in the background.
- **A bug fix:** write the test first, see it fail, then fix. The `.ics` line folding is an example: the test with 200 umlauts failed, and the fix in `calendar.js` made it pass.

## What is not covered

- Other browsers than Chromium (Edge) and other operating systems.
- Dragging a document out of the app into an e-mail or onto the desktop. The browser starts that drag outside of the page, which tests cannot follow.
- The map view (it needs the online map tiles and the address lookup) and the real logo service.
- Visual details such as exact colours and spacing. The colour contrast was checked once by hand and with a script during the redesign, but it is not part of the test suite.
