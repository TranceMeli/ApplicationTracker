from django.core.management.base import BaseCommand

from application.backup import make_backup


class Command(BaseCommand):
    help = "Writes a backup (database and uploaded files) to backend/backups/."

    def handle(self, *args, **options):
        self.stdout.write(f"Backup written to {make_backup()}")
