-- Crear tabla para historial de vouchers eliminados
CREATE TABLE IF NOT EXISTS "deleted_payment_vouchers" (
  "id" serial PRIMARY KEY NOT NULL,
  "original_voucher_id" integer NOT NULL,
  "company_id" integer NOT NULL,
  "payer_company_id" integer NOT NULL,
  "client_id" integer NOT NULL,
  "client_name" text NOT NULL,
  "status" text NOT NULL,
  "voucher_file_url" text NOT NULL,
  "voucher_file_name" text NOT NULL,
  "extracted_amount" real,
  "extracted_currency" text,
  "extracted_reference" text,
  "extracted_bank" text,
  "original_created_at" timestamp NOT NULL,
  "deletion_reason" text NOT NULL,
  "deleted_by" integer NOT NULL,
  "deleted_at" timestamp DEFAULT now() NOT NULL,
  "original_data" json
);

