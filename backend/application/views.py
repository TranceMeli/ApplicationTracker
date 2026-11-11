from datetime import timedelta

from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action, api_view
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from .backup import zip_bytes
from .geocoding import GeocodingError, geocode
from .logos import LogoServiceError, clean_domain, content_type, get_logo
from .importer import SUPPORTED_EXTENSIONS, ImportFileError, run_import
from .models import Application, ApplicationEvent, Attachment
from .serializers import ApplicationSerializer, AttachmentSerializer, EventSerializer, normalize_kind

MAX_IMPORT_SIZE = 5 * 1024 * 1024  # 5 MB
GEOCODE_BATCH = 8  # lookups per request, Nominatim allows one per second
TRASH_DAYS = 7  # deleted applications can be restored this long
NO_KIND = "__none__"  # ?kind=__none__ lists the applications without a type
OPEN_STATUSES = ("applied",)  # a follow up only makes sense while an answer is awaited

TEXT_SEARCH_FIELDS = ("company", "position", "contact_person", "email", "phone", "city", "notes")

# Concrete columns only: sorting by a relation (attachments) would duplicate rows.
FIELD_NAMES = {f.name for f in Application._meta.concrete_fields}


class ApplicationViewSet(viewsets.ModelViewSet):
    serializer_class = ApplicationSerializer

    def get_queryset(self):
        queryset = Application.objects.prefetch_related("attachments", "events")
        params = self.request.query_params

        for key in ("status", "channel", "work_mode"):
            if params.get(key):
                queryset = queryset.filter(**{key: params[key]})

        kind = params.get("kind")
        if kind == NO_KIND:
            queryset = queryset.filter(kind="")
        elif kind:
            queryset = queryset.filter(kind__iexact=normalize_kind(kind))

        favorite = params.get("favorite", params.get("is_favorite"))
        if favorite in ("1", "true", "True"):
            queryset = queryset.filter(is_favorite=True)

        tag = (params.get("tag") or "").strip()
        if tag:
            # Tags are stored as "a, b, c", so a tag is a whole item between the separators.
            queryset = queryset.filter(
                Q(tags__iexact=tag) | Q(tags__istartswith=f"{tag}, ")
                | Q(tags__icontains=f", {tag}, ") | Q(tags__iendswith=f", {tag}")
            )

        search = (params.get("search") or params.get("q") or "").strip()
        if search:
            query = Q()
            for name in TEXT_SEARCH_FIELDS:
                query |= Q(**{f"{name}__icontains": search})
            queryset = queryset.filter(query)

        ordering = params.get("ordering")
        if ordering and ordering.lstrip("-") in FIELD_NAMES:
            queryset = queryset.order_by(ordering, "-id")
        return queryset

    @action(detail=False, methods=["get"])
    def stats(self, request):
        by_status = dict(
            Application.objects.values_list("status").annotate(n=Count("id")).order_by()
        )
        by_kind = dict(Application.objects.values_list("kind").annotate(n=Count("id")).order_by())
        due = Application.objects.filter(
            follow_up__lte=timezone.localdate(), status__in=OPEN_STATUSES
        ).order_by("follow_up", "id")
        tags = {}
        for value in Application.objects.exclude(tags="").values_list("tags", flat=True):
            for tag in value.split(", "):
                tags[tag] = tags.get(tag, 0) + 1
        return Response({
            "total": Application.objects.count(),
            "favorites": Application.objects.filter(is_favorite=True).count(),
            "by_status": by_status,
            "by_kind": by_kind,
            "due": [{"id": a.id, "company": a.company, "follow_up": a.follow_up} for a in due],
            "tags": dict(sorted(tags.items(), key=lambda item: item[0].lower())),
        })

    @action(detail=False, methods=["get"])
    def companies(self, request):
        """Id and name of every application, to warn about doubles while typing."""
        return Response(list(Application.objects.order_by("id").values("id", "company")))

    def perform_destroy(self, instance):
        # Only moves the entry to the trash, the delete is undone with the bulk action "restore".
        instance.deleted_at = timezone.now()
        instance.save(update_fields=["deleted_at"])
        purge_trash()

    @action(detail=False, methods=["post"])
    def bulk(self, request):
        """One action for several applications: status, kind, delete (to the trash) or restore."""
        ids = request.data.get("ids")
        action_name = request.data.get("action")
        if not isinstance(ids, list) or not ids or not all(isinstance(i, int) for i in ids):
            return Response({"code": "invalid_ids"}, status=400)

        if action_name == "restore":
            changed = Application.all_objects.filter(id__in=ids, deleted_at__isnull=False).update(deleted_at=None)
        elif action_name == "delete":
            changed = Application.objects.filter(id__in=ids).update(deleted_at=timezone.now())
            purge_trash()
        elif action_name == "kind":
            kind = request.data.get("kind")
            if not isinstance(kind, str) or len(normalize_kind(kind)) > Application._meta.get_field("kind").max_length:
                return Response({"code": "invalid_kind"}, status=400)
            kind = normalize_kind(kind)
            changed = Application.objects.filter(id__in=ids).update(kind=kind, updated_at=timezone.now())
        elif action_name == "status":
            status = request.data.get("status")
            if status not in Application.Status.values:
                return Response({"code": "invalid_status"}, status=400)
            changed = 0
            for application in Application.objects.filter(id__in=ids):
                application.status = status
                application.save(update_fields=["status"])  # also writes the history entry
                changed += 1
        else:
            return Response({"code": "invalid_action"}, status=400)
        return Response({"changed": changed})

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


def purge_trash():
    """Removes applications that were deleted long ago for good, with their files."""
    Application.all_objects.filter(deleted_at__lt=timezone.now() - timedelta(days=TRASH_DAYS)).delete()


class EventViewSet(viewsets.ModelViewSet):
    """The history of an application. Only notes can be added or removed by hand."""

    serializer_class = EventSerializer
    http_method_names = ["get", "post", "delete", "head", "options"]

    def get_queryset(self):
        queryset = ApplicationEvent.objects.filter(application__deleted_at__isnull=True)
        application = self.request.query_params.get("application")
        return queryset.filter(application_id=application) if application else queryset

    def perform_create(self, serializer):
        serializer.save(kind=ApplicationEvent.Kind.NOTE)

    def destroy(self, request, *args, **kwargs):
        event = self.get_object()
        if event.kind != ApplicationEvent.Kind.NOTE:
            return Response({"code": "not_a_note"}, status=400)
        return super().destroy(request, *args, **kwargs)


class AttachmentViewSet(viewsets.ModelViewSet):
    serializer_class = AttachmentSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        queryset = Attachment.objects.all()
        application = self.request.query_params.get("application")
        if application:
            queryset = queryset.filter(application_id=application)
        return queryset


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


@api_view(["GET"])
def company_logo(request):
    """The icon of a company domain, 404 when there is none (the app then shows initials)."""
    domain = clean_domain(request.query_params.get("domain"))
    if not domain:
        return Response({"code": "invalid_domain"}, status=400)
    try:
        data = get_logo(domain)
    except LogoServiceError:
        return Response({"code": "logo_service_unreachable"}, status=502)
    if data is None:
        return Response({"code": "not_found"}, status=404)
    response = HttpResponse(data, content_type=content_type(data))
    response["Cache-Control"] = "public, max-age=604800"
    return response


@api_view(["GET"])
def download_backup(request):
    """A zip with the database and the uploaded files."""
    response = HttpResponse(zip_bytes(), content_type="application/zip")
    response["Content-Disposition"] = f'attachment; filename="tracker-backup-{timezone.localdate()}.zip"'
    return response
