# Kova Android app

Capacitor 8 wrapper around the web app. Package / application ID: **`com.kovafinance.app`**. App name: **Kova**.
compileSdk/targetSdk 36, minSdk 24 (Capacitor 8 default).

The app loads the bundled web build from `https://localhost` inside the WebView and calls the production API
at `https://kova-gkgwmqurbq-ew.a.run.app` (baked in by `vite build --mode android`, see `vite.config.ts`).

Never commit a keystore (`*.jks`, `*.keystore`), `android/keystore.properties` or `android/local.properties`;
all are git-ignored. `android/app/google-services.json` **is** committed (public Firebase config, allowlisted
in `.gitleaks.toml`).

## Prerequisites (Windows)

- **Android Studio** with SDK Platform 36 and Build-Tools 36.
- **JDK 21.** Gradle 8.14.3 can't run on Java 25 (Android Studio's bundled JBR), which fails with
  `Unsupported class file major version 69`. Use JDK 21 for command-line builds, e.g. the JetBrains JDK in
  `%USERPROFILE%\.jdks\jbr-21.*` or Temurin 21 (`winget install EclipseAdoptium.Temurin.21.JDK`):

  ```powershell
  # Current PowerShell session only
  $env:JAVA_HOME = "$env:USERPROFILE\.jdks\jbr-21.0.11"
  $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
  ```

  To make it permanent: `setx JAVA_HOME "%USERPROFILE%\.jdks\jbr-21.0.11"` and
  `setx ANDROID_HOME "%LOCALAPPDATA%\Android\Sdk"`, then open a new terminal. In Android Studio:
  Settings → Build, Execution, Deployment → Build Tools → Gradle → **Gradle JDK** = 21.
  Don't put a JDK path in the repo's `gradle.properties`.

## Build

```powershell
npm run build:android            # vite build --mode android && npx cap sync android
cd android
.\gradlew.bat assembleDebug      # app\build\outputs\apk\debug\app-debug.apk
npx cap open android             # or open the android\ folder in Android Studio
```

Run `npm run build:android` after every web change; `cap sync` copies `dist/` into the app and updates
native plugins.

## SHA-1 / SHA-256 fingerprints (Google Sign-In)

Firebase needs the fingerprint of **every key that signs a build users install**, or native Google Sign-In
fails with `DEVELOPER_ERROR` / code 10.

1. **Debug key** (local builds):
   ```powershell
   keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android
   ```
   or, from `android\`: `.\gradlew.bat signingReport` (lists debug and, when configured, release).
2. **Upload key** (your release keystore, below):
   ```powershell
   keytool -list -v -keystore C:\path\outside\repo\kova-upload.jks -alias kova-upload
   ```
3. **Play app signing key.** With Play App Signing, Google re-signs the app, so Play-installed builds carry
   **Google's** certificate, not yours. Copy its SHA-1 and SHA-256 from Play Console → *Test and release* →
   *App integrity* → *App signing key certificate*. Skip this and Google Sign-In fails only for testers
   installing from Play.

### Add them in Firebase

1. Firebase console → project `kova-98d67` → Project settings → *Your apps* → **Add app → Android**,
   package name `com.kovafinance.app`, nickname "Kova Android".
2. In that Android app's settings, **Add fingerprint** for each SHA-1 and SHA-256 above.
3. Authentication → Sign-in method → make sure **Google** is enabled.
4. Download **`google-services.json`** and put it in `android/app/` (re-download after adding fingerprints).
   Commit it. The Gradle build applies the google-services plugin automatically when the file exists.

## Release signing (upload key)

Create the upload key **once**, outside the repo, and back it up (password manager plus offline copy).
Losing it means an upload-key reset through Play support.

```powershell
keytool -genkeypair -v -keystore C:\path\outside\repo\kova-upload.jks -keyalg RSA -keysize 2048 -validity 10000 -alias kova-upload
```

Then create `android/keystore.properties` (git-ignored). `storeFile` is relative to `android/`, or absolute
with forward slashes:

```properties
storeFile=C:/path/outside/repo/kova-upload.jks
storePassword=<store password>
keyAlias=kova-upload
keyPassword=<key password>
```

`android/app/build.gradle` uses this file for the `release` build type only when it exists.

## Build the AAB

1. Bump `versionCode` (every upload must be higher) and, if wanted, `versionName` in
   `android/app/build.gradle`.
2. Build:
   ```powershell
   npm run build:android
   cd android
   .\gradlew.bat bundleRelease     # app\build\outputs\bundle\release\app-release.aab
   ```
   Without `keystore.properties` the bundle is unsigned and Play rejects it.

## Upload to the Play closed testing track

1. Play Console → **Create app** (name Kova, app, free).
2. *App integrity*: accept **Play App Signing** (Google manages the app signing key; you keep the upload key).
3. *Test and release* → *Testing* → **Closed testing** → create a track → **Create release** → upload
   `app-release.aab` → release notes → *Review release* → roll out.
4. *Testers*: add an email list or a Google Group, and share the opt-in link.
5. Add the **Play app signing** SHA-1/SHA-256 to Firebase (above) and update `google-services.json` if needed.

Required before review, under *Policy → App content*:
- **Privacy policy URL.**
- **Data safety form:** account info (email, name), financial info (expenses, goals, imported statements),
  and app interactions (chat). Data is encrypted in transit; users can request deletion.
- **Account deletion URL:** a public web page or form for deleting an account without the app (KOVA-054).
  In-app deletion already exists in Settings.
- Content rating questionnaire, target audience, ads declaration (no ads).

**Timeline:** new personal developer accounts must run a closed test with **at least 12 testers for 14
days** before applying for production. The first review can take several days.

## Known limitations

- **Voice notes are hidden on Android.** They use the Web Speech API, which Android System WebView doesn't
  support, and `RECORD_AUDIO` isn't requested (KOVA-051).
- **Premium can't be bought yet.** RevenueCat isn't configured (placeholder key; `initBilling` skips it);
  purchase verification is KOVA-026.
- **`allowBackup="false"`**: app data (including the local cache of financial data) is excluded from
  Android backups. Data lives in Firestore.
- Icons and splash are Capacitor defaults (KOVA-052).

## Push notifications (KOVA-071)

Android only for now, via Firebase Cloud Messaging and `@capacitor-firebase/messaging`.

- **Client:** `src/lib/pushNotifications.ts`. After onboarding, if a notification type is on, the app
  asks for permission once per install (Android 13+) and stores the FCM token at
  `users/{uid}/devices/{token}`. Turning a switch on in Settings asks again; logout deletes this
  device's token. Tapping a notification opens its screen (`data.route`: `letter` | `grow` | `chat`).
- **Server:** `sendPushToUser()` in `server.ts` sends to all of a user's tokens and deletes dead ones.
  - Monthly letter: sent by `/api/cron/monthly-letters` when the letter is generated (if `monthlyLetter` is on).
  - Daily Grow: `/api/cron/daily-grow` (needs `x-cron-secret`), at most one per ~20 h per user (`lastGrowPushAt`).
- **Copy rules:** no amounts, merchants or letter headlines in notification text (lock screen). Calm,
  at most one push a day, every type can be switched off.
- **Android bits:** channel `kova_updates`, status-bar icon `res/drawable/ic_stat_kova.xml` (white on
  transparent). `POST_NOTIFICATIONS` comes from the plugin's manifest.

### One-time setup

1. `google-services.json` in `android/app/` (KOVA-055, see above). Without it `getToken()` fails and
   nothing registers.
2. Google Cloud: enable the **Firebase Cloud Messaging API** and give the Cloud Run runtime service
   account `kova-run` the role **Firebase Cloud Messaging Admin** (`roles/firebasecloudmessaging.admin`).
3. Cloud Scheduler job for the daily nudge (17:00 UTC = 1 pm US Eastern), same secret as the
   monthly job (rotate it first: KOVA-025):
   `gcloud scheduler jobs create http kova-daily-grow --location=europe-west1 --schedule="0 17 * * *" --time-zone=UTC --uri=https://kova-gkgwmqurbq-ew.a.run.app/api/cron/daily-grow --http-method=POST --headers=x-cron-secret=$(gcloud secrets versions access latest --secret=cron-secret)`
4. Test: install a debug build, allow notifications, then run the job once from the Cloud Scheduler
   console (**Force run**). The monthly push can be tested with `POST /api/cron/monthly-letters?force=true`
   on a test project only (it generates letters for every user).
