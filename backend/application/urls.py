from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import ApplicationViewSet, AttachmentViewSet, company_logo, geocode_address

router = DefaultRouter()
router.register("applications", ApplicationViewSet, basename="application")
router.register("attachments", AttachmentViewSet, basename="attachment")

urlpatterns = [path("geocode/", geocode_address), path("logo/", company_logo)] + router.urls