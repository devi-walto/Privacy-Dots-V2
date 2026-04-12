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
from .models import MotionEvent


# csrf_exempt disables Django's Cross Site Request Forgery protection for this view
# Required because ESP32 nodes cannot generate CSRF tokens
# In production this should be secured with token authentication instead
@csrf_exempt
def motion_detected(request):
    """
    Receives a motion event POST request from an ESP32 node.
    Saves the event to the database and sends a push notification via Ntfy.

    Expected JSON body:
      {
        "node_id": "PDN#123456",
        "location": "Front Door"
      }
    """
    if request.method == 'POST':
        try:
            # Parse the JSON body from the incoming request
            data = json.loads(request.body)
            node_id = data.get('node_id')
            location = data.get('location', 'Unknown')

            # Save the motion event to PostgreSQL via the MotionEvent model
            event = MotionEvent.objects.create(
                node_id=node_id,
                location=location
            )

            # Send push notification to Ntfy
            # Ntfy forwards this to any subscribed device (phone, browser)
            # NTFY_URL and NTFY_TOPIC come from settings.py which reads from .env
            requests.post(
                f"{settings.NTFY_URL}/{settings.NTFY_TOPIC}",
                headers={"Title": "Motion Detected"},
                data=f"Motion detected at {location} (Node: {node_id})"
            )

            return JsonResponse({'status': 'success', 'event_id': event.id}, status=200)

        except json.JSONDecodeError:
            return JsonResponse({'status': 'error', 'message': 'Invalid JSON'}, status=400)

    return JsonResponse({'status': 'error', 'message': 'Only POST requests allowed'}, status=405)


def get_events(request):
    """
    Returns the 50 most recent motion events as JSON.
    Called by the React dashboard to display event history.

    Returns JSON:
      {
        "events": [
          {
            "id": 1,
            "node_id": "PDN#123456",
            "location": "Front Door",
            "detected_at": "2024-01-01T00:00:00"
          },
          ...
        ]
      }
    """
    if request.method == 'GET':
        # Query the 50 most recent events ordered by newest first
        # The - before detected_at means descending order
        events = MotionEvent.objects.all().order_by('-detected_at')[:50]

        # Convert each event object into a dictionary so it can be serialized to JSON
        data = [
            {
                'id': e.id,
                'node_id': e.node_id,
                'location': e.location,
                # isoformat() converts the datetime to a standard string format
                'detected_at': e.detected_at.isoformat()
            }
            for e in events
        ]
        return JsonResponse({'events': data}, status=200)

    return JsonResponse({'status': 'error', 'message': 'Only GET requests allowed'}, status=405)