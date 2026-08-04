import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { checkPresence } from '../src/presence.js';

function listen(server) {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

test('checkPresence resolves true when the TCP port accepts connections', async () => {
  const server = net.createServer((socket) => socket.end());
  const port = await listen(server);
  try {
    assert.equal(await checkPresence('127.0.0.1', port), true);
  } finally {
    server.close();
  }
});

test('checkPresence resolves true when the port is closed but the host answers (ECONNREFUSED)', async () => {
  const server = net.createServer();
  const port = await listen(server);
  await new Promise((resolve) => server.close(resolve));

  assert.equal(await checkPresence('127.0.0.1', port), true);
});

test('checkPresence resolves false when nothing answers', async () => {
  // RFC 5737 TEST-NET-3: reserved for documentation, never routed on a real
  // network, so this stays deterministic in CI.
  assert.equal(await checkPresence('203.0.113.1', 80, 300), false);
});
