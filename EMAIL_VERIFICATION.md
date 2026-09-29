# Email verification implementation and deployment guide

## Changes

Patient registration now creates an unverified account and sends a single-use verification link through the existing Nodemailer/SMTP service. Login, refresh and authenticated API middleware reject unverified Patients. Doctor and Admin authentication and the existing JWT/HttpOnly-cookie configuration are preserved.

Email changes through My Profile keep the current address active. A new address is encrypted while pending and becomes active only after successful verification. The previous address receives a notification after the transaction commits. Admin identity edits cannot bypass patient email verification; other role permissions, including review-only Admin clinical access, are preserved.

Tokens contain 32 cryptographically random bytes, are stored only as SHA-256 hashes, expire after 30 minutes by default, and are consumed under transaction locks. Resends revoke earlier unused tokens. A persistent per-account cooldown supplements IP rate limits. Links use a URL fragment so the token is not sent in the frontend HTTP URL; the page removes it from browser history and submits it in the API request body. Tokens never enter browser storage, API responses, or audit metadata.

## Database migration

Apply `backend/database/migrations/017_email_verification.sql` using the existing migration runner. It adds:

- `users.email_verified_at`, nullable and initially NULL.
- `email_verification_tokens`: user foreign key, unique binary-collated token hash, registration/email-change purpose, encrypted target address, expiry, used/revoked timestamps, creation time, and user/time and expiry indexes. User deletion cascades only to this new table.

**Existing patients also start unverified.** No existing email ownership is assumed. Existing Patient access/refresh tokens stop granting protected access until verification. Patients can use their password to reach the verification-required login message and request a link. Staff logins do not require this flag. Walk-in patients without portal credentials remain without portal access. No unrelated database tables are changed. The production/development database has not been migrated during this task.

## Configuration

New optional backend variables (defaults shown):

```dotenv
EMAIL_VERIFICATION_TTL_MINUTES=30
EMAIL_VERIFICATION_COOLDOWN_SECONDS=60
```

TTL accepts 5–60 minutes; cooldown accepts 60–3600 seconds. Keep the existing `FRONTEND_ORIGIN`, `EMAIL_ENABLED=true`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `CLINIC_EMAIL_ADDRESS`, and `CLINIC_EMAIL_APP_PASSWORD` configured. Preserve encryption keys and JWT secrets. No new secret is required.

Production must use the correct HTTPS frontend origin and serve the React app for `/verify-email`. The email transport is disabled when `EMAIL_ENABLED=false`; accounts remain pending, and delivery failures are audited. SMTP failure does not roll back account creation or an already-verified email change. Users can retry delivery through resend after the cooldown.

## API

All bodies are JSON. Existing validation returns 422 for malformed fields.

| Method and path | Authentication | Body / result |
| --- | --- | --- |
| `POST /api/auth/verify-email` | Public; bearer link proves address control | `{ "token": "<43-character token>" }`; 200 on success; 400 invalid/revoked or expired; 409 already consumed or destination now occupied |
| `POST /api/auth/resend-verification` | Public | `{ "email": "patient@example.com" }`; same 200 response for unknown, verified, inactive, staff and cooldown-suppressed requests; IP abuse returns 429 |
| `POST /api/auth/change-email` | Patient access JWT | `{ "email": "new@example.com" }`; 200 pending; 409 duplicate; 429 cooldown |
| `PATCH /api/patient/profile` (existing) | Patient access JWT | Existing profile payload including optional `email`; now initiates verification instead of replacing the address |
| `GET /api/patient/profile` (existing) | Patient access JWT | Includes `pendingEmail` while a live email-change token exists |

Resend/change-email endpoints share a five-request/15-minute IP limiter; verification allows 20 attempts/15 minutes. The existing profile endpoint also enforces the persistent account cooldown and the application's global limiter. Frontend-supplied patient/user IDs never select the owner of an email-change operation.

Audit events include `EMAIL_VERIFICATION_REQUESTED`, `EMAIL_VERIFICATION_SENT`, `EMAIL_VERIFICATION_RESENT`, `EMAIL_VERIFIED`, `EMAIL_VERIFICATION_FAILED`, `EMAIL_VERIFICATION_DELIVERY_FAILED`, `EMAIL_CHANGE_REQUESTED`, `EMAIL_CHANGE_VERIFIED`, and notification sent/failed outcomes. No email address or raw token is included in their metadata.

## Registration flow

1. Existing registration validation, password hashing and encrypted patient storage run normally.
2. The account and hashed verification token are created in one transaction. No access token or refresh cookie is issued.
3. After commit, the existing SMTP transport emails the frontend verification link. Registration displays a check-email notice and resend form.
4. Opening the link calls the verification API. It hashes the submitted token, locks the account/token, and checks role, account status, revocation, previous use, expiry and target address.
5. A successful transaction sets `email_verified_at`, marks the token used, revokes other unused tokens and records the audit event. The page displays success; the patient can log in normally.
6. Invalid, expired and already-consumed links show distinct results. Resending after cooldown issues a new link and revokes the old one. Used links report already verified without authenticating anyone or repeating the mutation.

## Email-change flow

1. A verified Patient edits their email in My Profile, or calls the change-email endpoint with their JWT.
2. Validation and a duplicate-email check run. The target address is encrypted using the existing AES-GCM service and stored with a hashed, expiring token.
3. The old email remains the login email. The profile displays the pending destination and a resend button. Resending creates a replacement token for the pending address.
4. Opening the link checks token state and rechecks email uniqueness. Only then does one transaction replace the email, mark it verified, consume the token and audit the change. The unique users.email constraint also protects against races.
5. The former email receives a change notification. The new email works for login; the old email no longer works. Existing JWT identity and refresh-cookie behavior are unchanged.
6. Failed, expired, revoked or reused links cannot change the address. An expired pending request disappears from the profile; submitting the new address again requests a fresh link.

## Automated verification

Tests ran against an isolated local MySQL 8.0.41 database with SMTP disabled or injected test transports. No real email was sent and no existing application database was modified.

- Backend: 108 tests pass across 16 test files, including the verification suite and authentication/profile/isolation/clinical regressions.
- Frontend: 37 tests pass, including result-page rendering, Strict Mode request deduplication, and session-isolation regressions.
- Frontend ESLint: passes.
- Frontend production build: passes; Vite retains its large-chunk advisory.
- Browser visual testing: unavailable because no browser is connected. Real SMTP inbox delivery remains a manual deployment check.

The existing backend command combined all files without isolation, which merged their setup/cleanup hooks and closed the database pool prematurely. The runner now launches each file separately and waits for its tests to finish. Existing test fixtures explicitly represent verified patients. A clinical test fixture also needed its required registration date supplied.

Reproduce on your dedicated test database:

```powershell
cd backend
# ONLY against the disposable _test database configured in .env.test:
npm.cmd run test:db:prepare
npm.cmd test
cd ../frontend
node --test --experimental-test-isolation=none test/*.test.js
npm.cmd run lint
npm.cmd run build
```

`test:db:prepare` recreates the configured disposable test database. Do not point it at application data. The test guard requires NODE_ENV=test and a database name ending in `_test`.

## Manual frontend testing

1. Configure working SMTP and your frontend origin. From `backend`, run `npm.cmd run migrate`, then start the backend and frontend using their existing start/dev commands.
2. Register a unique Patient with a mailbox you control. Confirm the registration notice. Attempt login before clicking the email: expect verification required and no protected patient access.
3. Immediately request a resend: the generic notice should appear, with no additional email during cooldown. Wait at least the configured cooldown, resend, then open the older link: it must be invalid. Open the latest link: expect success.
4. Open that successful link again: expect already verified. Log in normally; check appointments, profile and logout. Log in again and reload to test refresh restoration.
5. Wait out the cooldown, edit My Profile to a second mailbox you control, and save. Confirm the old address remains displayed as current and the new address is pending. Reload the profile to confirm this persists. Before verification, the old address must still work for login.
6. Open the new mailbox's link. Confirm success and the notification to the old mailbox. Reload the profile; the new address is current. Sign out and test both addresses: only the new one logs in.
7. Request a change to another account's email: expect a duplicate error. Request another fresh change, resend after cooldown, and verify that only its latest link works.
8. For expiry, wait the configured TTL (use 5 minutes in a test environment), then open an unused link. Expect an expired result and no email change. Request a new link and recover normally.
9. Open `/verify-email` with no fragment and with a malformed token fragment: expect an invalid-link page. Test the result page and login/profile notices in light/dark mode and narrow/mobile layouts.
10. Log in as Doctor and Admin. Verify their existing access; Admin must still be unable to mutate clinical records. Use two separate patient accounts to confirm each still sees only its own data. Run the existing Forgot Password flow, reset, login, refresh, logout and logout-all.

## Manual Postman testing

Set `baseUrl` to your backend origin, `accessToken` to a logged-in patient's access token, and keep Postman's cookie jar enabled for refresh/logout. Use mailboxes you control instead of the placeholders below.

1. `POST {{baseUrl}}/api/auth/register/patient` with Content-Type application/json:

```json
{
  "fullName": "Verification Test Patient",
  "email": "YOUR_FIRST_MAILBOX",
  "password": "TestPassword9",
  "identityNumber": "UNIQUE-TEST-IDENTITY",
  "dateOfBirth": "1995-04-16",
  "gender": "Female",
  "phone": "+60123456789",
  "address": "Test address for verification"
}
```

2. `POST /api/auth/login` with `{"email":"YOUR_FIRST_MAILBOX","password":"TestPassword9"}`: expect 403 `EMAIL_VERIFICATION_REQUIRED`, no access token and no new refresh cookie.
3. `POST /api/auth/resend-verification` with `{"email":"YOUR_FIRST_MAILBOX"}`. Compare the response with an unknown address. They should match. Five requests per 15 minutes are allowed before the IP limiter rejects further requests.
4. Copy the value after `#token=` from the latest email. `POST /api/auth/verify-email` with `{"token":"COPIED_TOKEN"}`: expect 200. Repeating it returns 409 `ALREADY_VERIFIED`. An unknown, well-formed 43-character token returns 400.
5. Log in again, save the access token, and `GET /api/patient/profile` using `Authorization: Bearer {{accessToken}}`: expect 200.
6. After cooldown, `POST /api/auth/change-email` with that Authorization header and `{"email":"YOUR_SECOND_MAILBOX","patient_id":"ANOTHER_PATIENT_ID"}`. The supplied ID is ignored: only the JWT owner's pending request changes. GET the profile to confirm current email is unchanged and pendingEmail is the second address.
7. Submit the new email's token to `/api/auth/verify-email`. GET the profile to confirm the new email. Test login using new/old addresses. Reuse the token to confirm rejection.
8. `POST /api/auth/refresh` using the cookie jar: expect a rotated cookie/access token. `POST /api/auth/logout`, then refresh again: expect rejection. For logout-all, send the access JWT to `/api/auth/logout-all` and verify refresh fails for all saved sessions.

## Deployment checklist

Back up the database, apply migration 017 before deploying the new backend, configure and test SMTP/HTTPS origin, and deploy the frontend with SPA routing for `/verify-email`. Inform existing patients that they must verify before their next portal access. Keep SMTP-failure audit monitoring enabled; successful API registration does not guarantee mailbox delivery. Retain the existing encryption keys so pending destinations remain decryptable. Do not bulk-mark existing production patients verified without independent ownership evidence.

## Files created or modified for this feature

Created:

- `EMAIL_VERIFICATION.md`
- `backend/database/migrations/017_email_verification.sql`
- `backend/scripts/runIntegrationTests.js`
- `backend/src/models/emailVerificationModel.js`
- `backend/src/services/emailVerificationService.js`
- `backend/test/emailVerification.integration.test.js`
- `backend/test/helpers/verifyFixtureEmail.js`
- `frontend/src/components/auth/ResendVerification.jsx`
- `frontend/src/pages/VerifyEmail.jsx`
- `frontend/test/emailVerification.test.js`

Modified:

- `backend/.env.example`
- `backend/.env.production.example`
- `backend/.env.test.example`
- `backend/package.json`
- `backend/scripts/seedIntegrationTestPrerequisites.js`
- `backend/src/config/env.js`
- `backend/src/controllers/authController.js`
- `backend/src/middleware/authRateLimiters.js`
- `backend/src/middleware/authenticateToken.js`
- `backend/src/models/authModel.js`
- `backend/src/routes/authRoutes.js`
- `backend/src/services/authService.js`
- `backend/src/services/emailService.js`
- `backend/src/services/identityService.js`
- `backend/src/validators/authValidators.js`
- `backend/test/0-clinicOperations.integration.test.js`
- `backend/test/0-clinicalRecords.integration.test.js`
- `backend/test/0-invoices.integration.test.js`
- `backend/test/0-notifications.integration.test.js`
- `backend/test/appointments.integration.test.js`
- `backend/test/auth.integration.test.js`
- `backend/test/clinicalAuthorization.integration.test.js`
- `backend/test/identity.integration.test.js`
- `backend/test/patientIsolation.integration.test.js` (already present as an untracked file)
- `frontend/src/App.jsx`
- `frontend/src/components/modals/LoginModal.jsx`
- `frontend/src/pages/Home.jsx`
- `frontend/src/pages/PatientProfile.jsx`
- `frontend/src/services/authApi.js`

Other pre-existing uncommitted changes were preserved. Temporary isolated MySQL files and test logs were kept outside versioned source paths.
