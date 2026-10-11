// app.json holds the config. APP_VARIANT=beta (the testflight profile in eas.json)
// builds the iPhone app under its own bundle ID, so a TestFlight beta signed on
// another Apple team never claims org.projectjuly.oven. Without it the config is
// app.json unchanged, and so is the update fingerprint of existing builds.
// Beta builds get updates from the beta channel; publish them with the variant set:
//   APP_VARIANT=beta npx eas-cli@latest update --channel beta --platform ios
const IS_BETA = process.env.APP_VARIANT === 'beta';

module.exports = ({ config }) => {
  if (!IS_BETA) return config;
  return {
    ...config,
    name: 'Project July Beta',
    ios: {
      ...config.ios,
      bundleIdentifier: 'org.projectjuly.oven.beta',
      // The home screen label; the full name would be cut short there.
      infoPlist: { ...config.ios.infoPlist, CFBundleDisplayName: 'July Beta' },
    },
  };
};
