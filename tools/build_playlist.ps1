param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$ArgsList
)

Set-Location (Join-Path $PSScriptRoot "..")
python tools/build_playlist.py @ArgsList
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "Failed to rebuild playlist.txt"
  exit $LASTEXITCODE
}
Write-Host ""
Write-Host "playlist.txt rebuilt successfully."
