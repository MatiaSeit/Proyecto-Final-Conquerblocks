from .base import *  # noqa: F401,F403

DEBUG = False

# Fast password hashing makes the test suite noticeably faster.
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Run Celery tasks synchronously, in-process -- the test suite shouldn't
# need a real Redis broker or a running worker.
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True

# Captures sent mail in django.core.mail.outbox instead of hitting a real backend.
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
