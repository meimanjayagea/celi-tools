import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDialogName } from '../apps/web/app/lib/dialog-validation.mjs';

test('dialog names trim whitespace and reject empty or oversized input', () => {
  assert.equal(normalizeDialogName('  API client  '), 'API client');
  assert.equal(normalizeDialogName('  '), null);
  assert.equal(normalizeDialogName('a'.repeat(101)), null);
  assert.equal(normalizeDialogName('a'.repeat(100)).length, 100);
});
