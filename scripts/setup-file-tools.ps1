param(
  [Parameter(Mandatory=$true)][string]$PythonPath,
  [switch]$WithOffice
)
$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Push-Location $workspace
try {
  & $PythonPath -m venv .file-tools/venv
  if ($LASTEXITCODE -ne 0) { throw 'Tidak dapat membuat virtual environment.' }
  & '.file-tools/venv/Scripts/python.exe' -m pip install -r apps/api/server/requirements.lock
  if ($LASTEXITCODE -ne 0) { throw 'Dependency file backend belum berhasil dipasang.' }
  if ($WithOffice) {
    $ProgressPreference = 'SilentlyContinue'
    $installer = Join-Path $workspace '.file-tools/LibreOffice_26.2.6.msi'
    $expected = 'f9877032fd908beb9c0ddf06df4af5c2e85f419c42e14876c4cce5aae5fb2660'
    if (!(Test-Path -LiteralPath $installer)) {
      Invoke-WebRequest -Uri 'https://download.documentfoundation.org/libreoffice/stable/26.2.6/win/x86_64/LibreOffice_26.2.6_Win_x86-64.msi' -OutFile $installer
    }
    if ((Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'Hash LibreOffice tidak sesuai sumber resmi.' }
    $destination = Join-Path $workspace '.file-tools/libreoffice'
    $process = Start-Process -FilePath msiexec.exe -ArgumentList @('/a', ('"' + $installer + '"'), '/qn', ('TARGETDIR="' + $destination + '"')) -WindowStyle Hidden -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw ('Ekstraksi LibreOffice gagal: ' + $process.ExitCode) }
  }
  & '.file-tools/venv/Scripts/python.exe' apps/api/server/file_worker.py --prepare-office
  if ($LASTEXITCODE -ne 0) { Write-Warning 'Profil Office belum siap; konversi Office pertama mungkin lebih lambat.' }
  & '.file-tools/venv/Scripts/python.exe' apps/api/server/file_worker.py --capabilities
} finally { Pop-Location }
