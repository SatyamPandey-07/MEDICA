-- MEDICA PostgreSQL Initialization Script
-- Creates pgvector extension and sets up schemas
-- Setup DB

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
