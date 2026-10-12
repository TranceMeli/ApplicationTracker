from django.db.models import Count
from rest_framework import filters, mixins, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .models import Application, Attachment
from .serializers import ApplicationSerializer, AttachmentSerializer

from .importer import SUPPORTED_EXTENSIONS, ImportFileError, run_import

MAX_IMPORT_SIZE = 5 * 1024 * 1024  # 5 MB


class ApplicationViewSet(viewsets.ModelViewSet):
    queryset = Application.objects.prefetch_related("attachments")
    serializer_class = ApplicationSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ["company", "position", "contact_person", "source", "notes"]

    def get_queryset(self):
        qs = super().get_queryset()
        status = self.request.query_params.get("status")
        if status:
            qs = qs.filter(status=status)
        if self.request.query_params.get("favorite") == "1":
            qs = qs.filter(is_favorite=True)
        return qs

    def perform_destroy(self, instance):
        for attachment in instance.attachments.all():
            attachment.file.delete(save=False)  # remove the file from disk too
        instance.delete()

    @action(detail=False)
    def stats(self, request):
        rows = Application.objects.values("status").annotate(n=Count("id"))
        return Response({r["status"]: r["n"] for r in rows})

    @action(detail=False, methods=["post"], url_path="import",
            parser_classes=[MultiPartParser, FormParser])

    def import_list(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return Response({"code": "no_file"}, status=400)
        if not upload.name.lower().endswith(SUPPORTED_EXTENSIONS):
            return Response({"code": "file_type"}, status=400)

        dry_run = request.data.get("dry_run") == "1"
        default_status = request.data.get("default_status")
        if default_status not in Application.Status.values:
            default_status = Application.Status.PLANNED
        try:
            return Response(run_import(upload, dry_run, default_status))
        except ImportFileError as err:
            return Response({"code": err.code}, status=400)

    


class AttachmentViewSet(mixins.CreateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    queryset = Attachment.objects.all()
    serializer_class = AttachmentSerializer
    parser_classes = [MultiPartParser, FormParser]

    def perform_create(self, serializer):
        serializer.save(name=serializer.validated_data["file"].name)

    def perform_destroy(self, instance):
        instance.file.delete(save=False)
        instance.delete()