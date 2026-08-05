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

