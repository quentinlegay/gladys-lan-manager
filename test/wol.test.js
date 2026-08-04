import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMagicPacket, sendWakeOnLan, WOL_PORT } from '../src/wol.js';
import { createFakeGladys } from './helpers/fakeGladys.js';

test('buildMagicPacket builds a 102-byte packet: 6x 0xff followed by 16x the MAC', () => {
  const packet = buildMagicPacket('aa:bb:cc:dd:ee:ff');
  assert.equal(packet.length, 102);
  assert.deepEqual([...packet.subarray(0, 6)], [0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);

  const macBytes = [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff];
  for (let i = 0; i < 16; i += 1) {
    assert.deepEqual([...packet.subarray(6 + i * 6, 12 + i * 6)], macBytes, `repetition ${i}`);
  }
});

test('buildMagicPacket rejects a malformed MAC address', () => {
  assert.throws(() => buildMagicPacket('not-a-mac'), /Invalid MAC address/);
  assert.throws(() => buildMagicPacket('aa:bb:cc:dd:ee'), /Invalid MAC address/);
  assert.throws(() => buildMagicPacket('gg:bb:cc:dd:ee:ff'), /Invalid MAC address/);
});

test('sendWakeOnLan asks the Gladys core to broadcast the magic packet (mediated discovery)', async () => {
  const gladys = createFakeGladys();
  await sendWakeOnLan(gladys, 'aa:bb:cc:dd:ee:ff');

  assert.equal(gladys.scans.length, 1);
  const [scan] = gladys.scans;
  assert.equal(scan.type, 'udp-active-broadcast');
  assert.equal(scan.options.port, WOL_PORT);
  assert.deepEqual(scan.options.payload, buildMagicPacket('aa:bb:cc:dd:ee:ff'));
});
