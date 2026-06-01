// electron-builder afterPack hook: flip Electron Fuses to harden the packaged
// app against tampering and Node-injection vectors.
//   - RunAsNode off            → can't relaunch the binary as a plain Node REPL
//   - cookieEncryption on      → encrypts the cookie store at rest
//   - NodeOptions off          → ignores NODE_OPTIONS env injection
//   - NodeCliInspect off       → ignores --inspect debugging flags
//   - OnlyLoadAppFromAsar on   → refuses to run code outside the packaged asar
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses')
const path = require('path')

exports.default = async function afterPack(context) {
  const platform = context.electronPlatformName
  const appName = context.packager.appInfo.productFilename
  const ext = platform === 'darwin' ? '.app' : platform === 'win32' ? '.exe' : ''
  const electronBinary = path.join(context.appOutDir, `${appName}${ext}`)

  await flipFuses(electronBinary, {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: platform === 'darwin',
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true
  })
}
