from rest_framework.routers import DefaultRouter

from .views import ApplicationViewSet, AttachmentViewSet

router = DefaultRouter()
router.register("applications", ApplicationViewSet)
router.register("attachments", AttachmentViewSet)
urlpatterns = router.urls