"""
Pré-téléchargement des paquets de traduction (à lancer AVANT le hackathon).
==========================================================================
Télécharge les paires de langue françaises -> anglais / espagnol pour
argostranslate, afin de traduire ensuite 100 % hors-ligne.

Usage :
    python prefetch_translation.py
"""

import argostranslate.package as pkg

PAIRS = [("fr", "en"), ("en", "es"), ("en", "zh"), ("es", "en")]


def main():
    print("Mise a jour de l'index des paquets...")
    pkg.update_package_index()
    available = pkg.get_available_packages()

    for src, tgt in PAIRS:
        match = next((p for p in available
                      if p.from_code == src and p.to_code == tgt), None)
        if not match:
            print(f"  [x] paire {src}->{tgt} introuvable dans l'index")
            continue
        print(f"  telechargement {src}->{tgt}...")
        path = match.download()
        pkg.install_from_path(path)
        print(f"  [ok] {src}->{tgt} installe")

    print("\nTermine. La traduction multilingue est maintenant disponible hors-ligne.")


if __name__ == "__main__":
    main()
