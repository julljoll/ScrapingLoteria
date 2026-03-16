import re
import warnings
import requests
from bs4 import BeautifulSoup
import gspread
from google.oauth2.service_account import Credentials
import os
import json
import time
from urllib.parse import urljoin
from gspread.exceptions import WorksheetNotFound

warnings.filterwarnings("ignore")

# Configuración
URL_LOTERIA = "https://www.tuazar.com/loteria/resultados/"
URL_ANIMALITOS = "https://www.tuazar.com/loteria/animalitos/resultados/"
DATOS_ANIMALITOS_URL = "https://loteriadehoy.com/datos/animalitos/"
SHEET_ID = "1c4FhmgoR-PfNa9Z-iNkvI1s-zeZTTsVLDZK7xgUkWVQ"
WORKSHEET_RESULTADOS = "Resultados"
WORKSHEET_DATOS_ANIMALITOS = "DatosAnimalitos"

def get_creds():
    scopes = ["https://www.googleapis.com/auth/spreadsheets"]
    if os.getenv("GSERVICE_JSON"):
        info = json.loads(os.environ["GSERVICE_JSON"])
        return Credentials.from_service_account_info(info, scopes=scopes)
    return Credentials.from_service_account_file("service_account.json", scopes=scopes)

def fetch_html(url: str):
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    r = requests.get(url, headers=headers, timeout=20)
    r.raise_for_status()
    return r.text

def clean(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip())

def extract_date(soup: BeautifulSoup) -> str:
    m = re.search(r"\b\d{2}/\d{2}/\d{4}\b", soup.get_text(" ", strip=True))
    return m.group(0) if m else time.strftime("%d/%m/%Y")

def get_sheet_and_ws(worksheet_name: str):
    gc = gspread.authorize(get_creds())
    sh = gc.open_by_key(SHEET_ID)
    try:
        return sh.worksheet(worksheet_name)
    except WorksheetNotFound:
        return sh.add_worksheet(title=worksheet_name, rows=1000, cols=10)

# --- Parsers ---
def parse_loteria(html):
    soup = BeautifulSoup(html, "html.parser")
    date = extract_date(soup)
    rows = []
    # Esquema simplificado para el ejemplo
    for h2 in soup.find_all("h2"):
        lot_name = clean(h2.get_text()).upper()
        table = h2.find_next("table")
        if table:
            for tr in table.find_all("tr")[1:]: # Saltar encabezado
                tds = tr.find_all("td")
                if len(tds) > 1:
                    rows.append({
                        "categoria": "loteria", "fecha": date, "loteria": lot_name,
                        "horario": clean(tds[0].get_text()), "triple": clean(tds[1].get_text())
                    })
    return rows

def parse_datos_animalitos_loteriadehoy(html, base_url):
    soup = BeautifulSoup(html, "html.parser")
    date = extract_date(soup)
    rows = []
    
    # Buscamos los bloques de cada juego (suelen estar en divs o sections)
    # Esta lógica busca el nombre del juego y su imagen asociada
    items = soup.find_all(["h6", "img"])
    
    current_game = "General"
    for el in items:
        if el.name == "h6":
            text = clean(el.get_text())
            if text: current_game = text
        
        if el.name == "img" and "wp-content" in el.get("src", ""):
            src = el.get("src")
            full_url = urljoin(base_url, src)
            
            # Intentamos extraer número y animal del alt o del texto cercano
            alt_text = el.get("alt", "")
            rows.append({
                "fuente": "loteriadehoy",
                "categoria": "datos_animalitos",
                "fecha": date,
                "juego": current_game,
                "animal": alt_text,
                "image_url": full_url
            })
    return rows

def main():
    # 1. Scraping Resultados
    try:
        res_tuazar = parse_loteria(fetch_html(URL_LOTERIA))
        ws_res = get_sheet_and_ws(WORKSHEET_RESULTADOS)
        ws_res.clear()
        if res_tuazar:
            headers = list(res_tuazar[0].keys())
            data = [headers] + [[r.get(h, "") for h in headers] for r in res_tuazar]
            ws_res.update(data)
    except Exception as e: print(f"Error TuAzar: {e}")

    # 2. Scraping Datos (Pronósticos)
    try:
        res_datos = parse_datos_animalitos_loteriadehoy(fetch_html(DATOS_ANIMALITOS_URL), DATOS_ANIMALITOS_URL)
        ws_datos = get_sheet_and_ws(WORKSHEET_DATOS_ANIMALITOS)
        ws_datos.clear()
        if res_datos:
            headers = list(res_datos[0].keys())
            data = [headers] + [[r.get(h, "") for h in headers] for r in res_datos]
            ws_datos.update(data)
            print(f"Se cargaron {len(res_datos)} datos de animalitos.")
    except Exception as e: print(f"Error LoteriaDeHoy: {e}")

if __name__ == "__main__":
    main()