"""
Local development settings for config project.
"""
import os
import urllib.parse
import dj_database_url

from .base import *

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

ALLOWED_HOSTS = ['*']

# CORS settings for development
CORS_ALLOW_ALL_ORIGINS = True

# Supabase PostgreSQL Database for development
pas = os.getenv("DB_PASSWORD")
user = os.getenv("DB_USER")
password = urllib.parse.quote_plus(os.getenv("DB_PASSWORD"))
DATABASE_URL = f"postgresql://postgres.{user}:{password}@aws-1-eu-central-1.pooler.supabase.com:6543/postgres"

DATABASES = {
    'default': dj_database_url.config(
        default=DATABASE_URL,
        conn_max_age=600,
        ssl_require=True
    )
}

# Development-specific logging
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
}