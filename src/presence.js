// -----------------------------------------------------------------------------
// Presence detection.
//
// No ICMP: sandboxed containers rarely carry the setuid/CAP_NET_RAW rights a
// real `ping` needs. A plain TCP connect attempt is enough, and it is a
// regular unicast packet — unlike broadcast, it crosses the integration's
// bridge network to the LAN just fine (see src/wol.js for the broadcast
// limitation). Either an accepted connection OR an immediate refusal
// (ECONNREFUSED, the host answers with a TCP RST) proves the host is up;
// only a timeout or an unreachable error means it looks offline.
// -----------------------------------------------------------------------------

import net from 'node:net';

const DEFAULT_TIMEOUT_MS = 1500;

/**
 * @description Probe whether a host is reachable on the network.
 * @param {string} host - IP address (or hostname) to probe.
 * @param {number} port - TCP port to connect to.
 * @param {number} [timeoutMs] - How long to wait before giving up.
 * @returns {Promise<boolean>} True when the host looks online.
 * @example
 * const online = await checkPresence('192.168.1.42', 80);
 */
export function checkPresence(host, port, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const finish = (online) => {
      if (settled) {
        return;
      }
      settled = true;
      socket.destroy();
      resolve(online);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', (err) => finish(err.code === 'ECONNREFUSED'));
    socket.connect(port, host);
  });
}
