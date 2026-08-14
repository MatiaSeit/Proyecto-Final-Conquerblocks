import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

app = Celery("alliance_supply")
# reads CELERY_* settings from Django's settings module (see config/settings/base.py)
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
