-- ====================================================
-- MIGRATION: Add Performance Indexes
-- Date: 2025-12-17
-- Purpose: Fix missing indexes identified in audit
-- ====================================================

-- ========================================
-- INDEXES FOR KPI TABLES
-- ========================================

-- Index for company-based KPI queries
CREATE INDEX IF NOT EXISTS idx_kpis_dura_company_id ON kpis_dura(company_id);
CREATE INDEX IF NOT EXISTS idx_kpis_orsega_company_id ON kpis_orsega(company_id);

-- Index for area-based filtering
CREATE INDEX IF NOT EXISTS idx_kpis_dura_area ON kpis_dura(area);
CREATE INDEX IF NOT EXISTS idx_kpis_orsega_area ON kpis_orsega(area);

-- Composite index for company + area queries
CREATE INDEX IF NOT EXISTS idx_kpis_dura_company_area ON kpis_dura(company_id, area);
CREATE INDEX IF NOT EXISTS idx_kpis_orsega_company_area ON kpis_orsega(company_id, area);

-- ========================================
-- INDEXES FOR KPI VALUES TABLES
-- ========================================

-- Index for KPI history queries (kpi_id + date)
CREATE INDEX IF NOT EXISTS idx_kpi_values_dura_kpi_date ON kpi_values_dura(kpi_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kpi_values_orsega_kpi_date ON kpi_values_orsega(kpi_id, created_at DESC);

-- Index for period-based queries
CREATE INDEX IF NOT EXISTS idx_kpi_values_dura_kpi_period ON kpi_values_dura(kpi_id, period);
CREATE INDEX IF NOT EXISTS idx_kpi_values_orsega_kpi_period ON kpi_values_orsega(kpi_id, period);

-- ========================================
-- INDEXES FOR NOTIFICATIONS TABLE
-- ========================================

-- Index for user notifications (most common query)
CREATE INDEX IF NOT EXISTS idx_notifications_to_user ON notifications(to_user_id, read, created_at DESC);

-- Index for company/area filtering
CREATE INDEX IF NOT EXISTS idx_notifications_company_area ON notifications(company_id, area_id);

-- ========================================
-- INDEXES FOR PAYMENT VOUCHERS TABLE
-- ========================================

-- Index for status-based queries
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_status ON payment_vouchers(status);

-- Composite index for company + status queries
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_company_status ON payment_vouchers(company_id, status, created_at DESC);

-- Index for client lookups
CREATE INDEX IF NOT EXISTS idx_payment_vouchers_client_id ON payment_vouchers(client_id);

-- ========================================
-- INDEXES FOR SHIPMENTS TABLE
-- ========================================

-- Index for company-based shipment queries
CREATE INDEX IF NOT EXISTS idx_shipments_company_id ON shipments(company_id);

-- Composite index for company + status queries (most common)
CREATE INDEX IF NOT EXISTS idx_shipments_company_status ON shipments(company_id, status, created_at DESC);

-- Index for tracking code lookups
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_code ON shipments(tracking_code);

-- ========================================
-- INDEXES FOR CLIENTS TABLE
-- ========================================

-- Index for company-based client queries
CREATE INDEX IF NOT EXISTS idx_clients_company_id ON clients(company_id);

-- Index for name searches (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_clients_name_lower ON clients(LOWER(name));

-- ========================================
-- INDEXES FOR SALES DATA TABLE
-- ========================================

-- Index for date-based queries
CREATE INDEX IF NOT EXISTS idx_sales_data_date ON sales_data(sale_date DESC);

-- Composite index for company + date queries
CREATE INDEX IF NOT EXISTS idx_sales_data_company_date ON sales_data(company_id, sale_date DESC);

-- Index for client sales analysis
CREATE INDEX IF NOT EXISTS idx_sales_data_client_id ON sales_data(client_id);

-- ========================================
-- INDEXES FOR SCHEDULED PAYMENTS TABLE
-- ========================================

-- Index for status-based queries
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_status ON scheduled_payments(status);

-- Index for due date queries
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_due_date ON scheduled_payments(due_date);

-- Composite index for company + status
CREATE INDEX IF NOT EXISTS idx_scheduled_payments_company_status ON scheduled_payments(company_id, status);

-- ========================================
-- INDEXES FOR USERS TABLE
-- ========================================

-- Index for email lookups (login)
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));

-- Index for company-based user queries
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);

-- ====================================================
-- END OF MIGRATION
-- ====================================================
