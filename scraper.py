import re
import time
import warnings
import json
import os
import requests
from bs4 import BeautifulSoup
import gspread
from google.oauth2.service_account import Credentials

# Silenciamos advertencias de SSL
warnings.filterwarnings("ignore")

# ─── CONFIGURACIÓN ────────────────────────────────────────────────────────────
SHEET_ID = "1c4FhmgoR-PfNa9Z-iNkvI1s-zeZTTsVLDZK7xgUkWVQ"
URL_RESULTADOS   = "https://www.tuazar.com/loteria/resultados/"
URL_ANIMALITOS   = "https://www.tuazar.com/loteria/animalitos/resultados/"
URL_DATOS        = "https://loteriadehoy.com/datos/animalitos/"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept-Language": "es-VE,es;q=0.9",
}

COLS_RESULTADOS = ["categoria", "fecha", "loteria", "horario", "triple", "terminal_a_b", "terminal_c", "numero", "signo", "cacho", "animal"]
COLS_DATOS = ["categoria", "fecha", "loteria", "numero", "animal", "frecuencia"]

def get_creds():
    scopes = ["https://www.googleapis.com/auth/spreadsheets"]
    if os.getenv("GSERVICE_JSON"):
        info = json.loads(os.environ["GSERVICE_JSON"])
        return Credentials.from_service_account_info(info, scopes=scopes)
    return Credentials.from_service_account_file("service_account.json", scopes=scopes)

def fetch(url: str) -> str:
    r = requests.get(url, headers=HEADERS, timeout=30, verify=False)
    r.raise_for_status()
    return r.text

# ─── EL PARSER MAGICO (RESULTADOS) ────────────────────────────────────────────
def parse_tuazar_magico(url, categoria):
    try:
        html = fetch(url)
        soup = BeautifulSoup(html, "html.parser")
        fecha = time.strftime("%d/%m/%Y")
        rows = []
        
        for img in soup.find_all("img"):
            alt = img.get("alt", "").strip()
            if alt: img.insert_after(f" [[ANIMAL:{alt}]] ")
        
        for h in soup.find_all(["h2", "h3", "h4"]):
            nombre = h.get_text(strip=True).upper()
            nombre_limpio = re.sub(r"\[\[ANIMAL:.*?\]\]", "", nombre).strip()
            if len(nombre_limpio) > 3 and not re.search(r"(RESULTADO|TUAZAR|MENÚ|PUBLICIDAD|LOTERÍA)", nombre_limpio):
                h.insert_before(f" ¡¡¡LOTERIA_{nombre_limpio}!!! ")

        texto = soup.get_text(" ")
        chunks = texto.split(" ¡¡¡LOTERIA_")
        seen = set()

        for chunk in chunks[1:]:
            if "!!!" not in chunk: continue
            partes = chunk.split("!!!", 1)
            if len(partes) < 2: continue
            
            lot_name = partes[0].strip()
            lot_name = re.sub(r"\[\[ANIMAL:.*?\]\]", "", lot_name).strip()
            lot_name = re.sub(r"RESULTADOS\s+(?:DE\s+)?", "", lot_name)
            lot_name = lot_name.replace("LOGO", "").strip()
            
            content = partes[1]

            for m in re.finditer(r"\b(\d{1,2}:\d{2}\s*(?:AM|PM))\b", content, re.IGNORECASE):
                horario = m.group(1).upper()
                start = max(0, m.end())
                end = min(len(content), m.end() + 50)
                contexto_despues = content[start:end]
                start_antes = max(0, m.start() - 20)
                contexto_total = content[start_antes:end].upper()

                if categoria == "loteria":
                    triple_m = re.search(r"(?<!:)\b\d{3,4}\b", contexto_despues)
                    if not triple_m: continue
                    triple = triple_m.group(0)

                    signo = ""
                    signo_m = re.search(r"\b(ARI|TAU|GEM|CAN|LEO|VIR|LIB|ESC|SAG|CAP|ACU|PIS)\b", contexto_total)
                    if signo_m: signo = signo_m.group(1)

                    key = f"{lot_name}-{horario}-{triple}"
                    if key not in seen:
                        seen.add(key)
                        rows.append({
                            "categoria": "loteria", "fecha": fecha, "loteria": lot_name,
                            "horario": horario, "triple": triple, "terminal_a_b": "",
                            "terminal_c": "", "numero": "", "signo": signo, "cacho": "", "animal": ""
                        })

                elif categoria == "animalitos":
                    animal = ""
                    animal_m = re.search(r"\[\[ANIMAL:(.*?)\]\]", contexto_despues)
                    if animal_m:
                        animal_raw = animal_m.group(1).upper()
                    else:
                        text_limpio = re.sub(r"\[\[.*?\]\]", "", contexto_despues)
                        am = re.search(r"(?:[-:]\s*)?(?:\d{1,2}\s+)?([A-ZÁÉÍÓÚÑ]{3,})", text_limpio)
                        animal_raw = am.group(1) if am else ""
                        
                    n_match = re.search(r"([A-ZÁÉÍÓÚÑ]{3,})", animal_raw)
                    if n_match and "LOGO" not in animal_raw:
                        animal = n_match.group(1)
                        
                    if animal:
                        key = f"{lot_name}-{horario}-{animal}"
                        if key not in seen:
                            seen.add(key)
                            rows.append({
                                "categoria": "animalitos", "fecha": fecha, "loteria": lot_name,
                                "horario": horario, "triple": "", "terminal_a_b": "",
                                "terminal_c": "", "numero": "", "signo": "", "cacho": "", "animal": animal
                            })
        return rows
    except Exception as e:
        print(f"❌ Error en {url}: {e}")
        return []

# ─── PARSER DE PRONÓSTICOS (AHORA CON NOMBRE COMPLETO) ────────────────────────
def parse_pronosticos():
    urls = [URL_DATOS, "https://lotoven.com/datos/"]
    fecha = time.strftime("%d/%m/%Y")
    rows = []
    seen = set()

    for url in urls:
        try:
            html = fetch(url)
            soup = BeautifulSoup(html, "html.parser")
            texto = soup.get_text(" ")
            
            patron = re.compile(r"\b(\d{1,2})\s*[-–]?\s*([A-ZÁÉÍÓÚÑ]{3,15})\b", re.IGNORECASE)
            for num, animal in patron.findall(texto):
                animal = animal.upper()
                if "MENU" not in animal and "DATOS" not in animal:
                    
                    # AQUÍ ESTÁ LA MAGIA: Unimos el número y el animal
                    combo = f"{num} {animal}"
                    
                    if combo not in seen:
                        seen.add(combo)
                        rows.append({
                            "categoria": "datos_animalitos", "fecha": fecha, 
                            "loteria": "PRONÓSTICO", 
                            "numero": combo, # Forzamos a que guarde "17 PAVO"
                            "animal": combo, # En ambas columnas por seguridad
                            "frecuencia": ""
                        })
            if rows: return rows
        except: pass
    return rows

# ─── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("🚀 SCRAPER INFALIBLE LOTERÍA VENEZUELA (V5.1)")
    print("=" * 60)

    res_loterias = parse_tuazar_magico(URL_RESULTADOS, "loteria")
    print(f"  ✅ {len(res_loterias)} sorteos de loterías detectados.")

    res_animalitos = parse_tuazar_magico(URL_ANIMALITOS, "animalitos")
    print(f"  ✅ {len(res_animalitos)} sorteos de animalitos detectados.")

    res_datos = parse_pronosticos()
    print(f"  ✅ {len(res_datos)} pronósticos detectados.")

    total_res = res_loterias + res_animalitos

    if not total_res and not res_datos:
        print("\n❌ Siguen saliendo ceros. Revisa tu conexión.")
        return

    print("\n💾 GUARDANDO EN GOOGLE SHEETS...")
    try:
        gc = gspread.authorize(get_creds())
        sh = gc.open_by_key(SHEET_ID)

        if total_res:
            ws1 = sh.worksheet("Resultados")
            ws1.clear()
            filas_res = [COLS_RESULTADOS] + [[r.get(k, "") for k in COLS_RESULTADOS] for r in total_res]
            ws1.update(filas_res)

        if res_datos:
            try:
                ws2 = sh.worksheet("DatosAnimalitos")
            except:
                ws2 = sh.add_worksheet(title="DatosAnimalitos", rows=100, cols=10)
            ws2.clear()
            filas_dat = [COLS_DATOS] + [[r.get(k, "") for k in COLS_DATOS] for r in res_datos]
            ws2.update(filas_dat)

    except Exception as e:
        print(f"  ❌ Error de Google Sheets: {e}")

    print("\n✅ ¡FINALIZADO CON ÉXITO!")

if __name__ == "__main__":
    main()