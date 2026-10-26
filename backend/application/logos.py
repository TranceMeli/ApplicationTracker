"""Fetches company logos (favicons) from DuckDuckGo and keeps them in media/logos/.

The browser asks this server instead of DuckDuckGo directly: DuckDuckGo answers
unknown domains with a placeholder image that a browser cannot tell from a real
icon, and with the server in between only the domains leave the machine, not the
visitor's address. Found icons are stored for good, misses are remembered for a
week so that a company without an icon is not looked up again on every page load.
"""
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from django.conf import settings

ICON_URL = "https://icons.duckduckgo.com/ip3/{domain}.ico"
USER_AGENT = "ApplicationTracker/1.0 (personal job application tracker)"
MAX_BYTES = 200_000
MISS_TTL = 7 * 24 * 3600  # seconds

DOMAIN_RE = re.compile(r"^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$")


class LogoServiceError(Exception):
    """The icon service could not be reached."""


def clean_domain(value):
    """Returns the domain in lower case, or '' when it is not a plain host name."""
    domain = (value or "").strip().lower()
    return domain if DOMAIN_RE.match(domain) else ""


def content_type(data):
    if data.startswith(b"\x89PNG"):
        return "image/png"
    if data.startswith(b"GIF8"):
        return "image/gif"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    return "image/x-icon"


def _folder():
    folder = Path(settings.MEDIA_ROOT) / "logos"
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def get_logo(domain):
    """Returns the icon bytes for a clean domain, or None when it has no icon.

    Raises LogoServiceError when the service is unreachable (nothing is remembered then).
    """
    folder = _folder()
    icon, miss = folder / f"{domain}.ico", folder / f"{domain}.none"
    if icon.exists():
        return icon.read_bytes()
    if miss.exists() and time.time() - miss.stat().st_mtime < MISS_TTL:
        return None

    request = urllib.request.Request(
        ICON_URL.format(domain=urllib.parse.quote(domain)), headers={"User-Agent": USER_AGENT}
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            data = response.read(MAX_BYTES + 1)
            status = response.status
    except urllib.error.HTTPError as exc:
        if exc.code != 404:
            raise LogoServiceError(str(exc)) from exc
        status, data = 404, b""
    except Exception as exc:
        raise LogoServiceError(str(exc)) from exc

    if status != 200 or not data or len(data) > MAX_BYTES:
        miss.touch()
        return None
    icon.write_bytes(data)
    miss.unlink(missing_ok=True)
    return data
