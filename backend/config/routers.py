from rest_framework.routers import DefaultRouter


class ApiRouter(DefaultRouter):
    """DefaultRouter that accepts URLs with or without a trailing slash.

    APPEND_SLASH can't redirect a POST, so a client that omits the slash would
    otherwise get an error rather than a redirect.
    """

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.trailing_slash = "/?"
