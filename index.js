// -----------------------------------------------------------------------------
// LAN Manager — entry point.
//
// Lets Gladys manage plain LAN devices that have no API of their own:
// register them by name/MAC/IP, trigger a Wake-on-LAN magic packet, and
// (optionally) poll whether they currently answer on the network.
//
// The device list is DYNAMIC — grown and shrunk by the user through the
// `add_device` / `remove_device` manifest actions (src/store.js) — instead of
// the template's fixed, one-per-file devices. See src/devices/networkDevice.js
// for the "one blueprint, many instances" adapter and src/devices/index.js for
// the dispatch helpers used below.
//
// Environment variables provided by the Gladys supervisor to the container:
//   - GLADYS_HOST_API_URL         (host API URL)
//   - GLADYS_INTEGRATION_TOKEN    (integration-scoped JWT)
//   - GLADYS_INTEGRATION_SELECTOR (integration identifier)
// The SDK reads them automatically: `new GladysIntegration()` is enough.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig } from './src/config.js';
import { addManagedDevice, getManagedDevices, removeManagedDevice } from './src/store.js';
import {
  buildDiscoveredDevices,
  dispatchSetValue,
  findEntryByQuery,
} from './src/devices/index.js';
import { deviceIds, triggerWake } from './src/devices/networkDevice.js';

const gladys = new GladysIntegration();

// Current configuration (hot-reloaded via onConfigUpdated).
let config = normalizeConfig();

async function republishDevices() {
  const entries = getManagedDevices(gladys);
  await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, config, entries));
}

// --- Discovery: Gladys asks for the list of devices --------------------------
gladys.onScanRequest(async () => {
  logger.info('onScanRequest -> publishing managed devices');
  await republishDevices();
});

// --- Command: the user presses "Wake" on a device -----------------------------
gladys.onSetValue(async (device, feature, value) => {
  logger.info(`onSetValue <- ${feature.external_id} = ${value}`);
  await dispatchSetValue(gladys, config, getManagedDevices(gladys), device, feature, value);
});

// --- Manifest actions: buttons in the Configuration screen -------------------
gladys.onAction('add_device', async (fields) => {
  const device = await addManagedDevice(gladys, fields);
  await republishDevices();
  logger.info(`Action add_device -> "${device.name}" (${device.mac})`);
  return {
    en: `"${device.name}" was added. Find it in the Discovery tab to create it.`,
    fr: `« ${device.name} » a été ajouté. Retrouvez-le dans l'onglet Découverte pour le créer.`,
  };
});

gladys.onAction('remove_device', async (fields) => {
  const entry = findEntryByQuery(getManagedDevices(gladys), fields.device);
  if (!entry) {
    return { en: 'Device not found.', fr: 'Appareil introuvable.' };
  }
  await removeManagedDevice(gladys, deviceIds(gladys, entry).device);
  await republishDevices();
  logger.info(`Action remove_device <- "${entry.name}" (${entry.mac})`);
  return { en: 'Device removed from LAN Manager.', fr: 'Appareil supprimé de LAN Manager.' };
});

gladys.onAction('wake_device', async (fields) => {
  const entry = findEntryByQuery(getManagedDevices(gladys), fields.device);
  if (!entry) {
    throw new Error('Device not found');
  }
  await triggerWake(gladys, entry);
  return {
    en: `Wake-on-LAN packet sent to "${entry.name}".`,
    fr: `Paquet Wake-on-LAN envoyé à « ${entry.name} ».`,
  };
});

// --- Configuration updated by the user ---------------------------------------
gladys.onConfigUpdated(async (newConfig) => {
  logger.info('onConfigUpdated -> new configuration received');
  config = normalizeConfig(newConfig);
  // Re-publish the devices: the presence feature and poll_frequency depend on
  // config.presence_check / config.poll_frequency. Idempotent: upsert by
  // external_id.
  await republishDevices();
});

// --- Connection lifecycle ----------------------------------------------------
// The SDK itself logs the WebSocket lifecycle (connections, disconnections,
// reconnection attempts) under the `gladys-sdk` name: no need to log it again
// here, this handler only runs the integration's own (re)initialization.
gladys.on('connected', async () => {
  try {
    // 1) Fetch the config filled in by the user.
    config = normalizeConfig(await gladys.getConfig());

    // 2) (Re)publish all managed devices as soon as we are connected.
    await republishDevices();

    // 3) Report the application-level status, shown in the Configuration
    // screen. Distinct from the container state machine: an integration can
    // be RUNNING and still disconnected from its third-party service.
    await gladys.setConnectionStatus(true);
  } catch (err) {
    logger.error('Post-connection initialization failed', err);
    await gladys
      .setConnectionStatus(false, {
        en: 'Initialization failed, check the integration logs.',
        fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
      })
      .catch(() => {});
  }
});

// --- Graceful shutdown -------------------------------------------------------
// The SDK stops the push subscriptions, disconnects cleanly and exits with
// code 0 when the supervisor stops the container (SIGTERM/SIGINT).
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal} -> graceful shutdown`);
});

// --- Startup -----------------------------------------------------------------
logger.info('Starting the LAN Manager integration...');
gladys.connect().catch((err) => {
  logger.error('Initial connection failed', err);
  process.exit(1);
});
