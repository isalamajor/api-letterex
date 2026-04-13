# setup.ps1
Write-Host "Iniciando script de configuración..."

# Ir al directorio del proyecto de MongoDB
Set-Location "C:\Program Files\MongoDB\Server\8.0\bin"

# Levantar MongoDB en segundo plano
Start-Process mongod.exe -ArgumentList '--dbpath', 'C:/data8/db'

# Volver al directorio del proyecto
Set-Location $PSScriptRoot

# Finalmente, iniciar Nodemon
nodemon index.js

Write-Host "✅ Set up completado!"
