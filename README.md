# Binfinity

**Parametric generator for 3D-printable storage.** Gridfinity baseplates and bins, custom boxes and inserts that hold tools, batteries and memory cards. Everything is computed in your browser with a real CAD kernel ([OpenCascade](https://dev.opencascade.org/) via [replicad](https://replicad.xyz)), and you download STL or 3MF files ready for your slicer.

> 🇩🇪 Binfinity erzeugt Gridfinity-Baseplates und -Bins sowie eigene Boxen und Einsätze (Bits, Fräser, Bohrer, Batterien, USB-Sticks, SD-Karten) direkt im Browser und exportiert STL oder 3MF. Die Oberfläche gibt es auf Deutsch und Englisch. Self-Hosting per Docker, z. B. auf ZimaOS, siehe unten.

## Features

**Baseplates**
- Size by grid units or by **drawer size**: Binfinity fits as many cells as possible and fills the rest with a solid border (centered or aligned to a side).
- **Automatic splitting** for your print bed (default 256 × 256 mm, Bambu Lab P2S/P1S/X1). Pieces are balanced so you don't end up with a sliver.
- Slim (open cells, minimal filament) or with a floor.
- Magnet holes (default 6.5 mm × 2.4 mm for 6 × 2 mm magnets) and M3 countersunk screw holes.
- **Connectors** for split plates (with floor): dovetail puzzle joints, printed pegs that the neighbour is pressed onto, or holes for 1.75 mm filament pins.
- Adjustable outer corner radius.

**Bins**
- Any size from 1 × 1 to 10 × 10 units; height in 7 mm units or in mm.
- Standard Gridfinity feet, optional stacking lip with a printable 45° support and rounded top edge.
- Compartments in both directions, finger scoop, label shelf.
- Wall, divider and floor thickness.
- Optional **honeycomb walls** to save filament.
- Magnet holes and M3 screw holes in every foot.

**Boxes**
- Rectangular (with corner radius), round or hexagonal, sized by outside or inside dimensions in mm.
- Wall and floor thickness, compartments and honeycomb walls for rectangular boxes.
- Stackable: a recessed foot drops into the opening of the box below.
- Lift-off lid with insert ring, printed as a second object.

**Inserts**
- Holes or slots that hold items upright: presets for 1/4" hex bits, router bits (6/8/12 mm shank), AA and AAA batteries, USB-A/USB-C sticks, SD and microSD cards, or your own sizes.
- **Drill sets**: one hole per size from a list such as `2-20` or `1-6/0.5 8 10`.
- Spacing from the widest part of the item (e.g. a 20 mm router bit head) plus room for your fingers; adjustable play in the openings and a lead-in chamfer.
- As a Gridfinity bin (1 × 1 to 10 × 10, automatic height, stacking lip, magnets) or as a loose block for a box.

**General**
- Live 3D preview on your print bed(s), or assembled; shareable links (all parameters live in the URL).
- Parts are centred on the bed; anything that doesn't fit one bed is spread over several.
- **3MF** export with one object per piece (Bambu Studio, Orca, PrusaSlicer), or **STL** (zipped when split).
- No sharp edges: ridges, rims, divider tops and lids are rounded, edges on the print bed get a small chamfer, magnet holes a lead-in.
- Watertight, correctly oriented meshes, checked by the test suite.
- Runs fully client-side: no server, no account, no tracking.

## Roadmap

1. ✅ Gridfinity baseplates
2. ✅ Gridfinity bins
3. ✅ Custom boxes in mm, stackable, with lids
4. ✅ Inserts for tools, batteries and memory cards
5. Inserts shaped after your own parts (cut-outs from outlines)

## Self-hosting with Docker

The image is a small nginx serving the static app (amd64 and arm64).

```sh
docker run -d --name binfinity -p 8090:8080 --restart unless-stopped ghcr.io/julianroeben-a11y/binfinity:latest
```

Then open `http://<your-host>:8090`.

### ZimaOS / CasaOS

1. Open the App Store, click **+** and choose **Install a customized app**.
2. Click **Import** and paste the contents of [`docker-compose.yml`](docker-compose.yml).
3. Install. Binfinity appears on the dashboard and listens on port 8090.

Change the left-hand port in `docker-compose.yml` if 8090 is taken.

### Updating

The compose file includes an optional helper (`binfinity-updater`, a [Watchtower](https://hub.docker.com/r/nickfedor/watchtower) instance limited to this app). With it, the app shows its version in the top bar and an **Update** button that pulls the newest image and restarts the container; the page reloads itself when the new version is up. The helper needs access to the Docker socket. If you don't want that, delete the `binfinity-updater` service and `UPDATE_TOKEN`, and update by hand:

```sh
docker pull ghcr.io/julianroeben-a11y/binfinity:latest
docker compose up -d   # in the directory of your compose file
```

`UPDATE_TOKEN` and `WATCHTOWER_HTTP_API_TOKEN` must match; the helper is not exposed outside the compose network. Both containers must share a user-defined network (`binfinity` in the compose file): on Docker's default `bridge` network the app cannot resolve the helper's name and the button reports "Update helper not reachable".

## Development

Requires Node.js 22+.

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # unit + geometry tests (OpenCascade runs in Node)
npm run build      # static site in dist/
```

Project layout:

| Path | What |
| --- | --- |
| `src/models/<model>/schema.ts` | Parameters and form layout (no CAD imports, loaded by the UI) |
| `src/models/<model>/build.ts` | Geometry, runs in the CAD web worker |
| `src/models/gridfinity.ts` | Gridfinity dimensions |
| `src/worker/` | Web worker running OpenCascade, and its client |
| `src/export/` | Mesh welding, STL and 3MF writers |
| `src/ui/` | Form renderer and three.js viewer |

Adding a model means writing a schema, a build function, registering both (in `src/main.ts` and `src/worker/cad.worker.ts`) and adding translations in `src/i18n.ts`.

## Credits and licenses

Binfinity is MIT licensed, see [LICENSE](LICENSE).

- [Gridfinity](https://gridfinity.xyz) was created by Zack Freedman (MIT). Dimensions follow the original spec and [gridfinity-rebuilt-openscad](https://github.com/kennetek/gridfinity-rebuilt-openscad).
- [replicad](https://github.com/sgenoud/replicad) by Steve Genoud (MIT).
- [OpenCascade Technology](https://dev.opencascade.org/) is distributed as WebAssembly under LGPL-2.1 with the OCCT exception (`replicad-opencascadejs`).
- [three.js](https://threejs.org) (MIT), [fflate](https://github.com/101arrowz/fflate) (MIT).
