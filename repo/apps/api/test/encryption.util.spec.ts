import { encrypt, decrypt } from '../src/infrastructure/security/encryption.util';

describe('Encryption Utility', () => {
  const testKey = 'test-encryption-key-for-unit-tests';

  describe('encrypt and decrypt', () => {
    it('should round-trip encrypt and decrypt successfully', () => {
      const plaintext = 'Hello, this is sensitive data!';

      const ciphertext = encrypt(plaintext, testKey);
      const decrypted = decrypt(ciphertext, testKey);

      expect(decrypted).toBe(plaintext);
    });

    it('should fail decryption with wrong key', () => {
      const plaintext = 'Secret message';
      const ciphertext = encrypt(plaintext, testKey);

      expect(() => {
        decrypt(ciphertext, 'wrong-key-here');
      }).toThrow();
    });

    it('should produce different ciphertexts for different plaintexts', () => {
      const ciphertext1 = encrypt('message one', testKey);
      const ciphertext2 = encrypt('message two', testKey);

      expect(ciphertext1).not.toBe(ciphertext2);
    });

    it('should produce different ciphertexts for same plaintext due to random IV', () => {
      const plaintext = 'same message';
      const ciphertext1 = encrypt(plaintext, testKey);
      const ciphertext2 = encrypt(plaintext, testKey);

      expect(ciphertext1).not.toBe(ciphertext2);

      // But both should decrypt to the same value
      expect(decrypt(ciphertext1, testKey)).toBe(plaintext);
      expect(decrypt(ciphertext2, testKey)).toBe(plaintext);
    });
  });
});
