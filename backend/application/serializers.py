import os

from rest_framework import serializers

from .models import Application, ApplicationEvent, Attachment

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".odt", ".txt", ".png", ".jpg", ".jpeg"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


class AttachmentSerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=255, required=False)

    class Meta:
        model = Attachment
        fields = ["id", "application", "file", "name", "kind", "uploaded_at"]
        read_only_fields = ["uploaded_at"]

    def to_representation(self, attachment):
        data = super().to_representation(attachment)
        data["name"] = attachment.name or os.path.basename(attachment.file.name)
        return data

    # A new name keeps the extension of the file, so a document never loses its type by renaming it.
    def validate_name(self, value):
        name = os.path.basename(value.replace("\\", "/")).strip()
        if not name:
            raise serializers.ValidationError("name_required")
        if self.instance is not None:
            current = self.instance.name or os.path.basename(self.instance.file.name)
            extension = os.path.splitext(current)[1]
            if extension and not name.lower().endswith(extension.lower()):
                name += extension
        return name[:255]

    # The messages are codes; the frontend translates them.
    def validate_file(self, f):
        if os.path.splitext(f.name)[1].lower() not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError("file_type")
        if f.size > MAX_FILE_SIZE:
            raise serializers.ValidationError("file_size")
        return f

    def create(self, validated_data):
        uploaded_file = validated_data["file"]
        validated_data["name"] = os.path.basename(uploaded_file.name)
        return super().create(validated_data)


class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApplicationEvent
        fields = ["id", "application", "kind", "status", "text", "date", "created_at"]
        read_only_fields = ["kind", "status", "created_at"]

    def validate_text(self, value):
        if not value.strip():
            raise serializers.ValidationError("text_required")
        return value.strip()


KIND_ALIASES = {
    "posting": "posting", "stelle": "posting", "job posting": "posting", "stellenanzeige": "posting",
    "initiative": "initiative", "initiativ": "initiative", "initiativbewerbung": "initiative",
    "unsolicited": "initiative", "speculative": "initiative",
}


def normalize_kind(value):
    """Collapses spaces; the names of the two built-in types (in German or English) become their keys."""
    text = " ".join(str(value or "").split())
    return KIND_ALIASES.get(text.lower(), text)


def clean_tags(value):
    """Tags are stored as one string, split at commas or semicolons, without doubles."""
    seen, tags = set(), []
    for tag in value.replace(";", ",").split(","):
        tag = " ".join(tag.split())
        if tag and tag.lower() not in seen:
            seen.add(tag.lower())
            tags.append(tag)
    return ", ".join(tags)


class ApplicationSerializer(serializers.ModelSerializer):
    attachments = AttachmentSerializer(many=True, read_only=True)
    events = EventSerializer(many=True, read_only=True)

    class Meta:
        model = Application
        fields = "__all__"
        read_only_fields = ("latitude", "longitude", "geo_precision", "deleted_at", "updated_at")

    def validate_tags(self, value):
        return clean_tags(value)

    def validate_kind(self, value):
        return normalize_kind(value)