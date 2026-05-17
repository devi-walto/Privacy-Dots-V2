# FROM        # what base image to build on
# WORKDIR     # set the working directory inside the container
# COPY        # copy files from your machine into the container
# RUN         # execute a command during the build
# EXPOSE      # document what port the container listens on
# CMD         # what command runs when the container starts

FROM python:3.11-slim

WORKDIR /backend_container

COPY requirements.txt .

RUN pip install -r requirements.txt

EXPOSE 8000

COPY . .

# Strip CRLF so the script runs on Linux (Windows checkouts often use CRLF)
RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh

# repair_migrations handles stale Postgres volumes, then migrate, then runserver
ENTRYPOINT ["sh", "entrypoint.sh"]