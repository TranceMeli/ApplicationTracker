import tempfile
from pathlib import Path

from django.test import TestCase, override_settings
from django.urls import reverse
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from .models import Application


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
