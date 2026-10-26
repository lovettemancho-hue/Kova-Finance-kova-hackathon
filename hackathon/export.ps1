# Copies Kova into a fresh public repo for the PayPal AI Hackathon (no private history).
#
# Run from kova_codebase, on main, after `git pull`:
#   powershell -ExecutionPolicy Bypass -File hackathon\export.ps1
#
# What it does:
#   1. Exports only files committed on main (`git archive`), so .env, keystores, node_modules and
#      anything untracked can never be included.
#   2. Removes private-only files: the deploy workflow, internal notes and the security audit.
#   3. Adds the hackathon README, MIT LICENSE and the demo statement CSV.
#   4. Stops if anything looks like a secret.
#   5. Creates a new git repo with one commit. It does NOT push: you check the files first.

$ErrorActionPreference = 'Stop'

$src = (Get-Location).Path
if (-not (Test-Path (Join-Path $src 'hackathon\README.md'))) { throw 'Run this from the kova_codebase folder.' }

$branch = (git branch --show-current).Trim()
if ($branch -ne 'main') { throw "You are on '$branch'. Run: git checkout main; git pull" }

$dest = Join-Path (Split-Path $src -Parent) 'kova-hackathon'
if (Test-Path $dest) { throw "$dest already exists. Delete that folder first, then run this again." }

# 1. Committed files only
$zip = Join-Path $env:TEMP 'kova-hackathon-export.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
git archive --format=zip -o $zip HEAD
Expand-Archive -Path $zip -DestinationPath $dest
Remove-Item $zip -Force

# 2. Private-only files
$private = @(
  '.github\workflows\deploy.yml',   # deploys to Kova's Google Cloud project
  'CLAUDE.md',                      # internal working notes
  'metadata.json',                  # AI Studio leftover
  'docs\audits'                     # internal security audit
)
foreach ($p in $private) {
  $full = Join-Path $dest $p
  if (Test-Path $full) { Remove-Item $full -Recurse -Force; Write-Host "Removed $p" }
}

# 3. Hackathon files
Copy-Item (Join-Path $src 'hackathon\README.md') $dest -Force
Copy-Item (Join-Path $src 'hackathon\LICENSE') $dest -Force
Copy-Item (Join-Path $src 'hackathon\kova-demo-statement.csv') (Join-Path $dest 'docs') -Force

# 4. Secret check
foreach ($f in @('.env', 'android\keystore.properties', 'android\local.properties')) {
  if (Test-Path (Join-Path $dest $f)) { throw "Found $f in the export. Stopping." }
}
if (Get-ChildItem $dest -Recurse -File -Include *.jks, *.keystore, service-account*.json, *-key.json) {
  throw 'Found a keystore or key file in the export. Stopping.'
}
$patterns = 'sk_live_[0-9A-Za-z]+|sk_test_[0-9A-Za-z]+|-----BEGIN [A-Z ]*PRIVATE KEY-----|"private_key"\s*:|AKIA[0-9A-Z]{16}|xox[baprs]-[0-9A-Za-z-]+|ghp_[0-9A-Za-z]{30,}'
$hits = Get-ChildItem $dest -Recurse -File | Where-Object { $_.Length -lt 2MB } | Select-String -Pattern $patterns
if ($hits) {
  $hits | ForEach-Object { Write-Host ("Possible secret: {0}:{1}" -f $_.Path, $_.LineNumber) }
  throw 'Possible secret found. Nothing was committed. Check those lines.'
}

# 5. Fresh repo, one commit, not pushed
Set-Location $dest
git init -b main | Out-Null
git add .
git commit -m "Kova: calm AI money companion for the PayPal AI Hackathon" | Out-Null
git remote add origin https://github.com/lovettemancho-hue/Kova-Finance-kova-hackathon.git

Write-Host ''
Write-Host "Done. The public copy is in $dest (one commit, not pushed)."
Write-Host 'Check it, then push with:  git push -u origin main'
