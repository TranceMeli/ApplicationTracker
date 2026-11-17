# Contributing

Thanks for wanting to help. Bug reports, ideas and pull requests are welcome in the [issue tracker](https://github.com/TranceMeli/ApplicationTracker/issues).

## Set up

Follow Installation and Quick start in the [README](README.md). For the tests you also need Microsoft Edge, or run `npx playwright install chromium` once and set `E2E_BROWSER=chromium`.

## Making a change

1. Create a branch from `main`.
2. Make the change. A new field or a new language is described in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).
3. Add or adjust tests. A bug fix starts with a test that fails; [TESTING.md](TESTING.md) shows where each kind of test goes.
4. Run all three test layers before you open a pull request:

   ```bash
   cd backend && python manage.py test
   cd frontend && npm test
   cd frontend && npm run test:e2e
   ```

5. Open a pull request that says what changed and why. GitHub Actions runs the same tests and has to be green.

## Conventions

- Every text in the interface exists in German and in English in `frontend/src/i18n.js`; a test fails when one language is missing.
- Status is never shown by color alone: use the colors, icons and text that already exist in `frontend/src/style.css` and `frontend/src/icons.js`.
- Personal data stays out of the repository: no database, no uploaded files, no `.env` files (they are in `.gitignore`).
- Commit messages start with a capital letter and describe the change in plain words.
