from django.db import models as dj_models
from django.db.models import Count, Q
from rest_framework import viewsets
from rest_framework.decorators import action, api_view
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from .geocoding import GeocodingError, geocode
from .importer import SUPPORTED_EXTENSIONS, ImportFileError, run_import
from .models import Application, Attachment
from .serializers import ApplicationSerializer, AttachmentSerializer

MAX_IMPORT_SIZE = 5 * 1024 * 1024  # 5 MB
GEOCODE_BATCH = 8  # lookups per request, Nominatim allows one per second

TEXT_SEARCH_FIELDS = ("company", "position", "contact", "email", "phone", "city", "notes")


def _file_fields(model):
    return [f.name for f in model._meta.get_fields() if isinstance(f, dj_models.FileField)]


def _delete_files(attachment):
    """Removes the stored file of an attachment from disk."""
    for name in _file_fields(Attachment):
        stored = getattr(attachment, name, None)
        if stored:
            stored.delete(save=False)


class ApplicationViewSet(viewsets.ModelViewSet):
    serializer_class = ApplicationSerializer

    def get_queryset(self):
        queryset = Application.objects.all()
        params = self.request.query_params
        field_names = {f.name for f in Application._meta.get_fields()}

        for key in ("status", "channel", "work_mode"):
            if params.get(key) and key in field_names:
                queryset = queryset.filter(**{key: params[key]})

        favorite = params.get("favorite", params.get("is_favorite"))
        if favorite in ("1", "true", "True"):
            queryset = queryset.filter(is_favorite=True)

        search = (params.get("search") or params.get("q") or "").strip()
        if search:
            query = Q()
            for name in TEXT_SEARCH_FIELDS:
                if name in field_names:
                    query |= Q(**{f"{name}__icontains": search})
            queryset = queryset.filter(query)

        ordering = params.get("ordering")
        if ordering and ordering.lstrip("-") in field_names:
            queryset = queryset.order_by(ordering, "-id")
        return queryset

    def perform_destroy(self, instance):
        # Delete stored files too, not only the database rows.
        for attachment in Attachment.objects.filter(application=instance):
            _delete_files(attachment)
        instance.delete()

    @action(detail=False, methods=["get"])
    def stats(self, request):
        by_status = dict(
            Application.objects.values_list("status").annotate(n=Count("id")).order_by()
        )
        return Response({
            "total": Application.objects.count(),
            "favorites": Application.objects.filter(is_favorite=True).count(),
            "by_status": by_status,
        })

    @action(detail=False, methods=["post"], url_path="import",
            parser_classes=[MultiPartParser, FormParser])
    def import_list(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return Response({"code": "no_file"}, status=400)
        if not upload.name.lower().endswith(SUPPORTED_EXTENSIONS):
            return Response({"code": "file_type"}, status=400)
        if upload.size > MAX_IMPORT_SIZE:
            return Response({"code": "file_size"}, status=400)

        dry_run = request.data.get("dry_run") == "1"
        default_status = request.data.get("default_status")
        if default_status not in Application.Status.values:
            default_status = Application.Status.PLANNED
        update_existing = request.data.get("mode") != "new_only"
        try:
            return Response(run_import(upload, dry_run, default_status, update_existing))
        except ImportFileError as err:
            return Response({"code": err.code}, status=400)

    @action(detail=False, methods=["post"])
    def geocode(self, request):
        """Looks up coordinates for applications that have none yet, a few per request."""
        if request.data.get("retry") == "1":
            Application.objects.filter(geo_precision="failed").update(geo_precision="")

        pending = Application.objects.filter(geo_precision="")
        done = 0
        try:
            for application in list(pending[:GEOCODE_BATCH]):
                lat, lon, precision = geocode(
                    application.street, application.postal_code, application.city
                )
                application.latitude, application.longitude = lat, lon
                application.geo_precision = precision
                application.save(update_fields=list(Application.GEO_FIELDS))
                done += 1
        except GeocodingError:
            return Response(
                {"code": "geocoder_unreachable", "processed": done, "remaining": pending.count()},
                status=502,
            )
        return Response({"processed": done, "remaining": pending.count()})


class AttachmentViewSet(viewsets.ModelViewSet):
    serializer_class = AttachmentSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        queryset = Attachment.objects.all()
        application = self.request.query_params.get("application")
        if application:
            queryset = queryset.filter(application_id=application)
        return queryset

    def perform_destroy(self, instance):
        _delete_files(instance)
        instance.delete()


@api_view(["POST"])
def geocode_address(request):
    """Looks up one address (the user's own) without storing it on the server."""
    data = request.data
    try:
        lat, lon, precision = geocode(
            str(data.get("street", "")), str(data.get("postal_code", "")), str(data.get("city", ""))
        )
    except GeocodingError:
        return Response({"code": "geocoder_unreachable"}, status=502)
    if precision == "failed":
        return Response({"code": "not_found"}, status=404)
    return Response({"latitude": lat, "longitude": lon, "precision": precision})