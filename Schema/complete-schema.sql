-- Complete database schema with analytics table

-- Users table to store authentication information
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Sessions for tracking logins
CREATE TABLE sessions (
    session_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    session_token VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Scan history table
CREATE TABLE scan_history (
    scan_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    url TEXT NOT NULL,
    scan_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_safe BOOLEAN,
    threat_type VARCHAR(100),
    threat_score DECIMAL(5,2)
);

-- User settings
CREATE TABLE user_settings (
    settings_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) UNIQUE,
    url_analysis BOOLEAN DEFAULT TRUE,
    ml_detection BOOLEAN DEFAULT TRUE, 
    notifications BOOLEAN DEFAULT TRUE,
    auto_scan BOOLEAN DEFAULT TRUE,
    show_count BOOLEAN DEFAULT TRUE,
    whitelist TEXT[], -- Store whitelist domains as an array
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics table for tracking extension usage and performance
CREATE TABLE analytics (
    analytics_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster analytics queries
CREATE INDEX idx_analytics_user_event ON analytics(user_id, event_type);
CREATE INDEX idx_analytics_created_at ON analytics(created_at);
