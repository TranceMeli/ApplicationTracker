from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path

from .frontend import frontend

urlpatterns = [
    path('', frontend),
    re_path(r'^(?P<path>assets/.+|favicon\.svg|icons\.svg)$', frontend),
    path('admin/', admin.site.urls),
    path('api/', include('application.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
