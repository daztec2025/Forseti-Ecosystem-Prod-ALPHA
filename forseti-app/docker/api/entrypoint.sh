#!/bin/bash
set -e

echo "=== Forseti API Entrypoint ==="
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"

# Wait for database to be ready (PostgreSQL)
# Skip TCP check for Cloud SQL (uses Unix sockets via ?host=/cloudsql/...)
if [[ "$DATABASE_URL" == postgresql://* ]] && [[ "$DATABASE_URL" != *"/cloudsql/"* ]]; then
    echo "Waiting for PostgreSQL to be ready..."

    # Extract host and port from DATABASE_URL
    # Format: postgresql://user:pass@host:port/database
    DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:/]*\).*|\1|p')
    DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')

    # Default port if not specified
    if [ -z "$DB_PORT" ]; then
        DB_PORT=5432
    fi

    echo "Connecting to database at $DB_HOST:$DB_PORT..."

    # Wait up to 60 seconds for the database
    RETRIES=30
    until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
        RETRIES=$((RETRIES - 1))
        if [ $RETRIES -le 0 ]; then
            echo "ERROR: Database not available after 60 seconds"
            exit 1
        fi
        echo "Database not ready, waiting... ($RETRIES retries left)"
        sleep 2
    done
    echo "Database is ready!"
elif [[ "$DATABASE_URL" == *"/cloudsql/"* ]]; then
    echo "Using Cloud SQL Unix socket connection - skipping TCP health check"
fi

# Run Prisma migrations
echo "Running database migrations..."
npx prisma migrate deploy
echo "Migrations complete!"

# Execute the main command
echo "Starting Forseti API server..."
exec "$@"
