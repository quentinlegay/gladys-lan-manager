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

export const DEVICE_TYPE = 'network-device';

const logger = createLogger({ name: DEVICE_TYPE });

export const FEATURE = { WAKE: 'wake' };

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
 * @param {object} config - Normalized integration config (unused, reserved for future settings).
 * @param {object} entry - Stored device `{ name, mac, ip? }`.
 * @returns {object} The device payload for `publishDiscoveredDevices`.
 * @example
 * const device = buildDevice(gladys, config, entry);
 */
export function buildDevice(gladys, config, entry) {
  const ids = deviceIds(gladys, entry);

  const params = [{ name: 'MAC_ADDRESS', value: entry.mac }];
  if (entry.ip) {
    params.push({ name: 'IP_ADDRESS', value: entry.ip });
  }

  return {
    name: entry.name,
    external_id: ids.device,
    params,
    features: [
      {
        name: 'Wake',
        external_id: ids.feature(FEATURE.WAKE),
        category: DEVICE_FEATURE_CATEGORIES.SWITCH,
        type: DEVICE_FEATURE_TYPES.SWITCH.BINARY,
        min: 0,
        max: 1,
        read_only: false, // actuator: pressing it sends the magic packet
        has_feedback: true,  // onSetValue calls publishState to confirm the new value
        keep_history: false,
      },
    ],
  };
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
export async function onSetValue(gladys, config, entry, feature, value) {
  const ids = deviceIds(gladys, entry);
  if (feature.external_id !== ids.feature(FEATURE.WAKE)) {
    throw new Error(`Feature ${feature.external_id} is not writable`);
  }
  // Only send the magic packet when the user flips the switch ON.
  // Flipping it back OFF has no hardware effect (there is no WoL-off),
  // but we still confirm the state so the UI reflects what the user chose.
  if (value === 1) {
    await triggerWake(gladys, entry);
  }
  await gladys.publishState(feature.external_id, value);
}
