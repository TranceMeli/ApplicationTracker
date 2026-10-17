from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ApplicationViewSet, AttachmentViewSet, geocode_address

router = DefaultRouter()
router.register("applications", ApplicationViewSet, basename="application")
router.register("attachments", AttachmentViewSet, basename="attachment")

urlpatterns = [path("geocode/", geocode_address)] + router.urls