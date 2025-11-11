/**
 * Example usage of the secret redaction utility
 *
 * This file demonstrates common use cases for redactSecrets() when logging
 * sensitive configuration or request data.
 */

import { redactSecrets } from '../secret-redaction';

// Example 1: Logging application configuration
const appConfig = {
  database: {
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'super_secret_db_password',
  },
  anthropic_api_key: 'sk-ant-api03-xyz123',
  openai_api_key: 'sk-proj-abc456',
  voyage_api_key: 'pa-voyage-def789',
  server: {
    port: 3333,
    host: '0.0.0.0',
  },
};

console.log('Application Config (redacted):');
console.log(JSON.stringify(redactSecrets(appConfig), null, 2));
// Output:
// {
//   "database": {
//     "host": "localhost",
//     "port": 5432,
//     "username": "postgres",
//     "password": "<redacted>"
//   },
//   "anthropic_api_key": "<redacted>",
//   "openai_api_key": "<redacted>",
//   "voyage_api_key": "<redacted>",
//   "server": {
//     "port": 3333,
//     "host": "0.0.0.0"
//   }
// }

// Example 2: Logging authentication requests
const loginRequest = {
  username: 'alice@example.com',
  password: 'my_secure_password_123',
  remember_me: true,
  timestamp: new Date(),
};

console.log('\nLogin Request (redacted):');
console.log(JSON.stringify(redactSecrets(loginRequest), null, 2));
// Output:
// {
//   "username": "alice@example.com",
//   "password": "<redacted>",
//   "remember_me": true,
//   "timestamp": "2024-01-01T00:00:00.000Z"
// }

// Example 3: Logging array of user objects
const users = [
  { id: 1, name: 'Alice', email: 'alice@example.com', password: 'secret1' },
  { id: 2, name: 'Bob', email: 'bob@example.com', password: 'secret2' },
];

console.log('\nUsers Array (redacted):');
console.log(JSON.stringify(redactSecrets({ users }), null, 2));
// Output:
// {
//   "users": [
//     {
//       "id": 1,
//       "name": "Alice",
//       "email": "alice@example.com",
//       "password": "<redacted>"
//     },
//     {
//       "id": 2,
//       "name": "Bob",
//       "email": "bob@example.com",
//       "password": "<redacted>"
//     }
//   ]
// }

// Example 4: Logging API token arrays
const credentials = {
  api_keys: ['sk_live_123', 'sk_live_456', 'sk_live_789'],
  public_urls: ['https://api.example.com', 'https://app.example.com', 'https://docs.example.com'],
};

console.log('\nCredentials (redacted):');
console.log(JSON.stringify(redactSecrets(credentials), null, 2));
// Output:
// {
//   "api_keys": "<redacted>",
//   "public_urls": [
//     "https://api.example.com",
//     "https://app.example.com",
//     "https://docs.example.com"
//   ]
// }

// Example 5: Using in error logging
try {
  // Simulated API call with credentials
  throw new Error('API connection failed');
} catch (error) {
  const errorContext = {
    message: (error as Error).message,
    config: {
      endpoint: 'https://api.example.com',
      api_key: 'sk_live_secret_key',
      timeout: 5000,
    },
  };

  console.log('\nError Context (redacted):');
  console.log(JSON.stringify(redactSecrets(errorContext), null, 2));
  // Output:
  // {
  //   "message": "API connection failed",
  //   "config": {
  //     "endpoint": "https://api.example.com",
  //     "api_key": "<redacted>",
  //     "timeout": 5000
  //   }
  // }
}

// Example 6: OAuth/JWT tokens
const authData = {
  user_id: 12345,
  access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  refresh_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  bearer_token: 'Bearer xyz123...',
  jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  expires_at: new Date('2024-12-31'),
};

console.log('\nAuth Data (redacted):');
console.log(JSON.stringify(redactSecrets(authData), null, 2));
// Output:
// {
//   "user_id": 12345,
//   "access_token": "<redacted>",
//   "refresh_token": "<redacted>",
//   "bearer_token": "<redacted>",
//   "jwt": "<redacted>",
//   "expires_at": "2024-12-31T00:00:00.000Z"
// }
