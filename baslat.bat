@echo off
cd /d "%~dp0"

start "Giris" cmd /k py -3.11 -m streamlit run giris.py --server.port 8500 --server.headless true
start "Hoca Paneli" cmd /k py -3.11 -m streamlit run hoca_paneli.py --server.port 8501 --server.headless true
start "Sporcu Paneli" cmd /k py -3.11 -m streamlit run sporcu_web.py --server.port 8502 --server.headless true
start "Admin Paneli" cmd /k py -3.11 -m streamlit run admin_paneli.py --server.port 8503 --server.headless true
start "Sifre Yenileme" cmd /k py -3.11 -m streamlit run sifre_yenile.py --server.port 8504 --server.headless true
timeout /t 6 /nobreak >nul
start "" http://localhost:8500


exit
