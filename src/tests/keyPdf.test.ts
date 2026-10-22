// src/tests/keyPdf.test.ts
// Vitest Test Suite for Branded Key Certificate PDF Generation & Ciphertext Sanitization

import { describe, it, expect } from 'vitest';
import { generateKeyCertificatePdf } from '../lib/crypto/penoraKeyPdf';
import { penoraKeyAuth } from '../lib/auth/penoraKeyAuth';
import type { AccountKeySuite } from '../lib/crypto/penoraKeys';

describe('PENORA Branded Key Certificate PDF Suite', () => {
  const dummyRaw = new Uint8Array(32);
  const mockKeySuite: AccountKeySuite = {
    owner: {
      role: 'owner',
      rawPublicKey: dummyRaw,
      publicKeyPen: 'PEN5JownerPublicKeyForTesting123456789012345678901234',
      privateKeyWif: '5JownerPrivateKeyWifForTesting12345678901234567890123',
    },
    active: {
      role: 'active',
      rawPublicKey: dummyRaw,
      publicKeyPen: 'PEN5JactivePublicKeyForTesting123456789012345678901234',
      privateKeyWif: '5JactivePrivateKeyWifForTesting12345678901234567890123',
    },
    posting: {
      role: 'posting',
      rawPublicKey: dummyRaw,
      publicKeyPen: 'PEN5JpostingPublicKeyForTesting1234567890123456789012',
      privateKeyWif: '5JpostingPrivateKeyWifForTesting123456789012345678901',
    },
    memo: {
      role: 'memo',
      rawPublicKey: dummyRaw,
      publicKeyPen: 'PEN5JmemoPublicKeyForTesting1234567890123456789012345',
      privateKeyWif: '5JmemoPrivateKeyWifForTesting123456789012345678901234',
    },
  };

  it('1. generates a valid single-page A4 PDF document', async () => {
    const doc = await generateKeyCertificatePdf('sarah_writer', mockKeySuite);
    expect(doc).toBeDefined();

    // Verify page count is 1
    const totalPages = doc.getNumberOfPages();
    expect(totalPages).toBe(1);

    // Verify output buffer is non-empty binary PDF
    const arrayBuffer = doc.output('arraybuffer');
    expect(arrayBuffer.byteLength).toBeGreaterThan(1000);

    // Verify PDF header magic bytes "%PDF-"
    const uint8 = new Uint8Array(arrayBuffer);
    const magic = String.fromCharCode(...uint8.slice(0, 5));
    expect(magic).toBe('%PDF-');
  });

  it('2. embeds creator handle and key role authorities', async () => {
    const doc = await generateKeyCertificatePdf('crypto_creator', mockKeySuite);
    const pdfText = doc.output();

    // Verify username and branding exist in output
    expect(pdfText).toContain('crypto_creator');
    expect(pdfText).toContain('PENORA');
    expect(pdfText).toContain('POSTING');
    expect(pdfText).toContain('ACTIVE');
    expect(pdfText).toContain('MASTER OWNER');
  });

  it('3. does NOT contain rough cipher text or raw hex dumps in PDF', async () => {
    const doc = await generateKeyCertificatePdf('alice', mockKeySuite);
    const pdfText = doc.output();

    expect(pdfText).not.toContain('Ciphertext:');
    expect(pdfText).not.toContain('ENCRYPTED RECOVERY VAULT PAYLOAD');
    expect(pdfText).not.toContain('XSalsa20-Poly1305');
  });

  it('4. verifies penoraKeyAuth.generateBackupContent is also free of rough ciphertext', () => {
    const backupText = penoraKeyAuth.generateBackupContent('bob', mockKeySuite);

    // Verify clean layout
    expect(backupText).toContain('@bob');
    expect(backupText).toContain('POSTING KEY');
    expect(backupText).toContain('MASTER OWNER KEY');

    // Verify rough ciphertext and nonce have been removed
    expect(backupText).not.toContain('Ciphertext:');
    expect(backupText).not.toContain('ENCRYPTED RECOVERY VAULT PAYLOAD');
    expect(backupText).not.toContain('Nonce:');
  });
});
