# Server Utilities

Common utility functions used across the server application.

## Secret Redaction

Safe logging utilities that automatically redact sensitive information from objects.

### Usage

```typescript
import { redactSecrets, isSecretKey } from '@/utils';

// Redact secrets from configuration before logging
const config = {
  database: {
    host: 'localhost',
    password: 'super_secret'
  },
  api_key: 'sk_live_123'
};

console.log('Config:', JSON.stringify(redactSecrets(config), null, 2));
// Output:
// {
//   "database": {
//     "host": "localhost",
//     "password": "<redacted>"
//   },
//   "api_key": "<redacted>"
// }
```

### Features

- **Automatic detection**: Recognizes common secret patterns (password, api_key, token, secret, etc.)
- **Deep traversal**: Handles nested objects and arrays recursively
- **Structure preservation**: Keeps object structure intact, only masks values
- **Type safety**: Preserves special objects like Date, RegExp, etc.
- **Non-destructive**: Returns a new object without modifying the original

### Detected Patterns

The following key patterns are automatically detected as secrets:

- `password`, `user_password`, `db_password`
- `api_key`, `apiKey`, `openai_api_key`
- `secret`, `client_secret`, `jwt_secret`
- `token`, `access_token`, `bearer_token`, `refresh_token`
- `credential`, `credentials`
- `auth`, `authorization`
- `private`, `private_key`, `privateKey`
- `jwt`
- `session`, `session_id`
- `cookie`, `csrf`, `salt`, `hash`

### Check if a key is secret

```typescript
import { isSecretKey } from '@/utils';

isSecretKey('password');    // true
isSecretKey('api_key');     // true
isSecretKey('username');    // false
```

### Examples

See [secret-redaction.example.ts](./__tests__/secret-redaction.example.ts) for comprehensive usage examples.

### Testing

Run tests:
```bash
pnpm --filter @synthesis/server test secret-redaction
```
