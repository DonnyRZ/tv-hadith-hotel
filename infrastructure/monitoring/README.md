# Monitoring configuration

The monitoring profile provides Prometheus, Grafana, and Loki for local
development. Start the database and object storage with the default Compose
services, then opt into monitoring with the monitoring profile.

The API scrape target is intentionally present as a future target. It will
become reachable when the API container is added in the implementation phase.
