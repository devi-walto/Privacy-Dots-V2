"""
views.py — Request Handlers and Business Logic
------------------------------------------------
Views are functions that receive an HTTP request and return an HTTP response.
This is where the actual work happens in the event_handler app.

What it does:
  - Receives motion events via POST from ESP32 nodes through MQTT -> Django
  - Saves each event to PostgreSQL
  - Sends a push notification to Ntfy when motion is detected
  - Serves stored event history to the React dashboard via GET

Works with:
  - event_handler/urls.py — routes incoming requests to these functions
  - event_handler/models.py — MotionEvent model for saving to database
  - basestation_config/settings.py — reads NTFY_URL and NTFY_TOPIC
  - ntfy container — receives HTTP POST notifications from here
  - React dashboard — fetches event history from get_events endpoint

URL endpoints defined in event_handler/urls.py:
  POST /api/motion/  -> motion_detected()
  GET  /api/events/  -> get_events()
"""
import json
import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from .models import MotionEvent, Device

# csrf_exempt disables Django's Cross Site Request Forgery protection for this view
# Required because ESP32 nodes cannot generate CSRF tokens
@csrf_exempt
def motion_detected(request):
    """
    Receives a motion event POST request from an ESP32 node.
    Automatically registers new devices and saves the event to the database.
    """
    if request.method == 'POST':
        try:
            # Parse the JSON body from the incoming request
            data = json.loads(request.body)
            node_id = data.get('node_id')
            location = data.get('location', 'Unknown')

            # AUTOMATIC REGISTRATION LOGIC
            # Checks if the device exists; if not, creates it.
            device, created = Device.objects.get_or_create(
                node_id=node_id,
                defaults={
                    'name': f"Sensor {node_id}",
                    'location': location,
                    'is_active': True
                }
            )

            # Save the motion event and link it to the Device record
            event = MotionEvent.objects.create(
                device=device,
                node_id=node_id,
                location=location
            )

            # Send push notification to Ntfy
            requests.post(
                f"{settings.NTFY_URL}/{settings.NTFY_TOPIC}",
                headers={"Title": "Motion Detected"},
                data=f"Motion detected at {location} (Node: {node_id})"
            )

            return JsonResponse({
                'status': 'success', 
                'event_id': event.id,
                'device_registered': created
            }, status=200)

        except json.JSONDecodeError:
            return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)

    return JsonResponse({'status': 'error', 'message': 'Only POST requests allowed'}, status=405)


def get_events(request):
    """
    Returns the 50 most recent motion events as JSON.
    Supports filtering by node_id via query parameter.
    """
    if request.method == 'GET':
        node_id = request.GET.get('node_id')
        events = MotionEvent.objects.all()

        if node_id:
            events = events.filter(node_id=node_id)

        events = events.order_by('-detected_at')[:50]

        data = [
            {
                'id': e.id,
                'node_id': e.node_id,
                'location': e.location,
                'detected_at': e.detected_at.isoformat(),
                'device_name': e.device.name if e.device else "Unregistered"
            }
            for e in events
        ]
        return JsonResponse({'events': data}, status=200)

    return JsonResponse({'status': 'error', 'message': 'Only GET requests allowed'}, status=405)


def get_devices(request):
    """
    Returns a list of all registered sensors and their current status.
    Used for the device status dashboard.
    """
    if request.method == 'GET':
        devices = Device.objects.all()
        data = [
            {
                'node_id': d.node_id,
                'name': d.name,
                'location': d.location,
                'is_active': d.is_active,
                'registered_at': d.registered_at.isoformat()
            }
            for d in devices
        ]
        return JsonResponse({'devices': data}, status=200)

    return JsonResponse({'status': 'error', 'message': 'Only GET requests allowed'}, status=405)