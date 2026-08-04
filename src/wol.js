// -----------------------------------------------------------------------------
// Wake-on-LAN.
//
// A WOL "magic packet" is a UDP broadcast: 6 bytes of 0xFF followed by the
// target MAC address repeated 16 times, sent to port 9 on the LAN broadcast
// address. Delivery relies on it being an L2 broadcast frame (the target has
// no IP stack running yet, so nothing routable can reach it) — every host on
// the segment receives it, and the NIC with the matching MAC wakes the rest
// of the machine.
//
// The integration container itself CANNOT send that broadcast: it runs
// sandboxed on a bridge network, and a broadcast it emits never crosses the
// NAT to the physical LAN (see the SDK README, "Mediated network discovery").
// Only the Gladys core, which runs on the host network, can put a broadcast
// frame on the wire. So instead of a raw UDP socket, we ask the core to do it
// for us: `scanNetwork('udp-active-broadcast', ...)` was designed for
// query/response protocol discovery (TP-Link Kasa style), but underneath it
// is exactly "the core broadcasts an integration-forged payload on a declared
// port" — precisely what a magic packet needs. We do not care about replies.
// -----------------------------------------------------------------------------

// Standard Wake-on-LAN discard port. Must be declared in the manifest
// `network_discovery` field (`udp-active-broadcast` ports) for scanNetwork to
// accept it.
export const WOL_PORT = 9;

const MAC_BYTE_COUNT = 6;
const MAC_REPETITIONS = 16;

/**
 * @description Build the 102-byte Wake-on-LAN magic packet for a MAC address.
 * @param {string} mac - Colon-separated MAC address, e.g. "aa:bb:cc:dd:ee:ff".
 * @returns {Buffer} The magic packet payload.
 * @example
 * const payload = buildMagicPacket('aa:bb:cc:dd:ee:ff');
 */
export function buildMagicPacket(mac) {
  const bytes = String(mac)
    .trim()
    .split(':')
    .map((part) => Number.parseInt(part, 16));
  if (
    bytes.length !== MAC_BYTE_COUNT ||
    bytes.some((byte) => Number.isNaN(byte) || byte < 0 || byte > 255)
  ) {
    throw new Error(`Invalid MAC address: "${mac}"`);
  }

  const macBytes = Buffer.from(bytes);
  const packet = Buffer.alloc(MAC_BYTE_COUNT + MAC_REPETITIONS * MAC_BYTE_COUNT, 0xff);
  for (let i = 0; i < MAC_REPETITIONS; i += 1) {
    macBytes.copy(packet, MAC_BYTE_COUNT + i * MAC_BYTE_COUNT);
  }
  return packet;
}

/**
 * @description Send a Wake-on-LAN magic packet to a device, through the
 * Gladys core's mediated broadcast. Rate-limited by the core to one active
 * scan every 10 seconds per integration: callers should surface that error
 * (`GladysApiError` with `status === 429`) instead of retrying immediately.
 * @param {object} gladys - The connected GladysIntegration instance.
 * @param {string} mac - MAC address of the device to wake.
 * @returns {Promise<void>} Resolves once the core has broadcast the packet.
 * @example
 * await sendWakeOnLan(gladys, 'aa:bb:cc:dd:ee:ff');
 */
export async function sendWakeOnLan(gladys, mac) {
  const payload = buildMagicPacket(mac);
  await gladys.scanNetwork('udp-active-broadcast', { port: WOL_PORT, payload, timeoutSeconds: 1 });
}
