# Dental Clinic Backend

Express and MySQL backend for Klinik Pergigian Rosni Adam.

## Setup

1. Copy `.env.example` to `.env` and replace all placeholder secrets.
2. Create the database by running `database/schema.sql` in MySQL 8+.
3. Install packages with `npm install`.
4. Start development mode with `npm run dev`.

## Health check

`GET /api/health` reports API and MySQL availability. It returns HTTP 503 when the database cannot be reached without exposing database credentials or internal error details.

## Integration tests

Integration tests must use a disposable MySQL database whose name ends in `_test`.

1. Copy `.env.test.example` to `.env.test` and provide test-only credentials and secrets locally. Never commit `.env.test`.
2. Run `npm run test:db:prepare` to reset the test database, apply the existing schema and migrations, and add the minimum shared test prerequisites.
3. Run `npm test` to execute the complete integration suite serially.

Both database preparation and test execution abort unless `NODE_ENV=test` and `DB_NAME` ends in `_test`. The preparation command intentionally destroys and recreates only that validated test database; it must never be pointed at development, shared, or production data.

Authentication and domain APIs will be added in later phases. Never commit `.env` or plaintext passwords.
