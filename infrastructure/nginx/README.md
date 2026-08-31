# Nginx configuration

The example configuration reserves the future edge routing for guest web,
staff web, and the API, including Socket.IO upgrade headers.

It is intentionally not loaded by Docker Compose yet because the application
containers and production HTTPS certificates are not configured.
