--
-- PostgreSQL database dump
--

\restrict dHmx9S8NCykZQjFJu8wWHaXkF51UgdpwQGZx2hbHurQ1nk5XHWS7gZs1O8IuIs6

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: journal_guard(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.journal_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE st TEXT;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    RAISE EXCEPTION 'journal is immutable; post a reversing entry';
  END IF;
  SELECT status INTO st FROM accounting_periods WHERE period = NEW.period;
  IF st = 'CLOSED' THEN
    RAISE EXCEPTION 'period % is closed', NEW.period;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.journal_guard() OWNER TO postgres;

--
-- Name: payments_append_only(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.payments_append_only() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'payments is append-only';
  END IF;
  IF TG_OP = 'UPDATE' AND (
       OLD.amount <> NEW.amount OR
       OLD.order_id <> NEW.order_id OR
       OLD.kind <> NEW.kind OR
       OLD.method <> NEW.method OR
       OLD.reference <> NEW.reference
     ) THEN
    RAISE EXCEPTION 'payment financial fields are immutable';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.payments_append_only() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._migrations (
    id integer NOT NULL,
    name text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public._migrations OWNER TO postgres;

--
-- Name: _migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public._migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public._migrations_id_seq OWNER TO postgres;

--
-- Name: _migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public._migrations_id_seq OWNED BY public._migrations.id;


--
-- Name: accounting_periods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accounting_periods (
    period text NOT NULL,
    status text DEFAULT 'OPEN'::text NOT NULL,
    closed_by text,
    closed_at timestamp with time zone,
    CONSTRAINT accounting_periods_status_check CHECK ((status = ANY (ARRAY['OPEN'::text, 'CLOSED'::text])))
);


ALTER TABLE public.accounting_periods OWNER TO postgres;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accounts (
    code text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    CONSTRAINT accounts_type_check CHECK ((type = ANY (ARRAY['ASSET'::text, 'LIABILITY'::text, 'EQUITY'::text, 'REVENUE'::text, 'COGS'::text, 'EXPENSE'::text])))
);


ALTER TABLE public.accounts OWNER TO postgres;

--
-- Name: activation_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.activation_codes (
    id text NOT NULL,
    code text NOT NULL,
    type text NOT NULL,
    user_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    used_by text
);


ALTER TABLE public.activation_codes OWNER TO postgres;

--
-- Name: approvals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.approvals (
    id text NOT NULL,
    kind text NOT NULL,
    payload jsonb,
    requested_by text,
    decided_by text,
    status text DEFAULT 'PENDING'::text NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_at timestamp with time zone,
    CONSTRAINT approvals_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'REJECTED'::text])))
);


ALTER TABLE public.approvals OWNER TO postgres;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id text NOT NULL,
    order_id text,
    actor text DEFAULT ''::text NOT NULL,
    action text NOT NULL,
    entity_type text DEFAULT ''::text NOT NULL,
    entity_id text DEFAULT ''::text NOT NULL,
    previous_status text DEFAULT ''::text NOT NULL,
    new_status text DEFAULT ''::text NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: blog_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.blog_categories (
    id text NOT NULL,
    name text NOT NULL,
    slug text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.blog_categories OWNER TO postgres;

--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.blog_posts (
    id text NOT NULL,
    category_id text,
    title text NOT NULL,
    slug text DEFAULT ''::text NOT NULL,
    excerpt text DEFAULT ''::text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    cover_image text DEFAULT ''::text NOT NULL,
    author text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    published_at timestamp with time zone,
    created_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.blog_posts OWNER TO postgres;

--
-- Name: cash_handovers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cash_handovers (
    id text NOT NULL,
    driver_id text NOT NULL,
    expected numeric(14,0) NOT NULL,
    counted numeric(14,0) NOT NULL,
    confirmed_by text NOT NULL,
    confirmed_at timestamp with time zone DEFAULT now() NOT NULL,
    note text
);


ALTER TABLE public.cash_handovers OWNER TO postgres;

--
-- Name: catalogue_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.catalogue_categories (
    id text NOT NULL,
    name text NOT NULL,
    code text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    image text DEFAULT ''::text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    catalogue_visible boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.catalogue_categories OWNER TO postgres;

--
-- Name: credit_notes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.credit_notes (
    id text NOT NULL,
    credit_no text,
    invoice_id text NOT NULL,
    amount numeric(14,0) NOT NULL,
    reason text NOT NULL,
    approved_by text,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT credit_notes_amount_check CHECK ((amount > (0)::numeric))
);


ALTER TABLE public.credit_notes OWNER TO postgres;

--
-- Name: customer_addresses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_addresses (
    id text NOT NULL,
    customer_id text NOT NULL,
    label text DEFAULT 'Home'::text NOT NULL,
    line1 text DEFAULT ''::text NOT NULL,
    line2 text DEFAULT ''::text NOT NULL,
    city text DEFAULT ''::text NOT NULL,
    county text DEFAULT ''::text NOT NULL,
    postal_code text DEFAULT ''::text NOT NULL,
    country text DEFAULT 'Uganda'::text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customer_addresses OWNER TO postgres;

--
-- Name: customer_event_reminders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_event_reminders (
    id text NOT NULL,
    event_id text NOT NULL,
    customer_id text NOT NULL,
    order_id text,
    event_type text NOT NULL,
    reminder_for_date date NOT NULL,
    next_reminder_at timestamp with time zone NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    last_contacted_at timestamp with time zone,
    contacted_by text DEFAULT ''::text NOT NULL,
    outcome text DEFAULT ''::text NOT NULL,
    follow_up_notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customer_event_reminders OWNER TO postgres;

--
-- Name: customer_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_events (
    id text NOT NULL,
    customer_id text NOT NULL,
    order_id text,
    event_type text NOT NULL,
    event_date date NOT NULL,
    recurrence_rule text DEFAULT 'ANNUAL'::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    created_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customer_events OWNER TO postgres;

--
-- Name: customer_feedback; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_feedback (
    id text NOT NULL,
    customer_id text NOT NULL,
    order_id text,
    product_ids text DEFAULT ''::text NOT NULL,
    rating integer DEFAULT 5 NOT NULL,
    type text DEFAULT 'GENERAL'::text NOT NULL,
    comment text DEFAULT ''::text NOT NULL,
    resolution text,
    follow_up_required boolean DEFAULT false NOT NULL,
    follow_up_completed boolean DEFAULT false NOT NULL,
    recorded_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customer_feedback OWNER TO postgres;

--
-- Name: customer_interactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customer_interactions (
    id text NOT NULL,
    customer_id text NOT NULL,
    channel text NOT NULL,
    staff_member text DEFAULT ''::text NOT NULL,
    date_time timestamp with time zone DEFAULT now() NOT NULL,
    subject text DEFAULT ''::text NOT NULL,
    summary text DEFAULT ''::text NOT NULL,
    outcome text DEFAULT ''::text NOT NULL,
    follow_up_required boolean DEFAULT false NOT NULL,
    related_inquiry_id text,
    related_order_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customer_interactions OWNER TO postgres;

--
-- Name: customers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.customers (
    id text NOT NULL,
    name text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    preferred_contact_method text DEFAULT 'phone'::text NOT NULL,
    source text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'Active'::text NOT NULL,
    first_order_date timestamp with time zone,
    last_order_date timestamp with time zone,
    total_orders integer DEFAULT 0 NOT NULL,
    total_spend numeric(14,2) DEFAULT 0 NOT NULL,
    feedback_summary text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.customers OWNER TO postgres;

--
-- Name: deliveries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deliveries (
    id text NOT NULL,
    order_id text NOT NULL,
    type text DEFAULT 'HOME_DELIVERY'::text NOT NULL,
    destination text DEFAULT ''::text NOT NULL,
    scheduled_at timestamp with time zone,
    scheduled_date date,
    scheduled_time text,
    actual_dispatch_time timestamp with time zone,
    delivery_person text,
    delivery_fee numeric(14,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    customer_confirmation text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    actual_delivery_date timestamp with time zone
);


ALTER TABLE public.deliveries OWNER TO postgres;

--
-- Name: document_counters; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.document_counters (
    kind text NOT NULL,
    year integer NOT NULL,
    last_no integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.document_counters OWNER TO postgres;

--
-- Name: expense_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expense_categories (
    id text NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.expense_categories OWNER TO postgres;

--
-- Name: expenses; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expenses (
    id text NOT NULL,
    category_id text NOT NULL,
    amount numeric(14,2) NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    payment_method text NOT NULL,
    reference text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    attachment text,
    recorded_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.expenses OWNER TO postgres;

--
-- Name: goods_receipt_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.goods_receipt_items (
    id text NOT NULL,
    goods_receipt_id text NOT NULL,
    po_item_id text NOT NULL,
    quantity numeric(14,3) NOT NULL,
    unit text NOT NULL,
    unit_cost numeric(14,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.goods_receipt_items OWNER TO postgres;

--
-- Name: goods_receipts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.goods_receipts (
    id text NOT NULL,
    purchase_order_id text NOT NULL,
    received_by text DEFAULT ''::text NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    total numeric(14,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.goods_receipts OWNER TO postgres;

--
-- Name: ingredient_defaults; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ingredient_defaults (
    id text NOT NULL,
    name text NOT NULL,
    sku text NOT NULL,
    category text DEFAULT ''::text NOT NULL,
    unit text NOT NULL,
    default_unit_cost numeric(14,2) DEFAULT 0 NOT NULL,
    min_stock numeric(14,3) DEFAULT 0 NOT NULL
);


ALTER TABLE public.ingredient_defaults OWNER TO postgres;

--
-- Name: inquiries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inquiries (
    id text NOT NULL,
    customer_id text NOT NULL,
    channel text NOT NULL,
    staff_member text,
    subject text DEFAULT ''::text NOT NULL,
    summary text DEFAULT ''::text NOT NULL,
    details text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'NEW'::text NOT NULL,
    priority text DEFAULT 'MEDIUM'::text NOT NULL,
    related_quote_id text,
    related_order_id text,
    follow_up_required boolean DEFAULT false NOT NULL,
    next_action text,
    resolved_at timestamp with time zone,
    source text DEFAULT 'WALK_IN'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.inquiries OWNER TO postgres;

--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_items (
    id text NOT NULL,
    name text NOT NULL,
    sku text NOT NULL,
    category text DEFAULT ''::text NOT NULL,
    unit text NOT NULL,
    reorder_level numeric(14,3) DEFAULT 0 NOT NULL,
    supplier_id text,
    last_updated timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cost numeric(14,2) DEFAULT 0 NOT NULL
);


ALTER TABLE public.inventory_items OWNER TO postgres;

--
-- Name: inventory_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.inventory_transactions (
    id text NOT NULL,
    item_id text NOT NULL,
    quantity numeric(14,3) NOT NULL,
    unit text NOT NULL,
    type text NOT NULL,
    reference text DEFAULT ''::text NOT NULL,
    tx_user text DEFAULT ''::text NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    unit_cost numeric(14,2),
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.inventory_transactions OWNER TO postgres;

--
-- Name: invoice_lines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoice_lines (
    id bigint NOT NULL,
    invoice_id text NOT NULL,
    description text NOT NULL,
    quantity numeric(14,3) NOT NULL,
    unit_price numeric(14,0) NOT NULL,
    total numeric(14,0) NOT NULL
);


ALTER TABLE public.invoice_lines OWNER TO postgres;

--
-- Name: invoice_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.invoice_lines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invoice_lines_id_seq OWNER TO postgres;

--
-- Name: invoice_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.invoice_lines_id_seq OWNED BY public.invoice_lines.id;


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.invoices (
    id text NOT NULL,
    invoice_no text,
    order_id text NOT NULL,
    customer_id text NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    issue_date date,
    due_date date,
    currency text DEFAULT 'UGX'::text NOT NULL,
    subtotal numeric(14,0) DEFAULT 0 NOT NULL,
    tax_rate numeric(5,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(14,0) DEFAULT 0 NOT NULL,
    delivery_charge numeric(14,0) DEFAULT 0 NOT NULL,
    discount numeric(14,0) DEFAULT 0 NOT NULL,
    total numeric(14,0) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invoices_status_check CHECK ((status = ANY (ARRAY['DRAFT'::text, 'ISSUED'::text, 'PART_PAID'::text, 'PAID'::text, 'VOID'::text])))
);


ALTER TABLE public.invoices OWNER TO postgres;

--
-- Name: journal_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.journal_entries (
    id bigint NOT NULL,
    entry_date date NOT NULL,
    period text NOT NULL,
    source_event_id bigint,
    source_type text NOT NULL,
    source_id text NOT NULL,
    memo text DEFAULT ''::text NOT NULL,
    reverses_entry_id bigint,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    backfilled boolean DEFAULT false NOT NULL
);


ALTER TABLE public.journal_entries OWNER TO postgres;

--
-- Name: journal_entries_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.journal_entries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.journal_entries_id_seq OWNER TO postgres;

--
-- Name: journal_entries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.journal_entries_id_seq OWNED BY public.journal_entries.id;


--
-- Name: journal_lines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.journal_lines (
    id bigint NOT NULL,
    entry_id bigint NOT NULL,
    account_code text NOT NULL,
    debit numeric(14,0) DEFAULT 0 NOT NULL,
    credit numeric(14,0) DEFAULT 0 NOT NULL,
    order_id text,
    customer_id text,
    job_id text,
    supplier_id text,
    CONSTRAINT journal_lines_check CHECK (((debit = (0)::numeric) <> (credit = (0)::numeric))),
    CONSTRAINT journal_lines_credit_check CHECK ((credit >= (0)::numeric)),
    CONSTRAINT journal_lines_debit_check CHECK ((debit >= (0)::numeric))
);


ALTER TABLE public.journal_lines OWNER TO postgres;

--
-- Name: journal_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.journal_lines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.journal_lines_id_seq OWNER TO postgres;

--
-- Name: journal_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.journal_lines_id_seq OWNED BY public.journal_lines.id;


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_preferences (
    id text NOT NULL,
    user_id text NOT NULL,
    event_type_id text NOT NULL,
    channel text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notification_preferences OWNER TO postgres;

--
-- Name: notification_recipients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_recipients (
    id text NOT NULL,
    notification_id text NOT NULL,
    user_id text NOT NULL,
    delivery_channel text DEFAULT 'IN_APP'::text NOT NULL,
    delivered_at timestamp with time zone,
    read_at timestamp with time zone,
    failed_at timestamp with time zone,
    failure_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notification_recipients OWNER TO postgres;

--
-- Name: notification_templates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notification_templates (
    id text NOT NULL,
    event_type_id text NOT NULL,
    channel text NOT NULL,
    title_template text NOT NULL,
    message_template text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notification_templates OWNER TO postgres;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.notifications (
    id text NOT NULL,
    event_type_id text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    priority text DEFAULT 'MEDIUM'::text NOT NULL,
    entity_type text DEFAULT ''::text NOT NULL,
    entity_id text DEFAULT ''::text NOT NULL,
    action_url text,
    deep_link text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text,
    read_at timestamp with time zone,
    delivery_status text DEFAULT 'PENDING'::text NOT NULL,
    failure_reason text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.notifications OWNER TO postgres;

--
-- Name: option_definitions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.option_definitions (
    id text NOT NULL,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    name text NOT NULL,
    is_mandatory boolean DEFAULT false NOT NULL,
    display_order integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.option_definitions OWNER TO postgres;

--
-- Name: option_values; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.option_values (
    id text NOT NULL,
    option_def_id text NOT NULL,
    label text NOT NULL
);


ALTER TABLE public.option_values OWNER TO postgres;

--
-- Name: order_customer_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_customer_snapshots (
    id text NOT NULL,
    order_id text NOT NULL,
    customer_id text NOT NULL,
    snapshot_name text NOT NULL,
    snapshot_phone text DEFAULT ''::text NOT NULL,
    snapshot_email text DEFAULT ''::text NOT NULL,
    snapshot_address text DEFAULT ''::text NOT NULL,
    snapshot_preferred_contact text DEFAULT ''::text NOT NULL,
    captured_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.order_customer_snapshots OWNER TO postgres;

--
-- Name: order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_items (
    id text NOT NULL,
    order_id text NOT NULL,
    product_id text NOT NULL,
    variant_options text DEFAULT ''::text NOT NULL,
    quantity numeric(14,3) NOT NULL,
    unit_price numeric(14,2) DEFAULT 0 NOT NULL,
    discount numeric(14,2) DEFAULT 0 NOT NULL,
    total numeric(14,2) DEFAULT 0 NOT NULL,
    recipe_version text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.order_items OWNER TO postgres;

--
-- Name: order_proposal_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_proposal_items (
    id text NOT NULL,
    proposal_id text NOT NULL,
    product_id text DEFAULT ''::text NOT NULL,
    product_name text DEFAULT ''::text NOT NULL,
    variant_options text DEFAULT ''::text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    unit_price numeric(14,2) DEFAULT 0 NOT NULL,
    total numeric(14,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.order_proposal_items OWNER TO postgres;

--
-- Name: order_proposals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_proposals (
    id text NOT NULL,
    proposal_number text DEFAULT ''::text NOT NULL,
    customer_name text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    product_summary text DEFAULT ''::text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    preferred_date date,
    preferred_time text DEFAULT ''::text NOT NULL,
    delivery_type text DEFAULT 'PICKUP'::text NOT NULL,
    delivery_location text DEFAULT ''::text NOT NULL,
    customer_notes text DEFAULT ''::text NOT NULL,
    reference_image text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'PENDING_REVIEW'::text NOT NULL,
    customer_id text,
    inquiry_id text,
    order_id text,
    reviewed_by text,
    reviewed_at timestamp with time zone,
    review_notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.order_proposals OWNER TO postgres;

--
-- Name: order_status_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.order_status_history (
    id text NOT NULL,
    order_id text NOT NULL,
    previous_status text NOT NULL,
    new_status text NOT NULL,
    changed_by text DEFAULT ''::text NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.order_status_history OWNER TO postgres;

--
-- Name: orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.orders (
    id text NOT NULL,
    order_number text NOT NULL,
    customer_id text NOT NULL,
    salesperson_id text,
    subtotal numeric(14,2) DEFAULT 0 NOT NULL,
    discount numeric(14,2) DEFAULT 0 NOT NULL,
    delivery_charge numeric(14,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(14,2) DEFAULT 0 NOT NULL,
    total numeric(14,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'UGX'::text NOT NULL,
    required_by text,
    required_at timestamp with time zone,
    notes text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'INQUIRY'::text NOT NULL,
    payment_status text DEFAULT 'UNPAID'::text NOT NULL,
    delivery_status text DEFAULT 'PENDING'::text NOT NULL,
    quotation_id text,
    inquiry_id text,
    created_by text DEFAULT ''::text NOT NULL,
    delivered_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    follow_up_completed_at timestamp with time zone,
    delivery_location text DEFAULT ''::text NOT NULL,
    location_note text DEFAULT ''::text NOT NULL
);


ALTER TABLE public.orders OWNER TO postgres;

--
-- Name: payment_allocations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payment_allocations (
    id bigint NOT NULL,
    payment_id text NOT NULL,
    invoice_id text NOT NULL,
    amount numeric(14,0) NOT NULL
);


ALTER TABLE public.payment_allocations OWNER TO postgres;

--
-- Name: payment_allocations_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.payment_allocations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_allocations_id_seq OWNER TO postgres;

--
-- Name: payment_allocations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.payment_allocations_id_seq OWNED BY public.payment_allocations.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payments (
    id text NOT NULL,
    order_id text NOT NULL,
    amount numeric(14,2) NOT NULL,
    method text NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    reference text DEFAULT ''::text NOT NULL,
    received_by text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    kind text DEFAULT 'PAYMENT'::text NOT NULL,
    status text DEFAULT 'CONFIRMED'::text NOT NULL,
    reverses_payment_id text,
    reason text DEFAULT ''::text NOT NULL,
    approved_by text,
    idempotency_key text,
    provider text,
    provider_ref text,
    delivery_id text,
    collected_by text,
    cash_handover_id text,
    invoice_id text,
    CONSTRAINT payments_kind_check CHECK ((kind = ANY (ARRAY['PAYMENT'::text, 'REFUND'::text, 'REVERSAL'::text]))),
    CONSTRAINT payments_kind_chk CHECK ((kind = ANY (ARRAY['PAYMENT'::text, 'REFUND'::text, 'REVERSAL'::text]))),
    CONSTRAINT payments_sign_chk CHECK ((((kind = 'PAYMENT'::text) AND (amount > (0)::numeric)) OR ((kind = ANY (ARRAY['REFUND'::text, 'REVERSAL'::text])) AND (amount < (0)::numeric)))),
    CONSTRAINT payments_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'CONFIRMED'::text, 'FAILED'::text]))),
    CONSTRAINT payments_status_chk CHECK ((status = ANY (ARRAY['PENDING'::text, 'CONFIRMED'::text, 'FAILED'::text])))
);


ALTER TABLE public.payments OWNER TO postgres;

--
-- Name: payslips; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.payslips (
    id text NOT NULL,
    period_id text NOT NULL,
    staff_id text NOT NULL,
    item_id text,
    period_label text DEFAULT ''::text NOT NULL,
    staff_name text DEFAULT ''::text NOT NULL,
    basic_salary numeric(14,2) DEFAULT 0 NOT NULL,
    allowances numeric(14,2) DEFAULT 0 NOT NULL,
    bonuses numeric(14,2) DEFAULT 0 NOT NULL,
    deductions numeric(14,2) DEFAULT 0 NOT NULL,
    advance_amount numeric(14,2) DEFAULT 0 NOT NULL,
    other_payments numeric(14,2) DEFAULT 0 NOT NULL,
    net_amount numeric(14,2) DEFAULT 0 NOT NULL,
    paid_amount numeric(14,2) DEFAULT 0 NOT NULL,
    issued_at timestamp with time zone,
    issued_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.payslips OWNER TO postgres;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.permissions (
    id text NOT NULL,
    key text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.permissions OWNER TO postgres;

--
-- Name: product_types; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_types (
    id text NOT NULL,
    category_id text NOT NULL,
    name text NOT NULL,
    code text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    catalogue_visible boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.product_types OWNER TO postgres;

--
-- Name: product_variants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.product_variants (
    id text NOT NULL,
    product_id text NOT NULL,
    name text NOT NULL,
    type text DEFAULT ''::text NOT NULL,
    default_value text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.product_variants OWNER TO postgres;

--
-- Name: production_consumption; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.production_consumption (
    id text NOT NULL,
    job_id text NOT NULL,
    item_id text NOT NULL,
    quantity numeric(14,3) NOT NULL,
    unit text NOT NULL,
    recipe_version text DEFAULT 'v1.0'::text NOT NULL,
    unit_cost numeric(14,2) DEFAULT 0 NOT NULL,
    actual_cost numeric(14,2) DEFAULT 0 NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.production_consumption OWNER TO postgres;

--
-- Name: production_costs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.production_costs (
    id text NOT NULL,
    job_id text NOT NULL,
    ingredient_cost numeric(14,2) DEFAULT 0 NOT NULL,
    packaging_cost numeric(14,2) DEFAULT 0 NOT NULL,
    labour_cost numeric(14,2) DEFAULT 0 NOT NULL,
    overhead_cost numeric(14,2) DEFAULT 0 NOT NULL,
    total numeric(14,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'PLANNED'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.production_costs OWNER TO postgres;

--
-- Name: production_fixed_cost_categories; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.production_fixed_cost_categories (
    id text NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    cost_type text DEFAULT 'perJob'::text NOT NULL,
    unit text DEFAULT ''::text NOT NULL,
    default_unit_cost numeric(14,2) DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.production_fixed_cost_categories OWNER TO postgres;

--
-- Name: production_fixed_cost_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.production_fixed_cost_entries (
    id text NOT NULL,
    job_id text NOT NULL,
    category_id text NOT NULL,
    quantity numeric(14,3) DEFAULT 1 NOT NULL,
    unit text DEFAULT ''::text NOT NULL,
    unit_cost numeric(14,2) DEFAULT 0 NOT NULL,
    total numeric(14,2) DEFAULT 0 NOT NULL,
    recorded_by text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.production_fixed_cost_entries OWNER TO postgres;

--
-- Name: production_jobs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.production_jobs (
    id text NOT NULL,
    order_id text NOT NULL,
    customer_id text NOT NULL,
    product_id text NOT NULL,
    variant_options text DEFAULT ''::text NOT NULL,
    quantity numeric(14,3) NOT NULL,
    recipe_version text DEFAULT 'v1.0'::text NOT NULL,
    required_by text,
    required_at timestamp with time zone,
    status text DEFAULT 'PENDING'::text NOT NULL,
    stage text DEFAULT 'PLAN'::text NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.production_jobs OWNER TO postgres;

--
-- Name: production_steps; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.production_steps (
    id text NOT NULL,
    job_id text NOT NULL,
    name text NOT NULL,
    step_order integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.production_steps OWNER TO postgres;

--
-- Name: production_wastage; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.production_wastage (
    id text NOT NULL,
    job_id text NOT NULL,
    item_id text NOT NULL,
    quantity numeric(14,3) NOT NULL,
    unit text NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    cost numeric(14,2) DEFAULT 0 NOT NULL,
    recorded_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.production_wastage OWNER TO postgres;

--
-- Name: products; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.products (
    id text NOT NULL,
    sku text NOT NULL,
    category_id text,
    product_type_id text,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    base_price numeric(14,2) DEFAULT 0 NOT NULL,
    currency text DEFAULT 'UGX'::text NOT NULL,
    cost_reference text DEFAULT ''::text NOT NULL,
    catalogue_visible boolean DEFAULT true NOT NULL,
    production_enabled boolean DEFAULT true NOT NULL,
    image text DEFAULT ''::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.products OWNER TO postgres;

--
-- Name: provider_statement_lines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.provider_statement_lines (
    id bigint NOT NULL,
    provider text NOT NULL,
    provider_ref text NOT NULL,
    amount numeric(14,0) NOT NULL,
    occurred_at timestamp with time zone NOT NULL,
    payment_id text,
    match_status text DEFAULT 'UNMATCHED'::text NOT NULL
);


ALTER TABLE public.provider_statement_lines OWNER TO postgres;

--
-- Name: provider_statement_lines_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.provider_statement_lines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.provider_statement_lines_id_seq OWNER TO postgres;

--
-- Name: provider_statement_lines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.provider_statement_lines_id_seq OWNED BY public.provider_statement_lines.id;


--
-- Name: purchase_order_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_order_items (
    id text NOT NULL,
    purchase_order_id text NOT NULL,
    product_id text NOT NULL,
    supplier_id text NOT NULL,
    quantity numeric(14,3) NOT NULL,
    unit text NOT NULL,
    unit_price numeric(14,2) DEFAULT 0 NOT NULL,
    total numeric(14,2) DEFAULT 0 NOT NULL,
    received_quantity numeric(14,3) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.purchase_order_items OWNER TO postgres;

--
-- Name: purchase_orders; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_orders (
    id text NOT NULL,
    po_number text NOT NULL,
    supplier_id text NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    expected_date date,
    total numeric(14,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.purchase_orders OWNER TO postgres;

--
-- Name: purchase_requirements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.purchase_requirements (
    id text NOT NULL,
    product_ids text DEFAULT ''::text NOT NULL,
    quantity numeric(14,3) NOT NULL,
    unit text NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    urgency text DEFAULT 'MEDIUM'::text NOT NULL,
    status text DEFAULT 'OPEN'::text NOT NULL,
    requested_by text DEFAULT ''::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.purchase_requirements OWNER TO postgres;

--
-- Name: quality_checks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quality_checks (
    id text NOT NULL,
    job_id text NOT NULL,
    result text NOT NULL,
    checked_by text DEFAULT ''::text NOT NULL,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    issues text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    rework_required boolean DEFAULT false NOT NULL,
    rework_cost numeric(14,2) DEFAULT 0 NOT NULL,
    wastage_caused numeric(14,3) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.quality_checks OWNER TO postgres;

--
-- Name: quotation_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quotation_items (
    id text NOT NULL,
    quotation_id text NOT NULL,
    product_id text NOT NULL,
    variant_options text DEFAULT ''::text NOT NULL,
    quantity numeric(14,3) NOT NULL,
    unit_price numeric(14,2) DEFAULT 0 NOT NULL,
    discount numeric(14,2) DEFAULT 0 NOT NULL,
    total numeric(14,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.quotation_items OWNER TO postgres;

--
-- Name: quotations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.quotations (
    id text NOT NULL,
    quotation_number text NOT NULL,
    customer_id text NOT NULL,
    salesperson_id text,
    notes text DEFAULT ''::text NOT NULL,
    validity_expiry timestamp with time zone,
    status text DEFAULT 'DRAFT'::text NOT NULL,
    tax_amount numeric(14,2) DEFAULT 0 NOT NULL,
    total numeric(14,2) DEFAULT 0 NOT NULL,
    unit_total numeric(14,2) DEFAULT 0 NOT NULL,
    submitted_at timestamp with time zone,
    accepted_at timestamp with time zone,
    created_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.quotations OWNER TO postgres;

--
-- Name: recipe_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recipe_items (
    id text DEFAULT (gen_random_uuid())::text NOT NULL,
    recipe_version_id text NOT NULL,
    ingredient_id text NOT NULL,
    ingredient_name text NOT NULL,
    quantity numeric(14,3) NOT NULL,
    unit text NOT NULL,
    expected_waste numeric(14,3) DEFAULT 0 NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    item_order integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.recipe_items OWNER TO postgres;

--
-- Name: recipe_versions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recipe_versions (
    id text NOT NULL,
    recipe_id text NOT NULL,
    version text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    effective_date date DEFAULT CURRENT_DATE NOT NULL,
    total_estimated_cost numeric(14,2) DEFAULT 0 NOT NULL,
    wastage_percent numeric(5,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.recipe_versions OWNER TO postgres;

--
-- Name: recipes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.recipes (
    id text NOT NULL,
    product_id text NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.recipes OWNER TO postgres;

--
-- Name: remuneration_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.remuneration_items (
    id text NOT NULL,
    period_id text NOT NULL,
    staff_id text NOT NULL,
    basic_salary numeric(14,2) DEFAULT 0 NOT NULL,
    allowances numeric(14,2) DEFAULT 0 NOT NULL,
    bonuses numeric(14,2) DEFAULT 0 NOT NULL,
    deductions numeric(14,2) DEFAULT 0 NOT NULL,
    advance_amount numeric(14,2) DEFAULT 0 NOT NULL,
    other_payments numeric(14,2) DEFAULT 0 NOT NULL,
    net_amount numeric(14,2) DEFAULT 0 NOT NULL,
    paid_amount numeric(14,2) DEFAULT 0 NOT NULL,
    status text DEFAULT 'PENDING'::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT remuneration_items_status_check CHECK ((status = ANY (ARRAY['PENDING'::text, 'APPROVED'::text, 'PAID'::text, 'PARTIALLY_PAID'::text, 'ADJUSTED'::text])))
);


ALTER TABLE public.remuneration_items OWNER TO postgres;

--
-- Name: remuneration_payments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.remuneration_payments (
    id text NOT NULL,
    period_id text NOT NULL,
    staff_id text NOT NULL,
    item_id text,
    amount numeric(14,2) DEFAULT 0 NOT NULL,
    payment_date date NOT NULL,
    method text DEFAULT 'CASH'::text NOT NULL,
    reference text DEFAULT ''::text NOT NULL,
    payment_status text DEFAULT 'RECORDED'::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    recorded_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT remuneration_payments_method_check CHECK ((method = ANY (ARRAY['CASH'::text, 'MOBILE_MONEY'::text, 'BANK_TRANSFER'::text, 'OTHER'::text]))),
    CONSTRAINT remuneration_payments_payment_status_check CHECK ((payment_status = ANY (ARRAY['RECORDED'::text, 'PENDING'::text, 'PAID'::text, 'CANCELLED'::text])))
);


ALTER TABLE public.remuneration_payments OWNER TO postgres;

--
-- Name: remuneration_periods; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.remuneration_periods (
    id text NOT NULL,
    label text DEFAULT ''::text NOT NULL,
    period_type text DEFAULT 'monthly'::text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    intended_payment_date date,
    status text DEFAULT 'OPEN'::text NOT NULL,
    total_amount numeric(14,2) DEFAULT 0 NOT NULL,
    paid_amount numeric(14,2) DEFAULT 0 NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_by text DEFAULT ''::text NOT NULL,
    approved_by text,
    approved_at timestamp with time zone,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT remuneration_periods_period_type_check CHECK ((period_type = ANY (ARRAY['weekly'::text, 'biweekly'::text, 'monthly'::text, 'quarterly'::text, 'custom'::text]))),
    CONSTRAINT remuneration_periods_status_check CHECK ((status = ANY (ARRAY['OPEN'::text, 'PROCESSING'::text, 'APPROVED'::text, 'PARTIALLY_PAID'::text, 'PAID'::text, 'CLOSED'::text])))
);


ALTER TABLE public.remuneration_periods OWNER TO postgres;

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    id text NOT NULL,
    role_id text NOT NULL,
    permission_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.roles (
    id text NOT NULL,
    name text NOT NULL,
    label text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.roles OWNER TO postgres;

--
-- Name: salary_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.salary_profiles (
    id text NOT NULL,
    staff_id text NOT NULL,
    basic_salary numeric(14,2) DEFAULT 0 NOT NULL,
    payment_frequency text DEFAULT 'monthly'::text NOT NULL,
    allowance_amount numeric(14,2) DEFAULT 0 NOT NULL,
    deduction_amount numeric(14,2) DEFAULT 0 NOT NULL,
    effective_from date,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT salary_profiles_payment_frequency_check CHECK ((payment_frequency = ANY (ARRAY['weekly'::text, 'biweekly'::text, 'monthly'::text, 'quarterly'::text, 'custom'::text])))
);


ALTER TABLE public.salary_profiles OWNER TO postgres;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    id text NOT NULL,
    user_id text NOT NULL,
    token_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    revoked_at timestamp with time zone,
    ip text,
    user_agent text
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: staff; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff (
    id text NOT NULL,
    staff_number text DEFAULT ''::text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    job_title text DEFAULT ''::text NOT NULL,
    employment_status text DEFAULT 'ACTIVE'::text NOT NULL,
    start_date date,
    schedule text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    user_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staff_employment_status_check CHECK ((employment_status = ANY (ARRAY['ACTIVE'::text, 'PROBATION'::text, 'ON_LEAVE'::text, 'INACTIVE'::text, 'TERMINATED'::text])))
);


ALTER TABLE public.staff OWNER TO postgres;

--
-- Name: staff_advances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_advances (
    id text NOT NULL,
    staff_id text NOT NULL,
    amount numeric(14,2) DEFAULT 0 NOT NULL,
    repaid_amount numeric(14,2) DEFAULT 0 NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    advance_date date,
    status text DEFAULT 'OUTSTANDING'::text NOT NULL,
    repayment_log jsonb DEFAULT '[]'::jsonb NOT NULL,
    recorded_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staff_advances_status_check CHECK ((status = ANY (ARRAY['OUTSTANDING'::text, 'SETTLED'::text])))
);


ALTER TABLE public.staff_advances OWNER TO postgres;

--
-- Name: staff_attendance; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.staff_attendance (
    id text NOT NULL,
    staff_id text NOT NULL,
    date date NOT NULL,
    status text DEFAULT 'PRESENT'::text NOT NULL,
    hours numeric(5,2) DEFAULT 0 NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    recorded_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT staff_attendance_status_check CHECK ((status = ANY (ARRAY['PRESENT'::text, 'ABSENT'::text, 'HALF_DAY'::text, 'LEAVE'::text, 'SICK'::text, 'LATE'::text])))
);


ALTER TABLE public.staff_attendance OWNER TO postgres;

--
-- Name: stock_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_locations (
    id text NOT NULL,
    name text NOT NULL,
    location text DEFAULT ''::text NOT NULL,
    unit text DEFAULT ''::text NOT NULL,
    reorder_level numeric(14,3) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.stock_locations OWNER TO postgres;

--
-- Name: stock_reservations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.stock_reservations (
    id text NOT NULL,
    item_id text NOT NULL,
    quantity numeric(14,3) NOT NULL,
    unit text NOT NULL,
    order_id text,
    reference text,
    reserved_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.stock_reservations OWNER TO postgres;

--
-- Name: supplier_price_history; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.supplier_price_history (
    id text NOT NULL,
    supplier_id text NOT NULL,
    product_id text NOT NULL,
    unit text NOT NULL,
    price numeric(14,2) NOT NULL,
    effective_date date DEFAULT CURRENT_DATE NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.supplier_price_history OWNER TO postgres;

--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.suppliers (
    id text NOT NULL,
    business_name text NOT NULL,
    contact_person text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    address text DEFAULT ''::text NOT NULL,
    products_supplied text DEFAULT ''::text NOT NULL,
    payment_terms text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.suppliers OWNER TO postgres;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_roles (
    id text NOT NULL,
    user_id text NOT NULL,
    role_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_roles OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id text NOT NULL,
    username text NOT NULL,
    display_name text NOT NULL,
    email text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    role text NOT NULL,
    is_admin boolean DEFAULT false NOT NULL,
    status text DEFAULT 'Active'::text NOT NULL,
    password_hash text,
    notify jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: website_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.website_users (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    password_hash text DEFAULT ''::text NOT NULL,
    role text DEFAULT 'CUSTOMER'::text NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    customer_id text,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.website_users OWNER TO postgres;

--
-- Name: _migrations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._migrations ALTER COLUMN id SET DEFAULT nextval('public._migrations_id_seq'::regclass);


--
-- Name: invoice_lines id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_lines ALTER COLUMN id SET DEFAULT nextval('public.invoice_lines_id_seq'::regclass);


--
-- Name: journal_entries id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entries ALTER COLUMN id SET DEFAULT nextval('public.journal_entries_id_seq'::regclass);


--
-- Name: journal_lines id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_lines ALTER COLUMN id SET DEFAULT nextval('public.journal_lines_id_seq'::regclass);


--
-- Name: payment_allocations id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_allocations ALTER COLUMN id SET DEFAULT nextval('public.payment_allocations_id_seq'::regclass);


--
-- Name: provider_statement_lines id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_statement_lines ALTER COLUMN id SET DEFAULT nextval('public.provider_statement_lines_id_seq'::regclass);


--
-- Data for Name: _migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._migrations (id, name, applied_at) FROM stdin;
1	001_core.sql	2026-10-31 17:06:43.474332+03
2	002_catalogue.sql	2026-10-31 17:06:44.323831+03
3	003_sales.sql	2026-10-31 17:06:44.418079+03
4	004_production.sql	2026-10-31 17:06:44.497807+03
5	005_inventory_purchasing.sql	2026-10-31 17:06:44.560078+03
6	006_finance_delivery.sql	2026-10-31 17:06:44.669256+03
7	007_delivery_actual_date.sql	2026-10-31 17:06:44.775419+03
8	008_order_history.sql	2026-10-31 17:06:44.780678+03
9	009_content.sql	2026-10-31 17:06:44.83059+03
10	010_inventory_cost.sql	2026-10-31 17:06:44.880128+03
11	011_order_follow_up.sql	2026-10-31 17:06:44.885928+03
12	012_missing_permissions.sql	2026-10-31 17:09:19.74191+03
13	013_production_consumption.sql	2026-10-31 17:09:19.75848+03
14	014_role_permissions.sql	2026-10-31 17:10:22.933777+03
15	015_missing_route_permissions.sql	2026-10-31 17:11:50.43031+03
16	016_public_order_proposals.sql	2026-10-31 17:12:25.069706+03
17	017_staff_remuneration.sql	2026-10-31 17:12:25.310347+03
18	018_activation_codes.sql	2026-10-31 17:12:25.454716+03
19	019_inventory_adjust_to_role_admin.sql	2026-10-31 17:12:25.476138+03
20	020_production_fixed_costs.sql	2026-10-31 17:12:25.481375+03
21	020_users_email_empty_placeholder.sql	2026-10-31 17:12:25.509726+03
22	021_order_delivery_location.sql	2026-10-31 17:12:25.529077+03
23	022_sessions.sql	2026-11-01 21:56:02.378466+03
24	023_permissions_action_split.sql	2026-11-03 05:53:29.787051+03
25	032_payments_append_only.sql	2026-11-03 05:53:29.88223+03
26	033_ledger_invoices.sql	2026-11-03 05:53:29.909518+03
27	034_finance_permissions.sql	2026-11-03 05:58:12.206329+03
\.


--
-- Data for Name: accounting_periods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.accounting_periods (period, status, closed_by, closed_at) FROM stdin;
2026-11	OPEN	\N	\N
\.


--
-- Data for Name: accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.accounts (code, name, type, active) FROM stdin;
1010	Cash on hand	ASSET	t
1015	Cash with drivers	ASSET	t
1020	Mobile money	ASSET	t
1030	Bank	ASSET	t
1100	Accounts receivable	ASSET	t
1200	Inventory	ASSET	t
2010	Customer deposits	LIABILITY	t
2100	Accounts payable	LIABILITY	t
2110	Goods received not invoiced	LIABILITY	t
2200	VAT payable	LIABILITY	t
2300	Wages payable	LIABILITY	t
3000	Owner equity	EQUITY	t
4000	Sales revenue	REVENUE	t
4100	Delivery income	REVENUE	t
4900	Forfeited deposits	REVENUE	t
5000	COGS ingredients	COGS	t
5010	COGS packaging	COGS	t
5020	COGS labour	COGS	t
5030	COGS overhead	COGS	t
5100	Wastage expense	EXPENSE	t
5110	Inventory shrinkage	EXPENSE	t
6000	Operating expenses	EXPENSE	t
6100	Payroll expense	EXPENSE	t
6900	Cash over/short	EXPENSE	t
\.


--
-- Data for Name: activation_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activation_codes (id, code, type, user_id, created_at, expires_at, used_at, used_by) FROM stdin;
27f2ed7a-205d-4c60-9256-83f790137a4b	c5f6c0bccfb0f105ac6a9b8048e0bb8f9db6b21b005116ec2708a8fa013064b3	admin	\N	2026-11-12 21:15:57.393254+03	2026-11-19 21:15:57.393254+03	\N	\N
\.


--
-- Data for Name: approvals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.approvals (id, kind, payload, requested_by, decided_by, status, reason, created_at, decided_at) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, order_id, actor, action, entity_type, entity_id, previous_status, new_status, reason, "timestamp", created_at, updated_at) FROM stdin;
audit-wipe-1794507357399	\N	system	wipe_production	system	production			Production wipe executed	2026-11-12 21:15:57.400423+03	2026-11-12 21:15:57.400423+03	2026-11-12 21:15:57.400423+03
\.


--
-- Data for Name: blog_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.blog_categories (id, name, slug, description, display_order, active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: blog_posts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.blog_posts (id, category_id, title, slug, excerpt, body, cover_image, author, status, published_at, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cash_handovers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cash_handovers (id, driver_id, expected, counted, confirmed_by, confirmed_at, note) FROM stdin;
\.


--
-- Data for Name: catalogue_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.catalogue_categories (id, name, code, description, image, display_order, active, catalogue_visible, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: credit_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.credit_notes (id, credit_no, invoice_id, amount, reason, approved_by, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: customer_addresses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_addresses (id, customer_id, label, line1, line2, city, county, postal_code, country, is_default, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customer_event_reminders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_event_reminders (id, event_id, customer_id, order_id, event_type, reminder_for_date, next_reminder_at, status, last_contacted_at, contacted_by, outcome, follow_up_notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customer_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_events (id, customer_id, order_id, event_type, event_date, recurrence_rule, notes, status, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customer_feedback; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_feedback (id, customer_id, order_id, product_ids, rating, type, comment, resolution, follow_up_required, follow_up_completed, recorded_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customer_interactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_interactions (id, customer_id, channel, staff_member, date_time, subject, summary, outcome, follow_up_required, related_inquiry_id, related_order_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customers (id, name, phone, email, preferred_contact_method, source, notes, status, first_order_date, last_order_date, total_orders, total_spend, feedback_summary, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: deliveries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deliveries (id, order_id, type, destination, scheduled_at, scheduled_date, scheduled_time, actual_dispatch_time, delivery_person, delivery_fee, status, notes, customer_confirmation, created_at, updated_at, actual_delivery_date) FROM stdin;
\.


--
-- Data for Name: document_counters; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.document_counters (kind, year, last_no) FROM stdin;
INV	2026	9
\.


--
-- Data for Name: expense_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.expense_categories (id, name, created_at, updated_at) FROM stdin;
exp-util	Utilities	2026-10-31 17:08:48.359+03	2026-10-31 17:08:48.359+03
cat-mvwyhoou-4pw1i	Production costs	2026-11-01 01:11:52.254+03	2026-11-01 01:11:52.254+03
exp-ing	Ingredients	2026-10-31 17:08:48.359+03	2026-10-31 17:08:48.359+03
exp-pack	Packaging	2026-10-31 17:08:48.359+03	2026-10-31 17:08:48.359+03
\.


--
-- Data for Name: expenses; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.expenses (id, category_id, amount, date, payment_method, reference, description, attachment, recorded_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: goods_receipt_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.goods_receipt_items (id, goods_receipt_id, po_item_id, quantity, unit, unit_cost, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: goods_receipts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.goods_receipts (id, purchase_order_id, received_by, date, total, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: ingredient_defaults; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ingredient_defaults (id, name, sku, category, unit, default_unit_cost, min_stock) FROM stdin;
\.


--
-- Data for Name: inquiries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inquiries (id, customer_id, channel, staff_member, subject, summary, details, status, priority, related_quote_id, related_order_id, follow_up_required, next_action, resolved_at, source, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: inventory_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_items (id, name, sku, category, unit, reorder_level, supplier_id, last_updated, created_at, updated_at, cost) FROM stdin;
\.


--
-- Data for Name: inventory_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_transactions (id, item_id, quantity, unit, type, reference, tx_user, "timestamp", unit_cost, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: invoice_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoice_lines (id, invoice_id, description, quantity, unit_price, total) FROM stdin;
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.invoices (id, invoice_no, order_id, customer_id, status, issue_date, due_date, currency, subtotal, tax_rate, tax_amount, delivery_charge, discount, total, created_at) FROM stdin;
\.


--
-- Data for Name: journal_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.journal_entries (id, entry_date, period, source_event_id, source_type, source_id, memo, reverses_entry_id, created_by, created_at, backfilled) FROM stdin;
1	2026-11-08	2026-11	\N	payment.recorded	pay-1794176990338-2qfwt2sm	Payment pay-1794176990338-2qfwt2sm for order order-1794176085374-1432	\N	\N	2026-11-09 01:29:50.308378+03	f
2	2026-11-08	2026-11	\N	payment.recorded	pay-1794177580999-x9fx4hrn	Payment pay-1794177580999-x9fx4hrn for order order-1794177563911-cdf3	\N	\N	2026-11-09 01:39:40.964365+03	f
3	2026-11-08	2026-11	\N	payment.recorded	pay-1794178834336-77agkffn	Payment pay-1794178834336-77agkffn for order order-1794176085374-1432	\N	\N	2026-11-09 02:00:34.300387+03	f
4	2026-11-08	2026-11	\N	payment.recorded	pay-1794178835325-a8buk7jc	Payment pay-1794178835325-a8buk7jc for order order-1794176085374-1432	\N	\N	2026-11-09 02:00:35.309536+03	f
5	2026-11-08	2026-11	\N	payment.recorded	pay-1794179073130-slh0lm13	Payment pay-1794179073130-slh0lm13 for order order-1794177563911-cdf3	\N	\N	2026-11-09 02:04:33.1148+03	f
6	2026-11-09	2026-11	\N	payment.recorded	pay-1794195299692-0cyym1pr	Payment pay-1794195299692-0cyym1pr for order order-1794195269669-6125	\N	\N	2026-11-09 06:34:59.666925+03	f
7	2026-11-09	2026-11	\N	payment.recorded	pay-1794195305672-u4c5mthz	Payment pay-1794195305672-u4c5mthz for order order-1794195269669-6125	\N	\N	2026-11-09 06:35:05.657151+03	f
8	2026-11-09	2026-11	\N	payment.recorded	pay-1794195357016-n8uex2rn	Payment pay-1794195357016-n8uex2rn for order order-1794195269669-6125	\N	\N	2026-11-09 06:35:56.996121+03	f
9	2026-11-09	2026-11	\N	payment.recorded	pay-1794195375204-h338xxmp	Payment pay-1794195375204-h338xxmp for order order-1794195269669-6125	\N	\N	2026-11-09 06:36:15.183226+03	f
10	2026-11-09	2026-11	\N	payment.recorded	pay-1794195788023-6zbsow19	Payment pay-1794195788023-6zbsow19 for order order-1794195269669-6125	\N	\N	2026-11-09 06:43:07.990604+03	f
11	2026-11-09	2026-11	\N	payment.recorded	pay-1794196364999-qorshteh	Payment pay-1794196364999-qorshteh for order order-1794195269669-6125	\N	\N	2026-11-09 06:52:44.982116+03	f
12	2026-11-09	2026-11	\N	payment.recorded	pay-1794196393253-3p4wdv2s	Payment pay-1794196393253-3p4wdv2s for order order-1794195269669-6125	\N	\N	2026-11-09 06:53:13.238559+03	f
13	2026-11-09	2026-11	\N	payment.recorded	pay-1794196880940-bjsm3vci	Payment pay-1794196880940-bjsm3vci for order order-1794196854051-c40e	\N	\N	2026-11-09 07:01:20.924705+03	f
14	2026-11-09	2026-11	\N	payment.recorded	pay-1794197740083-w43psezx	Payment pay-1794197740083-w43psezx for order order-1794197738910-1d9e	\N	\N	2026-11-09 07:15:40.076453+03	f
15	2026-11-09	2026-11	\N	payment.recorded	pay-1794197878915-vfeh4ous	Payment pay-1794197878915-vfeh4ous for order order-1794197738910-1d9e	\N	\N	2026-11-09 07:17:58.902986+03	f
16	2026-11-09	2026-11	\N	payment.recorded	pay-1794198491781-uln7dmg6	Payment pay-1794198491781-uln7dmg6 for order order-1794177563911-cdf3	\N	\N	2026-11-09 07:28:11.75625+03	f
17	2026-11-09	2026-11	\N	payment.recorded	pay-1794199462552-bq59qb7l	Payment pay-1794199462552-bq59qb7l for order order-1794197738910-1d9e	\N	\N	2026-11-09 07:44:22.527036+03	f
18	2026-11-09	2026-11	\N	payment.recorded	pay-1794199493855-biis3pev	Payment pay-1794199493855-biis3pev for order order-1794196765532-fb8a	\N	\N	2026-11-09 07:44:53.836557+03	f
19	2026-11-09	2026-11	\N	payment.recorded	pay-1794199533182-13y88ni3	Payment pay-1794199533182-13y88ni3 for order order-1794196854051-c40e	\N	\N	2026-11-09 07:45:33.167144+03	f
20	2026-11-09	2026-11	\N	payment.recorded	pay-1794199590014-d0x8apqv	Payment pay-1794199590014-d0x8apqv for order order-1794199589095-4924	\N	\N	2026-11-09 07:46:30.012548+03	f
21	2026-11-09	2026-11	\N	payment.recorded	pay-1794199706817-ri9vc4fy	Payment pay-1794199706817-ri9vc4fy for order order-1794199589095-4924	\N	\N	2026-11-09 07:48:26.792592+03	f
22	2026-11-09	2026-11	\N	payment.recorded	pay-1794199739666-cfo9q2t8	Payment pay-1794199739666-cfo9q2t8 for order order-1794199589095-4924	\N	\N	2026-11-09 07:48:59.649803+03	f
23	2026-11-09	2026-11	\N	payment.recorded	pay-1794213893537-dn045i5f	Payment pay-1794213893537-dn045i5f for order order-1794213807393-a774	\N	\N	2026-11-09 11:44:53.511809+03	f
24	2026-11-09	2026-11	\N	payment.recorded	pay-1794218451170-pd67t18a	Payment pay-1794218451170-pd67t18a for order order-1794218434324-e379	\N	\N	2026-11-09 13:00:51.153675+03	f
25	2026-11-09	2026-11	\N	payment.recorded	pay-1794219116410-fwyz70de	Payment pay-1794219116410-fwyz70de for order order-1794218434324-e379	\N	\N	2026-11-09 13:11:56.38647+03	f
26	2026-11-09	2026-11	\N	payment.recorded	pay-1794219272397-1ww1jx7j	Payment pay-1794219272397-1ww1jx7j for order order-1794219270642-b341	\N	\N	2026-11-09 13:14:32.395609+03	f
27	2026-11-09	2026-11	\N	payment.recorded	pay-1794221355008-0zfgia71	Payment pay-1794221355008-0zfgia71 for order order-1793892166461-58f0	\N	\N	2026-11-09 13:49:14.995745+03	f
28	2026-11-09	2026-11	\N	payment.recorded	pay-1794221414409-6bq4lccw	Payment pay-1794221414409-6bq4lccw for order order-1794221411732-33d9	\N	\N	2026-11-09 13:50:14.407711+03	f
29	2026-11-09	2026-11	\N	payment.recorded	pay-1794221449983-oiqs9pjb	Payment pay-1794221449983-oiqs9pjb for order order-1794221411732-33d9	\N	\N	2026-11-09 13:50:49.967151+03	f
30	2026-11-09	2026-11	\N	payment.recorded	pay-1794221622036-h2jwqqvg	Payment pay-1794221622036-h2jwqqvg for order order-1794221619960-2a78	\N	\N	2026-11-09 13:53:42.033975+03	f
31	2026-11-09	2026-11	\N	payment.recorded	pay-1794221627623-q13x9v8c	Payment pay-1794221627623-q13x9v8c for order order-1794221619960-2a78	\N	\N	2026-11-09 13:53:47.619094+03	f
32	2026-11-11	2026-11	\N	payment.recorded	pay-1794399385772-ye0le161	Payment pay-1794399385772-ye0le161 for order order-1794399385025-9f65	\N	\N	2026-11-11 15:16:25.764565+03	f
33	2026-11-11	2026-11	\N	payment.recorded	pay-1794403319118-39qpcpzi	Payment pay-1794403319118-39qpcpzi for order order-1794403318325-bbf0	\N	\N	2026-11-11 16:21:59.110231+03	f
34	2026-11-11	2026-11	\N	payment.recorded	pay-1794407603091-ctcbul5p	Payment pay-1794407603091-ctcbul5p for order order-1794407602450-5298	\N	\N	2026-11-11 17:33:23.082261+03	f
35	2026-11-11	2026-11	\N	payment.recorded	pay-1794418965283-5j6amcni	Payment pay-1794418965283-5j6amcni for order order-1794418964769-d9d2	\N	\N	2026-11-11 20:42:45.277845+03	f
36	2026-11-11	2026-11	\N	payment.recorded	pay-1794421426221-27valds7	Payment pay-1794421426221-27valds7 for order order-1794418964769-d9d2	\N	\N	2026-11-11 21:23:46.11199+03	f
37	2026-11-11	2026-11	\N	payment.recorded	pay-1794421594243-emvodfq0	Payment pay-1794421594243-emvodfq0 for order order-1794418964769-d9d2	\N	\N	2026-11-11 21:26:34.215487+03	f
38	2026-11-11	2026-11	\N	payment.recorded	pay-1794421764000-b13p3y22	Payment pay-1794421764000-b13p3y22 for order order-1794418964769-d9d2	\N	\N	2026-11-11 21:29:23.961038+03	f
39	2026-11-12	2026-11	\N	payment.recorded	pay-1794450375716-cyd4cj1r	Payment pay-1794450375716-cyd4cj1r for order order-1794407602450-5298	\N	\N	2026-11-12 05:26:15.662737+03	f
40	2026-11-12	2026-11	\N	payment.recorded	pay-1794451066548-e7n4h8xj	Payment pay-1794451066548-e7n4h8xj for order order-1794403318325-bbf0	\N	\N	2026-11-12 05:37:46.494859+03	f
41	2026-11-12	2026-11	\N	payment.recorded	pay-1794451097422-qqmpbs9d	Payment pay-1794451097422-qqmpbs9d for order order-1794399385025-9f65	\N	\N	2026-11-12 05:38:17.40261+03	f
42	2026-11-12	2026-11	\N	payment.recorded	pay-1794451215084-frsqbquw	Payment pay-1794451215084-frsqbquw for order order-1794403318325-bbf0	\N	\N	2026-11-12 05:40:15.03819+03	f
43	2026-11-12	2026-11	\N	payment.recorded	pay-1794451526494-x7a9gf0y	Payment pay-1794451526494-x7a9gf0y for order order-1794399385025-9f65	\N	\N	2026-11-12 05:45:26.447189+03	f
44	2026-11-12	2026-11	\N	payment.recorded	pay-1794502166990-4htzbc1o	Payment pay-1794502166990-4htzbc1o for order order-1794502165789-e5f7	\N	\N	2026-11-12 19:49:26.982492+03	f
45	2026-11-12	2026-11	\N	payment.recorded	pay-1794504371768-uytmo0od	Payment pay-1794504371768-uytmo0od for order order-1794502165789-e5f7	\N	\N	2026-11-12 20:26:11.735451+03	f
\.


--
-- Data for Name: journal_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.journal_lines (id, entry_id, account_code, debit, credit, order_id, customer_id, job_id, supplier_id) FROM stdin;
1	1	1010	50000	0	order-1794176085374-1432	\N	\N	\N
2	1	2010	0	50000	order-1794176085374-1432	\N	\N	\N
3	2	1010	50000	0	order-1794177563911-cdf3	\N	\N	\N
4	2	2010	0	50000	order-1794177563911-cdf3	\N	\N	\N
5	3	1010	10000	0	order-1794176085374-1432	\N	\N	\N
6	3	2010	0	10000	order-1794176085374-1432	\N	\N	\N
7	4	1010	10000	0	order-1794176085374-1432	\N	\N	\N
8	4	2010	0	10000	order-1794176085374-1432	\N	\N	\N
9	5	1010	15000	0	order-1794177563911-cdf3	\N	\N	\N
10	5	2010	0	15000	order-1794177563911-cdf3	\N	\N	\N
11	6	1010	12000	0	order-1794195269669-6125	\N	\N	\N
12	6	2010	0	12000	order-1794195269669-6125	\N	\N	\N
13	7	1010	12000	0	order-1794195269669-6125	\N	\N	\N
14	7	2010	0	12000	order-1794195269669-6125	\N	\N	\N
15	8	1010	12000	0	order-1794195269669-6125	\N	\N	\N
16	8	2010	0	12000	order-1794195269669-6125	\N	\N	\N
17	9	1010	12000	0	order-1794195269669-6125	\N	\N	\N
18	9	2010	0	12000	order-1794195269669-6125	\N	\N	\N
19	10	1010	10000	0	order-1794195269669-6125	\N	\N	\N
20	10	2010	0	10000	order-1794195269669-6125	\N	\N	\N
21	11	1010	10000	0	order-1794195269669-6125	\N	\N	\N
22	11	2010	0	10000	order-1794195269669-6125	\N	\N	\N
23	12	1010	5000	0	order-1794195269669-6125	\N	\N	\N
24	12	2010	0	5000	order-1794195269669-6125	\N	\N	\N
25	13	1010	10000	0	order-1794196854051-c40e	\N	\N	\N
26	13	2010	0	10000	order-1794196854051-c40e	\N	\N	\N
27	14	1010	15000	0	order-1794197738910-1d9e	\N	\N	\N
28	14	2010	0	15000	order-1794197738910-1d9e	\N	\N	\N
29	15	1010	15000	0	order-1794197738910-1d9e	\N	\N	\N
30	15	2010	0	15000	order-1794197738910-1d9e	\N	\N	\N
31	16	1010	10000	0	order-1794177563911-cdf3	\N	\N	\N
32	16	2010	0	10000	order-1794177563911-cdf3	\N	\N	\N
33	17	1010	20000	0	order-1794197738910-1d9e	\N	\N	\N
34	17	2010	0	20000	order-1794197738910-1d9e	\N	\N	\N
35	18	1010	40000	0	order-1794196765532-fb8a	\N	\N	\N
36	18	2010	0	40000	order-1794196765532-fb8a	\N	\N	\N
37	19	1010	7000	0	order-1794196854051-c40e	\N	\N	\N
38	19	2010	0	7000	order-1794196854051-c40e	\N	\N	\N
39	20	1010	12000	0	order-1794199589095-4924	\N	\N	\N
40	20	2010	0	12000	order-1794199589095-4924	\N	\N	\N
41	21	1010	8000	0	order-1794199589095-4924	\N	\N	\N
42	21	2010	0	8000	order-1794199589095-4924	\N	\N	\N
43	22	1010	10000	0	order-1794199589095-4924	\N	\N	\N
44	22	2010	0	10000	order-1794199589095-4924	\N	\N	\N
45	23	1010	4000	0	order-1794213807393-a774	\N	\N	\N
46	23	2010	0	4000	order-1794213807393-a774	\N	\N	\N
47	24	1010	4000	0	order-1794218434324-e379	\N	\N	\N
48	24	2010	0	4000	order-1794218434324-e379	\N	\N	\N
49	25	1010	1000	0	order-1794218434324-e379	\N	\N	\N
50	25	2010	0	1000	order-1794218434324-e379	\N	\N	\N
51	26	1010	6000	0	order-1794219270642-b341	\N	\N	\N
52	26	2010	0	6000	order-1794219270642-b341	\N	\N	\N
53	27	1010	8000	0	order-1793892166461-58f0	\N	\N	\N
54	27	2010	0	8000	order-1793892166461-58f0	\N	\N	\N
55	28	1010	7000	0	order-1794221411732-33d9	\N	\N	\N
56	28	2010	0	7000	order-1794221411732-33d9	\N	\N	\N
57	29	1010	6000	0	order-1794221411732-33d9	\N	\N	\N
58	29	2010	0	6000	order-1794221411732-33d9	\N	\N	\N
59	30	1010	7000	0	order-1794221619960-2a78	\N	\N	\N
60	30	2010	0	7000	order-1794221619960-2a78	\N	\N	\N
61	31	1010	6000	0	order-1794221619960-2a78	\N	\N	\N
62	31	2010	0	6000	order-1794221619960-2a78	\N	\N	\N
63	32	1010	60000	0	order-1794399385025-9f65	\N	\N	\N
64	32	2010	0	60000	order-1794399385025-9f65	\N	\N	\N
65	33	1010	90000	0	order-1794403318325-bbf0	\N	\N	\N
66	33	2010	0	90000	order-1794403318325-bbf0	\N	\N	\N
67	34	1010	50000	0	order-1794407602450-5298	\N	\N	\N
68	34	2010	0	50000	order-1794407602450-5298	\N	\N	\N
69	35	1010	50000	0	order-1794418964769-d9d2	\N	\N	\N
70	35	2010	0	50000	order-1794418964769-d9d2	\N	\N	\N
71	36	1010	10000	0	order-1794418964769-d9d2	\N	\N	\N
72	36	2010	0	10000	order-1794418964769-d9d2	\N	\N	\N
73	37	1010	10000	0	order-1794418964769-d9d2	\N	\N	\N
74	37	2010	0	10000	order-1794418964769-d9d2	\N	\N	\N
75	38	1010	20000	0	order-1794418964769-d9d2	\N	\N	\N
76	38	2010	0	20000	order-1794418964769-d9d2	\N	\N	\N
77	39	1010	20000	0	order-1794407602450-5298	\N	\N	\N
78	39	2010	0	20000	order-1794407602450-5298	\N	\N	\N
79	40	1010	3000	0	order-1794403318325-bbf0	\N	\N	\N
80	40	2010	0	3000	order-1794403318325-bbf0	\N	\N	\N
81	41	1010	5000	0	order-1794399385025-9f65	\N	\N	\N
82	41	2010	0	5000	order-1794399385025-9f65	\N	\N	\N
83	42	1010	2000	0	order-1794403318325-bbf0	\N	\N	\N
84	42	2010	0	2000	order-1794403318325-bbf0	\N	\N	\N
85	43	1010	5000	0	order-1794399385025-9f65	\N	\N	\N
86	43	2010	0	5000	order-1794399385025-9f65	\N	\N	\N
87	44	1010	25000	0	order-1794502165789-e5f7	\N	\N	\N
88	44	2010	0	25000	order-1794502165789-e5f7	\N	\N	\N
89	45	1010	50000	0	order-1794502165789-e5f7	\N	\N	\N
90	45	2010	0	50000	order-1794502165789-e5f7	\N	\N	\N
\.


--
-- Data for Name: notification_preferences; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notification_preferences (id, user_id, event_type_id, channel, enabled, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: notification_recipients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notification_recipients (id, notification_id, user_id, delivery_channel, delivered_at, read_at, failed_at, failure_reason, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: notification_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notification_templates (id, event_type_id, channel, title_template, message_template, active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.notifications (id, event_type_id, title, message, priority, entity_type, entity_id, action_url, deep_link, created_at, created_by, read_at, delivery_status, failure_reason, updated_at) FROM stdin;
\.


--
-- Data for Name: option_definitions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.option_definitions (id, entity_type, entity_id, name, is_mandatory, display_order) FROM stdin;
\.


--
-- Data for Name: option_values; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.option_values (id, option_def_id, label) FROM stdin;
\.


--
-- Data for Name: order_customer_snapshots; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_customer_snapshots (id, order_id, customer_id, snapshot_name, snapshot_phone, snapshot_email, snapshot_address, snapshot_preferred_contact, captured_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_items (id, order_id, product_id, variant_options, quantity, unit_price, discount, total, recipe_version, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: order_proposal_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_proposal_items (id, proposal_id, product_id, product_name, variant_options, quantity, unit_price, total, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: order_proposals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_proposals (id, proposal_number, customer_name, phone, email, product_summary, quantity, preferred_date, preferred_time, delivery_type, delivery_location, customer_notes, reference_image, status, customer_id, inquiry_id, order_id, reviewed_by, reviewed_at, review_notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: order_status_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_status_history (id, order_id, previous_status, new_status, changed_by, reason, "timestamp", created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, order_number, customer_id, salesperson_id, subtotal, discount, delivery_charge, tax_amount, total, currency, required_by, required_at, notes, status, payment_status, delivery_status, quotation_id, inquiry_id, created_by, delivered_at, created_at, updated_at, follow_up_completed_at, delivery_location, location_note) FROM stdin;
\.


--
-- Data for Name: payment_allocations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payment_allocations (id, payment_id, invoice_id, amount) FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payments (id, order_id, amount, method, date, reference, received_by, notes, created_at, updated_at, kind, status, reverses_payment_id, reason, approved_by, idempotency_key, provider, provider_ref, delivery_id, collected_by, cash_handover_id, invoice_id) FROM stdin;
\.


--
-- Data for Name: payslips; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payslips (id, period_id, staff_id, item_id, period_label, staff_name, basic_salary, allowances, bonuses, deductions, advance_amount, other_payments, net_amount, paid_amount, issued_at, issued_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.permissions (id, key, created_at, updated_at) FROM stdin;
perm-23	inventory.consume	2026-10-31 17:08:48.098+03	2026-10-31 17:08:48.098+03
perm-24	purchasing.view	2026-10-31 17:08:48.101+03	2026-10-31 17:08:48.101+03
perm-25	purchasing.create	2026-10-31 17:08:48.104+03	2026-10-31 17:08:48.104+03
perm-26	purchasing.approve	2026-10-31 17:08:48.107+03	2026-10-31 17:08:48.107+03
perm-27	purchasing.receive	2026-10-31 17:08:48.109+03	2026-10-31 17:08:48.109+03
perm-28	finance.view	2026-10-31 17:08:48.111+03	2026-10-31 17:08:48.111+03
perm-29	finance.record_payment	2026-10-31 17:08:48.114+03	2026-10-31 17:08:48.114+03
perm-30	finance.record_expense	2026-10-31 17:08:48.116+03	2026-10-31 17:08:48.116+03
perm-31	finance.view_reports	2026-10-31 17:08:48.119+03	2026-10-31 17:08:48.119+03
perm-32	payments.view	2026-10-31 17:08:48.121+03	2026-10-31 17:08:48.121+03
perm-33	payments.record	2026-10-31 17:08:48.124+03	2026-10-31 17:08:48.124+03
perm-34	deliveries.view	2026-10-31 17:08:48.126+03	2026-10-31 17:08:48.126+03
perm-35	deliveries.create	2026-10-31 17:08:48.128+03	2026-10-31 17:08:48.128+03
perm-quotations-send	quotations.send	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
perm-analytics-operations	analytics.operations	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
perm-analytics-finance	analytics.finance	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
perm-analytics-customers	analytics.customers	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
perm-analytics-staff	analytics.staff	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
perm-payments-refund	payments.refund	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
perm-payments-confirm-remittance	payments.confirm_remittance	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
perm-expenses-approve	expenses.approve	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
perm-orders-override-price	orders.override_price	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
perm-inventory-approve-writeoff	inventory.approve_writeoff	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
perm-inventory-view-costs	inventory.view_costs	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
perm-63	staff.manage	2026-10-31 17:08:48.202+03	2026-10-31 17:08:48.202+03
perm-69	remuneration.process	2026-10-31 17:08:48.218+03	2026-10-31 17:08:48.218+03
perm-70	remuneration.record_payment	2026-10-31 17:08:48.221+03	2026-10-31 17:08:48.221+03
perm-59	inquiries.create	2026-10-31 17:08:48.192+03	2026-10-31 17:08:48.192+03
perm-finance-view-margins	finance.view_margins	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
perm-orders-view-all	orders.view_all	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
perm-deliveries-update	deliveries.update	2026-10-31 20:17:16.649+03	2026-10-31 20:17:16.649+03
perm-1	orders.view	2026-10-31 17:08:48.028+03	2026-10-31 17:08:48.028+03
perm-2	orders.create	2026-10-31 17:08:48.04+03	2026-10-31 17:08:48.04+03
perm-3	orders.confirm	2026-10-31 17:08:48.043+03	2026-10-31 17:08:48.043+03
perm-4	orders.cancel	2026-10-31 17:08:48.047+03	2026-10-31 17:08:48.047+03
perm-5	customers.view	2026-10-31 17:08:48.049+03	2026-10-31 17:08:48.049+03
perm-6	customers.create	2026-10-31 17:08:48.051+03	2026-10-31 17:08:48.051+03
perm-7	customers.edit	2026-10-31 17:08:48.054+03	2026-10-31 17:08:48.054+03
perm-8	customers.interact	2026-10-31 17:08:48.057+03	2026-10-31 17:08:48.057+03
perm-9	products.view	2026-10-31 17:08:48.06+03	2026-10-31 17:08:48.06+03
perm-10	products.create	2026-10-31 17:08:48.063+03	2026-10-31 17:08:48.063+03
perm-11	products.edit	2026-10-31 17:08:48.065+03	2026-10-31 17:08:48.065+03
perm-36	deliveries.dispatch	2026-10-31 17:08:48.13+03	2026-10-31 17:08:48.13+03
perm-12	products.archive	2026-10-31 17:08:48.068+03	2026-10-31 17:08:48.068+03
perm-13	production.view	2026-10-31 17:08:48.071+03	2026-10-31 17:08:48.071+03
perm-14	production.schedule	2026-10-31 17:08:48.074+03	2026-10-31 17:08:48.074+03
perm-15	production.start	2026-10-31 17:08:48.077+03	2026-10-31 17:08:48.077+03
perm-16	production.complete	2026-10-31 17:08:48.08+03	2026-10-31 17:08:48.08+03
perm-17	production.quality_check	2026-10-31 17:08:48.083+03	2026-10-31 17:08:48.083+03
perm-18	production.record_wastage	2026-10-31 17:08:48.085+03	2026-10-31 17:08:48.085+03
perm-19	production.record_consumption	2026-10-31 17:08:48.088+03	2026-10-31 17:08:48.088+03
perm-20	inventory.view	2026-10-31 17:08:48.09+03	2026-10-31 17:08:48.09+03
perm-61	sales.analytics	2026-10-31 17:08:48.197+03	2026-10-31 17:08:48.197+03
perm-62	staff.view	2026-10-31 17:08:48.2+03	2026-10-31 17:08:48.2+03
perm-64	staff.attendance	2026-10-31 17:08:48.205+03	2026-10-31 17:08:48.205+03
perm-65	remuneration.view	2026-10-31 17:08:48.208+03	2026-10-31 17:08:48.208+03
perm-66	remuneration.create	2026-10-31 17:08:48.211+03	2026-10-31 17:08:48.211+03
perm-68	remuneration.approve	2026-10-31 17:08:48.216+03	2026-10-31 17:08:48.216+03
perm-67	remuneration.edit	2026-10-31 17:08:48.214+03	2026-10-31 17:08:48.214+03
perm-22	inventory.reserve	2026-10-31 17:08:48.095+03	2026-10-31 17:08:48.095+03
perm-deliveries-view-all	deliveries.view_all	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
perm-customers-view-all	customers.view_all	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
perm-production-view-all	production.view_all	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
perm-43	users.manage	2026-10-31 17:08:48.147+03	2026-10-31 17:08:48.147+03
perm-44	roles.manage	2026-10-31 17:08:48.15+03	2026-10-31 17:08:48.15+03
perm-45	settings.manage	2026-10-31 17:08:48.153+03	2026-10-31 17:08:48.153+03
perm-46	audit.view	2026-10-31 17:08:48.155+03	2026-10-31 17:08:48.155+03
perm-47	catalogue.view	2026-10-31 17:08:48.158+03	2026-10-31 17:08:48.158+03
perm-48	catalogue.create	2026-10-31 17:08:48.16+03	2026-10-31 17:08:48.16+03
perm-49	catalogue.edit	2026-10-31 17:08:48.163+03	2026-10-31 17:08:48.163+03
perm-50	catalogue.archive	2026-10-31 17:08:48.166+03	2026-10-31 17:08:48.166+03
perm-37	deliveries.complete	2026-10-31 17:08:48.132+03	2026-10-31 17:08:48.132+03
perm-38	deliveries.cancel	2026-10-31 17:08:48.135+03	2026-10-31 17:08:48.135+03
perm-39	feedback.view	2026-10-31 17:08:48.138+03	2026-10-31 17:08:48.138+03
perm-72	remuneration.view_reports	2026-10-31 17:08:48.225+03	2026-10-31 17:08:48.225+03
perm-21	inventory.adjust	2026-10-31 17:08:48.092+03	2026-10-31 17:08:48.092+03
perm-73	payslip.print	2026-10-31 17:08:48.228+03	2026-10-31 17:08:48.228+03
perm-payments-reverse	payments.reverse	2026-11-03 05:58:12.206+03	2026-11-03 05:58:12.206+03
perm-payments-approve-refund	payments.approve_refund	2026-11-03 05:58:12.206+03	2026-11-03 05:58:12.206+03
perm-finance-confirm-handover	finance.confirm_handover	2026-11-03 05:58:12.206+03	2026-11-03 05:58:12.206+03
perm-finance-close-period	finance.close_period	2026-11-03 05:58:12.206+03	2026-11-03 05:58:12.206+03
perm-finance-reopen-period	finance.reopen_period	2026-11-03 05:58:12.206+03	2026-11-03 05:58:12.206+03
perm-71	remuneration.close_period	2026-10-31 17:08:48.223+03	2026-10-31 17:08:48.223+03
perm-finance-post-manual	finance.post_manual	2026-11-03 05:58:12.206+03	2026-11-03 05:58:12.206+03
perm-finance-manage-invoices	finance.manage_invoices	2026-11-03 05:58:12.206+03	2026-11-03 05:58:12.206+03
perm-finance-reconcile	finance.reconcile	2026-11-03 05:58:12.206+03	2026-11-03 05:58:12.206+03
perm-55	quotations.create	2026-10-31 17:08:48.18+03	2026-10-31 17:08:48.18+03
perm-56	quotations.accept	2026-10-31 17:08:48.183+03	2026-10-31 17:08:48.183+03
perm-57	quotations.edit	2026-10-31 17:08:48.186+03	2026-10-31 17:08:48.186+03
perm-58	inquiries.view	2026-10-31 17:08:48.189+03	2026-10-31 17:08:48.189+03
perm-suppliers-create	suppliers.create	2026-10-31 20:20:21.046+03	2026-10-31 20:20:21.046+03
perm-suppliers-edit	suppliers.edit	2026-10-31 20:20:21.046+03	2026-10-31 20:20:21.046+03
perm-finance-approve-payment	finance.approve_payment	2026-11-03 05:58:12.206+03	2026-11-03 05:58:12.206+03
perm-51	content.view	2026-10-31 17:08:48.169+03	2026-10-31 17:08:48.169+03
perm-52	content.create	2026-10-31 17:08:48.172+03	2026-10-31 17:08:48.172+03
perm-53	content.edit	2026-10-31 17:08:48.175+03	2026-10-31 17:08:48.175+03
perm-54	quotations.view	2026-10-31 17:08:48.177+03	2026-10-31 17:08:48.177+03
perm-suppliers-archive	suppliers.archive	2026-10-31 20:20:21.046+03	2026-10-31 20:20:21.046+03
perm-60	inquiries.edit	2026-10-31 17:08:48.195+03	2026-10-31 17:08:48.195+03
perm-40	feedback.create	2026-10-31 17:08:48.141+03	2026-10-31 17:08:48.141+03
perm-41	feedback.resolve	2026-10-31 17:08:48.143+03	2026-10-31 17:08:48.143+03
perm-42	feedback.update	2026-10-31 17:08:48.145+03	2026-10-31 17:08:48.145+03
\.


--
-- Data for Name: product_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_types (id, category_id, name, code, description, display_order, active, catalogue_visible, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: product_variants; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_variants (id, product_id, name, type, default_value, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: production_consumption; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.production_consumption (id, job_id, item_id, quantity, unit, recipe_version, unit_cost, actual_cost, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: production_costs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.production_costs (id, job_id, ingredient_cost, packaging_cost, labour_cost, overhead_cost, total, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: production_fixed_cost_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.production_fixed_cost_categories (id, name, description, cost_type, unit, default_unit_cost, active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: production_fixed_cost_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.production_fixed_cost_entries (id, job_id, category_id, quantity, unit, unit_cost, total, recorded_by, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: production_jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.production_jobs (id, order_id, customer_id, product_id, variant_options, quantity, recipe_version, required_by, required_at, status, stage, progress, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: production_steps; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.production_steps (id, job_id, name, step_order, status, started_at, completed_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: production_wastage; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.production_wastage (id, job_id, item_id, quantity, unit, reason, cost, recorded_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.products (id, sku, category_id, product_type_id, name, description, base_price, currency, cost_reference, catalogue_visible, production_enabled, image, active, archived, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: provider_statement_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.provider_statement_lines (id, provider, provider_ref, amount, occurred_at, payment_id, match_status) FROM stdin;
\.


--
-- Data for Name: purchase_order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_order_items (id, purchase_order_id, product_id, supplier_id, quantity, unit, unit_price, total, received_quantity, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_orders (id, po_number, supplier_id, date, expected_date, total, status, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: purchase_requirements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_requirements (id, product_ids, quantity, unit, reason, urgency, status, requested_by, requested_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: quality_checks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quality_checks (id, job_id, result, checked_by, checked_at, issues, notes, rework_required, rework_cost, wastage_caused, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: quotation_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quotation_items (id, quotation_id, product_id, variant_options, quantity, unit_price, discount, total, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: quotations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.quotations (id, quotation_number, customer_id, salesperson_id, notes, validity_expiry, status, tax_amount, total, unit_total, submitted_at, accepted_at, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: recipe_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.recipe_items (id, recipe_version_id, ingredient_id, ingredient_name, quantity, unit, expected_waste, notes, item_order) FROM stdin;
\.


--
-- Data for Name: recipe_versions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.recipe_versions (id, recipe_id, version, notes, effective_date, total_estimated_cost, wastage_percent, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: recipes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.recipes (id, product_id, name, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: remuneration_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.remuneration_items (id, period_id, staff_id, basic_salary, allowances, bonuses, deductions, advance_amount, other_payments, net_amount, paid_amount, status, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: remuneration_payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.remuneration_payments (id, period_id, staff_id, item_id, amount, payment_date, method, reference, payment_status, notes, recorded_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: remuneration_periods; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.remuneration_periods (id, label, period_type, start_date, end_date, intended_payment_date, status, total_amount, paid_amount, notes, created_by, approved_by, approved_at, closed_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.role_permissions (id, role_id, permission_id, created_at, updated_at) FROM stdin;
rp-023-perm-payments-refund	role-admin	perm-payments-refund	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-023-perm-payments-confirm-remittance	role-admin	perm-payments-confirm-remittance	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-023-perm-expenses-approve	role-admin	perm-expenses-approve	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-023-perm-orders-override-price	role-admin	perm-orders-override-price	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-023-perm-inventory-approve-writeoff	role-admin	perm-inventory-approve-writeoff	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-admin-perm-51	role-admin	perm-51	2026-10-31 17:08:48.171+03	2026-10-31 17:08:48.171+03
rp-admin-perm-52	role-admin	perm-52	2026-10-31 17:08:48.173+03	2026-10-31 17:08:48.173+03
rp-023-perm-quotations-send	role-admin	perm-quotations-send	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-023-perm-analytics-operations	role-admin	perm-analytics-operations	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-023-perm-analytics-customers	role-admin	perm-analytics-customers	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-admin-perm-72	role-admin	perm-72	2026-10-31 17:08:48.227+03	2026-10-31 17:08:48.227+03
rp-admin-perm-73	role-admin	perm-73	2026-10-31 17:08:48.23+03	2026-10-31 17:08:48.23+03
rp-production-perm-14	role-production	perm-14	2026-10-31 17:08:48.243+03	2026-10-31 17:08:48.243+03
rp-production-perm-15	role-production	perm-15	2026-10-31 17:08:48.245+03	2026-10-31 17:08:48.245+03
rp-production-perm-16	role-production	perm-16	2026-10-31 17:08:48.246+03	2026-10-31 17:08:48.246+03
rp-production-perm-17	role-production	perm-17	2026-10-31 17:08:48.248+03	2026-10-31 17:08:48.248+03
rp-production-perm-13	role-production	perm-13	2026-10-31 17:08:48.242+03	2026-10-31 17:08:48.242+03
rp-production-perm-18	role-production	perm-18	2026-10-31 17:08:48.249+03	2026-10-31 17:08:48.249+03
rp-023-perm-inventory-view-costs	role-admin	perm-inventory-view-costs	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-023-perm-finance-view-margins	role-admin	perm-finance-view-margins	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-023-perm-orders-view-all	role-admin	perm-orders-view-all	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-023-perm-deliveries-view-all	role-admin	perm-deliveries-view-all	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-023-perm-customers-view-all	role-admin	perm-customers-view-all	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-023-perm-production-view-all	role-admin	perm-production-view-all	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-023-prod-perm-inventory-view-costs	role-production	perm-inventory-view-costs	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-023-prod-perm-deliveries-update	role-production	perm-deliveries-update	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-023-prod-perm-production-view-all	role-production	perm-production-view-all	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-023-sales-perm-quotations-send	role-sales	perm-quotations-send	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-023-sales-perm-analytics-operations	role-sales	perm-analytics-operations	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-023-sales-perm-analytics-customers	role-sales	perm-analytics-customers	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-023-csr-perm-deliveries-update	role-csr	perm-deliveries-update	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-023-perm-analytics-finance	role-admin	perm-analytics-finance	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-034-admin-perm-finance-close-period	role-admin	perm-finance-close-period	2026-11-03 05:58:12.206+03	2026-11-03 05:58:12.206+03
rp-034-admin-perm-finance-reopen-period	role-admin	perm-finance-reopen-period	2026-11-03 05:58:12.206+03	2026-11-03 05:58:12.206+03
rp-034-admin-perm-finance-post-manual	role-admin	perm-finance-post-manual	2026-11-03 05:58:12.206+03	2026-11-03 05:58:12.206+03
rp-034-admin-perm-finance-manage-invoices	role-admin	perm-finance-manage-invoices	2026-11-03 05:58:12.206+03	2026-11-03 05:58:12.206+03
rp-034-admin-perm-finance-reconcile	role-admin	perm-finance-reconcile	2026-11-03 05:58:12.206+03	2026-11-03 05:58:12.206+03
rp-034-admin-perm-finance-approve-payment	role-admin	perm-finance-approve-payment	2026-11-03 05:58:12.206+03	2026-11-03 05:58:12.206+03
rp-034-admin-perm-payments-reverse	role-admin	perm-payments-reverse	2026-11-03 05:58:12.206+03	2026-11-03 05:58:12.206+03
rp-034-admin-perm-payments-approve-refund	role-admin	perm-payments-approve-refund	2026-11-03 05:58:12.206+03	2026-11-03 05:58:12.206+03
rp-production-perm-19	role-production	perm-19	2026-10-31 17:08:48.251+03	2026-10-31 17:08:48.251+03
rp-production-perm-20	role-production	perm-20	2026-10-31 17:08:48.252+03	2026-10-31 17:08:48.252+03
rp-034-admin-perm-finance-confirm-handover	role-admin	perm-finance-confirm-handover	2026-11-03 05:58:12.206+03	2026-11-03 05:58:12.206+03
rp-023-perm-analytics-staff	role-admin	perm-analytics-staff	2026-11-03 05:53:29.787+03	2026-11-03 05:53:29.787+03
rp-production-perm-21	role-production	perm-21	2026-10-31 17:08:48.254+03	2026-10-31 17:08:48.254+03
rp-production-perm-22	role-production	perm-22	2026-10-31 17:08:48.255+03	2026-10-31 17:08:48.255+03
rp-production-perm-5	role-production	perm-5	2026-10-31 17:08:48.279+03	2026-10-31 17:08:48.279+03
rp-production-perm-47	role-production	perm-47	2026-10-31 17:08:48.281+03	2026-10-31 17:08:48.281+03
rp-production-perm-62	role-production	perm-62	2026-10-31 17:08:48.283+03	2026-10-31 17:08:48.283+03
rp-sales-perm-1	role-sales	perm-1	2026-10-31 17:08:48.284+03	2026-10-31 17:08:48.284+03
rp-sales-perm-2	role-sales	perm-2	2026-10-31 17:08:48.286+03	2026-10-31 17:08:48.286+03
rp-sales-perm-4	role-sales	perm-4	2026-10-31 17:08:48.288+03	2026-10-31 17:08:48.288+03
rp-sales-perm-3	role-sales	perm-3	2026-10-31 17:08:48.289+03	2026-10-31 17:08:48.289+03
rp-sales-perm-54	role-sales	perm-54	2026-10-31 17:08:48.291+03	2026-10-31 17:08:48.291+03
rp-sales-perm-55	role-sales	perm-55	2026-10-31 17:08:48.293+03	2026-10-31 17:08:48.293+03
rp-sales-perm-56	role-sales	perm-56	2026-10-31 17:08:48.295+03	2026-10-31 17:08:48.295+03
rp-sales-perm-57	role-sales	perm-57	2026-10-31 17:08:48.297+03	2026-10-31 17:08:48.297+03
rp-sales-perm-58	role-sales	perm-58	2026-10-31 17:08:48.299+03	2026-10-31 17:08:48.299+03
rp-sales-perm-59	role-sales	perm-59	2026-10-31 17:08:48.3+03	2026-10-31 17:08:48.3+03
rp-sales-perm-60	role-sales	perm-60	2026-10-31 17:08:48.302+03	2026-10-31 17:08:48.302+03
rp-sales-perm-5	role-sales	perm-5	2026-10-31 17:08:48.304+03	2026-10-31 17:08:48.304+03
rp-sales-perm-6	role-sales	perm-6	2026-10-31 17:08:48.305+03	2026-10-31 17:08:48.305+03
rp-csr-perm-5	role-csr	perm-5	2026-10-31 17:10:22.933+03	2026-10-31 17:10:22.933+03
rp-csr-perm-6	role-csr	perm-6	2026-10-31 17:10:22.933+03	2026-10-31 17:10:22.933+03
rp-csr-perm-8	role-csr	perm-8	2026-10-31 17:10:22.933+03	2026-10-31 17:10:22.933+03
rp-csr-perm-39	role-csr	perm-39	2026-10-31 17:10:22.933+03	2026-10-31 17:10:22.933+03
rp-csr-perm-40	role-csr	perm-40	2026-10-31 17:10:22.933+03	2026-10-31 17:10:22.933+03
rp-csr-perm-47	role-csr	perm-47	2026-10-31 17:10:22.933+03	2026-10-31 17:10:22.933+03
rp-csr-perm-54	role-csr	perm-54	2026-10-31 17:10:22.933+03	2026-10-31 17:10:22.933+03
rp-csr-perm-58	role-csr	perm-58	2026-10-31 17:10:22.933+03	2026-10-31 17:10:22.933+03
rp-csr-perm-59	role-csr	perm-59	2026-10-31 17:10:22.933+03	2026-10-31 17:10:22.933+03
rp-admin-perm-1	role-admin	perm-1	2026-10-31 17:08:48.036+03	2026-10-31 17:08:48.036+03
rp-admin-perm-2	role-admin	perm-2	2026-10-31 17:08:48.042+03	2026-10-31 17:08:48.042+03
rp-admin-perm-10	role-admin	perm-10	2026-10-31 17:08:48.064+03	2026-10-31 17:08:48.064+03
rp-admin-perm-11	role-admin	perm-11	2026-10-31 17:08:48.067+03	2026-10-31 17:08:48.067+03
rp-admin-perm-12	role-admin	perm-12	2026-10-31 17:08:48.07+03	2026-10-31 17:08:48.07+03
rp-admin-perm-18	role-admin	perm-18	2026-10-31 17:08:48.087+03	2026-10-31 17:08:48.087+03
rp-admin-perm-19	role-admin	perm-19	2026-10-31 17:08:48.089+03	2026-10-31 17:08:48.089+03
rp-admin-perm-20	role-admin	perm-20	2026-10-31 17:08:48.092+03	2026-10-31 17:08:48.092+03
rp-admin-perm-21	role-admin	perm-21	2026-10-31 17:08:48.094+03	2026-10-31 17:08:48.094+03
rp-admin-perm-22	role-admin	perm-22	2026-10-31 17:08:48.097+03	2026-10-31 17:08:48.097+03
rp-admin-perm-23	role-admin	perm-23	2026-10-31 17:08:48.1+03	2026-10-31 17:08:48.1+03
rp-admin-perm-24	role-admin	perm-24	2026-10-31 17:08:48.103+03	2026-10-31 17:08:48.103+03
rp-admin-perm-25	role-admin	perm-25	2026-10-31 17:08:48.105+03	2026-10-31 17:08:48.105+03
rp-admin-perm-26	role-admin	perm-26	2026-10-31 17:08:48.108+03	2026-10-31 17:08:48.108+03
rp-admin-perm-27	role-admin	perm-27	2026-10-31 17:08:48.11+03	2026-10-31 17:08:48.11+03
rp-admin-perm-28	role-admin	perm-28	2026-10-31 17:08:48.113+03	2026-10-31 17:08:48.113+03
rp-admin-perm-29	role-admin	perm-29	2026-10-31 17:08:48.115+03	2026-10-31 17:08:48.115+03
rp-admin-perm-30	role-admin	perm-30	2026-10-31 17:08:48.118+03	2026-10-31 17:08:48.118+03
rp-admin-perm-31	role-admin	perm-31	2026-10-31 17:08:48.12+03	2026-10-31 17:08:48.12+03
rp-admin-perm-32	role-admin	perm-32	2026-10-31 17:08:48.123+03	2026-10-31 17:08:48.123+03
rp-admin-perm-33	role-admin	perm-33	2026-10-31 17:08:48.125+03	2026-10-31 17:08:48.125+03
rp-admin-perm-34	role-admin	perm-34	2026-10-31 17:08:48.127+03	2026-10-31 17:08:48.127+03
rp-admin-perm-35	role-admin	perm-35	2026-10-31 17:08:48.129+03	2026-10-31 17:08:48.129+03
rp-admin-perm-36	role-admin	perm-36	2026-10-31 17:08:48.131+03	2026-10-31 17:08:48.131+03
rp-admin-perm-37	role-admin	perm-37	2026-10-31 17:08:48.134+03	2026-10-31 17:08:48.134+03
rp-sales-perm-7	role-sales	perm-7	2026-10-31 17:08:48.307+03	2026-10-31 17:08:48.307+03
rp-sales-perm-39	role-sales	perm-39	2026-10-31 17:08:48.308+03	2026-10-31 17:08:48.308+03
rp-sales-perm-40	role-sales	perm-40	2026-10-31 17:08:48.31+03	2026-10-31 17:08:48.31+03
rp-sales-perm-61	role-sales	perm-61	2026-10-31 17:08:48.312+03	2026-10-31 17:08:48.312+03
rp-sales-perm-32	role-sales	perm-32	2026-10-31 17:08:48.314+03	2026-10-31 17:08:48.314+03
rp-sales-perm-33	role-sales	perm-33	2026-10-31 17:08:48.315+03	2026-10-31 17:08:48.315+03
rp-sales-perm-34	role-sales	perm-34	2026-10-31 17:08:48.317+03	2026-10-31 17:08:48.317+03
rp-sales-perm-47	role-sales	perm-47	2026-10-31 17:08:48.319+03	2026-10-31 17:08:48.319+03
rp-admin-perm-43	role-admin	perm-43	2026-10-31 17:08:48.149+03	2026-10-31 17:08:48.149+03
rp-admin-perm-44	role-admin	perm-44	2026-10-31 17:08:48.152+03	2026-10-31 17:08:48.152+03
rp-admin-perm-45	role-admin	perm-45	2026-10-31 17:08:48.154+03	2026-10-31 17:08:48.154+03
rp-admin-perm-53	role-admin	perm-53	2026-10-31 17:08:48.176+03	2026-10-31 17:08:48.176+03
rp-admin-perm-54	role-admin	perm-54	2026-10-31 17:08:48.178+03	2026-10-31 17:08:48.178+03
rp-admin-perm-55	role-admin	perm-55	2026-10-31 17:08:48.182+03	2026-10-31 17:08:48.182+03
rp-admin-perm-56	role-admin	perm-56	2026-10-31 17:08:48.185+03	2026-10-31 17:08:48.185+03
rp-admin-perm-57	role-admin	perm-57	2026-10-31 17:08:48.188+03	2026-10-31 17:08:48.188+03
rp-admin-perm-58	role-admin	perm-58	2026-10-31 17:08:48.191+03	2026-10-31 17:08:48.191+03
rp-deliveries-update-admin	role-admin	perm-deliveries-update	2026-10-31 20:18:52.359+03	2026-10-31 20:18:52.359+03
rp-production-perm-35	role-production	perm-35	2026-10-31 17:08:48.266+03	2026-10-31 17:08:48.266+03
rp-production-perm-36	role-production	perm-36	2026-10-31 17:08:48.268+03	2026-10-31 17:08:48.268+03
rp-production-perm-37	role-production	perm-37	2026-10-31 17:08:48.27+03	2026-10-31 17:08:48.27+03
rp-production-perm-1	role-production	perm-1	2026-10-31 17:08:48.274+03	2026-10-31 17:08:48.274+03
rp-production-perm-3	role-production	perm-3	2026-10-31 17:08:48.277+03	2026-10-31 17:08:48.277+03
rp-admin-perm-13	role-admin	perm-13	2026-10-31 17:08:48.073+03	2026-10-31 17:08:48.073+03
rp-admin-perm-14	role-admin	perm-14	2026-10-31 17:08:48.076+03	2026-10-31 17:08:48.076+03
rp-admin-perm-15	role-admin	perm-15	2026-10-31 17:08:48.079+03	2026-10-31 17:08:48.079+03
rp-admin-perm-16	role-admin	perm-16	2026-10-31 17:08:48.082+03	2026-10-31 17:08:48.082+03
rp-admin-perm-17	role-admin	perm-17	2026-10-31 17:08:48.084+03	2026-10-31 17:08:48.084+03
rp-admin-perm-71	role-admin	perm-71	2026-10-31 17:08:48.225+03	2026-10-31 17:08:48.225+03
rp-production-perm-38	role-production	perm-38	2026-10-31 17:08:48.272+03	2026-10-31 17:08:48.272+03
rp-csr-perm-1	role-csr	perm-1	2026-10-31 17:10:22.933+03	2026-10-31 17:10:22.933+03
rp-admin-perm-46	role-admin	perm-46	2026-10-31 17:08:48.157+03	2026-10-31 17:08:48.157+03
rp-admin-perm-69	role-admin	perm-69	2026-10-31 17:08:48.22+03	2026-10-31 17:08:48.22+03
rp-production-perm-23	role-production	perm-23	2026-10-31 17:08:48.257+03	2026-10-31 17:08:48.257+03
rp-production-perm-24	role-production	perm-24	2026-10-31 17:08:48.259+03	2026-10-31 17:08:48.259+03
rp-production-perm-25	role-production	perm-25	2026-10-31 17:08:48.26+03	2026-10-31 17:08:48.26+03
rp-production-perm-27	role-production	perm-27	2026-10-31 17:08:48.262+03	2026-10-31 17:08:48.262+03
rp-production-perm-34	role-production	perm-34	2026-10-31 17:08:48.264+03	2026-10-31 17:08:48.264+03
rp-admin-perm-38	role-admin	perm-38	2026-10-31 17:08:48.137+03	2026-10-31 17:08:48.137+03
rp-admin-perm-39	role-admin	perm-39	2026-10-31 17:08:48.14+03	2026-10-31 17:08:48.14+03
rp-admin-perm-40	role-admin	perm-40	2026-10-31 17:08:48.142+03	2026-10-31 17:08:48.142+03
rp-admin-perm-41	role-admin	perm-41	2026-10-31 17:08:48.144+03	2026-10-31 17:08:48.144+03
rp-admin-perm-42	role-admin	perm-42	2026-10-31 17:08:48.146+03	2026-10-31 17:08:48.146+03
rp-admin-perm-70	role-admin	perm-70	2026-10-31 17:08:48.222+03	2026-10-31 17:08:48.222+03
rp-admin-perm-47	role-admin	perm-47	2026-10-31 17:08:48.159+03	2026-10-31 17:08:48.159+03
rp-admin-perm-48	role-admin	perm-48	2026-10-31 17:08:48.162+03	2026-10-31 17:08:48.162+03
rp-admin-perm-49	role-admin	perm-49	2026-10-31 17:08:48.165+03	2026-10-31 17:08:48.165+03
rp-admin-perm-50	role-admin	perm-50	2026-10-31 17:08:48.168+03	2026-10-31 17:08:48.168+03
rp-suppliers-create-admin	role-admin	perm-suppliers-create	2026-10-31 20:20:21.046+03	2026-10-31 20:20:21.046+03
rp-suppliers-edit-admin	role-admin	perm-suppliers-edit	2026-10-31 20:20:21.046+03	2026-10-31 20:20:21.046+03
rp-suppliers-archive-admin	role-admin	perm-suppliers-archive	2026-10-31 20:20:21.046+03	2026-10-31 20:20:21.046+03
rp-admin-perm-4	role-admin	perm-4	2026-10-31 17:08:48.048+03	2026-10-31 17:08:48.048+03
rp-admin-perm-5	role-admin	perm-5	2026-10-31 17:08:48.05+03	2026-10-31 17:08:48.05+03
rp-admin-perm-6	role-admin	perm-6	2026-10-31 17:08:48.053+03	2026-10-31 17:08:48.053+03
rp-admin-perm-7	role-admin	perm-7	2026-10-31 17:08:48.056+03	2026-10-31 17:08:48.056+03
rp-admin-perm-8	role-admin	perm-8	2026-10-31 17:08:48.059+03	2026-10-31 17:08:48.059+03
rp-admin-perm-9	role-admin	perm-9	2026-10-31 17:08:48.062+03	2026-10-31 17:08:48.062+03
rp-admin-perm-3	role-admin	perm-3	2026-10-31 17:08:48.045+03	2026-10-31 17:08:48.045+03
rp-admin-perm-60	role-admin	perm-60	2026-10-31 17:08:48.196+03	2026-10-31 17:08:48.196+03
rp-admin-perm-61	role-admin	perm-61	2026-10-31 17:08:48.199+03	2026-10-31 17:08:48.199+03
rp-admin-perm-62	role-admin	perm-62	2026-10-31 17:08:48.201+03	2026-10-31 17:08:48.201+03
rp-admin-perm-63	role-admin	perm-63	2026-10-31 17:08:48.204+03	2026-10-31 17:08:48.204+03
rp-admin-perm-64	role-admin	perm-64	2026-10-31 17:08:48.207+03	2026-10-31 17:08:48.207+03
rp-admin-perm-65	role-admin	perm-65	2026-10-31 17:08:48.21+03	2026-10-31 17:08:48.21+03
rp-admin-perm-66	role-admin	perm-66	2026-10-31 17:08:48.213+03	2026-10-31 17:08:48.213+03
rp-admin-perm-67	role-admin	perm-67	2026-10-31 17:08:48.215+03	2026-10-31 17:08:48.215+03
rp-admin-perm-68	role-admin	perm-68	2026-10-31 17:08:48.217+03	2026-10-31 17:08:48.217+03
rp-admin-perm-59	role-admin	perm-59	2026-10-31 17:08:48.194+03	2026-10-31 17:08:48.194+03
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, name, label, active, granted_at, created_at, updated_at) FROM stdin;
role-csr	CSR	Customer Service Representative	t	2026-10-31 17:09:57.139+03	2026-10-31 17:09:57.139+03	2026-10-31 17:09:57.139+03
role-admin	Admin / Proprietor	Full business control	t	2026-10-31 17:08:48.021+03	2026-10-31 17:08:48.021+03	2026-10-31 17:08:48.021+03
role-production	Production Manager	Operational fulfillment	t	2026-10-31 17:08:48.021+03	2026-10-31 17:08:48.021+03	2026-10-31 17:08:48.021+03
role-sales	Sales Manager	Sales growth & commercial analytics	t	2026-10-31 17:08:48.021+03	2026-10-31 17:08:48.021+03	2026-10-31 17:08:48.021+03
\.


--
-- Data for Name: salary_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.salary_profiles (id, staff_id, basic_salary, payment_frequency, allowance_amount, deduction_amount, effective_from, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sessions (id, user_id, token_hash, created_at, expires_at, revoked_at, ip, user_agent) FROM stdin;
\.


--
-- Data for Name: staff; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.staff (id, staff_number, name, phone, email, job_title, employment_status, start_date, schedule, notes, user_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: staff_advances; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.staff_advances (id, staff_id, amount, repaid_amount, reason, advance_date, status, repayment_log, recorded_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: staff_attendance; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.staff_attendance (id, staff_id, date, status, hours, notes, recorded_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: stock_locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_locations (id, name, location, unit, reorder_level, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: stock_reservations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.stock_reservations (id, item_id, quantity, unit, order_id, reference, reserved_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: supplier_price_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.supplier_price_history (id, supplier_id, product_id, unit, price, effective_date, note, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.suppliers (id, business_name, contact_person, phone, email, address, products_supplied, payment_terms, notes, active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_roles (id, user_id, role_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, display_name, email, phone, role, is_admin, status, password_hash, notify, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: website_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.website_users (id, name, email, phone, password_hash, role, status, customer_id, last_login_at, created_at, updated_at) FROM stdin;
\.


--
-- Name: _migrations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public._migrations_id_seq', 27, true);


--
-- Name: invoice_lines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.invoice_lines_id_seq', 1, false);


--
-- Name: journal_entries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.journal_entries_id_seq', 45, true);


--
-- Name: journal_lines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.journal_lines_id_seq', 90, true);


--
-- Name: payment_allocations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.payment_allocations_id_seq', 1, false);


--
-- Name: provider_statement_lines_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.provider_statement_lines_id_seq', 1, false);


--
-- Name: _migrations _migrations_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._migrations
    ADD CONSTRAINT _migrations_name_key UNIQUE (name);


--
-- Name: _migrations _migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._migrations
    ADD CONSTRAINT _migrations_pkey PRIMARY KEY (id);


--
-- Name: accounting_periods accounting_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounting_periods
    ADD CONSTRAINT accounting_periods_pkey PRIMARY KEY (period);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (code);


--
-- Name: activation_codes activation_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activation_codes
    ADD CONSTRAINT activation_codes_pkey PRIMARY KEY (id);


--
-- Name: approvals approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.approvals
    ADD CONSTRAINT approvals_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: blog_categories blog_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blog_categories
    ADD CONSTRAINT blog_categories_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);


--
-- Name: cash_handovers cash_handovers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cash_handovers
    ADD CONSTRAINT cash_handovers_pkey PRIMARY KEY (id);


--
-- Name: catalogue_categories catalogue_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalogue_categories
    ADD CONSTRAINT catalogue_categories_pkey PRIMARY KEY (id);


--
-- Name: credit_notes credit_notes_credit_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_credit_no_key UNIQUE (credit_no);


--
-- Name: credit_notes credit_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_pkey PRIMARY KEY (id);


--
-- Name: customer_addresses customer_addresses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_pkey PRIMARY KEY (id);


--
-- Name: customer_event_reminders customer_event_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_event_reminders
    ADD CONSTRAINT customer_event_reminders_pkey PRIMARY KEY (id);


--
-- Name: customer_events customer_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_events
    ADD CONSTRAINT customer_events_pkey PRIMARY KEY (id);


--
-- Name: customer_feedback customer_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_feedback
    ADD CONSTRAINT customer_feedback_pkey PRIMARY KEY (id);


--
-- Name: customer_interactions customer_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_interactions
    ADD CONSTRAINT customer_interactions_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: deliveries deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_pkey PRIMARY KEY (id);


--
-- Name: document_counters document_counters_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.document_counters
    ADD CONSTRAINT document_counters_pkey PRIMARY KEY (kind, year);


--
-- Name: expense_categories expense_categories_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_name_key UNIQUE (name);


--
-- Name: expense_categories expense_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_categories
    ADD CONSTRAINT expense_categories_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: goods_receipt_items goods_receipt_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_pkey PRIMARY KEY (id);


--
-- Name: goods_receipts goods_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_pkey PRIMARY KEY (id);


--
-- Name: ingredient_defaults ingredient_defaults_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ingredient_defaults
    ADD CONSTRAINT ingredient_defaults_pkey PRIMARY KEY (id);


--
-- Name: ingredient_defaults ingredient_defaults_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ingredient_defaults
    ADD CONSTRAINT ingredient_defaults_sku_key UNIQUE (sku);


--
-- Name: inquiries inquiries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_sku_key UNIQUE (sku);


--
-- Name: inventory_transactions inventory_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_pkey PRIMARY KEY (id);


--
-- Name: invoice_lines invoice_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_invoice_no_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_invoice_no_key UNIQUE (invoice_no);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: journal_entries journal_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_pkey PRIMARY KEY (id);


--
-- Name: journal_entries journal_entries_source_type_source_id_memo_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_source_type_source_id_memo_key UNIQUE (source_type, source_id, memo);


--
-- Name: journal_lines journal_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_user_id_event_type_id_channel_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_event_type_id_channel_key UNIQUE (user_id, event_type_id, channel);


--
-- Name: notification_recipients notification_recipients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_recipients
    ADD CONSTRAINT notification_recipients_pkey PRIMARY KEY (id);


--
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: option_definitions option_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.option_definitions
    ADD CONSTRAINT option_definitions_pkey PRIMARY KEY (id);


--
-- Name: option_values option_values_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.option_values
    ADD CONSTRAINT option_values_pkey PRIMARY KEY (id);


--
-- Name: order_customer_snapshots order_customer_snapshots_order_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_customer_snapshots
    ADD CONSTRAINT order_customer_snapshots_order_id_key UNIQUE (order_id);


--
-- Name: order_customer_snapshots order_customer_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_customer_snapshots
    ADD CONSTRAINT order_customer_snapshots_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: order_proposal_items order_proposal_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_proposal_items
    ADD CONSTRAINT order_proposal_items_pkey PRIMARY KEY (id);


--
-- Name: order_proposals order_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_proposals
    ADD CONSTRAINT order_proposals_pkey PRIMARY KEY (id);


--
-- Name: order_status_history order_status_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: payment_allocations payment_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_allocations
    ADD CONSTRAINT payment_allocations_pkey PRIMARY KEY (id);


--
-- Name: payments payments_method_chk; Type: CHECK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE public.payments
    ADD CONSTRAINT payments_method_chk CHECK ((method = ANY (ARRAY['Cash'::text, 'MTN MoMo'::text, 'Airtel Money'::text, 'Bank Transfer'::text, 'M-Pesa'::text, 'Card'::text, 'Other'::text]))) NOT VALID;


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: payments payments_whole_ugx; Type: CHECK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE public.payments
    ADD CONSTRAINT payments_whole_ugx CHECK ((amount = round(amount))) NOT VALID;


--
-- Name: payslips payslips_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_key_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_key_key UNIQUE (key);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: product_types product_types_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_types
    ADD CONSTRAINT product_types_pkey PRIMARY KEY (id);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: production_consumption production_consumption_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_consumption
    ADD CONSTRAINT production_consumption_pkey PRIMARY KEY (id);


--
-- Name: production_costs production_costs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_costs
    ADD CONSTRAINT production_costs_pkey PRIMARY KEY (id);


--
-- Name: production_fixed_cost_categories production_fixed_cost_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_fixed_cost_categories
    ADD CONSTRAINT production_fixed_cost_categories_pkey PRIMARY KEY (id);


--
-- Name: production_fixed_cost_entries production_fixed_cost_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_fixed_cost_entries
    ADD CONSTRAINT production_fixed_cost_entries_pkey PRIMARY KEY (id);


--
-- Name: production_jobs production_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_jobs
    ADD CONSTRAINT production_jobs_pkey PRIMARY KEY (id);


--
-- Name: production_steps production_steps_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_steps
    ADD CONSTRAINT production_steps_pkey PRIMARY KEY (id);


--
-- Name: production_wastage production_wastage_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_wastage
    ADD CONSTRAINT production_wastage_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_sku_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_sku_key UNIQUE (sku);


--
-- Name: provider_statement_lines provider_statement_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_statement_lines
    ADD CONSTRAINT provider_statement_lines_pkey PRIMARY KEY (id);


--
-- Name: provider_statement_lines provider_statement_lines_provider_provider_ref_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_statement_lines
    ADD CONSTRAINT provider_statement_lines_provider_provider_ref_key UNIQUE (provider, provider_ref);


--
-- Name: purchase_order_items purchase_order_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_pkey PRIMARY KEY (id);


--
-- Name: purchase_orders purchase_orders_po_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_po_number_key UNIQUE (po_number);


--
-- Name: purchase_requirements purchase_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_requirements
    ADD CONSTRAINT purchase_requirements_pkey PRIMARY KEY (id);


--
-- Name: quality_checks quality_checks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quality_checks
    ADD CONSTRAINT quality_checks_pkey PRIMARY KEY (id);


--
-- Name: quotation_items quotation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_items
    ADD CONSTRAINT quotation_items_pkey PRIMARY KEY (id);


--
-- Name: quotations quotations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_pkey PRIMARY KEY (id);


--
-- Name: quotations quotations_quotation_number_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_quotation_number_key UNIQUE (quotation_number);


--
-- Name: recipe_items recipe_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_pkey PRIMARY KEY (id);


--
-- Name: recipe_versions recipe_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipe_versions
    ADD CONSTRAINT recipe_versions_pkey PRIMARY KEY (id);


--
-- Name: recipes recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_pkey PRIMARY KEY (id);


--
-- Name: remuneration_items remuneration_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.remuneration_items
    ADD CONSTRAINT remuneration_items_pkey PRIMARY KEY (id);


--
-- Name: remuneration_payments remuneration_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.remuneration_payments
    ADD CONSTRAINT remuneration_payments_pkey PRIMARY KEY (id);


--
-- Name: remuneration_periods remuneration_periods_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.remuneration_periods
    ADD CONSTRAINT remuneration_periods_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_role_id_permission_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_permission_id_key UNIQUE (role_id, permission_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: salary_profiles salary_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salary_profiles
    ADD CONSTRAINT salary_profiles_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: staff_advances staff_advances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_advances
    ADD CONSTRAINT staff_advances_pkey PRIMARY KEY (id);


--
-- Name: staff_attendance staff_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_attendance
    ADD CONSTRAINT staff_attendance_pkey PRIMARY KEY (id);


--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);


--
-- Name: stock_locations stock_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_locations
    ADD CONSTRAINT stock_locations_pkey PRIMARY KEY (id);


--
-- Name: stock_reservations stock_reservations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_pkey PRIMARY KEY (id);


--
-- Name: supplier_price_history supplier_price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_price_history
    ADD CONSTRAINT supplier_price_history_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_id_key UNIQUE (user_id, role_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: website_users website_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.website_users
    ADD CONSTRAINT website_users_pkey PRIMARY KEY (id);


--
-- Name: idx_activation_codes_code; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activation_codes_code ON public.activation_codes USING btree (code);


--
-- Name: idx_activation_codes_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activation_codes_type ON public.activation_codes USING btree (type);


--
-- Name: idx_activation_codes_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_activation_codes_user ON public.activation_codes USING btree (user_id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_entity ON public.audit_logs USING btree (entity_type, entity_id);


--
-- Name: idx_blog_categories_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blog_categories_order ON public.blog_categories USING btree (display_order);


--
-- Name: idx_blog_posts_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blog_posts_category ON public.blog_posts USING btree (category_id);


--
-- Name: idx_blog_posts_published; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blog_posts_published ON public.blog_posts USING btree (published_at);


--
-- Name: idx_blog_posts_slug; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_blog_posts_slug ON public.blog_posts USING btree (slug) WHERE (slug <> ''::text);


--
-- Name: idx_blog_posts_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_blog_posts_status ON public.blog_posts USING btree (status);


--
-- Name: idx_customer_addresses_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_addresses_customer ON public.customer_addresses USING btree (customer_id);


--
-- Name: idx_customer_event_reminders_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_event_reminders_customer ON public.customer_event_reminders USING btree (customer_id);


--
-- Name: idx_customer_event_reminders_event; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_event_reminders_event ON public.customer_event_reminders USING btree (event_id);


--
-- Name: idx_customer_event_reminders_next; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_event_reminders_next ON public.customer_event_reminders USING btree (next_reminder_at);


--
-- Name: idx_customer_events_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_events_customer ON public.customer_events USING btree (customer_id);


--
-- Name: idx_customer_events_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_events_date ON public.customer_events USING btree (event_date);


--
-- Name: idx_customer_events_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_events_order ON public.customer_events USING btree (order_id);


--
-- Name: idx_customer_feedback_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_feedback_customer ON public.customer_feedback USING btree (customer_id);


--
-- Name: idx_customer_interactions_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customer_interactions_customer ON public.customer_interactions USING btree (customer_id);


--
-- Name: idx_customers_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_name ON public.customers USING btree (name);


--
-- Name: idx_customers_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_customers_status ON public.customers USING btree (status);


--
-- Name: idx_deliveries_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deliveries_order ON public.deliveries USING btree (order_id);


--
-- Name: idx_deliveries_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_deliveries_status ON public.deliveries USING btree (status);


--
-- Name: idx_expenses_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expenses_category ON public.expenses USING btree (category_id);


--
-- Name: idx_expenses_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_expenses_date ON public.expenses USING btree (date);


--
-- Name: idx_fixed_cost_entries_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fixed_cost_entries_category ON public.production_fixed_cost_entries USING btree (category_id);


--
-- Name: idx_fixed_cost_entries_job; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_fixed_cost_entries_job ON public.production_fixed_cost_entries USING btree (job_id);


--
-- Name: idx_inquiries_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inquiries_customer ON public.inquiries USING btree (customer_id);


--
-- Name: idx_inquiries_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inquiries_status ON public.inquiries USING btree (status);


--
-- Name: idx_inventory_tx_item; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_tx_item ON public.inventory_transactions USING btree (item_id);


--
-- Name: idx_inventory_tx_type; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_inventory_tx_type ON public.inventory_transactions USING btree (type);


--
-- Name: idx_journal_lines_account; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_journal_lines_account ON public.journal_lines USING btree (account_code, entry_id);


--
-- Name: idx_journal_lines_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_journal_lines_order ON public.journal_lines USING btree (order_id);


--
-- Name: idx_notifications_entity; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_notifications_entity ON public.notifications USING btree (entity_type, entity_id);


--
-- Name: idx_order_customer_snapshots_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_customer_snapshots_customer ON public.order_customer_snapshots USING btree (customer_id);


--
-- Name: idx_order_items_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_items_order ON public.order_items USING btree (order_id);


--
-- Name: idx_order_proposal_items_proposal; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_proposal_items_proposal ON public.order_proposal_items USING btree (proposal_id);


--
-- Name: idx_order_proposals_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_proposals_created ON public.order_proposals USING btree (created_at);


--
-- Name: idx_order_proposals_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_proposals_customer ON public.order_proposals USING btree (customer_id);


--
-- Name: idx_order_proposals_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_proposals_status ON public.order_proposals USING btree (status);


--
-- Name: idx_order_status_history_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_order_status_history_order ON public.order_status_history USING btree (order_id);


--
-- Name: idx_orders_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_customer ON public.orders USING btree (customer_id);


--
-- Name: idx_orders_delivery_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_delivery_status ON public.orders USING btree (delivery_status);


--
-- Name: idx_orders_payment_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_payment_status ON public.orders USING btree (payment_status);


--
-- Name: idx_orders_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_orders_status ON public.orders USING btree (status);


--
-- Name: idx_payments_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payments_order ON public.payments USING btree (order_id);


--
-- Name: idx_payslips_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payslips_period ON public.payslips USING btree (period_id);


--
-- Name: idx_payslips_staff; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_payslips_staff ON public.payslips USING btree (staff_id);


--
-- Name: idx_production_jobs_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_production_jobs_order ON public.production_jobs USING btree (order_id);


--
-- Name: idx_production_jobs_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_production_jobs_status ON public.production_jobs USING btree (status);


--
-- Name: idx_products_category; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_products_category ON public.products USING btree (category_id);


--
-- Name: idx_purchase_orders_supplier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_purchase_orders_supplier ON public.purchase_orders USING btree (supplier_id);


--
-- Name: idx_quotation_items_quotation; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotation_items_quotation ON public.quotation_items USING btree (quotation_id);


--
-- Name: idx_quotations_customer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotations_customer ON public.quotations USING btree (customer_id);


--
-- Name: idx_quotations_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_quotations_status ON public.quotations USING btree (status);


--
-- Name: idx_remuneration_items_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_remuneration_items_period ON public.remuneration_items USING btree (period_id);


--
-- Name: idx_remuneration_items_staff; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_remuneration_items_staff ON public.remuneration_items USING btree (staff_id);


--
-- Name: idx_remuneration_payments_period; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_remuneration_payments_period ON public.remuneration_payments USING btree (period_id);


--
-- Name: idx_remuneration_payments_staff; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_remuneration_payments_staff ON public.remuneration_payments USING btree (staff_id);


--
-- Name: idx_remuneration_periods_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_remuneration_periods_status ON public.remuneration_periods USING btree (status);


--
-- Name: idx_salary_profiles_staff; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_salary_profiles_staff ON public.salary_profiles USING btree (staff_id);


--
-- Name: idx_sessions_expires; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sessions_expires ON public.sessions USING btree (expires_at);


--
-- Name: idx_sessions_token_hash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sessions_token_hash ON public.sessions USING btree (token_hash);


--
-- Name: idx_sessions_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_sessions_user ON public.sessions USING btree (user_id);


--
-- Name: idx_staff_advances_staff; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_advances_staff ON public.staff_advances USING btree (staff_id);


--
-- Name: idx_staff_advances_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_advances_status ON public.staff_advances USING btree (status);


--
-- Name: idx_staff_attendance_date; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_attendance_date ON public.staff_attendance USING btree (date);


--
-- Name: idx_staff_attendance_staff; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_attendance_staff ON public.staff_attendance USING btree (staff_id);


--
-- Name: idx_staff_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_staff_status ON public.staff USING btree (employment_status);


--
-- Name: idx_stock_reservations_item; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_reservations_item ON public.stock_reservations USING btree (item_id);


--
-- Name: idx_stock_reservations_order; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_stock_reservations_order ON public.stock_reservations USING btree (order_id);


--
-- Name: idx_supplier_price_supplier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_supplier_price_supplier ON public.supplier_price_history USING btree (supplier_id);


--
-- Name: idx_website_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX idx_website_users_email ON public.website_users USING btree (lower(email));


--
-- Name: idx_website_users_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_website_users_status ON public.website_users USING btree (status);


--
-- Name: uq_payments_idem; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_payments_idem ON public.payments USING btree (idempotency_key) WHERE (idempotency_key IS NOT NULL);


--
-- Name: uq_payments_ref; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX uq_payments_ref ON public.payments USING btree (method, reference) WHERE ((reference <> ''::text) AND (status <> 'FAILED'::text) AND (kind = 'PAYMENT'::text));


--
-- Name: users_email_unique; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX users_email_unique ON public.users USING btree (email) WHERE (email <> ''::text);


--
-- Name: journal_entries trg_je_guard; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_je_guard BEFORE INSERT OR DELETE OR UPDATE ON public.journal_entries FOR EACH ROW EXECUTE FUNCTION public.journal_guard();


--
-- Name: journal_lines trg_jl_guard; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_jl_guard BEFORE DELETE OR UPDATE ON public.journal_lines FOR EACH ROW EXECUTE FUNCTION public.journal_guard();


--
-- Name: payments trg_payments_append_only; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_payments_append_only BEFORE DELETE OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.payments_append_only();


--
-- Name: activation_codes activation_codes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activation_codes
    ADD CONSTRAINT activation_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: blog_posts blog_posts_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.blog_categories(id) ON DELETE SET NULL;


--
-- Name: credit_notes credit_notes_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credit_notes
    ADD CONSTRAINT credit_notes_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: customer_addresses customer_addresses_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_addresses
    ADD CONSTRAINT customer_addresses_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_event_reminders customer_event_reminders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_event_reminders
    ADD CONSTRAINT customer_event_reminders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_event_reminders customer_event_reminders_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_event_reminders
    ADD CONSTRAINT customer_event_reminders_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.customer_events(id) ON DELETE CASCADE;


--
-- Name: customer_event_reminders customer_event_reminders_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_event_reminders
    ADD CONSTRAINT customer_event_reminders_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: customer_events customer_events_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_events
    ADD CONSTRAINT customer_events_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_events customer_events_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_events
    ADD CONSTRAINT customer_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: customer_feedback customer_feedback_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_feedback
    ADD CONSTRAINT customer_feedback_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: customer_interactions customer_interactions_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.customer_interactions
    ADD CONSTRAINT customer_interactions_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;


--
-- Name: deliveries deliveries_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deliveries
    ADD CONSTRAINT deliveries_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;


--
-- Name: expenses expenses_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.expense_categories(id) ON DELETE RESTRICT;


--
-- Name: goods_receipt_items goods_receipt_items_goods_receipt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.goods_receipt_items
    ADD CONSTRAINT goods_receipt_items_goods_receipt_id_fkey FOREIGN KEY (goods_receipt_id) REFERENCES public.goods_receipts(id) ON DELETE CASCADE;


--
-- Name: goods_receipts goods_receipts_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.goods_receipts
    ADD CONSTRAINT goods_receipts_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE RESTRICT;


--
-- Name: inquiries inquiries_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inquiries
    ADD CONSTRAINT inquiries_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: inventory_transactions inventory_transactions_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.inventory_transactions
    ADD CONSTRAINT inventory_transactions_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE RESTRICT;


--
-- Name: invoice_lines invoice_lines_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoice_lines
    ADD CONSTRAINT invoice_lines_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: invoices invoices_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id);


--
-- Name: journal_entries journal_entries_period_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_period_fkey FOREIGN KEY (period) REFERENCES public.accounting_periods(period);


--
-- Name: journal_entries journal_entries_reverses_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_entries
    ADD CONSTRAINT journal_entries_reverses_entry_id_fkey FOREIGN KEY (reverses_entry_id) REFERENCES public.journal_entries(id);


--
-- Name: journal_lines journal_lines_account_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_account_code_fkey FOREIGN KEY (account_code) REFERENCES public.accounts(code);


--
-- Name: journal_lines journal_lines_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.journal_lines
    ADD CONSTRAINT journal_lines_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.journal_entries(id);


--
-- Name: notification_recipients notification_recipients_notification_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.notification_recipients
    ADD CONSTRAINT notification_recipients_notification_id_fkey FOREIGN KEY (notification_id) REFERENCES public.notifications(id) ON DELETE CASCADE;


--
-- Name: option_values option_values_option_def_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.option_values
    ADD CONSTRAINT option_values_option_def_id_fkey FOREIGN KEY (option_def_id) REFERENCES public.option_definitions(id) ON DELETE CASCADE;


--
-- Name: order_customer_snapshots order_customer_snapshots_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_customer_snapshots
    ADD CONSTRAINT order_customer_snapshots_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: order_customer_snapshots order_customer_snapshots_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_customer_snapshots
    ADD CONSTRAINT order_customer_snapshots_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: order_proposal_items order_proposal_items_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_proposal_items
    ADD CONSTRAINT order_proposal_items_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.order_proposals(id) ON DELETE CASCADE;


--
-- Name: order_proposals order_proposals_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_proposals
    ADD CONSTRAINT order_proposals_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- Name: order_proposals order_proposals_inquiry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_proposals
    ADD CONSTRAINT order_proposals_inquiry_id_fkey FOREIGN KEY (inquiry_id) REFERENCES public.inquiries(id) ON DELETE SET NULL;


--
-- Name: order_proposals order_proposals_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_proposals
    ADD CONSTRAINT order_proposals_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: order_status_history order_status_history_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.order_status_history
    ADD CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: orders orders_inquiry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_inquiry_id_fkey FOREIGN KEY (inquiry_id) REFERENCES public.inquiries(id) ON DELETE SET NULL;


--
-- Name: orders orders_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE SET NULL;


--
-- Name: payment_allocations payment_allocations_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_allocations
    ADD CONSTRAINT payment_allocations_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id);


--
-- Name: payment_allocations payment_allocations_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payment_allocations
    ADD CONSTRAINT payment_allocations_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id);


--
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;


--
-- Name: payments payments_reverses_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_reverses_payment_id_fkey FOREIGN KEY (reverses_payment_id) REFERENCES public.payments(id);


--
-- Name: payslips payslips_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.remuneration_items(id) ON DELETE SET NULL;


--
-- Name: payslips payslips_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.remuneration_periods(id) ON DELETE CASCADE;


--
-- Name: payslips payslips_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: product_types product_types_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_types
    ADD CONSTRAINT product_types_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.catalogue_categories(id) ON DELETE RESTRICT;


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.product_variants
    ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: production_consumption production_consumption_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_consumption
    ADD CONSTRAINT production_consumption_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.production_jobs(id) ON DELETE CASCADE;


--
-- Name: production_costs production_costs_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_costs
    ADD CONSTRAINT production_costs_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.production_jobs(id) ON DELETE CASCADE;


--
-- Name: production_fixed_cost_entries production_fixed_cost_entries_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_fixed_cost_entries
    ADD CONSTRAINT production_fixed_cost_entries_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.production_fixed_cost_categories(id) ON DELETE RESTRICT;


--
-- Name: production_fixed_cost_entries production_fixed_cost_entries_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_fixed_cost_entries
    ADD CONSTRAINT production_fixed_cost_entries_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.production_jobs(id) ON DELETE CASCADE;


--
-- Name: production_jobs production_jobs_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_jobs
    ADD CONSTRAINT production_jobs_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: production_jobs production_jobs_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_jobs
    ADD CONSTRAINT production_jobs_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;


--
-- Name: production_steps production_steps_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_steps
    ADD CONSTRAINT production_steps_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.production_jobs(id) ON DELETE CASCADE;


--
-- Name: production_wastage production_wastage_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.production_wastage
    ADD CONSTRAINT production_wastage_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.production_jobs(id) ON DELETE CASCADE;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.catalogue_categories(id) ON DELETE SET NULL;


--
-- Name: products products_product_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_product_type_id_fkey FOREIGN KEY (product_type_id) REFERENCES public.product_types(id) ON DELETE SET NULL;


--
-- Name: provider_statement_lines provider_statement_lines_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.provider_statement_lines
    ADD CONSTRAINT provider_statement_lines_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id);


--
-- Name: purchase_order_items purchase_order_items_purchase_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_order_items
    ADD CONSTRAINT purchase_order_items_purchase_order_id_fkey FOREIGN KEY (purchase_order_id) REFERENCES public.purchase_orders(id) ON DELETE CASCADE;


--
-- Name: purchase_orders purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.purchase_orders
    ADD CONSTRAINT purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE RESTRICT;


--
-- Name: quality_checks quality_checks_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quality_checks
    ADD CONSTRAINT quality_checks_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.production_jobs(id) ON DELETE CASCADE;


--
-- Name: quotation_items quotation_items_quotation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotation_items
    ADD CONSTRAINT quotation_items_quotation_id_fkey FOREIGN KEY (quotation_id) REFERENCES public.quotations(id) ON DELETE CASCADE;


--
-- Name: quotations quotations_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.quotations
    ADD CONSTRAINT quotations_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;


--
-- Name: recipe_items recipe_items_recipe_version_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipe_items
    ADD CONSTRAINT recipe_items_recipe_version_id_fkey FOREIGN KEY (recipe_version_id) REFERENCES public.recipe_versions(id) ON DELETE CASCADE;


--
-- Name: recipe_versions recipe_versions_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipe_versions
    ADD CONSTRAINT recipe_versions_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;


--
-- Name: recipes recipes_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;


--
-- Name: remuneration_items remuneration_items_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.remuneration_items
    ADD CONSTRAINT remuneration_items_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.remuneration_periods(id) ON DELETE CASCADE;


--
-- Name: remuneration_items remuneration_items_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.remuneration_items
    ADD CONSTRAINT remuneration_items_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: remuneration_payments remuneration_payments_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.remuneration_payments
    ADD CONSTRAINT remuneration_payments_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.remuneration_items(id) ON DELETE SET NULL;


--
-- Name: remuneration_payments remuneration_payments_period_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.remuneration_payments
    ADD CONSTRAINT remuneration_payments_period_id_fkey FOREIGN KEY (period_id) REFERENCES public.remuneration_periods(id) ON DELETE CASCADE;


--
-- Name: remuneration_payments remuneration_payments_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.remuneration_payments
    ADD CONSTRAINT remuneration_payments_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: salary_profiles salary_profiles_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.salary_profiles
    ADD CONSTRAINT salary_profiles_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: staff_advances staff_advances_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_advances
    ADD CONSTRAINT staff_advances_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: staff_attendance staff_attendance_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff_attendance
    ADD CONSTRAINT staff_attendance_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;


--
-- Name: staff staff_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: stock_reservations stock_reservations_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE RESTRICT;


--
-- Name: stock_reservations stock_reservations_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.stock_reservations
    ADD CONSTRAINT stock_reservations_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;


--
-- Name: supplier_price_history supplier_price_history_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.supplier_price_history
    ADD CONSTRAINT supplier_price_history_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: website_users website_users_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.website_users
    ADD CONSTRAINT website_users_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict dHmx9S8NCykZQjFJu8wWHaXkF51UgdpwQGZx2hbHurQ1nk5XHWS7gZs1O8IuIs6

