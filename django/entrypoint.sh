#!/bin/sh
set -e

echo "[django] Repairing migration history if needed..."
python manage.py repair_migrations

echo "[django] Applying migrations..."
python manage.py migrate --noinput

echo "[django] Starting development server..."
exec python manage.py runserver 0.0.0.0:8000
