# Build stage
FROM rust:1.75 as builder
WORKDIR /app

# Copy Cargo.toml and Cargo.lock
COPY Cargo.toml .
# Create dummy source file to build dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs
# Build dependencies only (for better caching)
RUN cargo build --release
# Remove dummy files
RUN rm -rf src

# Copy actual source code
COPY . .
# Force rebuild with actual source
RUN touch src/main.rs
# Build the application
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy the binary from builder
COPY --from=builder /app/target/release/zero /app/zero
# Copy migrations and static files
COPY --from=builder /app/migrations /app/migrations
COPY --from=builder /app/static /app/static

# Run the application
EXPOSE 3000
CMD ["./zero"]