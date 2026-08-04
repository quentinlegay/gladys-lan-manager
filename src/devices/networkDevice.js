// -----------------------------------------------------------------------------
// Device type: NETWORK DEVICE
//
// A LAN device registered by the user (name + MAC + IP) so Gladys can send it
// a Wake-on-LAN packet and, optionally, poll whether it currently answers on
// the network.
//
// Unlike the template's demo devices (one fixed instance per file), the LAN
// Manager device list is DYNAMIC: the user grows and shrinks it from the
// Configuration screen actions (`add_device` / `remove_device`, wired in
// index.js, persisted by src/store.js). This module only knows how to turn
// ONE stored entry `{ name, mac, ip, port? }` into a Gladys device payload and
// how to react to a command on it; src/devices/index.js maps that over the
// whole stored list.
// -----------------------------------------------------------------------------

import {
  createLogger,
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
} from '@gladysassistant/integration-sdk';
import { sendWakeOnLan } from '../wol.js';
import { checkPresence } from '../presence.js';

export const DEVICE_TYPE = 'network-device';

const logger = createLogger({ name: DEVICE_TYPE });

export const FEATURE = { WAKE: 'wake', PRESENCE: 'presence' };

/**
 * @description Build the device/feature external ids of one stored entry.
 * The MAC is the platform id: unique and stable even if the IP changes on a
 * DHCP renewal.
 * @param {object} gladys - The connected GladysIntegration instance.
 * @param {object} entry - Stored device `{ name, mac, ip, port? }`.
 * @returns {{ device: string, feature: (key: string) => string }} The ids.
 * @example
 * const ids = deviceIds(gladys, entry);
 */
export function deviceIds(gladys, entry) {
  return gladys.externalIds(DEVICE_TYPE, entry.mac);
}

/**
 * @description Build the Gladys discovery payload for one stored entry.
 * @param {object} gladys - The connected GladysIntegration instance.
 * @param {object} config - Normalized integration config.
 * @param {object} entry - Stored device `{ name, mac, ip, port? }`.
 * @returns {object} The device payload for `publishDiscoveredDevices`.
 * @example
 * const device = buildDevice(gladys, config, entry);
 */
export function buildDevice(gladys, config, entry) {
  const ids = deviceIds(gladys, entry);

  const device = {
    name: entry.name,
    external_id: ids.device,
    ip: entry.ip,
    params: [
      { name: 'MAC_ADDRESS', value: entry.mac },
      { name: 'IP_ADDRESS', value: entry.ip },
    ],
    features: [
      {
        name: 'Wake',
        external_id: ids.feature(FEATURE.WAKE),
        category: DEVICE_FEATURE_CATEGORIES.BUTTON,
        type: DEVICE_FEATURE_TYPES.BUTTON.CLICK,
        read_only: false, // actuator: pressing it sends the magic packet
        has_feedback: false, // momentary trigger, not a persisted power state
        keep_history: false,
      },
    ],
  };

  if (config.presence_check) {
    device.features.push({
      name: 'Presence',
      external_id: ids.feature(FEATURE.PRESENCE),
      category: DEVICE_FEATURE_CATEGORIES.PRESENCE_SENSOR,
      type: DEVICE_FEATURE_TYPES.SENSOR.BINARY,
      min: 0,
      max: 1,
      read_only: true, // measurement: no action possible
      has_feedback: false,
      keep_history: true,
    });
    // Gladys will call onPoll at this interval (in seconds).
    device.poll_frequency = config.poll_frequency;
  }

  return device;
}

/**
 * @description Send the device its Wake-on-LAN packet. Shared by the "Wake"
 * device feature (onSetValue below) and the standalone `wake_device` manifest
 * action (index.js), so both paths go through the exact same code.
 * @param {object} gladys - The connected GladysIntegration instance.
 * @param {object} entry - Stored device `{ name, mac, ip, port? }`.
 * @returns {Promise<void>} Resolves once the packet was broadcast.
 * @example
 * await triggerWake(gladys, entry);
 */
export async function triggerWake(gladys, entry) {
  logger.info(`Waking "${entry.name}" (${entry.mac})...`);
  await sendWakeOnLan(gladys, entry.mac);
}

/**
 * @description Handle a command on one of this device's features.
 * @param {object} gladys - The connected GladysIntegration instance.
 * @param {object} config - Normalized integration config (unused, kept for a
 * consistent blueprint signature).
 * @param {object} entry - Stored device `{ name, mac, ip, port? }`.
 * @param {object} feature - The feature the command targets.
 * @returns {Promise<void>} Resolves once the command was handled.
 * @example
 * await onSetValue(gladys, config, entry, feature, 1);
 */
export async function onSetValue(gladys, config, entry, feature) {
  const ids = deviceIds(gladys, entry);
  if (feature.external_id !== ids.feature(FEATURE.WAKE)) {
    throw new Error(`Feature ${feature.external_id} is read-only`);
  }
  await triggerWake(gladys, entry);
}

/**
 * @description Refresh the presence state of one device.
 * @param {object} gladys - The connected GladysIntegration instance.
 * @param {object} config - Normalized integration config.
 * @param {object} entry - Stored device `{ name, mac, ip, port? }`.
 * @returns {Promise<void>} Resolves once the state was published.
 * @example
 * await onPoll(gladys, config, entry);
 */
export async function onPoll(gladys, config, entry) {
  if (!config.presence_check) {
    return;
  }
  const ids = deviceIds(gladys, entry);
  const online = await checkPresence(entry.ip, entry.port || config.presence_check_port);
  logger.debug(`Presence of "${entry.name}" (${entry.ip}): ${online ? 'online' : 'offline'}`);
  await gladys.publishState(ids.feature(FEATURE.PRESENCE), online ? 1 : 0);
}
