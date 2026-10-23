--
-- PostgreSQL database dump
--

\restrict obc0kZZ6lwLX53mw59aqDErQMFwjZRb3cUp9SDTcgdL0UYeqiZLayaw0bHcFSzc

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
805c60c8-b1d8-4dce-bcda-2167778335a1	c85fcf30eb2cddaffade7810f0f047483ef34f69b1d65c4b668755713b5dc740	admin	\N	2026-10-23 11:11:13.455371+03	2026-10-30 11:11:13.455371+03	\N	\N
8b9efb2f-2660-48ec-980d-c01225797668	b3180efdaa8b2f35245693ac4d18779df28143117f781cac0ee303ab80619029	staff	\N	2026-10-23 11:11:22.186365+03	2026-10-30 11:11:22.186365+03	\N	\N
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, order_id, actor, action, entity_type, entity_id, previous_status, new_status, reason, "timestamp", created_at, updated_at) FROM stdin;
aud-1792528410661-2304		usr-manager	remuneration:calculated	remuneration_period	rper-1792528409177-dcab			1 salary line(s) calculated	2026-10-20 23:33:30.661+03	2026-10-20 23:33:30.661+03	2026-10-20 23:33:30.661+03
aud-1792528471234-554d	order-1792528470024-d84e	usr-manager	order:confirmed			CONFIRMED	CONFIRMED	Admin confirmed order	2026-10-20 23:34:31.231+03	2026-10-20 23:34:31.234+03	2026-10-20 23:34:31.234+03
audit-ord-1045	ord-1045	usr-manager	order:status_changed	order	ord-1045	INQUIRY	IN_PRODUCTION	Seeded order	2026-10-08 19:28:15.794+03	2026-10-08 19:28:15.794+03	2026-10-08 19:28:15.794+03
audit-ord-1044	ord-1044	usr-manager	order:status_changed	order	ord-1044	INQUIRY	AWAITING_CONFIRMATION	Seeded order	2026-10-08 19:28:15.801+03	2026-10-08 19:28:15.801+03	2026-10-08 19:28:15.801+03
aud-1792526992030-f967		usr-manager	remuneration:calculated	remuneration_period	rper-1792526990847-9a64			1 salary line(s) calculated	2026-10-20 23:09:52.03+03	2026-10-20 23:09:52.03+03	2026-10-20 23:09:52.03+03
aud-1792527794567-53ba		usr-manager	role:permission_changed	role	role-csr		GRANTED	Customer Service Representative: quotations.create	2026-10-20 23:23:14.567+03	2026-10-20 23:23:14.567+03	2026-10-20 23:23:14.567+03
aud-1792527796105-423e		usr-manager	role:permission_changed	role	role-csr		REVOKED	Customer Service Representative: quotations.create	2026-10-20 23:23:16.105+03	2026-10-20 23:23:16.105+03	2026-10-20 23:23:16.105+03
aud-1792527797672-30e8		usr-manager	product:updated	product	prod-choc			Chocolate celebration cake: price 45000 → 46000	2026-10-20 23:23:17.672+03	2026-10-20 23:23:17.672+03	2026-10-20 23:23:17.672+03
aud-1792527799171-ca46		usr-manager	product:updated	product	prod-choc			Chocolate celebration cake: price 46000 → 45000	2026-10-20 23:23:19.171+03	2026-10-20 23:23:19.171+03	2026-10-20 23:23:19.171+03
audit-ord-1043	ord-1043	usr-manager	order:status_changed	order	ord-1043	INQUIRY	COMPLETED	Seeded order	2026-10-08 19:28:15.806+03	2026-10-08 19:28:15.806+03	2026-10-08 19:28:15.806+03
aud-1792528117486-96b3		usr-manager	product:updated	product	prod-choc			Chocolate celebration cake: price 45000 → 46000	2026-10-20 23:28:37.486+03	2026-10-20 23:28:37.486+03	2026-10-20 23:28:37.486+03
aud-1792604268224-8f21	order-1792421475419-e072	usr-manager	payment:created	payment	pay-1792604268223-d35a			Cash · order order-1792421475419-e072	2026-10-21 20:37:48.224+03	2026-10-21 20:37:48.224+03	2026-10-21 20:37:48.224+03
aud-1792528118944-07b9		usr-manager	product:updated	product	prod-choc			Chocolate celebration cake: price 46000 → 45000	2026-10-20 23:28:38.944+03	2026-10-20 23:28:38.944+03	2026-10-20 23:28:38.944+03
audit-ord-1048	ord-1048	usr-manager	order:status_changed	order	ord-1048	INQUIRY	CONFIRMED	Seeded order	2026-10-08 19:28:15.774+03	2026-10-08 19:28:15.774+03	2026-10-08 19:28:15.774+03
audit-ord-1047	ord-1047	usr-manager	order:status_changed	order	ord-1047	INQUIRY	READY_FOR_DELIVERY	Seeded order	2026-10-08 19:28:15.784+03	2026-10-08 19:28:15.784+03	2026-10-08 19:28:15.784+03
audit-ord-1046	ord-1046	usr-manager	order:status_changed	order	ord-1046	INQUIRY	CONFIRMED	Seeded order	2026-10-08 19:28:15.789+03	2026-10-08 19:28:15.789+03	2026-10-08 19:28:15.789+03
aud-1792527977771-9745		usr-manager	product:updated	product	prod-choc			Chocolate celebration cake: price 46000 → 45000	2026-10-20 23:26:17.771+03	2026-10-20 23:26:17.771+03	2026-10-20 23:26:17.771+03
aud-1792527087020-a391		usr-manager	role:permission_changed	role	role-csr		GRANTED	Customer Service Representative: quotations.create	2026-10-20 23:11:27.02+03	2026-10-20 23:11:27.02+03	2026-10-20 23:11:27.02+03
aud-1792527088524-3f83		usr-manager	role:permission_changed	role	role-csr		REVOKED	Customer Service Representative: quotations.create	2026-10-20 23:11:28.524+03	2026-10-20 23:11:28.524+03	2026-10-20 23:11:28.524+03
aud-1792527089949-f744		usr-manager	product:updated	product	prod-choc			Chocolate celebration cake: price 45000 → 46000	2026-10-20 23:11:29.949+03	2026-10-20 23:11:29.949+03	2026-10-20 23:11:29.949+03
aud-1792528114640-e696		usr-manager	role:permission_changed	role	role-csr		GRANTED	Customer Service Representative: quotations.create	2026-10-20 23:28:34.64+03	2026-10-20 23:28:34.64+03	2026-10-20 23:28:34.64+03
aud-1792528115941-03bc		usr-manager	role:permission_changed	role	role-csr		REVOKED	Customer Service Representative: quotations.create	2026-10-20 23:28:35.941+03	2026-10-20 23:28:35.941+03	2026-10-20 23:28:35.941+03
aud-1792528614312-ee64		usr-manager	role:permission_changed	role	role-csr		GRANTED	Customer Service Representative: quotations.create	2026-10-20 23:36:54.312+03	2026-10-20 23:36:54.312+03	2026-10-20 23:36:54.312+03
aud-1792528615943-a160		usr-manager	role:permission_changed	role	role-csr		REVOKED	Customer Service Representative: quotations.create	2026-10-20 23:36:55.943+03	2026-10-20 23:36:55.943+03	2026-10-20 23:36:55.943+03
aud-1792528617742-2d00		usr-manager	product:updated	product	prod-carrot			Carrot cake: price 3200 → 4200	2026-10-20 23:36:57.742+03	2026-10-20 23:36:57.742+03	2026-10-20 23:36:57.742+03
aud-1792528619586-d152		usr-manager	product:updated	product	prod-carrot			Carrot cake: price 4200 → 3200	2026-10-20 23:36:59.586+03	2026-10-20 23:36:59.586+03	2026-10-20 23:36:59.586+03
aud-1792527091294-c0c9		usr-manager	product:updated	product	prod-choc			Chocolate celebration cake: price 46000 → 45000	2026-10-20 23:11:31.294+03	2026-10-20 23:11:31.294+03	2026-10-20 23:11:31.294+03
aud-1792527974413-f2aa		usr-manager	role:permission_changed	role	role-csr		GRANTED	Customer Service Representative: quotations.create	2026-10-20 23:26:14.413+03	2026-10-20 23:26:14.413+03	2026-10-20 23:26:14.413+03
aud-1792527975505-974f		usr-manager	role:permission_changed	role	role-csr		REVOKED	Customer Service Representative: quotations.create	2026-10-20 23:26:15.505+03	2026-10-20 23:26:15.505+03	2026-10-20 23:26:15.505+03
aud-1792527976643-0b38		usr-manager	product:updated	product	prod-choc			Chocolate celebration cake: price 45000 → 46000	2026-10-20 23:26:16.643+03	2026-10-20 23:26:16.643+03	2026-10-20 23:26:16.643+03
aud-1792534742521-3714		usr-manager	role:permission_changed	role	role-csr		GRANTED	Customer Service Representative: quotations.create	2026-10-21 01:19:02.521+03	2026-10-21 01:19:02.521+03	2026-10-21 01:19:02.521+03
aud-1792534743946-8bb3		usr-manager	role:permission_changed	role	role-csr		REVOKED	Customer Service Representative: quotations.create	2026-10-21 01:19:03.946+03	2026-10-21 01:19:03.946+03	2026-10-21 01:19:03.946+03
aud-1792534745230-906d		usr-manager	product:updated	product	prod-vanilla			Vanilla cupcakes: price 2400 → 3400	2026-10-21 01:19:05.23+03	2026-10-21 01:19:05.23+03	2026-10-21 01:19:05.23+03
aud-1792534746519-d798		usr-manager	product:updated	product	prod-vanilla			Vanilla cupcakes: price 3400 → 2400	2026-10-21 01:19:06.519+03	2026-10-21 01:19:06.519+03	2026-10-21 01:19:06.519+03
\.


--
-- Data for Name: blog_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.blog_categories (id, name, slug, description, display_order, active, created_at, updated_at) FROM stdin;
bcat-studio	Studio notes	studio-notes	Behind-the-counter notes from the kitchen	1	t	2026-10-11 04:34:45.366+03	2026-10-11 04:34:45.366+03
bcat-recipes	Recipes & ideas	recipes-ideas	Recipes, tips and sweet inspiration	2	t	2026-10-11 04:34:45.366+03	2026-10-11 04:34:45.366+03
\.


--
-- Data for Name: blog_posts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.blog_posts (id, category_id, title, slug, excerpt, body, cover_image, author, status, published_at, created_by, created_at, updated_at) FROM stdin;
bpost-3	bcat-recipes	Mini cakes for just about any occasion	mini-cakes-for-just-about-any-occasion	Bite-sized celebrations that disappear in seconds and still do the talking for you.	Mini cakes are the perfect crowd-pleaser for birthdays, office treats and gifting. Pick a flavour, choose a quantity, and we will box them ready to share.		Twin Cakery	PUBLISHED	2026-09-21 04:34:45.379+03		2026-10-11 04:34:45.379+03	2026-10-13 06:07:52.132+03
bpost-1	bcat-studio	Why Twin Cakery uses WhatsApp for orders	why-twin-cakery-uses-whatsapp-for-orders	Every cake starts as a conversation. Here is why ordering by WhatsApp keeps things simple, personal and reliable.	Ordering a cake should feel personal. WhatsApp lets us confirm flavours, sizes and designs in real time, share photos, and agree delivery windows without back-and-forth forms. It is the fastest way to get your celebration exactly right.		Twin Cakery	PUBLISHED	2026-10-03 04:34:45.379+03		2026-10-11 04:34:45.379+03	2026-10-11 04:34:45.379+03
bpost-2	bcat-studio	From our kitchen to your table	from-our-kitchen-to-your-table	A quick look behind the counter at how a made-to-order cake moves from idea to delivery.	From the first message to the final hand-off, every cake is baked fresh to order. We plan the bake, check ingredients, decorate by hand, and run a quality check before dispatch so what arrives is exactly what you pictured.		Twin Cakery	PUBLISHED	2026-09-27 04:34:45.379+03		2026-10-11 04:34:45.379+03	2026-10-11 04:34:45.379+03
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
addr-cust-grace	cust-grace	Home	Plot 12 Kampala Road		Kampala			Uganda	t	2026-10-08 19:28:15.714+03	2026-10-08 19:28:15.714+03
addr-cust-james	cust-james	Home	Plot 12 Kampala Road		Kampala			Uganda	t	2026-10-08 19:28:15.715+03	2026-10-08 19:28:15.715+03
addr-cust-faith	cust-faith	Home	Plot 12 Kampala Road		Kampala			Uganda	t	2026-10-08 19:28:15.717+03	2026-10-08 19:28:15.717+03
addr-cust-peter	cust-peter	Home	Plot 12 Kampala Road		Kampala			Uganda	t	2026-10-08 19:28:15.718+03	2026-10-08 19:28:15.718+03
addr-cust-wholesale	cust-wholesale	Home	Plot 12 Kampala Road		Kampala			Uganda	t	2026-10-08 19:28:15.72+03	2026-10-08 19:28:15.72+03
addr-cust-sarah	cust-sarah	Home	Plot 12 Kampala Road		Kampala			Uganda	t	2026-10-08 19:28:15.707+03	2026-10-08 19:28:15.707+03
addr-cust-david	cust-david	Home	Plot 12 Kampala Road		Kampala			Uganda	t	2026-10-08 19:28:15.712+03	2026-10-08 19:28:15.712+03
\.


--
-- Data for Name: customer_event_reminders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_event_reminders (id, event_id, customer_id, order_id, event_type, reminder_for_date, next_reminder_at, status, last_contacted_at, contacted_by, outcome, follow_up_notes, created_at, updated_at) FROM stdin;
crem-1792512541670-b006	cevt-1792512541670-1fb5	cust-1792337909894-2a09	\N	Birthday	2026-10-06	2026-10-21 12:00:00+03	PENDING	\N				2026-10-20 19:09:01.67+03	2026-10-20 19:09:01.67+03
crem-1792343376203-3791	cevt-1792343376200-2800	cust-faith	\N	Birthday	2026-09-18	2026-10-20 12:00:00+03	PENDING	\N				2026-10-18 20:09:36.203+03	2026-10-18 20:09:36.203+03
crem-1791596572967-45be	cevt-1791596572963-3fcf	cust-sarah	ord-1048	Birthday	2027-04-06	2027-06-15 12:00:00+03	PENDING	\N				2026-10-10 04:42:52.967+03	2026-10-10 04:42:52.967+03
crem-1792536908976-32b8	cevt-1792536908975-aeaf	cust-1792500970361-00a2	\N	Birthday	2026-10-20	2026-10-22 12:00:00+03	PENDING	\N				2026-10-21 01:55:08.976+03	2026-10-21 01:55:08.976+03
crem-1792488060387-b65b	cevt-1792488060385-af69	cust-wholesale	\N	Anniversary	2026-10-16	2026-11-01 12:00:00+03	PENDING	\N				2026-10-20 12:21:00.387+03	2026-10-20 12:21:00.387+03
\.


--
-- Data for Name: customer_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_events (id, customer_id, order_id, event_type, event_date, recurrence_rule, notes, status, created_by, created_at, updated_at) FROM stdin;
cevt-1792343376200-2800	cust-faith	\N	Birthday	2026-09-18	MONTHLY	From order TC-1051 · Vanilla cupcakes	ACTIVE	usr-manager	2026-10-18 20:09:36.199+03	2026-10-18 20:09:36.199+03
cevt-1791596572963-3fcf	cust-sarah	ord-1048	Birthday	2027-04-06	ANNUAL	Birthday for Sarah	ACTIVE	usr-manager	2026-10-10 04:42:52.962+03	2026-10-10 04:42:52.962+03
cevt-1792488060385-af69	cust-wholesale	\N	Anniversary	2026-09-15	MONTHLY	From order TC-1057 · Red velvet cake	ACTIVE	usr-manager	2026-10-20 12:21:00.385+03	2026-10-20 12:21:00.385+03
cevt-1792512541670-1fb5	cust-1792337909894-2a09	\N	Birthday	2026-10-06	ANNUAL	From order TC-1061 · Vanilla cupcakes	ACTIVE	usr-manager	2026-10-20 19:09:01.67+03	2026-10-20 19:09:01.67+03
cevt-1792536908975-aeaf	cust-1792500970361-00a2	\N	Birthday	2026-10-20	ANNUAL	From order TC-1057 · Red velvet cake	ACTIVE	usr-manager	2026-10-21 01:55:08.975+03	2026-10-21 01:55:08.975+03
\.


--
-- Data for Name: customer_feedback; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.customer_feedback (id, customer_id, order_id, product_ids, rating, type, comment, resolution, follow_up_required, follow_up_completed, recorded_by, created_at, updated_at) FROM stdin;
fb-ord-1043	cust-peter	ord-1043		5	GENERAL	Beautiful cake and excellent service!	\N	f	f	usr-priya	2026-10-08 19:28:15.805+03	2026-10-08 19:28:15.805+03
fb-ord-1048	cust-sarah	ord-1048		5	GENERAL	Beautiful cake and excellent service!	\N	f	f	usr-priya	2026-10-08 19:28:15.77+03	2026-10-08 19:28:15.77+03
fb-ord-1047	cust-david	ord-1047		5	GENERAL	Beautiful cake and excellent service!	\N	f	f	usr-priya	2026-10-08 19:28:15.783+03	2026-10-08 19:28:15.783+03
fb-ord-1046	cust-grace	ord-1046		5	GENERAL	Beautiful cake and excellent service!	\N	f	f	usr-priya	2026-10-08 19:28:15.788+03	2026-10-08 19:28:15.788+03
fb-ord-1045	cust-james	ord-1045		5	GENERAL	Beautiful cake and excellent service!	\N	f	f	usr-priya	2026-10-08 19:28:15.793+03	2026-10-08 19:28:15.793+03
fb-ord-1044	cust-faith	ord-1044		5	GENERAL	Beautiful cake and excellent service!	\N	f	f	usr-priya	2026-10-08 19:28:15.8+03	2026-10-08 19:28:15.8+03
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
cust-1792500047584-520a	Smoke Test 2	0700999777		phone	Website	Auto-created from the public order form.	Active	\N	\N	0	0.00	[]	2026-10-20 15:40:47.584+03	2026-10-20 15:40:47.584+03
cust-1792500970361-00a2	Website Preview	0700555444	preview@test.ug	phone	Website	Auto-created from the public order form.	Active	\N	\N	0	0.00	[]	2026-10-20 15:56:10.361+03	2026-10-20 15:56:10.361+03
cust-1792513693851-0217	Ssemiju	0779759432		email	In-house		Active	\N	\N	0	0.00	[]	2026-10-20 19:28:13.851+03	2026-10-20 19:28:13.851+03
cust-1792169285052-2054	Ssentema Daniel			email	In-house		Active	\N	\N	0	0.00	[]	2026-10-16 19:48:05.051+03	2026-10-16 19:48:05.051+03
cust-1792566804961-9a4c	reeed	+256 789 809 803		email	In-house		Active	\N	\N	0	0.00	[]	2026-10-21 10:13:24.96+03	2026-10-21 10:13:24.96+03
cust-1792604172989-7ce4	Prech	+256 768 453 666		email	In-house		Active	\N	\N	0	0.00	[]	2026-10-21 20:36:12.989+03	2026-10-21 20:36:12.989+03
cust-1792337909894-2a09	Sarah Wahinya	0788443234		email	In-house		Active	\N	\N	0	0.00	[]	2026-10-18 18:38:29.893+03	2026-10-18 18:38:29.893+03
cust-1792498851324-670a	Tracy Nabuuma	0788443234		email	In-house		Active	\N	\N	0	0.00	[]	2026-10-20 15:20:51.323+03	2026-10-20 15:20:51.323+03
cust-grace	Grace Wanjiku	+256 700 000 013	grace@example.com	phone	In-house		Active	\N	\N	0	0.00	[]	2026-10-08 19:28:15.713+03	2026-10-08 19:28:15.713+03
cust-james	James Kamau	+256 700 000 014	james@example.com	phone	In-house		Active	\N	\N	0	0.00	[]	2026-10-08 19:28:15.715+03	2026-10-08 19:28:15.715+03
cust-faith	Faith Akinyi	+256 700 000 015	faith@example.com	phone	In-house		Active	\N	\N	0	0.00	[]	2026-10-08 19:28:15.716+03	2026-10-10 16:20:02.354+03
cust-peter	Peter Njoroge	+256 700 000 016	peter@example.com	phone	In-house		Active	\N	\N	0	0.00	[]	2026-10-08 19:28:15.717+03	2026-10-08 19:28:15.717+03
cust-wholesale	Twin Cakery Wholesale	+256 700 000 017	wholesale@example.com	phone	In-house		Active	\N	\N	0	0.00	[]	2026-10-08 19:28:15.719+03	2026-10-08 19:28:15.719+03
cust-sarah	Sarah Mwangi	+256 700 000 011	sarah@example.com	phone	In-house		Active	\N	\N	0	0.00	[]	2026-10-08 19:28:15.703+03	2026-10-08 19:28:15.703+03
cust-david	David Ochieng	+256 700 000 012	david@example.com	phone	In-house		Active	\N	\N	0	0.00	[]	2026-10-08 19:28:15.711+03	2026-10-08 19:28:15.711+03
cust-1792427927005-88bf	peterr	0900000		email	In-house		Active	\N	\N	0	0.00	[]	2026-10-19 19:38:47.004+03	2026-10-19 19:38:47.004+03
cust-1792500039391-78f3	Smoke Test	0700999888	smoke@test.ug	phone	Website	Auto-created from the public order form.	Active	\N	\N	0	0.00	[]	2026-10-20 15:40:39.391+03	2026-10-20 15:40:39.391+03
\.


--
-- Data for Name: deliveries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deliveries (id, order_id, type, destination, scheduled_at, scheduled_date, scheduled_time, actual_dispatch_time, delivery_person, delivery_fee, status, notes, customer_confirmation, created_at, updated_at, actual_delivery_date) FROM stdin;
del-ord-1044	ord-1044	HOME_DELIVERY	Kampala	\N	\N	\N	\N	\N	0.00	PENDING	Seed delivery	\N	2026-10-08 19:28:15.799+03	2026-10-08 19:28:15.799+03	\N
del-ord-1043	ord-1043	HOME_DELIVERY	Kampala	\N	\N	\N	\N	\N	0.00	COMPLETED_DELIVERED	Seed delivery	\N	2026-10-08 19:28:15.805+03	2026-10-08 19:28:15.805+03	\N
del-ord-1048	ord-1048	HOME_DELIVERY	Kampala	\N	\N	\N	\N	\N	0.00	PENDING	Seed delivery	\N	2026-10-08 19:28:15.766+03	2026-10-08 19:28:15.766+03	\N
del-ord-1047	ord-1047	HOME_DELIVERY	Kampala	\N	\N	\N	\N	\N	0.00	READY_FOR_DISPATCH	Seed delivery	\N	2026-10-08 19:28:15.782+03	2026-10-08 19:28:15.782+03	\N
del-ord-1046	ord-1046	HOME_DELIVERY	Kampala	\N	\N	\N	\N	\N	0.00	PENDING	Seed delivery	\N	2026-10-08 19:28:15.788+03	2026-10-08 19:28:15.788+03	\N
del-ord-1045	ord-1045	HOME_DELIVERY	Kampala	\N	\N	\N	\N	\N	0.00	PENDING	Seed delivery	\N	2026-10-08 19:28:15.792+03	2026-10-08 19:28:15.792+03	\N
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
exp-1	exp-ing	3200.00	2026-07-23	Cash	EXP-001	Ingredient procurement	\N	usr-manager	2026-10-08 19:28:15.815+03	2026-10-08 19:28:15.815+03
\.


--
-- Data for Name: goods_receipt_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.goods_receipt_items (id, goods_receipt_id, po_item_id, quantity, unit, unit_cost, status, created_at, updated_at) FROM stdin;
gri-1792408666267-d738	gr-1792408666267-67fb	poi-1792408627298-cdd9	2.000	pcs	200.00	COMPLETED	2026-10-19 14:17:46.267+03	2026-10-19 14:17:46.267+03
gri-1792408666267-ed07	gr-1792408666267-67fb	poi-1792408627298-7989	5.000	kg	7000.00	COMPLETED	2026-10-19 14:17:46.267+03	2026-10-19 14:17:46.267+03
gri-1792408666267-2cd8	gr-1792408666267-67fb	poi-1792408627298-febc	6.000	L	5000.00	COMPLETED	2026-10-19 14:17:46.267+03	2026-10-19 14:17:46.267+03
\.


--
-- Data for Name: goods_receipts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.goods_receipts (id, purchase_order_id, received_by, date, total, status, created_at, updated_at) FROM stdin;
gr-1792344663317-448a	po-27	usr-manager	2026-09-16	9800.00	COMPLETED	2026-10-18 20:31:03.317+03	2026-10-18 20:31:03.317+03
gr-1792408666267-67fb	po-1792408627298-be31	usr-manager	2026-09-21	65400.00	COMPLETED	2026-10-19 14:17:46.267+03	2026-10-19 14:17:46.267+03
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
inq-1	cust-faith	WhatsApp	\N	Carrot cake enquiry	1kg carrot cake for Friday		NEW	MEDIUM	\N	\N	f	\N	\N	WHATSAPP	2026-10-08 19:28:15.827+03	2026-10-08 19:28:15.827+03
inq-1792500039391-1c41	cust-1792500039391-78f3	Website	\N	Online order PROP-MVGO8Q8U: 2x Chocolate celebration cake	Proposal PROP-MVGO8Q8U - 2x Chocolate celebration cake	Name: Smoke Test\nPhone: 0700999888\nEmail: smoke@test.ug\nPreferred date: 2026-10-25\nNotes: smoke test proposal	IN_PROGRESS	MEDIUM	\N	order-1792500076935-8497	t	Review confirmed online order TC-076935	\N	ORDER_FORM	2026-10-20 15:40:39.391+03	2026-10-20 15:41:16.936+03
inq-1792500047584-8907	cust-1792500047584-520a	Website	\N	Online order PROP-MVGO8WKG: 1x Chocolate celebration cake	Proposal PROP-MVGO8WKG - 1x Chocolate celebration cake	Name: Smoke Test 2\nPhone: 0700999777	NEW	MEDIUM	\N	\N	t	\N	\N	ORDER_FORM	2026-10-20 15:40:47.584+03	2026-10-20 15:40:47.584+03
inq-1792500970361-d2cf	cust-1792500970361-00a2	Website	\N	Online order PROP-MVGOSOL5: 1x Chocolate celebration cake, 2x Vanilla cupcakes	Proposal PROP-MVGOSOL5 - 1x Chocolate celebration cake, 2x Vanilla cupcakes	Name: Website Preview\nPhone: 0700555444\nEmail: preview@test.ug\nPreferred date: 2026-10-28\nNotes: Please write Happy Birthday - prepared for your UI review test	NEW	MEDIUM	\N	\N	t	\N	\N	ORDER_FORM	2026-10-20 15:56:10.361+03	2026-10-20 15:56:10.361+03
\.


--
-- Data for Name: inventory_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_items (id, name, sku, category, unit, reorder_level, supplier_id, last_updated, created_at, updated_at, cost) FROM stdin;
inv-flour	All-purpose flour	ING-001	Dry ingredients	kg	15.000	sup-bakers	2026-10-19 12:21:19.242+03	2026-10-08 19:28:15.739+03	2026-10-08 19:28:15.739+03	0.00
inv-butter	Unsalted butter	ING-002	Dairy	kg	5.000	sup-dairy	2026-10-19 19:20:52.477+03	2026-10-08 19:28:15.739+03	2026-10-08 19:28:15.739+03	7000.00
inv-cocoa	Cocoa powder	ING-003	Dry ingredients	kg	3.000	sup-bakers	2026-10-19 12:21:19.242+03	2026-10-08 19:28:15.739+03	2026-10-08 19:28:15.739+03	0.00
inv-sugar	Granulated sugar	ING-004	Dry ingredients	kg	10.000	sup-bakers	2026-10-19 19:20:52.478+03	2026-10-08 19:28:15.739+03	2026-10-08 19:28:15.739+03	0.00
inv-eggs	Fresh eggs	ING-005	Fresh ingredients	pcs	30.000	sup-dairy	2026-10-19 14:17:46.268+03	2026-10-08 19:28:15.739+03	2026-10-08 19:28:15.739+03	200.00
inv-cream	Whipping cream	ING-006	Dairy	L	4.000	sup-dairy	2026-10-21 01:19:11.344+03	2026-10-08 19:28:15.739+03	2026-10-08 19:28:15.739+03	5000.00
inv-buttercream	Buttercream mix	ING-007	Misc	batch	3.000	sup-pack	2026-10-08 19:28:15.739+03	2026-10-08 19:28:15.739+03	2026-10-08 19:28:15.739+03	0.00
\.


--
-- Data for Name: inventory_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.inventory_transactions (id, item_id, quantity, unit, type, reference, tx_user, "timestamp", unit_cost, notes, created_at, updated_at) FROM stdin;
txn-1792025612119-023e	inv-butter	-1.000	kg	ADJUSTMENT_OUT	UI sign check	admin	2026-10-15 03:53:32.119+03	\N		2026-10-15 03:53:32.119+03	2026-10-15 03:53:32.119+03
txn-1792025613088-4e62	inv-butter	1.000	kg	ADJUSTMENT_IN	UI sign check	admin	2026-10-15 03:53:33.088+03	\N		2026-10-15 03:53:33.088+03	2026-10-15 03:53:33.088+03
txn-1792048972745-fb3e	inv-cream	-1.000	unit	ADJUSTMENT_OUT		admin	2026-10-15 10:22:52.745+03	\N	E3 smoke: still low, no spam	2026-10-15 10:22:52.745+03	2026-10-15 10:22:52.745+03
txn-1792048973214-9aed	inv-cream	6.000	unit	ADJUSTMENT_IN		admin	2026-10-15 10:22:53.214+03	\N	E3 smoke: restore	2026-10-15 10:22:53.214+03	2026-10-15 10:22:53.214+03
txn-1792055792614-a58f	inv-cream	-5.000	unit	ADJUSTMENT_OUT		admin	2026-10-15 12:16:32.613+03	\N	E3 smoke: cross reorder	2026-10-15 12:16:32.613+03	2026-10-15 12:16:32.613+03
txn-1792055799933-5f56	inv-cream	-1.000	unit	ADJUSTMENT_OUT		admin	2026-10-15 12:16:39.933+03	\N	E3 smoke: still low, no spam	2026-10-15 12:16:39.933+03	2026-10-15 12:16:39.933+03
txn-1792055800399-8035	inv-cream	6.000	unit	ADJUSTMENT_IN		admin	2026-10-15 12:16:40.399+03	\N	E3 smoke: restore	2026-10-15 12:16:40.399+03	2026-10-15 12:16:40.399+03
tx-open-3	inv-cocoa	1.200	kg	OPENING_BALANCE	Opening	usr-manager	2026-10-08 19:28:15.742+03	950.00	Opening position	2026-10-08 19:28:15.742+03	2026-10-08 19:28:15.742+03
tx-open-4	inv-sugar	24.000	kg	OPENING_BALANCE	Opening	usr-manager	2026-10-08 19:28:15.742+03	180.00	Opening position	2026-10-08 19:28:15.742+03	2026-10-08 19:28:15.742+03
tx-open-5	inv-eggs	90.000	pcs	OPENING_BALANCE	Opening	usr-manager	2026-10-08 19:28:15.742+03	18.00	Opening position	2026-10-08 19:28:15.742+03	2026-10-08 19:28:15.742+03
txn-1792401547815-bb05	inv-flour	-1.000	kg	PRODUCTION_CONSUMPTION	Materials used for order-1792346351945-1159	usr-manager	2026-10-19 12:19:07.815+03	0.00	Materials used	2026-10-19 12:19:07.815+03	2026-10-19 12:19:07.815+03
txn-1792426852478-962b	inv-cream	-1.000	L	PRODUCTION_CONSUMPTION	Materials used for order-1792343376364-b7cc	usr-manager	2026-10-19 19:20:52.478+03	5000.00	Materials used	2026-10-19 19:20:52.478+03	2026-10-19 19:20:52.478+03
tx-open-6	inv-cream	8.000	L	OPENING_BALANCE	Opening	usr-manager	2026-10-08 19:28:15.742+03	650.00	Opening position	2026-10-08 19:28:15.742+03	2026-10-08 19:28:15.742+03
tx-open-1	inv-flour	8.000	kg	OPENING_BALANCE	Opening	usr-manager	2026-10-08 19:28:15.742+03	120.00	Opening position	2026-10-08 19:28:15.742+03	2026-10-08 19:28:15.742+03
txn-1792048965551-2c5c	inv-cream	-5.000	unit	ADJUSTMENT_OUT		admin	2026-10-15 10:22:45.551+03	\N	E3 smoke: cross reorder	2026-10-15 10:22:45.551+03	2026-10-15 10:22:45.551+03
txn-1792426852478-8902	inv-sugar	-1.200	kg	PRODUCTION_CONSUMPTION	Materials used for order-1792343376364-b7cc	usr-manager	2026-10-19 19:20:52.478+03	0.00	Materials used	2026-10-19 19:20:52.478+03	2026-10-19 19:20:52.478+03
tx-open-2	inv-butter	2.500	kg	OPENING_BALANCE	Opening	usr-manager	2026-10-08 19:28:15.742+03	850.00	Opening position	2026-10-08 19:28:15.742+03	2026-10-08 19:28:15.742+03
txn-1792401584113-3896	inv-sugar	-0.250	kg	PRODUCTION_CONSUMPTION	Materials used for order-1792346351945-1159	usr-manager	2026-10-19 12:19:44.113+03	0.00	Materials used	2026-10-19 12:19:44.113+03	2026-10-19 12:19:44.113+03
txn-1792401585770-1f22	inv-cocoa	-0.100	kg	PRODUCTION_CONSUMPTION	Materials used for order-1792346351945-1159	usr-manager	2026-10-19 12:19:45.77+03	0.00	Materials used	2026-10-19 12:19:45.77+03	2026-10-19 12:19:45.77+03
txn-1792401587364-c216	inv-eggs	-3.000	pcs	PRODUCTION_CONSUMPTION	Materials used for order-1792346351945-1159	usr-manager	2026-10-19 12:19:47.364+03	0.00	Materials used	2026-10-19 12:19:47.364+03	2026-10-19 12:19:47.364+03
txn-1792401601379-0787	inv-flour	-0.500	kg	PRODUCTION_CONSUMPTION	Materials used for order-1792346351945-1159	usr-manager	2026-10-19 12:20:01.379+03	0.00	vanilla layer	2026-10-19 12:20:01.379+03	2026-10-19 12:20:01.379+03
txn-1792401679242-aaf1	inv-flour	-0.500	kg	PRODUCTION_CONSUMPTION	Materials used for order-1792346351945-1159	usr-manager	2026-10-19 12:21:19.242+03	0.00	vanilla layer	2026-10-19 12:21:19.242+03	2026-10-19 12:21:19.242+03
txn-1792401679242-c404	inv-sugar	-0.250	kg	PRODUCTION_CONSUMPTION	Materials used for order-1792346351945-1159	usr-manager	2026-10-19 12:21:19.242+03	0.00	Materials used	2026-10-19 12:21:19.242+03	2026-10-19 12:21:19.242+03
txn-1792426852477-c2b8	inv-butter	-1.000	kg	PRODUCTION_CONSUMPTION	Materials used for order-1792343376364-b7cc	usr-manager	2026-10-19 19:20:52.477+03	7000.00	Materials used	2026-10-19 19:20:52.477+03	2026-10-19 19:20:52.477+03
txn-1792408666268-8fe6	inv-butter	5.000	kg	PURCHASE_RECEIPT	Goods receipt for PO-1792408627296-hmc6	usr-manager	2026-10-19 14:17:46.268+03	7000.00	Received against PO-1792408627296-hmc6	2026-10-19 14:17:46.268+03	2026-10-19 14:17:46.268+03
txn-1792408666268-4b84	inv-eggs	2.000	pcs	PURCHASE_RECEIPT	Goods receipt for PO-1792408627296-hmc6	usr-manager	2026-10-19 14:17:46.268+03	200.00	Received against PO-1792408627296-hmc6	2026-10-19 14:17:46.268+03	2026-10-19 14:17:46.268+03
txn-1792408666268-a024	inv-cream	6.000	L	PURCHASE_RECEIPT	Goods receipt for PO-1792408627296-hmc6	usr-manager	2026-10-19 14:17:46.268+03	5000.00	Received against PO-1792408627296-hmc6	2026-10-19 14:17:46.268+03	2026-10-19 14:17:46.268+03
txn-1792401679242-3f8a	inv-cocoa	-0.100	kg	PRODUCTION_CONSUMPTION	Materials used for order-1792346351945-1159	usr-manager	2026-10-19 12:21:19.242+03	0.00	Materials used	2026-10-19 12:21:19.242+03	2026-10-19 12:21:19.242+03
txn-1792401679242-725d	inv-eggs	-3.000	pcs	PRODUCTION_CONSUMPTION	Materials used for order-1792346351945-1159	usr-manager	2026-10-19 12:21:19.242+03	0.00	Materials used	2026-10-19 12:21:19.242+03	2026-10-19 12:21:19.242+03
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
nrec-1792422416564-92df	ntf-1792422416564-331f	usr-alex	EMAIL	\N	\N	\N	\N	2026-10-19 18:06:56.564+03	2026-10-19 18:06:56.564+03
nrec-1792422416564-9032	ntf-1792422416564-389f	usr-alex	SMS	\N	\N	\N	\N	2026-10-19 18:06:56.564+03	2026-10-19 18:06:56.564+03
nrec-1792022259962-74bc	ntf-1792022259962-dda3	usr-alex	WHATSAPP	\N	\N	\N	\N	2026-10-15 02:57:39.962+03	2026-10-15 02:57:39.962+03
nrec-1792422416563-ac5e	ntf-1792422416563-249d	usr-jordan	IN_APP	\N	\N	\N	\N	2026-10-19 18:06:56.563+03	2026-10-19 18:06:56.563+03
nrec-1792422416563-8a3a	ntf-1792422416563-3475	usr-jordan	WHATSAPP	\N	\N	\N	\N	2026-10-19 18:06:56.563+03	2026-10-19 18:06:56.563+03
nrec-1792500047585-bdc3	ntf-1792500047585-b50d	usr-manager	IN_APP	\N	\N	\N	\N	2026-10-20 15:40:47.585+03	2026-10-20 15:40:47.585+03
nrec-1792116544531-4754	ntf-1792116544531-cbf8	usr-jordan	SMS	\N	\N	\N	\N	2026-10-16 05:09:04.531+03	2026-10-16 05:09:04.531+03
nrec-1792116544531-2666	ntf-1792116544531-cbe7	usr-priya	IN_APP	\N	\N	\N	\N	2026-10-16 05:09:04.531+03	2026-10-16 05:09:04.531+03
nrec-1792116544531-c19f	ntf-1792116544531-604b	usr-priya	WHATSAPP	\N	\N	\N	\N	2026-10-16 05:09:04.531+03	2026-10-16 05:09:04.531+03
nrec-1792116544532-a51c	ntf-1792116544532-9a92	usr-priya	EMAIL	\N	\N	\N	\N	2026-10-16 05:09:04.531+03	2026-10-16 05:09:04.532+03
nrec-1792024833585-cba1	ntf-1792024833585-b3d6	usr-manager	SMS	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-15 03:40:33.585+03	2026-10-15 03:40:33.585+03
nrec-1792024833585-0744	ntf-1792024833585-fcb0	usr-alex	IN_APP	\N	\N	\N	\N	2026-10-15 03:40:33.585+03	2026-10-15 03:40:33.585+03
nrec-1792024833585-145d	ntf-1792024833585-2524	usr-alex	WHATSAPP	\N	\N	\N	\N	2026-10-15 03:40:33.585+03	2026-10-15 03:40:33.585+03
nrec-1792024833585-3dc9	ntf-1792024833585-9eda	usr-alex	EMAIL	\N	\N	\N	\N	2026-10-15 03:40:33.585+03	2026-10-15 03:40:33.585+03
nrec-1792024833585-f84e	ntf-1792024833585-d08a	usr-alex	SMS	\N	\N	\N	\N	2026-10-15 03:40:33.585+03	2026-10-15 03:40:33.585+03
nrec-1792048965553-48a1	ntf-1792048965553-76c7	usr-jordan	IN_APP	\N	\N	\N	\N	2026-10-15 10:22:45.552+03	2026-10-15 10:22:45.553+03
nrec-1792048965553-83a9	ntf-1792048965553-e423	usr-jordan	WHATSAPP	\N	\N	\N	\N	2026-10-15 10:22:45.553+03	2026-10-15 10:22:45.553+03
nrec-1792048965553-0db0	ntf-1792048965553-db08	usr-jordan	EMAIL	\N	\N	\N	\N	2026-10-15 10:22:45.553+03	2026-10-15 10:22:45.553+03
nrec-1792048965553-f472	ntf-1792048965553-cdbb	usr-jordan	SMS	\N	\N	\N	\N	2026-10-15 10:22:45.553+03	2026-10-15 10:22:45.553+03
nrec-1792024833585-7976	ntf-1792024833585-7c2a	usr-manager	EMAIL	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-15 03:40:33.585+03	2026-10-15 03:40:33.585+03
nrec-1792024833585-985a	ntf-1792024833585-6c21	usr-manager	IN_APP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-15 03:40:33.585+03	2026-10-15 03:40:33.585+03
nrec-1792024833584-b0ef	ntf-1792024833584-8af5	usr-jordan	IN_APP	\N	\N	\N	\N	2026-10-15 03:40:33.584+03	2026-10-15 03:40:33.584+03
nrec-1792024833584-27be	ntf-1792024833584-09ef	usr-jordan	WHATSAPP	\N	\N	\N	\N	2026-10-15 03:40:33.584+03	2026-10-15 03:40:33.584+03
nrec-1792024833584-f55b	ntf-1792024833584-c7e0	usr-jordan	EMAIL	\N	\N	\N	\N	2026-10-15 03:40:33.584+03	2026-10-15 03:40:33.584+03
nrec-1792024833584-0433	ntf-1792024833584-47f2	usr-jordan	SMS	\N	\N	\N	\N	2026-10-15 03:40:33.584+03	2026-10-15 03:40:33.584+03
nrec-1792116544531-b417	ntf-1792116544531-20cd	usr-jordan	IN_APP	\N	\N	\N	\N	2026-10-16 05:09:04.531+03	2026-10-16 05:09:04.531+03
nrec-1792116544531-cd19	ntf-1792116544531-5444	usr-jordan	WHATSAPP	\N	\N	\N	\N	2026-10-16 05:09:04.531+03	2026-10-16 05:09:04.531+03
nrec-1792154726492-31ae	ntf-1792154726492-bd8d	usr-alex	WHATSAPP	\N	\N	\N	\N	2026-10-16 15:45:26.492+03	2026-10-16 15:45:26.492+03
nrec-1792154726492-4fef	ntf-1792154726492-a670	usr-alex	EMAIL	\N	\N	\N	\N	2026-10-16 15:45:26.492+03	2026-10-16 15:45:26.492+03
nrec-1792055792618-00e4	ntf-1792055792618-e091	usr-jordan	SMS	\N	\N	\N	\N	2026-10-15 12:16:32.618+03	2026-10-15 12:16:32.618+03
nrec-1792055792621-b3fc	ntf-1792055792621-5673	usr-priya	IN_APP	\N	\N	\N	\N	2026-10-15 12:16:32.62+03	2026-10-15 12:16:32.621+03
nrec-1792055792621-9312	ntf-1792055792621-96ed	usr-priya	WHATSAPP	\N	\N	\N	\N	2026-10-15 12:16:32.621+03	2026-10-15 12:16:32.621+03
nrec-1792055792621-0db9	ntf-1792055792621-7591	usr-priya	EMAIL	\N	\N	\N	\N	2026-10-15 12:16:32.621+03	2026-10-15 12:16:32.621+03
nrec-1792055792621-88a8	ntf-1792055792621-d5bc	usr-priya	SMS	\N	\N	\N	\N	2026-10-15 12:16:32.621+03	2026-10-15 12:16:32.621+03
nrec-1792055792621-22d9	ntf-1792055792621-fafa	usr-manager	IN_APP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-15 12:16:32.621+03	2026-10-15 12:16:32.621+03
nrec-1792500047585-62d7	ntf-1792500047585-49a9	usr-manager	WHATSAPP	\N	\N	\N	\N	2026-10-20 15:40:47.585+03	2026-10-20 15:40:47.585+03
nrec-1792500047585-2143	ntf-1792500047585-7fb1	usr-manager	EMAIL	\N	\N	\N	\N	2026-10-20 15:40:47.585+03	2026-10-20 15:40:47.585+03
nrec-1792500047585-8511	ntf-1792500047585-2c64	usr-manager	SMS	\N	\N	\N	\N	2026-10-20 15:40:47.585+03	2026-10-20 15:40:47.585+03
nrec-1792500970362-5df0	ntf-1792500970362-45f2	usr-priya	WHATSAPP	\N	\N	\N	\N	2026-10-20 15:56:10.362+03	2026-10-20 15:56:10.362+03
nrec-1792500970362-f18c	ntf-1792500970362-71d0	usr-priya	EMAIL	\N	\N	\N	\N	2026-10-20 15:56:10.362+03	2026-10-20 15:56:10.362+03
nrec-1792500970362-4cb0	ntf-1792500970362-7a40	usr-priya	SMS	\N	\N	\N	\N	2026-10-20 15:56:10.362+03	2026-10-20 15:56:10.362+03
nrec-1792500970362-e537	ntf-1792500970362-76da	usr-manager	IN_APP	\N	\N	\N	\N	2026-10-20 15:56:10.362+03	2026-10-20 15:56:10.362+03
nrec-1792500970362-3a4d	ntf-1792500970362-fb57	usr-manager	WHATSAPP	\N	\N	\N	\N	2026-10-20 15:56:10.362+03	2026-10-20 15:56:10.362+03
nrec-1792500970362-d6b0	ntf-1792500970362-a0a5	usr-manager	EMAIL	\N	\N	\N	\N	2026-10-20 15:56:10.362+03	2026-10-20 15:56:10.362+03
nrec-1792500970362-ec4f	ntf-1792500970362-6247	usr-manager	SMS	\N	\N	\N	\N	2026-10-20 15:56:10.362+03	2026-10-20 15:56:10.362+03
nrec-1792116160148-c2e9	ntf-1792116160148-8309	usr-alex	SMS	\N	\N	\N	\N	2026-10-16 05:02:40.148+03	2026-10-16 05:02:40.148+03
nrec-1792024833585-d97c	ntf-1792024833585-7e3b	usr-priya	SMS	\N	\N	\N	\N	2026-10-15 03:40:33.585+03	2026-10-15 03:40:33.585+03
nrec-1792113060427-8a04	ntf-1792113060427-c33a	usr-manager	WHATSAPP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 04:11:00.427+03	2026-10-16 04:11:00.427+03
nrec-1792113060426-3549	ntf-1792113060426-1d34	usr-jordan	IN_APP	\N	\N	\N	\N	2026-10-16 04:11:00.426+03	2026-10-16 04:11:00.426+03
nrec-1792114227026-cf05	ntf-1792114227026-bd1f	usr-priya	WHATSAPP	\N	\N	\N	\N	2026-10-16 04:30:27.026+03	2026-10-16 04:30:27.026+03
nrec-1792408666276-7f32	ntf-1792408666276-159f	usr-priya	EMAIL	\N	\N	\N	\N	2026-10-19 14:17:46.276+03	2026-10-19 14:17:46.276+03
nrec-1792158449335-e4b7	ntf-1792158449335-f115	usr-priya	EMAIL	\N	\N	\N	\N	2026-10-16 16:47:29.335+03	2026-10-16 16:47:29.335+03
nrec-1792422416564-bf36	ntf-1792422416564-87bb	usr-jordan	EMAIL	\N	\N	\N	\N	2026-10-19 18:06:56.564+03	2026-10-19 18:06:56.564+03
nrec-1792024833585-0c21	ntf-1792024833585-17a1	usr-manager	WHATSAPP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-15 03:40:33.585+03	2026-10-15 03:40:33.585+03
nrec-1792114227026-1d9e	ntf-1792114227026-9db0	usr-alex	EMAIL	\N	\N	\N	\N	2026-10-16 04:30:27.026+03	2026-10-16 04:30:27.026+03
nrec-1792116160147-5018	ntf-1792116160147-66a2	usr-priya	EMAIL	\N	\N	\N	\N	2026-10-16 05:02:40.147+03	2026-10-16 05:02:40.147+03
nrec-1792116160147-003e	ntf-1792116160147-fba4	usr-priya	SMS	\N	\N	\N	\N	2026-10-16 05:02:40.147+03	2026-10-16 05:02:40.147+03
nrec-1792116160147-90ad	ntf-1792116160147-8d65	usr-manager	IN_APP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 05:02:40.147+03	2026-10-16 05:02:40.147+03
nrec-1792116160147-a2c0	ntf-1792116160147-83ff	usr-manager	WHATSAPP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 05:02:40.147+03	2026-10-16 05:02:40.147+03
nrec-1792116160148-de4d	ntf-1792116160147-99e1	usr-manager	EMAIL	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 05:02:40.147+03	2026-10-16 05:02:40.148+03
nrec-1792116160148-3734	ntf-1792116160148-5fe3	usr-manager	SMS	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 05:02:40.148+03	2026-10-16 05:02:40.148+03
nrec-1792116160148-3a38	ntf-1792116160148-52a4	usr-alex	IN_APP	\N	\N	\N	\N	2026-10-16 05:02:40.148+03	2026-10-16 05:02:40.148+03
nrec-1792116160148-6505	ntf-1792116160148-a08d	usr-alex	WHATSAPP	\N	\N	\N	\N	2026-10-16 05:02:40.148+03	2026-10-16 05:02:40.148+03
nrec-1792116160148-00e5	ntf-1792116160148-28a3	usr-alex	EMAIL	\N	\N	\N	\N	2026-10-16 05:02:40.148+03	2026-10-16 05:02:40.148+03
nrec-1792116544531-d3e2	ntf-1792116544531-2914	usr-jordan	EMAIL	\N	\N	\N	\N	2026-10-16 05:09:04.531+03	2026-10-16 05:09:04.531+03
nrec-1792055792621-205c	ntf-1792055792621-ce43	usr-manager	WHATSAPP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-15 12:16:32.621+03	2026-10-15 12:16:32.621+03
nrec-1792116544532-bd33	ntf-1792116544532-cf89	usr-manager	SMS	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 05:09:04.532+03	2026-10-16 05:09:04.532+03
nrec-1792116544532-d5d4	ntf-1792116544532-d2f0	usr-alex	IN_APP	\N	\N	\N	\N	2026-10-16 05:09:04.532+03	2026-10-16 05:09:04.532+03
nrec-1792116544532-aed0	ntf-1792116544532-7bfd	usr-alex	WHATSAPP	\N	\N	\N	\N	2026-10-16 05:09:04.532+03	2026-10-16 05:09:04.532+03
nrec-1792116544532-8952	ntf-1792116544532-0512	usr-alex	EMAIL	\N	\N	\N	\N	2026-10-16 05:09:04.532+03	2026-10-16 05:09:04.532+03
nrec-1792116544532-c03f	ntf-1792116544532-6a42	usr-alex	SMS	\N	\N	\N	\N	2026-10-16 05:09:04.532+03	2026-10-16 05:09:04.532+03
nrec-1792154726492-bd37	ntf-1792154726492-b58d	usr-manager	SMS	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 15:45:26.492+03	2026-10-16 15:45:26.492+03
nrec-1792154726492-ba2b	ntf-1792154726492-da29	usr-alex	IN_APP	\N	\N	\N	\N	2026-10-16 15:45:26.492+03	2026-10-16 15:45:26.492+03
nrec-1792422416564-5cda	ntf-1792422416564-61cb	usr-jordan	SMS	\N	\N	\N	\N	2026-10-19 18:06:56.564+03	2026-10-19 18:06:56.564+03
nrec-1792422416564-4bea	ntf-1792422416564-0789	usr-priya	IN_APP	\N	\N	\N	\N	2026-10-19 18:06:56.564+03	2026-10-19 18:06:56.564+03
nrec-1792158449335-eb57	ntf-1792158449335-e3da	usr-priya	SMS	\N	\N	\N	\N	2026-10-16 16:47:29.335+03	2026-10-16 16:47:29.335+03
nrec-1792422416564-a4f9	ntf-1792422416564-ee24	usr-priya	WHATSAPP	\N	\N	\N	\N	2026-10-19 18:06:56.564+03	2026-10-19 18:06:56.564+03
nrec-1792422416564-6788	ntf-1792422416564-c11e	usr-priya	EMAIL	\N	\N	\N	\N	2026-10-19 18:06:56.564+03	2026-10-19 18:06:56.564+03
nrec-1792422416564-cdad	ntf-1792422416564-ebda	usr-priya	SMS	\N	\N	\N	\N	2026-10-19 18:06:56.564+03	2026-10-19 18:06:56.564+03
nrec-1792422416564-7cfa	ntf-1792422416564-f89b	usr-manager	IN_APP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-19 18:06:56.564+03	2026-10-19 18:06:56.564+03
nrec-1792022259962-7076	ntf-1792022259962-de93	usr-manager	SMS	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-15 02:57:39.962+03	2026-10-15 02:57:39.962+03
nrec-1792422416564-c7ae	ntf-1792422416564-b4a9	usr-manager	WHATSAPP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-19 18:06:56.564+03	2026-10-19 18:06:56.564+03
nrec-1792422416564-20a6	ntf-1792422416564-d47f	usr-manager	EMAIL	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-19 18:06:56.564+03	2026-10-19 18:06:56.564+03
nrec-1792422416564-7ad2	ntf-1792422416564-0556	usr-manager	SMS	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-19 18:06:56.564+03	2026-10-19 18:06:56.564+03
nrec-1792422416564-b14b	ntf-1792422416564-b406	usr-alex	IN_APP	\N	\N	\N	\N	2026-10-19 18:06:56.564+03	2026-10-19 18:06:56.564+03
nrec-1792422416564-9428	ntf-1792422416564-e76f	usr-alex	WHATSAPP	\N	\N	\N	\N	2026-10-19 18:06:56.564+03	2026-10-19 18:06:56.564+03
nrec-1792022259962-f709	ntf-1792022259962-8ac5	usr-alex	IN_APP	\N	\N	\N	\N	2026-10-15 02:57:39.962+03	2026-10-15 02:57:39.962+03
nrec-1792022259961-22b1	ntf-1792022259961-4966	usr-jordan	SMS	\N	\N	\N	\N	2026-10-15 02:57:39.961+03	2026-10-15 02:57:39.961+03
nrec-1792022259961-a691	ntf-1792022259961-7845	usr-priya	IN_APP	\N	\N	\N	\N	2026-10-15 02:57:39.961+03	2026-10-15 02:57:39.961+03
nrec-1792022259961-597c	ntf-1792022259961-3984	usr-priya	WHATSAPP	\N	\N	\N	\N	2026-10-15 02:57:39.961+03	2026-10-15 02:57:39.961+03
nrec-1792022259961-00c3	ntf-1792022259961-246d	usr-priya	EMAIL	\N	\N	\N	\N	2026-10-15 02:57:39.961+03	2026-10-15 02:57:39.961+03
nrec-1792114227026-ef7f	ntf-1792114227026-ed73	usr-manager	EMAIL	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 04:30:27.026+03	2026-10-16 04:30:27.026+03
nrec-1792114227026-5456	ntf-1792114227026-dd50	usr-manager	SMS	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 04:30:27.026+03	2026-10-16 04:30:27.026+03
nrec-1792114227026-3b9f	ntf-1792114227026-0f56	usr-alex	IN_APP	\N	\N	\N	\N	2026-10-16 04:30:27.026+03	2026-10-16 04:30:27.026+03
nrec-1792114227026-9389	ntf-1792114227026-30e7	usr-alex	WHATSAPP	\N	\N	\N	\N	2026-10-16 04:30:27.026+03	2026-10-16 04:30:27.026+03
nrec-1792116160146-a3be	ntf-1792116160146-ae2c	usr-jordan	IN_APP	\N	\N	\N	\N	2026-10-16 05:02:40.146+03	2026-10-16 05:02:40.146+03
nrec-1792116544532-a63c	ntf-1792116544532-f509	usr-priya	SMS	\N	\N	\N	\N	2026-10-16 05:09:04.532+03	2026-10-16 05:09:04.532+03
nrec-1792055792621-eea7	ntf-1792055792621-5c8e	usr-manager	SMS	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-15 12:16:32.621+03	2026-10-15 12:16:32.621+03
nrec-1792113060427-695b	ntf-1792113060427-8223	usr-manager	SMS	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 04:11:00.427+03	2026-10-16 04:11:00.427+03
nrec-1792022259962-f7dc	ntf-1792022259962-6723	usr-manager	EMAIL	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-15 02:57:39.962+03	2026-10-15 02:57:39.962+03
nrec-1792055792621-6a4a	ntf-1792055792621-4d93	usr-alex	SMS	\N	\N	\N	\N	2026-10-15 12:16:32.621+03	2026-10-15 12:16:32.621+03
nrec-1792048965553-6533	ntf-1792048965553-4edc	usr-priya	IN_APP	\N	\N	\N	\N	2026-10-15 10:22:45.553+03	2026-10-15 10:22:45.553+03
nrec-1792048965553-e70c	ntf-1792048965553-213c	usr-priya	WHATSAPP	\N	\N	\N	\N	2026-10-15 10:22:45.553+03	2026-10-15 10:22:45.553+03
nrec-1792024833584-a18f	ntf-1792024833584-dc4c	usr-priya	IN_APP	\N	\N	\N	\N	2026-10-15 03:40:33.584+03	2026-10-15 03:40:33.584+03
nrec-1792024833584-e2b0	ntf-1792024833584-a678	usr-priya	WHATSAPP	\N	\N	\N	\N	2026-10-15 03:40:33.584+03	2026-10-15 03:40:33.584+03
nrec-1792024833585-0f9f	ntf-1792024833584-8c2d	usr-priya	EMAIL	\N	\N	\N	\N	2026-10-15 03:40:33.584+03	2026-10-15 03:40:33.584+03
nrec-1792048965553-2999	ntf-1792048965553-6028	usr-priya	EMAIL	\N	\N	\N	\N	2026-10-15 10:22:45.553+03	2026-10-15 10:22:45.553+03
nrec-1792048965553-5063	ntf-1792048965553-6517	usr-priya	SMS	\N	\N	\N	\N	2026-10-15 10:22:45.553+03	2026-10-15 10:22:45.553+03
nrec-1792048965553-3a1c	ntf-1792048965553-66fc	usr-manager	IN_APP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-15 10:22:45.553+03	2026-10-15 10:22:45.553+03
nrec-1792048965554-fb38	ntf-1792048965554-c695	usr-manager	WHATSAPP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-15 10:22:45.554+03	2026-10-15 10:22:45.554+03
nrec-1792048965554-cdbc	ntf-1792048965554-9253	usr-manager	EMAIL	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-15 10:22:45.554+03	2026-10-15 10:22:45.554+03
nrec-1792048965554-5423	ntf-1792048965554-ad13	usr-manager	SMS	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-15 10:22:45.554+03	2026-10-15 10:22:45.554+03
nrec-1792048965554-66d1	ntf-1792048965554-a58b	usr-alex	IN_APP	\N	\N	\N	\N	2026-10-15 10:22:45.554+03	2026-10-15 10:22:45.554+03
nrec-1792048965554-76f1	ntf-1792048965554-7bff	usr-alex	WHATSAPP	\N	\N	\N	\N	2026-10-15 10:22:45.554+03	2026-10-15 10:22:45.554+03
nrec-1792048965554-b8fd	ntf-1792048965554-db67	usr-alex	EMAIL	\N	\N	\N	\N	2026-10-15 10:22:45.554+03	2026-10-15 10:22:45.554+03
nrec-1792048965554-fe22	ntf-1792048965554-29e4	usr-alex	SMS	\N	\N	\N	\N	2026-10-15 10:22:45.554+03	2026-10-15 10:22:45.554+03
nrec-1792055792618-c1bb	ntf-1792055792618-deff	usr-jordan	IN_APP	\N	\N	\N	\N	2026-10-15 12:16:32.617+03	2026-10-15 12:16:32.618+03
nrec-1792055792618-6582	ntf-1792055792618-0c82	usr-jordan	WHATSAPP	\N	\N	\N	\N	2026-10-15 12:16:32.618+03	2026-10-15 12:16:32.618+03
nrec-1792055792618-7aad	ntf-1792055792618-8a84	usr-jordan	EMAIL	\N	\N	\N	\N	2026-10-15 12:16:32.618+03	2026-10-15 12:16:32.618+03
nrec-1792055792621-73a3	ntf-1792055792621-62a0	usr-manager	EMAIL	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-15 12:16:32.621+03	2026-10-15 12:16:32.621+03
nrec-1792154726492-01ba	ntf-1792154726492-6229	usr-alex	SMS	\N	\N	\N	\N	2026-10-16 15:45:26.492+03	2026-10-16 15:45:26.492+03
nrec-1792154726491-d8a4	ntf-1792154726490-4ec8	usr-jordan	IN_APP	\N	\N	\N	\N	2026-10-16 15:45:26.49+03	2026-10-16 15:45:26.491+03
nrec-1792154726491-2d78	ntf-1792154726491-c2c5	usr-jordan	WHATSAPP	\N	\N	\N	\N	2026-10-16 15:45:26.491+03	2026-10-16 15:45:26.491+03
nrec-1792154726491-f3d9	ntf-1792154726491-b0a3	usr-jordan	EMAIL	\N	\N	\N	\N	2026-10-16 15:45:26.491+03	2026-10-16 15:45:26.491+03
nrec-1792154726491-6dae	ntf-1792154726491-2d18	usr-jordan	SMS	\N	\N	\N	\N	2026-10-16 15:45:26.491+03	2026-10-16 15:45:26.491+03
nrec-1792154726491-6b61	ntf-1792154726491-2cf7	usr-priya	IN_APP	\N	\N	\N	\N	2026-10-16 15:45:26.491+03	2026-10-16 15:45:26.491+03
nrec-1792154726491-eebc	ntf-1792154726491-9e9e	usr-priya	WHATSAPP	\N	\N	\N	\N	2026-10-16 15:45:26.491+03	2026-10-16 15:45:26.491+03
nrec-1792154726491-5f9c	ntf-1792154726491-919e	usr-priya	EMAIL	\N	\N	\N	\N	2026-10-16 15:45:26.491+03	2026-10-16 15:45:26.491+03
nrec-1792500039391-bdf3	ntf-1792500039391-919a	usr-priya	IN_APP	\N	\N	\N	\N	2026-10-20 15:40:39.391+03	2026-10-20 15:40:39.391+03
nrec-1792500039391-4b7a	ntf-1792500039391-c9bb	usr-priya	WHATSAPP	\N	\N	\N	\N	2026-10-20 15:40:39.391+03	2026-10-20 15:40:39.391+03
nrec-1792116160147-f4ab	ntf-1792116160146-db29	usr-jordan	WHATSAPP	\N	\N	\N	\N	2026-10-16 05:02:40.146+03	2026-10-16 05:02:40.147+03
nrec-1792116160147-4f3c	ntf-1792116160147-fb1a	usr-jordan	EMAIL	\N	\N	\N	\N	2026-10-16 05:02:40.147+03	2026-10-16 05:02:40.147+03
nrec-1792154726491-0eb9	ntf-1792154726491-e4bd	usr-priya	SMS	\N	\N	\N	\N	2026-10-16 15:45:26.491+03	2026-10-16 15:45:26.491+03
nrec-1792154726491-ceec	ntf-1792154726491-7f6f	usr-manager	IN_APP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 15:45:26.491+03	2026-10-16 15:45:26.491+03
nrec-1792154726491-e2ff	ntf-1792154726491-f66b	usr-manager	WHATSAPP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 15:45:26.491+03	2026-10-16 15:45:26.491+03
nrec-1792155709678-d4ed	ntf-1792155709678-4fc1	usr-jordan	IN_APP	\N	\N	\N	\N	2026-10-16 16:01:49.678+03	2026-10-16 16:01:49.678+03
nrec-1792155709678-d9e6	ntf-1792155709678-6cbc	usr-jordan	WHATSAPP	\N	\N	\N	\N	2026-10-16 16:01:49.678+03	2026-10-16 16:01:49.678+03
nrec-1792155709678-0450	ntf-1792155709678-f0e9	usr-jordan	EMAIL	\N	\N	\N	\N	2026-10-16 16:01:49.678+03	2026-10-16 16:01:49.678+03
nrec-1792155709678-7489	ntf-1792155709678-539a	usr-jordan	SMS	\N	\N	\N	\N	2026-10-16 16:01:49.678+03	2026-10-16 16:01:49.678+03
nrec-1792155709678-63e3	ntf-1792155709678-54da	usr-priya	IN_APP	\N	\N	\N	\N	2026-10-16 16:01:49.678+03	2026-10-16 16:01:49.678+03
nrec-1792155709678-b99b	ntf-1792155709678-0542	usr-priya	WHATSAPP	\N	\N	\N	\N	2026-10-16 16:01:49.678+03	2026-10-16 16:01:49.678+03
nrec-1792500039392-4fda	ntf-1792500039392-2722	usr-manager	SMS	\N	\N	\N	\N	2026-10-20 15:40:39.392+03	2026-10-20 15:40:39.392+03
nrec-1792500047585-1760	ntf-1792500047585-284f	usr-priya	IN_APP	\N	\N	\N	\N	2026-10-20 15:40:47.585+03	2026-10-20 15:40:47.585+03
nrec-1792114227026-7cba	ntf-1792114227026-cb8e	usr-priya	EMAIL	\N	\N	\N	\N	2026-10-16 04:30:27.026+03	2026-10-16 04:30:27.026+03
nrec-1792114227026-5f62	ntf-1792114227026-23cc	usr-priya	SMS	\N	\N	\N	\N	2026-10-16 04:30:27.026+03	2026-10-16 04:30:27.026+03
nrec-1792022259961-085c	ntf-1792022259961-0ac6	usr-jordan	WHATSAPP	\N	\N	\N	\N	2026-10-15 02:57:39.961+03	2026-10-15 02:57:39.961+03
nrec-1792114227026-397f	ntf-1792114227026-cce6	usr-manager	IN_APP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 04:30:27.026+03	2026-10-16 04:30:27.026+03
nrec-1792113060427-3c24	ntf-1792113060427-3e49	usr-alex	EMAIL	\N	\N	\N	\N	2026-10-16 04:11:00.427+03	2026-10-16 04:11:00.427+03
nrec-1792113060427-05cf	ntf-1792113060427-0a6f	usr-alex	SMS	\N	\N	\N	\N	2026-10-16 04:11:00.427+03	2026-10-16 04:11:00.427+03
nrec-1792022259961-c065	ntf-1792022259961-84f7	usr-jordan	IN_APP	\N	\N	\N	\N	2026-10-15 02:57:39.961+03	2026-10-15 02:57:39.961+03
nrec-1792022259961-f792	ntf-1792022259961-f9fc	usr-jordan	EMAIL	\N	\N	\N	\N	2026-10-15 02:57:39.961+03	2026-10-15 02:57:39.961+03
nrec-1792112941855-9292	ntf-1792112941855-409c	usr-alex	WHATSAPP	\N	\N	\N	\N	2026-10-16 04:09:01.855+03	2026-10-16 04:09:01.855+03
nrec-1792022259962-28c9	ntf-1792022259962-a937	usr-alex	EMAIL	\N	\N	\N	\N	2026-10-15 02:57:39.962+03	2026-10-15 02:57:39.962+03
nrec-1792022259962-5805	ntf-1792022259962-465b	usr-alex	SMS	\N	\N	\N	\N	2026-10-15 02:57:39.962+03	2026-10-15 02:57:39.962+03
nrec-1792085344743-e844	ntf-1792085344743-3631	usr-jordan	IN_APP	\N	\N	\N	\N	2026-10-15 20:29:04.743+03	2026-10-15 20:29:04.743+03
nrec-1792112941855-4602	ntf-1792112941855-f4f9	usr-manager	SMS	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 04:09:01.855+03	2026-10-16 04:09:01.855+03
nrec-1792112941855-a55a	ntf-1792112941855-a34c	usr-alex	IN_APP	\N	\N	\N	\N	2026-10-16 04:09:01.855+03	2026-10-16 04:09:01.855+03
nrec-1792113060427-b20a	ntf-1792113060427-9b60	usr-alex	IN_APP	\N	\N	\N	\N	2026-10-16 04:11:00.427+03	2026-10-16 04:11:00.427+03
nrec-1792113060427-2d7b	ntf-1792113060427-55ca	usr-alex	WHATSAPP	\N	\N	\N	\N	2026-10-16 04:11:00.427+03	2026-10-16 04:11:00.427+03
nrec-1792112941855-d24d	ntf-1792112941855-ce03	usr-alex	EMAIL	\N	\N	\N	\N	2026-10-16 04:09:01.855+03	2026-10-16 04:09:01.855+03
nrec-1792112941855-fcf5	ntf-1792112941855-3e3e	usr-alex	SMS	\N	\N	\N	\N	2026-10-16 04:09:01.855+03	2026-10-16 04:09:01.855+03
nrec-1792113060427-353e	ntf-1792113060427-35e9	usr-manager	EMAIL	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 04:11:00.427+03	2026-10-16 04:11:00.427+03
nrec-1792114227026-8054	ntf-1792114227025-8fbc	usr-jordan	IN_APP	\N	\N	\N	\N	2026-10-16 04:30:27.025+03	2026-10-16 04:30:27.025+03
nrec-1792114227026-2436	ntf-1792114227026-1307	usr-jordan	WHATSAPP	\N	\N	\N	\N	2026-10-16 04:30:27.026+03	2026-10-16 04:30:27.026+03
nrec-1792114227026-809c	ntf-1792114227026-170e	usr-jordan	EMAIL	\N	\N	\N	\N	2026-10-16 04:30:27.026+03	2026-10-16 04:30:27.026+03
nrec-1792114227026-9512	ntf-1792114227026-e607	usr-jordan	SMS	\N	\N	\N	\N	2026-10-16 04:30:27.026+03	2026-10-16 04:30:27.026+03
nrec-1792114227026-e2f8	ntf-1792114227026-1977	usr-priya	IN_APP	\N	\N	\N	\N	2026-10-16 04:30:27.026+03	2026-10-16 04:30:27.026+03
nrec-1792344663327-b1ca	ntf-1792344663327-7d06	usr-alex	SMS	\N	\N	\N	\N	2026-10-18 20:31:03.327+03	2026-10-18 20:31:03.327+03
nrec-1792344663326-46ba	ntf-1792344663324-29a1	usr-jordan	IN_APP	\N	\N	\N	\N	2026-10-18 20:31:03.324+03	2026-10-18 20:31:03.326+03
nrec-1792114227026-ab6e	ntf-1792114227026-f53e	usr-manager	WHATSAPP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 04:30:27.026+03	2026-10-16 04:30:27.026+03
nrec-1792114227027-9261	ntf-1792114227027-289e	usr-alex	SMS	\N	\N	\N	\N	2026-10-16 04:30:27.027+03	2026-10-16 04:30:27.027+03
nrec-1792022259961-3cc2	ntf-1792022259961-63ff	usr-priya	SMS	\N	\N	\N	\N	2026-10-15 02:57:39.961+03	2026-10-15 02:57:39.961+03
nrec-1792158449335-7885	ntf-1792158449335-f46f	usr-priya	WHATSAPP	\N	\N	\N	\N	2026-10-16 16:47:29.335+03	2026-10-16 16:47:29.335+03
nrec-1792160612579-52cc	ntf-1792160612579-fc95	usr-manager	IN_APP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 17:23:32.579+03	2026-10-16 17:23:32.579+03
nrec-1792160612579-73a5	ntf-1792160612579-4fcd	usr-manager	WHATSAPP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 17:23:32.579+03	2026-10-16 17:23:32.579+03
nrec-1792160612580-8fd5	ntf-1792160612579-38a5	usr-manager	EMAIL	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 17:23:32.579+03	2026-10-16 17:23:32.58+03
nrec-1792160612580-295a	ntf-1792160612580-fa95	usr-manager	SMS	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 17:23:32.58+03	2026-10-16 17:23:32.58+03
nrec-1792344663327-dffb	ntf-1792344663327-fa9e	usr-manager	EMAIL	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-18 20:31:03.327+03	2026-10-18 20:31:03.327+03
nrec-1792344663327-bd50	ntf-1792344663327-5301	usr-manager	SMS	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-18 20:31:03.327+03	2026-10-18 20:31:03.327+03
nrec-1792344663327-5d9b	ntf-1792344663327-4173	usr-alex	IN_APP	\N	\N	\N	\N	2026-10-18 20:31:03.327+03	2026-10-18 20:31:03.327+03
nrec-1792344663327-3226	ntf-1792344663327-068e	usr-alex	WHATSAPP	\N	\N	\N	\N	2026-10-18 20:31:03.327+03	2026-10-18 20:31:03.327+03
nrec-1792344663327-4533	ntf-1792344663327-8a63	usr-alex	EMAIL	\N	\N	\N	\N	2026-10-18 20:31:03.327+03	2026-10-18 20:31:03.327+03
nrec-1792158449335-dbca	ntf-1792158449334-f13f	usr-jordan	SMS	\N	\N	\N	\N	2026-10-16 16:47:29.334+03	2026-10-16 16:47:29.335+03
nrec-1792158449335-7d3e	ntf-1792158449335-d39a	usr-priya	IN_APP	\N	\N	\N	\N	2026-10-16 16:47:29.335+03	2026-10-16 16:47:29.335+03
nrec-1792408666275-afee	ntf-1792408666275-f01a	usr-jordan	EMAIL	\N	\N	\N	\N	2026-10-19 14:17:46.275+03	2026-10-19 14:17:46.275+03
nrec-1792408666276-ccf7	ntf-1792408666276-9a68	usr-jordan	SMS	\N	\N	\N	\N	2026-10-19 14:17:46.276+03	2026-10-19 14:17:46.276+03
nrec-1792408666276-8702	ntf-1792408666276-682c	usr-priya	IN_APP	\N	\N	\N	\N	2026-10-19 14:17:46.276+03	2026-10-19 14:17:46.276+03
nrec-1792408666276-a730	ntf-1792408666276-424c	usr-priya	WHATSAPP	\N	\N	\N	\N	2026-10-19 14:17:46.276+03	2026-10-19 14:17:46.276+03
nrec-1792160612580-9509	ntf-1792160612580-fc0f	usr-alex	IN_APP	\N	\N	\N	\N	2026-10-16 17:23:32.58+03	2026-10-16 17:23:32.58+03
nrec-1792160612580-3bf9	ntf-1792160612580-e997	usr-alex	WHATSAPP	\N	\N	\N	\N	2026-10-16 17:23:32.58+03	2026-10-16 17:23:32.58+03
nrec-1792160612580-2fb0	ntf-1792160612580-51ce	usr-alex	EMAIL	\N	\N	\N	\N	2026-10-16 17:23:32.58+03	2026-10-16 17:23:32.58+03
nrec-1792160612580-1d12	ntf-1792160612580-6262	usr-alex	SMS	\N	\N	\N	\N	2026-10-16 17:23:32.58+03	2026-10-16 17:23:32.58+03
nrec-1792344663327-89dc	ntf-1792344663327-3ee4	usr-priya	SMS	\N	\N	\N	\N	2026-10-18 20:31:03.327+03	2026-10-18 20:31:03.327+03
nrec-1792344663327-3ae6	ntf-1792344663327-a3a4	usr-manager	IN_APP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-18 20:31:03.327+03	2026-10-18 20:31:03.327+03
nrec-1792344663327-bc7f	ntf-1792344663327-8031	usr-manager	WHATSAPP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-18 20:31:03.327+03	2026-10-18 20:31:03.327+03
nrec-1792112941854-c656	ntf-1792112941854-e73b	usr-priya	SMS	\N	\N	\N	\N	2026-10-16 04:09:01.854+03	2026-10-16 04:09:01.854+03
nrec-1792112941855-63c7	ntf-1792112941854-3e1d	usr-manager	IN_APP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 04:09:01.854+03	2026-10-16 04:09:01.855+03
nrec-1792112941855-a0ac	ntf-1792112941855-e3f6	usr-manager	WHATSAPP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 04:09:01.855+03	2026-10-16 04:09:01.855+03
nrec-1792112941855-575e	ntf-1792112941855-3ae2	usr-manager	EMAIL	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 04:09:01.855+03	2026-10-16 04:09:01.855+03
nrec-1792085344744-59df	ntf-1792085344744-b687	usr-jordan	WHATSAPP	\N	\N	\N	\N	2026-10-15 20:29:04.744+03	2026-10-15 20:29:04.744+03
nrec-1792085344744-1bd1	ntf-1792085344744-8bc1	usr-jordan	EMAIL	\N	\N	\N	\N	2026-10-15 20:29:04.744+03	2026-10-15 20:29:04.744+03
nrec-1792155709679-0955	ntf-1792155709679-ea0e	usr-priya	EMAIL	\N	\N	\N	\N	2026-10-16 16:01:49.679+03	2026-10-16 16:01:49.679+03
nrec-1792155709679-80f7	ntf-1792155709679-ce1c	usr-priya	SMS	\N	\N	\N	\N	2026-10-16 16:01:49.679+03	2026-10-16 16:01:49.679+03
nrec-1792155709679-9bcb	ntf-1792155709679-575d	usr-manager	IN_APP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 16:01:49.679+03	2026-10-16 16:01:49.679+03
nrec-1792155709679-0e3b	ntf-1792155709679-40f1	usr-manager	WHATSAPP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 16:01:49.679+03	2026-10-16 16:01:49.679+03
nrec-1792155709679-6e9a	ntf-1792155709679-f53c	usr-manager	EMAIL	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 16:01:49.679+03	2026-10-16 16:01:49.679+03
nrec-1792155709679-e575	ntf-1792155709679-3ffd	usr-manager	SMS	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 16:01:49.679+03	2026-10-16 16:01:49.679+03
nrec-1792155709679-84a6	ntf-1792155709679-fee4	usr-alex	IN_APP	\N	\N	\N	\N	2026-10-16 16:01:49.679+03	2026-10-16 16:01:49.679+03
nrec-1792155709679-bd1c	ntf-1792155709679-f9f8	usr-alex	WHATSAPP	\N	\N	\N	\N	2026-10-16 16:01:49.679+03	2026-10-16 16:01:49.679+03
nrec-1792155709679-f6f6	ntf-1792155709679-5e6f	usr-alex	EMAIL	\N	\N	\N	\N	2026-10-16 16:01:49.679+03	2026-10-16 16:01:49.679+03
nrec-1792155709679-e5f7	ntf-1792155709679-ce39	usr-alex	SMS	\N	\N	\N	\N	2026-10-16 16:01:49.679+03	2026-10-16 16:01:49.679+03
nrec-1792158449334-1285	ntf-1792158449334-4805	usr-jordan	IN_APP	\N	\N	\N	\N	2026-10-16 16:47:29.334+03	2026-10-16 16:47:29.334+03
nrec-1792158449335-8c18	ntf-1792158449335-db84	usr-manager	IN_APP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 16:47:29.335+03	2026-10-16 16:47:29.335+03
nrec-1792158449335-e814	ntf-1792158449335-8558	usr-manager	WHATSAPP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 16:47:29.335+03	2026-10-16 16:47:29.335+03
nrec-1792158449335-c232	ntf-1792158449335-6039	usr-manager	EMAIL	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 16:47:29.335+03	2026-10-16 16:47:29.335+03
nrec-1792085344744-9da0	ntf-1792085344744-0ef8	usr-priya	EMAIL	\N	\N	\N	\N	2026-10-15 20:29:04.744+03	2026-10-15 20:29:04.744+03
nrec-1792085344744-61a3	ntf-1792085344744-fd26	usr-priya	SMS	\N	\N	\N	\N	2026-10-15 20:29:04.744+03	2026-10-15 20:29:04.744+03
nrec-1792085344744-8c9c	ntf-1792085344744-5c66	usr-manager	IN_APP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-15 20:29:04.744+03	2026-10-15 20:29:04.744+03
nrec-1792500970362-8ed0	ntf-1792500970362-e5dd	usr-priya	IN_APP	\N	\N	\N	\N	2026-10-20 15:56:10.362+03	2026-10-20 15:56:10.362+03
nrec-1792116160147-244e	ntf-1792116160147-7f66	usr-jordan	SMS	\N	\N	\N	\N	2026-10-16 05:02:40.147+03	2026-10-16 05:02:40.147+03
nrec-1792116160147-a9af	ntf-1792116160147-a603	usr-priya	IN_APP	\N	\N	\N	\N	2026-10-16 05:02:40.147+03	2026-10-16 05:02:40.147+03
nrec-1792085344744-2580	ntf-1792085344744-9ea9	usr-jordan	SMS	\N	\N	\N	\N	2026-10-15 20:29:04.744+03	2026-10-15 20:29:04.744+03
nrec-1792085344744-b792	ntf-1792085344744-8a93	usr-priya	IN_APP	\N	\N	\N	\N	2026-10-15 20:29:04.744+03	2026-10-15 20:29:04.744+03
nrec-1792085344744-aa31	ntf-1792085344744-43f5	usr-priya	WHATSAPP	\N	\N	\N	\N	2026-10-15 20:29:04.744+03	2026-10-15 20:29:04.744+03
nrec-1792022259962-9c53	ntf-1792022259962-7d8c	usr-manager	WHATSAPP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-15 02:57:39.962+03	2026-10-15 02:57:39.962+03
nrec-1792085344744-79fd	ntf-1792085344744-94a5	usr-manager	WHATSAPP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-15 20:29:04.744+03	2026-10-15 20:29:04.744+03
nrec-1792085344744-5a76	ntf-1792085344744-aaf9	usr-manager	EMAIL	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-15 20:29:04.744+03	2026-10-15 20:29:04.744+03
nrec-1792085344744-efeb	ntf-1792085344744-db19	usr-manager	SMS	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-15 20:29:04.744+03	2026-10-15 20:29:04.744+03
nrec-1792085344744-6f62	ntf-1792085344744-2915	usr-alex	IN_APP	\N	\N	\N	\N	2026-10-15 20:29:04.744+03	2026-10-15 20:29:04.744+03
nrec-1792085344744-bead	ntf-1792085344744-1528	usr-alex	WHATSAPP	\N	\N	\N	\N	2026-10-15 20:29:04.744+03	2026-10-15 20:29:04.744+03
nrec-1792085344744-6b53	ntf-1792085344744-066e	usr-alex	EMAIL	\N	\N	\N	\N	2026-10-15 20:29:04.744+03	2026-10-15 20:29:04.744+03
nrec-1792085344744-31f9	ntf-1792085344744-89b8	usr-alex	SMS	\N	\N	\N	\N	2026-10-15 20:29:04.744+03	2026-10-15 20:29:04.744+03
nrec-1792112941854-fd06	ntf-1792112941854-5666	usr-jordan	IN_APP	\N	\N	\N	\N	2026-10-16 04:09:01.854+03	2026-10-16 04:09:01.854+03
nrec-1792112941854-5415	ntf-1792112941854-2375	usr-jordan	WHATSAPP	\N	\N	\N	\N	2026-10-16 04:09:01.854+03	2026-10-16 04:09:01.854+03
nrec-1792112941854-9363	ntf-1792112941854-f56b	usr-jordan	EMAIL	\N	\N	\N	\N	2026-10-16 04:09:01.854+03	2026-10-16 04:09:01.854+03
nrec-1792112941854-053f	ntf-1792112941854-b536	usr-jordan	SMS	\N	\N	\N	\N	2026-10-16 04:09:01.854+03	2026-10-16 04:09:01.854+03
nrec-1792112941854-d861	ntf-1792112941854-3b85	usr-priya	IN_APP	\N	\N	\N	\N	2026-10-16 04:09:01.854+03	2026-10-16 04:09:01.854+03
nrec-1792112941854-a5ca	ntf-1792112941854-2a48	usr-priya	WHATSAPP	\N	\N	\N	\N	2026-10-16 04:09:01.854+03	2026-10-16 04:09:01.854+03
nrec-1792112941854-cdd4	ntf-1792112941854-2e05	usr-priya	EMAIL	\N	\N	\N	\N	2026-10-16 04:09:01.854+03	2026-10-16 04:09:01.854+03
nrec-1792113060426-ddf6	ntf-1792113060426-beba	usr-jordan	WHATSAPP	\N	\N	\N	\N	2026-10-16 04:11:00.426+03	2026-10-16 04:11:00.426+03
nrec-1792113060426-e7a3	ntf-1792113060426-8ff9	usr-jordan	EMAIL	\N	\N	\N	\N	2026-10-16 04:11:00.426+03	2026-10-16 04:11:00.426+03
nrec-1792113060426-92e9	ntf-1792113060426-11fb	usr-jordan	SMS	\N	\N	\N	\N	2026-10-16 04:11:00.426+03	2026-10-16 04:11:00.426+03
nrec-1792113060426-a369	ntf-1792113060426-5dba	usr-priya	IN_APP	\N	\N	\N	\N	2026-10-16 04:11:00.426+03	2026-10-16 04:11:00.426+03
nrec-1792113060426-5810	ntf-1792113060426-1b59	usr-priya	WHATSAPP	\N	\N	\N	\N	2026-10-16 04:11:00.426+03	2026-10-16 04:11:00.426+03
nrec-1792113060426-3e91	ntf-1792113060426-ef2b	usr-priya	EMAIL	\N	\N	\N	\N	2026-10-16 04:11:00.426+03	2026-10-16 04:11:00.426+03
nrec-1792113060426-e070	ntf-1792113060426-bdec	usr-priya	SMS	\N	\N	\N	\N	2026-10-16 04:11:00.426+03	2026-10-16 04:11:00.426+03
nrec-1792113060426-cba1	ntf-1792113060426-1f5d	usr-manager	IN_APP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 04:11:00.426+03	2026-10-16 04:11:00.426+03
nrec-1792022259962-b661	ntf-1792022259962-7de8	usr-manager	IN_APP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-15 02:57:39.962+03	2026-10-15 02:57:39.962+03
nrec-1792116160147-02ab	ntf-1792116160147-183d	usr-priya	WHATSAPP	\N	\N	\N	\N	2026-10-16 05:02:40.147+03	2026-10-16 05:02:40.147+03
nrec-1792116544532-4979	ntf-1792116544532-dd89	usr-manager	IN_APP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 05:09:04.532+03	2026-10-16 05:09:04.532+03
nrec-1792116544532-e73a	ntf-1792116544532-cdcc	usr-manager	WHATSAPP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 05:09:04.532+03	2026-10-16 05:09:04.532+03
nrec-1792116544532-be56	ntf-1792116544532-73ca	usr-manager	EMAIL	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 05:09:04.532+03	2026-10-16 05:09:04.532+03
nrec-1792055792621-3dad	ntf-1792055792621-ef9e	usr-alex	IN_APP	\N	\N	\N	\N	2026-10-15 12:16:32.621+03	2026-10-15 12:16:32.621+03
nrec-1792055792621-81dc	ntf-1792055792621-a608	usr-alex	WHATSAPP	\N	\N	\N	\N	2026-10-15 12:16:32.621+03	2026-10-15 12:16:32.621+03
nrec-1792055792621-db5f	ntf-1792055792621-93a1	usr-alex	EMAIL	\N	\N	\N	\N	2026-10-15 12:16:32.621+03	2026-10-15 12:16:32.621+03
nrec-1792154726492-c582	ntf-1792154726491-b07f	usr-manager	EMAIL	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 15:45:26.491+03	2026-10-16 15:45:26.492+03
nrec-1792491216910-15ec	ntf-1792491216909-bb04	usr-manager	IN_APP	\N	\N	\N	\N	2026-10-20 13:13:36.909+03	2026-10-20 13:13:36.91+03
nrec-1792491216910-30a2	ntf-1792491216909-bb04	usr-alex	IN_APP	\N	\N	\N	\N	2026-10-20 13:13:36.909+03	2026-10-20 13:13:36.91+03
nrec-1792500039391-b288	ntf-1792500039391-0cd2	usr-priya	EMAIL	\N	\N	\N	\N	2026-10-20 15:40:39.391+03	2026-10-20 15:40:39.391+03
nrec-1792500039392-4a52	ntf-1792500039392-9744	usr-priya	SMS	\N	\N	\N	\N	2026-10-20 15:40:39.392+03	2026-10-20 15:40:39.392+03
nrec-1792500039392-f536	ntf-1792500039392-809d	usr-manager	IN_APP	\N	\N	\N	\N	2026-10-20 15:40:39.392+03	2026-10-20 15:40:39.392+03
nrec-1792500039392-5401	ntf-1792500039392-c7b8	usr-manager	WHATSAPP	\N	\N	\N	\N	2026-10-20 15:40:39.392+03	2026-10-20 15:40:39.392+03
nrec-1792500039392-3da8	ntf-1792500039392-f735	usr-manager	EMAIL	\N	\N	\N	\N	2026-10-20 15:40:39.392+03	2026-10-20 15:40:39.392+03
nrec-1792500047585-ca30	ntf-1792500047585-8097	usr-priya	WHATSAPP	\N	\N	\N	\N	2026-10-20 15:40:47.585+03	2026-10-20 15:40:47.585+03
nrec-1792500047585-8bc0	ntf-1792500047585-e498	usr-priya	EMAIL	\N	\N	\N	\N	2026-10-20 15:40:47.585+03	2026-10-20 15:40:47.585+03
nrec-1792500047585-5642	ntf-1792500047585-8171	usr-priya	SMS	\N	\N	\N	\N	2026-10-20 15:40:47.585+03	2026-10-20 15:40:47.585+03
nrec-1792158449335-803c	ntf-1792158449335-175f	usr-manager	SMS	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-16 16:47:29.335+03	2026-10-16 16:47:29.335+03
nrec-1792158449335-3496	ntf-1792158449335-6f79	usr-alex	IN_APP	\N	\N	\N	\N	2026-10-16 16:47:29.335+03	2026-10-16 16:47:29.335+03
nrec-1792158449335-f604	ntf-1792158449335-a4f8	usr-alex	WHATSAPP	\N	\N	\N	\N	2026-10-16 16:47:29.335+03	2026-10-16 16:47:29.335+03
nrec-1792158449335-4ff8	ntf-1792158449335-9d2b	usr-alex	EMAIL	\N	\N	\N	\N	2026-10-16 16:47:29.335+03	2026-10-16 16:47:29.335+03
nrec-1792158449335-d99f	ntf-1792158449335-0b36	usr-alex	SMS	\N	\N	\N	\N	2026-10-16 16:47:29.335+03	2026-10-16 16:47:29.335+03
nrec-1792158449334-e71f	ntf-1792158449334-6787	usr-jordan	WHATSAPP	\N	\N	\N	\N	2026-10-16 16:47:29.334+03	2026-10-16 16:47:29.334+03
nrec-1792158449334-59a1	ntf-1792158449334-79dc	usr-jordan	EMAIL	\N	\N	\N	\N	2026-10-16 16:47:29.334+03	2026-10-16 16:47:29.334+03
nrec-1792160612578-8ce2	ntf-1792160612578-d7d6	usr-jordan	IN_APP	\N	\N	\N	\N	2026-10-16 17:23:32.578+03	2026-10-16 17:23:32.578+03
nrec-1792160612578-dc24	ntf-1792160612578-7e5e	usr-jordan	WHATSAPP	\N	\N	\N	\N	2026-10-16 17:23:32.578+03	2026-10-16 17:23:32.578+03
nrec-1792160612578-a27f	ntf-1792160612578-5823	usr-jordan	EMAIL	\N	\N	\N	\N	2026-10-16 17:23:32.578+03	2026-10-16 17:23:32.578+03
nrec-1792160612578-696a	ntf-1792160612578-586d	usr-jordan	SMS	\N	\N	\N	\N	2026-10-16 17:23:32.578+03	2026-10-16 17:23:32.578+03
nrec-1792160612579-76b5	ntf-1792160612579-e20c	usr-priya	IN_APP	\N	\N	\N	\N	2026-10-16 17:23:32.579+03	2026-10-16 17:23:32.579+03
nrec-1792160612579-6933	ntf-1792160612579-3f11	usr-priya	WHATSAPP	\N	\N	\N	\N	2026-10-16 17:23:32.579+03	2026-10-16 17:23:32.579+03
nrec-1792160612579-0619	ntf-1792160612579-7f8b	usr-priya	EMAIL	\N	\N	\N	\N	2026-10-16 17:23:32.579+03	2026-10-16 17:23:32.579+03
nrec-1792160612579-7f19	ntf-1792160612579-f9aa	usr-priya	SMS	\N	\N	\N	\N	2026-10-16 17:23:32.579+03	2026-10-16 17:23:32.579+03
nrec-1792344663326-b08e	ntf-1792344663326-3720	usr-jordan	WHATSAPP	\N	\N	\N	\N	2026-10-18 20:31:03.326+03	2026-10-18 20:31:03.326+03
nrec-1792344663326-2e24	ntf-1792344663326-e729	usr-jordan	EMAIL	\N	\N	\N	\N	2026-10-18 20:31:03.326+03	2026-10-18 20:31:03.326+03
nrec-1792344663326-3bf4	ntf-1792344663326-2c42	usr-jordan	SMS	\N	\N	\N	\N	2026-10-18 20:31:03.326+03	2026-10-18 20:31:03.326+03
nrec-1792344663326-642e	ntf-1792344663326-61d9	usr-priya	IN_APP	\N	\N	\N	\N	2026-10-18 20:31:03.326+03	2026-10-18 20:31:03.326+03
nrec-1792344663326-cdaf	ntf-1792344663326-8c66	usr-priya	WHATSAPP	\N	\N	\N	\N	2026-10-18 20:31:03.326+03	2026-10-18 20:31:03.326+03
nrec-1792344663326-22d7	ntf-1792344663326-ceb8	usr-priya	EMAIL	\N	\N	\N	\N	2026-10-18 20:31:03.326+03	2026-10-18 20:31:03.326+03
nrec-1792408666275-db94	ntf-1792408666274-fb44	usr-jordan	IN_APP	\N	\N	\N	\N	2026-10-19 14:17:46.274+03	2026-10-19 14:17:46.275+03
nrec-1792408666275-f151	ntf-1792408666275-c5a8	usr-jordan	WHATSAPP	\N	\N	\N	\N	2026-10-19 14:17:46.275+03	2026-10-19 14:17:46.275+03
nrec-1792408666278-115a	ntf-1792408666278-e4ca	usr-alex	WHATSAPP	\N	\N	\N	\N	2026-10-19 14:17:46.278+03	2026-10-19 14:17:46.278+03
nrec-1792408666278-39ae	ntf-1792408666278-3d3e	usr-alex	EMAIL	\N	\N	\N	\N	2026-10-19 14:17:46.278+03	2026-10-19 14:17:46.278+03
nrec-1792408666278-381b	ntf-1792408666278-5f7a	usr-alex	SMS	\N	\N	\N	\N	2026-10-19 14:17:46.278+03	2026-10-19 14:17:46.278+03
nrec-1792408666276-a283	ntf-1792408666276-150b	usr-priya	SMS	\N	\N	\N	\N	2026-10-19 14:17:46.276+03	2026-10-19 14:17:46.276+03
nrec-1792408666277-c47e	ntf-1792408666276-42c7	usr-manager	IN_APP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-19 14:17:46.276+03	2026-10-19 14:17:46.277+03
nrec-1792408666277-1867	ntf-1792408666277-6601	usr-manager	WHATSAPP	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-19 14:17:46.277+03	2026-10-19 14:17:46.277+03
nrec-1792408666277-96c2	ntf-1792408666277-8905	usr-manager	EMAIL	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-19 14:17:46.277+03	2026-10-19 14:17:46.277+03
nrec-1792408666278-5979	ntf-1792408666277-d644	usr-manager	SMS	\N	2026-10-19 21:06:42.101+03	\N	\N	2026-10-19 14:17:46.277+03	2026-10-19 14:17:46.278+03
nrec-1792408666278-ad89	ntf-1792408666278-1f47	usr-alex	IN_APP	\N	\N	\N	\N	2026-10-19 14:17:46.278+03	2026-10-19 14:17:46.278+03
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
ntf-1792022259962-dda3	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-28	/workspace/purchasing	/workspace/purchasing	2026-10-15 02:57:39.962+03	usr-manager	\N	PENDING	\N	2026-10-15 02:57:39.962+03
ntf-1792022259962-7d8c	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-28	/workspace/purchasing	/workspace/purchasing	2026-10-15 02:57:39.962+03	usr-manager	\N	PENDING	\N	2026-10-15 02:57:39.962+03
ntf-1792048965554-a58b	LowStockAlert	Low stock alert	An ingredient has fallen to or below its reorder level. Review stock and raise a purchase requirement.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 10:22:45.554+03	usr-manager	\N	PENDING	\N	2026-10-15 10:22:45.554+03
ntf-1792048965554-7bff	LowStockAlert	Low stock alert	An ingredient is running low. Consider reordering soon.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 10:22:45.554+03	usr-manager	\N	PENDING	\N	2026-10-15 10:22:45.554+03
ntf-1792048965554-db67	LowStockAlert	Low stock alert	An ingredient has fallen to or below its reorder level. Review inventory and raise a purchase requirement.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 10:22:45.554+03	usr-manager	\N	PENDING	\N	2026-10-15 10:22:45.554+03
ntf-1792500970362-71d0	InquiryCreated	New inquiry	A new customer inquiry has been received.	MEDIUM	inquiry	inq-1792500970361-d2cf	/crm?inquiry=inq-1792500970361-d2cf	\N	2026-10-20 15:56:10.362+03	\N	\N	PENDING	\N	2026-10-20 15:56:10.362+03
ntf-1792113060426-bdec	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792113059659-bb6f	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:11:00.426+03	usr-manager	\N	PENDING	\N	2026-10-16 04:11:00.426+03
ntf-1792500970362-7a40	InquiryCreated	New inquiry	New inquiry received.	MEDIUM	inquiry	inq-1792500970361-d2cf	/crm?inquiry=inq-1792500970361-d2cf	\N	2026-10-20 15:56:10.362+03	\N	\N	PENDING	\N	2026-10-20 15:56:10.362+03
ntf-1792500970362-76da	InquiryCreated	New inquiry	A new customer inquiry requires attention from the Customer Support team.	MEDIUM	inquiry	inq-1792500970361-d2cf	/crm?inquiry=inq-1792500970361-d2cf	\N	2026-10-20 15:56:10.362+03	\N	\N	PENDING	\N	2026-10-20 15:56:10.362+03
ntf-1792048965554-ad13	LowStockAlert	Low stock alert	Stock alert: an ingredient is below its reorder level.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 10:22:45.554+03	usr-manager	\N	PENDING	\N	2026-10-15 10:22:45.554+03
ntf-1792022259961-246d	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-28	/workspace/purchasing	/workspace/purchasing	2026-10-15 02:57:39.961+03	usr-manager	\N	PENDING	\N	2026-10-15 02:57:39.961+03
ntf-1792048965554-c695	LowStockAlert	Low stock alert	An ingredient is running low. Consider reordering soon.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 10:22:45.554+03	usr-manager	\N	PENDING	\N	2026-10-15 10:22:45.554+03
ntf-1792154726492-a670	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792154723260-257c	/workspace/purchasing	/workspace/purchasing	2026-10-16 15:45:26.492+03	usr-manager	\N	PENDING	\N	2026-10-16 15:45:26.492+03
ntf-1792116544531-604b	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792116541225-e2ff	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:09:04.531+03	usr-manager	\N	PENDING	\N	2026-10-16 05:09:04.531+03
ntf-1792055792621-5673	LowStockAlert	Low stock alert	An ingredient has fallen to or below its reorder level. Review stock and raise a purchase requirement.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 12:16:32.62+03	usr-manager	\N	PENDING	\N	2026-10-15 12:16:32.62+03
ntf-1792500047585-e498	InquiryCreated	New inquiry	A new customer inquiry has been received.	MEDIUM	inquiry	inq-1792500047584-8907	/crm?inquiry=inq-1792500047584-8907	\N	2026-10-20 15:40:47.585+03	\N	\N	PENDING	\N	2026-10-20 15:40:47.585+03
ntf-1792500047585-8171	InquiryCreated	New inquiry	New inquiry received.	MEDIUM	inquiry	inq-1792500047584-8907	/crm?inquiry=inq-1792500047584-8907	\N	2026-10-20 15:40:47.585+03	\N	\N	PENDING	\N	2026-10-20 15:40:47.585+03
ntf-1792500047585-b50d	InquiryCreated	New inquiry	A new customer inquiry requires attention from the Customer Support team.	MEDIUM	inquiry	inq-1792500047584-8907	/crm?inquiry=inq-1792500047584-8907	\N	2026-10-20 15:40:47.585+03	\N	\N	PENDING	\N	2026-10-20 15:40:47.585+03
ntf-1792500047585-49a9	InquiryCreated	New inquiry	New customer inquiry received. Please respond.	MEDIUM	inquiry	inq-1792500047584-8907	/crm?inquiry=inq-1792500047584-8907	\N	2026-10-20 15:40:47.585+03	\N	\N	PENDING	\N	2026-10-20 15:40:47.585+03
ntf-1792116544532-9a92	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792116541225-e2ff	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:09:04.531+03	usr-manager	\N	PENDING	\N	2026-10-16 05:09:04.531+03
ntf-1792055792621-fafa	LowStockAlert	Low stock alert	An ingredient has fallen to or below its reorder level. Review stock and raise a purchase requirement.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 12:16:32.621+03	usr-manager	\N	PENDING	\N	2026-10-15 12:16:32.621+03
ntf-1792055792621-ce43	LowStockAlert	Low stock alert	An ingredient is running low. Consider reordering soon.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 12:16:32.621+03	usr-manager	\N	PENDING	\N	2026-10-15 12:16:32.621+03
ntf-1792114227026-dd50	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792114226247-fb21	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:30:27.026+03	usr-manager	\N	PENDING	\N	2026-10-16 04:30:27.026+03
ntf-1792116544531-2914	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792116541225-e2ff	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:09:04.531+03	usr-manager	\N	PENDING	\N	2026-10-16 05:09:04.531+03
ntf-1792500970362-fb57	InquiryCreated	New inquiry	New customer inquiry received. Please respond.	MEDIUM	inquiry	inq-1792500970361-d2cf	/crm?inquiry=inq-1792500970361-d2cf	\N	2026-10-20 15:56:10.362+03	\N	\N	PENDING	\N	2026-10-20 15:56:10.362+03
ntf-1792116544531-20cd	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792116541225-e2ff	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:09:04.531+03	usr-manager	\N	PENDING	\N	2026-10-16 05:09:04.531+03
ntf-1792344663326-3720	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-27	/workspace/purchasing	/workspace/purchasing	2026-10-18 20:31:03.326+03	usr-manager	\N	PENDING	\N	2026-10-18 20:31:03.326+03
ntf-1792154726492-bd8d	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792154723260-257c	/workspace/purchasing	/workspace/purchasing	2026-10-16 15:45:26.492+03	usr-manager	\N	PENDING	\N	2026-10-16 15:45:26.492+03
ntf-1792116160148-a08d	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792116159141-6dcb	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:02:40.148+03	usr-manager	\N	PENDING	\N	2026-10-16 05:02:40.148+03
ntf-1792500047585-7fb1	InquiryCreated	New inquiry	A new customer inquiry has been received.	MEDIUM	inquiry	inq-1792500047584-8907	/crm?inquiry=inq-1792500047584-8907	\N	2026-10-20 15:40:47.585+03	\N	\N	PENDING	\N	2026-10-20 15:40:47.585+03
ntf-1792500047585-2c64	InquiryCreated	New inquiry	New inquiry received.	MEDIUM	inquiry	inq-1792500047584-8907	/crm?inquiry=inq-1792500047584-8907	\N	2026-10-20 15:40:47.585+03	\N	\N	PENDING	\N	2026-10-20 15:40:47.585+03
ntf-1792500970362-e5dd	InquiryCreated	New inquiry	A new customer inquiry requires attention from the Customer Support team.	MEDIUM	inquiry	inq-1792500970361-d2cf	/crm?inquiry=inq-1792500970361-d2cf	\N	2026-10-20 15:56:10.362+03	\N	\N	PENDING	\N	2026-10-20 15:56:10.362+03
ntf-1792500970362-45f2	InquiryCreated	New inquiry	New customer inquiry received. Please respond.	MEDIUM	inquiry	inq-1792500970361-d2cf	/crm?inquiry=inq-1792500970361-d2cf	\N	2026-10-20 15:56:10.362+03	\N	\N	PENDING	\N	2026-10-20 15:56:10.362+03
ntf-1792500970362-a0a5	InquiryCreated	New inquiry	A new customer inquiry has been received.	MEDIUM	inquiry	inq-1792500970361-d2cf	/crm?inquiry=inq-1792500970361-d2cf	\N	2026-10-20 15:56:10.362+03	\N	\N	PENDING	\N	2026-10-20 15:56:10.362+03
ntf-1792500970362-6247	InquiryCreated	New inquiry	New inquiry received.	MEDIUM	inquiry	inq-1792500970361-d2cf	/crm?inquiry=inq-1792500970361-d2cf	\N	2026-10-20 15:56:10.362+03	\N	\N	PENDING	\N	2026-10-20 15:56:10.362+03
ntf-1792154726490-4ec8	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792154723260-257c	/workspace/purchasing	/workspace/purchasing	2026-10-16 15:45:26.49+03	usr-manager	\N	PENDING	\N	2026-10-16 15:45:26.49+03
ntf-1792055792621-62a0	LowStockAlert	Low stock alert	An ingredient has fallen to or below its reorder level. Review inventory and raise a purchase requirement.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 12:16:32.621+03	usr-manager	\N	PENDING	\N	2026-10-15 12:16:32.621+03
ntf-1792085344743-3631	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792085344135-b36d	/workspace/purchasing	/workspace/purchasing	2026-10-15 20:29:04.743+03	usr-manager	\N	PENDING	\N	2026-10-15 20:29:04.743+03
ntf-1792022259961-f9fc	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-28	/workspace/purchasing	/workspace/purchasing	2026-10-15 02:57:39.961+03	usr-manager	\N	PENDING	\N	2026-10-15 02:57:39.961+03
ntf-1792055792621-93a1	LowStockAlert	Low stock alert	An ingredient has fallen to or below its reorder level. Review inventory and raise a purchase requirement.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 12:16:32.621+03	usr-manager	\N	PENDING	\N	2026-10-15 12:16:32.621+03
ntf-1792048965553-213c	LowStockAlert	Low stock alert	An ingredient is running low. Consider reordering soon.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 10:22:45.553+03	usr-manager	\N	PENDING	\N	2026-10-15 10:22:45.553+03
ntf-1792160612580-fc0f	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792160603594-43eb	/workspace/purchasing	/workspace/purchasing	2026-10-16 17:23:32.58+03	usr-manager	\N	PENDING	\N	2026-10-16 17:23:32.58+03
ntf-1792160612580-6262	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792160603594-43eb	/workspace/purchasing	/workspace/purchasing	2026-10-16 17:23:32.58+03	usr-manager	\N	PENDING	\N	2026-10-16 17:23:32.58+03
ntf-1792160612578-5823	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792160603594-43eb	/workspace/purchasing	/workspace/purchasing	2026-10-16 17:23:32.578+03	usr-manager	\N	PENDING	\N	2026-10-16 17:23:32.578+03
ntf-1792160612578-586d	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792160603594-43eb	/workspace/purchasing	/workspace/purchasing	2026-10-16 17:23:32.578+03	usr-manager	\N	PENDING	\N	2026-10-16 17:23:32.578+03
ntf-1792155709678-f0e9	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792155706790-7b39	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:01:49.678+03	usr-manager	\N	PENDING	\N	2026-10-16 16:01:49.678+03
ntf-1792158449335-f115	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792158446360-e508	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:47:29.335+03	usr-manager	\N	PENDING	\N	2026-10-16 16:47:29.335+03
ntf-1792344663327-3ee4	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-27	/workspace/purchasing	/workspace/purchasing	2026-10-18 20:31:03.327+03	usr-manager	\N	PENDING	\N	2026-10-18 20:31:03.327+03
ntf-1792158449334-f13f	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792158446360-e508	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:47:29.334+03	usr-manager	\N	PENDING	\N	2026-10-16 16:47:29.334+03
ntf-1792158449335-d39a	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792158446360-e508	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:47:29.335+03	usr-manager	\N	PENDING	\N	2026-10-16 16:47:29.335+03
ntf-1792116544532-7bfd	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792116541225-e2ff	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:09:04.532+03	usr-manager	\N	PENDING	\N	2026-10-16 05:09:04.532+03
ntf-1792154726491-c2c5	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792154723260-257c	/workspace/purchasing	/workspace/purchasing	2026-10-16 15:45:26.491+03	usr-manager	\N	PENDING	\N	2026-10-16 15:45:26.491+03
ntf-1792154726491-b0a3	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792154723260-257c	/workspace/purchasing	/workspace/purchasing	2026-10-16 15:45:26.491+03	usr-manager	\N	PENDING	\N	2026-10-16 15:45:26.491+03
ntf-1792024833584-47f2	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792024832723-f846	/workspace/purchasing	/workspace/purchasing	2026-10-15 03:40:33.584+03	usr-manager	\N	PENDING	\N	2026-10-15 03:40:33.584+03
ntf-1792116160147-8d65	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792116159141-6dcb	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:02:40.147+03	usr-manager	\N	PENDING	\N	2026-10-16 05:02:40.147+03
ntf-1792116160147-83ff	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792116159141-6dcb	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:02:40.147+03	usr-manager	\N	PENDING	\N	2026-10-16 05:02:40.147+03
ntf-1792158449335-a4f8	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792158446360-e508	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:47:29.335+03	usr-manager	\N	PENDING	\N	2026-10-16 16:47:29.335+03
ntf-1792112941855-3e3e	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792112941148-b4d8	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:09:01.855+03	usr-manager	\N	PENDING	\N	2026-10-16 04:09:01.855+03
ntf-1792022259961-84f7	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-28	/workspace/purchasing	/workspace/purchasing	2026-10-15 02:57:39.961+03	usr-manager	\N	PENDING	\N	2026-10-15 02:57:39.961+03
ntf-1792112941855-e3f6	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792112941148-b4d8	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:09:01.855+03	usr-manager	\N	PENDING	\N	2026-10-16 04:09:01.855+03
ntf-1792085344744-8bc1	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792085344135-b36d	/workspace/purchasing	/workspace/purchasing	2026-10-15 20:29:04.744+03	usr-manager	\N	PENDING	\N	2026-10-15 20:29:04.744+03
ntf-1792085344744-9ea9	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792085344135-b36d	/workspace/purchasing	/workspace/purchasing	2026-10-15 20:29:04.744+03	usr-manager	\N	PENDING	\N	2026-10-15 20:29:04.744+03
ntf-1792116160147-fba4	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792116159141-6dcb	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:02:40.147+03	usr-manager	\N	PENDING	\N	2026-10-16 05:02:40.147+03
ntf-1792154726492-6229	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792154723260-257c	/workspace/purchasing	/workspace/purchasing	2026-10-16 15:45:26.492+03	usr-manager	\N	PENDING	\N	2026-10-16 15:45:26.492+03
ntf-1792155709678-4fc1	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792155706790-7b39	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:01:49.678+03	usr-manager	\N	PENDING	\N	2026-10-16 16:01:49.678+03
ntf-1792112941855-3ae2	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792112941148-b4d8	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:09:01.855+03	usr-manager	\N	PENDING	\N	2026-10-16 04:09:01.855+03
ntf-1792112941855-f4f9	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792112941148-b4d8	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:09:01.855+03	usr-manager	\N	PENDING	\N	2026-10-16 04:09:01.855+03
ntf-1792112941855-a34c	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792112941148-b4d8	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:09:01.855+03	usr-manager	\N	PENDING	\N	2026-10-16 04:09:01.855+03
ntf-1792491216909-bb04	OrderCompleted	Customer follow-up requested	Order TC-1055 for peterr is Completed / Delivered. Follow up with the customer and document it in Customers & CRM.	MEDIUM	order	order-1792427929087-5e19	/workspace/crm	/workspace/crm	2026-10-20 13:13:36.909+03	usr-manager	\N	PENDING	\N	2026-10-20 13:13:36.909+03
ntf-1792155709678-6cbc	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792155706790-7b39	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:01:49.678+03	usr-manager	\N	PENDING	\N	2026-10-16 16:01:49.678+03
ntf-1792158449334-79dc	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792158446360-e508	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:47:29.334+03	usr-manager	\N	PENDING	\N	2026-10-16 16:47:29.334+03
ntf-1792344663326-e729	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-27	/workspace/purchasing	/workspace/purchasing	2026-10-18 20:31:03.326+03	usr-manager	\N	PENDING	\N	2026-10-18 20:31:03.326+03
ntf-1792344663326-2c42	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-27	/workspace/purchasing	/workspace/purchasing	2026-10-18 20:31:03.326+03	usr-manager	\N	PENDING	\N	2026-10-18 20:31:03.326+03
ntf-1792116544532-cdcc	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792116541225-e2ff	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:09:04.532+03	usr-manager	\N	PENDING	\N	2026-10-16 05:09:04.532+03
ntf-1792160612579-e20c	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792160603594-43eb	/workspace/purchasing	/workspace/purchasing	2026-10-16 17:23:32.579+03	usr-manager	\N	PENDING	\N	2026-10-16 17:23:32.579+03
ntf-1792344663324-29a1	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-27	/workspace/purchasing	/workspace/purchasing	2026-10-18 20:31:03.324+03	usr-manager	\N	PENDING	\N	2026-10-18 20:31:03.324+03
ntf-1792116544532-73ca	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792116541225-e2ff	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:09:04.532+03	usr-manager	\N	PENDING	\N	2026-10-16 05:09:04.532+03
ntf-1792085344744-b687	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792085344135-b36d	/workspace/purchasing	/workspace/purchasing	2026-10-15 20:29:04.744+03	usr-manager	\N	PENDING	\N	2026-10-15 20:29:04.744+03
ntf-1792055792621-a608	LowStockAlert	Low stock alert	An ingredient is running low. Consider reordering soon.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 12:16:32.621+03	usr-manager	\N	PENDING	\N	2026-10-15 12:16:32.621+03
ntf-1792116160147-7f66	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792116159141-6dcb	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:02:40.147+03	usr-manager	\N	PENDING	\N	2026-10-16 05:02:40.147+03
ntf-1792055792621-d5bc	LowStockAlert	Low stock alert	Stock alert: an ingredient is below its reorder level.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 12:16:32.621+03	usr-manager	\N	PENDING	\N	2026-10-15 12:16:32.621+03
ntf-1792048965553-66fc	LowStockAlert	Low stock alert	An ingredient has fallen to or below its reorder level. Review stock and raise a purchase requirement.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 10:22:45.553+03	usr-manager	\N	PENDING	\N	2026-10-15 10:22:45.553+03
ntf-1792158449335-f46f	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792158446360-e508	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:47:29.335+03	usr-manager	\N	PENDING	\N	2026-10-16 16:47:29.335+03
notif-1	StockShortageDetected	3 ingredients are running low	Review stock before the next batch.	HIGH	inventory	inv-flour	\N	\N	2026-10-08 19:28:15.824+03	usr-manager	\N	PENDING	\N	2026-10-08 19:28:15.824+03
ntf-1792116544531-5444	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792116541225-e2ff	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:09:04.531+03	usr-manager	\N	PENDING	\N	2026-10-16 05:09:04.531+03
ntf-1792055792621-7591	LowStockAlert	Low stock alert	An ingredient has fallen to or below its reorder level. Review inventory and raise a purchase requirement.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 12:16:32.621+03	usr-manager	\N	PENDING	\N	2026-10-15 12:16:32.621+03
ntf-1792160612580-fa95	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792160603594-43eb	/workspace/purchasing	/workspace/purchasing	2026-10-16 17:23:32.58+03	usr-manager	\N	PENDING	\N	2026-10-16 17:23:32.58+03
ntf-1792408666276-159f	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792408627298-be31	/workspace/purchasing	/workspace/purchasing	2026-10-19 14:17:46.276+03	usr-manager	\N	PENDING	\N	2026-10-19 14:17:46.276+03
ntf-1792408666276-150b	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792408627298-be31	/workspace/purchasing	/workspace/purchasing	2026-10-19 14:17:46.276+03	usr-manager	\N	PENDING	\N	2026-10-19 14:17:46.276+03
ntf-1792158449335-e3da	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792158446360-e508	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:47:29.335+03	usr-manager	\N	PENDING	\N	2026-10-16 16:47:29.335+03
ntf-1792158449335-db84	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792158446360-e508	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:47:29.335+03	usr-manager	\N	PENDING	\N	2026-10-16 16:47:29.335+03
ntf-1792160612579-3f11	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792160603594-43eb	/workspace/purchasing	/workspace/purchasing	2026-10-16 17:23:32.579+03	usr-manager	\N	PENDING	\N	2026-10-16 17:23:32.579+03
ntf-1792408666276-9a68	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792408627298-be31	/workspace/purchasing	/workspace/purchasing	2026-10-19 14:17:46.276+03	usr-manager	\N	PENDING	\N	2026-10-19 14:17:46.276+03
ntf-1792408666276-682c	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792408627298-be31	/workspace/purchasing	/workspace/purchasing	2026-10-19 14:17:46.276+03	usr-manager	\N	PENDING	\N	2026-10-19 14:17:46.276+03
ntf-1792408666276-424c	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792408627298-be31	/workspace/purchasing	/workspace/purchasing	2026-10-19 14:17:46.276+03	usr-manager	\N	PENDING	\N	2026-10-19 14:17:46.276+03
ntf-1792116544532-0512	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792116541225-e2ff	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:09:04.532+03	usr-manager	\N	PENDING	\N	2026-10-16 05:09:04.532+03
ntf-1792116544532-6a42	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792116541225-e2ff	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:09:04.532+03	usr-manager	\N	PENDING	\N	2026-10-16 05:09:04.532+03
ntf-1792408666276-42c7	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792408627298-be31	/workspace/purchasing	/workspace/purchasing	2026-10-19 14:17:46.276+03	usr-manager	\N	PENDING	\N	2026-10-19 14:17:46.276+03
ntf-1792155709679-575d	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792155706790-7b39	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:01:49.679+03	usr-manager	\N	PENDING	\N	2026-10-16 16:01:49.679+03
ntf-1792155709679-40f1	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792155706790-7b39	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:01:49.679+03	usr-manager	\N	PENDING	\N	2026-10-16 16:01:49.679+03
ntf-1792155709678-539a	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792155706790-7b39	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:01:49.678+03	usr-manager	\N	PENDING	\N	2026-10-16 16:01:49.678+03
ntf-1792022259961-4966	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-28	/workspace/purchasing	/workspace/purchasing	2026-10-15 02:57:39.961+03	usr-manager	\N	PENDING	\N	2026-10-15 02:57:39.961+03
ntf-1792114227026-9db0	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792114226247-fb21	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:30:27.026+03	usr-manager	\N	PENDING	\N	2026-10-16 04:30:27.026+03
ntf-1792114227027-289e	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792114226247-fb21	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:30:27.027+03	usr-manager	\N	PENDING	\N	2026-10-16 04:30:27.027+03
ntf-1792116544532-cf89	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792116541225-e2ff	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:09:04.532+03	usr-manager	\N	PENDING	\N	2026-10-16 05:09:04.532+03
ntf-1792344663327-5301	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-27	/workspace/purchasing	/workspace/purchasing	2026-10-18 20:31:03.327+03	usr-manager	\N	PENDING	\N	2026-10-18 20:31:03.327+03
ntf-1792055792621-5c8e	LowStockAlert	Low stock alert	Stock alert: an ingredient is below its reorder level.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 12:16:32.621+03	usr-manager	\N	PENDING	\N	2026-10-15 12:16:32.621+03
ntf-1792055792621-ef9e	LowStockAlert	Low stock alert	An ingredient has fallen to or below its reorder level. Review stock and raise a purchase requirement.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 12:16:32.621+03	usr-manager	\N	PENDING	\N	2026-10-15 12:16:32.621+03
ntf-1792116544532-d2f0	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792116541225-e2ff	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:09:04.532+03	usr-manager	\N	PENDING	\N	2026-10-16 05:09:04.532+03
ntf-1792158449335-8558	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792158446360-e508	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:47:29.335+03	usr-manager	\N	PENDING	\N	2026-10-16 16:47:29.335+03
ntf-1792048965553-6028	LowStockAlert	Low stock alert	An ingredient has fallen to or below its reorder level. Review inventory and raise a purchase requirement.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 10:22:45.553+03	usr-manager	\N	PENDING	\N	2026-10-15 10:22:45.553+03
ntf-1792048965553-6517	LowStockAlert	Low stock alert	Stock alert: an ingredient is below its reorder level.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 10:22:45.553+03	usr-manager	\N	PENDING	\N	2026-10-15 10:22:45.553+03
ntf-1792116160148-28a3	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792116159141-6dcb	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:02:40.148+03	usr-manager	\N	PENDING	\N	2026-10-16 05:02:40.148+03
ntf-1792408666277-6601	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792408627298-be31	/workspace/purchasing	/workspace/purchasing	2026-10-19 14:17:46.277+03	usr-manager	\N	PENDING	\N	2026-10-19 14:17:46.277+03
ntf-1792158449335-6039	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792158446360-e508	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:47:29.335+03	usr-manager	\N	PENDING	\N	2026-10-16 16:47:29.335+03
ntf-1792155709678-54da	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792155706790-7b39	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:01:49.678+03	usr-manager	\N	PENDING	\N	2026-10-16 16:01:49.678+03
ntf-1792155709678-0542	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792155706790-7b39	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:01:49.678+03	usr-manager	\N	PENDING	\N	2026-10-16 16:01:49.678+03
ntf-1792155709679-ea0e	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792155706790-7b39	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:01:49.679+03	usr-manager	\N	PENDING	\N	2026-10-16 16:01:49.679+03
ntf-1792155709679-ce1c	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792155706790-7b39	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:01:49.679+03	usr-manager	\N	PENDING	\N	2026-10-16 16:01:49.679+03
ntf-1792158449334-6787	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792158446360-e508	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:47:29.334+03	usr-manager	\N	PENDING	\N	2026-10-16 16:47:29.334+03
ntf-1792116160148-8309	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792116159141-6dcb	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:02:40.148+03	usr-manager	\N	PENDING	\N	2026-10-16 05:02:40.148+03
ntf-1792116160147-fb1a	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792116159141-6dcb	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:02:40.147+03	usr-manager	\N	PENDING	\N	2026-10-16 05:02:40.147+03
ntf-1792116160147-a603	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792116159141-6dcb	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:02:40.147+03	usr-manager	\N	PENDING	\N	2026-10-16 05:02:40.147+03
ntf-1792154726492-b58d	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792154723260-257c	/workspace/purchasing	/workspace/purchasing	2026-10-16 15:45:26.492+03	usr-manager	\N	PENDING	\N	2026-10-16 15:45:26.492+03
ntf-1792022259961-63ff	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-28	/workspace/purchasing	/workspace/purchasing	2026-10-15 02:57:39.961+03	usr-manager	\N	PENDING	\N	2026-10-15 02:57:39.961+03
ntf-1792022259962-7de8	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-28	/workspace/purchasing	/workspace/purchasing	2026-10-15 02:57:39.962+03	usr-manager	\N	PENDING	\N	2026-10-15 02:57:39.962+03
ntf-1792112941854-b536	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792112941148-b4d8	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:09:01.854+03	usr-manager	\N	PENDING	\N	2026-10-16 04:09:01.854+03
ntf-1792155709679-ce39	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792155706790-7b39	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:01:49.679+03	usr-manager	\N	PENDING	\N	2026-10-16 16:01:49.679+03
ntf-1792344663326-8c66	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-27	/workspace/purchasing	/workspace/purchasing	2026-10-18 20:31:03.326+03	usr-manager	\N	PENDING	\N	2026-10-18 20:31:03.326+03
ntf-1792154726491-2cf7	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792154723260-257c	/workspace/purchasing	/workspace/purchasing	2026-10-16 15:45:26.491+03	usr-manager	\N	PENDING	\N	2026-10-16 15:45:26.491+03
ntf-1792154726491-9e9e	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792154723260-257c	/workspace/purchasing	/workspace/purchasing	2026-10-16 15:45:26.491+03	usr-manager	\N	PENDING	\N	2026-10-16 15:45:26.491+03
ntf-1792154726491-919e	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792154723260-257c	/workspace/purchasing	/workspace/purchasing	2026-10-16 15:45:26.491+03	usr-manager	\N	PENDING	\N	2026-10-16 15:45:26.491+03
ntf-1792085344744-8a93	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792085344135-b36d	/workspace/purchasing	/workspace/purchasing	2026-10-15 20:29:04.744+03	usr-manager	\N	PENDING	\N	2026-10-15 20:29:04.744+03
ntf-1792116160147-66a2	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792116159141-6dcb	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:02:40.147+03	usr-manager	\N	PENDING	\N	2026-10-16 05:02:40.147+03
ntf-1792154726492-da29	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792154723260-257c	/workspace/purchasing	/workspace/purchasing	2026-10-16 15:45:26.492+03	usr-manager	\N	PENDING	\N	2026-10-16 15:45:26.492+03
ntf-1792154726491-b07f	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792154723260-257c	/workspace/purchasing	/workspace/purchasing	2026-10-16 15:45:26.491+03	usr-manager	\N	PENDING	\N	2026-10-16 15:45:26.491+03
ntf-1792344663327-8031	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-27	/workspace/purchasing	/workspace/purchasing	2026-10-18 20:31:03.327+03	usr-manager	\N	PENDING	\N	2026-10-18 20:31:03.327+03
ntf-1792344663327-8a63	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-27	/workspace/purchasing	/workspace/purchasing	2026-10-18 20:31:03.327+03	usr-manager	\N	PENDING	\N	2026-10-18 20:31:03.327+03
ntf-1792344663327-fa9e	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-27	/workspace/purchasing	/workspace/purchasing	2026-10-18 20:31:03.327+03	usr-manager	\N	PENDING	\N	2026-10-18 20:31:03.327+03
ntf-1792344663327-4173	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-27	/workspace/purchasing	/workspace/purchasing	2026-10-18 20:31:03.327+03	usr-manager	\N	PENDING	\N	2026-10-18 20:31:03.327+03
ntf-1792344663327-068e	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-27	/workspace/purchasing	/workspace/purchasing	2026-10-18 20:31:03.327+03	usr-manager	\N	PENDING	\N	2026-10-18 20:31:03.327+03
ntf-1792160612579-4fcd	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792160603594-43eb	/workspace/purchasing	/workspace/purchasing	2026-10-16 17:23:32.579+03	usr-manager	\N	PENDING	\N	2026-10-16 17:23:32.579+03
ntf-1792160612579-38a5	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792160603594-43eb	/workspace/purchasing	/workspace/purchasing	2026-10-16 17:23:32.579+03	usr-manager	\N	PENDING	\N	2026-10-16 17:23:32.579+03
ntf-1792344663326-61d9	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-27	/workspace/purchasing	/workspace/purchasing	2026-10-18 20:31:03.326+03	usr-manager	\N	PENDING	\N	2026-10-18 20:31:03.326+03
ntf-1792158449335-9d2b	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792158446360-e508	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:47:29.335+03	usr-manager	\N	PENDING	\N	2026-10-16 16:47:29.335+03
ntf-1792154726491-e4bd	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792154723260-257c	/workspace/purchasing	/workspace/purchasing	2026-10-16 15:45:26.491+03	usr-manager	\N	PENDING	\N	2026-10-16 15:45:26.491+03
ntf-1792422416564-331f	OrderConfirmed	Order confirmed	Your order {{orderNumber}} has been confirmed. Production will begin shortly.	MEDIUM	order	order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	2026-10-19 18:06:56.564+03	usr-manager	\N	PENDING	\N	2026-10-19 18:06:56.564+03
ntf-1792114227026-ed73	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792114226247-fb21	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:30:27.026+03	usr-manager	\N	PENDING	\N	2026-10-16 04:30:27.026+03
ntf-1792048965554-9253	LowStockAlert	Low stock alert	An ingredient has fallen to or below its reorder level. Review inventory and raise a purchase requirement.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 10:22:45.554+03	usr-manager	\N	PENDING	\N	2026-10-15 10:22:45.554+03
ntf-1792024833585-fcb0	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792024832723-f846	/workspace/purchasing	/workspace/purchasing	2026-10-15 03:40:33.585+03	usr-manager	\N	PENDING	\N	2026-10-15 03:40:33.585+03
ntf-1792085344744-1528	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792085344135-b36d	/workspace/purchasing	/workspace/purchasing	2026-10-15 20:29:04.744+03	usr-manager	\N	PENDING	\N	2026-10-15 20:29:04.744+03
ntf-1792112941854-f56b	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792112941148-b4d8	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:09:01.854+03	usr-manager	\N	PENDING	\N	2026-10-16 04:09:01.854+03
ntf-1792085344744-94a5	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792085344135-b36d	/workspace/purchasing	/workspace/purchasing	2026-10-15 20:29:04.744+03	usr-manager	\N	PENDING	\N	2026-10-15 20:29:04.744+03
ntf-1792085344744-aaf9	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792085344135-b36d	/workspace/purchasing	/workspace/purchasing	2026-10-15 20:29:04.744+03	usr-manager	\N	PENDING	\N	2026-10-15 20:29:04.744+03
ntf-1792085344744-db19	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792085344135-b36d	/workspace/purchasing	/workspace/purchasing	2026-10-15 20:29:04.744+03	usr-manager	\N	PENDING	\N	2026-10-15 20:29:04.744+03
ntf-1792085344744-2915	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792085344135-b36d	/workspace/purchasing	/workspace/purchasing	2026-10-15 20:29:04.744+03	usr-manager	\N	PENDING	\N	2026-10-15 20:29:04.744+03
ntf-1792112941854-5666	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792112941148-b4d8	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:09:01.854+03	usr-manager	\N	PENDING	\N	2026-10-16 04:09:01.854+03
ntf-1792112941854-2375	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792112941148-b4d8	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:09:01.854+03	usr-manager	\N	PENDING	\N	2026-10-16 04:09:01.854+03
ntf-1792114227025-8fbc	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792114226247-fb21	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:30:27.025+03	usr-manager	\N	PENDING	\N	2026-10-16 04:30:27.025+03
ntf-1792116160146-ae2c	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792116159141-6dcb	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:02:40.146+03	usr-manager	\N	PENDING	\N	2026-10-16 05:02:40.146+03
ntf-1792022259961-3984	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-28	/workspace/purchasing	/workspace/purchasing	2026-10-15 02:57:39.961+03	usr-manager	\N	PENDING	\N	2026-10-15 02:57:39.961+03
ntf-1792158449335-175f	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792158446360-e508	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:47:29.335+03	usr-manager	\N	PENDING	\N	2026-10-16 16:47:29.335+03
ntf-1792155709679-f53c	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792155706790-7b39	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:01:49.679+03	usr-manager	\N	PENDING	\N	2026-10-16 16:01:49.679+03
ntf-1792116160147-183d	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792116159141-6dcb	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:02:40.147+03	usr-manager	\N	PENDING	\N	2026-10-16 05:02:40.147+03
ntf-1792154726491-f66b	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792154723260-257c	/workspace/purchasing	/workspace/purchasing	2026-10-16 15:45:26.491+03	usr-manager	\N	PENDING	\N	2026-10-16 15:45:26.491+03
ntf-1792116544532-dd89	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792116541225-e2ff	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:09:04.532+03	usr-manager	\N	PENDING	\N	2026-10-16 05:09:04.532+03
ntf-1792116160147-99e1	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792116159141-6dcb	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:02:40.147+03	usr-manager	\N	PENDING	\N	2026-10-16 05:02:40.147+03
ntf-1792116160148-5fe3	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792116159141-6dcb	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:02:40.148+03	usr-manager	\N	PENDING	\N	2026-10-16 05:02:40.148+03
ntf-1792116160148-52a4	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792116159141-6dcb	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:02:40.148+03	usr-manager	\N	PENDING	\N	2026-10-16 05:02:40.148+03
ntf-1792085344744-5c66	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792085344135-b36d	/workspace/purchasing	/workspace/purchasing	2026-10-15 20:29:04.744+03	usr-manager	\N	PENDING	\N	2026-10-15 20:29:04.744+03
ntf-1792024833584-c7e0	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792024832723-f846	/workspace/purchasing	/workspace/purchasing	2026-10-15 03:40:33.584+03	usr-manager	\N	PENDING	\N	2026-10-15 03:40:33.584+03
ntf-1792024833584-dc4c	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792024832723-f846	/workspace/purchasing	/workspace/purchasing	2026-10-15 03:40:33.584+03	usr-manager	\N	PENDING	\N	2026-10-15 03:40:33.584+03
ntf-1792422416564-ee24	OrderConfirmed	Order confirmed	Order {{orderNumber}} has been confirmed by the proprietor.	MEDIUM	order	order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	2026-10-19 18:06:56.564+03	usr-manager	\N	PENDING	\N	2026-10-19 18:06:56.564+03
ntf-1792422416564-c11e	OrderConfirmed	Order confirmed	Your order {{orderNumber}} has been confirmed. Production will begin shortly.	MEDIUM	order	order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	2026-10-19 18:06:56.564+03	usr-manager	\N	PENDING	\N	2026-10-19 18:06:56.564+03
ntf-1792085344744-066e	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792085344135-b36d	/workspace/purchasing	/workspace/purchasing	2026-10-15 20:29:04.744+03	usr-manager	\N	PENDING	\N	2026-10-15 20:29:04.744+03
ntf-1792085344744-89b8	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792085344135-b36d	/workspace/purchasing	/workspace/purchasing	2026-10-15 20:29:04.744+03	usr-manager	\N	PENDING	\N	2026-10-15 20:29:04.744+03
ntf-1792024833584-8af5	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792024832723-f846	/workspace/purchasing	/workspace/purchasing	2026-10-15 03:40:33.584+03	usr-manager	\N	PENDING	\N	2026-10-15 03:40:33.584+03
ntf-1792024833584-09ef	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792024832723-f846	/workspace/purchasing	/workspace/purchasing	2026-10-15 03:40:33.584+03	usr-manager	\N	PENDING	\N	2026-10-15 03:40:33.584+03
ntf-1792160612579-fc95	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792160603594-43eb	/workspace/purchasing	/workspace/purchasing	2026-10-16 17:23:32.579+03	usr-manager	\N	PENDING	\N	2026-10-16 17:23:32.579+03
ntf-1792408666274-fb44	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792408627298-be31	/workspace/purchasing	/workspace/purchasing	2026-10-19 14:17:46.274+03	usr-manager	\N	PENDING	\N	2026-10-19 14:17:46.274+03
ntf-1792160612579-f9aa	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792160603594-43eb	/workspace/purchasing	/workspace/purchasing	2026-10-16 17:23:32.579+03	usr-manager	\N	PENDING	\N	2026-10-16 17:23:32.579+03
ntf-1792422416564-ebda	OrderConfirmed	Order confirmed	Your order {{orderNumber}} has been confirmed.	MEDIUM	order	order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	2026-10-19 18:06:56.564+03	usr-manager	\N	PENDING	\N	2026-10-19 18:06:56.564+03
ntf-1792422416564-d47f	OrderConfirmed	Order confirmed	Your order {{orderNumber}} has been confirmed. Production will begin shortly.	MEDIUM	order	order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	2026-10-19 18:06:56.564+03	usr-manager	\N	PENDING	\N	2026-10-19 18:06:56.564+03
ntf-1792158449335-0b36	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792158446360-e508	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:47:29.335+03	usr-manager	\N	PENDING	\N	2026-10-16 16:47:29.335+03
ntf-1792048965553-e423	LowStockAlert	Low stock alert	An ingredient is running low. Consider reordering soon.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 10:22:45.553+03	usr-manager	\N	PENDING	\N	2026-10-15 10:22:45.553+03
ntf-1792048965553-db08	LowStockAlert	Low stock alert	An ingredient has fallen to or below its reorder level. Review inventory and raise a purchase requirement.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 10:22:45.553+03	usr-manager	\N	PENDING	\N	2026-10-15 10:22:45.553+03
ntf-1792112941855-409c	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792112941148-b4d8	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:09:01.855+03	usr-manager	\N	PENDING	\N	2026-10-16 04:09:01.855+03
ntf-1792112941855-ce03	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792112941148-b4d8	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:09:01.855+03	usr-manager	\N	PENDING	\N	2026-10-16 04:09:01.855+03
ntf-1792408666277-d644	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792408627298-be31	/workspace/purchasing	/workspace/purchasing	2026-10-19 14:17:46.277+03	usr-manager	\N	PENDING	\N	2026-10-19 14:17:46.277+03
ntf-1792408666275-c5a8	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792408627298-be31	/workspace/purchasing	/workspace/purchasing	2026-10-19 14:17:46.275+03	usr-manager	\N	PENDING	\N	2026-10-19 14:17:46.275+03
ntf-1792408666275-f01a	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792408627298-be31	/workspace/purchasing	/workspace/purchasing	2026-10-19 14:17:46.275+03	usr-manager	\N	PENDING	\N	2026-10-19 14:17:46.275+03
ntf-1792344663327-a3a4	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-27	/workspace/purchasing	/workspace/purchasing	2026-10-18 20:31:03.327+03	usr-manager	\N	PENDING	\N	2026-10-18 20:31:03.327+03
ntf-1792344663326-ceb8	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-27	/workspace/purchasing	/workspace/purchasing	2026-10-18 20:31:03.326+03	usr-manager	\N	PENDING	\N	2026-10-18 20:31:03.326+03
ntf-1792160612579-7f8b	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792160603594-43eb	/workspace/purchasing	/workspace/purchasing	2026-10-16 17:23:32.579+03	usr-manager	\N	PENDING	\N	2026-10-16 17:23:32.579+03
ntf-1792408666277-8905	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792408627298-be31	/workspace/purchasing	/workspace/purchasing	2026-10-19 14:17:46.277+03	usr-manager	\N	PENDING	\N	2026-10-19 14:17:46.277+03
ntf-1792155709679-5e6f	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792155706790-7b39	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:01:49.679+03	usr-manager	\N	PENDING	\N	2026-10-16 16:01:49.679+03
ntf-1792022259961-7845	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-28	/workspace/purchasing	/workspace/purchasing	2026-10-15 02:57:39.961+03	usr-manager	\N	PENDING	\N	2026-10-15 02:57:39.961+03
ntf-1792154726491-2d18	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792154723260-257c	/workspace/purchasing	/workspace/purchasing	2026-10-16 15:45:26.491+03	usr-manager	\N	PENDING	\N	2026-10-16 15:45:26.491+03
ntf-1792112941854-3e1d	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792112941148-b4d8	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:09:01.854+03	usr-manager	\N	PENDING	\N	2026-10-16 04:09:01.854+03
ntf-1792055792621-96ed	LowStockAlert	Low stock alert	An ingredient is running low. Consider reordering soon.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 12:16:32.621+03	usr-manager	\N	PENDING	\N	2026-10-15 12:16:32.621+03
ntf-1792048965553-76c7	LowStockAlert	Low stock alert	An ingredient has fallen to or below its reorder level. Review stock and raise a purchase requirement.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 10:22:45.552+03	usr-manager	\N	PENDING	\N	2026-10-15 10:22:45.552+03
ntf-1792112941854-3b85	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792112941148-b4d8	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:09:01.854+03	usr-manager	\N	PENDING	\N	2026-10-16 04:09:01.854+03
ntf-1792158449335-6f79	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792158446360-e508	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:47:29.335+03	usr-manager	\N	PENDING	\N	2026-10-16 16:47:29.335+03
ntf-1792155709679-3ffd	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792155706790-7b39	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:01:49.679+03	usr-manager	\N	PENDING	\N	2026-10-16 16:01:49.679+03
ntf-1792155709679-fee4	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792155706790-7b39	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:01:49.679+03	usr-manager	\N	PENDING	\N	2026-10-16 16:01:49.679+03
ntf-1792155709679-f9f8	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792155706790-7b39	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:01:49.679+03	usr-manager	\N	PENDING	\N	2026-10-16 16:01:49.679+03
ntf-1792160612580-51ce	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792160603594-43eb	/workspace/purchasing	/workspace/purchasing	2026-10-16 17:23:32.58+03	usr-manager	\N	PENDING	\N	2026-10-16 17:23:32.58+03
ntf-1792024833585-9eda	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792024832723-f846	/workspace/purchasing	/workspace/purchasing	2026-10-15 03:40:33.585+03	usr-manager	\N	PENDING	\N	2026-10-15 03:40:33.585+03
ntf-1792113060426-1d34	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792113059659-bb6f	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:11:00.426+03	usr-manager	\N	PENDING	\N	2026-10-16 04:11:00.426+03
ntf-1792112941854-2a48	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792112941148-b4d8	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:09:01.854+03	usr-manager	\N	PENDING	\N	2026-10-16 04:09:01.854+03
ntf-1792422416564-f89b	OrderConfirmed	Order confirmed	A customer order has been confirmed and is ready for production.	MEDIUM	order	order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	2026-10-19 18:06:56.564+03	usr-manager	\N	PENDING	\N	2026-10-19 18:06:56.564+03
ntf-1792422416564-b4a9	OrderConfirmed	Order confirmed	Order {{orderNumber}} has been confirmed by the proprietor.	MEDIUM	order	order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	2026-10-19 18:06:56.564+03	usr-manager	\N	PENDING	\N	2026-10-19 18:06:56.564+03
ntf-1792408666278-1f47	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792408627298-be31	/workspace/purchasing	/workspace/purchasing	2026-10-19 14:17:46.278+03	usr-manager	\N	PENDING	\N	2026-10-19 14:17:46.278+03
ntf-1792408666278-e4ca	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792408627298-be31	/workspace/purchasing	/workspace/purchasing	2026-10-19 14:17:46.278+03	usr-manager	\N	PENDING	\N	2026-10-19 14:17:46.278+03
ntf-1792408666278-3d3e	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792408627298-be31	/workspace/purchasing	/workspace/purchasing	2026-10-19 14:17:46.278+03	usr-manager	\N	PENDING	\N	2026-10-19 14:17:46.278+03
ntf-1792408666278-5f7a	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792408627298-be31	/workspace/purchasing	/workspace/purchasing	2026-10-19 14:17:46.278+03	usr-manager	\N	PENDING	\N	2026-10-19 14:17:46.278+03
ntf-1792160612580-e997	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792160603594-43eb	/workspace/purchasing	/workspace/purchasing	2026-10-16 17:23:32.58+03	usr-manager	\N	PENDING	\N	2026-10-16 17:23:32.58+03
ntf-1792112941854-2e05	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792112941148-b4d8	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:09:01.854+03	usr-manager	\N	PENDING	\N	2026-10-16 04:09:01.854+03
ntf-1792112941854-e73b	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792112941148-b4d8	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:09:01.854+03	usr-manager	\N	PENDING	\N	2026-10-16 04:09:01.854+03
ntf-1792085344744-43f5	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792085344135-b36d	/workspace/purchasing	/workspace/purchasing	2026-10-15 20:29:04.744+03	usr-manager	\N	PENDING	\N	2026-10-15 20:29:04.744+03
ntf-1792116160146-db29	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792116159141-6dcb	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:02:40.146+03	usr-manager	\N	PENDING	\N	2026-10-16 05:02:40.146+03
ntf-1792085344744-fd26	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792085344135-b36d	/workspace/purchasing	/workspace/purchasing	2026-10-15 20:29:04.744+03	usr-manager	\N	PENDING	\N	2026-10-15 20:29:04.744+03
ntf-1792158449334-4805	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792158446360-e508	/workspace/purchasing	/workspace/purchasing	2026-10-16 16:47:29.334+03	usr-manager	\N	PENDING	\N	2026-10-16 16:47:29.334+03
ntf-1792085344744-0ef8	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792085344135-b36d	/workspace/purchasing	/workspace/purchasing	2026-10-15 20:29:04.744+03	usr-manager	\N	PENDING	\N	2026-10-15 20:29:04.744+03
ntf-1792055792621-4d93	LowStockAlert	Low stock alert	Stock alert: an ingredient is below its reorder level.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 12:16:32.621+03	usr-manager	\N	PENDING	\N	2026-10-15 12:16:32.621+03
ntf-1792024833584-a678	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792024832723-f846	/workspace/purchasing	/workspace/purchasing	2026-10-15 03:40:33.584+03	usr-manager	\N	PENDING	\N	2026-10-15 03:40:33.584+03
ntf-1792154726491-7f6f	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792154723260-257c	/workspace/purchasing	/workspace/purchasing	2026-10-16 15:45:26.491+03	usr-manager	\N	PENDING	\N	2026-10-16 15:45:26.491+03
ntf-1792422416563-249d	OrderConfirmed	Order confirmed	A customer order has been confirmed and is ready for production.	MEDIUM	order	order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	2026-10-19 18:06:56.563+03	usr-manager	\N	PENDING	\N	2026-10-19 18:06:56.563+03
ntf-1792422416563-3475	OrderConfirmed	Order confirmed	Order {{orderNumber}} has been confirmed by the proprietor.	MEDIUM	order	order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	2026-10-19 18:06:56.563+03	usr-manager	\N	PENDING	\N	2026-10-19 18:06:56.563+03
ntf-1792422416564-87bb	OrderConfirmed	Order confirmed	Your order {{orderNumber}} has been confirmed. Production will begin shortly.	MEDIUM	order	order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	2026-10-19 18:06:56.564+03	usr-manager	\N	PENDING	\N	2026-10-19 18:06:56.564+03
ntf-1792422416564-61cb	OrderConfirmed	Order confirmed	Your order {{orderNumber}} has been confirmed.	MEDIUM	order	order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	2026-10-19 18:06:56.564+03	usr-manager	\N	PENDING	\N	2026-10-19 18:06:56.564+03
ntf-1792024833585-7e3b	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792024832723-f846	/workspace/purchasing	/workspace/purchasing	2026-10-15 03:40:33.585+03	usr-manager	\N	PENDING	\N	2026-10-15 03:40:33.585+03
ntf-1792024833585-2524	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792024832723-f846	/workspace/purchasing	/workspace/purchasing	2026-10-15 03:40:33.585+03	usr-manager	\N	PENDING	\N	2026-10-15 03:40:33.585+03
ntf-1792114227026-bd1f	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792114226247-fb21	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:30:27.026+03	usr-manager	\N	PENDING	\N	2026-10-16 04:30:27.026+03
ntf-1792344663327-7d06	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-27	/workspace/purchasing	/workspace/purchasing	2026-10-18 20:31:03.327+03	usr-manager	\N	PENDING	\N	2026-10-18 20:31:03.327+03
ntf-1792422416564-0789	OrderConfirmed	Order confirmed	A customer order has been confirmed and is ready for production.	MEDIUM	order	order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	2026-10-19 18:06:56.564+03	usr-manager	\N	PENDING	\N	2026-10-19 18:06:56.564+03
ntf-1792422416564-0556	OrderConfirmed	Order confirmed	Your order {{orderNumber}} has been confirmed.	MEDIUM	order	order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	2026-10-19 18:06:56.564+03	usr-manager	\N	PENDING	\N	2026-10-19 18:06:56.564+03
ntf-1792422416564-b406	OrderConfirmed	Order confirmed	A customer order has been confirmed and is ready for production.	MEDIUM	order	order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	2026-10-19 18:06:56.564+03	usr-manager	\N	PENDING	\N	2026-10-19 18:06:56.564+03
ntf-1792422416564-e76f	OrderConfirmed	Order confirmed	Order {{orderNumber}} has been confirmed by the proprietor.	MEDIUM	order	order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	2026-10-19 18:06:56.564+03	usr-manager	\N	PENDING	\N	2026-10-19 18:06:56.564+03
ntf-1792422416564-389f	OrderConfirmed	Order confirmed	Your order {{orderNumber}} has been confirmed.	MEDIUM	order	order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	/workspace/order-1792343376364-b7cc	2026-10-19 18:06:56.564+03	usr-manager	\N	PENDING	\N	2026-10-19 18:06:56.564+03
ntf-1792024833584-8c2d	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792024832723-f846	/workspace/purchasing	/workspace/purchasing	2026-10-15 03:40:33.584+03	usr-manager	\N	PENDING	\N	2026-10-15 03:40:33.584+03
ntf-1792024833585-6c21	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792024832723-f846	/workspace/purchasing	/workspace/purchasing	2026-10-15 03:40:33.585+03	usr-manager	\N	PENDING	\N	2026-10-15 03:40:33.585+03
ntf-1792024833585-17a1	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792024832723-f846	/workspace/purchasing	/workspace/purchasing	2026-10-15 03:40:33.585+03	usr-manager	\N	PENDING	\N	2026-10-15 03:40:33.585+03
ntf-1792024833585-7c2a	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792024832723-f846	/workspace/purchasing	/workspace/purchasing	2026-10-15 03:40:33.585+03	usr-manager	\N	PENDING	\N	2026-10-15 03:40:33.585+03
ntf-1792024833585-b3d6	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792024832723-f846	/workspace/purchasing	/workspace/purchasing	2026-10-15 03:40:33.585+03	usr-manager	\N	PENDING	\N	2026-10-15 03:40:33.585+03
ntf-1792024833585-d08a	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792024832723-f846	/workspace/purchasing	/workspace/purchasing	2026-10-15 03:40:33.585+03	usr-manager	\N	PENDING	\N	2026-10-15 03:40:33.585+03
ntf-1792116544531-cbf8	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792116541225-e2ff	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:09:04.531+03	usr-manager	\N	PENDING	\N	2026-10-16 05:09:04.531+03
ntf-1792116544531-cbe7	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792116541225-e2ff	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:09:04.531+03	usr-manager	\N	PENDING	\N	2026-10-16 05:09:04.531+03
ntf-1792114227026-cb8e	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792114226247-fb21	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:30:27.026+03	usr-manager	\N	PENDING	\N	2026-10-16 04:30:27.026+03
ntf-1792114227026-23cc	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792114226247-fb21	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:30:27.026+03	usr-manager	\N	PENDING	\N	2026-10-16 04:30:27.026+03
ntf-1792114227026-cce6	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792114226247-fb21	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:30:27.026+03	usr-manager	\N	PENDING	\N	2026-10-16 04:30:27.026+03
ntf-1792114227026-f53e	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792114226247-fb21	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:30:27.026+03	usr-manager	\N	PENDING	\N	2026-10-16 04:30:27.026+03
ntf-1792048965553-cdbb	LowStockAlert	Low stock alert	Stock alert: an ingredient is below its reorder level.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 10:22:45.553+03	usr-manager	\N	PENDING	\N	2026-10-15 10:22:45.553+03
ntf-1792048965553-4edc	LowStockAlert	Low stock alert	An ingredient has fallen to or below its reorder level. Review stock and raise a purchase requirement.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 10:22:45.553+03	usr-manager	\N	PENDING	\N	2026-10-15 10:22:45.553+03
ntf-1792500047585-284f	InquiryCreated	New inquiry	A new customer inquiry requires attention from the Customer Support team.	MEDIUM	inquiry	inq-1792500047584-8907	/crm?inquiry=inq-1792500047584-8907	\N	2026-10-20 15:40:47.585+03	\N	\N	PENDING	\N	2026-10-20 15:40:47.585+03
ntf-1792500047585-8097	InquiryCreated	New inquiry	New customer inquiry received. Please respond.	MEDIUM	inquiry	inq-1792500047584-8907	/crm?inquiry=inq-1792500047584-8907	\N	2026-10-20 15:40:47.585+03	\N	\N	PENDING	\N	2026-10-20 15:40:47.585+03
ntf-1792500039391-919a	InquiryCreated	New inquiry	A new customer inquiry requires attention from the Customer Support team.	MEDIUM	inquiry	inq-1792500039391-1c41	/crm?inquiry=inq-1792500039391-1c41	\N	2026-10-20 15:40:39.391+03	\N	\N	PENDING	\N	2026-10-20 15:40:39.391+03
ntf-1792500039391-c9bb	InquiryCreated	New inquiry	New customer inquiry received. Please respond.	MEDIUM	inquiry	inq-1792500039391-1c41	/crm?inquiry=inq-1792500039391-1c41	\N	2026-10-20 15:40:39.391+03	\N	\N	PENDING	\N	2026-10-20 15:40:39.391+03
ntf-1792500039391-0cd2	InquiryCreated	New inquiry	A new customer inquiry has been received.	MEDIUM	inquiry	inq-1792500039391-1c41	/crm?inquiry=inq-1792500039391-1c41	\N	2026-10-20 15:40:39.391+03	\N	\N	PENDING	\N	2026-10-20 15:40:39.391+03
ntf-1792500039392-9744	InquiryCreated	New inquiry	New inquiry received.	MEDIUM	inquiry	inq-1792500039391-1c41	/crm?inquiry=inq-1792500039391-1c41	\N	2026-10-20 15:40:39.392+03	\N	\N	PENDING	\N	2026-10-20 15:40:39.392+03
ntf-1792500039392-809d	InquiryCreated	New inquiry	A new customer inquiry requires attention from the Customer Support team.	MEDIUM	inquiry	inq-1792500039391-1c41	/crm?inquiry=inq-1792500039391-1c41	\N	2026-10-20 15:40:39.392+03	\N	\N	PENDING	\N	2026-10-20 15:40:39.392+03
ntf-1792500039392-c7b8	InquiryCreated	New inquiry	New customer inquiry received. Please respond.	MEDIUM	inquiry	inq-1792500039391-1c41	/crm?inquiry=inq-1792500039391-1c41	\N	2026-10-20 15:40:39.392+03	\N	\N	PENDING	\N	2026-10-20 15:40:39.392+03
ntf-1792500039392-f735	InquiryCreated	New inquiry	A new customer inquiry has been received.	MEDIUM	inquiry	inq-1792500039391-1c41	/crm?inquiry=inq-1792500039391-1c41	\N	2026-10-20 15:40:39.392+03	\N	\N	PENDING	\N	2026-10-20 15:40:39.392+03
ntf-1792500039392-2722	InquiryCreated	New inquiry	New inquiry received.	MEDIUM	inquiry	inq-1792500039391-1c41	/crm?inquiry=inq-1792500039391-1c41	\N	2026-10-20 15:40:39.392+03	\N	\N	PENDING	\N	2026-10-20 15:40:39.392+03
ntf-1792048965554-29e4	LowStockAlert	Low stock alert	Stock alert: an ingredient is below its reorder level.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 10:22:45.554+03	usr-manager	\N	PENDING	\N	2026-10-15 10:22:45.554+03
ntf-1792055792618-deff	LowStockAlert	Low stock alert	An ingredient has fallen to or below its reorder level. Review stock and raise a purchase requirement.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 12:16:32.617+03	usr-manager	\N	PENDING	\N	2026-10-15 12:16:32.617+03
ntf-1792055792618-0c82	LowStockAlert	Low stock alert	An ingredient is running low. Consider reordering soon.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 12:16:32.618+03	usr-manager	\N	PENDING	\N	2026-10-15 12:16:32.618+03
ntf-1792055792618-8a84	LowStockAlert	Low stock alert	An ingredient has fallen to or below its reorder level. Review inventory and raise a purchase requirement.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 12:16:32.618+03	usr-manager	\N	PENDING	\N	2026-10-15 12:16:32.618+03
ntf-1792055792618-e091	LowStockAlert	Low stock alert	Stock alert: an ingredient is below its reorder level.	HIGH	inventory_item	inv-cream	/workspace/inventory	/workspace/inventory	2026-10-15 12:16:32.618+03	usr-manager	\N	PENDING	\N	2026-10-15 12:16:32.618+03
ntf-1792022259961-0ac6	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-28	/workspace/purchasing	/workspace/purchasing	2026-10-15 02:57:39.961+03	usr-manager	\N	PENDING	\N	2026-10-15 02:57:39.961+03
ntf-1792113060426-beba	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792113059659-bb6f	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:11:00.426+03	usr-manager	\N	PENDING	\N	2026-10-16 04:11:00.426+03
ntf-1792113060426-8ff9	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792113059659-bb6f	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:11:00.426+03	usr-manager	\N	PENDING	\N	2026-10-16 04:11:00.426+03
ntf-1792113060426-11fb	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792113059659-bb6f	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:11:00.426+03	usr-manager	\N	PENDING	\N	2026-10-16 04:11:00.426+03
ntf-1792113060426-5dba	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792113059659-bb6f	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:11:00.426+03	usr-manager	\N	PENDING	\N	2026-10-16 04:11:00.426+03
ntf-1792113060426-1b59	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792113059659-bb6f	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:11:00.426+03	usr-manager	\N	PENDING	\N	2026-10-16 04:11:00.426+03
ntf-1792113060427-8223	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792113059659-bb6f	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:11:00.427+03	usr-manager	\N	PENDING	\N	2026-10-16 04:11:00.427+03
ntf-1792022259962-a937	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-28	/workspace/purchasing	/workspace/purchasing	2026-10-15 02:57:39.962+03	usr-manager	\N	PENDING	\N	2026-10-15 02:57:39.962+03
ntf-1792022259962-6723	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-28	/workspace/purchasing	/workspace/purchasing	2026-10-15 02:57:39.962+03	usr-manager	\N	PENDING	\N	2026-10-15 02:57:39.962+03
ntf-1792022259962-de93	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-28	/workspace/purchasing	/workspace/purchasing	2026-10-15 02:57:39.962+03	usr-manager	\N	PENDING	\N	2026-10-15 02:57:39.962+03
ntf-1792022259962-465b	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-28	/workspace/purchasing	/workspace/purchasing	2026-10-15 02:57:39.962+03	usr-manager	\N	PENDING	\N	2026-10-15 02:57:39.962+03
ntf-1792022259962-8ac5	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-28	/workspace/purchasing	/workspace/purchasing	2026-10-15 02:57:39.962+03	usr-manager	\N	PENDING	\N	2026-10-15 02:57:39.962+03
ntf-1792116544532-f509	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792116541225-e2ff	/workspace/purchasing	/workspace/purchasing	2026-10-16 05:09:04.532+03	usr-manager	\N	PENDING	\N	2026-10-16 05:09:04.532+03
ntf-1792113060427-35e9	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792113059659-bb6f	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:11:00.427+03	usr-manager	\N	PENDING	\N	2026-10-16 04:11:00.427+03
ntf-1792113060427-9b60	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792113059659-bb6f	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:11:00.427+03	usr-manager	\N	PENDING	\N	2026-10-16 04:11:00.427+03
ntf-1792113060426-ef2b	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792113059659-bb6f	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:11:00.426+03	usr-manager	\N	PENDING	\N	2026-10-16 04:11:00.426+03
ntf-1792113060426-1f5d	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792113059659-bb6f	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:11:00.426+03	usr-manager	\N	PENDING	\N	2026-10-16 04:11:00.426+03
ntf-1792113060427-c33a	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792113059659-bb6f	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:11:00.427+03	usr-manager	\N	PENDING	\N	2026-10-16 04:11:00.427+03
ntf-1792114227026-e607	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792114226247-fb21	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:30:27.026+03	usr-manager	\N	PENDING	\N	2026-10-16 04:30:27.026+03
ntf-1792114227026-1977	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792114226247-fb21	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:30:27.026+03	usr-manager	\N	PENDING	\N	2026-10-16 04:30:27.026+03
ntf-1792114227026-0f56	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792114226247-fb21	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:30:27.026+03	usr-manager	\N	PENDING	\N	2026-10-16 04:30:27.026+03
ntf-1792114227026-30e7	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792114226247-fb21	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:30:27.026+03	usr-manager	\N	PENDING	\N	2026-10-16 04:30:27.026+03
ntf-1792113060427-55ca	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792113059659-bb6f	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:11:00.427+03	usr-manager	\N	PENDING	\N	2026-10-16 04:11:00.427+03
ntf-1792113060427-3e49	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792113059659-bb6f	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:11:00.427+03	usr-manager	\N	PENDING	\N	2026-10-16 04:11:00.427+03
ntf-1792113060427-0a6f	GoodsReceived	Goods received	Goods received.	MEDIUM	purchasing	po-1792113059659-bb6f	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:11:00.427+03	usr-manager	\N	PENDING	\N	2026-10-16 04:11:00.427+03
ntf-1792114227026-1307	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792114226247-fb21	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:30:27.026+03	usr-manager	\N	PENDING	\N	2026-10-16 04:30:27.026+03
ntf-1792114227026-170e	GoodsReceived	Goods received	Goods received. Inventory updated.	MEDIUM	purchasing	po-1792114226247-fb21	/workspace/purchasing	/workspace/purchasing	2026-10-16 04:30:27.026+03	usr-manager	\N	PENDING	\N	2026-10-16 04:30:27.026+03
ntf-1792160612578-d7d6	GoodsReceived	Goods received	Stock has been received against a purchase order.	MEDIUM	purchasing	po-1792160603594-43eb	/workspace/purchasing	/workspace/purchasing	2026-10-16 17:23:32.578+03	usr-manager	\N	PENDING	\N	2026-10-16 17:23:32.578+03
ntf-1792160612578-7e5e	GoodsReceived	Goods received	Goods received and stock updated.	MEDIUM	purchasing	po-1792160603594-43eb	/workspace/purchasing	/workspace/purchasing	2026-10-16 17:23:32.578+03	usr-manager	\N	PENDING	\N	2026-10-16 17:23:32.578+03
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
osnap-1792536910154-b53a	order-1792536910153-aea8	cust-1792500970361-00a2	Website Preview	0700555444	preview@test.ug		phone	Website Preview	2026-10-21 01:55:10.154+03	2026-10-21 01:55:10.154+03
osnap-1792566807382-5ab1	order-1792566807381-f411	cust-1792566804961-9a4c	reeed	+256 789 809 803			email	reeed	2026-10-21 10:13:27.382+03	2026-10-21 10:13:27.382+03
osnap-1792604176408-0688	order-1792604176406-1717	cust-1792604172989-7ce4	Prech	+256 768 453 666			email	Prech	2026-10-21 20:36:16.408+03	2026-10-21 20:36:16.408+03
osnap-1792731802820-b347	order-1792731802810-3280	cust-1792169285052-2054	Ssentema Daniel				email	Ssentema Daniel	2026-10-23 08:03:22.818+03	2026-10-23 08:03:22.818+03
osnap-1792421475420-7367	order-1792421475419-e072	cust-1792169285052-2054	Ssentema Daniel				email	Ssentema Daniel	2026-10-19 17:51:15.42+03	2026-10-19 17:51:15.42+03
osnap-1792426276127-d54f	order-1792426276122-85cf	cust-grace	Grace Wanjiku	+256 700 000 013	grace@example.com	Plot 12 Kampala Road, Kampala, Uganda	phone	Grace Wanjiku	2026-10-19 19:11:16.127+03	2026-10-19 19:11:16.127+03
osnap-1792427929087-fc16	order-1792427929087-5e19	cust-1792427927005-88bf	peterr	0900000			email	peterr	2026-10-19 19:38:49.087+03	2026-10-19 19:38:49.087+03
osnap-1792428058649-49dd	order-1792428058648-07b6	cust-1792427927005-88bf	peterr	0900000			email	peterr	2026-10-19 19:40:58.649+03	2026-10-19 19:40:58.649+03
osnap-1792169288276-1290	order-1792169288274-eaad	cust-1792169285052-2054	Ssentema Daniel				email	Ssentema Daniel	2026-10-16 19:48:08.276+03	2026-10-16 19:48:08.276+03
osnap-1792337911741-00b5	order-1792337911741-b8e8	cust-1792337909894-2a09	Sarah Wahinya	0788443234			email	Sarah Wahinya	2026-10-18 18:38:31.741+03	2026-10-18 18:38:31.741+03
osnap-1792343376366-9b2b	order-1792343376364-b7cc	cust-faith	Faith Akinyi	+256 700 000 015	faith@example.com	Plot 12 Kampala Road, Kampala, Uganda	phone	Faith Akinyi	2026-10-18 20:09:36.366+03	2026-10-18 20:09:36.366+03
osnap-1792346351946-90f0	order-1792346351945-1159	cust-james	James Kamau	+256 700 000 014	james@example.com	Plot 12 Kampala Road, Kampala, Uganda	phone	James Kamau	2026-10-18 20:59:11.946+03	2026-10-18 20:59:11.946+03
\.


--
-- Data for Name: order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.order_items (id, order_id, product_id, variant_options, quantity, unit_price, discount, total, recipe_version, created_at, updated_at) FROM stdin;
oi-1792536910153-5b14	order-1792536910153-aea8	prod-red	2Kg, Blue, Time tier	1.000	200000.00	0.00	0.00	\N	2026-10-21 01:55:10.153+03	2026-10-21 01:55:10.153+03
oi-1792604176406-1997	order-1792604176406-1717	prod-vanilla	1kg, Red Forest, Mixture	1.000	90000.00	0.00	0.00	\N	2026-10-21 20:36:16.406+03	2026-10-21 20:36:16.406+03
oi-ord-1044	ord-1044	prod-carrot	1 kg · Cream cheese frosting	1.000	3200.00	0.00	3200.00	v1.2	2026-10-08 19:28:15.797+03	2026-10-08 19:28:15.797+03
oi-1792169288275-ca30	order-1792169288274-eaad	prod-carrot	2Kg, Blue, Time tier	1.000	67000.00	0.00	0.00	\N	2026-10-16 19:48:08.274+03	2026-10-16 19:48:08.274+03
oi-1792337911741-9564	order-1792337911741-b8e8	prod-red	2Kg, Blue, Time tier	1.000	80000.00	0.00	0.00	\N	2026-10-18 18:38:31.741+03	2026-10-18 18:38:31.741+03
oi-1792343376364-f54d	order-1792343376364-b7cc	prod-vanilla	2Kg, Blue, Time tier	1.000	70000.00	0.00	0.00	\N	2026-10-18 20:09:36.364+03	2026-10-18 20:09:36.364+03
oi-1792346351946-6447	order-1792346351945-1159	prod-red	2Kg, Blue, Time tier	1.000	60000.00	0.00	0.00	\N	2026-10-18 20:59:11.945+03	2026-10-18 20:59:11.945+03
oi-1792421475419-c87e	order-1792421475419-e072	prod-wedding	2Kg, Blue, Time tier	1.000	90000.00	0.00	0.00	\N	2026-10-19 17:51:15.419+03	2026-10-19 17:51:15.419+03
oi-1792426276123-fe6b	order-1792426276122-85cf	prod-carrot	1kg, Red Forest, Mixture	1.000	90000.00	0.00	0.00	\N	2026-10-19 19:11:16.123+03	2026-10-19 19:11:16.123+03
oi-1792566807382-4c28	order-1792566807381-f411	prod-vanilla	1kg, Red Forest, Mixture	1.000	79000.00	0.00	0.00	\N	2026-10-21 10:13:27.381+03	2026-10-21 10:13:27.381+03
oi-1792427929087-4e6f	order-1792427929087-5e19	prod-vanilla	1kg, Red Forest, Mixture	1.000	90000.00	0.00	0.00	\N	2026-10-19 19:38:49.087+03	2026-10-19 19:38:49.087+03
oi-1792428058648-63dc	order-1792428058648-07b6	prod-choc	1kg, Red Forest, Mixture	1.000	70000.00	0.00	0.00	\N	2026-10-19 19:40:58.648+03	2026-10-19 19:40:58.648+03
oi-ord-1043	ord-1043	prod-choccup	12 pieces · Chocolate	1.000	1800.00	0.00	1800.00	v1.2	2026-10-08 19:28:15.802+03	2026-10-08 19:28:15.802+03
oi-1792731802810-bf7d	order-1792731802810-3280	prod-red	1kg, Red Forest, Mixture	1.000	70000.00	0.00	0.00	\N	2026-10-23 08:03:22.81+03	2026-10-23 08:03:22.81+03
oi-ord-1048	ord-1048	prod-choc	2 kg · Chocolate · Birthday	1.000	4500.00	0.00	4500.00	v1.2	2026-10-08 19:28:15.755+03	2026-10-08 19:28:15.755+03
oi-ord-1047	ord-1047	prod-red	1.5 kg · Red velvet · Anniversary	1.000	3800.00	0.00	3800.00	v1.2	2026-10-08 19:28:15.78+03	2026-10-08 19:28:15.78+03
oi-ord-1046	ord-1046	prod-vanilla	24 pieces · Vanilla · Corporate	1.000	2400.00	0.00	2400.00	v1.2	2026-10-08 19:28:15.785+03	2026-10-08 19:28:15.785+03
oi-ord-1045	ord-1045	prod-wedding	3 tiers · Vanilla & lemon	1.000	18000.00	0.00	18000.00	v1.2	2026-10-08 19:28:15.79+03	2026-10-08 19:28:15.79+03
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
osh-ord-1045	ord-1045	INQUIRY	IN_PRODUCTION	usr-manager	Seeded order	2026-10-08 19:28:15.791+03	2026-10-08 19:28:15.791+03	2026-10-08 19:28:15.791+03
osh-1792346351946-4102	order-1792346351945-1159	INQUIRY	AWAITING_CONFIRMATION			2026-10-18 20:59:11.945+03	2026-10-18 20:59:11.945+03	2026-10-18 20:59:11.945+03
osh-ord-1044	ord-1044	INQUIRY	AWAITING_CONFIRMATION	usr-manager	Seeded order	2026-10-08 19:28:15.798+03	2026-10-08 19:28:15.798+03	2026-10-08 19:28:15.798+03
osh-ord-1043	ord-1043	INQUIRY	COMPLETED_DELIVERED	usr-manager	Seeded order	2026-10-08 19:28:15.803+03	2026-10-08 19:28:15.803+03	2026-10-08 19:28:15.803+03
osh-ord-1048	ord-1048	INQUIRY	CONFIRMED	usr-manager	Seeded order	2026-10-08 19:28:15.759+03	2026-10-08 19:28:15.759+03	2026-10-08 19:28:15.759+03
osh-1792428493356-81cf	order-1792346351945-1159	QUALITY_CHECK	READY_FOR_DELIVERY	usr-manager	Quality check passed for job job-1792401135646-9963 — order ready for delivery	2026-10-19 19:48:13.356+03	2026-10-19 19:48:13.356+03	2026-10-19 19:48:13.356+03
osh-ord-1047	ord-1047	INQUIRY	READY_FOR_DELIVERY	usr-manager	Seeded order	2026-10-08 19:28:15.781+03	2026-10-08 19:28:15.781+03	2026-10-08 19:28:15.781+03
osh-1792421475419-1d19	order-1792421475419-e072	INQUIRY	AWAITING_CONFIRMATION			2026-10-19 17:51:15.419+03	2026-10-19 17:51:15.419+03	2026-10-19 17:51:15.419+03
osh-1792604176407-a371	order-1792604176406-1717	INQUIRY	AWAITING_CONFIRMATION			2026-10-21 20:36:16.406+03	2026-10-21 20:36:16.406+03	2026-10-21 20:36:16.406+03
osh-1792731802813-39d1	order-1792731802810-3280	INQUIRY	AWAITING_CONFIRMATION			2026-10-23 08:03:22.81+03	2026-10-23 08:03:22.81+03	2026-10-23 08:03:22.81+03
osh-1792401117365-8838	order-1792346351945-1159	AWAITING_CONFIRMATION	CONFIRMED	usr-manager	Admin confirmed order	2026-10-19 12:11:57.365+03	2026-10-19 12:11:57.365+03	2026-10-19 12:11:57.365+03
osh-1792422416562-8a86	order-1792343376364-b7cc	AWAITING_CONFIRMATION	CONFIRMED	usr-manager	Admin confirmed order	2026-10-19 18:06:56.562+03	2026-10-19 18:06:56.562+03	2026-10-19 18:06:56.562+03
osh-1792426276124-0877	order-1792426276122-85cf	INQUIRY	AWAITING_CONFIRMATION			2026-10-19 19:11:16.123+03	2026-10-19 19:11:16.123+03	2026-10-19 19:11:16.123+03
osh-1792536910153-89e8	order-1792536910153-aea8	INQUIRY	AWAITING_CONFIRMATION			2026-10-21 01:55:10.153+03	2026-10-21 01:55:10.153+03	2026-10-21 01:55:10.153+03
osh-1792427929087-c8b2	order-1792427929087-5e19	INQUIRY	AWAITING_CONFIRMATION			2026-10-19 19:38:49.087+03	2026-10-19 19:38:49.087+03	2026-10-19 19:38:49.087+03
osh-ord-1046	ord-1046	INQUIRY	CONFIRMED	usr-manager	Seeded order	2026-10-08 19:28:15.786+03	2026-10-08 19:28:15.786+03	2026-10-08 19:28:15.786+03
osh-1792169288275-c7bc	order-1792169288274-eaad	INQUIRY	AWAITING_CONFIRMATION			2026-10-16 19:48:08.274+03	2026-10-16 19:48:08.274+03	2026-10-16 19:48:08.274+03
osh-1792428493356-00d7	order-1792346351945-1159	IN_PRODUCTION	QUALITY_CHECK	usr-manager	Production sync for job job-1792401135646-9963 (quality check passed)	2026-10-19 19:48:13.356+03	2026-10-19 19:48:13.356+03	2026-10-19 19:48:13.356+03
osh-1792337911741-9d81	order-1792337911741-b8e8	INQUIRY	AWAITING_CONFIRMATION			2026-10-18 18:38:31.741+03	2026-10-18 18:38:31.741+03	2026-10-18 18:38:31.741+03
osh-1792343376365-e686	order-1792343376364-b7cc	INQUIRY	AWAITING_CONFIRMATION			2026-10-18 20:09:36.364+03	2026-10-18 20:09:36.364+03	2026-10-18 20:09:36.364+03
osh-1792428058649-9780	order-1792428058648-07b6	INQUIRY	AWAITING_CONFIRMATION			2026-10-19 19:40:58.648+03	2026-10-19 19:40:58.648+03	2026-10-19 19:40:58.648+03
osh-1792566807382-7215	order-1792566807381-f411	INQUIRY	AWAITING_CONFIRMATION			2026-10-21 10:13:27.381+03	2026-10-21 10:13:27.381+03	2026-10-21 10:13:27.381+03
\.


--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.orders (id, order_number, customer_id, salesperson_id, subtotal, discount, delivery_charge, tax_amount, total, currency, required_by, required_at, notes, status, payment_status, delivery_status, quotation_id, inquiry_id, created_by, delivered_at, created_at, updated_at, follow_up_completed_at) FROM stdin;
order-1792169288274-eaad	TC-1049	cust-1792169285052-2054	\N	67000.00	0.00	0.00	0.00	67000.00	UGX	\N	2026-10-09 10:00:00+03	2Kg, Blue, Time tier · Internal	COMPLETED_DELIVERED	PAID	COMPLETED_DELIVERED	\N	\N		\N	2026-10-16 19:48:08.274+03	2026-10-19 14:18:35.046+03	\N
order-1792337911741-b8e8	TC-1050	cust-1792337909894-2a09	\N	80000.00	0.00	0.00	0.00	80000.00	UGX	\N	2026-10-08 10:00:00+03	2Kg, Blue, Time tier · Internal	IN_PRODUCTION	PARTIALLY_PAID	PENDING	\N	\N		\N	2026-10-18 18:38:31.741+03	2026-10-19 14:06:50.486+03	\N
order-1792343376364-b7cc	TC-1051	cust-faith	\N	70000.00	0.00	0.00	0.00	70000.00	UGX	\N	2026-10-20 10:00:00+03	2Kg, Blue, Time tier · Internal	READY_FOR_PRODUCTION	PARTIALLY_PAID	PENDING	\N	\N		\N	2026-10-18 20:09:36.364+03	2026-10-19 19:19:51.813+03	\N
order-1792346351945-1159	TC-1052	cust-james	\N	60000.00	0.00	0.00	0.00	60000.00	UGX	\N	2026-10-19 10:00:00+03	2Kg, Blue, Time tier · Internal	READY_FOR_DELIVERY	PARTIALLY_PAID	PENDING	\N	\N		\N	2026-10-18 20:59:11.945+03	2026-10-19 19:48:13.356+03	\N
order-1792426276122-85cf	TC-1054	cust-grace	\N	90000.00	0.00	0.00	0.00	90000.00	UGX	\N	2026-10-20 10:00:00+03	1kg, Red Forest, Mixture · Internal	READY_FOR_PRODUCTION	PAID	PENDING	\N	\N		\N	2026-10-19 19:11:16.123+03	2026-10-20 19:24:48.233+03	\N
order-1792428058648-07b6	TC-1055-2	cust-1792427927005-88bf	\N	70000.00	0.00	0.00	0.00	70000.00	UGX	\N	2026-10-23 10:00:00+03	1kg, Red Forest, Mixture · Internal	READY_FOR_PRODUCTION	PARTIALLY_PAID	PENDING	\N	\N		\N	2026-10-19 19:40:58.648+03	2026-10-23 03:49:12.836+03	\N
ord-1046	TC-1046	cust-grace	\N	2400.00	0.00	0.00	0.00	2400.00	UGX	\N	2026-10-07 13:00:00+03	24 pieces · Vanilla · Corporate · Phone	COMPLETED_DELIVERED	PAID	COMPLETED_DELIVERED	\N	\N	usr-manager	\N	2026-10-08 19:28:15.785+03	2026-10-18 21:07:06.172+03	\N
ord-1045	TC-1045	cust-james	\N	18000.00	0.00	0.00	0.00	18000.00	UGX	\N	2026-10-08 09:00:00+03	3 tiers · Vanilla & lemon · Walk-in	DELIVERED	PARTIALLY_PAID	PENDING	\N	\N	usr-manager	\N	2026-10-08 19:28:15.79+03	2026-10-18 03:45:35.281+03	\N
ord-1044	TC-1044	cust-faith	\N	3200.00	0.00	0.00	0.00	3200.00	UGX	\N	2026-10-08 14:00:00+03	1 kg · Cream cheese frosting · WhatsApp	DELIVERED	UNPAID	PENDING	\N	\N	usr-manager	\N	2026-10-08 19:28:15.796+03	2026-10-18 03:46:30.209+03	\N
order-1792427929087-5e19	TC-1055	cust-1792427927005-88bf	\N	90000.00	0.00	0.00	0.00	90000.00	UGX	\N	2026-10-20 10:00:00+03	1kg, Red Forest, Mixture · Internal	AWAITING_COLLECTION	PAID	COMPLETED_DELIVERED	\N	\N		\N	2026-10-19 19:38:49.087+03	2026-10-20 13:13:52.682+03	\N
order-1792731802810-3280	TC-1060	cust-1792169285052-2054	\N	70000.00	0.00	0.00	0.00	70000.00	UGX	\N	2026-10-24 10:00:00+03	1kg, Red Forest, Mixture · Internal	AWAITING_CONFIRMATION	PARTIALLY_PAID	PENDING	\N	\N		\N	2026-10-23 08:03:22.81+03	2026-10-23 08:03:22.81+03	\N
order-1792604176406-1717	TC-1059	cust-1792604172989-7ce4	\N	90000.00	0.00	0.00	0.00	90000.00	UGX	\N	2026-10-23 10:00:00+03	1kg, Red Forest, Mixture · Internal	AWAITING_CONFIRMATION	PARTIALLY_PAID	PENDING	\N	\N		\N	2026-10-21 20:36:16.406+03	2026-10-21 20:36:16.406+03	\N
order-1792421475419-e072	TC-1053	cust-1792169285052-2054	\N	90000.00	0.00	0.00	0.00	90000.00	UGX	\N	2026-10-21 10:00:00+03	2Kg, Blue, Time tier · Internal	READY_FOR_PRODUCTION	PARTIALLY_PAID	PENDING	\N	\N		\N	2026-10-19 17:51:15.419+03	2026-10-21 20:37:51.746+03	\N
order-1792536910153-aea8	TC-1057	cust-1792500970361-00a2	\N	200000.00	0.00	0.00	0.00	200000.00	UGX	\N	2026-10-23 10:00:00+03	2Kg, Blue, Time tier · Internal	AWAITING_CONFIRMATION	PARTIALLY_PAID	PENDING	\N	\N		\N	2026-10-21 01:55:10.153+03	2026-10-21 01:55:10.153+03	\N
ord-1048	TC-1048	cust-sarah	\N	4500.00	0.00	0.00	0.00	4500.00	UGX	\N	2026-10-07 10:00:00+03	2 kg · Chocolate · Birthday · WhatsApp	COMPLETED_DELIVERED	PARTIALLY_PAID	COMPLETED_DELIVERED	\N	\N	usr-manager	\N	2026-10-08 19:28:15.747+03	2026-10-19 07:45:04.536+03	\N
ord-1047	TC-1047	cust-david	\N	3800.00	0.00	0.00	0.00	3800.00	UGX	\N	2026-10-07 11:30:00+03	1.5 kg · Red velvet · Anniversary · Website	DELIVERED	PAID	READY_FOR_DISPATCH	\N	\N	usr-manager	\N	2026-10-08 19:28:15.779+03	2026-10-19 13:24:52.155+03	2026-10-19 13:24:52.131+03
ord-1043	TC-1043	cust-peter	\N	1800.00	0.00	0.00	0.00	1800.00	UGX	\N	2026-10-09 10:30:00+03	12 pieces · Chocolate · Website	DELIVERED	PAID	COMPLETED_DELIVERED	\N	\N	usr-manager	\N	2026-10-08 19:28:15.802+03	2026-10-18 03:46:24.211+03	\N
order-1792566807381-f411	TC-1058	cust-1792566804961-9a4c	\N	79000.00	0.00	0.00	0.00	79000.00	UGX	\N	2026-10-22 10:00:00+03	1kg, Red Forest, Mixture · Internal	AWAITING_CONFIRMATION	PARTIALLY_PAID	PENDING	\N	\N		\N	2026-10-21 10:13:27.381+03	2026-10-21 10:13:27.381+03	\N
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.payments (id, order_id, amount, method, date, reference, received_by, notes, created_at, updated_at) FROM stdin;
pay-ord-1045	ord-1045	9000.00	Cash	2026-07-23	TC-1045	usr-manager	Seed payment	2026-10-08 19:28:15.792+03	2026-10-08 19:28:15.792+03
pay-ord-1044	ord-1044	0.00	Cash	2026-07-23	TC-1044	usr-manager	Seed payment	2026-10-08 19:28:15.799+03	2026-10-08 19:28:15.799+03
pay-ord-1043	ord-1043	1800.00	Cash	2026-07-23	TC-1043	usr-manager	Seed payment	2026-10-08 19:28:15.804+03	2026-10-08 19:28:15.804+03
pay-ord-1048	ord-1048	2250.00	Cash	2026-07-23	TC-1048	usr-manager	Seed payment	2026-10-08 19:28:15.763+03	2026-10-08 19:28:15.763+03
pay-ord-1047	ord-1047	3800.00	Cash	2026-07-23	TC-1047	usr-manager	Seed payment	2026-10-08 19:28:15.782+03	2026-10-08 19:28:15.782+03
pay-1792420608721-9a56	order-1792346351945-1159	50000.00	Cash	2026-09-22		usr-manager		2026-10-19 17:36:48.721+03	2026-10-19 17:36:48.721+03
pay-1792604268223-d35a	order-1792421475419-e072	80000.00	Cash	2026-10-20		usr-manager		2026-10-21 20:37:48.223+03	2026-10-21 20:37:48.223+03
pay-1792384709341-4388	ord-1048	2000.00	Cash	2026-09-19		usr-manager		2026-10-19 07:38:29.341+03	2026-10-19 07:38:29.341+03
pay-1792385075786-f6bb	order-1792169288274-eaad	10000.00	Cash	2026-09-19		usr-manager		2026-10-19 07:44:35.786+03	2026-10-19 07:44:35.786+03
pay-1792482877125-3ad9	order-1792426276122-85cf	70000.00	Cash	2026-10-04		usr-manager		2026-10-20 10:54:37.125+03	2026-10-20 10:54:37.125+03
pay-1792490985249-a78d	order-1792426276122-85cf	30000.00	Cash	2026-10-04		usr-manager		2026-10-20 13:09:45.249+03	2026-10-20 13:09:45.249+03
pay-1792491205268-885a	order-1792427929087-5e19	90000.00	Cash	2026-10-04		usr-manager		2026-10-20 13:13:25.268+03	2026-10-20 13:13:25.268+03
pay-1792405511416-8ef8	order-1792169288274-eaad	27000.00	Cash	2026-09-21		usr-manager		2026-10-19 13:25:11.416+03	2026-10-19 13:25:11.416+03
pay-1792507738313-a153	order-1792428058648-07b6	40000.00	Cash	2026-10-05		usr-manager		2026-10-20 17:48:58.311+03	2026-10-20 17:48:58.311+03
pay-1792408002052-97fa	order-1792337911741-b8e8	76000.00	Cash	2026-09-21		usr-manager		2026-10-19 14:06:42.052+03	2026-10-19 14:06:42.052+03
pay-1792381676680-b7d2	order-1792169288274-eaad	30000.00	Cash	2026-09-18		usr-manager		2026-10-19 06:47:56.679+03	2026-10-19 06:47:56.679+03
pay-ord-1046	ord-1046	2400.00	Cash	2026-07-23	TC-1046	usr-manager	Seed payment	2026-10-08 19:28:15.787+03	2026-10-08 19:28:15.787+03
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
pcon-1792401679242-a16c	job-1792401135646-9963	inv-cocoa	0.100	kg	v1.0	0.00	0.00	Recorded during production	2026-10-19 12:21:19.242+03	2026-10-19 12:21:19.242+03
pcon-1792401679242-6e91	job-1792401135646-9963	inv-eggs	3.000	pcs	v1.0	0.00	0.00	Recorded during production	2026-10-19 12:21:19.242+03	2026-10-19 12:21:19.242+03
pcon-1792401547816-3a61	job-1792401135646-9963	inv-flour	1.000	kg	v1.0	0.00	0.00	Recorded during production	2026-10-19 12:19:07.816+03	2026-10-19 12:19:07.816+03
pcon-1792426852477-63e7	job-1792422416562-7aa2	inv-butter	1.000	kg	v1.0	7000.00	7000.00	Recorded during production	2026-10-19 19:20:52.477+03	2026-10-19 19:20:52.477+03
pcon-1792426852478-6090	job-1792422416562-7aa2	inv-sugar	1.200	kg	v1.0	0.00	0.00	Recorded during production	2026-10-19 19:20:52.478+03	2026-10-19 19:20:52.478+03
pcon-1792426852478-2872	job-1792422416562-7aa2	inv-cream	1.000	L	v1.0	5000.00	5000.00	Recorded during production	2026-10-19 19:20:52.478+03	2026-10-19 19:20:52.478+03
pcon-1792401584113-b406	job-1792401135646-9963	inv-sugar	0.250	kg	v1.0	0.00	0.00	Recorded during production	2026-10-19 12:19:44.113+03	2026-10-19 12:19:44.113+03
pcon-1792401585770-cd7e	job-1792401135646-9963	inv-cocoa	0.100	kg	v1.0	0.00	0.00	Recorded during production	2026-10-19 12:19:45.77+03	2026-10-19 12:19:45.77+03
pcon-1792401587364-1e20	job-1792401135646-9963	inv-eggs	3.000	pcs	v1.0	0.00	0.00	Recorded during production	2026-10-19 12:19:47.364+03	2026-10-19 12:19:47.364+03
pcon-1792401601379-89c0	job-1792401135646-9963	inv-flour	0.500	kg	v1.0	0.00	0.00	vanilla layer	2026-10-19 12:20:01.379+03	2026-10-19 12:20:01.379+03
pcon-1792401679242-0d99	job-1792401135646-9963	inv-flour	0.500	kg	v1.0	0.00	0.00	vanilla layer	2026-10-19 12:21:19.242+03	2026-10-19 12:21:19.242+03
pcon-1792401679242-d8f0	job-1792401135646-9963	inv-sugar	0.250	kg	v1.0	0.00	0.00	Recorded during production	2026-10-19 12:21:19.242+03	2026-10-19 12:21:19.242+03
\.


--
-- Data for Name: production_costs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.production_costs (id, job_id, ingredient_cost, packaging_cost, labour_cost, overhead_cost, total, status, created_at, updated_at) FROM stdin;
pcost-1792401547816-3df3	job-1792401135646-9963	0.00	0.00	0.00	0.00	0.00	ACTUAL	2026-10-19 12:19:07.816+03	2026-10-19 12:19:07.816+03
pcost-1792401584113-7f49	job-1792401135646-9963	0.00	0.00	0.00	0.00	0.00	ACTUAL	2026-10-19 12:19:44.113+03	2026-10-19 12:19:44.113+03
pcost-1792401585770-a26c	job-1792401135646-9963	0.00	0.00	0.00	0.00	0.00	ACTUAL	2026-10-19 12:19:45.77+03	2026-10-19 12:19:45.77+03
pcost-1792401587364-a440	job-1792401135646-9963	0.00	0.00	0.00	0.00	0.00	ACTUAL	2026-10-19 12:19:47.364+03	2026-10-19 12:19:47.364+03
pcost-1792401601379-ca4e	job-1792401135646-9963	0.00	0.00	0.00	0.00	0.00	ACTUAL	2026-10-19 12:20:01.379+03	2026-10-19 12:20:01.379+03
pcost-1792401679242-2d4e	job-1792401135646-9963	0.00	0.00	0.00	0.00	0.00	ACTUAL	2026-10-19 12:21:19.242+03	2026-10-19 12:21:19.242+03
pcost-1792426852478-fe3f	job-1792422416562-7aa2	12000.00	0.00	0.00	0.00	12000.00	ACTUAL	2026-10-19 19:20:52.478+03	2026-10-19 19:20:52.478+03
\.


--
-- Data for Name: production_jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.production_jobs (id, order_id, customer_id, product_id, variant_options, quantity, recipe_version, required_by, required_at, status, stage, progress, notes, created_at, updated_at) FROM stdin;
job-1792490994364-ed7c	order-1792426276122-85cf	cust-grace	prod-carrot	1kg, Red Forest, Mixture	1.000	v1.0	\N	2026-10-20 10:00:00+03	PENDING	CHECK_INVENTORY	10		2026-10-20 13:09:54.363+03	2026-10-20 13:09:54.364+03
job-1792491199326-06f6	order-1792427929087-5e19	cust-1792427927005-88bf	prod-vanilla	1kg, Red Forest, Mixture	1.000	v1.0	\N	2026-10-20 10:00:00+03	PENDING	CHECK_INVENTORY	10		2026-10-20 13:13:19.326+03	2026-10-20 13:13:19.326+03
job-1792507740164-5344	order-1792428058648-07b6	cust-1792427927005-88bf	prod-choc	1kg, Red Forest, Mixture	1.000	v1.0	\N	2026-10-23 10:00:00+03	PENDING	CHECK_INVENTORY	10		2026-10-20 17:49:00.164+03	2026-10-20 17:49:00.165+03
job-1792422429109-c786	order-1792421475419-e072	cust-1792169285052-2054	prod-wedding	2Kg, Blue, Time tier	1.000	v1.0	\N	2026-10-21 10:00:00+03	IN_PRODUCTION	PRODUCE	20		2026-10-19 18:07:09.109+03	2026-10-19 18:10:44.418+03
job-1792401135646-9963	order-1792346351945-1159	cust-james	prod-red	2Kg, Blue, Time tier	1.000	v1.0	\N	2026-10-19 10:00:00+03	READY_FOR_DELIVERY	DELIVER	100		2026-10-19 12:12:15.646+03	2026-10-19 19:48:16.426+03
job-1792422366671-01dc	order-1792337911741-b8e8	cust-1792337909894-2a09	prod-red	2Kg, Blue, Time tier	1.000	v1.0	\N	2026-10-08 10:00:00+03	IN_PRODUCTION	PRODUCE	20		2026-10-19 18:06:06.671+03	2026-10-19 18:52:21.206+03
job-1792422416562-7aa2	order-1792343376364-b7cc	cust-faith	prod-vanilla	2Kg, Blue, Time tier	1.000	v1.0	\N	2026-10-20 10:00:00+03	READY_FOR_DELIVERY	DELIVER	100	Created from confirmed order	2026-10-19 18:06:56.562+03	2026-10-19 19:23:15.145+03
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
prod-choc	TC-CB-001	cat-celebration	pt-celebration	Chocolate celebration cake	2kg chocolate birthday	45000.00	UGX	Recipe TC-CHOC-V1	t	t		t	f		2026-10-08 19:28:15.725+03	2026-10-20 23:28:38.944+03
prod-1791733438137-psez4b	TEST-SYNC-01	cat-celebration	\N	E2E Sync Test Cake v2	Temporary product for verifying ERP-to-website catalogue sync.	8800.00	UGX		f	t		t	t		2026-10-11 18:43:58.137+03	2026-10-11 19:37:19.679+03
prod-red	TC-CB-002	cat-signature	pt-signature	Red velvet cake	Classic red velvet	3800.00	UGX	Recipe TC-RED-V1	t	t		t	f		2026-10-08 19:28:15.725+03	2026-10-08 19:28:15.725+03
prod-vanilla	TC-CB-003	cat-cupcakes	pt-cupcake	Vanilla cupcakes	24pc vanilla	2400.00	UGX	Recipe TC-VAN-V1	t	t		t	f		2026-10-08 19:28:15.725+03	2026-10-21 01:19:06.519+03
prod-1791813913798-vfpnin	TC-001	cat-cupcakes	\N	Red Velet	Great cakes	5000.00	UGX		t	t		t	f		2026-10-12 17:05:13.797+03	2026-10-12 17:05:13.797+03
prod-wedding	TC-CB-004	cat-wedding	pt-wedding	Wedding cake	3-tier custom	18000.00	UGX	Recipe TC-WED-V1	t	t		t	f		2026-10-08 19:28:15.725+03	2026-10-08 19:28:15.725+03
prod-carrot	TC-CB-005	cat-signature	pt-signature	Carrot cake	Spiced carrot	3200.00	UGX	Recipe TC-CARR-V1	t	t		t	f		2026-10-08 19:28:15.725+03	2026-10-20 23:36:59.586+03
prod-choccup	TC-CB-006	cat-cupcakes	pt-cupcake	Chocolate cupcakes	12pc chocolate	1800.00	UGX	Recipe TC-CHOC-V1	t	t		t	f		2026-10-08 19:28:15.725+03	2026-10-08 19:28:15.725+03
prod-1792072902670-ra8v15	Acrylic	cat-cupcakes	\N	Acrylic Cakes	Best cakes	65000.00	UGX		t	t	https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQNr6xq_DcAco9ZVAjdIyziVtqxDTUmzO-54iDwzEvrzQ&s=10	t	f		2026-10-15 17:01:42.669+03	2026-10-15 17:01:42.669+03
\.


--
-- Data for Name: purchase_order_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_order_items (id, purchase_order_id, product_id, supplier_id, quantity, unit, unit_price, total, received_quantity, created_at, updated_at) FROM stdin;
poi-1792344631259-fa63	po-1792344631258-0e26	inv-butter	sup-bakers	5.000	kg	0.00	0.00	0.000	2026-10-18 20:30:31.258+03	2026-10-18 20:30:31.258+03
poi-1792344631259-d429	po-1792344631258-0e26	inv-cocoa	sup-bakers	4.000	kg	0.00	0.00	0.000	2026-10-18 20:30:31.258+03	2026-10-18 20:30:31.258+03
poi-1792408627298-7989	po-1792408627298-be31	inv-butter	sup-bakers	5.000	kg	7000.00	35000.00	5.000	2026-10-19 14:17:07.298+03	2026-10-19 14:17:07.298+03
poi-1792408627298-febc	po-1792408627298-be31	inv-cream	sup-bakers	6.000	L	5000.00	30000.00	6.000	2026-10-19 14:17:07.298+03	2026-10-19 14:17:07.298+03
poi-1792408627298-cdd9	po-1792408627298-be31	inv-eggs	sup-bakers	2.000	pcs	200.00	400.00	2.000	2026-10-19 14:17:07.298+03	2026-10-19 14:17:07.298+03
\.


--
-- Data for Name: purchase_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.purchase_orders (id, po_number, supplier_id, date, expected_date, total, status, notes, created_at, updated_at) FROM stdin;
po-27	PO-0027	sup-dairy	2026-07-23	\N	9800.00	COMPLETED	Butter, cream	2026-10-08 19:28:15.819+03	2026-10-18 20:31:03.317+03
po-26	PO-0026	sup-pack	2026-07-23	\N	6400.00	COMPLETED	Cake boxes, boards	2026-10-08 19:28:15.819+03	2026-10-08 19:28:15.819+03
po-28	PO-0028	sup-bakers	2026-07-23	\N	12400.00	COMPLETED	Flour, cocoa powder	2026-10-08 19:28:15.819+03	2026-10-15 02:57:39.96+03
po-1792344631258-0e26	PO-1792344631256-boi4	sup-bakers	2026-09-16	2026-09-17	0.00	DRAFT		2026-10-18 20:30:31.258+03	2026-10-18 20:30:31.258+03
po-1792408627298-be31	PO-1792408627296-hmc6	sup-bakers	2026-09-21	2026-09-22	65400.00	COMPLETED		2026-10-19 14:17:07.298+03	2026-10-19 14:17:46.267+03
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
qc-1792428493354-5561	job-1792401135646-9963	PASS	usr-manager	2026-10-19 19:48:13.354+03		qc order-sync probe	f	0.00	0.000	2026-10-19 19:48:13.354+03	2026-10-19 19:48:13.354+03
qc-1792428496426-21ce	job-1792401135646-9963	PASS	usr-manager	2026-10-19 19:48:16.426+03		repeat	f	0.00	0.000	2026-10-19 19:48:16.426+03	2026-10-19 19:48:16.426+03
qc-1792426964131-02d1	job-1792422416562-7aa2	PASS	usr-manager	2026-10-19 19:22:44.131+03			f	0.00	0.000	2026-10-19 19:22:44.131+03	2026-10-19 19:22:44.131+03
qc-1792426995145-d611	job-1792422416562-7aa2	PASS	usr-manager	2026-10-19 19:23:15.145+03			f	0.00	0.000	2026-10-19 19:23:15.145+03	2026-10-19 19:23:15.145+03
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
qt-1	QT-1044	cust-faith	\N	Carrot cake quote	\N	SENT	0.00	3200.00	0.00	\N	\N	usr-manager	2026-10-08 19:28:15.833+03	2026-10-08 19:28:15.833+03
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
recv-choc-12	rec-choc	v1.2	Current house version	2026-10-08	1575.00	5.00	2026-10-08 19:28:15.734319+03	2026-10-08 19:28:15.734319+03
recv-red-10	rec-red	v1.0	Base version	2026-10-08	1330.00	5.00	2026-10-08 19:28:15.734319+03	2026-10-08 19:28:15.734319+03
\.


--
-- Data for Name: recipes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.recipes (id, product_id, name, is_active, created_at, updated_at) FROM stdin;
rec-choc	prod-choc	Chocolate celebration v1.2	t	2026-10-08 19:28:15.731443+03	2026-10-08 19:28:15.731443+03
rec-red	prod-red	Red velvet v1.0	t	2026-10-08 19:28:15.731443+03	2026-10-08 19:28:15.731443+03
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
res-1	inv-flour	2.000	kg	ord-1048	TC-1048	2026-10-08 19:28:15.807+03	2026-10-08 19:28:15.807+03	2026-10-08 19:28:15.807+03
res-2	inv-butter	0.500	kg	ord-1047	TC-1047	2026-10-08 19:28:15.807+03	2026-10-08 19:28:15.807+03	2026-10-08 19:28:15.807+03
\.


--
-- Data for Name: supplier_price_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.supplier_price_history (id, supplier_id, product_id, unit, price, effective_date, note, created_at, updated_at) FROM stdin;
sph-1792408666268-4051	sup-bakers	inv-eggs	pcs	200.00	2026-09-21	Goods receipt gr-1792408666267-67fb · PO-1792408627296-hmc6	2026-10-19 14:17:46.267+03	2026-10-19 14:17:46.267+03
sph-1792408666268-5f2f	sup-bakers	inv-butter	kg	7000.00	2026-09-21	Goods receipt gr-1792408666267-67fb · PO-1792408627296-hmc6	2026-10-19 14:17:46.267+03	2026-10-19 14:17:46.267+03
sph-1792408666268-772a	sup-bakers	inv-cream	L	5000.00	2026-09-21	Goods receipt gr-1792408666267-67fb · PO-1792408627296-hmc6	2026-10-19 14:17:46.267+03	2026-10-19 14:17:46.267+03
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.suppliers (id, business_name, contact_person, phone, email, address, products_supplied, payment_terms, notes, active, created_at, updated_at) FROM stdin;
sup-bakers	Bakers Supply Co.	Supply Desk	+256 700 100 001	orders@bakerssupply.ug	Kampala				t	2026-10-08 19:28:15.736+03	2026-10-08 19:28:15.736+03
sup-dairy	Fresh Dairy Uganda	Dairy Desk	+256 700 100 002	orders@freshdairy.ug	Kampala				t	2026-10-08 19:28:15.736+03	2026-10-08 19:28:15.736+03
sup-pack	Packaging House	Pack Desk	+256 700 100 003	orders@packhouse.ug	Kampala				t	2026-10-08 19:28:15.736+03	2026-10-08 19:28:15.736+03
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_roles (id, user_id, role_id, created_at, updated_at) FROM stdin;
ur-usr-manager	usr-manager	role-admin	2026-10-08 19:28:15.656+03	2026-10-08 19:28:15.656+03
ur-usr-alex	usr-alex	role-production	2026-10-08 19:28:15.661+03	2026-10-08 19:28:15.661+03
ur-usr-jordan	usr-jordan	role-sales	2026-10-08 19:28:15.664+03	2026-10-08 19:28:15.664+03
ur-usr-priya	usr-priya	role-csr	2026-10-08 19:28:15.665+03	2026-10-08 19:28:15.665+03
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, display_name, email, phone, role, is_admin, status, password_hash, notify, created_at, updated_at) FROM stdin;
usr-priya	priya	Priya	priya@twincakery.com	0700 000 004	Customer Service Representative	f	Active	$2b$10$VphZd8xuGY3ybLPN0j.QUucRPxVUdtrZPX1D.vuyzyZbaYncd55vm	{}	2026-10-08 19:28:15.664+03	2026-10-08 19:28:15.664+03
usr-manager	manager	Manager	manager@twincakery.com	0700 000 001	Admin / Proprietor	t	Active	$2b$10$VphZd8xuGY3ybLPN0j.QUucRPxVUdtrZPX1D.vuyzyZbaYncd55vm	{}	2026-10-08 19:28:15.655+03	2026-10-08 19:28:15.655+03
usr-alex	alex	Alex	alex@twincakery.com	0700 000 002	Production Manager	t	Active	$2b$10$VphZd8xuGY3ybLPN0j.QUucRPxVUdtrZPX1D.vuyzyZbaYncd55vm	{}	2026-10-08 19:28:15.66+03	2026-10-08 19:28:15.66+03
usr-jordan	jordan	Jordan	jordan@twincakery.com	0700 000 003	Sales Manager	f	Active	$2b$10$VphZd8xuGY3ybLPN0j.QUucRPxVUdtrZPX1D.vuyzyZbaYncd55vm	{}	2026-10-08 19:28:15.663+03	2026-10-08 19:28:15.663+03
\.


--
-- Data for Name: website_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.website_users (id, name, email, phone, password_hash, role, status, customer_id, last_login_at, created_at, updated_at) FROM stdin;
wuser-2	Grace Wanjiku	grace@example.com	+256 700 000 013	$2b$10$FWNGdjlmwPM/1HGeuAG8ruveCcSlrYCNq5p1p.L/o3ZbstsD3dXIq	CUSTOMER	ACTIVE	\N	\N	2026-10-11 04:34:45.625+03	2026-10-11 04:34:45.625+03
wuser-1	Site Admin	admin@twincakery.com	0700 000 100	$2b$10$FWNGdjlmwPM/1HGeuAG8ruveCcSlrYCNq5p1p.L/o3ZbstsD3dXIq	SITE_ADMIN	ACTIVE	\N	\N	2026-10-11 04:34:45.625+03	2026-10-11 04:34:45.625+03
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

\unrestrict obc0kZZ6lwLX53mw59aqDErQMFwjZRb3cUp9SDTcgdL0UYeqiZLayaw0bHcFSzc

