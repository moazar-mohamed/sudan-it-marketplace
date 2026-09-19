# Sudan IT Marketplace – Platform Admin Web

Separate React + TypeScript + Vite dashboard for the `platform_admin` role. It uses the
same Firebase project (Auth + Firestore, client SDK only) as the Flutter app and does not
change the Flutter app or any Firebase account.

```bash
npm install
npm run dev         # http://localhost:5173
npm run typecheck   # tsc --noEmit
npm run lint
npm test            # access-control unit tests
npm run test:rules  # Firestore rules tests (local emulator, needs Java; see below)
npm run build
```

Sign in with an existing Platform Admin account. After sign-in the app reads
`users/{uid}`; only `role == "platform_admin"` with `isActive == true` gets in, anyone
else is signed straight back out. This is a UX gate; the Firestore rules are the real
enforcement (`../firestore.rules`).

## What Platform Admin can do

| Area | Permission |
| --- | --- |
| Companies | View all. **Add** a company (created active, unrated; link its company-admin account separately). A location can be given as a written address, as an exact point picked on a map (Leaflet + OpenStreetMap tiles, no API key), or both; coordinates are optional and saved as numbers (`latitude` / `longitude`). Change **status only** (`pending`, `active`, `rejected`, `inactive`): approve / reject a pending company, activate / deactivate. **Delete** a company that is not active (deactivate it first); its products are deleted with it in the same batch and existing orders are kept. Profile fields of an existing company are not editable. Only active companies and their products are visible to customers. |
| Customers | View all customers (filters: All / Active / Inactive). **Add** a real customer account (created with a second, throw-away Firebase app instance; the customer sets their own password through an emailed link). **Edit** name and phone only. **Deactivate / reactivate** (`isActive` only; a deactivated customer cannot use the customer app, and their data and orders are kept). **Delete is not available**: a real deletion must also remove the Firebase Authentication account, which needs the Admin SDK or a Cloud Function. Role, `companyId`, uid, email and other protected fields cannot be changed. |
| Products | Read-only. |
| Orders | Read-only (status, payment, assigned technician visible). |
| Categories | View, create, edit, activate / deactivate (existing safe-field rules). |
| Reviews | Read-only. |
| Analytics | Read-only. |
| Profile | View own name / email / role, sign out. |

The privilege requires `role == "platform_admin"` **and** `isActive == true`; a
deactivated admin loses all of it.

Language: English (LTR) and Arabic (RTL), switchable from the top bar.

## Rules tests

`npm run test:rules` starts the Firestore emulator (first run downloads it) and runs
`rules-tests/platform-admin.rules.test.ts` against `../firestore.rules`. It uses fake
identities inside the emulator only; nothing touches the real project. On Windows the
emulator's Java process can outlive the command; if the next run says port 8080 is
taken, stop that leftover `java` process.

## Deploying

The rules in this repository are not live until they are deployed to the Firebase
project (`firebase deploy --only firestore:rules`). Until then the dashboard runs
against the previous rules, under which Customers and Reviews cannot load.
