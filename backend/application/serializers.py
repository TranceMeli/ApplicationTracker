import os

from rest_framework import serializers

from .models import Application, Attachment

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".odt", ".txt", ".png", ".jpg", ".jpeg"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


class AttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attachment
        fields = ["id", "application", "file", "name", "kind", "uploaded_at"]
        read_only_fields = ["name", "uploaded_at"]

    # The messages are codes; the frontend translates them.
    def validate_file(self, f):
        if os.path.splitext(f.name)[1].lower() not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError("file_type")
        if f.size > MAX_FILE_SIZE:
            raise serializers.ValidationError("file_size")
        return f


class ApplicationSerializer(serializers.ModelSerializer):
    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Application
        fields = "__all__"