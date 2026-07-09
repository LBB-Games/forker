# Releasing app updates

Forker does not install updates in-app. Packaged builds check GitHub Releases for a newer tag and show a dialog linking users to:

```txt
https://github.com/mcread29/forker/releases/latest
```

## Release build

Build normal platform packages:

```bash
npm run tauri:build
```

Upload the generated installers/packages to the tagged GitHub Release. Linux releases should prefer `.deb` / `.rpm` for system installation because those packages install the desktop entry and icons through the package manager.

## Update check behavior

The app requests the latest release metadata from:

```txt
https://api.github.com/repos/mcread29/forker/releases/latest
```

If the latest release tag is newer than the current `package.json` version, Forker shows a release dialog and a Settings update panel with an “Open latest release” link.

## Release uploads

Upload generated installers/packages to the GitHub Release and verify them before publishing:

```bash
find src-tauri/target/release/bundle -type f -print
```

No updater signatures or `latest.json` files are required.
