// Inject Google Play ADI (Android Developer Identity) verification token
// ke dalam APK pada `android/app/src/main/assets/adi-registration.properties`.
//
// Token didapat dari Play Console → Verifikasi developer Android.
// File ini wajib utk verifikasi kepemilikan package name baru di Play Console.

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withAdiRegistration(config, { token } = {}) {
  if (!token) {
    throw new Error('with-adi-registration: token wajib diisi di app.json plugin options');
  }

  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const assetsDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'assets'
      );
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }
      fs.writeFileSync(
        path.join(assetsDir, 'adi-registration.properties'),
        token
      );
      return cfg;
    },
  ]);
};
