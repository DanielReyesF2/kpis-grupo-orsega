CREATE TYPE "public"."shipment_status" AS ENUM('pending', 'in_transit', 'delayed', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."voucher_status" AS ENUM('factura_pagada', 'pendiente_complemento', 'complemento_recibido', 'cierre_contable');--> statement-breakpoint
CREATE TABLE "action_plans" (
	"id" serial PRIMARY KEY NOT NULL,
	"kpi_id" integer NOT NULL,
	"problem_description" text NOT NULL,
	"corrective_actions" text NOT NULL,
	"responsible" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"status" text NOT NULL,
	"results" text
);
--> statement-breakpoint
CREATE TABLE "areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"company_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"contact_person" text,
	"company" text,
	"address" text,
	"payment_terms" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"requires_receipt" boolean DEFAULT true,
	"reminder_frequency" integer,
	"is_active" boolean DEFAULT true,
	"notes" text,
	"company_id" integer,
	"client_code" text,
	"secondary_email" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"country" text DEFAULT 'México',
	"email_notifications" boolean DEFAULT true,
	"customer_type" text,
	"requires_payment_complement" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sector" text,
	"logo" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" timestamp DEFAULT now() NOT NULL,
	"buy_rate" real NOT NULL,
	"sell_rate" real NOT NULL,
	"source" text,
	"notes" text,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"area_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"main_activities" json NOT NULL,
	"responsibilities" json NOT NULL,
	"kpi_instructions" json NOT NULL,
	"tips" json NOT NULL,
	"processes" json NOT NULL,
	"update_frequency" json NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kpi_values" (
	"id" serial PRIMARY KEY NOT NULL,
	"kpi_id" integer NOT NULL,
	"user_id" integer,
	"value" text NOT NULL,
	"date" timestamp DEFAULT now(),
	"period" text NOT NULL,
	"compliance_percentage" text,
	"status" text,
	"comments" text,
	"updated_by" integer
);
--> statement-breakpoint
CREATE TABLE "kpis" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"area_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"unit" text NOT NULL,
	"target" text NOT NULL,
	"frequency" text NOT NULL,
	"calculation_method" text,
	"responsible" text,
	"inverted_metric" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"type" text DEFAULT 'info' NOT NULL,
	"from_user_id" integer NOT NULL,
	"to_user_id" integer,
	"company_id" integer,
	"area_id" integer,
	"priority" text DEFAULT 'normal' NOT NULL,
	"read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "payment_complements" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"client_name" text NOT NULL,
	"invoice_reference" text NOT NULL,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'MXN' NOT NULL,
	"complement_url" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"generated_at" timestamp,
	"sent_at" timestamp,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"payment_id" integer,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_type" text NOT NULL,
	"uploaded_by" integer NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"sent_to" text[],
	"sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "payment_vouchers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"client_id" integer NOT NULL,
	"client_name" text NOT NULL,
	"scheduled_payment_id" integer,
	"status" "voucher_status" DEFAULT 'factura_pagada' NOT NULL,
	"voucher_file_url" text NOT NULL,
	"voucher_file_name" text NOT NULL,
	"voucher_file_type" text NOT NULL,
	"invoice_file_url" text,
	"invoice_file_name" text,
	"invoice_file_type" text,
	"complement_file_url" text,
	"complement_file_name" text,
	"complement_file_type" text,
	"extracted_amount" real,
	"extracted_date" timestamp,
	"extracted_bank" text,
	"extracted_reference" text,
	"extracted_currency" text,
	"ocr_confidence" real,
	"notes" text,
	"uploaded_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_reminder_sent" timestamp,
	"reminder_count" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"company_id" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "provider" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"contact_name" text,
	"notes" text,
	"rating" real,
	"is_active" boolean DEFAULT true NOT NULL,
	"short_name" text,
	"company_id" integer,
	"location" text,
	"requires_rep" boolean DEFAULT false,
	"rep_frequency" integer,
	"reminder_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"supplier_name" text NOT NULL,
	"amount" real NOT NULL,
	"currency" text DEFAULT 'MXN' NOT NULL,
	"due_date" timestamp NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reference" text,
	"notes" text,
	"paid_at" timestamp,
	"paid_by" integer,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_cycle_times" (
	"id" serial PRIMARY KEY NOT NULL,
	"shipment_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"created_at" timestamp NOT NULL,
	"pending_at" timestamp,
	"in_transit_at" timestamp,
	"delivered_at" timestamp,
	"closed_at" timestamp,
	"hours_pending_to_transit" text,
	"hours_transit_to_delivered" text,
	"hours_delivered_to_closed" text,
	"hours_total_cycle" text,
	"hours_to_delivery" text,
	"computed_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "shipment_cycle_times_shipment_id_unique" UNIQUE("shipment_id")
);
--> statement-breakpoint
CREATE TABLE "shipment_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"shipment_id" integer NOT NULL,
	"product" text NOT NULL,
	"quantity" text NOT NULL,
	"unit" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shipment_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"shipment_id" integer NOT NULL,
	"email_to" text NOT NULL,
	"subject" text NOT NULL,
	"status" text NOT NULL,
	"sent_at" timestamp DEFAULT now(),
	"sent_by" integer NOT NULL,
	"shipment_status" "shipment_status" NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "shipment_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"shipment_id" integer NOT NULL,
	"status" "shipment_status" NOT NULL,
	"location" text,
	"comments" text,
	"updated_by" integer,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tracking_code" text NOT NULL,
	"company_id" integer NOT NULL,
	"customer_id" integer,
	"customer_name" text NOT NULL,
	"purchase_order" text NOT NULL,
	"customer_email" text,
	"customer_phone" text,
	"invoice_number" text,
	"destination" text NOT NULL,
	"origin" text NOT NULL,
	"product" text NOT NULL,
	"quantity" text NOT NULL,
	"unit" text NOT NULL,
	"departure_date" timestamp,
	"estimated_delivery_date" timestamp,
	"actual_delivery_date" timestamp,
	"status" "shipment_status" DEFAULT 'pending' NOT NULL,
	"carrier" text,
	"vehicle_info" text,
	"vehicle_type" text,
	"fuel_type" text,
	"distance" text,
	"carbon_footprint" text,
	"driver_name" text,
	"driver_phone" text,
	"comments" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"destination_lat" real,
	"destination_lng" real,
	"origin_lat" real,
	"origin_lng" real,
	"purchase_order_number" text,
	"notification_emails" json,
	CONSTRAINT "shipments_tracking_code_unique" UNIQUE("tracking_code")
);
--> statement-breakpoint
CREATE TABLE "user_activation_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_activation_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"company_id" integer,
	"area_id" integer,
	"last_login" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_payment_id_scheduled_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."scheduled_payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_kpi_unique" ON "kpi_values" USING btree ("kpi_id","user_id","period") WHERE "kpi_values"."user_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "company_kpi_unique" ON "kpi_values" USING btree ("kpi_id","period") WHERE "kpi_values"."user_id" IS NULL;