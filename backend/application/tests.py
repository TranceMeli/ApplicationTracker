import io
import sqlite3
import tempfile
import zipfile
import urllib.error
from pathlib import Path
from unittest import mock

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from . import backup
from .importer import run_import
from .models import Application, ApplicationEvent, Attachment


class AttachmentApiTests(TestCase):
    def setUp(self):
        self.application = Application.objects.create(company="Beispielfirma")
        self.client = APIClient()

    def test_upload_is_validated_and_included_with_application(self):
        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=Path(media_root)):
                response = self.client.post(
                    reverse("attachment-list"),
                    {
                        "application": self.application.id,
                        "file": SimpleUploadedFile(
                            "anschreiben.pdf", b"PDF-Inhalt", content_type="application/pdf"
                        ),
                        "kind": "cover_letter",
                    },
                    format="multipart",
                )

                self.assertEqual(response.status_code, 201)
                self.assertEqual(response.data["name"], "anschreiben.pdf")

                application_response = self.client.get(reverse("application-list"))
                self.assertEqual(application_response.status_code, 200)
                attachment = application_response.data[0]["attachments"][0]
                self.assertEqual(attachment["name"], "anschreiben.pdf")
                self.assertEqual(attachment["kind"], "cover_letter")

                invalid_response = self.client.post(
                    reverse("attachment-list"),
                    {
                        "application": self.application.id,
                        "file": SimpleUploadedFile(
                            "script.exe", b"not allowed", content_type="application/octet-stream"
                        ),
                        "kind": "other",
                    },
                    format="multipart",
                )
                self.assertEqual(invalid_response.status_code, 400)
                self.assertEqual(invalid_response.data["file"][0], "file_type")


class ApplicationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_search_includes_contact_person(self):
        Application.objects.create(company="Alpha", contact_person="Erika Muster")
        Application.objects.create(company="Beta")
        response = self.client.get(reverse("application-list"), {"search": "muster"})
        self.assertEqual([a["company"] for a in response.data], ["Alpha"])

    def test_ordering_by_relation_is_ignored(self):
        Application.objects.create(company="Alpha")
        response = self.client.get(reverse("application-list"), {"ordering": "attachments"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_attachment_files_are_removed_when_the_trash_is_purged(self):
        from datetime import timedelta
        from django.utils import timezone

        with tempfile.TemporaryDirectory() as media_root:
            with override_settings(MEDIA_ROOT=Path(media_root)):
                application = Application.objects.create(company="Alpha")
                attachment = Attachment.objects.create(
                    application=application, file=SimpleUploadedFile("cv.pdf", b"PDF")
                )
                path = Path(attachment.file.path)
                self.assertTrue(path.exists())

                response = self.client.delete(reverse("application-detail", args=[application.id]))
                self.assertEqual(response.status_code, 204)
                self.assertTrue(path.exists())  # in the trash the files are kept, the delete can be undone

                old = timezone.now() - timedelta(days=8)
                Application.all_objects.filter(id=application.id).update(deleted_at=old)
                other = Application.objects.create(company="Beta")
                self.client.delete(reverse("application-detail", args=[other.id]))  # purges the old trash
                self.assertFalse(path.exists())

    def test_admin_session_does_not_require_csrf_for_api(self):
        User.objects.create_superuser("admin", "admin@example.com", "pw")
        client = APIClient(enforce_csrf_checks=True)
        client.login(username="admin", password="pw")
        response = client.post(reverse("application-list"), {"company": "Alpha"}, format="json")
        self.assertEqual(response.status_code, 201)


class ImportTests(TestCase):
    def run_csv(self, text, **kwargs):
        return run_import(SimpleUploadedFile("list.csv", text.encode("utf-8")), **kwargs)

    def test_duplicate_rows_are_skipped_without_warnings(self):
        result = self.run_csv("Firma;E-Mail\nAlpha;a@example.com\nalpha ;kaputt\n")
        self.assertEqual(result["created"], 1)
        self.assertEqual(result["duplicates"], 1)
        self.assertEqual(result["warnings"], [])

    def test_dry_run_saves_nothing(self):
        result = self.run_csv("Unternehmen;Ort\nAlpha;Berlin\n", dry_run=True)
        self.assertEqual(result["created"], 1)
        self.assertFalse(Application.objects.exists())

    def test_update_changes_existing_and_resets_coordinates(self):
        Application.objects.create(company="Alpha", city="Berlin", latitude=1, longitude=2,
                                   geo_precision="city")
        result = self.run_csv("Unternehmen;Ort;Status\nAlpha;Hamburg;Absage\n")
        self.assertEqual(result["updated"], 1)
        application = Application.objects.get()
        self.assertEqual((application.city, application.status), ("Hamburg", "rejected"))
        self.assertEqual(application.geo_precision, "")
        self.assertIsNone(application.latitude)



class LogoApiTests(TestCase):
    PNG = bytes([0x89]) + b"PNG" + b"0" * 20

    def setUp(self):
        self.media = tempfile.TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        override = override_settings(MEDIA_ROOT=self.media.name)
        override.enable()
        self.addCleanup(override.disable)
        self.client = APIClient()

    def answer(self, status=200, body=PNG):
        response = mock.MagicMock()
        response.status = status
        response.read.return_value = body
        response.__enter__.return_value = response
        return response

    def get(self, domain):
        return self.client.get("/api/logo/", {"domain": domain})

    def test_invalid_domains_are_rejected_without_a_request(self):
        with mock.patch("urllib.request.urlopen") as opened:
            for bad in ["", "localhost", "a/b.de", "x.de/../y", "exa mple.com", "http://x.de"]:
                self.assertEqual(self.get(bad).status_code, 400, bad)
        opened.assert_not_called()

    def test_icon_is_fetched_once_and_then_served_from_disk(self):
        with mock.patch("urllib.request.urlopen", return_value=self.answer()) as opened:
            first, second = self.get("example.com"), self.get("Example.com")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first["Content-Type"], "image/png")
        self.assertEqual(second.content, self.PNG)
        self.assertEqual(opened.call_count, 1)

    def test_missing_icon_is_remembered(self):
        error = urllib.error.HTTPError("u", 404, "Not Found", {}, io.BytesIO(b"placeholder"))
        with mock.patch("urllib.request.urlopen", side_effect=error) as opened:
            self.assertEqual(self.get("nothing.example").status_code, 404)
            self.assertEqual(self.get("nothing.example").status_code, 404)
        self.assertEqual(opened.call_count, 1)

    def test_unreachable_service_is_not_remembered(self):
        with mock.patch("urllib.request.urlopen", side_effect=OSError("offline")):
            self.assertEqual(self.get("example.com").status_code, 502)
        with mock.patch("urllib.request.urlopen", return_value=self.answer()):
            self.assertEqual(self.get("example.com").status_code, 200)


class TrashAndBulkTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.a = Application.objects.create(company="Alpha", status="applied")
        self.b = Application.objects.create(company="Beta", status="planned")

    def test_delete_moves_to_trash_and_restore_brings_it_back(self):
        response = self.client.delete(f"/api/applications/{self.a.id}/")
        self.assertEqual(response.status_code, 204)
        self.assertEqual([x["company"] for x in self.client.get("/api/applications/").json()], ["Beta"])
        self.assertEqual(self.client.get("/api/applications/stats/").json()["total"], 1)
        self.assertTrue(Application.all_objects.filter(id=self.a.id).exists())
        restored = self.client.post("/api/applications/bulk/", {"ids": [self.a.id], "action": "restore"}, format="json")
        self.assertEqual(restored.json()["changed"], 1)
        self.assertEqual(self.client.get("/api/applications/stats/").json()["total"], 2)

    def test_old_trash_is_purged_for_good(self):
        from datetime import timedelta
        from django.utils import timezone

        Application.all_objects.filter(id=self.a.id).update(deleted_at=timezone.now() - timedelta(days=8))
        self.client.delete(f"/api/applications/{self.b.id}/")
        self.assertFalse(Application.all_objects.filter(id=self.a.id).exists())
        self.assertTrue(Application.all_objects.filter(id=self.b.id).exists())

    def test_bulk_status_and_delete(self):
        body = {"ids": [self.a.id, self.b.id], "action": "status", "status": "rejected"}
        response = self.client.post("/api/applications/bulk/", body, format="json")
        self.assertEqual(response.json()["changed"], 2)
        self.assertEqual(set(Application.objects.values_list("status", flat=True)), {"rejected"})
        self.client.post("/api/applications/bulk/", {"ids": [self.a.id], "action": "delete"}, format="json")
        self.assertEqual(Application.objects.count(), 1)

    def test_bulk_rejects_bad_input(self):
        bad = (
            {"ids": [], "action": "delete"},
            {"ids": ["x"], "action": "delete"},
            {"ids": [1], "action": "nope"},
            {"ids": [1], "action": "status", "status": "nope"},
        )
        for body in bad:
            self.assertEqual(self.client.post("/api/applications/bulk/", body, format="json").status_code, 400, body)

    def test_import_does_not_touch_trashed_companies(self):
        self.client.delete(f"/api/applications/{self.a.id}/")
        result = run_import(SimpleUploadedFile("l.csv", "Firma\nAlpha\n".encode("utf-8")))
        self.assertEqual((result["created"], result["updated"]), (1, 0))


class HistoryTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def kinds(self, application):
        return [(e.kind, e.status) for e in application.events.order_by("id")]

    def test_creation_and_status_changes_are_logged(self):
        application = Application.objects.create(company="Alpha", status="planned")
        application.status = "applied"
        application.save()
        application.city = "Berlin"
        application.save()  # no status change, no entry
        self.assertEqual(self.kinds(application), [("created", "planned"), ("status", "applied")])

    def test_notes_can_be_added_and_removed_but_not_system_entries(self):
        application = Application.objects.create(company="Alpha")
        body = {"application": application.id, "text": "  Anruf  ", "date": "2026-10-01"}
        created = self.client.post("/api/events/", body, format="json")
        self.assertEqual(created.status_code, 201)
        self.assertEqual((created.json()["kind"], created.json()["text"]), ("note", "Anruf"))
        empty = self.client.post("/api/events/", {"application": application.id, "text": " "}, format="json")
        self.assertEqual(empty.status_code, 400)
        system = application.events.get(kind="created")
        self.assertEqual(self.client.delete(f"/api/events/{system.id}/").status_code, 400)
        self.assertEqual(self.client.delete(f"/api/events/{created.json()['id']}/").status_code, 204)
        listed = self.client.get(f"/api/applications/{application.id}/").json()["events"]
        self.assertEqual([e["kind"] for e in listed], ["created"])

    def test_import_writes_creation_entries(self):
        run_import(SimpleUploadedFile("l.csv", "Firma;Status\nAlpha;Absage\n".encode("utf-8")))
        self.assertEqual(self.kinds(Application.objects.get()), [("created", "rejected")])


class TagAndDueTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def post(self, company, tags):
        return self.client.post("/api/applications/", {"company": company, "tags": tags}, format="json").json()

    def test_tags_are_cleaned_filtered_and_counted(self):
        self.assertEqual(self.post("Alpha", " Remote;  Wunschfirma , remote ,")["tags"], "Remote, Wunschfirma")
        self.post("Beta", "Remote Work")
        self.post("Gamma", "Hybrid, Remote")

        def found(tag):
            return sorted(x["company"] for x in self.client.get("/api/applications/", {"tag": tag}).json())

        self.assertEqual(found("remote"), ["Alpha", "Gamma"])
        self.assertEqual(found("Wunschfirma"), ["Alpha"])
        counts = self.client.get("/api/applications/stats/").json()["tags"]
        self.assertEqual(counts, {"Hybrid": 1, "Remote": 2, "Remote Work": 1, "Wunschfirma": 1})

    def test_import_reads_tags(self):
        run_import(SimpleUploadedFile("l.csv", "Firma;Tags\nAlpha;a, b\n".encode("utf-8")))
        self.assertEqual(Application.objects.get().tags, "a, b")

    def test_due_follow_ups_in_stats(self):
        from datetime import timedelta
        from django.utils import timezone

        today = timezone.localdate()
        Application.objects.create(company="Late", status="applied", follow_up=today - timedelta(days=2))
        Application.objects.create(company="Today", status="applied", kind="initiative", follow_up=today)
        Application.objects.create(company="Later", status="applied", follow_up=today + timedelta(days=2))
        Application.objects.create(company="Done", status="rejected", follow_up=today - timedelta(days=9))
        due = self.client.get("/api/applications/stats/").json()["due"]
        self.assertEqual([d["company"] for d in due], ["Late", "Today"])

    def test_companies_list(self):
        Application.objects.create(company="Alpha")
        self.assertEqual([c["company"] for c in self.client.get("/api/applications/companies/").json()], ["Alpha"])


class BackupTests(TestCase):
    def test_backup_contains_database_and_uploads(self):
        with tempfile.TemporaryDirectory() as tmp:
            db = f"{tmp}/live.sqlite3"
            connection = sqlite3.connect(db)
            connection.execute("create table t (x integer)")
            connection.execute("insert into t values (42)")
            connection.commit()
            connection.close()
            media = f"{tmp}/media"
            Path(media, "applications", "1").mkdir(parents=True)
            Path(media, "applications", "1", "cv.pdf").write_bytes(b"pdf")
            with override_settings(MEDIA_ROOT=media, BACKUP_DIR=f"{tmp}/backups"):
                with mock.patch.object(backup, "database_path", return_value=Path(db)):
                    path = backup.make_backup()
                    self.assertIsNone(backup.backup_if_due())  # a fresh backup exists, none is due
                    response = APIClient().get("/api/backup/")
            self.assertEqual(response["Content-Type"], "application/zip")
            with zipfile.ZipFile(path) as archive:
                self.assertEqual(set(archive.namelist()), {"db.sqlite3", "media/applications/1/cv.pdf"})
                archive.extract("db.sqlite3", tmp + "/restored")
            restored = sqlite3.connect(tmp + "/restored/db.sqlite3")
            self.assertEqual(restored.execute("select x from t").fetchone(), (42,))
            restored.close()


class KindTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        Application.objects.create(company="Alpha", status="planned", kind="initiative")
        Application.objects.create(company="Beta", status="planned")
        Application.objects.create(company="Gamma", status="applied", kind="initiative")
        Application.objects.create(company="Delta", status="applied", kind="posting")

    def names(self, params):
        return sorted(a["company"] for a in self.client.get("/api/applications/", params).json())

    def test_kind_is_empty_by_default_and_filters_combine_with_status(self):
        self.assertEqual(Application.objects.get(company="Beta").kind, "")
        created = self.client.post("/api/applications/", {"company": "Neu"}, format="json").json()
        self.assertEqual(created["kind"], "")
        self.assertEqual(self.names({"kind": "initiative"}), ["Alpha", "Gamma"])
        self.assertEqual(self.names({"kind": "initiative", "status": "planned"}), ["Alpha"])
        self.assertEqual(self.names({"kind": "posting", "status": "applied"}), ["Delta"])

    def test_applications_without_a_type_can_be_listed(self):
        self.assertEqual(self.names({"kind": "__none__"}), ["Beta"])
        self.assertEqual(self.names({"kind": "__none__", "status": "applied"}), [])

    def test_the_type_can_be_set_and_cleared_and_the_built_in_names_become_their_keys(self):
        beta = Application.objects.get(company="Beta")

        def patch(kind):
            response = self.client.patch(f"/api/applications/{beta.id}/", {"kind": kind}, format="json")
            self.assertEqual(response.status_code, 200, response.content)
            return response.json()["kind"]

        self.assertEqual(patch("  Stelle "), "posting")
        self.assertEqual(patch("Job posting"), "posting")
        self.assertEqual(patch("initiativ"), "initiative")
        self.assertEqual(patch("Empfehlung   durch  Kollegen"), "Empfehlung durch Kollegen")
        self.assertEqual(patch(""), "")

    def test_stats_count_the_types_including_none(self):
        self.assertEqual(
            self.client.get("/api/applications/stats/").json()["by_kind"], {"": 1, "initiative": 2, "posting": 1}
        )

    def test_a_custom_type_filters_case_insensitively(self):
        Application.objects.create(company="Messe 1", kind="Messe")
        Application.objects.create(company="Messe 2", kind="messe")
        self.assertEqual(self.names({"kind": "MESSE"}), ["Messe 1", "Messe 2"])
        self.assertEqual(self.names({"kind": "Stelle"}), ["Delta"])  # the German name works as filter, too

    def test_too_long_type_is_rejected(self):
        response = self.client.post("/api/applications/", {"company": "X", "kind": "x" * 41}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_bulk_kind_change_sets_and_clears(self):
        ids = list(Application.objects.filter(company__in=["Beta", "Delta"]).values_list("id", flat=True))
        response = self.client.post("/api/applications/bulk/", {"ids": ids, "action": "kind", "kind": " Initiativ "}, format="json")
        self.assertEqual(response.json()["changed"], 2)
        self.assertEqual(set(Application.objects.filter(id__in=ids).values_list("kind", flat=True)), {"initiative"})
        self.client.post("/api/applications/bulk/", {"ids": ids, "action": "kind", "kind": ""}, format="json")
        self.assertEqual(set(Application.objects.filter(id__in=ids).values_list("kind", flat=True)), {""})
        for bad in ("x" * 41, 5, None):
            body = {"ids": ids, "action": "kind", "kind": bad}
            self.assertEqual(self.client.post("/api/applications/bulk/", body, format="json").status_code, 400, bad)

    def test_import_reads_the_type_column_and_the_old_status_word(self):
        text = "Firma;Art;Status\nNeu A;Initiativ;Geplant\nNeu B;Stelle;Beworben\nNeu C;;Initiativ\nNeu D;Messe;Geplant\nNeu E;;Geplant\n"
        run_import(SimpleUploadedFile("l.csv", text.encode("utf-8")))
        found = {a.company: (a.status, a.kind) for a in Application.objects.filter(company__startswith="Neu")}
        self.assertEqual(found, {
            "Neu A": ("planned", "initiative"),
            "Neu B": ("applied", "posting"),
            "Neu C": ("planned", "initiative"),
            "Neu D": ("planned", "Messe"),
            "Neu E": ("planned", ""),
        })

    def test_import_update_changes_the_type(self):
        run_import(SimpleUploadedFile("l.csv", "Firma;Typ\nBeta;Initiativ\n".encode("utf-8")))
        self.assertEqual(Application.objects.get(company="Beta").kind, "initiative")
