param([int]$Port = 4180)

$ErrorActionPreference = 'Stop'
$projectDirectory = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$runtimeDirectory = Join-Path $projectDirectory '.run'
$instanceName = if ($Port -eq 4180) { 'preview' } else { "preview-$Port" }
$statePath = Join-Path $runtimeDirectory "$instanceName.json"
$outputLog = Join-Path $runtimeDirectory "$instanceName.log"
$errorLog = Join-Path $runtimeDirectory "$instanceName-error.log"
$vitePath = Join-Path $projectDirectory 'node_modules\vite\bin\vite.js'
$previewUrl = "http://127.0.0.1:$Port/"

function Test-LocalPort([int]$Number) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $attempt = $client.ConnectAsync('127.0.0.1', $Number)
        if (-not $attempt.Wait(500)) { return $false }
        return $client.Connected
    } catch { return $false } finally { $client.Dispose() }
}

function Get-PreviewCommandLine([int]$ProcessNumber) {
    # Read just the listening process; no WMI service or administrator rights needed.
    if (-not ('MarblePreviewProcessInfo' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class MarblePreviewProcessInfo {
    [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, int id);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    [DllImport("ntdll.dll")] static extern int NtQueryInformationProcess(IntPtr handle, int kind, IntPtr buffer, int size, out int required);
    [StructLayout(LayoutKind.Sequential)] struct UnicodeString { public ushort Length; public ushort MaximumLength; public IntPtr Buffer; }
    public static string Read(int id) {
        IntPtr handle = OpenProcess(0x1000, false, id);
        if (handle == IntPtr.Zero) return null;
        IntPtr buffer = IntPtr.Zero;
        try {
            int required;
            NtQueryInformationProcess(handle, 60, IntPtr.Zero, 0, out required);
            if (required <= 0 || required > 1048576) return null;
            buffer = Marshal.AllocHGlobal(required);
            if (NtQueryInformationProcess(handle, 60, buffer, required, out required) != 0) return null;
            UnicodeString value = (UnicodeString)Marshal.PtrToStructure(buffer, typeof(UnicodeString));
            return Marshal.PtrToStringUni(value.Buffer, value.Length / 2);
        } finally { if (buffer != IntPtr.Zero) Marshal.FreeHGlobal(buffer); CloseHandle(handle); }
    }
}
'@
    }
    return [MarblePreviewProcessInfo]::Read($ProcessNumber)
}

try {
    if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Port must be between 1024 and 65535.' }
    $nodeExecutable = (Get-Command node.exe -ErrorAction Stop).Source
    $npmExecutable = (Get-Command npm.cmd -ErrorAction Stop).Source
    if (-not (Test-Path -LiteralPath $vitePath)) { throw 'Dependencies are missing. Run npm install in the web-game directory first.' }
    New-Item -ItemType Directory -Path $runtimeDirectory -Force | Out-Null

    # Build first: a source error leaves the currently running preview available.
    Write-Host 'Building your latest source...'
    Push-Location -LiteralPath $projectDirectory
    try {
        & $npmExecutable run build
        if ($LASTEXITCODE -ne 0) { throw 'Build failed. The existing preview has not been stopped.' }
    } finally { Pop-Location }

    $stopped = $false
    if (Test-Path -LiteralPath $statePath) {
        $saved = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        $tracked = Get-Process -Id ([int]$saved.processId) -ErrorAction SilentlyContinue
        if ($tracked) {
            # Match PID, executable AND creation time; never kill another reused PID.
            $sameProcess = $tracked.Path -eq $saved.executable -and $tracked.StartTime.ToUniversalTime().Ticks.ToString() -eq $saved.startedAtTicks
            if (-not $sameProcess) { throw 'Saved process identity no longer matches. No process was stopped.' }
            Write-Host 'Stopping the previous game preview...'
            $tracked.Kill()
            if (-not $tracked.WaitForExit(10000)) { throw 'Previous preview did not exit in time.' }
            $stopped = $true
        }
        Remove-Item -LiteralPath $statePath -Force
    }

    if (Test-LocalPort $Port) {
        # First use can adopt an older manually started Vite preview of THIS project.
        $listenerIds = @(& netstat.exe -ano -p tcp | ForEach-Object {
            if ($_ -match "^\s*TCP\s+(?:127\.0\.0\.1|0\.0\.0\.0|\[::\]):$Port\s+\S+\s+LISTENING\s+(\d+)\s*$") { [int]$Matches[1] }
        } | Select-Object -Unique)
        if ($listenerIds.Count -ne 1) { throw "Cannot identify the existing listener on port $Port. No process was stopped." }
        $listener = Get-Process -Id $listenerIds[0] -ErrorAction Stop
        $commandLine = Get-PreviewCommandLine $listener.Id
        $normalizedCommand = if ($commandLine) { $commandLine.Replace('/', '\') } else { '' }
        $belongsToProject = $listener.ProcessName -eq 'node' -and $normalizedCommand.IndexOf($projectDirectory + '\', [StringComparison]::OrdinalIgnoreCase) -ge 0 -and $normalizedCommand -match 'vite\\bin\\vite\.js' -and $normalizedCommand -match '(?:\s|\")preview(?:\s|\")'
        if (-not $belongsToProject) { throw "Port $Port belongs to another or unverifiable application. Close that preview or choose another port." }
        Write-Host 'Restarting the existing preview of this project...'
        $listener.Kill()
        if (-not $listener.WaitForExit(10000)) { throw 'Existing preview did not exit in time.' }
        $stopped = $true
        if (Test-LocalPort $Port) { throw "Port $Port is still occupied. No additional process was stopped." }
    }
    $previewArguments = @('"' + $vitePath + '"', 'preview', '--configLoader', 'native', '--host', '127.0.0.1', '--port', "$Port", '--strictPort')
    $server = Start-Process -FilePath $nodeExecutable -ArgumentList $previewArguments -WorkingDirectory $projectDirectory -WindowStyle Hidden -RedirectStandardOutput $outputLog -RedirectStandardError $errorLog -PassThru
    $record = @{ processId = $server.Id; executable = $nodeExecutable; startedAtTicks = $server.StartTime.ToUniversalTime().Ticks.ToString(); port = $Port; url = $previewUrl }
    $record | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding UTF8

    $ready = $false
    for ($attemptNumber = 0; $attemptNumber -lt 40; $attemptNumber++) {
        $server.Refresh()
        if ($server.HasExited) { throw "Preview exited. Check $errorLog" }
        try {
            $response = Invoke-WebRequest -Uri $previewUrl -UseBasicParsing -TimeoutSec 1
            if ($response.StatusCode -eq 200) { $ready = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 250
    }
    if (-not $ready) { throw "Preview did not become ready. Check $errorLog" }
    Write-Host ''
    if ($stopped) { Write-Host 'Game restarted successfully.' } else { Write-Host 'Game started successfully.' }
    Write-Host "Open or refresh: $previewUrl"
    Write-Host "Logs: $runtimeDirectory"
    exit 0
} catch {
    Write-Host ''
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host $_.InvocationInfo.PositionMessage
    exit 1
}
