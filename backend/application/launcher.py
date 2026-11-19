"""Starts the tracker for people who just want to use it, without knowing Django.

It picks the folder for the data (the Documents folder on Windows), sets up the database, starts the server
on a free port and opens the browser. When the tracker already runs, it only opens the browser, so a second
double click does not start a second server on the same database.

Nothing from Django is imported at the top: the data folder has to be set in the environment before the settings load.
"""
import atexit
import io
import logging
import os
import socket
import sys
import threading
import time
import urllib.request
import webbrowser
from pathlib import Path

APP_FOLDER = "Bewerbungstracker"
RUNNING_FILE = "server.running"  # holds the port while the server runs
START_PORT = 8000
LAST_PORT = 8100


def windows_documents_folder():
    """The real Documents folder, which OneDrive may have moved away from the home folder."""
    try:
        import ctypes
        from ctypes import wintypes

        # FOLDERID_Documents
        guid = (ctypes.c_ubyte * 16)(0xD0, 0x9A, 0xD3, 0xFD, 0x8F, 0x23, 0xAF, 0x46, 0xAD, 0xB4, 0x6C, 0x85, 0x48, 0x03, 0x69, 0xC7)
        path = ctypes.c_wchar_p()
        if ctypes.windll.shell32.SHGetKnownFolderPath(ctypes.byref(guid), 0, None, ctypes.byref(path)) != 0:
            return None
        found = Path(path.value)
        ctypes.windll.ole32.CoTaskMemFree(path)
        return found
    except Exception:
        return None


def default_data_dir(system=None, home=None, documents=None, environ=None):
    """TRACKER_DATA_DIR if set, otherwise a folder of its own in the user's documents (Windows) or home folder."""
    environ = os.environ if environ is None else environ
    if environ.get("TRACKER_DATA_DIR"):
        return Path(environ["TRACKER_DATA_DIR"])
    system = system or sys.platform
    home = Path(home) if home else Path.home()
    if system.startswith("win"):
        base = documents or windows_documents_folder() or home / "Documents"
        return Path(base) / APP_FOLDER
    return home / APP_FOLDER


def running_address(data_dir):
    """The address of a tracker that is already running on this data, or None (also for a leftover file)."""
    try:
        port = int((Path(data_dir) / RUNNING_FILE).read_text().strip())
        url = f"http://127.0.0.1:{port}"
        with urllib.request.urlopen(f"{url}/api/", timeout=1.5):
            return url
    except (OSError, ValueError):
        return None


def free_port(start=START_PORT, last=LAST_PORT):
    for port in range(start, last):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            try:
                sock.bind(("127.0.0.1", port))
            except OSError:
                continue
            return port
    raise RuntimeError(f"No free port between {start} and {last - 1}.")


def open_when_ready(url, timeout=30):
    """Opens the browser as soon as the server answers, so the page never shows a connection error."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(f"{url}/api/", timeout=1):
                break
        except OSError:
            time.sleep(0.3)
    if not os.environ.get("TRACKER_NO_BROWSER"):
        webbrowser.open(url)


def say(text):
    print(text, flush=True)


def main():
    # A console with an old code page must not stop the start because of an umlaut.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")
    data_dir = default_data_dir()
    data_dir.mkdir(parents=True, exist_ok=True)
    os.environ["TRACKER_DATA_DIR"] = str(data_dir)
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

    existing = running_address(data_dir)
    if existing:
        say(f"Der Bewerbungstracker läuft schon: {existing}")
        open_when_ready(existing, timeout=5)
        return

    import django
    from django.core.management import call_command

    django.setup()
    call_command("migrate", interactive=False, verbosity=0)
    port = int(os.environ.get("TRACKER_PORT") or free_port())
    url = f"http://127.0.0.1:{port}"

    marker = data_dir / RUNNING_FILE
    marker.write_text(str(port))
    atexit.register(marker.unlink, missing_ok=True)

    say("Bewerbungstracker läuft.")
    say(f"Adresse: {url}")
    say(f"Deine Daten liegen in: {data_dir}")
    say("Zum Beenden dieses Fenster schließen.")

    logging.getLogger("django.server").setLevel(logging.WARNING)  # one line per request would only confuse
    threading.Thread(target=open_when_ready, args=(url,), daemon=True).start()
    # The banner of runserver is swallowed, the lines above say what matters. Only this computer may connect.
    call_command("runserver", f"127.0.0.1:{port}", use_reloader=False, stdout=io.StringIO())
