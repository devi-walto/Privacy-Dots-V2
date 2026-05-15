from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('event_handler', '0003_device_battery_device_connection_interrupted_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='device',
            name='last_seen',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
