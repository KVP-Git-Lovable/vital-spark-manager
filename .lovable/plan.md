

## Plan: Public Web App with Synced Shop and Customer Journey

### Understanding

Your existing WordPress site (theskinclinic.org.in) is your public website. You want to build a companion **web application** within this Lovable project that:

1. Has a **public Shop** (accessible without login) that uses the same `pharma_products` catalog
2. Requires **user authentication** (email/phone sign-up + login) for checkout and account features
3. **Syncs cart and orders** between this web app and the existing Patient Portal (currently using `portal_orders` table and localStorage cart)
4. Completes the customer journey: Browse -> Shop -> Book Appointments -> Track Orders -> View History

### Architecture

```text
┌──────────────────────────────────────────────────┐
│  theskinclinic.org.in (WordPress - unchanged)    │
│  Links to → shop.theskinclinic.org.in or /shop   │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│  Lovable Web App (this project)                  │
│                                                  │
│  /shop              Public product browsing      │
│  /shop/product/:id  Product detail               │
│  /shop/cart         Cart (auth required)         │
│  /shop/checkout     Checkout (auth required)     │
│  /shop/orders       Order history (auth required)│
│  /login             Email/phone auth             │
│  /signup            Registration                 │
│  /portal/*          Existing patient portal      │
│  /*                 Existing clinic admin app    │
└──────────────────────────────────────────────────┘

Database (shared):
  pharma_products  ← single product catalog
  portal_orders    ← orders from both web shop & portal
  cart_items (NEW) ← server-synced cart per patient
  patients         ← linked to auth.users for login
```

### Implementation Steps

#### 1. Database Changes
- **`cart_items` table** (NEW): `id`, `patient_id`, `product_id`, `quantity`, `created_at`, `updated_at` with RLS policies. Replaces localStorage cart so it syncs across devices.
- **Link patients to auth**: Add `auth_user_id` column to `patients` table so authenticated users map to their patient record.
- RLS on `cart_items` scoped to the authenticated user's patient record.

#### 2. Authentication System
- Email + password sign-up/login pages at `/login` and `/signup`
- On sign-up, either link to an existing patient record (by email/phone match) or create a new patient record
- Shared auth context that works for both the public shop and the portal
- The existing portal phone-based login continues to work alongside this

#### 3. Public Shop Pages (New Route Group: `/shop/*`)
- **Shop landing** (`/shop`): Hero banner matching The Skin Clinic branding (mint/teal palette, "The Skin Clinic" logo, "Simply. Better. Skin." tagline), category filters, product grid
- **Product detail** (`/shop/product/:id`): Full product page with Add to Cart
- **Cart** (`/shop/cart`): Server-synced cart (requires login)
- **Checkout** (`/shop/checkout`): Delivery/pickup, address, order placement (reuses existing `portal_orders` flow)
- **Orders** (`/shop/orders`): Order history and tracking

#### 4. Cart Sync
- When a user logs in, migrate any localStorage cart to the `cart_items` table
- Both PortalShop and the new public Shop read/write from `cart_items`
- Real-time sync so adding from portal reflects in web app and vice versa

#### 5. Branding & Theme
- Match the existing site: mint/teal primary color (already matches your CSS `--primary: 174 62% 38%`), clean medical aesthetic
- Use the clinic logo from the WordPress site
- Navigation: Home, Treatments, Shop, Book Appointment, My Account
- Mobile-first responsive design

#### 6. Customer Journey Flow
- **Browse** (public): View products, treatments, clinic info
- **Sign Up / Login**: Create account or sign in
- **Shop**: Add products to cart, checkout with delivery options
- **Book**: Request appointments (reuses existing appointment flow)
- **Track**: View orders, appointments, treatment history in one dashboard

### Technical Details

**New files:**
- `src/pages/shop/ShopHome.tsx` - Public shop landing
- `src/pages/shop/ShopProduct.tsx` - Product detail
- `src/pages/shop/ShopCart.tsx` - Synced cart
- `src/pages/shop/ShopCheckout.tsx` - Checkout
- `src/pages/shop/ShopOrders.tsx` - Order history
- `src/pages/auth/Login.tsx` - Auth login
- `src/pages/auth/Signup.tsx` - Auth signup
- `src/components/shop/ShopLayout.tsx` - Public shop layout (header/footer matching clinic branding)
- `src/hooks/useAuth.ts` - Auth context and patient linking
- `src/hooks/useCart.ts` - Server-synced cart hook (shared by portal and shop)

**Modified files:**
- `src/App.tsx` - Add shop and auth routes
- `src/components/portal/PortalShop.tsx` - Switch from localStorage cart to `useCart` hook
- Database migration for `cart_items` table and `patients.auth_user_id` column

**Database migration:**
- Create `cart_items` table with RLS
- Add `auth_user_id` (uuid, nullable, references auth.users) to `patients`
- Create a trigger to auto-create/link patient profile on auth sign-up

This is a large feature set. I recommend building it in phases:
1. **Phase 1**: Auth system + cart_items table + public shop pages (browsable + purchasable)
2. **Phase 2**: Cart sync between portal and shop + branding refinements
3. **Phase 3**: Full customer journey (appointment booking from shop, treatment history)

Shall I proceed with Phase 1?

