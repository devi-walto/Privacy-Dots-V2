from django.core.management.base import BaseCommand

from event_handler.notification_flow.mqtt_ingester.subscriber import start_mqtt_subscriber


class Command(BaseCommand):
    help = "Subscribe to Privacy Dots MQTT topics and save node events."

    def handle(self, *args, **options):
        self.stdout.write("Starting Privacy Dots MQTT subscriber...")
        start_mqtt_subscriber()
