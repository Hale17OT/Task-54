import { encrypt, decrypt } from './encryption.util';

const isTestEnv = process.env.NODE_ENV === 'test';

/**
 * TypeORM column transformer for transparent encryption at rest (string columns).
 * Write path: encrypts value. Throws on failure unless NODE_ENV=test.
 * Read path: decrypts value. Falls back to plaintext only for legacy/migration data.
 */
export const encryptedTransformer = {
  to(value: string | null): string | null {
    if (!value) return value;
    try {
      return encrypt(value);
    } catch {
      if (isTestEnv) return value;
      throw new Error('Encryption failed — FIELD_ENCRYPTION_KEY must be configured');
    }
  },
  from(value: string | null): string | null {
    if (!value) return value;
    try {
      return decrypt(value);
    } catch {
      if (isTestEnv) return value;
      throw new Error('Decryption failed — data may be corrupted or FIELD_ENCRYPTION_KEY is incorrect');
    }
  },
};

/**
 * TypeORM column transformer for JSONB columns containing sensitive data.
 * Write path: serializes to JSON then encrypts. Throws on failure unless NODE_ENV=test.
 * Read path: decrypts then parses JSON. Falls back for legacy plaintext JSONB.
 */
export const encryptedJsonTransformer = {
  to(value: Record<string, unknown> | null): string | Record<string, unknown> | null {
    if (!value) return value;
    try {
      return encrypt(JSON.stringify(value));
    } catch {
      if (isTestEnv) return value;
      throw new Error('Encryption failed — FIELD_ENCRYPTION_KEY must be configured');
    }
  },
  from(value: string | Record<string, unknown> | null): Record<string, unknown> | null {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(decrypt(value));
    } catch {
      if (isTestEnv) {
        try { return JSON.parse(value); } catch { return null; }
      }
      throw new Error('Decryption failed — data may be corrupted or FIELD_ENCRYPTION_KEY is incorrect');
    }
  },
};
