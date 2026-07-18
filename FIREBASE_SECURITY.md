# Firestore Security

## Scope

Tasklyzen stores one document per authenticated user at `/users/{uid}`. The
client is allowed to read, create, update and delete only its own document.
All other paths are denied by default.

## Field Policy

`firestore.rules` allows only the fields in
`TasklyzenConfig.cloudStorageKeys`. Values are serialized strings because the
local-first storage adapter persists raw localStorage values. UI preferences,
developer snapshots, overdue review state and an active Carrera session are
not accepted by the rules.

When a field is added to the cloud whitelist, update these three places in the
same change:

1. `tasklyzen-config.js`.
2. `firestore.rules`.
3. `tests/tasklyzen-firestore-rules.test.js`.

## Deployment

No remote deployment is performed by this repository. With an authenticated
Firebase CLI, deploy only the rules from the repository root:

```powershell
firebase deploy --only firestore --project tasklyzen-app
```

`firebase.json` points the CLI at `firestore.rules`. Firebase console edits
must be copied back into this file, because a CLI deployment replaces the
remote rules.

## Verification

`npm test` validates the local rules/config contract. It does not replace a
Firestore Emulator or a deployed-project authorization test. Before a
production deployment, run the Emulator with authenticated-owner and
cross-user scenarios, then confirm the deployed rules in the Firebase console.
