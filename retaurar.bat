@echo off
echo Iniciando limpieza del entorno...
:: Elimina la extensión de Git que causa el conflicto de trayectorias
git config --unset extensions.worktreeconfig
echo Configuracion reparada. Por favor, reinicia tu aplicacion.
pause