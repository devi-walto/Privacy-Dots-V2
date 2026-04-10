# Program to run the motion sensor and when motions is detected it sends the data to the django server 

import requests
import pineworkslabs.RPi as GPIO
import time
from datetime import datetime

NODE_NAME = "Dots 1" 
LOCATION = "Office"  

PIR_SENSOR_PIN = 13

GPIO.setmode(GPIO.LE_POTATO_LOOKUP)  # Use the appropriate pin numbering for Le Potato
GPIO.setup(PIR_SENSOR_PIN, GPIO.IN)  # Set the PIR sensor pin as an input

DELAY_BETWEEN_TRIGGERS = 10  # Time in seconds between each trigger

 #put your ip in here from whatever wifi you're connected to 
def notify_motion_detected(motion_data):
    url = "http://138.47.116.172:8000/motion/"  # Update with your server IP
    data = {'motion_data': motion_data} # this is the data dictionary and how everything is transported

    try:  
        # this is the actual post being requested with the url and data 
        print("Sending Notification")  # Print the data to be sent
        response = requests.post(url, json=data)
        response.raise_for_status()
        print(response.json())

        # this is for troubleshooting and notifications of saving
        if response.status_code == 201:
            print("data_saved")
        else:
            print("bad data", response.status_code, response.text)
    except requests.exceptions.RequestException as e:
        print("Error:", e)


# try method that detects motion and sends message to the django server
try:
    print("Motion sensor is starting...")
    time.sleep(2) 

    while True:  # Continuously check for motion
        motion_detected = GPIO.input(PIR_SENSOR_PIN)

        if motion_detected:
            print("Motion Detected")
            motion_data = {
                'timestamp': str(datetime.now()),
                'event': 'Motion Detected',
                'name_id': NODE_NAME,
                'location': LOCATION 
            }
            notify_motion_detected(motion_data) 
            time.sleep(DELAY_BETWEEN_TRIGGERS) 
        else:
            print("No motion detected.")

except KeyboardInterrupt:
    print("Program terminated.")
finally:
    GPIO.cleanup()  # Clean up GPIO settings
