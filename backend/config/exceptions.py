"""One error shape for the whole API, so the client has a single thing to parse.

Every error response looks like::

    {"code": "illegal_move", "detail": "Human-readable message.", "errors": {"field": ["..."]}}

``errors`` is only present for validation failures.
"""

import logging

from django.core.exceptions import PermissionDenied
from django.db import IntegrityError
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def api_exception_handler(exc, context):
    # DRF converts these two inside its own handler, too late for us to read their codes.
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, PermissionDenied):
        exc = exceptions.PermissionDenied()

    response = exception_handler(exc, context)

    if response is None:
        if isinstance(exc, IntegrityError):
            logger.warning("Integrity conflict in %s: %s", _view_name(context), exc)
            return Response(
                {
                    "code": "conflict",
                    "detail": "That change conflicts with another request. Refresh and try again.",
                },
                status=status.HTTP_409_CONFLICT,
            )
        logger.exception("Unhandled error in %s", _view_name(context), exc_info=exc)
        return Response(
            {"code": "server_error", "detail": "Something went wrong on our side."},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    if isinstance(exc, exceptions.ValidationError):
        response.data = _validation_payload(exc)
    else:
        response.data = {
            "code": _first_code(exc),
            "detail": str(getattr(exc, "detail", exc)),
        }
    return response


def _validation_payload(exc: exceptions.ValidationError) -> dict:
    detail = exc.detail
    if isinstance(detail, dict):
        non_field = detail.get("non_field_errors")
        message = str(non_field[0]) if non_field else "Please correct the highlighted fields."
        code = non_field[0].code if non_field else "validation_error"
        return {"code": code, "detail": message, "errors": detail}
    first = detail[0] if isinstance(detail, list) and detail else detail
    return {"code": getattr(first, "code", "invalid"), "detail": str(first)}


def _first_code(exc: Exception) -> str:
    detail = getattr(exc, "detail", None)
    return getattr(detail, "code", None) or getattr(exc, "default_code", "error")


def _view_name(context: dict) -> str:
    view = context.get("view")
    return type(view).__name__ if view else "unknown view"
