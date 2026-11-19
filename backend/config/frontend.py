"""Serves the built frontend (frontend/dist), so that one server is all the app needs.

During development Vite serves the frontend and proxies the API, so the folder does not have to exist. Without it
the root URL shows the API overview instead.
"""
from django.conf import settings
from django.http import HttpResponseRedirect
from django.views.static import serve


def frontend(request, path=""):
    root = settings.FRONTEND_DIR
    if not (root / "index.html").is_file():
        return HttpResponseRedirect("/api/")
    response = serve(request, path or "index.html", document_root=root)
    if not path:
        # The page names the hashed files of one build, so a new version must not be taken from the cache.
        response["Cache-Control"] = "no-cache"
    return response
