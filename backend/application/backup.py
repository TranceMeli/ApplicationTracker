"""Backups of the database and the uploaded files, as one zip file.

The database is copied with SQLite's own backup function, so the copy is consistent even
while the server is running. Uploaded documents are included, the logo cache is not.
"""
import io
import sqlite3
import tempfile
import time
import zipfile
from datetime import datetime
from pathlib import Path

from django.conf import settings

KEEP = 14  # automatic backups to keep
INTERVAL = 24 * 3600  # seconds between two automatic backups


def backup_dir():
    folder = Path(getattr(settings, "BACKUP_DIR", settings.BASE_DIR / "backups"))
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def database_path():
    return Path(settings.DATABASES["default"]["NAME"])


def write_zip(target):
    """Writes the zip into a file object or path."""
    database = database_path()
    with tempfile.TemporaryDirectory() as tmp:
        snapshot = Path(tmp) / "db.sqlite3"
        source, copy = sqlite3.connect(database), sqlite3.connect(snapshot)
        try:
            source.backup(copy)
        finally:
            copy.close()
            source.close()
        with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.write(snapshot, "db.sqlite3")
            uploads = Path(settings.MEDIA_ROOT) / "applications"
            if uploads.exists():
                for file in uploads.rglob("*"):
                    if file.is_file():
                        archive.write(file, Path("media") / "applications" / file.relative_to(uploads))


def zip_bytes():
    buffer = io.BytesIO()
    write_zip(buffer)
    return buffer.getvalue()


def make_backup():
    """Creates a backup file in the backup folder and removes the oldest ones."""
    folder = backup_dir()
    path = folder / f"tracker-{datetime.now():%Y%m%d-%H%M%S}.zip"
    write_zip(path)
    for old in sorted(folder.glob("tracker-*.zip"))[:-KEEP]:
        old.unlink(missing_ok=True)
    return path


def backup_if_due():
    """Makes a backup when the newest one is older than a day. Returns its path or None."""
    existing = sorted(backup_dir().glob("tracker-*.zip"))
    if existing and time.time() - existing[-1].stat().st_mtime < INTERVAL:
        return None
    return make_backup()
