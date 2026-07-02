import requests
import time
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
API_URL  = "http://localhost:3000/security/protected"
TIMEOUT  = 5

# Token JWT valide — remplace par un vrai token obtenu via POST /auth/login
VALID_TOKEN = "REMPLACE_PAR_TON_JWT_TOKEN"

# ─────────────────────────────────────────────
# COULEURS TERMINAL
# ─────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
BLUE   = "\033[94m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

results = {"passed": 0, "failed": 0}

# ─────────────────────────────────────────────
# UTILITAIRES
# ─────────────────────────────────────────────
def record(success: bool):
    if success:
        results["passed"] += 1
    else:
        results["failed"] += 1

def print_header():
    print(f"\n{BOLD}{'=' * 60}{RESET}")
    print(f"{BOLD}    SCRIPT D'ATTAQUE SECOPS — HACKATHON ESTIAM{RESET}")
    print(f"{BOLD}{'=' * 60}{RESET}")
    print(f"  Cible  : {BLUE}{API_URL}{RESET}")
    print(f"  Rôle   : Membre 3 attaque / Membre 2 défend")
    print(f"{BOLD}{'=' * 60}{RESET}\n")

def check_backend_alive():
    print(f"{YELLOW}[*] Vérification que le backend est disponible...{RESET}")
    try:
        r = requests.get(API_URL, timeout=TIMEOUT, headers={"User-Agent": "Mozilla/5.0"})
        print(f"{GREEN}[+] Backend en ligne (status {r.status_code}){RESET}\n")
        return True
    except requests.exceptions.ConnectionError:
        print(f"{RED}[!] Impossible de joindre {API_URL}{RESET}")
        print(f"{RED}    → Vérifiez : docker compose up backend{RESET}\n")
        return False
    except requests.exceptions.Timeout:
        print(f"{RED}[!] Backend ne répond pas (timeout {TIMEOUT}s){RESET}\n")
        return False

# ─────────────────────────────────────────────
# ATTAQUE 1 : SCRAPING BRUTAL (Rate Limiting)
# ─────────────────────────────────────────────
def test_scraping_brutal():
    print(f"{BOLD}--- ATTAQUE 1 : SCRAPING BRUTAL (Rate Limiting) ---{RESET}")
    print("Envoi de 25 requêtes rapides consécutives avec un User-Agent valide...")
    print("Objectif : déclencher un 429 Too Many Requests\n")

    blocked_at = None
    for i in range(1, 26):
        try:
            resp = requests.get(
                API_URL,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
                timeout=TIMEOUT,
            )
            sys.stdout.write(f"\r  Requête {i:02d}/25 → HTTP {resp.status_code}   ")
            sys.stdout.flush()
            if resp.status_code == 429:
                blocked_at = i
                break
        except requests.exceptions.RequestException as e:
            print(f"\n  {RED}[!] Erreur réseau : {e}{RESET}")
            break

    print()
    if blocked_at:
        print(f"  {GREEN} Bloqué à la requête {blocked_at}/25 (429 Too Many Requests){RESET}")
        record(True)
    else:
        print(f"  {RED} Aucun blocage après 25 requêtes{RESET}")
        print(f"  {YELLOW}   → Solution : configurer ThrottlerModule dans security.module.ts{RESET}")
        record(False)
    print()

# ─────────────────────────────────────────────
# ATTAQUE 2 : SCRAPING FURTIF (User-Agent suspect)
# ─────────────────────────────────────────────
def test_scraping_furtif():
    print(f"{BOLD}--- ATTAQUE 2 : SCRAPING FURTIF (User-Agent invalide) ---{RESET}")
    print("Envoi de requêtes avec des User-Agents typiques de bots/scrapers...")
    print("Objectif : déclencher un 403 Forbidden\n")

    bot_agents = [
        ("python-requests/2.28.0", "Script Python brut"),
        ("curl/7.88.1",            "cURL en ligne de commande"),
        ("Scrapy/2.11.0",          "Framework de scraping"),
        ("wget/1.21.3",            "Téléchargeur automatique"),
        ("Selenium/4.0",           "Navigateur automatisé"),
        ("",                       "User-Agent vide"),
    ]

    all_blocked = True
    for ua, label in bot_agents:
        try:
            resp = requests.get(API_URL, headers={"User-Agent": ua}, timeout=TIMEOUT)
            if resp.status_code == 403:
                print(f"  {GREEN} {label:<30} → 403 Bloqué{RESET}")
            else:
                print(f"  {RED} {label:<30} → {resp.status_code} Passé{RESET}")
                all_blocked = False
        except requests.exceptions.RequestException as e:
            print(f"  {RED}[!] Erreur pour '{ua}' : {e}{RESET}")
            all_blocked = False

    print()
    if all_blocked:
        print(f"  {GREEN} Tous les User-Agents suspects sont bloqués{RESET}")
    else:
        print(f"  {RED} Certains bots ont passé la détection{RESET}")
        print(f"  {YELLOW}   → Solution : améliorer isSuspiciousUserAgent() dans anti-fraud.service.ts{RESET}")
    record(all_blocked)
    print()

# ─────────────────────────────────────────────
# ATTAQUE 3 : PARTAGE DE COMPTE
# ─────────────────────────────────────────────
def test_account_sharing():
    print(f"{BOLD}--- ATTAQUE 3 : PARTAGE DE COMPTE (IPs simultanées) ---{RESET}")
    print("Simulation du même token JWT utilisé depuis 3 IPs différentes en parallèle...")
    print("Objectif : déclencher un 403 après dépassement de MAX_IPS_PER_ACCOUNT\n")

    fake_ips = ["192.168.1.10", "192.168.1.20", "192.168.1.30"]
    blocked = False

    def send_from_ip(ip):
        headers = {
            "User-Agent":      "Mozilla/5.0",
            "X-Forwarded-For": ip,
            "X-Demo-User":     "user_shared_42",
            "Authorization":   f"Bearer {VALID_TOKEN}",
        }
        try:
            resp = requests.get(API_URL, headers=headers, timeout=TIMEOUT)
            return ip, resp.status_code
        except requests.exceptions.RequestException as e:
            return ip, f"ERR: {e}"

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(send_from_ip, ip) for ip in fake_ips]
        for future in as_completed(futures):
            ip, status = future.result()
            if status == 403:
                print(f"  {GREEN} {ip} → 403 Bloqué (account sharing détecté){RESET}")
                blocked = True
            else:
                print(f"  {YELLOW}  {ip} → {status}{RESET}")

    print()
    if blocked:
        print(f"  {GREEN} Partage de compte correctement détecté et bloqué{RESET}")
        record(True)
    else:
        print(f"  {RED} Aucun blocage — le partage de compte n'est pas détecté{RESET}")
        print(f"  {YELLOW}   → Solution : vérifier MAX_IPS_PER_ACCOUNT dans anti-fraud.service.ts{RESET}")
        record(False)
    print()

# ─────────────────────────────────────────────
# ATTAQUE 4 : TENTATIVE VPN / IP BANNIE
# ─────────────────────────────────────────────
def test_fake_vpn():
    print(f"{BOLD}--- ATTAQUE 4 : TENTATIVE VPN (IP forgée / liste réputation) ---{RESET}")
    print("Envoi de requêtes avec des IPs issues de la liste FireHOL / Tor / proxies...")
    print("Objectif : déclencher un 403 Forbidden\n")

    suspicious_ips = [
        ("8.8.8.8",          "IP de démo bannie (seed local)"),
        ("1.2.3.4",          "IP liste FireHOL level1"),
        ("185.220.101.50",   "Nœud Tor connu"),
        ("45.95.147.10",     "Plage proxy bannie"),
    ]

    all_blocked = True
    for ip, label in suspicious_ips:
        try:
            headers = {
                "X-Forwarded-For": ip,
                "User-Agent":      "Mozilla/5.0",
            }
            resp = requests.get(API_URL, headers=headers, timeout=TIMEOUT)
            if resp.status_code == 403:
                print(f"  {GREEN} {ip:<20} ({label}) → 403 Bloqué{RESET}")
            else:
                print(f"  {RED} {ip:<20} ({label}) → {resp.status_code} Passé{RESET}")
                all_blocked = False
        except requests.exceptions.RequestException as e:
            print(f"  {RED}[!] Erreur pour {ip} : {e}{RESET}")
            all_blocked = False

    print()
    if all_blocked:
        print(f"  {GREEN} Toutes les IPs VPN/proxy sont bloquées{RESET}")
    else:
        print(f"  {RED} Certaines IPs suspectes ont passé la détection{RESET}")
        print(f"  {YELLOW}   → Solution : vérifier LOCAL_REPUTATION_SEED et le chargement FireHOL{RESET}")
    record(all_blocked)
    print()

# ─────────────────────────────────────────────
# BILAN FINAL
# ─────────────────────────────────────────────
def print_summary():
    total  = results["passed"] + results["failed"]
    passed = results["passed"]
    failed = results["failed"]
    score  = int((passed / total) * 100) if total > 0 else 0

    print(f"{BOLD}{'=' * 60}{RESET}")
    print(f"{BOLD}  BILAN FINAL{RESET}")
    print(f"{BOLD}{'=' * 60}{RESET}")
    print(f"  Attaques bloquées : {GREEN}{passed}/{total}{RESET}")
    print(f"  Attaques passées  : {RED}{failed}/{total}{RESET}")
    print(f"  Score défense     : {BOLD}{score}%{RESET}")

    if score == 100:
        print(f"\n  {GREEN}{BOLD} Défense parfaite ! Toutes les attaques sont bloquées.{RESET}")
    elif score >= 75:
        print(f"\n  {YELLOW}{BOLD}  Bonne défense, quelques vulnérabilités restantes.{RESET}")
    elif score >= 50:
        print(f"\n  {YELLOW}{BOLD}  Défense partielle — plusieurs vecteurs non couverts.{RESET}")
    else:
        print(f"\n  {RED}{BOLD} Défense insuffisante — le Membre 2 a du travail !{RESET}")
    print(f"{BOLD}{'=' * 60}{RESET}\n")

# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
if __name__ == "__main__":
    print_header()
    if not check_backend_alive():
        sys.exit(1)
    time.sleep(1)
    test_scraping_brutal()
    test_scraping_furtif()
    test_account_sharing()
    test_fake_vpn()
    print_summary()
