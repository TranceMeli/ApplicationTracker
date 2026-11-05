#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
import os
import subprocess
import sys
from pathlib import Path


def use_project_venv():
    """Runs this command again with the python of backend/.venv, so the right packages are used."""
    here = Path(__file__).resolve().parent
    python = here / ".venv" / ("Scripts" if os.name == "nt" else "bin") / ("python.exe" if os.name == "nt" else "python")
    if not python.exists() or Path(sys.prefix).resolve() == (here / ".venv").resolve() or os.environ.get("TRACKER_IN_VENV"):
        return
    env = {**os.environ, "TRACKER_IN_VENV": "1"}
    sys.exit(subprocess.call([str(python), *sys.argv], env=env))


def main():
    """Run administrative tasks."""
    use_project_venv()
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)


if __name__ == '__main__':
    main()
