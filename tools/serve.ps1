param(
  [int]$Port = 4173
)

$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()

Write-Output "PadCode: http://127.0.0.1:$Port/"
Write-Output "Press Ctrl+C to stop."

$contentTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg" = "image/svg+xml"
  ".png" = "image/png"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    $stream = $client.GetStream()
    $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
    $requestLine = $reader.ReadLine()
    while (-not [string]::IsNullOrEmpty($reader.ReadLine())) {
      # Consume request headers.
    }
    $requestPath = ""
    if ($requestLine -match "^GET\s+([^\s?]+)") {
      $requestPath = [Uri]::UnescapeDataString($matches[1].TrimStart("/"))
    }
    if ([string]::IsNullOrWhiteSpace($requestPath)) {
      $requestPath = "index.html"
    }

    $target = [System.IO.Path]::GetFullPath((Join-Path $root $requestPath))
    if (-not $target.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $target -PathType Leaf)) {
      $body = [System.Text.Encoding]::UTF8.GetBytes("Not found")
      $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($body, 0, $body.Length)
      $client.Close()
      continue
    }

    $extension = [System.IO.Path]::GetExtension($target).ToLowerInvariant()
    $contentType = if ($contentTypes.ContainsKey($extension)) {
      $contentTypes[$extension]
    } else {
      "application/octet-stream"
    }
    $bytes = [System.IO.File]::ReadAllBytes($target)
    $header = "HTTP/1.1 200 OK`r`nContent-Type: $contentType`r`nCache-Control: no-cache`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    $stream.Write($bytes, 0, $bytes.Length)
    $client.Close()
  }
} finally {
  $listener.Stop()
}
