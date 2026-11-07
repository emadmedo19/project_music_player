# Verification — Naghma

## User flow

Open the Arabic music catalog → browse blocSonic releases from Internet Archive → load licensed album metadata → stream a full MP3 → save a favorite → reload → search by artist → play from results.

## Browser evidence

Verified with Chromium and Playwright at 390 × 844:

- Catalog: 18 cards on the first page; 424 releases reported by the source.
- No horizontal overflow at mobile width.
- First release: Pete Lund — Gypsy Cab, two unique MP3 tracks (duplicate bitrates removed).
- Real playback: currentTime advanced past 2 seconds, paused=false, duration=192.314535 seconds.
- Source: https://archive.org/download/BS450014/01-GypsyCab.mp3
- Favorites: one track saved, one track restored after page reload.
- Search for `Pete Lund`: three releases returned.
- Playback from search results and pause control: succeeded.
- Uncaught page exceptions: none.

The React development StrictMode intentionally aborts the initial duplicate request. Image and metadata availability depends on Internet Archive; cover images have a fallback. The browser test does not use mocked catalog responses or mocked audio.

Screenshots: [Home](naghma-home.png), [Album and player](naghma-player.png).

## Android

Capacitor Android project: application ID `com.naghma.music`, minimum SDK 23, target SDK 35. The APK is a debug build for direct installation. No physical Android device or Android emulator is available in this workspace; native device playback, background behavior, and lock-screen controls have not been verified. Background playback is not guaranteed in this version.

GitHub Actions builds the APK and uploads it as `Naghma-Android-APK`.
