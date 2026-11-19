// Port Meridian — an original open-world crime game for make.fun gta6-01.
// Node 22, standard library only. This program hands the game in: it
// copies game/ and screenshots/ from beside this file to /output and
// writes /output/dossier.json with the vendored make.fun library, as
// the kit's starter does. The game itself is plain static files in
// game/ that a desktop browser loads offline: game/index.html and its
// ES modules, no library and no network request.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Fail loudly instead of handing in an entry with no screenshots: the
// gate requires 3–4, and a silent empty screenshots/ would waste a submit.
const shotCount = existsSync(join(out, 'screenshots')) ? readdirSync(join(out, 'screenshots')).filter((f) => !f.startsWith('.')).length : 0;
if (shotCount < 3) throw new Error(`Port Meridian: only ${shotCount} screenshot(s) in screenshots/ — need 3 or 4 before handing in.`);
console.log(`Port Meridian: handing in game/ + ${shotCount} screenshot(s) to ${out}`);

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
