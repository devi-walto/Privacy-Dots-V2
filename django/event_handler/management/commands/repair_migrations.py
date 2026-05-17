"""
repair_migrations — Fix migration history when Postgres already has the tables.

This happens when the postgres_data Docker volume survives a rebuild but
django_migrations is out of sync (e.g. migration 0002 created tables then
the container exited before the row was recorded).

Run automatically from entrypoint.sh before migrate, or manually:
  python manage.py repair_migrations
"""

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection
from django.db.migrations.recorder import MigrationRecorder

APP = "event_handler"


def table_exists(cursor, table_name):
    cursor.execute(
        """
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = %s
        )
        """,
        [table_name],
    )
    return cursor.fetchone()[0]


def column_exists(cursor, table_name, column_name):
    cursor.execute(
        """
        SELECT EXISTS (
            SELECT FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = %s
              AND column_name = %s
        )
        """,
        [table_name, column_name],
    )
    return cursor.fetchone()[0]


class Command(BaseCommand):
    help = "Align django_migrations with tables that already exist in Postgres"

    def handle(self, *args, **options):
        recorder = MigrationRecorder(connection)
        applied = set(recorder.applied_migrations())
        repaired = False

        with connection.cursor() as cursor:
            # --- 0002: Device model + MotionEvent.device FK ---
            key_0002 = (APP, "0002_device_motionevent_device")
            if key_0002 not in applied and table_exists(cursor, "event_handler_device"):
                if column_exists(cursor, "event_handler_motionevent", "device_id"):
                    self.stdout.write(
                        "Device table and FK already exist; faking 0002."
                    )
                    call_command(
                        "migrate", APP, "0002_device_motionevent_device", fake=True
                    )
                    applied.add(key_0002)
                    repaired = True
                else:
                    self.stdout.write(
                        "Orphan Device table without FK; dropping so 0002 can re-run."
                    )
                    cursor.execute(
                        "DROP TABLE IF EXISTS event_handler_device CASCADE"
                    )
                    repaired = True

            # --- 0003: telemetry columns ---
            key_0003 = (
                APP,
                "0003_device_battery_device_connection_interrupted_and_more",
            )
            if key_0003 not in applied and table_exists(cursor, "event_handler_device"):
                if column_exists(cursor, "event_handler_device", "battery"):
                    self.stdout.write(
                        "Telemetry columns already exist; faking 0003."
                    )
                    call_command(
                        "migrate",
                        APP,
                        "0003_device_battery_device_connection_interrupted_and_more",
                        fake=True,
                    )
                    repaired = True

        if not repaired:
            self.stdout.write("No migration repair needed.")
