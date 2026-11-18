# Astro Crew

- [Source on GitHub](https://github.com/DansStuff/AstroCrew)
- [Play on Decentraland](https://decentraland.org/play/?realm=astrocrew.dcl.eth)

A co-op scene where the crew shares one ship. At each stop they shoot incoming asteroids and saucers, repair hull breaches, and raise gunner and engineering levels. The fight runs on an authoritative multiplayer server.

## Key features

- **Authoritative multiplayer** for the whole fight. Clients send requests to target, repair, and overcharge. The server owns hull, breaches, and spawns, and synced `GameState` and `PlayerStats` only accept writes from the auth server.
- **Storage** for each player's gunner and engineering levels, and a weekly mission leaderboard.
- **Virtual cameras** on the three turrets, blended in with a timed transition. Impacts shake those cameras. Taking a gun freezes the avatar with **InputModifier** and hides the mobile joystick and crosshair with **TouchScreenControls**.
- **PrimaryPointerInfo** aims each shot from the pointer's world ray. **PointerLock** stays released so **PointerEvents** can still drive the consoles, the hold-to-repair breaches, and the mission table.
- **GltfNodeModifiers** recolor the ship's emissive meshes: green while cruising, red during an encounter, and a second set while weapons are overcharged.
- **ReactEcs** HUD for hull, skill levels, and the end-of-round board. Off-screen breach icons sit on the screen edge, placed with **UiCanvasInformation**.
- **Billboards**, **TextShape**, and **avatar textures** on each target: a camera-facing crosshair, a "Target Locked" label, and portraits of whoever is shooting it.
- **Animator** loops the saucer spin clip. **AudioSource** plays stingers and loops, with a pool of laser one-shots so a shot can restart while the last clip is still playing. Clips are preloaded with **AssetLoad**.
- In-world **TextShape** rows for the weekly board. Clicking a row opens that mission's results.
- **AvatarModifierArea** turns off the passport prompt across the scene.
