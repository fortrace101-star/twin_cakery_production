--
-- PostgreSQL database dump
--

\restrict yEg7Yu8Wt6Jszw67RZrAeLt9yPAOOe7bz3OnGBFsWk2A6qbhWEI7pcSZu0npD0F

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
    follow_up_completed_at timestamp with time zone
);


ALTER TABLE public.orders OWNER TO postgres;

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
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Data for Name: _migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._migrations (id, name, applied_at) FROM stdin;
1	001_core.sql	2026-10-08 19:19:35.57952+03
2	002_catalogue.sql	2026-10-08 19:19:36.04221+03
3	003_sales.sql	2026-10-08 19:19:36.130606+03
4	004_production.sql	2026-10-08 19:19:36.225194+03
5	005_inventory_purchasing.sql	2026-10-08 19:19:36.292874+03
6	006_finance_delivery.sql	2026-10-08 19:19:36.433221+03
7	007_delivery_actual_date.sql	2026-10-09 07:43:23.697376+03
8	008_order_history.sql	2026-10-10 00:41:47.862342+03
9	009_content.sql	2026-10-11 04:32:40.121546+03
10	010_inventory_cost.sql	2026-10-15 19:57:13.671601+03
11	011_order_follow_up.sql	2026-10-18 02:55:18.799735+03
12	012_missing_permissions.sql	2026-10-18 02:55:18.828116+03
13	013_production_consumption.sql	2026-10-19 20:56:06.628738+03
14	014_role_permissions.sql	2026-10-19 20:56:06.729588+03
15	015_missing_route_permissions.sql	2026-10-19 21:14:53.314337+03
16	016_public_order_proposals.sql	2026-10-20 15:39:11.888238+03
17	017_staff_remuneration.sql	2026-10-20 20:05:54.809707+03
18	018_activation_codes.sql	2026-10-23 11:10:20.501867+03
\.


--
-- Data for Name: activation_codes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.activation_codes (id, code, type, user_id, created_at, expires_at, used_at, used_by) FROM stdin;
c73f98ea-3146-4e1d-99b8-92b808b2a358	176562a4dc43dddd24e60bec25b52fb875d9dfeefed864dafbf370286262bf1d	admin	\N	2026-10-23 12:53:18.312186+03	2026-10-30 12:53:18.312186+03	\N	\N
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, order_id, actor, action, entity_type, entity_id, previous_status, new_status, reason, "timestamp", created_at, updated_at) FROM stdin;
audit-wipe-1792749198318	\N	system	wipe_production	system	production			Production wipe executed	2026-10-23 12:53:18.318719+03	2026-10-23 12:53:18.318719+03	2026-10-23 12:53:18.318719+03
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
-- Data for Name: catalogue_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.catalogue_categories (id, name, code, description, image, display_order, active, catalogue_visible, created_at, updated_at) FROM stdin;
cat-cupcakes	Cupcakes	CUPS	Cupcakes		3	t	t	2026-10-08 19:28:15.72+03	2026-10-08 19:28:15.72+03
cat-wedding	Wedding cakes	WED	Wedding tiers		4	t	t	2026-10-08 19:28:15.72+03	2026-10-08 19:28:15.72+03
cat-celebration	Celebration cakes	CELEB	Cakes for celebrations		1	t	t	2026-10-08 19:28:15.72+03	2026-10-08 19:28:15.72+03
cat-signature	Signature cakes	SIGN	House signatures		2	t	t	2026-10-08 19:28:15.72+03	2026-10-08 19:28:15.72+03
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
-- Data for Name: expense_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.expense_categories (id, name, created_at, updated_at) FROM stdin;
exp-ing	Ingredients	2026-10-08 19:28:15.812+03	2026-10-08 19:28:15.812+03
exp-pack	Packaging	2026-10-08 19:28:15.812+03	2026-10-08 19:28:15.812+03
exp-util	Utilities	2026-10-08 19:28:15.812+03	2026-10-08 19:28:15.812+03
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

COPY public.orders (id, order_number, customer_id, salesperson_id, subtotal, discount, delivery_charge, tax_amount, total, currency, required_by, required_at, notes, status, payment_status, delivery_status, quotation_id, inquiry_id, created_by, delivered_at, created_at, updated_at, follow_up_completed_at) FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payments (id, order_id, amount, method, date, reference, received_by, notes, created_at, updated_at) FROM stdin;
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
perm-inquiries-edit	inquiries.edit	2026-10-19 21:14:53.314+03	2026-10-19 21:14:53.314+03
perm-quotations-edit	quotations.edit	2026-10-19 21:14:53.314+03	2026-10-19 21:14:53.314+03
perm-staff-view	staff.view	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
perm-staff-manage	staff.manage	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
perm-staff-attendance	staff.attendance	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
perm-remuneration-view	remuneration.view	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
perm-remuneration-create	remuneration.create	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
perm-remuneration-edit	remuneration.edit	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
perm-remuneration-approve	remuneration.approve	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
perm-remuneration-process	remuneration.process	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
perm-remuneration-record-payment	remuneration.record_payment	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
perm-remuneration-close-period	remuneration.close_period	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
perm-remuneration-view-reports	remuneration.view_reports	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
perm-payslip-print	payslip.print	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
perm-deliveries-cancel	deliveries.cancel	2026-10-19 21:14:53.314+03	2026-10-19 21:14:53.314+03
perm-19-new	production.record_consumption	2026-10-19 12:15:55.652+03	2026-10-19 12:15:55.652+03
perm-feedback-update	feedback.update	2026-10-19 21:14:53.314+03	2026-10-19 21:14:53.314+03
perm-1	orders.view	2026-10-08 19:28:15.612+03	2026-10-08 19:28:15.612+03
perm-2	orders.create	2026-10-08 19:28:15.617+03	2026-10-08 19:28:15.617+03
perm-3	orders.confirm	2026-10-08 19:28:15.618+03	2026-10-08 19:28:15.618+03
perm-finance-view-reports	finance.view_reports	2026-10-19 21:14:53.314+03	2026-10-19 21:14:53.314+03
perm-10	products.create	2026-10-08 19:28:15.627+03	2026-10-08 19:28:15.627+03
perm-11	products.edit	2026-10-08 19:28:15.627+03	2026-10-08 19:28:15.627+03
perm-12	products.archive	2026-10-08 19:28:15.629+03	2026-10-08 19:28:15.629+03
perm-13	production.view	2026-10-08 19:28:15.63+03	2026-10-08 19:28:15.63+03
perm-14	production.schedule	2026-10-08 19:28:15.631+03	2026-10-08 19:28:15.631+03
perm-15	production.start	2026-10-08 19:28:15.632+03	2026-10-08 19:28:15.632+03
perm-16	production.complete	2026-10-08 19:28:15.632+03	2026-10-08 19:28:15.632+03
perm-17	production.quality_check	2026-10-08 19:28:15.633+03	2026-10-08 19:28:15.633+03
perm-18	production.record_wastage	2026-10-08 19:28:15.633+03	2026-10-08 19:28:15.633+03
perm-19	inventory.view	2026-10-08 19:28:15.634+03	2026-10-08 19:28:15.634+03
perm-20	inventory.adjust	2026-10-08 19:28:15.635+03	2026-10-08 19:28:15.635+03
perm-21	inventory.reserve	2026-10-08 19:28:15.635+03	2026-10-08 19:28:15.635+03
perm-22	inventory.consume	2026-10-08 19:28:15.636+03	2026-10-08 19:28:15.636+03
perm-23	purchasing.view	2026-10-08 19:28:15.636+03	2026-10-08 19:28:15.636+03
perm-24	purchasing.create	2026-10-08 19:28:15.637+03	2026-10-08 19:28:15.637+03
perm-25	purchasing.approve	2026-10-08 19:28:15.637+03	2026-10-08 19:28:15.637+03
perm-26	purchasing.receive	2026-10-08 19:28:15.638+03	2026-10-08 19:28:15.638+03
perm-27	finance.view	2026-10-08 19:28:15.638+03	2026-10-08 19:28:15.638+03
perm-28	finance.record_payment	2026-10-08 19:28:15.639+03	2026-10-08 19:28:15.639+03
perm-29	finance.record_expense	2026-10-08 19:28:15.639+03	2026-10-08 19:28:15.639+03
perm-30	payments.view	2026-10-08 19:28:15.64+03	2026-10-08 19:28:15.64+03
perm-31	payments.record	2026-10-08 19:28:15.64+03	2026-10-08 19:28:15.64+03
perm-32	deliveries.view	2026-10-08 19:28:15.641+03	2026-10-08 19:28:15.641+03
perm-33	deliveries.create	2026-10-08 19:28:15.641+03	2026-10-08 19:28:15.641+03
perm-34	deliveries.dispatch	2026-10-08 19:28:15.642+03	2026-10-08 19:28:15.642+03
perm-4	orders.cancel	2026-10-08 19:28:15.619+03	2026-10-08 19:28:15.619+03
perm-5	customers.view	2026-10-08 19:28:15.621+03	2026-10-08 19:28:15.621+03
perm-6	customers.create	2026-10-08 19:28:15.622+03	2026-10-08 19:28:15.622+03
perm-7	customers.edit	2026-10-08 19:28:15.623+03	2026-10-08 19:28:15.623+03
perm-8	customers.interact	2026-10-08 19:28:15.624+03	2026-10-08 19:28:15.624+03
perm-9	products.view	2026-10-08 19:28:15.626+03	2026-10-08 19:28:15.626+03
perm-45	catalogue.edit	2026-10-08 19:28:15.65+03	2026-10-08 19:28:15.65+03
perm-46	catalogue.archive	2026-10-08 19:28:15.651+03	2026-10-08 19:28:15.651+03
perm-47	quotations.view	2026-10-08 19:28:15.651+03	2026-10-08 19:28:15.651+03
perm-35	deliveries.complete	2026-10-08 19:28:15.643+03	2026-10-08 19:28:15.643+03
perm-36	feedback.view	2026-10-08 19:28:15.643+03	2026-10-08 19:28:15.643+03
perm-37	feedback.create	2026-10-08 19:28:15.644+03	2026-10-08 19:28:15.644+03
perm-38	feedback.resolve	2026-10-08 19:28:15.646+03	2026-10-08 19:28:15.646+03
perm-39	users.manage	2026-10-08 19:28:15.647+03	2026-10-08 19:28:15.647+03
perm-40	roles.manage	2026-10-08 19:28:15.648+03	2026-10-08 19:28:15.648+03
perm-41	settings.manage	2026-10-08 19:28:15.648+03	2026-10-08 19:28:15.648+03
perm-42	audit.view	2026-10-08 19:28:15.649+03	2026-10-08 19:28:15.649+03
perm-43	catalogue.view	2026-10-08 19:28:15.649+03	2026-10-08 19:28:15.649+03
perm-48	quotations.create	2026-10-08 19:28:15.652+03	2026-10-08 19:28:15.652+03
perm-49	quotations.accept	2026-10-08 19:28:15.652+03	2026-10-08 19:28:15.652+03
perm-50	inquiries.view	2026-10-08 19:28:15.653+03	2026-10-08 19:28:15.653+03
perm-51	inquiries.create	2026-10-08 19:28:15.653+03	2026-10-08 19:28:15.653+03
perm-52	sales.analytics	2026-10-08 19:28:15.654+03	2026-10-08 19:28:15.654+03
perm-content-1	content.view	2026-10-11 04:34:45.296+03	2026-10-11 04:34:45.296+03
perm-content-2	content.create	2026-10-11 04:34:45.35+03	2026-10-11 04:34:45.35+03
perm-content-3	content.edit	2026-10-11 04:34:45.354+03	2026-10-11 04:34:45.354+03
perm-44	catalogue.create	2026-10-08 19:28:15.65+03	2026-10-08 19:28:15.65+03
\.


--
-- Data for Name: product_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.product_types (id, category_id, name, code, description, display_order, active, catalogue_visible, created_at, updated_at) FROM stdin;
pt-cupcake	cat-cupcakes	Cupcake	CUPS		1	t	t	2026-10-08 19:28:15.722+03	2026-10-08 19:28:15.722+03
pt-wedding	cat-wedding	Wedding	WED		1	t	t	2026-10-08 19:28:15.722+03	2026-10-08 19:28:15.722+03
pt-celebration	cat-celebration	Celebration	CELEB		1	t	t	2026-10-08 19:28:15.722+03	2026-10-08 19:28:15.722+03
pt-signature	cat-signature	Signature	SIGN		1	t	t	2026-10-08 19:28:15.722+03	2026-10-08 19:28:15.722+03
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
rp-sales-perm-5	role-sales	perm-5	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-sales-perm-6	role-sales	perm-6	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-sales-perm-7	role-sales	perm-7	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-sales-perm-30	role-sales	perm-30	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-sales-perm-31	role-sales	perm-31	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-sales-perm-32	role-sales	perm-32	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-sales-perm-36	role-sales	perm-36	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-sales-perm-37	role-sales	perm-37	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-sales-perm-43	role-sales	perm-43	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-sales-perm-47	role-sales	perm-47	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-sales-perm-48	role-sales	perm-48	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-sales-perm-49	role-sales	perm-49	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-sales-perm-50	role-sales	perm-50	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-sales-perm-51	role-sales	perm-51	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-production-perm-19-new	role-production	perm-19-new	2026-10-19 20:56:06.628+03	2026-10-19 20:56:06.628+03
rp-prod-perm-1	role-production	perm-1	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-prod-perm-3	role-production	perm-3	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-admin-perm-staff-manage	role-admin	perm-staff-manage	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
rp-admin-perm-staff-attendance	role-admin	perm-staff-attendance	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
rp-admin-perm-remuneration-view	role-admin	perm-remuneration-view	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
rp-admin-perm-remuneration-create	role-admin	perm-remuneration-create	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
rp-admin-perm-remuneration-edit	role-admin	perm-remuneration-edit	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
rp-admin-perm-remuneration-approve	role-admin	perm-remuneration-approve	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
rp-admin-perm-remuneration-process	role-admin	perm-remuneration-process	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
rp-1792512963076-vuz5ua	role-admin	perm-52	2026-10-20 19:16:03.076+03	2026-10-20 19:16:03.076+03
rp-1792512963948-sov84k	role-admin	perm-content-3	2026-10-20 19:16:03.948+03	2026-10-20 19:16:03.949+03
rp-admin-perm-remuneration-record-payment	role-admin	perm-remuneration-record-payment	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
rp-admin-perm-remuneration-close-period	role-admin	perm-remuneration-close-period	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
rp-admin-perm-remuneration-view-reports	role-admin	perm-remuneration-view-reports	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
rp-admin-perm-payslip-print	role-admin	perm-payslip-print	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
rp-prod-perm-staff-view	role-production	perm-staff-view	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
rp-admin-perm-staff-view	role-admin	perm-staff-view	2026-10-20 20:05:54.809+03	2026-10-20 20:05:54.809+03
rp-sales-perm-2	role-sales	perm-2	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-sales-perm-3	role-sales	perm-3	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-sales-perm-4	role-sales	perm-4	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-csr-perm-feedback-update	role-csr	perm-feedback-update	2026-10-19 21:14:53.314+03	2026-10-19 21:14:53.314+03
rp-prod-perm-20	role-production	perm-20	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-prod-perm-21	role-production	perm-21	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-prod-perm-22	role-production	perm-22	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-admin-perm-deliveries-cancel	role-admin	perm-deliveries-cancel	2026-10-19 21:14:53.314+03	2026-10-19 21:14:53.314+03
rp-admin-perm-feedback-update	role-admin	perm-feedback-update	2026-10-19 21:14:53.314+03	2026-10-19 21:14:53.314+03
rp-admin-perm-finance-view-reports	role-admin	perm-finance-view-reports	2026-10-19 21:14:53.314+03	2026-10-19 21:14:53.314+03
rp-admin-perm-inquiries-edit	role-admin	perm-inquiries-edit	2026-10-19 21:14:53.314+03	2026-10-19 21:14:53.314+03
rp-admin-perm-quotations-edit	role-admin	perm-quotations-edit	2026-10-19 21:14:53.314+03	2026-10-19 21:14:53.314+03
rp-prod-perm-deliveries-cancel	role-production	perm-deliveries-cancel	2026-10-19 21:14:53.314+03	2026-10-19 21:14:53.314+03
rp-sales-perm-inquiries-edit	role-sales	perm-inquiries-edit	2026-10-19 21:14:53.314+03	2026-10-19 21:14:53.314+03
rp-sales-perm-quotations-edit	role-sales	perm-quotations-edit	2026-10-19 21:14:53.314+03	2026-10-19 21:14:53.314+03
rp-prod-perm-5	role-production	perm-5	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-prod-perm-13	role-production	perm-13	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-prod-perm-14	role-production	perm-14	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-prod-perm-15	role-production	perm-15	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-prod-perm-16	role-production	perm-16	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-prod-perm-17	role-production	perm-17	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-prod-perm-18	role-production	perm-18	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-prod-perm-19	role-production	perm-19	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-sales-perm-52	role-sales	perm-52	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-csr-perm-1	role-csr	perm-1	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-csr-perm-5	role-csr	perm-5	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-csr-perm-6	role-csr	perm-6	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-csr-perm-8	role-csr	perm-8	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-csr-perm-36	role-csr	perm-36	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-admin-23	role-admin	perm-23	2026-10-08 19:28:15.684+03	2026-10-08 19:28:15.684+03
rp-admin-24	role-admin	perm-24	2026-10-08 19:28:15.685+03	2026-10-08 19:28:15.685+03
rp-admin-25	role-admin	perm-25	2026-10-08 19:28:15.686+03	2026-10-08 19:28:15.686+03
rp-admin-26	role-admin	perm-26	2026-10-08 19:28:15.686+03	2026-10-08 19:28:15.686+03
rp-admin-27	role-admin	perm-27	2026-10-08 19:28:15.687+03	2026-10-08 19:28:15.687+03
rp-admin-45	role-admin	perm-45	2026-10-08 19:28:15.699+03	2026-10-08 19:28:15.699+03
rp-admin-46	role-admin	perm-46	2026-10-08 19:28:15.699+03	2026-10-08 19:28:15.699+03
rp-admin-47	role-admin	perm-47	2026-10-08 19:28:15.7+03	2026-10-08 19:28:15.7+03
rp-admin-48	role-admin	perm-48	2026-10-08 19:28:15.7+03	2026-10-08 19:28:15.7+03
rp-admin-49	role-admin	perm-49	2026-10-08 19:28:15.701+03	2026-10-08 19:28:15.701+03
rp-admin-50	role-admin	perm-50	2026-10-08 19:28:15.701+03	2026-10-08 19:28:15.701+03
rp-admin-51	role-admin	perm-51	2026-10-08 19:28:15.702+03	2026-10-08 19:28:15.702+03
rp-content-admin-1	role-admin	perm-content-1	2026-10-11 04:34:45.326+03	2026-10-11 04:34:45.326+03
rp-content-admin-2	role-admin	perm-content-2	2026-10-11 04:34:45.351+03	2026-10-11 04:34:45.351+03
rp-admin-28	role-admin	perm-28	2026-10-08 19:28:15.688+03	2026-10-08 19:28:15.688+03
rp-csr-perm-37	role-csr	perm-37	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-csr-perm-43	role-csr	perm-43	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-csr-perm-47	role-csr	perm-47	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-admin-22	role-admin	perm-22	2026-10-08 19:28:15.683+03	2026-10-08 19:28:15.683+03
rp-csr-perm-50	role-csr	perm-50	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-csr-perm-51	role-csr	perm-51	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-admin-19-new	role-admin	perm-19-new	2026-10-19 12:15:57.212+03	2026-10-19 12:15:57.212+03
rp-admin-3	role-admin	perm-3	2026-10-08 19:28:15.67+03	2026-10-08 19:28:15.67+03
rp-admin-4	role-admin	perm-4	2026-10-08 19:28:15.671+03	2026-10-08 19:28:15.671+03
rp-prod-perm-23	role-production	perm-23	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-prod-perm-24	role-production	perm-24	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-prod-perm-26	role-production	perm-26	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-prod-perm-32	role-production	perm-32	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-prod-perm-33	role-production	perm-33	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-prod-perm-34	role-production	perm-34	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-prod-perm-35	role-production	perm-35	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-prod-perm-43	role-production	perm-43	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-sales-perm-1	role-sales	perm-1	2026-10-19 20:56:06.729+03	2026-10-19 20:56:06.729+03
rp-admin-21	role-admin	perm-21	2026-10-08 19:28:15.683+03	2026-10-08 19:28:15.683+03
rp-admin-14	role-admin	perm-14	2026-10-08 19:28:15.678+03	2026-10-08 19:28:15.678+03
rp-admin-15	role-admin	perm-15	2026-10-08 19:28:15.679+03	2026-10-08 19:28:15.679+03
rp-admin-16	role-admin	perm-16	2026-10-08 19:28:15.68+03	2026-10-08 19:28:15.68+03
rp-admin-17	role-admin	perm-17	2026-10-08 19:28:15.68+03	2026-10-08 19:28:15.68+03
rp-admin-18	role-admin	perm-18	2026-10-08 19:28:15.681+03	2026-10-08 19:28:15.681+03
rp-admin-19	role-admin	perm-19	2026-10-08 19:28:15.682+03	2026-10-08 19:28:15.682+03
rp-admin-20	role-admin	perm-20	2026-10-08 19:28:15.682+03	2026-10-08 19:28:15.682+03
rp-admin-5	role-admin	perm-5	2026-10-08 19:28:15.672+03	2026-10-08 19:28:15.672+03
rp-admin-6	role-admin	perm-6	2026-10-08 19:28:15.672+03	2026-10-08 19:28:15.672+03
rp-admin-1	role-admin	perm-1	2026-10-08 19:28:15.666+03	2026-10-08 19:28:15.666+03
rp-admin-2	role-admin	perm-2	2026-10-08 19:28:15.669+03	2026-10-08 19:28:15.669+03
rp-admin-7	role-admin	perm-7	2026-10-08 19:28:15.673+03	2026-10-08 19:28:15.673+03
rp-admin-8	role-admin	perm-8	2026-10-08 19:28:15.674+03	2026-10-08 19:28:15.674+03
rp-admin-9	role-admin	perm-9	2026-10-08 19:28:15.674+03	2026-10-08 19:28:15.674+03
rp-admin-10	role-admin	perm-10	2026-10-08 19:28:15.675+03	2026-10-08 19:28:15.675+03
rp-admin-11	role-admin	perm-11	2026-10-08 19:28:15.676+03	2026-10-08 19:28:15.676+03
rp-admin-12	role-admin	perm-12	2026-10-08 19:28:15.676+03	2026-10-08 19:28:15.676+03
rp-admin-13	role-admin	perm-13	2026-10-08 19:28:15.677+03	2026-10-08 19:28:15.677+03
rp-admin-29	role-admin	perm-29	2026-10-08 19:28:15.688+03	2026-10-08 19:28:15.688+03
rp-admin-30	role-admin	perm-30	2026-10-08 19:28:15.689+03	2026-10-08 19:28:15.689+03
rp-admin-31	role-admin	perm-31	2026-10-08 19:28:15.689+03	2026-10-08 19:28:15.689+03
rp-admin-32	role-admin	perm-32	2026-10-08 19:28:15.69+03	2026-10-08 19:28:15.69+03
rp-admin-33	role-admin	perm-33	2026-10-08 19:28:15.69+03	2026-10-08 19:28:15.69+03
rp-admin-34	role-admin	perm-34	2026-10-08 19:28:15.691+03	2026-10-08 19:28:15.691+03
rp-admin-35	role-admin	perm-35	2026-10-08 19:28:15.692+03	2026-10-08 19:28:15.692+03
rp-admin-36	role-admin	perm-36	2026-10-08 19:28:15.692+03	2026-10-08 19:28:15.692+03
rp-admin-37	role-admin	perm-37	2026-10-08 19:28:15.693+03	2026-10-08 19:28:15.693+03
rp-admin-38	role-admin	perm-38	2026-10-08 19:28:15.693+03	2026-10-08 19:28:15.693+03
rp-admin-39	role-admin	perm-39	2026-10-08 19:28:15.694+03	2026-10-08 19:28:15.694+03
rp-admin-40	role-admin	perm-40	2026-10-08 19:28:15.696+03	2026-10-08 19:28:15.696+03
rp-admin-41	role-admin	perm-41	2026-10-08 19:28:15.696+03	2026-10-08 19:28:15.696+03
rp-admin-42	role-admin	perm-42	2026-10-08 19:28:15.697+03	2026-10-08 19:28:15.697+03
rp-admin-43	role-admin	perm-43	2026-10-08 19:28:15.698+03	2026-10-08 19:28:15.698+03
rp-admin-44	role-admin	perm-44	2026-10-08 19:28:15.698+03	2026-10-08 19:28:15.698+03
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.roles (id, name, label, active, granted_at, created_at, updated_at) FROM stdin;
role-csr	Customer Service Representative	Inbound support	t	2026-10-08 19:28:15.606+03	2026-10-08 19:28:15.606+03	2026-10-08 19:28:15.606+03
role-admin	Admin / Proprietor	Full business control	t	2026-10-08 19:28:15.606+03	2026-10-08 19:28:15.606+03	2026-10-08 19:28:15.606+03
role-production	Production Manager	Operational fulfillment	t	2026-10-08 19:28:15.606+03	2026-10-08 19:28:15.606+03	2026-10-08 19:28:15.606+03
role-sales	Sales Manager	Sales growth & commercial analytics	t	2026-10-08 19:28:15.606+03	2026-10-08 19:28:15.606+03	2026-10-08 19:28:15.606+03
\.


--
-- Data for Name: salary_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.salary_profiles (id, staff_id, basic_salary, payment_frequency, allowance_amount, deduction_amount, effective_from, notes, created_at, updated_at) FROM stdin;
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

SELECT pg_catalog.setval('public._migrations_id_seq', 18, true);


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
-- Name: activation_codes activation_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.activation_codes
    ADD CONSTRAINT activation_codes_pkey PRIMARY KEY (id);


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
-- Name: catalogue_categories catalogue_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.catalogue_categories
    ADD CONSTRAINT catalogue_categories_pkey PRIMARY KEY (id);


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
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


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
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


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
-- Name: payments payments_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT;


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

\unrestrict yEg7Yu8Wt6Jszw67RZrAeLt9yPAOOe7bz3OnGBFsWk2A6qbhWEI7pcSZu0npD0F

