# July Oven — mobile companion

The phone app for Project July. One Expo / React Native codebase builds the
**iOS and Android** apps. The app talks to the oven's local `june-local`
server over the home network, with no June cloud involved.

It follows the July Oven design system (`../../design-system`): warm neutrals,
one ember accent, Fraunces / Public Sans / IBM Plex Mono, 18px body text,
touch targets of 48px or more, and light and dark themes.

## What it does

| Screen | |
|---|---|
| **Welcome** | What July Oven is, then *Set up this phone* or *Try the demo first*. |
| **Set up** | Enter the oven's address. The app finds the server (HTTPS first, then the plain :8080 listener) and names this phone. |
| **Pair** | Shows the eight-digit code to type on the oven's Connect screen, with a countdown, then runs the SRP key exchange. |
| **Oven** | Live camera still, large temperature readout, status pill, preheat progress, timer countdown and probe reading. Controls for target temperature, timer and *Stop cooking*. |
| **Start a cook** | Mode (Bake, Roast, Air fry, Broil, Pizza, Reheat, Keep warm, Dehydrate, Proof, Slow cook), temperature and an optional timer. |
| **Live view** | Camera stills refreshed every 400 ms. Keeps the camera awake while open. |
| **Settings** | Oven details, connection, °F/°C, server status page, and unpairing. |

The demo mode is a simulated oven, always labelled *Demo*, so people can try
the app (and designers can review it) without an oven.

## How it talks to the oven

Source of truth: `P:\June\docs\june-protocol-notes.md`, the Go server in
`P:\June\local-resources\june-arch\golocal`, and the tested Python client in
`P:\June\ha-june-oven`. The operator pack (`../project-july-operator-pack`)
covers deployment.

- **Pairing** (`src/api/pairing.ts`). The app registers as a companion
  (`POST /2/devices/register`), opens `wss://<oven>/1/messaging/websocket/companion`,
  mints a code (`POST /2/devices/pairing`) and shows `code + 2 random digits + Damm check`.
  The phone acts as the SRP-6a *server* (RFC 5054 8192-bit group, g = 19, SHA-1,
  identity `user`, password = the full eight digits). Session key is `K = BLAKE2b-256(S)`.
  `companion_info` / `oven_info` are NaCl secretbox, with the nonce prepended.
- **Commands** (`src/api/client.ts`). These are compact JSON frames in the stock
  app's Gson key order, signed with Ed25519 (`signature = base64(blake2b8(pubkey) || sig)`).
  june-local only relays; the **oven** checks the signature, so only paired phones
  can control it. Acknowledgements (`10020`) are matched by `order` and turned into
  plain-language errors ("The oven door is open…").
- **Live state**. `10013` telemetry (milli-°C), `10014`/`10017` cook plan
  start/end, `10018` device state, `10011` camera frames (re-homed from
  `api.junelife.com` to the oven's address), `10012` notifications.
- **Camera**. `GET /media/prod/images/latest.jpg`; `POST /internal/camera/on?seconds=120`
  keeps it awake while Live view is open.

Pairing keys are stored in the iOS Keychain / Android Keystore via
`expo-secure-store` (`AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`).

### Certificates and the :8080 fallback

`june-local` serves the same routes on TLS :443 and plain :8080. The app tries
HTTPS first. If the phone doesn't trust the home certificate yet, it uses :8080
and says so on the setup and settings screens. On :8080, commands are still
signed and pairing is still SRP-protected, but the link itself is not encrypted.

To use HTTPS, generate per-install certs with `generate_certs.sh` (set
`JUNE_IP_SAN` to the oven's IP so the address people type matches the
certificate), then install `ca.crt` on the phone:

- **Android:** Settings → Security → Encryption & credentials → Install a
  certificate → CA certificate. The app's network security config (added by
  `plugins/withLocalNetwork.js`) trusts user CAs.
- **iOS:** AirDrop or email `ca.crt`, install the profile, then turn it on under
  Settings → General → About → Certificate Trust Settings.

## Develop

```bash
npm install
```

```bash
npx expo start
```

The **web** build runs the demo only, because browsers can't reach the oven's
TLS or set WebSocket headers. For a real oven, use a development build on a
phone. Expo Go may reach :8080, but it doesn't include the app's network config plugin:

```bash
npx eas-cli@latest build --profile development --platform android
```

Installable test builds (an APK for Android, internal distribution for iOS):

```bash
npx eas-cli@latest build --profile preview --platform all
```

iOS builds need an Apple Developer account; EAS handles signing, so no Mac is needed.

**Building from P: (a network share).** P: maps to `\\NAS2\gene2\Programming`.
If you run EAS from `P:\…`, Node resolves the project's real path to the UNC
form, so the project root no longer matches the working directory. EAS then
sends an absolute Windows path, and the build fails with
*package.json does not exist in …/P:/June Website/…*. Run EAS from the UNC
path instead. `cmd.exe`, and therefore `npx`, can't start in a UNC folder, so
use Git Bash and call a locally installed eas-cli with `node`:

```bash
cd "//NAS2/gene2/Programming/June Website/apps/july-companion"
EAS_NO_VCS=1 node /path/to/node_modules/eas-cli/bin/run build --profile preview --platform android
```

`EAS_NO_VCS=1` uploads the folder as-is, filtered by `.easignore`. Building from
a local (non-network) copy of the folder also avoids all of this. The project is
linked as `@fixitfelixs-team/project-july`.

### Checks

```bash
npm run typecheck
```

```bash
npx expo lint
```

```bash
npm test
```

```bash
npm run test:integration
```

- `npm test` checks the protocol against the Home Assistant client's test
  vectors: the SRP `B` hash, the Damm check digit, signature layout, and a full
  SRP handshake where both sides derive the same key.
- `npm run test:integration` starts the Python reference server
  (`june_local_cloud.py`, needs `py` and `openssl`) with a throwaway certificate.
  It then drives the app's real `PairingSession` and `LiveOven` against a
  simulated oven: pairing, preheat, timer, temperature change, cancel, camera
  URL, and an Ed25519 check of every frame.

If Node reports *Access is denied* loading a `.node` file (some drives block
native binaries), prefix commands with
`NODE_OPTIONS=--require ./scripts/dev/native-from-c.cjs`.

## Layout

```
src/app/          screens (Expo Router): index, cook, camera, settings, setup/index, setup/pair
src/api/          protocol.ts (crypto + frames), pairing.ts, client.ts (live link),
                  demo.ts, endpoint.ts, modes.ts, pairingCode.ts
src/state/        OvenProvider (paired oven, live link, preferences), secure storage
src/components/   design-system components ported to React Native, icons, OvenHero
src/theme/        tokens mirrored from design-system/tokens.json
plugins/          Android network security config (user CAs, cleartext for :8080)
scripts/          protocol and integration tests
```

## Known gaps

- **Not yet tested on a real oven.** Protocol behaviour comes from the Home
  Assistant integration (which does run against ovens) and the reference server.
  Pair a phone and run the checks in `operations-and-verification.md` before
  handing the app to owners.
- Changing the temperature mid-cook tries `11005`. If the oven refuses, the app
  restarts the cook at the new temperature, as the Home Assistant integration does.
- No recipes or guided programs yet (june-local serves no recipe data), no probe
  target, and one oven per phone.
- Pairing identifies the phone as `platform: "Android"` on both OSes, matching
  the stock app, because the oven's expectations for other values are unknown.
