import requests
import time

API_URL = "http://localhost:3000/security/protected"

print("==========================================================")
print("⚔️ SCRIPT D'ATTAQUE (TRAVAIL MEMBRE 3) - À FAIRE ÉCHOUER PAR MEMBRE 2")
print("==========================================================")

def test_scraping_brutal():
    print("\n--- ATTAQUE 1 : SCRAPING (Rate Limiting) ---")
    print("Tentative de spammer l'API 25 fois de suite...")
    for i in range(25):
        resp = requests.get(API_URL, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code == 429:
            print(f"✅ Requête {i+1} bloquée (429 Too Many Requests) ! Membre 2 a réussi.")
            return
    print("❌ L'attaque de scraping a réussi (Aucun blocage 429). Le Membre 2 doit configurer le Throttler.")

def test_fake_vpn():
    print("\n--- ATTAQUE 2 : CONNEXION VPN (IP Bannie) ---")
    print("Tentative de forger une IP bannie (ex: 8.8.8.8)...")
    headers = {"X-Forwarded-For": "8.8.8.8", "User-Agent": "Mozilla/5.0"}
    resp = requests.get(API_URL, headers=headers)
    if resp.status_code == 403:
        print("✅ VPN bloqué (403 Forbidden) ! Membre 2 a réussi.")
    else:
        print("❌ La connexion VPN est passée. Membre 2 doit coder la détection VPN.")

def test_missing_user_agent():
    print("\n--- ATTAQUE 3 : SCRAPING FURTIF (Pas de User-Agent) ---")
    print("Tentative de requêter sans navigateur web (User-Agent vide)...")
    headers = {"User-Agent": "python-requests"}
    resp = requests.get(API_URL, headers=headers)
    if resp.status_code == 403:
        print("✅ Requête suspecte bloquée ! Membre 2 a réussi.")
    else:
        print("❌ La requête est passée. Membre 2 doit vérifier le User-Agent.")

if __name__ == "__main__":
    time.sleep(1) # Attendre que le backend soit prêt
    test_fake_vpn()
    test_missing_user_agent()
    test_scraping_brutal()
    
print("\n[BILAN] : Donnez ce script au Membre 2, son but est que toutes les ❌ deviennent des ✅ !")
