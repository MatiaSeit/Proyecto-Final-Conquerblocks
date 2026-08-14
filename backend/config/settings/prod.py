from decouple import Csv, config

from .base import *  # noqa: F401,F403

DEBUG = False
ALLOWED_HOSTS = config("ALLOWED_HOSTS", cast=Csv())

# Neon (and most managed Postgres) require SSL; DB_* env vars stay the same
# five discrete values as everywhere else, this just adds the one extra bit
# Neon needs on top of them.
DATABASES["default"]["OPTIONS"] = {"sslmode": config("DB_SSLMODE", default="require")}

# The free hosting tier this project deploys to (see README > Despliegue)
# has no always-on process for a Celery worker or Beat to run inside, so:
#   - CELERY_TASK_ALWAYS_EAGER is set to True in the platform's env vars,
#     which makes every .delay() call (e.g. manifest PDF generation) run
#     synchronously in the same request instead of going through Redis --
#     no code change needed, base.py already reads this from the env.
#   - The hourly low-stock digest that Celery Beat would normally schedule
#     is instead triggered by an external cron (GitHub Actions) calling
#     LowStockDigestCronView over HTTP. See logistics/views.py.
# Locally with `docker compose up`, neither of these apply -- the real
# Celery worker + Beat containers run continuously, exactly as documented
# in the "Async work" section of the README.

# The React frontend is served from a different origin than the API in
# production -- it needs to be allow-listed explicitly here.
# CORS_ALLOW_ALL_ORIGINS from dev.py does not carry over on purpose.
CORS_ALLOWED_ORIGINS = config("CORS_ALLOWED_ORIGINS", default="", cast=Csv())

SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True

# Most PaaS hosts terminate TLS at a load balancer/edge proxy and forward
# plain HTTP to the container -- without this, Django thinks every request
# is insecure and loops on SECURE_SSL_REDIRECT.
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# WhiteNoise serves Django's own static files (admin, DRF browsable API css)
# directly from the app process -- no separate static file host needed.
MIDDLEWARE = MIDDLEWARE[:1] + ["whitenoise.middleware.WhiteNoiseMiddleware"] + MIDDLEWARE[1:]
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
