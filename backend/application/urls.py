from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ApplicationViewSet, AttachmentViewSet, EventViewSet, company_logo, download_backup, geocode_address

router = DefaultRouter()
router.register("applications", ApplicationViewSet, basename="application")
router.register("attachments", AttachmentViewSet, basename="attachment")
router.register("events", EventViewSet, basename="event")

urlpatterns = [path("geocode/", geocode_address), path("logo/", company_logo), path("backup/", download_backup)] + router.urls