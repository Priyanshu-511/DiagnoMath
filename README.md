# DiagnoMath

## Offline Authentication

Fully offline login/signup for students and teachers. No backend, no network
calls — everything lives on the device via AsyncStorage.

### Where data is stored

| Key | Contents |
|---|---|
| `diagnomath:auth:users:v1` | JSON array of every registered account: `id`, `name`, `email`, `role`, `passwordHash`, `passwordSalt`, `createdAt` |
| `diagnomath:auth:session:v1` | `{ userId }` of whoever is currently signed in on this device |

Passwords are never stored in plain text — each gets a random salt, hashed
with SHA-256 (`lib/auth/crypto.ts`).

### Files

```
lib/auth/
  types.ts   — Role, StoredUser, AuthUser, RegisterInput/LoginInput, AuthError
  crypto.ts  — salt generation + password hashing/verification
  store.ts   — register(), login(), logout(), restoreSession(), listUsers()
  index.ts   — re-exports

context/
  auth-context.tsx — AuthProvider + useAuth() hook (status, user, login, register, logout)

components/auth/
  auth-screen.tsx  — login/signup form with role picker
  role-toggle.tsx  — Student / Teacher toggle
  text-field.tsx   — themed input
```

### How it's wired up

`app/_layout.tsx` wraps the app in `AuthProvider` and gates navigation:

- `status === 'loading'` → spinner while restoring a saved session
- `status === 'signedOut'` → shows `AuthScreen`
- `status === 'signedIn'` → shows the normal app tabs

`app/index.tsx` shows the signed-in user's name/role and a **Sign out** button
as an example of consuming `useAuth()` elsewhere in the app.

### Using it in a new screen

```tsx
import { useAuth } from '@/context/auth-context';

const { user, logout } = useAuth();
// user?.role === 'student' | 'teacher'
```

### Setup

```bash
npm install   # pulls in @react-native-async-storage/async-storage and expo-crypto
```

### Known limits

- Per-device only — accounts don't sync across devices (by design, per the
  "fully offline" requirement).
- Hashing protects against plain-text storage, not against someone with
  direct access to a rooted/jailbroken device's filesystem.
- Data persists until the app is uninstalled or its storage is cleared.