-- ============================================================================
-- TRISTELLAR IT DEPT. CMMS — Complete Supabase PostgreSQL Schema
-- Paste and execute this entire script in the Supabase SQL Editor.
-- Row Level Security (RLS) is explicitly DISABLED for initial testing.
-- ============================================================================

-- 1. ASSET REGISTRY
CREATE TABLE IF NOT EXISTS public.assets (
  id TEXT PRIMARY KEY,
  equipment_name TEXT NOT NULL,
  asset_code TEXT NOT NULL,
  serial_number TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('Computer', 'Printer', 'Peripherals')),
  brand TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  specification TEXT NOT NULL DEFAULT '',
  branch_location TEXT NOT NULL,
  assigned_to TEXT NOT NULL DEFAULT '',
  condition TEXT NOT NULL CHECK (condition IN ('GOOD', 'FAIR', 'POOR', 'BAD')),
  operational_status TEXT NOT NULL CHECK (
    operational_status IN ('OPERATIONAL', 'DEGRADED', 'DOWN', 'MAINTENANCE', 'RETIRED')
  ),
  last_maintenance_date TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assets_code ON public.assets (asset_code);
CREATE INDEX IF NOT EXISTS idx_assets_branch ON public.assets (branch_location);

-- 2. COMPUTER SET BUNDLES (QR & BARCODE ISSUED SETS)
CREATE TABLE IF NOT EXISTS public.asset_bundles (
  id TEXT PRIMARY KEY,
  bundle_code TEXT NOT NULL,
  bundle_name TEXT NOT NULL,
  assignee_name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  branch_location TEXT NOT NULL,
  issued_date TEXT NOT NULL DEFAULT '',
  registry_assets JSONB NOT NULL DEFAULT '[]'::jsonb,
  accessories JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_asset_bundles_code ON public.asset_bundles (bundle_code);
CREATE INDEX IF NOT EXISTS idx_asset_bundles_assignee ON public.asset_bundles (assignee_name);

-- 3. PREVENTIVE MAINTENANCE TASKS & CHECKLISTS
CREATE TABLE IF NOT EXISTS public.maintenance_tasks (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL,
  asset_code TEXT NOT NULL,
  equipment_name TEXT NOT NULL,
  branch_location TEXT NOT NULL,
  seq_number TEXT NOT NULL DEFAULT '',
  form_code TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  incharge TEXT NOT NULL DEFAULT '',
  position TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  quarter TEXT NOT NULL CHECK (quarter IN ('Q1', 'Q2', 'Q3', 'Q4')),
  year INTEGER NOT NULL,
  technician TEXT NOT NULL,
  scheduled_date TEXT NOT NULL DEFAULT '',
  actual_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('Done', 'Pending')),
  checklist_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  remarks TEXT NOT NULL DEFAULT '',
  result_condition TEXT NOT NULL CHECK (result_condition IN ('GOOD', 'FAIR', 'POOR', 'BAD')),
  set_asset_status_to TEXT NOT NULL CHECK (
    set_asset_status_to IN ('OPERATIONAL', 'DEGRADED', 'DOWN', 'MAINTENANCE', 'RETIRED')
  ),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pm_tasks_year_quarter ON public.maintenance_tasks (year, quarter);
CREATE INDEX IF NOT EXISTS idx_pm_tasks_asset ON public.maintenance_tasks (asset_id);

-- 4. HELPDESK YEARLY SUMMARY REPORTS
CREATE TABLE IF NOT EXISTS public.helpdesk_reports (
  year INTEGER PRIMARY KEY,
  months JSONB NOT NULL DEFAULT '[]'::jsonb,
  personnels JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. HELPDESK TICKET LOGS
CREATE TABLE IF NOT EXISTS public.helpdesk_tickets (
  id TEXT PRIMARY KEY,
  ticket_no INTEGER NOT NULL,
  date TEXT NOT NULL DEFAULT '',
  branch_location TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  noted_by TEXT NOT NULL DEFAULT '',
  date_start TEXT NOT NULL DEFAULT '',
  date_finish TEXT NOT NULL DEFAULT '',
  attended_by TEXT NOT NULL DEFAULT '',
  details_of_narration TEXT NOT NULL DEFAULT '',
  solution TEXT NOT NULL DEFAULT '',
  classification TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT '',
  nature_of_work TEXT NOT NULL DEFAULT '',
  remarks TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  cost TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_no ON public.helpdesk_tickets (ticket_no);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_branch ON public.helpdesk_tickets (branch_location);

-- 6. SPARE PARTS REQUESTS
CREATE TABLE IF NOT EXISTS public.spare_parts (
  id TEXT PRIMARY KEY,
  item TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  request_quantity INTEGER NOT NULL DEFAULT 0,
  stock_left INTEGER NOT NULL DEFAULT 0,
  is_urgent BOOLEAN NOT NULL DEFAULT FALSE,
  from_jack BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. DISPOSAL & KEEP LOG
CREATE TABLE IF NOT EXISTS public.disposal_items (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL DEFAULT '',
  brand TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('For Disposal', 'Defective', 'Keep')),
  from_branch TEXT NOT NULL DEFAULT '',
  asset_tag TEXT NOT NULL DEFAULT '',
  turnover_date TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  equipment_type TEXT NOT NULL DEFAULT '',
  end_branch TEXT NOT NULL DEFAULT '',
  assorted_item TEXT NOT NULL DEFAULT '',
  qty INTEGER NOT NULL DEFAULT 1,
  area TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. IT COMMS DIRECTORY: ANYDESK
CREATE TABLE IF NOT EXISTS public.anydesk_entries (
  id TEXT PRIMARY KEY,
  anydesk_id TEXT NOT NULL,
  server_or_pc_name TEXT NOT NULL,
  branch_description TEXT NOT NULL DEFAULT '',
  category_status TEXT NOT NULL DEFAULT '',
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. IT COMMS DIRECTORY: CCTV CAMERAS
CREATE TABLE IF NOT EXISTS public.cctv_entries (
  id TEXT PRIMARY KEY,
  branch TEXT NOT NULL,
  camera_no TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  location_area TEXT NOT NULL DEFAULT '',
  status_notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. IT COMMS DIRECTORY: RADIOS
CREATE TABLE IF NOT EXISTS public.radio_entries (
  id TEXT PRIMARY KEY,
  personnel_or_unit TEXT NOT NULL,
  department_role TEXT NOT NULL,
  callsign TEXT NOT NULL,
  channel_no TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. IT COMMS DIRECTORY: WIFI AUTHORIZED DEVICES
CREATE TABLE IF NOT EXISTS public.wifi_authorized_devices (
  id TEXT PRIMARY KEY,
  employee_name TEXT NOT NULL,
  allowed_qty INTEGER NOT NULL DEFAULT 1,
  device_breakdown TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. IT COMMS DIRECTORY: WIFI VOUCHERS
CREATE TABLE IF NOT EXISTS public.wifi_vouchers (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL DEFAULT '',
  voucher_code TEXT NOT NULL,
  employee_name TEXT NOT NULL DEFAULT '',
  employee_number TEXT NOT NULL DEFAULT '',
  device_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Used', 'Available')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 13. GOOGLE SHEETS QUICK LINKS
CREATE TABLE IF NOT EXISTS public.google_sheet_links (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  module_target TEXT NOT NULL CHECK (
    module_target IN ('helpdesk', 'maintenance', 'assets', 'comms', 'dashboard')
  ),
  description TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. TEAM CHAT MESSAGES
CREATE TABLE IF NOT EXISTS public.team_chat_messages (
  id TEXT PRIMARY KEY,
  channel TEXT NOT NULL CHECK (
    channel IN ('general-it', 'branch-support', 'maintenance-ops', 'parts-procurement')
  ),
  sender TEXT NOT NULL,
  sender_role TEXT NOT NULL DEFAULT 'IT Support',
  content TEXT NOT NULL,
  asset_code TEXT,
  branch_location TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_team_chat_created ON public.team_chat_messages (created_at);

-- 15. SHARED IT NOTES
CREATE TABLE IF NOT EXISTS public.it_notes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (
    category IN ('Handover', 'Runbook', 'Incident', 'Maintenance', 'Config')
  ),
  branch_location TEXT NOT NULL DEFAULT 'All Branches',
  asset_code TEXT,
  author TEXT NOT NULL,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_it_notes_updated ON public.it_notes (updated_at DESC);

-- 16. CMMS OPERATORS / USERS
CREATE TABLE IF NOT EXISTS public.cmms_users (
  username TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  password TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 17. CMMS APP SETTINGS & METADATA
CREATE TABLE IF NOT EXISTS public.cmms_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SEED DEFAULT IT OPERATORS & SYSTEM SETTINGS
-- ============================================================================
INSERT INTO public.cmms_users (username, display_name, role, password)
VALUES
  ('mac', 'Mac', 'IT Lead', '123'),
  ('francis', 'Francis', 'IT Support', '123'),
  ('vhon', 'Vhon', 'IT Support', '123')
ON CONFLICT (username) DO NOTHING;

INSERT INTO public.cmms_settings (key, value)
VALUES (
  'cmms_metadata',
  '{"version": 1, "department": "TRISTELLAR IT DEPT.", "defaultTheme": "light"}'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- DISABLE ROW LEVEL SECURITY (RLS) FOR INITIAL TESTING
-- ============================================================================
ALTER TABLE public.assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_bundles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.helpdesk_tickets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.spare_parts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.disposal_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.anydesk_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cctv_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.radio_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wifi_authorized_devices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wifi_vouchers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_sheet_links DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.it_notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmms_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cmms_settings DISABLE ROW LEVEL SECURITY;
