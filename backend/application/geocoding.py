"""Looks up coordinates for addresses with OpenStreetMap Nominatim.

Nominatim is free but has a usage policy: at most one request per second and a
User-Agent that identifies the application. Both are handled here.
"""
import json
import time
import urllib.parse
import urllib.request

from django.conf import settings

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "ApplicationTracker/1.0 (personal job application tracker)"
MIN_INTERVAL = 1.1  # seconds between two requests

_last_request = 0.0


class GeocodingError(Exception):
    """The geocoding service could not be reached or answered with an error."""


def _search(params):
    """One Nominatim request. Returns (lat, lon) or None when nothing was found."""
    global _last_request
    wait = MIN_INTERVAL - (time.monotonic() - _last_request)
    if wait > 0:
        time.sleep(wait)

    query = {
        **{k: v for k, v in params.items() if v},  # Nominatim rejects empty parameters
        "format": "jsonv2",
        "limit": 1,
        "countrycodes": getattr(settings, "GEOCODER_COUNTRY_CODES", "de,at,ch"),
    }
    request = urllib.request.Request(
        f"{NOMINATIM_URL}?{urllib.parse.urlencode(query)}",
        headers={"User-Agent": USER_AGENT, "Accept-Language": "de,en"},
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            data = json.load(response)
    except Exception as exc:
        raise GeocodingError(str(exc)) from exc
    finally:
        _last_request = time.monotonic()

    if not data:
        return None
    return float(data[0]["lat"]), float(data[0]["lon"])


def geocode(street="", postal_code="", city=""):
    """Returns (latitude, longitude, precision).

    precision is "address" (street level), "city" (only the town or postal code
    was found) or "failed" (no usable address, or no match). Raises GeocodingError
    when the service is unreachable, so that nothing is marked as failed by mistake.
    """
    street, postal_code, city = street.strip(), postal_code.strip(), city.strip()

    if street and (postal_code or city):
        hit = _search({"street": street, "postalcode": postal_code, "city": city})
        if hit:
            return hit[0], hit[1], "address"

    if postal_code or city:
        hit = _search({"postalcode": postal_code, "city": city})
        if hit:
            return hit[0], hit[1], "city"

    return None, None, "failed"