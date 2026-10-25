# KOVA-050 — Android app via Capacitor 8 (plan)

Status: **approved 2026-10-19, implemented** on `feat/android-capacitor`.

Decisions (Lovette, 2026-10-19):
- App ID **`com.kovafinance.app`** (set before `cap add android`); app name stays "Kova".
- 1: hide voice notes on native and drop `RECORD_AUDIO` (KOVA-051 follow-up).
- 2: `allowBackup="false"`.
- 3: `google-services.json` in a follow-up PR (KOVA-055), after registering the Android app in Firebase.
- New backlog item: public web account-deletion URL for Google Play (KOVA-054).

Result: Capacitor 8 defaults are compileSdk/targetSdk 36, minSdk 24. `gradlew assembleDebug` fails on JDK 25
(Gradle 8.14.3: "Unsupported class file major version 69") and succeeds on JDK 21 (local
`%USERPROFILE%.jdksjbr-21.0.11`). No repo change for the JDK; see ANDROID.md.

## Current state (checked 2026-10-18)

- `@capacitor/{cli,core,android}` 8.5.3, `@capacitor-firebase/authentication` 8.5.2,
  `@revenuecat/purchases-capacitor` 13.7.4. `capacitor.config.ts`: `appId com.kova.app` (changed to `com.kovafinance.app` on approval), `webDir dist`,
  `androidScheme https`, `cleartext false`, FirebaseAuthentication with `google.com`.
- `android/` holds only one tracked file, `android/app/src/main/AndroidManifest.xml` (from AI Studio). It
  declares `RECORD_AUDIO`/`MODIFY_AUDIO_SETTINGS` and `usesCleartextTraffic="true"`, which contradicts
  `cleartext: false`. Because the folder exists, `npx cap add android` will refuse to run.
- Local toolchain: Android SDK has platforms 36/36.1/37 and build-tools 36. Android Studio's bundled JDK is
  **25**; Capacitor 8's Gradle may need **JDK 21** (see Risks).
- All API calls go through `fetchWithAuth` → `VITE_API_URL` (PayPal client included), so one build-time
  variable points the app at Cloud Run. CORS is `origin: true`, so the WebView origin `https://localhost` works.

## Steps

1. **Generate the platform.** `git rm` the stray manifest (keeping its permissions in mind), then
   `npx cap add android`. Check the generated `android/variables.gradle`: `compileSdkVersion = 36`,
   `targetSdkVersion = 36`, `minSdkVersion` left at the Capacitor 8 default.
2. **Manifest.** Start from the generated one. Don't carry over `usesCleartextTraffic`. Set
   `android:allowBackup="false"`, because the localStorage cache holds financial data and shouldn't go to
   device backups. `RECORD_AUDIO`: see decision 1.
3. **Google Sign-In on native.** In `android/variables.gradle` set `rgcfaIncludeGoogle = true`, which
   `@capacitor-firebase/authentication` needs for the Google provider. `google-services.json` goes in
   `android/app/`. Capacitor's `app/build.gradle` already applies the google-services plugin when the file
   exists. You download the file after registering `com.kovafinance.app` and the SHA fingerprints in Firebase
   (docs/ANDROID.md).
4. **Build script.** `build:android` = `vite build --mode android && npx cap sync android`. In
   `vite.config.ts`, when `mode === 'android'`, `VITE_API_URL` defaults to
   `https://kova-gkgwmqurbq-ew.a.run.app`; a real env var still overrides it. No `.env.android` file, so the
   `.env*` hard rule holds. No `cross-env` dependency: inline `VAR=x` doesn't work in Windows npm scripts.
   Only the Vite build, not the server bundle.
5. **Signing.** `android/app/build.gradle` gets a `release` signingConfig, loaded only if
   `android/keystore.properties` exists (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`), so debug
   builds and CI work without it. This is the **upload key** (Play App Signing holds the app signing key).
   Set `versionCode 1`, `versionName "0.1.0"`; bump `versionCode` on every upload.
6. **Ignore rules.** `android/.gitignore`: keep Capacitor's generated entries (build outputs,
   `local.properties`, `.gradle`, `capacitor-cordova-android-plugins`, copied web assets in
   `app/src/main/assets/public`), and add `*.jks`, `*.keystore`, `keystore.properties`. The root `.gitignore`
   already ignores those patterns repo-wide; listing them here too is belt and braces. `google-services.json`
   stays tracked.
7. **gitleaks.** `google-services.json` contains an `AIza…` key, and CI's gitleaks `gcp-api-key` rule would
   fail on it. Add its path to the `.gitleaks.toml` allowlist, next to `firebase-applet-config.json`, with
   the same reason (public by design, protected by rules and restrictions).
8. **`.gitattributes`.** `android/gradlew text eol=lf` and `*.bat eol=crlf`, so `core.autocrlf=true` on
   Windows can't break `gradlew` on Linux/CI.
9. **RevenueCat guard.** `initBilling` runs `Purchases.configure` with the placeholder key on native and
   isn't awaited or caught, which gives an unhandled rejection on startup. Wrap it in try/catch and skip it
   while the key is the placeholder. Real billing is KOVA-026.
10. **docs/ANDROID.md:**
    - Prereqs: JDK 21, Android Studio, SDK 36.
    - `npm run build:android` → `npx cap open android` / `gradlew assembleDebug`.
    - SHA-1/SHA-256 for **three** keys:
      - debug: `keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android`, or `gradlew signingReport`;
      - upload key: `keytool -list -v -keystore <upload.jks> -alias <alias>`;
      - **Play app signing key**: copy from Play Console → App integrity. Without it, Google Sign-In fails on
        Play-installed builds.
    - Adding the fingerprints in Firebase (Project settings → Android app `com.kovafinance.app` → Add fingerprint),
      then re-downloading `google-services.json`.
    - Creating the upload key: `keytool -genkeypair -v -keystore kova-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias kova-upload`.
      Store it outside the repo and back it up; losing it means an upload-key reset through Play support.
    - `keystore.properties` template.
    - `gradlew bundleRelease` → `app/build/outputs/bundle/release/app-release.aab`.
    - Play Console: create app → App integrity (Play App Signing) → Closed testing track → upload AAB →
      testers list / Google Group → review.
    - Checklist Play requires: privacy policy URL, Data safety form (financial info, email; audio if
      decision 1 keeps voice), content rating, target audience.
11. **Docs and tracking:** STATUS (KOVA-050 in progress, new follow-ups below), CLAUDE.md Android line,
    README pointer.
12. **Verify:** `npm run lint`, `npm run build`, `npm run build:android`, `gradlew assembleDebug`. A
    `bundleRelease` without a keystore should produce an unsigned AAB or fail clearly. I won't create a
    keystore.

## Decisions needed from Lovette

1. **Voice notes on Android.** `VoiceNoteModal` uses the Web Speech API (`SpeechRecognition`), which
   Android System WebView doesn't really support. Options:
   (a) hide voice notes on native and **drop `RECORD_AUDIO`** for now (recommended: simpler Play review and
   Data safety), with a follow-up to use a native speech plugin;
   (b) keep the permission and ship a broken feature.
2. **`allowBackup="false"`.** OK? Recommended for financial data.
3. **Commit `google-services.json` in this PR** (you add it after registering the SHAs), or a follow-up PR?
   The build works without it, but Google Sign-In won't.

## Risks / flags

- **Play closed testing timeline (deadline risk).** New personal Play developer accounts must run a closed
  test with **12+ testers for 14 days** before production access. Closed testing itself is fine for the
  hackathon, but testers must be invited, and first review can take days. Judges probably use the web app;
  plan around that.
- **JDK 25 vs Gradle.** If the first build fails on the Java version, install Temurin 21 and set
  `JAVA_HOME`, or `org.gradle.java.home` in the user-level `~/.gradle/gradle.properties` (not in the repo).
- **CORS (KOVA-024).** When CORS becomes an allowlist, it must include `https://localhost` (Capacitor's
  Android origin), or every API call from the app breaks.
- **Premium on Android** stays locked until RevenueCat verification (KOVA-026). The purchase flow shows
  "confirming".
- **Icons and splash** are Capacitor defaults. Play needs a 512 px icon and a feature graphic. Follow-up
  (`@capacitor/assets`).

## Follow-ups to add to STATUS

- KOVA-051 (P2): voice notes on Android via a native speech-recognition plugin (if decision 1a).
- KOVA-052 (P3): app icon, splash and Play store listing assets.
- KOVA-053 (P3): CI job `assembleDebug` on PRs touching `android/`.
