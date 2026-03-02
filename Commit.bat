@echo off
set /p msg="Mensagem do commit: "
git add .
git commit -m "%msg%"
git push
echo.
echo Deploy enviado! A Vercel atualizara automaticamente.
pause
