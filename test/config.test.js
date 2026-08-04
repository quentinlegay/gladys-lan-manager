import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig } from '../src/config.js';

test('normalizeConfig returns the defaults when called with no argument', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
});

test('normalizeConfig coerces numeric strings coming from a form', () => {
  const config = normalizeConfig({ presence_check_port: '8080', poll_frequency: '30' });
  assert.equal(config.presence_check_port, 8080);
  assert.equal(config.poll_frequency, 30);
  assert.equal(typeof config.presence_check_port, 'number');
});

test('normalizeConfig falls back to the default for a missing numeric field', () => {
  const config = normalizeConfig({ presence_check: false });
  assert.equal(config.poll_frequency, DEFAULT_CONFIG.poll_frequency);
  assert.equal(config.presence_check_port, DEFAULT_CONFIG.presence_check_port);
});

test('normalizeConfig falls back to the default for a poll_frequency outside the fixed Gladys enum', () => {
  // Gladys core only accepts poll_frequency in {1,2,10,15,30,60}s (as ms); anything
  // else must not reach buildDevice, or publishDiscoveredDevices is rejected with a 400.
  const config = normalizeConfig({ poll_frequency: '120' });
  assert.equal(config.poll_frequency, DEFAULT_CONFIG.poll_frequency);
});

test('presence_check defaults to true and only an explicit false disables it', () => {
  assert.equal(normalizeConfig().presence_check, true);
  assert.equal(normalizeConfig({ presence_check: true }).presence_check, true);
  assert.equal(normalizeConfig({ presence_check: false }).presence_check, false);
});
