# Gladys Wake on LAN

External integration for [Gladys Assistant](https://gladysassistant.com),
built on the official
[`GladysAssistant/integration-template-js`](https://github.com/GladysAssistant/integration-template-js)
starter and its
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

Send **Wake-on-LAN magic packets** to power on LAN devices remotely from
your Gladys dashboard.

## What it does

- **Register** LAN devices by name and MAC address (IP optional).
- **Wake** any registered device with a single button press: a `SWITCH/BINARY`
  feature on each device (plus a `wake_device` manifest action) sends it a
  102-byte magic packet.

That's it. No presence detection, no polling, no background probes — just
one-shot wake-up.

## Why a mediated broadcast

The integration container is sandboxed on its own bridge network. A UDP
broadcast sent from inside the container never crosses the NAT to the
physical LAN. Instead, the SDK's `scanNetwork('udp-active-broadcast', …)`
lets the Gladys core — which **does** run on the host network — broadcast
the magic packet on our behalf on port 9 (declared in the manifest
`network_discovery`). See [`src/wol.js`](./src/wol.js) for the full
rationale.

One side-effect: the core rate-limits active-broadcast scans to **one every
10 seconds** per integration — clicking Wake twice in quick succession will
return a 429; wait a few seconds.

## Project structure

```
.
├─ index.js                          # SDK bootstrap + event wiring
├─ src/
│  ├─ devices/
│  │  ├─ networkDevice.js            # blueprint: device payload + Wake command
│  │  └─ index.js                    # registry adapter over the dynamic device list
│  ├─ store.js                       # managed device persistence (add/remove/validate)
│  ├─ wol.js                         # magic packet builder + mediated broadcast
│  └─ config.js                      # config shim (no fields currently)
├─ docs/
│  ├─ en.md                          # user documentation (re-hosted by Gladys)
│  └─ fr.md
├─ gladys-assistant-integration.json # manifest (name, actions, network_discovery)
├─ Dockerfile                        # Node 24 Alpine, read-only rootfs ready
└─ .github/workflows/                # CI + multi-arch release build
```

## Run locally

```bash
npm install
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="gladys-wakeonlan" \
LOG_LEVEL=debug \
npm start
```

## Quality checks

```bash
npm run format:check   # Prettier: is everything formatted?
npm run format         # Prettier: format everything in place
npm run lint           # ESLint: catch real mistakes
npm test               # Unit tests via the built-in node --test runner
```

## Publish in 5 steps

1. **Fork/push** this repository to your own GitHub account.
2. Replace `docker_image` / `cover_image` in
   `gladys-assistant-integration.json` with your own.
3. **Add the GitHub topic** `gladys-assistant-integration` to the repo.
4. **Release from the GitHub UI**: Actions → Release → Run workflow, pick
   `patch`, `minor` or `major`. This bumps the version everywhere, tags
   `vX.Y.Z`, and builds the `linux/amd64` + `linux/arm64` image to `ghcr.io`.
5. The decentralized indexer picks up the new manifest `version` and Gladys
   offers a one-click install/update.

## Notes

- Requires **Node.js ≥ 20**.
- Device external IDs are built from the MAC address via
  `gladys.externalIds('network-device', mac)` — stable even if the IP
  changes over DHCP.
- The WoL broadcast is rate-limited to **one request every 10 seconds**
  per integration.

## License

Apache-2.0


## What it does

- **Register** plain LAN devices that have no API or local protocol of their
  own (a desktop PC, a NAS...) by name, MAC address and IP address.
- **Wake-on-LAN**: a "Wake" button feature on every registered device (plus a
  `wake_device` action) sends it a magic packet.
- **Presence detection** (optional): periodically probes each device's IP to
  report it online/offline, similar in spirit to the internal `lan-manager`
  service's presence sensor — but via a TCP probe instead of an `nmap` ping
  sweep, since a sandboxed container has no raw-socket rights.

Registered devices cannot be _discovered_ the way the internal service does
(`nmap -sn`): a machine you want to wake up is, by definition, usually
powered off and answers nothing. So devices are added by hand through the
**Add a device** manifest action instead of a network scan.

## Why Wake-on-LAN needed a different design than the internal service

Gladys' internal `lan-manager` service
([`server/services/lan-manager`](https://github.com/GladysAssistant/Gladys/tree/master/server/services/lan-manager))
runs inside Gladys core itself, so it can shell out to `nmap` directly on the
host network. An **external** integration cannot: its container is sandboxed
on its own bridge network, and per the SDK documentation, _"a broadcast
emitted from the container does not cross the NAT to the LAN"_ — which is
exactly what a Wake-on-LAN magic packet needs (see
[`src/wol.js`](./src/wol.js) for the detailed rationale).

The SDK's **mediated network discovery** (`gladys.scanNetwork`) exists to let
the Gladys core — which does run on the host network — broadcast a
payload the integration forges, on a manifest-declared port. It was designed
for query/response device discovery (TP-Link Kasa style), but the underlying
primitive is exactly "the core broadcasts our payload on port 9", so this
integration reuses it to deliver the magic packet.

Presence detection avoids the internal service's `nmap` dependency (which
needs elevated privileges) in favor of a plain TCP connect probe — a regular
unicast packet, which (unlike broadcast) does cross the container's network
boundary just fine.

## Project structure

```
.
├─ index.js                          # SDK bootstrap + event wiring (no device logic)
├─ src/
│  ├─ devices/
│  │  ├─ networkDevice.js            #   "one blueprint, many instances": device payload + commands
│  │  └─ index.js                    #   registry adapter over the dynamic device list
│  ├─ store.js                       # managed device persistence (add/remove/validate)
│  ├─ wol.js                         # Wake-on-LAN magic packet + mediated broadcast
│  ├─ presence.js                    # TCP presence probe
│  └─ config.js                      # config defaults + normalization
├─ docs/
│  ├─ en.md                          # user documentation (re-hosted by Gladys)
│  └─ fr.md
├─ gladys-assistant-integration.json # manifest (name, config schema, actions, network_discovery)
├─ Dockerfile                        # Node 24 Alpine, read-only rootfs ready
└─ .github/workflows/                # CI + multi-arch release build (from the template, unmodified)
```

Unlike the template's fixed, one-file-per-device-type catalog, the device
list here is **dynamic**: it grows and shrinks as the user runs the
`add_device` / `remove_device` actions. `src/devices/networkDevice.js` is the
blueprint for one stored entry; `src/devices/index.js` maps it over the
whole list and routes commands/polls back to the right entry.

## Run it locally

```bash
npm install
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="lan-manager" \
LOG_LEVEL=debug \
npm start
```

## Quality checks

```bash
npm run format:check   # Prettier: is everything formatted?
npm run format         # Prettier: format everything in place
npm run lint           # ESLint: catch real mistakes (unused vars, dead code…)
npm test               # Unit tests, via the built-in `node --test` runner
```

## Validate before publishing

```bash
npx github:GladysAssistant/integration-store .
```

Runs the exact checks the store indexer runs (manifest, Docker image, cover
image, code rules) locally, before tagging a release.

## Publish in 5 steps

1. **Fork/push** this repository to your own GitHub account.
2. Replace `docker_image` / `cover_image` in
   `gladys-assistant-integration.json` with your own if you forked it further.
3. **Add the GitHub topic** `gladys-assistant-integration` to the repo.
4. **Release from the GitHub UI**: **Actions → Release → Run workflow**, pick
   `patch`, `minor` or `major`. This bumps the version everywhere, tags
   `vX.Y.Z`, and builds the `linux/amd64` + `linux/arm64` image to `ghcr.io`.
5. The decentralized indexer picks up the new manifest `version` and Gladys
   offers a one-click install/update.

Full documentation: <https://gladysassistant.com> (integrations developer guide).

## Notes

- Requires **Node.js ≥ 20**.
- All external identifiers are prefixed with `ext:<selector>:` — built with
  `gladys.externalIds(type, platformId)`; the platform id is the device's
  MAC address, unique and stable even if its IP changes over DHCP.
- The Wake-on-LAN broadcast is rate-limited by the Gladys core to **one
  request every 10 seconds** per integration (`network_discovery` guardrail):
  clicking "Wake" again immediately fails with a 429 — wait a few seconds.
- Replace `cover.png` with your own 800×534 px image (≤150 KB, PNG or JPEG)
  before publishing. The bundled one is the template's plain gradient
  placeholder.

## License

Apache-2.0
