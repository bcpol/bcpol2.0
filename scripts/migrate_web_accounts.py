#!/usr/bin/env python3
"""One-time account migration. Run privately; NEVER commit or print passwords.

Requires:
  SUPABASE_URL=https://<project>.supabase.co
  SUPABASE_SECRET_KEY=<server-side key>
  remote branch origin/backup-before-auth-hardening-20261102
"""
import json
import os
import re
import subprocess
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError

SOURCE_REF = "origin/backup-before-auth-hardening-20261102:index.html"

def rpc(name, payload):
    base = os.environ.get("SUPABASE_URL", "").strip().rstrip("/")
    key = os.environ.get("SUPABASE_SECRET_KEY", "").strip()
    if not base.startswith("https://") or not key:
        raise RuntimeError("Configura SUPABASE_URL y SUPABASE_SECRET_KEY en tu entorno privado.")
    headers = {"apikey": key, "Content-Type": "application/json"}
    if key.startswith("eyJ"):
        headers["Authorization"] = "Bearer " + key
    req = Request(base + "/rest/v1/rpc/" + name,
                  data=json.dumps(payload).encode("utf-8"), method="POST",
                  headers=headers)
    try:
        with urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except HTTPError as exc:
        raise RuntimeError("La importación ha fallado; comprueba los permisos del servidor.") from None

def main():
    if len(sys.argv) != 2 or sys.argv[1] != "--migrate":
        print("Para ejecutar la migración privada: python scripts/migrate_web_accounts.py --migrate")
        return 2
    old = subprocess.check_output(["git", "show", SOURCE_REF], stderr=subprocess.DEVNULL).decode("utf-8")
    match = re.search(r"const usuarios=(\{[^;]+?\});", old)
    if not match:
        raise RuntimeError("No se encuentra el diccionario original de usuarios.")
    users = json.loads(match.group(1))
    if len(users) != 39:
        raise RuntimeError("La lista no contiene los 39 usuarios esperados; no se importará.")
    for username, password in users.items():
        if rpc("bcpol_web_auth_import", {"p_username": username, "p_password": password}) is not True:
            raise RuntimeError("Fallo al importar una cuenta.")
    count = rpc("bcpol_web_auth_count", {})
    if count != len(users):
        raise RuntimeError("El número de cuentas importadas no coincide.")
    print(f"Importación verificada: {count} cuentas. No se ha mostrado ninguna contraseña.")
    print("A continuación comprueba acceso y elimina la función RPC de importación.")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, subprocess.CalledProcessError) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(1)
