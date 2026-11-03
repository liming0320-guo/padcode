param(
  [int]$Port = 4180
)

$ErrorActionPreference = "Stop"
$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()

Write-Output "AI Workbench: http://127.0.0.1:$Port/"
Write-Output "Mock Chat endpoint: http://127.0.0.1:$Port/mock/chat/completions"
Write-Output "Mock Responses endpoint: http://127.0.0.1:$Port/mock/responses"
Write-Output "Press Ctrl+C to stop."

$contentTypes = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg" = "image/svg+xml"
  ".webmanifest" = "application/manifest+json; charset=utf-8"
}

function Write-HttpResponse($stream, $status, $contentType, $bytes) {
  $statusText = if ($status -eq 200) { "OK" } elseif ($status -eq 204) { "No Content" } elseif ($status -eq 404) { "Not Found" } else { "Error" }
  $header = "HTTP/1.1 $status $statusText`r`nContent-Type: $contentType`r`nCache-Control: no-cache`r`nAccess-Control-Allow-Origin: *`r`nAccess-Control-Allow-Headers: authorization, content-type`r`nAccess-Control-Allow-Methods: GET, POST, OPTIONS`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($bytes.Length -gt 0) {
    $stream.Write($bytes, 0, $bytes.Length)
  }
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    $stream = $client.GetStream()
    $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::UTF8, $false, 4096, $true)
    $requestLine = $reader.ReadLine()
    $headers = @{}
    while ($true) {
      $line = $reader.ReadLine()
      if ([string]::IsNullOrEmpty($line)) { break }
      $separator = $line.IndexOf(":")
      if ($separator -gt 0) {
        $headers[$line.Substring(0, $separator).Trim().ToLowerInvariant()] = $line.Substring($separator + 1).Trim()
      }
    }

    $method = ""
    $requestPath = ""
    if ($requestLine -match "^(\S+)\s+([^\s?]+)") {
      $method = $matches[1]
      $requestPath = [Uri]::UnescapeDataString($matches[2])
    }
    Write-Output "$method $requestPath"

    if ($method -eq "OPTIONS") {
      Write-HttpResponse $stream 204 "text/plain; charset=utf-8" ([byte[]]@())
      $client.Close()
      continue
    }

    if ($method -eq "POST" -and $requestPath -in @("/mock/chat/completions", "/mock/responses")) {
      $contentLength = 0
      [void][int]::TryParse($headers["content-length"], [ref]$contentLength)
      if ($contentLength -gt 0) {
        $buffer = New-Object char[] $contentLength
        try {
          [void]$reader.ReadBlock($buffer, 0, $contentLength)
        } catch {
          $client.Close()
          continue
        }
      }

      $events = if ($requestPath -eq "/mock/responses") {
        @(
          'data: {"type":"response.output_text.delta","delta":"这是本地 Mock 的 "}',
          'data: {"type":"response.output_text.delta","delta":"Responses API 流式回复。"}',
          'data: {"type":"response.completed","response":{"output_text":"这是本地 Mock 的 Responses API 流式回复。"}}'
        ) -join "`n`n"
      } else {
        @(
          'data: {"choices":[{"delta":{"content":"这是本地 Mock 的 "}}]}',
          'data: {"choices":[{"delta":{"content":"Chat Completions 流式回复。"}}]}'
        ) -join "`n`n"
      }
      $body = [System.Text.Encoding]::UTF8.GetBytes($events + "`n`ndata: [DONE]`n`n")
      Write-HttpResponse $stream 200 "text/event-stream; charset=utf-8" $body
      $client.Close()
      continue
    }

    if ($method -ne "GET") {
      Write-HttpResponse $stream 404 "text/plain; charset=utf-8" ([Text.Encoding]::UTF8.GetBytes("Not found"))
      $client.Close()
      continue
    }

    $relativePath = $requestPath.TrimStart("/")
    if ([string]::IsNullOrWhiteSpace($relativePath)) {
      $relativePath = "index.html"
    }
    $target = [System.IO.Path]::GetFullPath((Join-Path $root $relativePath))
    if (-not $target.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $target -PathType Leaf)) {
      Write-HttpResponse $stream 404 "text/plain; charset=utf-8" ([Text.Encoding]::UTF8.GetBytes("Not found"))
      $client.Close()
      continue
    }

    $extension = [System.IO.Path]::GetExtension($target).ToLowerInvariant()
    $contentType = if ($contentTypes.ContainsKey($extension)) {
      $contentTypes[$extension]
    } else {
      "application/octet-stream"
    }
    $body = [System.IO.File]::ReadAllBytes($target)
    Write-HttpResponse $stream 200 $contentType $body
    $client.Close()
  }
} finally {
  $listener.Stop()
}
