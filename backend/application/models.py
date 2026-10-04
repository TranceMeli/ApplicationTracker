from django.db import models


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
    source = models.CharField(max_length=150, blank=True)
    channel = models.CharField(max_length=20, choices=Channel.choices, blank=True)
    work_mode = models.CharField(max_length=20, choices=WorkMode.choices, blank=True)
    salary = models.CharField(max_length=100, blank=True)
    interview_date = models.DateField(null=True, blank=True)
    response_date = models.DateField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    class Meta:
        ordering = ["-date", "-id"]

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

    class Meta:
        ordering = ["-uploaded_at"]

    def __str__(self):
        return self.name