# Admin User Guide

## Logging In

Navigate to `/auth/login`. Super Admins see the admin dashboard at `/admin`.

## Dashboard

The dashboard shows:
- **Stats**: Orders today/week/month, pending company approvals
- **Recent Orders**: Last 10 orders with status badges
- **Low Stock Alerts**: Products below threshold
- **Recent Activity**: New orders, status changes, registrations

## Managing Products

**Admin → Products**

1. **Create**: Click "New Product" → fill in name, category, description
2. **Variants**: On the edit page, add variants (sizes, colors) with SKU and price
3. **UOMs**: Add units of measure (Each, Box of 12, Skid of 144)
4. **Images**: Add image URLs, set primary, drag to reorder
5. **Price Preview**: See calculated prices at each price level

## Managing Companies

**Admin → Companies**

1. **Create**: New Company → set name, price level, phone
2. **Contacts**: Add customer contacts (auto-creates login accounts)
3. **Addresses**: Manage shipping addresses
4. **Approval**: Approve or reject pending registrations
5. **Act As Customer**: Super Admins can enter a customer's portal view

## Processing Orders

**Admin → Orders**

1. **View**: Click order number for full details
2. **Update Status**: Select next valid status → confirm → add notes
3. **Internal Notes**: Add staff-only notes (not visible to customers)
4. **Export**: Download CSV of orders or individual order line items
5. **Resend Confirmation**: Re-send order confirmation email

### Order Status Flow
```
RECEIVED → PROCESSING → SHIPPED → DELIVERED
    ↓           ↓           ↓
         CANCELLED (from any active status)
```

## Act As Customer

Super Admins can view the portal as any customer:

1. Go to Admin → Companies → select company
2. Click "Contacts" tab
3. Click "Enter Portal" next to a contact
4. Browse catalog, see their pricing, place orders on their behalf
5. Yellow banner shows at top — click "Exit" to return to admin

Orders placed while acting as a customer are marked with the admin's name.

## Settings (Super Admin Only)

**Admin → Settings**

- **Business Info**: Site name, contact details
- **Feature Toggles**: Public catalog, self-registration, PO requirements
- **Shipping**: Flat rate, free above threshold, or disabled
- **Email**: Notification address, test email
- **Users**: Add/edit admin and staff accounts

## Price Levels

**Admin → Price Levels**

- Retail (0% off) — default for new companies
- Dealer (20% off)
- Distributor (30% off)
- VIP (40% off)

Change a company's price level on their edit page. All contacts share the company's level.
