# Binfinity

**Parametric generator for 3D-printable storage.** Gridfinity baseplates today, bins, custom boxes and inserts next. Everything is computed in your browser with a real CAD kernel ([OpenCascade](https://dev.opencascade.org/) via [replicad](https://replicad.xyz)), and you download STL or 3MF files ready for your slicer.

> 🇩🇪 Binfinity erzeugt Gridfinity-Baseplates (bald auch Bins, eigene Boxen und Einsätze) direkt im Browser und exportiert STL oder 3MF. Die Oberfläche gibt es auf Deutsch und Englisch. Self-Hosting per Docker, z. B. auf ZimaOS, siehe unten.

## Features

**Baseplates**
- Size by grid units or by **drawer size**: Binfinity fits as many cells as possible and fills the rest with a solid border (centered or aligned to a side).
- **Automatic splitting** for your print bed (default 256 × 256 mm, Bambu Lab P2S/P1S/X1). Pieces are balanced so you don't end up with a sliver.
- Slim (open cells, minimal filament) or with a floor.
- Magnet holes (default 6.5 mm × 2.4 mm for 6 × 2 mm magnets) and M3 countersunk screw holes.
- Adjustable outer corner radius.

**General**
- Live 3D preview, shareable links (all parameters live in the URL).
- **3MF** export with one object per piece (Bambu Studio, Orca, PrusaSlicer), or **STL** (zipped when split).
- Watertight, correctly oriented meshes, checked by the test suite.
- Runs fully client-side: no server, no account, no tracking.

## Roadmap

1. ✅ Gridfinity baseplates
2. Gridfinity bins: size in units, height, dividers, label tab, stacking lip, scoop, magnet/screw holes
3. Custom boxes in mm, optionally stackable, with lids
4. Custom inserts and cut-outs

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
