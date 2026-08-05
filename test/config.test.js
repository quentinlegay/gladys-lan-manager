import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js';

test('normalizeConfig returns the defaults when called with no argument', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
});

test('normalizeConfig passes through unknown fields for forward-compatibility', () => {
  const config = normalizeConfig({ future_field: 42 });
  assert.equal(config.future_field, 42);
});
