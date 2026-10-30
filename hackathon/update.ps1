# Refreshes the public hackathon repo (..\kova-hackathon) from main, keeping its git history.
#
# Run from kova_codebase, on main, after `git pull`:
#   powershell -ExecutionPolicy Bypass -File hackathon\update.ps1 -Message "Short description of what changed"
#
# Both of us get credit on the public repo: the names in hackathon\co-authors.txt are added to the commit
# as "Co-authored-by" lines, so GitHub shows every author on the commit. -Author makes someone else the
# main author (they then appear in the repo's Contributors list), e.g.
#   -Author "Favour N. Emmanuel <12345678+favour@users.noreply.github.com>"
#
# Same rules as export.ps1: only committed files, private files removed, a secret check, then ONE new
# commit in the public repo. It does NOT push: check the files, then `git push` from ..\kova-hackathon.

param(
  [Parameter(Mandatory = $true)][string]$Message,
  [string]$Author = ''
)

$ErrorActionPreference = 'Stop'
$src = (Get-Location).Path
if (-not (Test-Path (Join-Path $src 'hackathon\README.md'))) { throw 'Run this from the kova_codebase folder.' }
$branch = (git branch --show-current).Trim()
if ($branch -ne 'main') { throw "You are on '$branch'. Run: git switch main; git pull" }
$dest = Join-Path (Split-Path $src -Parent) 'kova-hackathon'
if (-not (Test-Path (Join-Path $dest '.git'))) { throw "$dest is not the public repo. Run export.ps1 first." }

# 1. Clear the public copy (keep .git) and unpack committed files from main
Get-ChildItem $dest -Force | Where-Object { $_.Name -ne '.git' } | Remove-Item -Recurse -Force
$zip = Join-Path $env:TEMP 'kova-hackathon-update.zip'
if (Test-Path $zip) { Remove-Item $zip -Force }
git archive --format=zip -o $zip HEAD
Expand-Archive -Path $zip -DestinationPath $dest -Force
Remove-Item $zip -Force

# 2. Private-only files
foreach ($p in @('.github\workflows\deploy.yml', 'CLAUDE.md', 'metadata.json', 'docs\audits', '.harness')) {
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
$hits = Get-ChildItem $dest -Recurse -File | Where-Object { $_.FullName -notmatch '\\\.git\\' -and $_.Length -lt 2MB } | Select-String -Pattern $patterns
if ($hits) {
  $hits | ForEach-Object { Write-Host ("Possible secret: {0}:{1}" -f $_.Path, $_.LineNumber) }
  throw 'Possible secret found. Nothing was committed. Check those lines.'
}

# 5. One new commit, not pushed
Set-Location $dest
git add -A
if (-not (git status --porcelain)) {
  Write-Host 'The public repo already matches main. Nothing to commit.'
  exit 0
}
$trailers = @()
$coAuthorsFile = Join-Path $src 'hackathon\co-authors.txt'
if (Test-Path $coAuthorsFile) {
  $trailers = Get-Content $coAuthorsFile | Where-Object { $_ -match '<.+@.+>' -and $_ -notmatch '^\s*#' } | ForEach-Object { "Co-authored-by: $($_.Trim())" }
}
$full = if ($trailers.Count) { "$Message`n`n$($trailers -join "`n")" } else { $Message }
if ($Author) { git commit -m $full --author=$Author | Out-Null } else { git commit -m $full | Out-Null }
git --no-pager show --stat --oneline HEAD | Select-Object -First 40
Write-Host ''
Write-Host "Done. One new commit in $dest (not pushed)."
Write-Host 'Check it, then push with:  git push'
