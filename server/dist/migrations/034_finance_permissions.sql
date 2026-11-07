INSERT INTO permissions (id, key) VALUES
  ('perm-payments-reverse', 'payments.reverse'),
  ('perm-payments-approve-refund', 'payments.approve_refund'),
  ('perm-finance-confirm-handover', 'finance.confirm_handover'),
  ('perm-finance-close-period', 'finance.close_period'),
  ('perm-finance-reopen-period', 'finance.reopen_period'),
  ('perm-finance-post-manual', 'finance.post_manual'),
  ('perm-finance-view-margins', 'finance.view_margins'),
  ('perm-finance-manage-invoices', 'finance.manage_invoices'),
  ('perm-finance-reconcile', 'finance.reconcile'),
  ('perm-finance-approve-payment', 'finance.approve_payment')
ON CONFLICT (key) DO NOTHING;

-- Grant to admin
INSERT INTO role_permissions (id, role_id, permission_id)
SELECT 'rp-034-admin-' || p.id, 'role-admin', p.id FROM permissions p
WHERE p.key IN (
  'payments.reverse','payments.approve_refund','finance.confirm_handover','finance.close_period',
  'finance.reopen_period','finance.post_manual','finance.view_margins','finance.manage_invoices',
  'finance.reconcile','finance.approve_payment'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;
