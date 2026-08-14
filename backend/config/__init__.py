# Make sure the Celery app is loaded whenever Django starts, so shared_task
# decorators registered by installed apps use this app.
from .celery import app as celery_app

__all__ = ("celery_app",)
