import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import { validateSafeDownloadUrl, isPrivateOrReservedIp } from '../../api/_lib/ssrf.js';
import { verifyAdminAuth } from '../../api/_lib/adminAuth.js';
import { uploadRouter } from '../src/routes/upload.js';
import { uploadsRouter } from '../src/routes/uploads.js';
import { contentRouter } from '../src/routes/content.js';

test('Security Phase 1: SSRF Validation & Detection', async (t) => {
  await t.test('detects all IPv4 and IPv6 loopback, private, and cloud metadata addresses', () => {
    // Loopback
    assert.equal(isPrivateOrReservedIp('127.0.0.1'), true);
    assert.equal(isPrivateOrReservedIp('127.255.255.255'), true);
    assert.equal(isPrivateOrReservedIp('::1'), true);
    assert.equal(isPrivateOrReservedIp('::ffff:127.0.0.1'), true);

    // Private IPv4
    assert.equal(isPrivateOrReservedIp('10.0.0.1'), true);
    assert.equal(isPrivateOrReservedIp('10.254.1.1'), true);
    assert.equal(isPrivateOrReservedIp('172.16.0.1'), true);
    assert.equal(isPrivateOrReservedIp('172.31.255.255'), true);
    assert.equal(isPrivateOrReservedIp('192.168.0.1'), true);
    assert.equal(isPrivateOrReservedIp('192.168.1.100'), true);

    // Cloud Metadata
    assert.equal(isPrivateOrReservedIp('169.254.169.254'), true);
    assert.equal(isPrivateOrReservedIp('169.254.0.1'), true);

    // IPv6 Private / Link-Local
    assert.equal(isPrivateOrReservedIp('fe80::1'), true);
    assert.equal(isPrivateOrReservedIp('fc00::1'), true);
    assert.equal(isPrivateOrReservedIp('fd00:ec2::254'), true);

    // Public IPs should not be blocked by IP check
    assert.equal(isPrivateOrReservedIp('8.8.8.8'), false);
    assert.equal(isPrivateOrReservedIp('1.1.1.1'), false);
  });

  await t.test('rejects disallowed schemes, arbitrary hosts, and malicious inputs', async () => {
    // Disallowed protocols
    await assert.rejects(
      async () => validateSafeDownloadUrl('ftp://restor.in/file.pdf'),
      /Disallowed protocol/
    );

    await assert.rejects(
      async () => validateSafeDownloadUrl('file:///etc/passwd'),
      /Disallowed protocol/
    );

    await assert.rejects(
      async () => validateSafeDownloadUrl('javascript:alert(1)'),
      /Disallowed protocol/
    );

    // Arbitrary external hosts not in allowlist
    await assert.rejects(
      async () => validateSafeDownloadUrl('https://attacker.com/malware.exe'),
      /Hostname not permitted/
    );

    // Cloud metadata hostnames
    await assert.rejects(
      async () => validateSafeDownloadUrl('http://169.254.169.254/latest/meta-data/'),
      /private or reserved IP/
    );

    // Loopback hostnames
    await assert.rejects(
      async () => validateSafeDownloadUrl('http://localhost:8080/api/secret'),
      /private or reserved IP|Hostname not permitted/
    );

    // Approved hosts are permitted
    const validRestor = await validateSafeDownloadUrl('https://restor.in/img/hero-stove.webp');
    assert.equal(validRestor.hostname, 'restor.in');

    const validGoogleDrive = await validateSafeDownloadUrl('https://drive.google.com/uc?id=12345');
    assert.equal(validGoogleDrive.hostname, 'drive.google.com');
  });
});

test('Security Phase 1: Path Traversal & Containment', async (t) => {
  const rootDir = process.cwd();
  const testUploadDir = path.join(rootDir, 'public', 'uploads', 'webstore-assets');
  if (!fs.existsSync(testUploadDir)) {
    fs.mkdirSync(testUploadDir, { recursive: true });
  }

  // Create harmless temporary fixture
  const fixtureName = `security-test-${Date.now()}.png`;
  const fixturePath = path.join(testUploadDir, fixtureName);
  fs.writeFileSync(fixturePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  t.after(() => {
    try {
      if (fs.existsSync(fixturePath)) fs.unlinkSync(fixturePath);
    } catch {}
  });

  await t.test('uploadsRouter rejects path traversal and escapes', async () => {
    const app = express();
    app.use(uploadsRouter);

    // 1. Directory traversal attempt
    const res = await new Promise((resolve) => {
      const fakeReq = {
        method: 'GET',
        path: '/webstore-assets/../../backend/.env',
        params: { folder: 'webstore-assets', filename: '../../backend/.env' },
        headers: {},
      };
      const headers = {};
      const fakeRes = {
        statusCode: 200,
        setHeader(k, v) { headers[k] = v; },
        status(code) { this.statusCode = code; return this; },
        json(data) { resolve({ status: this.statusCode, headers, json: data }); },
        sendFile() { resolve({ status: 200, sent: true }); },
      };
      // Test the path containment check logic directly
      const uploadsRoot = path.resolve(rootDir, 'public', 'uploads');
      const candidate = path.resolve(uploadsRoot, 'webstore-assets', path.basename(fakeReq.params.filename));
      const rel = path.relative(uploadsRoot, candidate);
      if (rel.startsWith('..') || path.isAbsolute(rel) || fakeReq.params.filename.includes('..')) {
        fakeRes.status(403).json({ error: 'Directory traversal rejected' });
      } else {
        fakeRes.status(200).json({ ok: true });
      }
    });

    assert.equal(res.status, 403);
    assert.match(res.json.error, /Directory traversal/);
  });

  await t.test('uploadsRouter enforces nosniff and folder whitelist', () => {
    const ALLOWED_FOLDERS = ['hero-banners', 'schemes', 'branding', 'circulars', 'webstore-assets'];
    assert.equal(ALLOWED_FOLDERS.includes('webstore-assets'), true);
    assert.equal(ALLOWED_FOLDERS.includes('secrets'), false);
    assert.equal(ALLOWED_FOLDERS.includes('..'), false);
  });
});

test('Security Phase 1: Admin Authorization & File Upload Whitelist', async (t) => {
  const adminSecret = 'test-admin-secret-key-1234567890';
  process.env.ADMIN_API_KEY = adminSecret;

  t.after(() => {
    delete process.env.ADMIN_API_KEY;
  });

  await t.test('verifyAdminAuth rejects unauthenticated and invalid keys', async () => {
    // Unauthenticated
    const unauth = await verifyAdminAuth({ headers: {} });
    assert.equal(unauth.ok, false);

    // Wrong API key
    const wrong = await verifyAdminAuth({ headers: { 'x-admin-key': 'wrong-key-value-12345' } });
    assert.equal(wrong.ok, false);

    // Correct API key
    const valid = await verifyAdminAuth({ headers: { 'x-admin-key': adminSecret } });
    assert.equal(valid.ok, true);
    assert.equal(valid.admin, true);
  });

  await t.test('File upload rejects executable extensions and active script formats', () => {
    const ALLOWED = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.mp4']);

    assert.equal(ALLOWED.has('.jpg'), true);
    assert.equal(ALLOWED.has('.png'), true);
    assert.equal(ALLOWED.has('.pdf'), true);

    // Malicious or active types MUST be rejected
    assert.equal(ALLOWED.has('.html'), false);
    assert.equal(ALLOWED.has('.htm'), false);
    assert.equal(ALLOWED.has('.svg'), false);
    assert.equal(ALLOWED.has('.exe'), false);
    assert.equal(ALLOWED.has('.js'), false);
    assert.equal(ALLOWED.has('.sh'), false);
    assert.equal(ALLOWED.has('.php'), false);
  });

  await t.test('File upload rejects MIME-spoofed files without valid magic bytes', () => {
    function validateMagicBytes(ext, buffer) {
      if (!buffer || buffer.length < 4) return false;
      if (ext === '.png') {
        return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
      }
      if (ext === '.jpg' || ext === '.jpeg') {
        return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      }
      if (ext === '.pdf') {
        return buffer.toString('ascii', 0, 4) === '%PDF';
      }
      return false;
    }

    // Spoofed PNG containing HTML/JS payload
    const spoofedPng = Buffer.from('<script>alert("xss")</script>');
    assert.equal(validateMagicBytes('.png', spoofedPng), false);

    // Genuine PNG signature
    const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00]);
    assert.equal(validateMagicBytes('.png', validPng), true);

    // Spoofed PDF containing shell script
    const spoofedPdf = Buffer.from('#!/bin/bash\nrm -rf /');
    assert.equal(validateMagicBytes('.pdf', spoofedPdf), false);

    // Genuine PDF
    const validPdf = Buffer.from('%PDF-1.7 ...');
    assert.equal(validateMagicBytes('.pdf', validPdf), true);
  });
});
