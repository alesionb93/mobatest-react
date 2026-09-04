# ============================================================
# Veiser Test — Descobrir o tamanho/posição do espelho do dispositivo
# ============================================================
# Como usar:
#   1) Deixe a janela "Veiser Test — Espelho do dispositivo" aberta,
#      já do tamanho e posição que você quer (redimensione/arraste
#      ela na mão até ficar do jeito certo).
#   2) Rode este script (veja README.md pra como rodar .ps1).
#   3) Copie os números que aparecerem pro seu config.json.

Add-Type @"
using System;
using System.Runtime.InteropServices;
public class VeiserMirrorFinder {
  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
  [DllImport("user32.dll")]
  public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
"@

$title = "Veiser Test — Espelho do dispositivo"
$hwnd = [VeiserMirrorFinder]::FindWindow($null, $title)

if ($hwnd -eq [IntPtr]::Zero) {
  Write-Host ""
  Write-Host "Não encontrei uma janela com o título '$title'." -ForegroundColor Red
  Write-Host "Ela precisa estar aberta agora (clique 'Abrir espelho do dispositivo' no Veiser Test primeiro)."
  Write-Host 'Se você mudou o "windowTitle" no config.json, ajuste a variável $title no topo deste script pra igual.'
  Write-Host ""
  exit
}

$rect = New-Object VeiserMirrorFinder+RECT
[VeiserMirrorFinder]::GetWindowRect($hwnd, [ref]$rect) | Out-Null

Write-Host ""
Write-Host "Copie isso pro bloco 'scrcpy' do seu config.json:" -ForegroundColor Green
Write-Host ""
Write-Host "  ""windowX"": $($rect.Left),"
Write-Host "  ""windowY"": $($rect.Top),"
Write-Host "  ""windowWidth"": $($rect.Right - $rect.Left),"
Write-Host "  ""windowHeight"": $($rect.Bottom - $rect.Top)"
Write-Host ""
Write-Host "(windowX/windowY só valem se voce desligar a posicao automatica com ""autoPosition"": false)"
Write-Host ""
