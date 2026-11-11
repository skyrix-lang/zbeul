#!/bin/sh
# Starts the local Postgres container, creating it on first use, and waits for it.
set -e

docker start zbeul-db >/dev/null 2>&1 || docker run -d --name zbeul-db \
  -e POSTGRES_USER=zbeul \
  -e POSTGRES_PASSWORD=zbeul \
  -e POSTGRES_DB=zbeul \
  -p 5432:5432 \
  -v zbeul-db:/var/lib/postgresql \
  postgres:18-alpine >/dev/null

# Over TCP: during first-time setup Postgres only listens on a local socket.
until docker exec zbeul-db pg_isready -q -h 127.0.0.1 -U zbeul; do
  sleep 1
done
