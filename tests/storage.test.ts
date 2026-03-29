import test from 'node:test'
import assert from 'node:assert/strict'
import { buildStoredName, sanitizeFileName } from '../src/storage.js'

test('sanitizeFileName removes path separators and control chars', () => {
  const result = sanitizeFileName('../foo\\bar\u0000.csv')
  assert.equal(result, 'foo-bar.csv')
})

test('buildStoredName prefers source message id prefix', () => {
  const result = buildStoredName('om_123', '账单.csv')
  assert.equal(result, 'om_123-账单.csv')
})
