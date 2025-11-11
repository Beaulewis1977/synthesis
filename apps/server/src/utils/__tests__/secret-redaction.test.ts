import { describe, expect, it } from 'vitest';
import { isSecretKey, redactSecrets } from '../secret-redaction';

describe('isSecretKey', () => {
  it('should detect common secret key patterns', () => {
    expect(isSecretKey('password')).toBe(true);
    expect(isSecretKey('user_password')).toBe(true);
    expect(isSecretKey('PASSWORD')).toBe(true);

    expect(isSecretKey('api_key')).toBe(true);
    expect(isSecretKey('apiKey')).toBe(true);
    expect(isSecretKey('API_KEY')).toBe(true);

    expect(isSecretKey('secret')).toBe(true);
    expect(isSecretKey('client_secret')).toBe(true);
    expect(isSecretKey('SECRET_VALUE')).toBe(true);

    expect(isSecretKey('token')).toBe(true);
    expect(isSecretKey('access_token')).toBe(true);
    expect(isSecretKey('bearer_token')).toBe(true);

    expect(isSecretKey('credential')).toBe(true);
    expect(isSecretKey('credentials')).toBe(true);

    expect(isSecretKey('auth')).toBe(true);
    expect(isSecretKey('authorization')).toBe(true);

    expect(isSecretKey('private_key')).toBe(true);
    expect(isSecretKey('privateKey')).toBe(true);

    expect(isSecretKey('jwt')).toBe(true);
    expect(isSecretKey('jwt_token')).toBe(true);

    expect(isSecretKey('session')).toBe(true);
    expect(isSecretKey('session_id')).toBe(true);

    expect(isSecretKey('cookie')).toBe(true);
    expect(isSecretKey('csrf')).toBe(true);
    expect(isSecretKey('salt')).toBe(true);
    expect(isSecretKey('hash')).toBe(true);
  });

  it('should not detect non-secret keys', () => {
    expect(isSecretKey('username')).toBe(false);
    expect(isSecretKey('email')).toBe(false);
    expect(isSecretKey('public_url')).toBe(false);
    expect(isSecretKey('endpoint')).toBe(false);
    expect(isSecretKey('host')).toBe(false);
    expect(isSecretKey('port')).toBe(false);
    expect(isSecretKey('database')).toBe(false);
    expect(isSecretKey('timeout')).toBe(false);
  });
});

describe('redactSecrets', () => {
  it('should redact simple object with secret keys', () => {
    const input = {
      username: 'alice',
      password: 'secret123',
      email: 'alice@example.com',
    };

    const result = redactSecrets(input);

    expect(result).toEqual({
      username: 'alice',
      password: '<redacted>',
      email: 'alice@example.com',
    });
  });

  it('should redact nested objects', () => {
    const input = {
      database: {
        host: 'localhost',
        port: 5432,
        password: 'db_secret',
        username: 'postgres',
      },
      api: {
        endpoint: 'https://api.example.com',
        api_key: 'sk_live_123',
      },
    };

    const result = redactSecrets(input);

    expect(result).toEqual({
      database: {
        host: 'localhost',
        port: 5432,
        password: '<redacted>',
        username: 'postgres',
      },
      api: {
        endpoint: 'https://api.example.com',
        api_key: '<redacted>',
      },
    });
  });

  it('should redact arrays when key is secret', () => {
    const input = {
      tokens: ['token1', 'token2', 'token3'],
      api_keys: ['key1', 'key2'],
      usernames: ['alice', 'bob', 'charlie'],
    };

    const result = redactSecrets(input);

    expect(result).toEqual({
      tokens: '<redacted>',
      api_keys: '<redacted>',
      usernames: ['alice', 'bob', 'charlie'],
    });
  });

  it('should redact objects within arrays', () => {
    const input = {
      users: [
        { name: 'Alice', password: 'secret1' },
        { name: 'Bob', password: 'secret2' },
      ],
    };

    const result = redactSecrets(input);

    expect(result).toEqual({
      users: [
        { name: 'Alice', password: '<redacted>' },
        { name: 'Bob', password: '<redacted>' },
      ],
    });
  });

  it('should handle deeply nested structures', () => {
    const input = {
      level1: {
        level2: {
          level3: {
            api_key: 'super_secret',
            public_data: 'visible',
          },
        },
      },
    };

    const result = redactSecrets(input);

    expect(result).toEqual({
      level1: {
        level2: {
          level3: {
            api_key: '<redacted>',
            public_data: 'visible',
          },
        },
      },
    });
  });

  it('should handle null and undefined values', () => {
    const input = {
      nullValue: null,
      undefinedValue: undefined,
      password: null,
      api_key: undefined,
    };

    const result = redactSecrets(input);

    expect(result).toEqual({
      nullValue: null,
      undefinedValue: undefined,
      password: '<redacted>',
      api_key: '<redacted>',
    });
  });

  it('should handle empty objects and arrays', () => {
    const input = {
      emptyObject: {},
      emptyArray: [],
      tokens: [],
    };

    const result = redactSecrets(input);

    expect(result).toEqual({
      emptyObject: {},
      emptyArray: [],
      tokens: '<redacted>',
    });
  });

  it('should handle mixed types', () => {
    const input = {
      string: 'value',
      number: 42,
      boolean: true,
      password: 'secret',
      array: [1, 2, 3],
      object: { key: 'value' },
    };

    const result = redactSecrets(input);

    expect(result).toEqual({
      string: 'value',
      number: 42,
      boolean: true,
      password: '<redacted>',
      array: [1, 2, 3],
      object: { key: 'value' },
    });
  });

  it('should redact various secret key formats', () => {
    const input = {
      password: 'pass1',
      user_password: 'pass2',
      api_key: 'key1',
      apiKey: 'key2',
      client_secret: 'secret1',
      access_token: 'token1',
      bearer_token: 'token2',
      private_key: 'private1',
      jwt: 'jwt1',
      session_id: 'session1',
    };

    const result = redactSecrets(input);

    expect(result).toEqual({
      password: '<redacted>',
      user_password: '<redacted>',
      api_key: '<redacted>',
      apiKey: '<redacted>',
      client_secret: '<redacted>',
      access_token: '<redacted>',
      bearer_token: '<redacted>',
      private_key: '<redacted>',
      jwt: '<redacted>',
      session_id: '<redacted>',
    });
  });

  it('should preserve non-plain objects (like Date)', () => {
    const date = new Date('2024-01-01');
    const input = {
      timestamp: date,
      password: 'secret',
    };

    const result = redactSecrets(input);

    expect(result.timestamp).toBe(date);
    expect(result.password).toBe('<redacted>');
  });

  it('should redact complex real-world config', () => {
    const input = {
      database: {
        url: 'postgresql://user:password@localhost:5432/db',
        host: 'localhost',
        port: 5432,
        password: 'db_secret',
      },
      anthropic_api_key: 'sk-ant-xyz123',
      openai_api_key: 'sk-proj-abc456',
      voyage_api_key: 'pa-voyage-def789',
      ollama: {
        base_url: 'http://localhost:11434',
        model: 'nomic-embed-text',
      },
      server: {
        port: 3333,
        host: '0.0.0.0',
      },
      jwt_secret: 'super_secret_jwt_key',
      session_secret: 'session_key_123',
    };

    const result = redactSecrets(input);

    expect(result).toEqual({
      database: {
        url: 'postgresql://user:password@localhost:5432/db',
        host: 'localhost',
        port: 5432,
        password: '<redacted>',
      },
      anthropic_api_key: '<redacted>',
      openai_api_key: '<redacted>',
      voyage_api_key: '<redacted>',
      ollama: {
        base_url: 'http://localhost:11434',
        model: 'nomic-embed-text',
      },
      server: {
        port: 3333,
        host: '0.0.0.0',
      },
      jwt_secret: '<redacted>',
      session_secret: '<redacted>',
    });
  });

  it('should not modify the original object', () => {
    const input = {
      password: 'secret',
      username: 'alice',
    };

    const result = redactSecrets(input);

    // Original should be unchanged
    expect(input.password).toBe('secret');
    expect(input.username).toBe('alice');

    // Result should be redacted
    expect(result.password).toBe('<redacted>');
    expect(result.username).toBe('alice');
  });

  it('should handle top-level primitives', () => {
    expect(redactSecrets('string')).toBe('string');
    expect(redactSecrets(42)).toBe(42);
    expect(redactSecrets(true)).toBe(true);
    expect(redactSecrets(null)).toBe(null);
    expect(redactSecrets(undefined)).toBe(undefined);
  });

  it('should handle top-level arrays', () => {
    const input = [
      { password: 'secret1', username: 'alice' },
      { password: 'secret2', username: 'bob' },
    ];

    const result = redactSecrets(input);

    expect(result).toEqual([
      { password: '<redacted>', username: 'alice' },
      { password: '<redacted>', username: 'bob' },
    ]);
  });
});
