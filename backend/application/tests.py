import io
import tempfile
import urllib.error
from pathlib import Path
from unittest import mock

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from .importer import run_import
from .models import Application, Attachment


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

    def test_deleting_application_removes_attachment_files(self):
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
