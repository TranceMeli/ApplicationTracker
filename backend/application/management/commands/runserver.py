"""runserver that picks a free port when none is given.

Without an address it starts on the first free port from 8000 on and writes that
port to backend/.port, so that the frontend dev server (vite.config.js) finds the
backend. With an explicit address or port, Django behaves as usual.
"""
import atexit
import os
import socket

from django.conf import settings
from django.contrib.staticfiles.management.commands.runserver import Command as RunserverCommand

START_PORT = 8000
LAST_PORT = 8100
ENV_PORT = "TRACKER_RUNSERVER_PORT"  # the autoreloader's child process reuses the parent's choice
PORT_FILE = settings.BASE_DIR / ".port"


def is_free(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        try:
            sock.bind(("127.0.0.1", port))
        except OSError:
            return False
    return True


def find_free_port():
    for port in range(START_PORT, LAST_PORT):
        if is_free(port):
            return port
    raise RuntimeError(f"No free port between {START_PORT} and {LAST_PORT - 1}.")


class Command(RunserverCommand):
    def handle(self, *args, **options):
        if not options.get("addrport"):
            port = os.environ.get(ENV_PORT) or str(find_free_port())
            os.environ[ENV_PORT] = port
            options["addrport"] = port
            if not os.environ.get("RUN_MAIN"):
                PORT_FILE.write_text(port)
                atexit.register(PORT_FILE.unlink, missing_ok=True)
        super().handle(*args, **options)
