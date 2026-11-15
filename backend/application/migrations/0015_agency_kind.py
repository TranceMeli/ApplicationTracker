from django.db import migrations

# Entries that already carry one of the names of the new built-in type "Vermittler" get its key.
NAMES = {"vermittler", "vermittlung", "personalvermittler", "personalvermittlung", "personaldienstleister", "recruiter", "recruiting", "agency"}


def to_agency(apps, schema_editor):
    Application = apps.get_model("application", "Application")
    for application in Application.objects.exclude(kind="").exclude(kind="agency"):
        if " ".join(application.kind.split()).lower() in NAMES:
            application.kind = "agency"
            application.save(update_fields=["kind"])


class Migration(migrations.Migration):
    dependencies = [("application", "0014_attachment_kind_complete")]
    operations = [migrations.RunPython(to_agency, migrations.RunPython.noop)]
