-- ====================================================
-- MIGRATION: Add Foreign Key Constraints
-- Date: 2025-12-17
-- Purpose: Add referential integrity constraints
-- ====================================================

-- ========================================
-- FOREIGN KEYS FOR USERS TABLE
-- ========================================

-- Users -> Companies
ALTER TABLE users
ADD CONSTRAINT IF NOT EXISTS fk_users_company
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

-- Users -> Areas
ALTER TABLE users
ADD CONSTRAINT IF NOT EXISTS fk_users_area
FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL;

-- ========================================
-- FOREIGN KEYS FOR AREAS TABLE
-- ========================================

-- Areas -> Companies
ALTER TABLE areas
ADD CONSTRAINT IF NOT EXISTS fk_areas_company
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- ========================================
-- FOREIGN KEYS FOR KPI TABLES
-- ========================================

-- KPIs Dura -> Companies
ALTER TABLE kpis_dura
ADD CONSTRAINT IF NOT EXISTS fk_kpis_dura_company
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- KPIs Orsega -> Companies
ALTER TABLE kpis_orsega
ADD CONSTRAINT IF NOT EXISTS fk_kpis_orsega_company
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- ========================================
-- FOREIGN KEYS FOR KPI VALUES TABLES
-- ========================================

-- KPI Values Dura -> KPIs Dura
ALTER TABLE kpi_values_dura
ADD CONSTRAINT IF NOT EXISTS fk_kpi_values_dura_kpi
FOREIGN KEY (kpi_id) REFERENCES kpis_dura(id) ON DELETE CASCADE;

-- KPI Values Orsega -> KPIs Orsega
ALTER TABLE kpi_values_orsega
ADD CONSTRAINT IF NOT EXISTS fk_kpi_values_orsega_kpi
FOREIGN KEY (kpi_id) REFERENCES kpis_orsega(id) ON DELETE CASCADE;

-- ========================================
-- FOREIGN KEYS FOR NOTIFICATIONS TABLE
-- ========================================

-- Notifications -> Users (from)
ALTER TABLE notifications
ADD CONSTRAINT IF NOT EXISTS fk_notifications_from_user
FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Notifications -> Users (to)
ALTER TABLE notifications
ADD CONSTRAINT IF NOT EXISTS fk_notifications_to_user
FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Notifications -> Companies
ALTER TABLE notifications
ADD CONSTRAINT IF NOT EXISTS fk_notifications_company
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- Notifications -> Areas
ALTER TABLE notifications
ADD CONSTRAINT IF NOT EXISTS fk_notifications_area
FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL;

-- ========================================
-- FOREIGN KEYS FOR PAYMENT VOUCHERS TABLE
-- ========================================

-- Payment Vouchers -> Companies
ALTER TABLE payment_vouchers
ADD CONSTRAINT IF NOT EXISTS fk_payment_vouchers_company
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- Payment Vouchers -> Clients
ALTER TABLE payment_vouchers
ADD CONSTRAINT IF NOT EXISTS fk_payment_vouchers_client
FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

-- ========================================
-- FOREIGN KEYS FOR SHIPMENTS TABLE
-- ========================================

-- Shipments -> Companies
ALTER TABLE shipments
ADD CONSTRAINT IF NOT EXISTS fk_shipments_company
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- ========================================
-- FOREIGN KEYS FOR CLIENTS TABLE
-- ========================================

-- Clients -> Companies
ALTER TABLE clients
ADD CONSTRAINT IF NOT EXISTS fk_clients_company
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- ========================================
-- FOREIGN KEYS FOR SALES DATA TABLE
-- ========================================

-- Sales Data -> Companies
ALTER TABLE sales_data
ADD CONSTRAINT IF NOT EXISTS fk_sales_data_company
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- Sales Data -> Clients
ALTER TABLE sales_data
ADD CONSTRAINT IF NOT EXISTS fk_sales_data_client
FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

-- ========================================
-- FOREIGN KEYS FOR SCHEDULED PAYMENTS TABLE
-- ========================================

-- Scheduled Payments -> Companies
ALTER TABLE scheduled_payments
ADD CONSTRAINT IF NOT EXISTS fk_scheduled_payments_company
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- Scheduled Payments -> Clients
ALTER TABLE scheduled_payments
ADD CONSTRAINT IF NOT EXISTS fk_scheduled_payments_client
FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

-- ====================================================
-- END OF MIGRATION
-- ====================================================
