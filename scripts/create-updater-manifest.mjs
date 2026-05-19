import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const githubRepo = 'https://github.com/cat-xierluo/Folia';
const giteeRepo = 'https://gitee.com/cat-xierluo/Folia';
const version = process.env.FOLIA_UPDATE_VERSION ?? '0.1.0';
const tag = process.env.FOLIA_UPDATE_TAG ?? `v${version}`;
const notes = process.env.FOLIA_UPDATE_NOTES ?? '';

const platforms = {};

// macOS aarch64
const macSigPath = resolve('src-tauri/target/release/bundle/macos/Folia.app.tar.gz.sig');
try {
  const macSig = (await readFile(macSigPath, 'utf8')).trim();
  platforms['darwin-aarch64'] = {
    signature: macSig,
    url: `${githubRepo}/releases/download/${tag}/Folia.app.tar.gz`,
  };
} catch {
  console.warn('Skipping darwin-aarch64: signature file not found');
}

const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms,
};

// Write latest.json (unified manifest)
const outputPath = resolve('src-tauri/target/release/bundle/updater/latest.json');
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);

// Also write a Gitee-flavored manifest with Gitee download URLs
const giteeManifest = structuredClone(manifest);
for (const platform of Object.keys(giteeManifest.platforms)) {
  giteeManifest.platforms[platform].url =
    `${giteeRepo}/releases/download/${tag}/Folia.app.tar.gz`;
}
const giteePath = resolve('src-tauri/target/release/bundle/updater/latest-gitee.json');
await writeFile(giteePath, `${JSON.stringify(giteeManifest, null, 2)}\n`);
console.log(`Wrote ${giteePath}`);
