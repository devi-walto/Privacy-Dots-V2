"""
models.py — Database Table Definitions
----------------------------------------
Models are Python classes that define your database tables.
Each class is one table. Each attribute is one column.
Django automatically creates and manages the actual database tables
based on what you define here.

What it does:
  Defines the MotionEvent model which stores every motion detection
  event received from an ESP32 node.

Works with:
  - django migrations — every change here generates a migration file
  - event_handler/views.py — views create and query MotionEvent records
  - event_handler/admin.py — registers this model in the Django admin panel
  - PostgreSQL — Django translates these classes into actual database tables

For more information see
https://docs.djangoproject.com/en/5.1/topics/db/models/
"""
from django.db import models

class Device(models.Model):
    # Added the Device model according to your spec
    node_id = models.CharField(max_length=255, unique=True)
    name = models.CharField(max_length=255)
    location = models.CharField(max_length=255, null=True, blank=True)
    registered_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.name} ({self.node_id})"

class MotionEvent(models.Model):
    # The ID of the ESP32 node that detected motion e.g. 'PDN#123456'
    node_id = models.CharField(max_length=255)

    # Added the foreign key relationship to Device
    device = models.ForeignKey(Device, on_delete=models.CASCADE, null=True, blank=True)

    # Physical location of the node e.g. 'Front Door', 'Hallway'
    # null=True allows the database column to be empty
    # blank=True allows the form field to be empty
    location = models.CharField(max_length=255, null=True, blank=True)
    
    # Timestamp automatically set to the current time when the record is created
    # auto_now_add=True means this field is never manually set
    detected_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        # Controls how this object displays in the Django admin panel
        return f"{self.node_id} - {self.detected_at}"