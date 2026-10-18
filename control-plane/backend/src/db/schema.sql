-- UniDesk Control Plane - Schema PostgreSQL (Supabase / Neon / PostgreSQL 14+)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tenants (Empresas Clientes)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL,
    trade_name VARCHAR(255),
    cnpj VARCHAR(20) UNIQUE NOT NULL,
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    asaas_customer_id VARCHAR(100) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Licenses (Licenças das Instâncias Locais)
-- Status: ACTIVE, GRACE_PERIOD, SUSPENDED, REVOKED
CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    license_key VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    plan_tier VARCHAR(50) NOT NULL DEFAULT 'STANDARD',
    max_devices INTEGER DEFAULT 50,
    instance_uuid VARCHAR(100) UNIQUE,
    activated_at TIMESTAMP WITH TIME ZONE,
    last_heartbeat_at TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    grace_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Invoices (Faturas e Assinaturas do Asaas)
-- Status: PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED, CANCELLED
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    asaas_invoice_id VARCHAR(100) UNIQUE NOT NULL,
    asaas_subscription_id VARCHAR(100),
    amount NUMERIC(10, 2) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    due_date DATE NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE,
    billing_type VARCHAR(50), -- BOLETO, PIX, CREDIT_CARD
    invoice_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Support Tickets (Chamados e Telemetria de Diagnóstico)
-- Status: OPEN, IN_PROGRESS, RESOLVED, CLOSED
CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    license_id UUID REFERENCES licenses(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    priority VARCHAR(50) DEFAULT 'MEDIUM',
    diagnostics_payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_licenses_tenant_id ON licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_licenses_license_key ON licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_instance_uuid ON licenses(instance_uuid);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_asaas_invoice_id ON invoices(asaas_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_asaas_customer_id ON tenants(asaas_customer_id);
