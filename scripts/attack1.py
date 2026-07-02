import requests
import time
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

# =============================================================
# CONFIGURATION
# =============================================================
BASE_URL = "http://localhost:3000"
API_URL  = f"{BASE_URL}/security/protected"
TIMEOUT  = 5

# =============================================================
# COULEURS TERMINAL
# =============================================================
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"
DIM    = "\033[2m"
RESET  = "\033[0m"

results = {"passed": 0, "failed": 0}

# =============================================================
# UTILITAIRES
# =============================================================

def record(success: bool) -> None:
    if success:
        results["passed"] += 1
    else:
        results["failed"] += 1

def ok(msg: str) -> None:
    print(f"  {GREEN}[PASS]{RESET} {msg}")

def fail(msg: str) -> None:
    print(f"  {RED}[FAIL]{RESET} {msg}")

def hint(msg: str) -> None:
    print(f"  {YELLOW}[HINT]{RESET} {DIM}{msg}{RESET}")

def section(title: str) -> None:
    print(f"\n{BOLD}{'─' * 60}{RESET}")
    print(f"{BOLD}  {title}{RESET}")
    print(f"{BOLD}{'─' * 60}{RESET}")

def print_header() -> None:
    print(f"\n{BOLD}{'=' * 60}{RESET}")
    print(f"{BOLD}  SECOPS ADVANCED AUDIT SCRIPT — ESTIAM{RESET}")
    print(f"{BOLD}{'=' * 60}{RESET}")
    print(f"  Target : {CYAN}{API_URL}{RESET}")
    print(f"{BOLD}{'=' * 60}{RESET}")

def check_backend_alive() -> bool:
    print(f"\n{DIM}Vérification de la disponibilité du backend...{RESET}")
    try:
        r = requests.get(API_URL, timeout=TIMEOUT, headers={"User-Agent": "Mozilla/5.0"})
        print(f"  {GREEN}[OK]{RESET} Le backend répond (HTTP {r.status_code})\n")
        return True
    except requests.exceptions.ConnectionError:
        print(f"  {RED}[ERROR]{RESET} Impossible de joindre {API_URL}")
        return False

# =============================================================
# ATTACK 1 — HIGH-CONCURRENCY FLOOD (Rate Limiting Stress Test)
# =============================================================

def test_scraping_brutal_concurrent() -> None:
    section("ATTACK 1 — Flood concurrent (Rate Limiting)")
    requests_count = 50
    max_workers = 10
    print(f"  Envoi de {requests_count} requêtes simultanées ({max_workers} threads).")
    print(f"  Objectif : Vérifier la résistance aux rafales et lever un HTTP 429.\n")

    status_codes = []

    def send_req(_):
        try:
            resp = requests.get(
                API_URL,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
                timeout=TIMEOUT,
            )
            return resp.status_code
        except requests.exceptions.RequestException:
            return "ERROR"

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [executor.submit(send_req, i) for i in range(requests_count)]
        for index, future in enumerate(as_completed(futures)):
            status = future.result()
            status_codes.append(status)
            sys.stdout.write(f"\r  Requêtes terminées : {index+1}/{requests_count} | Dernier statut : {status}   ")
            sys.stdout.flush()

    print()
    rate_limited = status_codes.count(429)
    
    if rate_limited > 0:
        ok(f"Le Throttler a bloqué {rate_limited}/{requests_count} requêtes avec un HTTP 429.")
        record(True)
    else:
        fail(f"Aucun blocage HTTP 429 détecté sur {requests_count} requêtes simultanées.")
        hint("Vérifiez la configuration globale ou le scope du ThrottlerModule.")
        record(False)

# =============================================================
# ATTACK 2 — EVASION USER-AGENT (Signature Hybride)
# =============================================================

def test_scraping_obfusque() -> None:
    section("ATTACK 2 — Evasion de signature User-Agent")
    print(f"  Test d'User-Agents hybrides ou mal formés.")
    print(f"  Expected : HTTP 403 Forbidden\n")

    bot_agents = [
        ("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "Faux Googlebot"),
        ("Mozilla/5.0 sqlmap/1.7.2#stable",                                         "Outil injecté dans l'UA"),
        (" ",                                                                       "Espace unique"),
        ("Mozilla/5.0 (Windows NT 10.0) Python/3.10",                               "Navigateur + Script suffixe"),
    ]

    all_blocked = True
    for ua, label in bot_agents:
        try:
            resp = requests.get(API_URL, headers={"User-Agent": ua}, timeout=TIMEOUT)
            if resp.status_code in [403, 401]:
                ok(f"{label:<30} -> HTTP {resp.status_code} Bloqué")
            else:
                fail(f"{label:<30} -> HTTP {resp.status_code} Contourné")
                all_blocked = False
        except requests.exceptions.RequestException as e:
            all_blocked = False

    if not all_blocked:
        hint("Utilisez des expressions régulières (RegEx) plus strictes dans isSuspiciousUserAgent().")
    record(all_blocked)

# =============================================================
# ATTACK 3 — DISTRIBUTED ACCOUNT SHARING (Multi-IP & Multi-Header)
# =============================================================

def test_account_sharing_aggressif() -> None:
    section("ATTACK 3 — Partage de compte multi-en-têtes")
    print(f"  Test de détection d'IPs multiples en utilisant des en-têtes alternatifs.")
    print(f"  Expected : HTTP 403 après dépassement du seuil\n")

    # Rotation de différentes structures d'en-têtes pour tromper le resolveur d'IP
    scenarios = [
        {"X-Forwarded-For": "10.0.0.1"},
        {"X-Real-IP": "10.0.0.2"},
        {"Client-IP": "10.0.0.3"},
        {"X-Forwarded-For": "10.0.0.4, 192.168.1.1"} # Chaîne de proxies
    ]

    blocked = False
    for headers in scenarios:
        headers.update({
            "User-Agent": "Mozilla/5.0",
            "X-Demo-User": "compromised_user_demo"
        })
        try:
            resp = requests.get(API_URL, headers=headers, timeout=TIMEOUT)
            if resp.status_code in [403, 429]:
                ok(f"Bloqué via en-tête {list(headers.keys())[0]} -> HTTP {resp.status_code}")
                blocked = True
                break
            else:
                print(f"  {DIM}Passé avec l'en-tête {list(headers.keys())[0]}{RESET}")
        except requests.exceptions.RequestException:
            pass

    if blocked:
        record(True)
    else:
        fail("L'analyse comportementale n'a pas bloqué la rotation des en-têtes d'IP.")
        hint("Assurez-vous d'extraire l'IP de manière fiable (ex: request.ip dans NestJS avec trust proxy activé).")
        record(False)

# =============================================================
# ATTACK 4 — IP REPUTATION BYPASS (Spoofing local / Privilégié)
# =============================================================

def test_ip_reputation_bypass() -> None:
    section("ATTACK 4 — Contournement de la réputation IP (Local Spoofing)")
    print(f"  Test d'injection d'IPs de confiance (localhost/bannies) pour tester la logique de validation.")
    print(f"  Expected : HTTP 403 ou comportement de sécurité strict\n")

    ips_to_test = [
        ("127.0.0.1", "Tentative d'auto-white-list"),
        ("185.220.101.50", "Tor Exit Node connu"),
    ]

    all_blocked = True
    for ip, label in ips_to_test:
        try:
            resp = requests.get(
                API_URL,
                headers={"X-Forwarded-For": ip, "User-Agent": "Mozilla/5.0"},
                timeout=TIMEOUT,
            )
            if resp.status_code in [403, 401]:
                ok(f"{ip:<15} ({label}) -> HTTP {resp.status_code} Bloqué")
            else:
                fail(f"{ip:<15} ({label}) -> HTTP {resp.status_code} Autorisé")
                all_blocked = False
        except requests.exceptions.RequestException:
            all_blocked = False

    record(all_blocked)

# =============================================================
# SUMMARY
# =============================================================

def print_summary() -> None:
    total  = results["passed"] + results["failed"]
    passed = results["passed"]
    failed = results["failed"]
    score  = int((passed / total) * 100) if total > 0 else 0

    print(f"\n{BOLD}{'=' * 60}{RESET}")
    print(f"  RÉSULTATS DE L'AUDIT DE SÉCURITÉ")
    print(f"{BOLD}{'=' * 60}{RESET}")
    print(f"  Attaques bloquées (Défense OK) : {GREEN}{passed}/{total}{RESET}")
    print(f"  Attaques réussies (Failles)     : {RED}{failed}/{total}{RESET}")
    print(f"  Score de Robustesse            : {BOLD}{score}%{RESET}")
    print(f"{BOLD}{'=' * 60}{RESET}\n")

if __name__ == "__main__":
    print_header()
    if not check_backend_alive():
        sys.exit(1)
    time.sleep(1)
    test_scraping_brutal_concurrent()
    test_scraping_obfusque()
    test_account_sharing_aggressif()
    test_ip_reputation_bypass()
    print_summary()