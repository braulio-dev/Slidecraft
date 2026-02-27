# Genera miniaturas PNG de la primera diapositiva de cada PPTX usando PowerPoint
$templatesDir = Join-Path $PSScriptRoot "..\templates"
$thumbnailsDir = Join-Path $PSScriptRoot "..\public\thumbnails"
if (-not (Test-Path $thumbnailsDir)) {
    New-Item -ItemType Directory -Path $thumbnailsDir | Out-Null
}
try {
    $powerpoint = New-Object -ComObject PowerPoint.Application
    $powerpoint.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    Write-Host "📸 Generando miniaturas de plantillas..." -ForegroundColor Cyan
    $templates = Get-ChildItem -Path $templatesDir -Filter "*.pptx"
    foreach ($template in $templates) {
        try {
            $templatePath = $template.FullName
            $baseName = $template.BaseName
            $thumbnailPath = Join-Path $thumbnailsDir "$baseName.png"
            Write-Host "  Procesando: $($template.Name)..." -NoNewline
            $presentation = $powerpoint.Presentations.Open($templatePath, $false, $false, $false)
            if ($presentation.Slides.Count -gt 0) {
                $slide = $presentation.Slides.Item(1)
                $slide.Export($thumbnailPath, "PNG", 960, 540)
                Write-Host " ✅" -ForegroundColor Green
            } else {
                Write-Host " ⚠️ Sin diapositivas" -ForegroundColor Yellow
            }
            $presentation.Close()
        } catch {
            Write-Host " ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    $powerpoint.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($powerpoint) | Out-Null
    Write-Host ""
    Write-Host "✨ Miniaturas generadas exitosamente!" -ForegroundColor Green
    Write-Host "📁 Ubicación: $thumbnailsDir" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Error: PowerPoint no está instalado o no se pudo iniciar." -ForegroundColor Red
    Write-Host "   Para usar miniaturas, necesitas Microsoft PowerPoint instalado." -ForegroundColor Yellow
    exit 1
}
