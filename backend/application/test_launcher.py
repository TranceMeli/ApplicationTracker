import os
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from django.test import SimpleTestCase

from . import launcher

BACKEND = Path(__file__).resolve().parent.parent


class DefaultDataDirTests(SimpleTestCase):
    def test_windows_uses_the_documents_folder_even_when_it_was_moved(self):
        path = launcher.default_data_dir(system="win32", home="C:/Users/Anna", documents="D:/OneDrive/Dokumente", environ={})
        self.assertEqual(path, Path("D:/OneDrive/Dokumente/Bewerbungstracker"))

    def test_other_systems_use_a_folder_in_the_home_directory(self):
        path = launcher.default_data_dir(system="linux", home="/home/anna", environ={})
        self.assertEqual(path, Path("/home/anna/Bewerbungstracker"))

    def test_the_environment_wins(self):
        self.assertEqual(launcher.default_data_dir(system="win32", environ={"TRACKER_DATA_DIR": "E:/Daten"}), Path("E:/Daten"))


class RunningAddressTests(SimpleTestCase):
    def test_no_file_means_not_running(self):
        with tempfile.TemporaryDirectory() as folder:
            self.assertIsNone(launcher.running_address(folder))

    def test_a_leftover_file_without_a_server_is_ignored(self):
        with tempfile.TemporaryDirectory() as folder:
            (Path(folder) / launcher.RUNNING_FILE).write_text(str(launcher.free_port(9000, 9100)))
            self.assertIsNone(launcher.running_address(folder))
            (Path(folder) / launcher.RUNNING_FILE).write_text("not a port")
            self.assertIsNone(launcher.running_address(folder))

    def test_a_server_that_answers_is_found(self):
        class Answer(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b"{}")

            def log_message(self, *args):
                pass

        server = HTTPServer(("127.0.0.1", 0), Answer)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with tempfile.TemporaryDirectory() as folder:
                (Path(folder) / launcher.RUNNING_FILE).write_text(str(server.server_port))
                self.assertEqual(launcher.running_address(folder), f"http://127.0.0.1:{server.server_port}")
        finally:
            server.shutdown()
            server.server_close()


class FreePortTests(SimpleTestCase):
    def test_a_taken_port_is_skipped(self):
        import socket

        with socket.socket() as taken:
            taken.bind(("127.0.0.1", 0))
            port = taken.getsockname()[1]
            self.assertNotEqual(launcher.free_port(port, port + 20), port)


class StartTrackerTests(SimpleTestCase):
    """Starts the real program: data folder, database, server, and a second start that only finds the first."""

    def test_starts_serves_the_page_and_does_not_start_twice(self):
        with tempfile.TemporaryDirectory() as data, tempfile.TemporaryDirectory() as frontend:
            (Path(frontend) / "index.html").write_text("<title>Tracker</title>", encoding="utf-8")
            port = launcher.free_port(8300, 8400)
            env = {**os.environ, "TRACKER_DATA_DIR": data, "TRACKER_FRONTEND_DIR": frontend, "TRACKER_PORT": str(port), "TRACKER_NO_BROWSER": "1", "TRACKER_IN_VENV": "1"}
            first = subprocess.Popen([sys.executable, "start_tracker.py"], cwd=BACKEND, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
            try:
                page = None
                for _ in range(60):
                    try:
                        with urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=1) as response:
                            page = response.read()
                        break
                    except OSError:
                        time.sleep(0.5)
                self.assertIsNotNone(page, "the server did not start")
                self.assertIn(b"<title>Tracker</title>", page)
                self.assertEqual((Path(data) / launcher.RUNNING_FILE).read_text(), str(port))
                self.assertTrue((Path(data) / "db.sqlite3").exists())

                second = subprocess.run([sys.executable, "start_tracker.py"], cwd=BACKEND, env=env, capture_output=True, text=True, timeout=30)
                self.assertEqual(second.returncode, 0)
                self.assertIn("läuft schon", second.stdout)
            finally:
                first.terminate()
                first.communicate(timeout=15)
