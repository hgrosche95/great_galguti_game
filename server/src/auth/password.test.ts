import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('speichert das Passwort nicht im Klartext', async () => {
    const hash = await hashPassword('supersecret');
    expect(hash).not.toBe('supersecret');
  });

  it('verifiziert das richtige Passwort', async () => {
    const hash = await hashPassword('supersecret');
    await expect(verifyPassword('supersecret', hash)).resolves.toBe(true);
  });

  it('lehnt ein falsches Passwort ab', async () => {
    const hash = await hashPassword('supersecret');
    await expect(verifyPassword('falsches-passwort', hash)).resolves.toBe(false);
  });

  it('erzeugt bei gleichem Passwort unterschiedliche Hashes (Salt)', async () => {
    const hash1 = await hashPassword('supersecret');
    const hash2 = await hashPassword('supersecret');
    expect(hash1).not.toBe(hash2);
  });
});
