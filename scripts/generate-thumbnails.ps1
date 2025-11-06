# Script para generar miniaturas de las plantillas PPTX
# Usa PowerPoint COM object para convertir la primera diapositiva a imagen

$templatesDir = Join-Path $PSScriptRoot "..\templates"
$thumbnailsDir = Join-Path $PSScriptRoot "..\public\thumbnails"

# Crear directorio de thumbnails
if (-not (Test-Path $thumbnailsDir)) {
    New-Item -ItemType Directory -Path $thumbnailsDir | Out-Null
}

# Verificar si PowerPoint está instalado
try {
    $powerpoint = New-Object -ComObject PowerPoint.Application
    $powerpoint.Visible = [Microsoft.Office.Core.MsoTriState]::msoFalse
    
    Write-Host "📸 Generando miniaturas de plantillas..." -ForegroundColor Cyan
    Write-Host ""
    
    # Obtener todas las plantillas PPTX
    $templates = Get-ChildItem -Path $templatesDir -Filter "*.pptx"
    
    foreach ($template in $templates) {
        try {
            $templatePath = $template.FullName
            $baseName = $template.BaseName
            $thumbnailPath = Join-Path $thumbnailsDir "$baseName.png"
            
            Write-Host "  Procesando: $($template.Name)..." -NoNewline
            
            # Abrir la presentación
            $presentation = $powerpoint.Presentations.Open($templatePath, $false, $false, $false)
            
            if ($presentation.Slides.Count -gt 0) {
                # Exportar la primera diapositiva como imagen
                $slide = $presentation.Slides.Item(1)
                $slide.Export($thumbnailPath, "PNG", 960, 540)  # 16:9 aspect ratio
                
                Write-Host " ✅" -ForegroundColor Green
            } else {
                Write-Host " ⚠️ Sin diapositivas" -ForegroundColor Yellow
            }
            
            # Cerrar la presentación
            $presentation.Close()
            
        } catch {
            Write-Host " ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    # Cerrar PowerPoint
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
