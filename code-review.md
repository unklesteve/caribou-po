# Caribou PO - Production Readiness Code Review

**Review Date:** December 7, 2025
**Reviewer:** Senior Code Reviewer
**Codebase:** caribou-po (Next.js 14 Purchase Order Management System)

---

## Executive Summary

The caribou-po application is a functional purchase order management system with several well-implemented features. However, it contains **CRITICAL security vulnerabilities** that make it **NOT production-ready** in its current state. The most severe issue is **hardcoded database credentials** committed directly in the source code. Additionally, there are numerous missing error handlers, lack of input validation, no automated tests, and potential data integrity issues.

**Overall Assessment:** 🔴 **NOT PRODUCTION READY** - Critical security issues must be resolved before deployment.

**Risk Level:** HIGH - Active security vulnerabilities, data integrity concerns, missing error boundaries.

---

## Strengths

### Well-Implemented Features

1. **Clean Architecture** (/Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/)
   - Good separation of concerns between API routes and UI components
   - Consistent REST API structure with proper HTTP methods
   - Proper use of Next.js 14 App Router patterns

2. **Comprehensive PDF Generation** (/Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/purchase-orders/[id]/pdf/route.ts)
   - Sophisticated PDF generation with proper image handling
   - Card-based layout optimized for factory readability
   - Pre-fetches images to avoid timeout issues
   - Good error handling for missing images with fallback placeholders

3. **Database Schema Design** (/Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/prisma/schema.prisma)
   - Well-normalized schema with proper relationships
   - Cascade deletes properly configured
   - Good use of indexes (e.g., line 68: `@@index([productId, quoteDate])`)
   - Proper separation between prototype and production quotes

4. **Basic Authentication** (/Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/middleware.ts)
   - HTTP Basic Auth implemented for entire application
   - Environment variable configuration for credentials

5. **Image Upload Security** (/Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/upload/route.ts:20-27)
   - File type validation for uploads
   - Reasonable file naming strategy

6. **CSV Import Feature** (/Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/import-po/route.ts)
   - Handles auto-creation of products and colors
   - Proper CSV parsing with quoted field support
   - Good user feedback with created items list

---

## Issues

### Critical (Must Fix Before Production)

#### 1. **HARDCODED DATABASE CREDENTIALS IN SOURCE CODE**
**File:** /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/lib/prisma.ts:11-15

```typescript
const tursoUrl = process.env.TURSO_DATABASE_URL
  || 'libsql://caribou-po-unklesteve.aws-us-east-2.turso.io'

const tursoToken = process.env.TURSO_AUTH_TOKEN
  || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjUxMjE3NDIsImlkIjoiZWJlMDc3ODMtNjViOS00M2M2LWEyODgtYWQwNDlhYjQyNDlkIiwicmlkIjoiNjljMWQyMzYtOWE5MS00NWE3LTk2ZmMtMmU2MmViMmJlNDNlIn0.737EYWRmmODxVLo1tCYggLj6BrAZ0Tb8mRVw1BjfGF0NGWJ2mGyhxRGkEsqoPqe3I5j9MUOlhDNj-akdvJBNBg'
```

**Why it matters:**
- Database credentials are committed to source control and publicly visible
- The JWT token provides read-write access to the production database
- Anyone with this code can access, modify, or delete production data
- This is a **CRITICAL SECURITY VULNERABILITY**

**How to fix:**
1. **IMMEDIATELY** rotate the Turso database credentials
2. Remove hardcoded fallback values - fail fast if env vars not set:
```typescript
const tursoUrl = process.env.TURSO_DATABASE_URL
const tursoToken = process.env.TURSO_AUTH_TOKEN

if (!tursoUrl || !tursoToken) {
  throw new Error('Missing required database credentials: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set')
}
```
3. Add these to `.env.example` (NOT `.env`)
4. Ensure `.env` is in `.gitignore` (currently line 29, which is good)
5. Review git history and remove credentials from all commits (use git filter-branch or BFG Repo-Cleaner)

#### 2. **Hardcoded Authentication Credentials**
**File:** /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/middleware.ts:5-6

```typescript
const VALID_USERNAME = process.env.BASIC_AUTH_USER || 'caribou'
const VALID_PASSWORD = process.env.BASIC_AUTH_PASSWORD || 'lodge2024'
```

**Why it matters:**
- Default credentials are publicly visible in source code
- If environment variables aren't set, the application uses insecure defaults
- Authentication can be bypassed by anyone who reads the code

**How to fix:**
```typescript
const VALID_USERNAME = process.env.BASIC_AUTH_USER
const VALID_PASSWORD = process.env.BASIC_AUTH_PASSWORD

if (!VALID_USERNAME || !VALID_PASSWORD) {
  throw new Error('BASIC_AUTH_USER and BASIC_AUTH_PASSWORD must be set in environment variables')
}
```

#### 3. **Missing Error Handling in API Routes**
Multiple API routes lack proper error handling:

**File:** /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/products/[id]/route.ts:27-56

```typescript
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()  // ❌ No try-catch, no validation

  const product = await prisma.product.update({  // ❌ Can fail if ID doesn't exist
    where: { id: params.id },
    data: {
      sku: body.sku,  // ❌ No validation that these fields exist or are valid
      unitPrice: parseFloat(body.unitPrice),  // ❌ Can be NaN if invalid input
      // ...
    },
  })

  return NextResponse.json(product)
}
```

**Why it matters:**
- Missing validation allows invalid data to reach the database
- `parseFloat(undefined)` returns `NaN`, corrupting data
- Uncaught errors cause 500 responses with no useful error messages
- Can crash the API route handler

**How to fix:**
Wrap all database operations in try-catch and validate inputs:
```typescript
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.sku || !body.name) {
      return NextResponse.json({ error: 'SKU and name are required' }, { status: 400 })
    }

    const unitPrice = parseFloat(body.unitPrice)
    if (isNaN(unitPrice) || unitPrice < 0) {
      return NextResponse.json({ error: 'Invalid unit price' }, { status: 400 })
    }

    const product = await prisma.product.update({
      where: { id: params.id },
      data: {
        sku: body.sku,
        name: body.name,
        unitPrice,
        // ...
      },
    })

    return NextResponse.json(product)
  } catch (error) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    console.error('Product update error:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}
```

**Affected files:**
- /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/products/[id]/route.ts:27-56
- /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/suppliers/[id]/route.ts:19-42
- /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/colors/[id]/route.ts:26-67
- /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/purchase-orders/[id]/route.ts:47-107
- /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/products/[id]/engraving-art/[artId]/route.ts:19-35

#### 4. **Race Condition in PO Number Generation**
**File:** /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/purchase-orders/route.ts:5-31

```typescript
async function generatePONumber(): Promise<string> {
  const now = new Date()
  const year = now.getFullYear()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const prefix = `PO-${year}-${month}-`

  const existingPOs = await prisma.purchaseOrder.findMany({
    where: { poNumber: { startsWith: prefix } },
    select: { poNumber: true },
    orderBy: { poNumber: 'desc' },
    take: 1,
  })

  let counter = 1
  if (existingPOs.length > 0) {
    const lastNum = existingPOs[0].poNumber.replace(prefix, '')
    const parsed = parseInt(lastNum, 10)
    if (!isNaN(parsed)) {
      counter = parsed + 1
    }
  }

  return `${prefix}${counter.toString().padStart(3, '0')}`
}
```

**Why it matters:**
- Two concurrent PO creations can generate the same PO number
- Query → increment → create leaves a window for race conditions
- Will cause unique constraint violations and failed PO creations
- Data loss when user thinks PO was created but it failed

**How to fix:**
Use database transactions or the POCounter pattern from schema:
```typescript
async function generatePONumber(): Promise<string> {
  const now = new Date()
  const year = now.getFullYear()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const key = `PO-${year}-${month}`

  // Atomic increment using transaction
  const result = await prisma.$transaction(async (tx) => {
    const counter = await tx.pOCounter.upsert({
      where: { id: key },
      update: { counter: { increment: 1 } },
      create: { id: key, counter: 1 },
    })
    return `${key}-${counter.counter.toString().padStart(3, '0')}`
  })

  return result
}
```

Note: POCounter model in schema.prisma needs to be modified to support dynamic IDs instead of "singleton".

#### 5. **SQL Injection via `contains` Queries**
**File:** /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/products/route.ts:9-22

```typescript
const products = await prisma.product.findMany({
  where: {
    AND: [
      search
        ? {
            OR: [
              { name: { contains: search } },  // ❌ User input directly in query
              { sku: { contains: search } },
            ],
          }
        : {},
      activeOnly ? { isActive: true } : {},
    ],
  },
  // ...
})
```

**Why it matters:**
- While Prisma generally prevents SQL injection, the `contains` operator in SQLite can have issues
- No input sanitization or length limits
- Could enable DoS attacks with extremely long search strings
- Pattern matching can be expensive on large datasets without limits

**How to fix:**
```typescript
// Sanitize and limit search input
const searchParams = request.nextUrl.searchParams
let search = searchParams.get('search') || ''
search = search.trim().slice(0, 100)  // Limit length

// Add pagination
const page = parseInt(searchParams.get('page') || '1', 10)
const limit = 50
const skip = (page - 1) * limit

const products = await prisma.product.findMany({
  where: {
    AND: [
      search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {},
      activeOnly ? { isActive: true } : {},
    ],
  },
  skip,
  take: limit,
  // ...
})
```

**Affected files:**
- /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/products/route.ts:9-22
- /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/suppliers/route.ts:8-18
- /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/purchase-orders/route.ts:39-53
- /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/colors/route.ts:26-48

#### 6. **Missing File Size Limits on Uploads**
**File:** /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/upload/route.ts:7-57

```typescript
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    // ❌ No file size validation

    const blob = await put(filename, file, {
      access: 'public',
    })
```

**Why it matters:**
- Users can upload extremely large files, causing:
  - Memory exhaustion
  - Excessive Vercel Blob costs
  - Slow page loads when displaying images
  - Potential DoS attacks

**How to fix:**
```typescript
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'colors'

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
    }

    // Validate file size (max 5MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Invalid file type' }, { status: 400 })
    }

    // ... rest of upload logic
  }
}
```

### Important (Should Fix)

#### 7. **Missing Input Validation in Quote Updates**
**File:** /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/quotes/[id]/route.ts:29-101

**What's wrong:**
- No validation that productId exists before creating QuoteLineItem
- No validation that quantity > 0
- No validation that costs are positive numbers
- Missing validation could corrupt data or create orphaned records

**Example issue:**
```typescript
await prisma.quoteLineItem.create({
  data: {
    quoteId: params.id,
    productId: item.productId,  // ❌ Could be invalid/non-existent
    quantity: item.quantity,     // ❌ Could be 0 or negative
    unitCost: item.unitCost,     // ❌ Could be NaN
    totalCost: item.totalCost,
  },
})
```

**How to fix:**
Add validation before database operations:
```typescript
for (const item of lineItems) {
  // Validate product exists
  const product = await tx.product.findUnique({ where: { id: item.productId } })
  if (!product) {
    throw new Error(`Product ${item.productId} not found`)
  }

  // Validate numbers
  if (!item.quantity || item.quantity <= 0) {
    throw new Error('Quantity must be positive')
  }

  const unitCost = parseFloat(item.unitCost)
  const totalCost = parseFloat(item.totalCost)

  if (isNaN(unitCost) || unitCost < 0) {
    throw new Error('Invalid unit cost')
  }
  if (isNaN(totalCost) || totalCost < 0) {
    throw new Error('Invalid total cost')
  }

  // ... create line item
}
```

#### 8. **Data Consistency Issue: Deleting Line Items Without Transactions**
**File:** /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/purchase-orders/[id]/route.ts:47-107

```typescript
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const body = await request.json()

  // Delete existing line items and create new ones
  await prisma.lineItem.deleteMany({
    where: { purchaseOrderId: params.id },
  })  // ❌ If next operation fails, data is lost

  const purchaseOrder = await prisma.purchaseOrder.update({
    where: { id: params.id },
    data: {
      supplierId: body.supplierId,
      lineItems: {
        create: body.lineItems.map(/* ... */)
      },
    },
  })
```

**Why it matters:**
- If the update fails after delete, all line items are lost
- No atomicity between delete and create operations
- Database left in inconsistent state on error
- User data is permanently lost

**How to fix:**
Use a transaction:
```typescript
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json()

    const purchaseOrder = await prisma.$transaction(async (tx) => {
      // Delete and create in same transaction
      await tx.lineItem.deleteMany({
        where: { purchaseOrderId: params.id },
      })

      return await tx.purchaseOrder.update({
        where: { id: params.id },
        data: {
          supplierId: body.supplierId,
          notes: body.notes || null,
          lineItems: {
            create: body.lineItems.map(/* ... */)
          },
        },
        include: { /* ... */ },
      })
    })

    return NextResponse.json(purchaseOrder)
  } catch (error) {
    console.error('Update failed:', error)
    return NextResponse.json({ error: 'Failed to update purchase order' }, { status: 500 })
  }
}
```

**Also affects:**
- /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/colors/[id]/route.ts:32-35 (pantone deletion)
- /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/quotes/[id]/route.ts:52-54 (quote line items)

#### 9. **No Error Boundary in Client Components**
**Files:** All client components in /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/components/

**What's wrong:**
- Client components use `alert()` for all errors
- No global error boundary to catch unexpected React errors
- Poor UX for error handling
- Errors can crash the entire page

**Example from ProductForm.tsx:120:**
```typescript
} catch (error) {
  setSaving(false)
  alert(error instanceof Error ? error.message : 'Failed to save product')
}
```

**How to fix:**
1. Create an error boundary component:
```typescript
// src/components/ErrorBoundary.tsx
'use client'

import { Component, ReactNode } from 'react'

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-lg font-semibold text-red-900">Something went wrong</h2>
          <p className="text-red-700 mt-2">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

2. Replace alert() calls with toast notifications or inline error displays

#### 10. **Missing Loading States Can Cause Double-Submissions**
**File:** /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/components/PurchaseOrderForm.tsx:171-210

```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  // ... validation ...

  setSaving(true)  // ✓ Sets loading state

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })

  const po = await res.json()
  router.push(`/purchase-orders/${po.id}`)
  router.refresh()
  // ❌ Never sets setSaving(false) - but navigates away, so acceptable here
}
```

**Why it matters:**
- If network is slow, user might click submit multiple times
- Could create duplicate purchase orders
- Though this specific case navigates away, other forms have this issue

**Best practice:**
Always disable buttons during async operations and handle errors:
```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  if (saving) return  // Prevent double-submission

  // ... validation ...

  setSaving(true)

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      throw new Error(`Failed to save: ${res.statusText}`)
    }

    const po = await res.json()
    router.push(`/purchase-orders/${po.id}`)
    router.refresh()
  } catch (error) {
    setSaving(false)
    alert(error.message)
  }
}
```

#### 11. **Potential XSS in PDF Generation**
**File:** /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/purchase-orders/[id]/pdf/route.ts:159-191

**What's wrong:**
- User-provided text (supplier name, notes, product names) inserted directly into PDF
- While jsPDF typically handles escaping, no explicit sanitization
- Could cause rendering issues or PDF exploits

**Example:**
```typescript
doc.text(po.supplier.name, 20, y)  // ❌ No sanitization
doc.text(po.notes, 20, y)  // ❌ Could contain special characters
```

**How to fix:**
Add basic sanitization:
```typescript
function sanitizeForPDF(text: string | null | undefined): string {
  if (!text) return ''
  // Remove control characters and limit length
  return text
    .replace(/[\x00-\x1F\x7F]/g, '')  // Remove control chars
    .slice(0, 1000)  // Reasonable length limit
}

doc.text(sanitizeForPDF(po.supplier.name), 20, y)
```

#### 12. **Missing CORS Configuration**
**What's wrong:**
- No CORS headers configured
- If accessed from different origin, API calls will fail
- Not an issue if only accessed from same domain, but limits flexibility

**How to fix:**
Add CORS middleware or configure headers in `next.config.mjs`:
```typescript
const nextConfig = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: process.env.ALLOWED_ORIGIN || 'https://yourdomain.com' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, PATCH' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ]
  },
}
```

#### 13. **No Rate Limiting**
**What's wrong:**
- No protection against brute force attacks on basic auth
- No limits on API calls (could be abused for DoS)
- File upload endpoints particularly vulnerable

**How to fix:**
Add rate limiting middleware (using `express-rate-limit` or similar):
```typescript
// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { RateLimiter } from './lib/rate-limiter'

const limiter = new RateLimiter({
  max: 100,  // 100 requests
  windowMs: 60 * 1000,  // per minute
})

export function middleware(request: NextRequest) {
  // Rate limiting
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
  if (!limiter.check(ip)) {
    return new NextResponse('Too many requests', { status: 429 })
  }

  // ... rest of auth logic
}
```

### Minor (Nice to Have)

#### 14. **Image Optimization Not Used**
**Files:** Multiple components use `unoptimized` prop

**What's wrong:**
```typescript
// ProductForm.tsx:425, ColorForm.tsx:351, PurchaseOrderForm.tsx:305
<Image
  src={formData.imageUrl}
  alt="Preview"
  fill
  className="object-cover"
  unoptimized  // ❌ Disables Next.js image optimization
/>
```

**Why it matters:**
- Missing automatic image optimization
- Larger file sizes and slower load times
- No automatic responsive images

**How to fix:**
Configure image domains and remove `unoptimized`:
```typescript
// next.config.mjs
const nextConfig = {
  images: {
    domains: ['*.vercel-storage.com', '*.blob.vercel-storage.com'],
    formats: ['image/avif', 'image/webp'],
  },
}
```

Then remove `unoptimized` prop from Image components.

#### 15. **No Logging or Monitoring**
**What's wrong:**
- Only `console.error()` for logging
- No structured logging
- No error tracking (Sentry, etc.)
- No performance monitoring
- Makes debugging production issues very difficult

**How to fix:**
Implement structured logging:
```typescript
// src/lib/logger.ts
export const logger = {
  error: (message: string, error?: unknown, context?: Record<string, unknown>) => {
    console.error(JSON.stringify({
      level: 'error',
      message,
      error: error instanceof Error ? {
        message: error.message,
        stack: error.stack,
      } : error,
      context,
      timestamp: new Date().toISOString(),
    }))
  },
  // ... info, warn, debug methods
}

// Usage in API routes:
logger.error('Failed to create product', error, { userId, productData })
```

Consider integrating:
- Sentry for error tracking
- Vercel Analytics for performance
- Custom logging to external service (Datadog, LogRocket, etc.)

#### 16. **TypeScript `any` Types in Several Places**
**File:** /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/app/api/purchase-orders/route.ts:99

```typescript
lineItems: {
  create: body.lineItems.map((item: { productId: string; colorId?: string | null; ringColor?: string | null; quantity: number; engravings?: { engravingArtId: string }[] }) => ({
    // ❌ This type definition is inline and repeated, should be extracted
```

**How to fix:**
Create proper TypeScript interfaces:
```typescript
// src/types/api.ts
export interface CreateLineItemInput {
  productId: string
  colorId?: string | null
  ringColor?: string | null
  quantity: number
  engravings?: { engravingArtId: string }[]
}

export interface CreatePurchaseOrderInput {
  supplierId: string
  notes?: string
  lineItems: CreateLineItemInput[]
}

// Then use in route:
const body: CreatePurchaseOrderInput = await request.json()
```

#### 17. **Inconsistent Error Messages**
**What's wrong:**
- Some routes return `{ error: 'message' }`
- Others return `{ success: false, error: 'message' }`
- Client code must handle both patterns

**Example:**
```typescript
// products/[id]/route.ts:21
return NextResponse.json({ error: 'Product not found' }, { status: 404 })

// upload/route.ts:15
return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })
```

**How to fix:**
Standardize on one format:
```typescript
// Always include success flag
return NextResponse.json({
  success: false,
  error: 'Product not found'
}, { status: 404 })
```

#### 18. **No Database Connection Pooling Configuration**
**File:** /Users/nervous/Library/CloudStorage/Dropbox/Github/caribou-po/src/lib/prisma.ts

**What's wrong:**
- Default Prisma connection pool settings
- No configuration for connection limits
- Could hit connection limits under load

**How to fix:**
```typescript
return new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  datasources: {
    db: {
      url: tursoUrl,
    },
  },
})
```

#### 19. **Missing Database Indexes**
**What's wrong:**
- Search queries on `name` and `sku` fields without indexes
- Could be slow with many products

**How to fix:**
Add indexes to schema:
```prisma
model Product {
  // ...

  @@index([name])
  @@index([sku])
  @@index([isActive])
}

model YoyoColor {
  // ...

  @@index([name])
  @@index([isActive])
}

model Supplier {
  // ...

  @@index([name])
}
```

#### 20. **No Automated Tests**
**What's wrong:**
- Zero test files found in codebase
- No unit tests, integration tests, or e2e tests
- High risk of regressions when making changes
- No CI/CD validation

**How to fix:**
Implement testing strategy:

1. **Unit tests** for utilities and business logic:
```typescript
// src/lib/__tests__/prisma.test.ts
import { describe, it, expect } from 'vitest'
import { createPrismaClient } from '../prisma'

describe('createPrismaClient', () => {
  it('throws if environment variables missing', () => {
    delete process.env.TURSO_DATABASE_URL
    expect(() => createPrismaClient()).toThrow()
  })
})
```

2. **API route tests** with supertest:
```typescript
// src/app/api/__tests__/products.test.ts
import { describe, it, expect } from 'vitest'
import { POST } from '../products/route'

describe('POST /api/products', () => {
  it('requires SKU and name', async () => {
    const req = new Request('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ sku: '' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })
})
```

3. **E2E tests** with Playwright for critical user flows

4. Add to CI/CD pipeline (GitHub Actions):
```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm ci
      - run: npm test
      - run: npm run build
```

---

## Security Checklist

- [ ] ❌ **CRITICAL:** Remove hardcoded database credentials
- [ ] ❌ **CRITICAL:** Remove hardcoded auth credentials
- [ ] ❌ **CRITICAL:** Rotate all exposed credentials
- [ ] ❌ Add input validation to all API routes
- [ ] ❌ Add file size limits to upload endpoints
- [ ] ❌ Sanitize search inputs and add length limits
- [ ] ❌ Add rate limiting to API routes
- [ ] ❌ Configure CORS headers
- [ ] ⚠️ Add HTTPS redirect in production
- [ ] ⚠️ Add Content Security Policy headers
- [ ] ⚠️ Enable audit logging for sensitive operations
- [ ] ✅ Basic auth implemented
- [ ] ✅ File type validation on uploads

## Data Integrity Checklist

- [ ] ❌ Fix race condition in PO number generation
- [ ] ❌ Add transactions for multi-step operations
- [ ] ❌ Add foreign key validation before creates
- [ ] ❌ Add numeric validation (prevent NaN)
- [ ] ⚠️ Add database constraints (CHECK constraints)
- [ ] ⚠️ Add unique constraints where needed
- [ ] ✅ Cascade deletes configured properly
- [ ] ✅ Relations properly defined

## Testing Checklist

- [ ] ❌ Add unit tests for business logic
- [ ] ❌ Add API route integration tests
- [ ] ❌ Add E2E tests for critical flows
- [ ] ❌ Add CI/CD pipeline with tests
- [ ] ❌ Test error handling paths
- [ ] ❌ Test concurrent operations
- [ ] ❌ Test file upload validation
- [ ] ❌ Test database constraints

## Error Handling Checklist

- [ ] ❌ Add try-catch to all API routes
- [ ] ❌ Add React error boundaries
- [ ] ❌ Replace alert() with proper UI
- [ ] ❌ Add structured logging
- [ ] ❌ Add error monitoring (Sentry)
- [ ] ⚠️ Add user-friendly error messages
- [ ] ⚠️ Log errors with context
- [ ] ✅ Some routes have error handling

---

## Recommendations (Top 5 by Impact)

### 1. **IMMEDIATELY Secure Credentials** (Impact: CRITICAL)
**Effort:** 2 hours
**Risk if not done:** Complete database breach, data loss, unauthorized access

**Action items:**
1. Rotate Turso database credentials NOW
2. Remove all hardcoded credentials from code
3. Review git history and remove credentials from all commits
4. Add fail-fast validation for missing env vars
5. Set up proper environment variable management in Vercel

### 2. **Add Comprehensive Input Validation** (Impact: HIGH)
**Effort:** 1-2 days
**Risk if not done:** Data corruption, API crashes, security vulnerabilities

**Action items:**
1. Create validation helper functions/schemas (use Zod or similar)
2. Add validation to all POST/PUT/PATCH routes
3. Validate numeric inputs (prevent NaN)
4. Validate foreign keys exist before creates
5. Add length limits on text inputs
6. Test with invalid/malicious inputs

### 3. **Implement Automated Testing** (Impact: HIGH)
**Effort:** 3-5 days
**Risk if not done:** Regressions, broken features, difficult maintenance

**Action items:**
1. Set up testing framework (Vitest + Testing Library)
2. Write API route tests for all endpoints
3. Write E2E tests for critical flows (create PO, upload file, etc.)
4. Add CI/CD pipeline with test running
5. Aim for >70% code coverage on critical paths

### 4. **Fix Data Integrity Issues** (Impact: MEDIUM-HIGH)
**Effort:** 1 day
**Risk if not done:** Duplicate POs, lost data, inconsistent state

**Action items:**
1. Fix PO number race condition with transaction
2. Wrap multi-step operations in transactions
3. Add database indexes for performance
4. Test concurrent operations

### 5. **Improve Error Handling & Monitoring** (Impact: MEDIUM)
**Effort:** 2-3 days
**Risk if not done:** Poor UX, difficult debugging, unknown failures

**Action items:**
1. Add React error boundaries
2. Replace alert() with toast notifications
3. Implement structured logging
4. Set up error monitoring (Sentry)
5. Add performance monitoring
6. Create error handling patterns/guidelines

---

## Assessment

### Production Ready?
**NO** ❌

### Reasoning:

**Blockers:**
1. **Critical security vulnerability:** Hardcoded database credentials in source code (TURSO_AUTH_TOKEN) provide read-write access to production database
2. **Critical security vulnerability:** Hardcoded authentication credentials provide bypass mechanism
3. **Missing input validation** throughout API routes could corrupt data
4. **Race conditions** in PO number generation can cause data integrity issues
5. **No automated tests** means changes are high-risk

**Required before production:**
- Remove and rotate all hardcoded credentials
- Add input validation to all API routes
- Fix race condition in PO number generation
- Add basic automated tests for critical paths
- Add error boundaries and proper error handling

**Recommended before production:**
- Implement rate limiting
- Add file size limits on uploads
- Use database transactions for multi-step operations
- Add monitoring and logging
- Security audit and penetration testing

**Estimated effort to production-ready:** 2-3 weeks with 1 developer

**Current state:** Functional for internal/development use with trusted users, but **NOT safe for production deployment** without addressing critical security issues first.

---

## Positive Notes

Despite the critical issues identified, the codebase shows several strengths:

1. **Clean architecture** with good separation of concerns
2. **Modern stack** (Next.js 14, Prisma, TypeScript)
3. **Thoughtful features** like quote tracking, CSV import, PDF generation
4. **Good UI/UX** with loading states and user feedback
5. **Well-structured database schema** with proper relationships

With the security fixes and recommendations implemented, this would be a solid production application.

---

**Next Steps:**
1. Address CRITICAL security issues immediately (credentials)
2. Review and prioritize other issues based on business needs
3. Create tickets/issues for tracking fixes
4. Implement testing infrastructure
5. Schedule security review before production deployment
