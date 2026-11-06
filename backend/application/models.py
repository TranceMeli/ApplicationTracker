from django.db import models
from django.utils import timezone
from django.db.models.signals import post_delete
from django.dispatch import receiver


class ActiveManager(models.Manager):
    """Hides applications in the trash, so every query only sees the live ones."""

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)


class Application(models.Model):
    class Status(models.TextChoices):
        PLANNED = "planned", "Geplant"
        UNSURE = "unsure", "Unsicher"
        APPLIED = "applied", "Beworben"
        INTERVIEW = "interview", "Gespräch"
        REJECTED = "rejected", "Absage"
        OFFER = "offer", "Zusage"

    class Channel(models.TextChoices):
        EMAIL = "email", "E-Mail"
        PORTAL = "portal", "Portal"
        POST = "post", "Post"
        PHONE = "phone", "Telefon"
        PERSONAL = "personal", "Persönlich"

    class WorkMode(models.TextChoices):
        ONSITE = "onsite", "Vor Ort"
        HYBRID = "hybrid", "Hybrid"
        REMOTE = "remote", "Remote"

    # "Lfd. Nr." from the spreadsheet is simply the primary key (id)
    date = models.DateField(null=True, blank=True)
    company = models.CharField(max_length=200)
    position = models.CharField(max_length=200, blank=True)
    street = models.CharField(max_length=200, blank=True)
    postal_code = models.CharField(max_length=10, blank=True)
    city = models.CharField(max_length=100, blank=True)
    contact_person = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    link = models.URLField(max_length=500, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.APPLIED)
    follow_up = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    is_favorite = models.BooleanField(default=False)
    # Empty until chosen. "posting" (Stelle) and "initiative" (Initiativ) are the built-in values with a translated
    # name; any other text that is stored (for example from an import) is shown as it is.
    kind = models.CharField(max_length=40, blank=True, default="")
    tags = models.CharField(max_length=300, blank=True)  # comma separated, e.g. "Remote, Wunschfirma"
    # Deleting only fills this in. The entry stays restorable for a while and is purged later.
    deleted_at = models.DateTimeField(null=True, blank=True)
    source = models.CharField(max_length=150, blank=True)
    channel = models.CharField(max_length=20, choices=Channel.choices, blank=True)
    work_mode = models.CharField(max_length=20, choices=WorkMode.choices, blank=True)
    salary = models.CharField(max_length=100, blank=True)
    interview_date = models.DateField(null=True, blank=True)
    response_date = models.DateField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    # Coordinates for the map view. They are looked up from the address, not typed in.
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    # "" = not looked up yet, "address" = street level, "city" = only the town, "failed" = no match
    geo_precision = models.CharField(max_length=10, blank=True)

    GEO_FIELDS = ("latitude", "longitude", "geo_precision")

    objects = ActiveManager()
    all_objects = models.Manager()

    class Meta:
        ordering = ["-date", "-id"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._address_key = self._current_address()
        self._status_key = self.status

    def _current_address(self):
        return (self.street, self.postal_code, self.city)

    def save(self, *args, **kwargs):
        # A changed address invalidates the stored coordinates, they are looked up again later.
        if self.pk and self._address_key != self._current_address():
            self.latitude = self.longitude = None
            self.geo_precision = ""
            if kwargs.get("update_fields") is not None:
                kwargs["update_fields"] = {*kwargs["update_fields"], *self.GEO_FIELDS}
        is_new = self.pk is None
        super().save(*args, **kwargs)
        self._address_key = self._current_address()
        if is_new:
            ApplicationEvent.objects.create(application=self, kind=ApplicationEvent.Kind.CREATED, status=self.status)
        elif self._status_key != self.status:
            ApplicationEvent.objects.create(application=self, kind=ApplicationEvent.Kind.STATUS, status=self.status)
        self._status_key = self.status

    def __str__(self):
        return f"{self.company} ({self.get_status_display()})"


def upload_path(instance, filename):
    return f"applications/{instance.application_id}/{filename}"


class Attachment(models.Model):
    class Kind(models.TextChoices):
        COVER_LETTER = "cover_letter", "Anschreiben"
        CV = "cv", "Lebenslauf"
        CERTIFICATE = "certificate", "Zeugnis"
        OTHER = "other", "Sonstiges"

    application = models.ForeignKey(Application, related_name="attachments", on_delete=models.CASCADE)
    file = models.FileField(upload_to=upload_path)
    name = models.CharField(max_length=255, blank=True)
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.OTHER)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name or self.file.name


@receiver(post_delete, sender=Attachment)
def delete_attachment_file(sender, instance, **kwargs):
    # Runs for every way a row disappears (API, admin, cascade from its application),
    # so no file is left behind on disk.
    if instance.file:
        instance.file.delete(save=False)


class ApplicationEvent(models.Model):
    """One entry in the history of an application, written automatically or as a note."""

    class Kind(models.TextChoices):
        CREATED = "created", "Angelegt"
        STATUS = "status", "Status"
        NOTE = "note", "Notiz"

    application = models.ForeignKey(Application, related_name="events", on_delete=models.CASCADE)
    kind = models.CharField(max_length=10, choices=Kind.choices)
    status = models.CharField(max_length=20, blank=True)
    text = models.TextField(blank=True)
    date = models.DateField(default=timezone.localdate)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at", "-id"]

    def __str__(self):
        return f"{self.application_id} {self.kind} {self.status or self.text[:30]}"

