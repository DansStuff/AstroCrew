# Astro Crew

Multiplayer Decentraland scene. A crew flies one ship along an authored route, and at each planet stop they shoot incoming asteroids and saucers, repair hull breaches, and earn gunner and engineering levels. The fight is simulated on an authoritative multiplayer server (`authoritativeMultiplayer` in `scene.json`). The deployed world is `astrocrew.dcl.eth`.

The visible ship stays fixed in the scene. Flight is a virtual pose, and planets, stars, and hazards are projected around it.

```bash
npm install
npm start
```

## Map editor

`tools/path-editor` is a top-down XZ editor for the flight path and planets. It reads and writes `src/path/routedata.ts`, which exports `SHIP_ROUTE` (`planets` and `legs`). The runtime bakes those legs into the polyline the ship follows. Stop ids on the path are the encounter ids looked up in `ENCOUNTER_PARAMS`.

Save TypeScript can write that file only while the editor's own server is running. Open the page from that server:

```bash
npm run path-editor
```

That serves the editor at [http://127.0.0.1:4177/](http://127.0.0.1:4177/). `PATH_EDITOR_PORT` changes the port (default `4177`). **Save TypeScript** posts the module to the server, which overwrites `src/path/routedata.ts`. **Load map** with an empty text box reads that file back. Pasting a `SHIP_ROUTE` module into the box and pressing **Load map** reloads from the paste instead.

If the server is not running, Save cannot write to disk. It copies the TypeScript to the clipboard and tells you to start `npm run path-editor`.

On the map:

- **Select** drags planets and waypoints. Right-drag pans, the wheel zooms.
- **Add waypoint** extends the open path. The first waypoint is Start and is not an encounter. The path does not loop. Double-click a later waypoint to toggle a stop.
- **Remove waypoint** deletes the point you click.
- **Add planet** places a planet. The inspector sets its name, model path, XZ, and radius.
- **Play** / **Reset** preview cruise, hold time, and accel/decel. Those playback numbers are for the editor; the scene's cruise speed and path sampling live in `src/constants.ts`.

## Source layout

`src/` is grouped by domain. `src/index.ts` is the composition root: `main()` calls each domain's `setup*` and returns early on the server, so client-only systems (HUD, camera shake, death spin) are not started there.

| Path | Role |
| --- | --- |
| `audio/` | Global and per-entity sounds |
| `effects/` | Camera shake, death spin, beams |
| `encounters/` | One server-side fight, plus client encounter presentation |
| `gamestate/` | Synced state, schema, and the mission state machine |
| `hazards/` | Asteroid and saucer simulation, targeting, and visuals |
| `leaderboard/` | Round scoreboard and weekly board |
| `networking/` | Client/server message schemas |
| `path/` | Authored route (`routedata.ts`), route types, and path follow |
| `players/` | Persistent skill stats and per-mission contributions |
| `shipweapons/` | Turret lasers |
| `spaceobjects/` | Planets, stars, and projection onto the view shell |
| `ui/` | HUD pieces used by `src/ui.tsx` |

Files that sit next to those folders (`sceneObjects.ts`, `ship.ts`, `utilities.ts`, `objectPool.ts`) are shared by more than one domain.

## `src/constants.ts`

All tuning lives here: hull, damage, XP, spawn timing, path sampling, projection, weapons, and HUD layout. Sections are marked in the file (`Simulation`, `Difficulty`, `Ship`, `Miniship`, `Path`, `Projection`, `Stars`, `Hazards`, `Ship Weapons`, `Encounters`, `UI`).

`ENCOUNTER_PARAMS` is the per-stop combat table. Each key is a stop id from the map (Terra, Vaelith, and the rest) and sets that encounter's HP and damage multipliers plus its asteroid and saucer stages. Planet positions and the path itself are not in this file; the map editor owns those in `src/path/routedata.ts`.

## SDK

Installed from the `auth-server` branch:

| Package | Version |
| --- | --- |
| `@dcl/sdk` | `7.27.1-33086747846.commit-824d240` |
| `@dcl/js-runtime` | `7.27.1-33086747846.commit-824d240` |

Auth-server commit: `824d240`.

## Known issues

Shaking the ship entity makes the player fall through the hull on the mobile client. `shakeShip` in `src/effects/cameraShake.ts` returns immediately when `isMobile()` is true (line 78), so impacts and the death spin still shake the camera but leave the ship still. Desktop is unchanged. That early return can come out if a future mobile client stops dropping the player when the ship transform jitters.
