import os

from rest_framework import serializers

from .models import Application, Attachment

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".odt", ".txt", ".png", ".jpg", ".jpeg"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


class AttachmentSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = ["id", "application", "file", "name", "kind", "uploaded_at"]
        read_only_fields = ["name", "uploaded_at"]

    def get_name(self, attachment):
        return attachment.name or os.path.basename(attachment.file.name)

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


class ApplicationSerializer(serializers.ModelSerializer):
    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Application
        fields = "__all__"
        read_only_fields = ("latitude", "longitude", "geo_precision")