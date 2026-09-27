import { copyFile, mkdir, readdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const destination = join(root, 'public', 'ocr')
const tesseractDir = dirname(require.resolve('tesseract.js/package.json'))
const core = dirname(require.resolve('tesseract.js-core/package.json', { paths: [tesseractDir] }))

await mkdir(join(destination, 'core'), { recursive: true })
await mkdir(join(destination, 'lang'), { recursive: true })
await copyFile(
  require.resolve('tesseract.js/dist/worker.min.js'),
  join(destination, 'worker.min.js'),
)
const license = require.resolve('tesseract.js/dist/worker.min.js.LICENSE.txt')
await copyFile(license, join(destination, 'worker.min.js.LICENSE.txt'))
await copyFile(`${core}/LICENSE`, join(destination, 'core', 'LICENSE'))
for (const file of await readdir(core)) {
  if (file.endsWith('.wasm.js')) {
    await copyFile(join(core, file), join(destination, 'core', file))
  }
}
await copyFile(
  require.resolve('@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz'),
  join(destination, 'lang', 'eng.traineddata.gz'),
)
