# ECONOVA KPI Dashboard

## Overview
This project is a comprehensive KPI (Key Performance Indicator) management dashboard for Econova, a Mexican company overseeing metrics for Dura International and Grupo Orsega. It provides real-time monitoring and analysis of business KPIs across Sales, Logistics, Purchasing, and Accounting & Finance. The system supports distinct metrics and access controls per company while enabling administrative-level cross-company collaboration. The business vision is to provide a unified platform for tracking and improving operational efficiency across its subsidiaries, enhancing data-driven decision-making and fostering greater accountability.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Framework**: Tailwind CSS with shadcn/ui components
- **Routing**: Wouter
- **State Management**: TanStack Query (React Query)
- **Charts**: Recharts
- **PDF Generation**: jsPDF and html2canvas
- **Maps**: Leaflet

### Backend
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **Database ORM**: Drizzle ORM
- **Authentication**: JWT-based with session management
- **Session Storage**: PostgreSQL-based

### UI/UX Design System
- **Component Library**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS with custom design tokens
- **Theme**: Custom brand colors (Econova blue #273949, lime green #b5e951)
- **Typography**: Inter font family
- **Icons**: Lucide React icons

### Core Features
- **Authentication System**: JWT token-based, comprehensive role-based access control (admin, manager, collaborator, viewer), executive-level access, company-specific access restrictions, session persistence.
- **Dashboard Features**: Multi-company toggling, real-time KPI tracking, color-coded status indicators, trend analysis, executive overview.
- **KPI Management**: Automated weekly sales updates, dynamic target setting, area-based organization, automatic compliance calculation.
- **User Historical Analysis**: Individual user KPI tracking over time with smart filtering (shows top 3 priority KPIs by default: Porcentaje de crecimiento en ventas, Nuevos clientes adquiridos, Tasa de retención de clientes), expandable view for additional metrics, KPI-specific detail filtering for clear data visualization, trend analysis with comparison charts.
- **Shipment Tracking**: Real-time monitoring, geolocation integration (Leaflet with Mexican postal codes), multi-carrier support, comprehensive status management, automated email notifications on status changes with customer preference support.
- **Treasury Module (Tesorería)**: 
  - **Scheduled Payments**: Automated payment management and scheduling
  - **Exchange Rates**: USD/MXN registry with Banxico API integration, 3x daily updates (9 AM, 12 PM, 5 PM Mexico time), historical data (Sept-Oct 2025), FX Analytics with multi-source comparison (MONEX, Santander, DOF)
  - **Payment Vouchers (Comprobantes)** [IN PROGRESS]: Kanban-based workflow system for bank payment vouchers with:
    - Multi-format upload (PDF, PNG, JPG, JPEG) with 10MB limit
    - Automatic OpenAI Vision analysis to extract: amount, date, bank, reference, currency
    - Client-based workflow automation (automatic routing to "Pendiente Complemento" if client requires payment complement)
    - 4-state Kanban board: Factura Pagada → Pendiente Complemento → Complemento Recibido → Cierre Contable
    - Cross-departmental access for accounting closure
    - Database tables: `clients` (with requiresPaymentComplement flag), `payment_vouchers` (with extracted data and file URLs)
- **Reporting & Analytics**: PDF and Excel export for dashboards and reports, historical performance analysis, executive reporting.
- **Data Flow**: PostgreSQL database schema with entities for Users, Companies, Areas, KPIs, KPI Values, Shipments, Action Plans, Scheduled Payments, Payment Receipts, Payment Complements, and Exchange Rates. RESTful API with JWT authentication and PostgreSQL session management. TanStack Query for server state, React hooks for local state, and localStorage for user preferences.
- **Deployment Strategy**: Configured for Replit development and autoscale production deployment, with Vite for frontend and esbuild for backend. Drizzle Kit for database schema management and seeding.

## External Dependencies

### Database
- **PostgreSQL**: Primary database (Neon serverless)
- **Connection**: @neondatabase/serverless
- **ORM**: Drizzle ORM

### UI Libraries
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Recharts**: Chart library
- **Leaflet**: Interactive maps

### Authentication & Security
- **JWT**: JSON Web Tokens
- **bcrypt**: Password hashing
- **express-session**: Session management
- **connect-pg-simple**: PostgreSQL session store

### Development Tools
- **TypeScript**
- **Vite**
- **ESLint**
- **PostCSS**

### Other Integrations
- **SendGrid**: Email notification system for shipment status updates and transport requests. Automated emails sent when shipment status changes, respecting customer email preferences.
- **Banxico API**: Official Banco de México REST API for exchange rate data. Automated daily updates (3x daily) for DOF exchange rates. Historical data import capability for Sept-Oct 2025. Token stored securely in environment variables (BANXICO_TOKEN).