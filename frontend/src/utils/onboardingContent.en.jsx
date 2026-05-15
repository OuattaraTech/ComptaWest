/**
 * Onboarding content for each ComptaWest page.
 *
 * Structure:
 *   - intro     : slides of the introduction modal (page overview)
 *   - spotlight : guided tour steps (targets a DOM selector via data-onboarding)
 *
 * Each intro entry: { titre, description, icon, points[] }
 * Each spotlight entry: { target, titre, description, position? }
 */
import {
  LayoutDashboard, Users, FileText, Wallet, Receipt,
  BarChart3, BookOpen, Shield, Settings,
  TrendingUp, AlertCircle, Calendar, Calculator, Plus,
  Download, Filter, Eye, CheckCircle2, PieChart, Building2,
  Smartphone, Banknote, Upload, Link2, ArrowLeftRight,
  UserCheck, Briefcase, CreditCard,
  Package, TrendingDown,
  Box, ClipboardCheck, AlertTriangle,
  Truck, ShoppingCart, Clock,
} from 'lucide-react';

export const ONBOARDING = {
  // ─── DASHBOARD ──────────────────────────────────────────────────────────
  dashboard: {
    titre: 'Dashboard',
    sousTitre: 'Overview of your business activity',
    intro: [
      {
        icon: LayoutDashboard,
        titre: 'Welcome to your dashboard',
        description: 'The dashboard is your starting point in ComptaWest. It brings together at a glance all the essential information about your business.',
        points: [
          'Key indicators: revenue, expenses, profit',
          'Alerts on overdue invoices and taxes due',
          'Monthly evolution of income and expenses',
          'Top customers and breakdown of expenses',
        ],
      },
      {
        icon: TrendingUp,
        titre: 'Real-time tracking',
        description: 'Figures update automatically with each invoice, expense or payment recorded. Use the year selector to compare your performance.',
        points: [
          'Filter by accounting year',
          'Interactive charts (hover for details)',
          'Data synchronized across all modules',
        ],
      },
      {
        icon: AlertCircle,
        titre: 'Smart alerts',
        description: 'ComptaWest automatically warns you of important deadlines: unpaid invoices, taxes to settle, upcoming declarations.',
        points: [
          'Visual notifications at the top of the dashboard',
          'Direct link to the relevant item',
        ],
      },
      {
        icon: AlertTriangle,
        titre: 'What the KPIs count (and what they do NOT count)',
        description: 'To stay accounting-correct, dashboard figures are computed from invoices only. Quotes, proformas and cancelled invoices are excluded.',
        points: [
          '**Revenue**: issued invoices (excluding quotes, proformas and cancellations)',
          '**Collected**: amount actually received on paid invoices',
          '**Expenses**: only paid expenses (pending ones do not weigh on profit)',
          '**Top customers**: ranked on their invoiced revenue (not their quotes)',
        ],
      },
    ],
    spotlight: [
      { target: 'header', titre: 'Dynamic greeting', description: 'The header adapts to the time of day (morning, afternoon, evening) and displays the active company name, its tax regime and the accounting year.' },
      { target: 'annee-selector', titre: 'Year selector', description: 'Switch accounting year to view or compare data from another fiscal period.' },
      { target: 'kpis', titre: 'Key indicators (KPIs)', description: 'Revenue, expenses, taxes due, net profit, margin and active customers. Quotes and proformas excluded to stay accounting-correct.' },
      { target: 'graphiques', titre: 'Trend charts', description: 'Monthly evolution of income/expenses/profit, breakdown of expenses by SYSCOHADA category, top 5 customers of the period and recent transactions.' },
    ],
  },

  // ─── CUSTOMERS ──────────────────────────────────────────────────────────
  clients: {
    titre: 'Customer management',
    sousTitre: 'SYSCOHADA 411 third parties · revenue and outstanding balances per customer · history',
    intro: [
      {
        icon: Users,
        titre: 'Your customer database',
        description: 'This page centralizes all your customers (companies and individuals). Each record is a 411 accounting third party and keeps the full history of its invoices, quotes and payments.',
        points: [
          'Company or individual type',
          'Internal code (CLI-NNN) assigned automatically',
          'Full contact details for billing',
          'NINEA/NCC and RCCM tax IDs (shown on the invoice PDF)',
        ],
      },
      {
        icon: TrendingUp,
        titre: 'Revenue and outstanding balances tracked automatically',
        description: 'Each customer row directly displays the number of invoices, total revenue and outstanding balance (sum of amounts still to be collected). Quotes and proformas are not included in these figures — this is the accounting view, not the sales view.',
        points: [
          'Total revenue = sum of invoices (excluding quotes and proformas)',
          'Outstanding = amount not yet collected on pending or overdue invoices',
          'Real-time update on each invoice or payment received',
        ],
      },
      {
        icon: Plus,
        titre: 'Add a customer',
        description: 'Essential before issuing an invoice or quote. Fill in at least the name — the other fields can be completed later.',
        points: [
          'Required field: name',
          'Recommended: email (for PDF sending), NINEA, address',
          'The customer appears immediately in the selector of the Invoices and Quotes modules',
        ],
      },
      {
        icon: Eye,
        titre: 'View a customer record',
        description: 'Click on a customer to see their last 10 invoices, total invoiced, outstanding balance and full history.',
        points: [
          'List of invoices (quotes are on the dedicated Quotes page)',
          'Total invoiced, paid, remaining due',
          'Edit or archive the record',
        ],
      },
    ],
    spotlight: [
      { target: 'btn-nouveau', titre: 'Add a customer', description: 'Essential before creating an invoice or quote. Name is required; the rest can be completed later.' },
      { target: 'liste-clients', titre: 'Customer list', description: 'Each row shows the code, name, number of invoices, total revenue and outstanding balance still to be collected.' },
    ],
  },

  // ─── INVOICES ───────────────────────────────────────────────────────────
  factures: {
    titre: 'Invoicing',
    sousTitre: 'Invoices and credit notes · payments · automatic entries and stock movements',
    intro: [
      {
        icon: FileText,
        titre: 'The heart of your commercial activity',
        description: 'Issue your invoices (F-YYYY-NNN) and credit notes (AV-YYYY-NNN). ComptaWest computes VAT, generates the PDF, updates accounting and stock. Quotes and proformas have their own dedicated page.',
        points: [
          'Automatic sequential numbering per year',
          'Automatic VAT and totals (0%, 9%, 18%)',
          'Pre-configured payment terms (30/45/60 days, cash, on delivery)',
          'Professional PDF export in one click',
        ],
      },
      {
        icon: Box,
        titre: 'Lines linked to the product catalog',
        description: 'Type the first letters of a catalog product label in the description: its price, unit and VAT are auto-filled. The line remains linked to the product for stock-out.',
        points: [
          'Auto-completion from the Products & Stock catalog',
          'Net selling price and VAT come from the product record',
          'You can mix catalog lines and free-text descriptions',
          'Percentage discount per line',
        ],
      },
      {
        icon: CheckCircle2,
        titre: 'Draft vs Validation',
        description: 'As long as an invoice is a draft, it can be edited, deleted, and leaves no accounting trace. Validation is the binding act.',
        points: [
          '**Draft**: no entry, no stock-out',
          '**Validate**: generates the accounting entry (411 Customer / 706 or 701 / 4431 VAT collected) — irreversible',
          'For lines linked to a catalog product: automatic stock-out at weighted average cost',
          'Status then progresses through: sent → pending → paid (or overdue if past due)',
        ],
      },
      {
        icon: CreditCard,
        titre: 'Payment receipt integrated with treasury',
        description: 'The "Record a payment" button on an invoice triggers a chain: entry into the chosen treasury account + receipt entry (5x Treasury / 411 Customer) + automatic status recalculation (paid or pending if partial).',
        points: [
          'Choice of credited account (bank, Wave, Orange Money, cash...)',
          'Payment method: transfer, check, card, cash, mobile money',
          'Partial payments accepted (tracks the outstanding balance)',
          'External reference (transfer number, check number) traced',
        ],
      },
      {
        icon: AlertTriangle,
        titre: 'Credit notes: SYSCOHADA rules',
        description: 'A credit note cancels an invoice partially or fully. The reference to the original invoice is mandatory — ComptaWest makes it impossible without one. The validated credit note reverses the initial entry and updates stock.',
        points: [
          'Mandatory selection of the original invoice',
          'Automatic accounting reversal',
          'For catalog products: stock return',
          'Also reduces the quarter VAT collected',
        ],
      },
    ],
    spotlight: [
      { target: 'btn-nouveau', titre: 'New invoice', description: 'Create an invoice or credit note. Quotes and proformas are managed from their own page.' },
      { target: 'filtres-statut', titre: 'Status filters', description: 'Show only paid, pending, overdue, draft, sent or cancelled invoices.' },
      { target: 'liste-factures', titre: 'Invoice list', description: 'All your invoices with their number, customer, gross amount, paid amount and status. Actions: record a payment, download the PDF.' },
    ],
  },

  // ─── QUOTES ─────────────────────────────────────────────────────────────
  devis: {
    titre: 'Quotes & Proformas',
    sousTitre: 'Manage your sales cycle before invoicing',
    intro: [
      {
        icon: FileText,
        titre: 'The starting point of the sale',
        description: 'A quote is a commercial offer sent to the customer before any commitment. ComptaWest gives it its own lifecycle, separate from accounting: as long as a quote is not converted, no entry is generated.',
        points: [
          'Quotes and proformas gathered on a dedicated page',
          'Automatic numbering (D-YYYY-NNN)',
          'Automatic VAT and totals',
          'Professional PDF export in one click',
        ],
      },
      {
        icon: CheckCircle2,
        titre: 'A commercial lifecycle',
        description: 'Each quote follows a clear outcome: pending → accepted, refused or expired. Quotes whose validity date has passed automatically switch to "expired".',
        points: [
          'Mark a quote as accepted or refused in one click',
          'Automatic expiration on the validity date',
          'Statistics: pipeline, conversion rate',
        ],
      },
      {
        icon: ArrowLeftRight,
        titre: 'Conversion to invoice',
        description: 'As soon as a quote is accepted, convert it to an invoice: lines and amounts are carried over automatically, and the two documents remain linked for traceability.',
        points: [
          'Full carryover of the quote lines',
          'Option: validate the invoice immediately (entry + stock)',
          'The converted quote remains viewable, linked to its invoice',
        ],
      },
    ],
    spotlight: [
      { target: 'btn-nouveau', titre: 'New quote', description: 'Create a quote or a proforma. You will choose the type in the next window.' },
      { target: 'devis-stats', titre: 'Commercial indicators', description: 'Track your pending quotes, pipeline amount and conversion rate.' },
      { target: 'filtres-statut', titre: 'Status filters', description: 'Show only pending, accepted, refused, expired or converted quotes.' },
      { target: 'liste-devis', titre: 'Quote list', description: 'Each row offers the actions: accept, refuse, convert to invoice, PDF, delete.' },
    ],
  },

  // ─── EXPENSES ───────────────────────────────────────────────────────────
  depenses: {
    titre: 'Expense tracking',
    sousTitre: 'All your expenses, their payment and their automatic entries',
    intro: [
      {
        icon: Wallet,
        titre: 'The hub for expenses and purchases',
        description: 'Each line entered here creates the expense AND, upon validation, the corresponding accounting entry (net expense to account 60x/62x, deductible VAT to 4452, counterpart 401 supplier or 5x treasury depending on the method).',
        points: [
          'Pre-configured SYSCOHADA categorization (expenses 60x to 67x)',
          'Automatic net / VAT / gross calculation',
          'Accounting entry generated upon validation',
          'Deductible VAT automatically feeds the VAT payable calculation',
        ],
      },
      {
        icon: CreditCard,
        titre: 'Paid vs pending status',
        description: 'The status determines the accounting scenario and the treasury movement.',
        points: [
          '**Paid**: the expense is settled immediately → outflow on the chosen treasury account + entry in BNK / CAI / MM',
          '**Pending**: the expense is owed to the supplier → recorded as a credit to 4011xxx, payable later from the Suppliers page',
          '**Cancelled**: no accounting entry is produced',
        ],
      },
      {
        icon: Smartphone,
        titre: 'Choosing the payment method and account',
        description: 'For a paid expense, you choose the method (transfer, check, card, cash, mobile money) AND the treasury account debited.',
        points: [
          'Account selection (bank, Wave, Orange Money, cash...)',
          'Automatic balance check — no unauthorized overdraft',
          'Treasury movement created and linked to the expense',
          'Reference (check number, Wave transaction number) traceable',
        ],
      },
      {
        icon: Package,
        titre: 'Conversion to fixed asset',
        description: 'A significant expense (equipment, vehicle, furniture, software) should not stay as an expense: it must be recorded as an asset and depreciated over its useful life. A "Convert to fixed asset" button appears on eligible expenses.',
        points: [
          '1-click conversion to the Fixed Assets module',
          'Choice of category (IT equipment, vehicle, furniture...)',
          'Depreciation period and automatic schedule according to SYSCOHADA',
          'The expense remains tracked as converted',
        ],
      },
      {
        icon: Filter,
        titre: 'Filter, analyze, justify',
        description: 'Filters by status, period and category let you find an expense or prepare an analysis.',
        points: [
          'Quick filters by payment status',
          'Sort by date, amount, category',
          'Search by description or supplier',
          'Supporting documents attachable (coming soon)',
        ],
      },
    ],
    spotlight: [
      { target: 'btn-nouveau', titre: 'New expense', description: 'Enter an expense with its status, payment method and treasury account. The accounting entry is generated automatically upon validation.' },
      { target: 'filtres-statut', titre: 'Filters', description: 'Show expenses by their payment status (paid, pending, cancelled).' },
      { target: 'liste-depenses', titre: 'Expense list', description: 'Summary table with category, supplier, amount and status. Click a row to edit it or convert it to a fixed asset.' },
    ],
  },

  // ─── TREASURY ───────────────────────────────────────────────────────────
  tresorerie: {
    titre: 'Treasury',
    sousTitre: 'Banks, mobile money and cash registers: a single dashboard',
    intro: [
      {
        icon: Wallet,
        titre: 'All your accounts, at a glance',
        description: 'Treasury centralizes all your money points: bank accounts, mobile money accounts (Wave, Orange Money, MTN, Moov, Djamo...) and physical cash registers.',
        points: [
          'Real-time balance per account and overall balance',
          'Default accounts for new payments',
          'Multi-bank and multi-operator mobile money',
          'Separate physical cash registers (head office, branch...)',
        ],
      },
      {
        icon: Smartphone,
        titre: 'Mobile Money integrated',
        description: 'When you collect by Wave or pay an expense by Orange Money, the movement is attached to the right account. You follow your Mobile Money balance in real time, like a bank.',
        points: [
          'Catalog of pre-configured UEMOA operators',
          'Account selection when paying an invoice',
          'Manual entry of one-off movements',
        ],
      },
      {
        icon: ArrowLeftRight,
        titre: 'Inter-account transfers',
        description: 'Top up the cash register from the bank, transfer between two mobile money wallets: a single button, two movements generated automatically (outflow + inflow).',
        points: [
          'Full transfer trail',
          'No double entry',
          'Automatic link between the two accounts',
        ],
      },
      {
        icon: Upload,
        titre: 'Bank statement import',
        description: 'Import your bank or mobile money operator statement in CSV format. ComptaWest parses it automatically and proposes a reconciliation.',
        points: [
          'Automatic column detection (date, label, debit/credit...)',
          'Common CSV formats supported (semicolon, comma, tab)',
          'History of all imported statements',
        ],
      },
      {
        icon: Link2,
        titre: 'Bank reconciliation',
        description: 'Reconciliation checks that each line of your statement matches a movement recorded in the app. An "Automatic matching" button pairs the obvious ones. The rest is done in two clicks.',
        points: [
          '2-column view: statement / app movements',
          'Auto matching by amount and nearby date (±3 days)',
          'Create a movement from an unknown line',
          'Detection of discrepancies between theoretical and statement balance',
        ],
      },
    ],
    spotlight: [
      { target: 'kpis', titre: 'Consolidated balances', description: 'Total balance and breakdown by account type (bank, mobile money, cash register).' },
      { target: 'btn-nouveau', titre: 'Create an account', description: 'Add a bank account, mobile money wallet or cash register.' },
      { target: 'btn-transfert', titre: 'Transfer', description: 'Move money between two of your accounts in a single operation.' },
      { target: 'liste-comptes', titre: 'Your accounts', description: 'Click an account to see its details, movements and import a statement.' },
    ],
  },

  // ─── TREASURY — ACCOUNT DETAIL ─────────────────────────────────────────
  'tresorerie-detail': {
    titre: 'Account detail',
    sousTitre: 'Movements, statements and reconciliation',
    intro: [
      {
        icon: Eye,
        titre: 'The full account history',
        description: 'This view shows all movements (inflows and outflows) of an account: collected invoice payments, paid expenses, transfers, manual entries, lines imported from statements.',
        points: [
          'Real-time balance and separate reconciled balance',
          'Filters by direction (inflow/outflow) and status',
          'Bank reconciliation status visible',
        ],
      },
      {
        icon: Plus,
        titre: 'Enter a movement manually',
        description: 'For operations that do not come from the app (bank fees, overdraft interest, interest, ATM withdrawal, cash deposit...), enter them manually.',
        points: [
          'Inflow (+) or outflow (−)',
          'Date, amount, label, reference',
          'Deletion possible as long as not reconciled',
        ],
      },
      {
        icon: Upload,
        titre: 'Import and reconcile a statement',
        description: 'For bank and mobile money accounts, import a CSV statement then click "Reconcile" to match the lines with your movements.',
        points: [
          '"Import" button: CSV file from your bank',
          '"Statements" button: history and launch of the reconciliation',
          'Automatic + manual matching for ambiguous cases',
        ],
      },
    ],
    spotlight: [
      { target: 'liste-mouvements', titre: 'Movements table', description: 'All money flows of the account with their source, direction and reconciliation status.' },
    ],
  },

  // ─── SUPPLIERS ──────────────────────────────────────────────────────────
  fournisseurs: {
    titre: 'Suppliers & Purchase cycle',
    sousTitre: 'Mirror of customers · 401x debt tracking · purchase orders',
    intro: [
      {
        icon: Truck,
        titre: 'The formalized supplier third party',
        description: 'Instead of retyping the supplier name on each expense, create a record per third party. Each supplier receives an internal code and a SYSCOHADA auxiliary account <strong>4011xxx</strong> that will appear in the general ledger.',
        points: [
          'Full contact details (RCCM, NINEA, bank details, mobile money)',
          'Default payment term (30 days, 60 days...)',
          'History of expenses + payments per third party',
          'Outstanding balance (amount due) calculated in real time',
        ],
      },
      {
        icon: ShoppingCart,
        titre: 'Purchase orders',
        description: 'Formalize your commitments before the invoice arrives. Workflow: Draft → Sent → Received → Invoiced. Receipt triggers automatic stock-in of linked products.',
        points: [
          'Traceable supplier quotes',
          'Lines with catalog products or free description',
          'Receipt → automatic stock-in movement',
          'Conversion to supplier invoice (expense) in one click',
        ],
      },
      {
        icon: Clock,
        titre: 'Debt schedule',
        description: 'Overview of everything that must be paid: overdue, urgent (this week), near (this month), future. Prioritized by urgency to avoid penalties.',
        points: [
          'Sort by due date urgency',
          'Total due per group',
          'Quick identification of overdue items',
        ],
      },
      {
        icon: CreditCard,
        titre: 'Payment integrated with treasury',
        description: 'The "Pay" button on a supplier record creates the treasury movement (outflow from bank/mobile money) + updates the expense + reduces the supplier balance. Everything is linked.',
        points: [
          'Choice of debited treasury account',
          'Partial or full payment',
          'Automatic update of the expense status',
          'Full traceability: movement, payment, accounting entry',
        ],
      },
    ],
    spotlight: [
      { target: 'kpis',          titre: 'Dashboard', description: 'Number of active suppliers, overall outstanding balance, overdue invoices.' },
      { target: 'tabs',          titre: '3 areas',       description: 'Suppliers (CRUD), Purchase orders (workflow), Schedule (to pay).' },
      { target: 'btn-nouveau',   titre: 'New record',  description: 'Create a supplier with auto-generated 4011xxx auxiliary code.' },
      { target: 'liste',         titre: 'Your suppliers',description: 'Click a record to see the history of expenses and pay.' },
    ],
  },

  // ─── PRODUCTS & STOCK ───────────────────────────────────────────────────
  produits: {
    titre: 'Products & Stock',
    sousTitre: 'Catalog · movements · SYSCOHADA inventories',
    intro: [
      {
        icon: Box,
        titre: 'Your business catalog',
        description: 'Instead of entering free descriptions on each invoice, create your products and services once. You can then select them directly in an invoice (price, unit and VAT auto-fill).',
        points: [
          'Products (with stock) and services (without stock)',
          '8 pre-configured categories with SYSCOHADA accounts (601 / 311 / 701 / 706...)',
          'Code, label, sale/purchase price, VAT, unit, external reference',
          'Alert threshold for replenishment',
        ],
      },
      {
        icon: TrendingUp,
        titre: 'Weighted Average Cost valuation (SYSCOHADA standard)',
        description: 'Each stock-in automatically recalculates the Weighted Average Cost. Stock-outs (sales) leave at the current weighted average cost. The total stock value is permanently up to date for the balance sheet (account 31x).',
        points: [
          'Weighted average cost recalculated on each stock-in: (stock × WAC + inflow × price) / (stock + inflow)',
          'Outflows valued at the current weighted average cost',
          'FIFO available as an option',
          'Traceable movements: sale / purchase / manual / inventory',
        ],
      },
      {
        icon: ArrowLeftRight,
        titre: 'Automatic movements',
        description: 'When you validate an invoice with catalog products, the stock-out is generated automatically. For credit notes, it is the opposite (stock return).',
        points: [
          'Automatic stock-out upon validation of an invoice',
          'Automatic stock-in for credit notes',
          'Manual entry for purchases, losses, breakage',
          'Global movement journal available',
        ],
      },
      {
        icon: ClipboardCheck,
        titre: 'Physical inventories',
        description: 'At year-end (SYSCOHADA requirement), create an inventory to reconcile accounting stock with physical stock. Discrepancies automatically generate adjustment movements valued at the weighted average cost.',
        points: [
          'Automatic snapshot of theoretical stock upon creation',
          'Line-by-line entry of physical stock',
          'Automatic calculation of discrepancies and their valuation',
          'Validation = generation of correcting movements',
        ],
      },
    ],
    spotlight: [
      { target: 'kpis',          titre: 'Dashboard',  description: 'Number of products, overall stock value, threshold alerts and stockouts.' },
      { target: 'tabs',          titre: '3 areas',        description: 'Catalog (CRUD), Movements (journal), Inventories (closing).' },
      { target: 'btn-nouveau',   titre: 'Create a product', description: 'Define code, label, price, initial stock, valuation method.' },
      { target: 'liste',         titre: 'Catalog',        description: 'Click a product to see its movement history and enter manual stock-ins/outs.' },
    ],
  },

  // ─── FIXED ASSETS ───────────────────────────────────────────────────────
  immobilisations: {
    titre: 'Fixed Assets & Depreciation',
    sousTitre: 'Asset register · automatic depreciation charges · SYSCOHADA disposals',
    intro: [
      {
        icon: Package,
        titre: 'Your company assets',
        description: 'All durable goods — IT equipment, furniture, vehicles, buildings, software — must be recorded as fixed assets and depreciated over their useful life. This is what will appear under assets on the SYSCOHADA balance sheet.',
        points: [
          '13 pre-configured categories with SYSCOHADA accounts (21x-24x)',
          'Standard depreciation periods: IT 3 years, vehicles 4-5 years, furniture 10 years, buildings 20 years',
          'Straight-line (default) or declining balance methods (coefficient 1.5 / 2 / 2.5 depending on period)',
        ],
      },
      {
        icon: TrendingDown,
        titre: 'Automatic depreciation',
        description: 'At each annual closing, a button generates the depreciation charges for all in-service fixed assets. ComptaWest calculates the prorata temporis and posts the global accounting entry (681 Depreciation charges / 28x Accumulated depreciation).',
        points: [
          'Year-by-year depreciation schedule visible before closing',
          'Prorata temporis for the 1st year (days after putting into service)',
          'Auto switch from declining to straight-line at the end of the schedule',
          'Global accounting entry per category in the OD journal',
        ],
      },
      {
        icon: Calculator,
        titre: 'From expense to fixed asset',
        description: 'Expenses ≥ 500,000 FCFA (equipment, vehicle, furniture...) can be converted to fixed assets in one click. The Expenses page displays a "Convert to fixed asset" button on these lines.',
        points: [
          '1-click conversion from the expense list',
          'The expense is marked as converted (traceability)',
          'The acquisition value is taken from the net amount',
        ],
      },
      {
        icon: AlertCircle,
        titre: 'Asset disposals',
        description: 'On sale, scrapping or loss of an asset, the "Remove from register" button automatically generates the SYSCOHADA disposal entry: reversal of depreciation, asset write-off, gain/loss to 812/822.',
        points: [
          '3 reasons: Sale (disposal), Scrapping, Theft/Loss',
          'Automatic calculation of gain or loss',
          'Complete accounting entry in the OD journal',
        ],
      },
    ],
    spotlight: [
      { target: 'kpis',            titre: 'Dashboard',  description: 'Gross value, accumulated depreciation and total net book value on the balance sheet.' },
      { target: 'tabs',            titre: 'Tabs',          description: 'Switch between the asset register and the annual depreciation generation.' },
      { target: 'btn-nouveau',     titre: 'Add an asset',  description: 'Create a fixed asset with its SYSCOHADA category and depreciation period.' },
      { target: 'btn-dotations',   titre: 'Generate depreciation', description: 'Annual closing button: generates in one go all the depreciation charges for the period + the global accounting entry in the OD journal.' },
      { target: 'liste',           titre: 'The register',      description: 'All your assets with gross value, accumulated depreciation and current net book value. Click an asset to see its depreciation schedule, remove it from the register or download the PDF table.' },
    ],
  },

  // ─── PAYROLL & HR ───────────────────────────────────────────────────────
  paie: {
    titre: 'Payroll & Human Resources',
    sousTitre: 'Manage your employees and their SYSCOHADA payslips — Côte d\'Ivoire',
    intro: [
      {
        icon: UserCheck,
        titre: 'Automated payroll for SMEs',
        description: 'ComptaWest automatically applies CNPS, ITS, CN, FDFP and apprenticeship tax schedules according to the Ivorian General Tax Code and Social Welfare Code. No more manual calculations.',
        points: [
          'Full employee record: personal info, contract, payroll, social security',
          'Automatic payslip generation in one click',
          'PDF payslip compliant with Article 31.10 of the Labor Code',
          'Direct link with treasury for salary payments',
          'Salary access restricted: Owner, Admin, Accountant and the dedicated **HR** role',
        ],
      },
      {
        icon: Briefcase,
        titre: 'The 4 tabs',
        description: 'The Payroll page is organized into 4 work areas:',
        points: [
          '**Employees**: staff directory, detailed records (4 sections)',
          '**Payslips**: monthly editing, validation and payment',
          '**Items**: configurable catalog (bonuses, deductions, contributions)',
          '**Statistics**: payroll mass, employer cost, evolution',
        ],
      },
      {
        icon: Calculator,
        titre: 'How does it work?',
        description: 'Once your employees are registered, choose a month and click "Generate monthly payroll". All draft payslips are created in seconds.',
        points: [
          'Automatic calculation: CNPS retirement, CMU, ITS, CN, FDFP, apprenticeship tax',
          'Family quotient applied (married and dependent children reduce ITS)',
          'CNPS ceilings respected (FA/WA 70,000 · Retirement 2,700,000)',
          'You can add bonuses/overtime/advances before validation',
        ],
      },
      {
        icon: CreditCard,
        titre: 'From payslip to payment',
        description: 'A payslip follows a cycle: Draft → Validated → Paid. Once paid, a treasury outflow movement is generated automatically on the chosen account (bank, Wave, Orange Money...).',
        points: [
          'Workflow draft → validated → paid',
          'Choice of payment account (transfer, mobile money...)',
          'Integration with treasury: automatic outflow',
          'Download PDF of the payslip at any time',
        ],
      },
    ],
    spotlight: [
      { target: 'tabs',               titre: 'Tabs',          description: 'Navigate between Employees, Payslips, Items and Statistics.' },
      { target: 'btn-nouveau-employe',titre: 'New employee',   description: 'Create an employee record in 4 guided steps: personal info, contract, payroll, social security.' },
      { target: 'liste-employes',     titre: 'Your employees',     description: 'Full list with position, base salary and status (active/archived).' },
      { target: 'btn-generer',        titre: 'Generate monthly payroll', description: 'Creates in one go the draft payslips of all active employees for a given month, with auto calculation of CNPS, ITS, CN, FDFP and apprenticeship tax.' },
      { target: 'liste-bulletins',    titre: 'The payslips',    description: 'Monthly list with gross, net pay, employer cost and status (draft → validated → paid). Click to see line details or download the PDF.' },
    ],
  },

  // ─── TAXES ──────────────────────────────────────────────────────────────
  taxes: {
    titre: 'Taxes & Tax declarations',
    sousTitre: 'Auto calculation · deadlines · payment integrated with accounting and treasury',
    intro: [
      {
        icon: Receipt,
        titre: 'All taxes and contributions in one place',
        description: 'Centralize your tax and social declarations with their deadlines. ComptaWest manages 8 pre-configured types according to Ivorian schedules.',
        points: [
          '**VAT** (DGI) — quarterly, 18% rate',
          '**IS / BIC** (DGI) — annual profit tax',
          '**ITS** — wage and salary tax (linked to payroll)',
          '**CNSS / CMU** — social contributions',
          '**IRVM, Patente, Other** — for specific cases',
        ],
      },
      {
        icon: Calculator,
        titre: 'Automatic VAT calculation',
        description: 'The "VAT calculation" button aggregates in one second all your VAT collected and deductible over a period, from invoices and expenses already entered. No more parallel spreadsheet.',
        points: [
          'VAT collected = on sent/pending/overdue/paid invoices (credit notes deducted)',
          'Deductible VAT = on paid expenses with VAT',
          'Net VAT payable or carryforward credit displayed',
          'Used to pre-fill the quarterly DGI declaration',
        ],
      },
      {
        icon: Calendar,
        titre: 'Deadlines and alerts',
        description: 'Each declaration has a due date. Overdue items show up on the dashboard and on the Taxes page.',
        points: [
          'Statuses: to pay, paid, overdue, exempt, cancelled',
          'Visual alert as soon as a deadline approaches or is past',
          'Full year-by-year history',
        ],
      },
      {
        icon: CreditCard,
        titre: 'Integrated payment',
        description: 'The "Pay" button on a declaration triggers automatically: outflow on the chosen treasury account + accounting entry (4441 VAT / 441 IS / 4311 CNSS... on the debit side, treasury on the credit side) + status update.',
        points: [
          'Choice of treasury account (bank, mobile money...)',
          'Payment method and reference traced',
          'Entry posted in the corresponding BNK / CAI / MM journal',
        ],
      },
    ],
    spotlight: [
      { target: 'btn-calc-tva', titre: 'Automatic VAT calculation', description: 'Calculate in one click the VAT collected, deductible and net balance payable for a given period, based on your invoices and expenses.' },
      { target: 'btn-nouveau', titre: 'New declaration', description: 'Create a declaration: type, period, base/due amount, deadline. To be used after the VAT calculation to formalize the quarterly declaration.' },
      { target: 'liste-taxes', titre: 'Declaration list', description: 'All your declarations with deadline, due/paid amount and status. "Pay" button on each due row.' },
    ],
  },

  // ─── REPORTS ────────────────────────────────────────────────────────────
  rapports: {
    titre: 'Reports & financial statements',
    sousTitre: 'Annual summary · profit & loss · sign-ready PDF export',
    intro: [
      {
        icon: BarChart3,
        titre: 'The financial snapshot of the period',
        description: 'This section consolidates on one page the essence of an annual closing: revenue collected, expenses paid, taxes settled, net result and margin — all calculated in real time from the invoices and expenses of the selected year.',
        points: [
          'Income month by month (gross and collected)',
          'Expenses broken down by SYSCOHADA category',
          'Taxes paid (VAT, IS/BIC, CNSS, Patente...)',
          'Net result = income − expenses − taxes',
          'Margin as a % of revenue',
        ],
      },
      {
        icon: Calendar,
        titre: 'Year-on-year comparison',
        description: 'The year selector lets you switch from one fiscal period to another to compare your performance. Only years where you have activity appear.',
        points: [
          'One year = one tab',
          'Figures update with each invoice/expense added',
          'Quotes and proformas are excluded from revenue (sales view ≠ accounting view)',
        ],
      },
      {
        icon: Download,
        titre: 'PDF export of the profit & loss',
        description: 'Download in one click a properly laid-out PDF, ready to send to your accountant, to your bank for a financing file, or to archive for the tax return.',
        points: [
          'Header with your company name and tax IDs',
          'Month-by-month table of income and receipts',
          'Breakdown of expenses by category',
          'Detail of taxes by type',
          'Net result and margin highlighted',
          'Compliant with SYSCOHADA presentation',
        ],
      },
    ],
    spotlight: [
      { target: 'periode-selector', titre: 'Analysis year', description: 'Switch from one period to another to compare your performance.' },
      { target: 'metriques', titre: 'Summary indicators', description: 'Income, expenses, taxes paid, net profit and margin calculated in real time on the selected period.' },
      { target: 'btn-export', titre: 'Export to PDF', description: 'Full profit & loss statement in PDF, ready for your accountant, your bank or your tax archive.' },
    ],
  },

  // ─── ACCOUNTING ─────────────────────────────────────────────────────────
  comptabilite: {
    titre: 'Accounting',
    sousTitre: 'SYSCOHADA chart of accounts · journals · entries · general ledger · trial balance · FEC',
    intro: [
      {
        icon: BookOpen,
        titre: 'The accounting mirror of the app',
        description: 'Each business action (invoice validation, payment, expense, payroll, depreciation charge...) automatically generates the equivalent SYSCOHADA accounting entry. You don\'t need to post anything by hand for everyday operations — this page is for viewing, checking and exporting.',
        points: [
          'No manual entry required for the normal cycle',
          'Full SYSCOHADA chart of accounts (804 pre-configured accounts)',
          'Debit = credit entries guaranteed on every record',
          'Journal reserved for Owner / Admin / Accountant roles',
        ],
      },
      {
        icon: Briefcase,
        titre: 'The accounting journals',
        description: 'Each entry is allocated to a journal based on the nature of the operation, in accordance with SYSCOHADA. Default journals are created automatically upon company creation.',
        points: [
          '**VTE** — Sales (issued invoices)',
          '**ACH** — Purchases (expenses, supplier invoices)',
          '**BNK** — Bank (bank movements, transfer/check/card receipts)',
          '**CAI** — Cash (cash movements)',
          '**MM** — Mobile Money (Wave, Orange, MTN...)',
          '**OD** — Other operations (depreciation, manual entries, disposals)',
        ],
      },
      {
        icon: PieChart,
        titre: 'General ledger & trial balance',
        description: 'Beyond the chronological journal, two essential analytical views:',
        points: [
          '**General ledger**: all movements of a specific account (e.g. 4111 Customers) with running balance',
          '**Trial balance**: snapshot at a given date — total debit/credit and balance of each account',
          'These two statements are the basis of any year-end closing',
        ],
      },
      {
        icon: Plus,
        titre: 'Manual entry (OD)',
        description: 'For miscellaneous operations not covered by the modules (adjustments, provisions, opening balances...), enter a manual entry. ComptaWest checks the debit = credit balance before validation.',
        points: [
          'Choice of journal (default OD)',
          'At least 2 lines, sum of debit = sum of credit',
          'Lettering available for tracking third-party accounts',
          'Reserved for Owner, Admin and Accountant',
        ],
      },
      {
        icon: Download,
        titre: 'FEC export for the DGI',
        description: 'The Accounting Entries File (FEC) is required by the tax authority in case of an audit. ComptaWest produces a compliant FEC (18 columns, "|" separator, UTF-8 encoding) directly from the app.',
        points: [
          'Pipe-delimited export compliant with the DGI standard',
          'One row per entry line for the period',
          'All mandatory fields: document, journal, account, debit, credit...',
          'Download reserved for Owner and Admin',
        ],
      },
    ],
    spotlight: [
      { target: 'journal', titre: 'Accounting journal', description: 'All entries of the period, in chronological order, with their journal, label, debit and credit. Filterable by period, journal and account.' },
    ],
  },

  // ─── AUDIT LOG ──────────────────────────────────────────────────────────
  'audit-log': {
    titre: 'Audit log',
    sousTitre: 'Immutable traceability of sensitive actions',
    intro: [
      {
        icon: Shield,
        titre: 'The "who did what" of your business',
        description: 'Every binding action (login, creation, modification, deletion, payment, invitation, role change...) is recorded here with its author, timestamp and details. Visible only to Owner and Admin roles.',
        points: [
          'Logins: LOGIN_OK and LOGIN_FAIL (wrong password, unknown account)',
          'CRUD: creations, modifications, deletions on all entities',
          'Payments and status changes traced',
          'Invitations, removals and role changes of members',
        ],
      },
      {
        icon: Eye,
        titre: 'What is it for day-to-day?',
        description: 'Three concrete uses for an SME:',
        points: [
          '**Tax audit**: find the exact history of an invoice, expense or entry',
          '**Internal incident**: trace who changed an amount, deleted a customer, validated a payroll',
          '**Security**: detect repeated failed logins or an unexpected role change',
        ],
      },
      {
        icon: AlertCircle,
        titre: 'Immutable data',
        description: 'The audit log is NOT editable from the app. No action can erase or alter an entry. That is what makes it reliable evidence.',
        points: [
          'Insert only, no modification or deletion',
          'Unlimited retention (no automatic purge)',
          'Accessible only to Owner and Admin',
        ],
      },
    ],
    spotlight: [
      { target: 'filtres', titre: 'Filters', description: 'Search by user, action type, entity (invoices, expenses, customers, members...) or period.' },
      { target: 'journal', titre: 'Event list', description: 'Each row: timestamp, user, action, related entity and JSON detail. Click to expand.' },
    ],
  },

  // ─── SETTINGS ───────────────────────────────────────────────────────────
  parametres: {
    titre: 'Settings',
    sousTitre: 'Company identity · members and roles · preferences',
    intro: [
      {
        icon: Settings,
        titre: 'Your company identity',
        description: 'The information entered here automatically feeds your invoices, quotes, payslips and reports: header, legal notices, NIF/NCC, RCCM, tax regime.',
        points: [
          'Company name, legal form, sector',
          'Address, phone, email',
          'Tax IDs: NINEA/NIF, RCCM',
          'Regime (Standard, Simplified, RSI) and default VAT rate',
        ],
      },
      {
        icon: Users,
        titre: 'Invite and manage members',
        description: 'A company can have several members. The invitation is sent by email — a single-use link (7-day expiration) lets the invitee set their own password.',
        points: [
          'Enter email + role → generation of an invitation link',
          'The invitee receives the link and activates their account (single-use token)',
          'Change a member\'s role at any time',
          'Remove a member — the history of their actions is kept in the audit log',
        ],
      },
      {
        icon: Shield,
        titre: '6 roles for 6 access levels',
        description: 'Each role grants a precise scope. A member can have different roles in different companies.',
        points: [
          '**Owner** — everything, including company deletion',
          '**Admin** — everything except revoking the owner',
          '**Accountant** — entry/editing of the full accounting cycle + payroll',
          '**HR** — exclusive access to payroll (employees, payslips, items), no accounting',
          '**User** — standard entry (customers, invoices, expenses...)',
          '**Read-only** — viewing only',
        ],
      },
      {
        icon: Building2,
        titre: 'Multi-company',
        description: 'A single user account can manage several companies (holding manager, external accountant...). The switcher at the top of the sidebar moves from one to another — data is fully isolated.',
        points: [
          '"New company" button in the sidebar switcher',
          'Each company has its own chart of accounts, its own entries',
          'No data mixing possible — security by design',
        ],
      },
      {
        icon: Eye,
        titre: 'Display preferences',
        description: 'Light or dark mode according to your comfort. The choice is remembered per device.',
        points: [
          'Sun/moon button in the sidebar',
          'Persistence in the browser',
          'The whole color palette adapts',
        ],
      },
    ],
    spotlight: [
      { target: 'form-entreprise', titre: 'Company information', description: 'This data appears on your invoices, quotes, payslips and reports. Remember to fill in the NINEA and RCCM before editing the first document.' },
    ],
  },
};

export const getOnboarding = (pageKey) => ONBOARDING[pageKey] || null;
