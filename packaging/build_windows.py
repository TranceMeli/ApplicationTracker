"""Builds Bewerbungstracker-Windows.zip: a folder that runs without installing anything.

The folder holds the embeddable Python of python.org, the packages of the backend, the backend itself and the built
frontend. "Tracker starten.bat" starts it. The script only needs Python and, for the frontend, Node.js with npm.

    python packaging/build_windows.py                  builds dist-package/Bewerbungstracker-Windows.zip
    python packaging/build_windows.py --smoke          also starts the result once and loads the page
    python packaging/build_windows.py --embed-zip F    uses a Python zip that is already on disk

The embeddable Python must be the same minor version as the Python that runs this script, because the packages are
installed with it and may contain compiled parts.
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PACKAGE_NAME = "Bewerbungstracker"
DEFAULT_VERSION = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"

# Not part of the package: personal data, caches and the tests.
BACKEND_IGNORE = shutil.ignore_patterns(
    ".venv", "__pycache__", "*.pyc", "db.sqlite3*", "media", "backups", ".port", "*.bak*", "tests.py", "test_*.py",
)

START_BAT = (
    "@echo off\r\n"
    "title Bewerbungstracker\r\n"
    'cd /d "%~dp0app\\backend"\r\n'
    '"%~dp0python\\python.exe" start_tracker.py\r\n'
    "if errorlevel 1 (\r\n"
    "  echo.\r\n"
    "  echo Der Bewerbungstracker konnte nicht gestartet werden. Die Meldung oben hilft bei der Fehlersuche.\r\n"
    "  pause\r\n"
    ")\r\n"
)

READ_ME = """Bewerbungstracker
=================

So startest du den Tracker:

1. Diesen Ordner entpacken, zum Beispiel nach Dokumente (nicht aus dem ZIP heraus starten).
2. "Tracker starten" doppelklicken. Der Browser öffnet sich von selbst.
3. Beim ersten Mal zeigt Windows vielleicht "Der Computer wurde durch Windows geschützt".
   Das liegt daran, dass das Programm nicht von Microsoft geprüft wurde. Klicke auf
   "Weitere Informationen" und dann auf "Trotzdem ausführen".
4. Zum Beenden das schwarze Fenster schließen. Die Bewerbungen bleiben gespeichert.

Deine Daten
-----------
Alle Bewerbungen und Dokumente liegen im Ordner "Bewerbungstracker" in deinen Dokumenten.
Das Fenster nennt den genauen Ort. Sichere diesen Ordner, dann ist alles gesichert.
Der Tracker legt außerdem einmal am Tag ein Backup im Unterordner "backups" an.

Alles bleibt auf deinem Computer, es gibt kein Konto und keinen Server im Internet.

Update
------
Lade die neue ZIP-Datei, entpacke sie und lösche den alten Programmordner. Deine Daten
bleiben erhalten, weil sie in einem eigenen Ordner liegen.
"""


def run(command, **kwargs):
    print("+", " ".join(str(c) for c in command), flush=True)
    subprocess.run(command, check=True, **kwargs)


def build_frontend():
    frontend = ROOT / "frontend"
    npm = shutil.which("npm") or "npm"
    run([npm, "ci"], cwd=frontend)
    run([npm, "run", "build"], cwd=frontend)
    return frontend / "dist"


def get_embedded_python(version, given, work):
    if given:
        return Path(given)
    url = f"https://www.python.org/ftp/python/{version}/python-{version}-embed-amd64.zip"
    target = work / "python-embed.zip"
    print(f"Downloading {url}", flush=True)
    urllib.request.urlretrieve(url, target)
    return target


def prepare_python(embed_zip, folder):
    with zipfile.ZipFile(embed_zip) as archive:
        archive.extractall(folder)
    pth = next(folder.glob("python*._pth"))
    lines = [line for line in pth.read_text().splitlines() if line.strip() != "#import site"]
    # The ._pth file decides where Python looks: the packages, the backend, and the site module that finds them.
    lines += ["Lib\\site-packages", "..\\app\\backend", "import site"]
    pth.write_text("\r\n".join(lines) + "\r\n")


def build(args):
    out = Path(args.out).resolve()
    work = Path(tempfile.mkdtemp(prefix="tracker-build-"))
    try:
        dist = Path(args.frontend_dist) if args.frontend_dist else build_frontend()
        embed_zip = get_embedded_python(args.python_version, args.embed_zip, work)

        folder = work / PACKAGE_NAME
        (folder / "app" / "frontend").mkdir(parents=True)
        shutil.copytree(ROOT / "backend", folder / "app" / "backend", ignore=BACKEND_IGNORE)
        shutil.copytree(dist, folder / "app" / "frontend" / "dist")

        prepare_python(embed_zip, folder / "python")
        site_packages = folder / "python" / "Lib" / "site-packages"
        run([sys.executable, "-m", "pip", "install", "--target", str(site_packages), "--only-binary=:all:", "--no-warn-script-location", "-r", str(ROOT / "backend" / "requirements.txt")])

        (folder / "Tracker starten.bat").write_bytes(START_BAT.encode("utf-8"))
        (folder / "LIES MICH.txt").write_bytes(READ_ME.replace("\n", "\r\n").encode("utf-8-sig"))

        if args.smoke:
            smoke_test(folder)

        out.mkdir(parents=True, exist_ok=True)
        archive = out / "Bewerbungstracker-Windows.zip"
        archive.unlink(missing_ok=True)
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zipped:
            for path in sorted(folder.rglob("*")):
                if "__pycache__" in path.parts:
                    continue
                zipped.write(path, path.relative_to(work))
        print(f"Built {archive} ({archive.stat().st_size / 1_000_000:.0f} MB)")
        return archive
    finally:
        shutil.rmtree(work, ignore_errors=True)


def smoke_test(folder):
    """Starts the program of the folder like the bat file does and checks that it serves the page and the API."""
    with tempfile.TemporaryDirectory(prefix="tracker-data-") as data:
        port = 8500
        env = {**os.environ, "TRACKER_DATA_DIR": data, "TRACKER_PORT": str(port), "TRACKER_NO_BROWSER": "1"}
        for name in ("PYTHONPATH", "PYTHONHOME", "VIRTUAL_ENV"):
            env.pop(name, None)
        server = subprocess.Popen(
            [str(folder / "python" / "python.exe"), "start_tracker.py"], cwd=folder / "app" / "backend", env=env,
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
        )
        try:
            for _ in range(80):
                if server.poll() is not None:
                    break
                try:
                    with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=1) as page:
                        html = page.read().decode("utf-8")
                    with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/applications/", timeout=2) as api:
                        api.read()
                    assert '<div id="app">' in html, "the page is not the frontend"
                    print("Smoke test passed: page and API answer.")
                    return
                except OSError:
                    time.sleep(0.5)
            raise SystemExit("Smoke test failed, the server did not answer:\n" + (server.stdout.read() if server.poll() is not None else "(still running)"))
        finally:
            server.terminate()
            try:
                server.communicate(timeout=15)
            except subprocess.TimeoutExpired:
                server.kill()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", default=str(ROOT / "dist-package"))
    parser.add_argument("--python-version", default=DEFAULT_VERSION, help="version of the embeddable Python to download")
    parser.add_argument("--embed-zip", help="a python-embed zip that is already on disk")
    parser.add_argument("--frontend-dist", help="a built frontend instead of running npm")
    parser.add_argument("--smoke", action="store_true", help="start the result once and load the page")
    build(parser.parse_args())
