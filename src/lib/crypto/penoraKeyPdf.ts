// src/lib/crypto/penoraKeyPdf.ts
// PENORA Blockchain — Official Branded Key Certificate PDF Generator
// Generates an elegant, high-security, printable PDF certificate for creator cryptographic keys.
// Zero rough ciphertext — clean, human-readable, self-custodial key backup.

import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import type { AccountKeySuite, KeyRole } from './penoraKeys';

export interface KeyCertificateOptions {
  username: string;
  keySuite: AccountKeySuite;
}

/**
 * Builds the official branded PENORA Key Certificate PDF.
 */
export async function generateKeyCertificatePdf(
  username: string,
  keySuite: AccountKeySuite
): Promise<jsPDF> {
  const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
  const timestamp = new Date();
  const formattedDate = timestamp.toUTCString();

  // Create A4 Portrait document: 210mm x 297mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const marginX = 14;
  const contentWidth = pageWidth - marginX * 2; // 182mm

  // ─── 1. TOP BRANDED HEADER BANNER ──────────────────────────────────────────
  // Deep Celestial Navy Background (#071A30)
  doc.setFillColor(7, 26, 48);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Vibrant Cyan Accent Divider (#00E5F4)
  doc.setFillColor(0, 229, 244);
  doc.rect(0, 28, pageWidth, 1.2, 'F');

  // PENORA Brand Wordmark
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('PENORA', marginX, 13);

  // Brand Subtitle
  doc.setTextColor(0, 229, 244);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('SOVEREIGN CREATOR COMMONS', marginX, 18.5);

  // Right-aligned Certificate Badge
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text('OFFICIAL KEY CERTIFICATE', pageWidth - marginX, 12, { align: 'right' });

  doc.setTextColor(173, 207, 230);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('CLIENT-SIDE SELF-CUSTODIAL BACKUP', pageWidth - marginX, 17.5, { align: 'right' });

  // ─── 2. ACCOUNT METADATA & QR CODE BLOCK ──────────────────────────────────
  let cursorY = 33.5;

  // Background Box (#F6FAFD)
  doc.setFillColor(246, 250, 253);
  doc.setDrawColor(200, 218, 232);
  doc.setLineWidth(0.3);
  doc.roundedRect(marginX, cursorY, contentWidth, 29, 2.5, 2.5, 'FD');

  // Generate QR Code containing account username & Posting public key
  try {
    const qrPayload = JSON.stringify({
      protocol: 'PENORA',
      username: `@${cleanUsername}`,
      postingPub: keySuite.posting.publicKeyPen,
      issued: timestamp.toISOString(),
    });
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      margin: 1,
      width: 140,
      color: {
        dark: '#071A30',
        light: '#F6FAFD',
      },
    });
    doc.addImage(qrDataUrl, 'PNG', pageWidth - marginX - 26, cursorY + 2.5, 24, 24);
  } catch {
    // If QR fails, proceed gracefully
  }

  // Account details text
  doc.setTextColor(74, 94, 117);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('CREATOR ACCOUNT', marginX + 4, cursorY + 6.5);

  doc.setTextColor(10, 37, 64);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`@${cleanUsername}`, marginX + 4, cursorY + 12.5);

  doc.setTextColor(74, 94, 117);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Generated: ${formattedDate}`, marginX + 4, cursorY + 18);
  doc.text('Security Model: Multi-Authority Elliptic Curve (Ed25519 & Secp256k1 WIF)', marginX + 4, cursorY + 22.5);
  doc.text('Network: PENORA Autonomous Mainnet Protocol', marginX + 4, cursorY + 26.5);

  // ─── 3. SECURITY WARNING BANNER ───────────────────────────────────────────
  cursorY += 32;

  // Warning card background: Soft warm amber (#FFFBEB)
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.4);
  doc.roundedRect(marginX, cursorY, contentWidth, 23.5, 2, 2, 'FD');

  // Amber accent icon bar
  doc.setFillColor(245, 158, 11);
  doc.rect(marginX, cursorY, 2.5, 23.5, 'F');

  doc.setTextColor(146, 64, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('CRITICAL SECURITY & SOVEREIGNTY INSTRUCTIONS', marginX + 5.5, cursorY + 5.5);

  doc.setTextColor(120, 53, 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.text(
    '• PENORA operates on a strictly non-custodial architecture. Your private keys never touch any central server.',
    marginX + 5.5,
    cursorY + 10
  );
  doc.text(
    '• Lost private keys CANNOT be recovered or reset by PENORA admins. Store this document offline in a secure vault.',
    marginX + 5.5,
    cursorY + 14
  );
  doc.text(
    '• NEVER share your Master Owner Key or Active Key. Use only your Posting Key for daily login, writing, and voting.',
    marginX + 5.5,
    cursorY + 18
  );

  // ─── 4. THE 4 CRYPTOGRAPHIC KEY AUTHORITIES ───────────────────────────────
  cursorY += 27.5;

  const keyCards: {
    role: KeyRole;
    title: string;
    badge: string;
    description: string;
    badgeColor: [number, number, number];
    borderColor: [number, number, number];
    isRecommendedForLogin?: boolean;
  }[] = [
    {
      role: 'posting',
      title: '1. POSTING KEY — DAILY LOGIN & PUBLISHING',
      badge: 'RECOMMENDED FOR LOGIN',
      description:
        'Daily operational authority. Used to sign in, publish essays, edit drafts, and cast curation votes. Cannot transfer funds.',
      badgeColor: [0, 124, 139], // Teal
      borderColor: [0, 124, 139],
      isRecommendedForLogin: true,
    },
    {
      role: 'active',
      title: '2. ACTIVE KEY — ACCOUNT AUTHORITY & ESCROW',
      badge: 'SENSITIVE AUTHORITY',
      description:
        'Financial & profile management authority. Used to update profile metadata, manage community guilds, and claim earned rewards.',
      badgeColor: [10, 37, 64], // Navy
      borderColor: [148, 163, 184],
    },
    {
      role: 'owner',
      title: '3. MASTER OWNER KEY — COLD RECOVERY ONLY',
      badge: 'COLD STORAGE (NEVER SHARE)',
      description:
        'Highest cryptographic authority. Solely reserved for recovering compromised accounts and rotating keys. Keep in cold storage.',
      badgeColor: [185, 28, 28], // Crimson Red
      borderColor: [239, 68, 68],
    },
    {
      role: 'memo',
      title: '4. MEMO KEY — ENCRYPTED MESSAGING',
      badge: 'MESSAGING AUTHORITY',
      description:
        'End-to-end encryption authority. Used exclusively to encrypt and decrypt private creator messages and transfer memos.',
      badgeColor: [75, 85, 99], // Slate Gray
      borderColor: [203, 213, 225],
    },
  ];

  const cardHeight = 35.5;
  const cardGap = 4;

  keyCards.forEach((item, index) => {
    const cardY = cursorY + index * (cardHeight + cardGap);
    const keypair = keySuite[item.role];

    // Card background & border
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...item.borderColor);
    doc.setLineWidth(item.isRecommendedForLogin ? 0.5 : 0.3);
    doc.roundedRect(marginX, cardY, contentWidth, cardHeight, 2, 2, 'FD');

    // Left accent strip
    doc.setFillColor(...item.badgeColor);
    doc.rect(marginX, cardY, 2, cardHeight, 'F');

    // Card Title
    doc.setTextColor(...item.badgeColor);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text(item.title, marginX + 4.5, cardY + 5.5);

    // Role badge on right
    doc.setFillColor(...item.badgeColor);
    const badgeText = item.badge;
    const badgeWidth = doc.getTextWidth(badgeText) + 4;
    doc.roundedRect(pageWidth - marginX - badgeWidth - 2, cardY + 2.5, badgeWidth, 4.5, 1, 1, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.text(badgeText, pageWidth - marginX - badgeWidth, cardY + 5.7);

    // Description
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.text(item.description, marginX + 4.5, cardY + 10);

    // Public Key Line
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.roundedRect(marginX + 4.5, cardY + 12.5, contentWidth - 9, 8.5, 1, 1, 'FD');

    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text('PUBLIC KEY:', marginX + 6.5, cardY + 18);

    doc.setTextColor(15, 23, 42);
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.2);
    doc.text(keypair.publicKeyPen, marginX + 27, cardY + 18);

    // Private Key (WIF) Line — Prominent Box
    doc.setFillColor(
      item.isRecommendedForLogin ? 240 : 254,
      item.isRecommendedForLogin ? 249 : 242,
      item.isRecommendedForLogin ? 250 : 242
    );
    doc.setDrawColor(
      item.isRecommendedForLogin ? 0 : 226,
      item.isRecommendedForLogin ? 124 : 232,
      item.isRecommendedForLogin ? 139 : 240
    );
    doc.setLineWidth(item.isRecommendedForLogin ? 0.35 : 0.2);
    doc.roundedRect(marginX + 4.5, cardY + 23, contentWidth - 9, 9.5, 1, 1, 'FD');

    doc.setTextColor(
      item.isRecommendedForLogin ? 0 : 71,
      item.isRecommendedForLogin ? 104 : 85,
      item.isRecommendedForLogin ? 118 : 105
    );
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('PRIVATE (WIF):', marginX + 6.5, cardY + 29);

    doc.setTextColor(10, 37, 64);
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.text(keypair.privateKeyWif, marginX + 31, cardY + 29);
  });

  // ─── 5. FOOTER & SOVEREIGN GUARANTEE ──────────────────────────────────────
  const footerY = 282;

  // Thin separator rule
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(marginX, footerY, pageWidth - marginX, footerY);

  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('PENORA Sovereign Identity Protocol • Clean Offline Backup • penora.org', marginX, footerY + 5);

  doc.setFont('helvetica', 'bold');
  doc.text('CONFIDENTIAL • KEEP OFFLINE • PAGE 1 OF 1', pageWidth - marginX, footerY + 5, {
    align: 'right',
  });

  return doc;
}

/**
 * Generates and triggers browser download of the official PENORA Key Certificate PDF.
 */
export async function downloadKeyCertificatePdf(
  username: string,
  keySuite: AccountKeySuite
): Promise<void> {
  const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
  const doc = await generateKeyCertificatePdf(username, keySuite);
  const filename = `PENORA-KEY-CERTIFICATE-@${cleanUsername}.pdf`;

  // Trigger browser download via jsPDF
  doc.save(filename);
}
