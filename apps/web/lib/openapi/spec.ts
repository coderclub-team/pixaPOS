/**
 * pixaPOS OpenAPI 3.1 — Phase 1 (Neon migration)
 * Single source for Scalar docs at /api/docs and JSON at /api/openapi.json.
 * All routes are session-cookie gated via Better Auth; every business API
 * requires `activeOrganizationId` (set via POST /api/auth/organization/set-active).
 */

export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "pixaPOS API",
    version: "1.0.0",
    description:
      "Restaurant operations platform — POS, KOT/KDS, tables, payments, inventory. All endpoints are **session-cookie authenticated** (Better Auth). After sign-in, `POST /api/auth/organization/set-active` with your `organizationId` — every business API returns `400 no active organization` until then. On a fresh Neon branch run `POST /api/onboarding` first.",
  },
  servers: [{ url: "http://localhost:3000", description: "Local dev" }],
  tags: [
    { name: "Auth", description: "Better Auth session + organization activation" },
    { name: "Me", description: "Caller profile + active org context" },
    {
      name: "Masters",
      description:
        "Menu catalog (categories, items, modifiers, etc.) — org-scoped, outlet junctions",
    },
    { name: "Outlets", description: "Outlets, kitchen stations, item config" },
    {
      name: "Orders",
      description: "Order lifecycle, items, fire/KOT, payments, dispatch, splits, billing",
    },
    { name: "KOT", description: "Kitchen tickets (KDS) — server-backed, strict state machine" },
    { name: "Payments", description: "Payments + refunds (Neon Postgres, paise amounts)" },
    { name: "Tables", description: "Floors, tables, occupancy, holds, status" },
    { name: "Inventory", description: "Purchases, ledger, waste (Phase 1 subset)" },
    { name: "Reports", description: "Item sales + reporting" },
  ],
  security: [{ cookieAuth: [] }],
  components: {
    securitySchemes: {
      cookieAuth: {
        type: "apiKey",
        in: "cookie",
        name: "better-auth.session_token",
        description:
          "Better Auth session cookie — set by POST /api/auth/sign-in/email. Scalar sends it automatically same-origin.",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          hint: { type: "string" },
        },
        required: ["error"],
      },
      MeResponse: {
        type: "object",
        properties: {
          user: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string", nullable: true },
              email: { type: "string", nullable: true },
              image: { type: "string", nullable: true },
            },
          },
          organization_id: { type: "string", nullable: true },
          active_organization_id: { type: "string", nullable: true },
          role: { type: "string", nullable: true },
        },
      },
      Organization: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          slug: { type: "string" },
          logo: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          metadata: { type: "string", nullable: true },
        },
      },
      Order: {
        type: "object",
        properties: {
          id: { type: "string" },
          organization_id: { type: "string" },
          outlet_id: { type: "string" },
          order_number: { type: "string" },
          status: {
            type: "string",
            enum: [
              "DRAFT",
              "CONFIRMED",
              "IN_KITCHEN",
              "PREPARING",
              "READY",
              "SERVED",
              "OUT_FOR_DELIVERY",
              "DELIVERED",
              "COMPLETED",
              "CANCELLED",
            ],
          },
          channel: { type: "string" },
          items: { type: "array", items: { type: "object" } },
        },
      },
      KotTicket: {
        type: "object",
        properties: {
          id: { type: "string" },
          order_id: { type: "string" },
          outlet_id: { type: "string" },
          status: { type: "string" },
          lines: { type: "array", items: { type: "object" } },
        },
      },
      MasterType: {
        type: "string",
        enum: [
          "categories",
          "items",
          "modifier-groups",
          "modifiers",
          "recipes",
          "suppliers",
          "locations",
        ],
      },
    },
    parameters: {
      OrgType: {
        name: "type",
        in: "path",
        required: true,
        schema: { $ref: "#/components/schemas/MasterType" },
      },
      IdParam: { name: "id", in: "path", required: true, schema: { type: "string" } },
      OrderId: {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string" },
        description: "Order ULID",
      },
      KotId: {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string" },
        description: "KOT ULID",
      },
    },
  },
  paths: {
    "/api/me": {
      get: {
        tags: ["Me"],
        summary: "Caller profile + active org",
        operationId: "getMe",
        responses: {
          "200": {
            description: "ok",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/MeResponse" } },
            },
          },
          "401": {
            description: "unauthorized",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/api/auth/organization/list": {
      get: {
        tags: ["Auth"],
        summary: "List organizations for current user",
        operationId: "listOrganizations",
        responses: {
          "200": {
            description: "ok",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: "#/components/schemas/Organization" } },
              },
            },
          },
          "401": {
            description: "unauthorized",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/api/auth/organization/set-active": {
      post: {
        tags: ["Auth"],
        summary: "Set active organization (writes session.activeOrganizationId)",
        description:
          "Must be called after sign-in and after /api/onboarding. Writes session.activeOrganizationId — every business API returns 400 no active organization until this succeeds.",
        operationId: "setActiveOrganization",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  organizationId: {
                    type: "string",
                    description: "org_* id from onboarding or list",
                  },
                },
                required: ["organizationId"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "activated",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Organization" } },
            },
          },
          "403": {
            description: "INVALID_ORIGIN or not a member — check trustedOrigins / membership",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/api/onboarding": {
      post: {
        tags: ["Auth"],
        summary: "Create first organization + outlet (fresh DB)",
        operationId: "postOnboarding",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  business_name: { type: "string" },
                  outlet_name: { type: "string" },
                  outlet_address: { type: "string" },
                  currency: { type: "string", default: "INR" },
                  country: { type: "string", default: "IN" },
                  timezone: { type: "string", default: "Asia/Kolkata" },
                },
                required: ["business_name", "outlet_name"],
              },
            },
          },
        },
        responses: {
          "200": {
            description: "ok",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    organizationId: { type: "string" },
                    slug: { type: "string" },
                    outletId: { type: "string" },
                  },
                },
              },
            },
          },
          "401": {
            description: "sign-in required",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
    },
    "/api/masters/{type}": {
      get: {
        tags: ["Masters"],
        summary: "List masters by type",
        operationId: "listMasters",
        parameters: [
          { $ref: "#/components/parameters/OrgType" },
          { name: "outlet_id", in: "query", required: false, schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "ok",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    rows: { type: "array", items: { type: "object" } },
                  },
                },
              },
            },
          },
          "400": {
            description: "no active organization",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
          },
        },
      },
      post: {
        tags: ["Masters"],
        summary: "Create master row",
        operationId: "createMaster",
        parameters: [{ $ref: "#/components/parameters/OrgType" }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { type: "object", additionalProperties: true } },
          },
        },
        responses: {
          "201": { description: "created" },
          "400": { description: "validation error" },
        },
      },
    },
    "/api/masters/{type}/{id}": {
      get: {
        tags: ["Masters"],
        summary: "Get master by id",
        parameters: [
          { $ref: "#/components/parameters/OrgType" },
          { $ref: "#/components/parameters/IdParam" },
        ],
        responses: { "200": { description: "ok" }, "404": { description: "not found" } },
      },
      patch: {
        tags: ["Masters"],
        summary: "Update master",
        parameters: [
          { $ref: "#/components/parameters/OrgType" },
          { $ref: "#/components/parameters/IdParam" },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { type: "object", additionalProperties: true } },
          },
        },
        responses: { "200": { description: "ok" } },
      },
      delete: {
        tags: ["Masters"],
        summary: "Delete/soft-delete master",
        parameters: [
          { $ref: "#/components/parameters/OrgType" },
          { $ref: "#/components/parameters/IdParam" },
        ],
        responses: { "200": { description: "ok" } },
      },
    },
    "/api/outlets": {
      get: {
        tags: ["Outlets"],
        summary: "List outlets",
        responses: { "200": { description: "ok" } },
      },
      post: {
        tags: ["Outlets"],
        summary: "Create outlet",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { type: "object", additionalProperties: true } },
          },
        },
        responses: { "201": { description: "created" } },
      },
    },
    "/api/outlets/{id}": {
      get: {
        tags: ["Outlets"],
        summary: "Get outlet",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "ok" } },
      },
      patch: {
        tags: ["Outlets"],
        summary: "Update outlet",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { type: "object", additionalProperties: true } },
          },
        },
        responses: { "200": { description: "ok" } },
      },
    },
    "/api/orders": {
      get: {
        tags: ["Orders"],
        summary: "List orders (derived billing)",
        parameters: [
          { name: "outlet_id", in: "query", required: false, schema: { type: "string" } },
          { name: "status", in: "query", required: false, schema: { type: "string" } },
        ],
        responses: { "200": { description: "ok" } },
      },
      post: {
        tags: ["Orders"],
        summary: "Create order (counter/table/own_online)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  outlet_id: { type: "string" },
                  channel: {
                    type: "string",
                    enum: ["counter", "table", "own_online", "takeaway", "delivery"],
                  },
                  table_id: { type: "string", nullable: true },
                },
                required: ["outlet_id"],
              },
            },
          },
        },
        responses: {
          "201": {
            description: "created",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Order" } } },
          },
        },
      },
    },
    "/api/orders/{id}": {
      get: {
        tags: ["Orders"],
        summary: "Get order with derived billing",
        parameters: [{ $ref: "#/components/parameters/OrderId" }],
        responses: { "200": { description: "ok" } },
      },
      delete: {
        tags: ["Orders"],
        summary: "Delete draft order",
        parameters: [{ $ref: "#/components/parameters/OrderId" }],
        responses: { "200": { description: "ok" } },
      },
    },
    "/api/orders/{id}/items": {
      post: {
        tags: ["Orders"],
        summary: "Add item to order (pre-fire)",
        parameters: [{ $ref: "#/components/parameters/OrderId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  menu_item_id: { type: "string" },
                  variant_id: { type: "string" },
                  qty: { type: "integer", minimum: 1 },
                },
                required: ["menu_item_id", "qty"],
              },
            },
          },
        },
        responses: { "201": { description: "added" } },
      },
    },
    "/api/orders/{id}/fire": {
      post: {
        tags: ["Orders"],
        summary: "Fire order → create KOT",
        parameters: [{ $ref: "#/components/parameters/OrderId" }],
        responses: {
          "200": {
            description: "fired",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    order: { $ref: "#/components/schemas/Order" },
                    ticket: { $ref: "#/components/schemas/KotTicket" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/orders/{id}/pay": {
      post: {
        tags: ["Orders"],
        summary: "Collect payment (paise amounts)",
        parameters: [{ $ref: "#/components/parameters/OrderId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  amount_paise: { type: "integer" },
                  method: { type: "string", enum: ["cash", "card", "upi", "wallet", "other"] },
                  tendered_paise: { type: "integer" },
                },
                required: ["amount_paise", "method"],
              },
            },
          },
        },
        responses: { "200": { description: "paid" } },
      },
    },
    "/api/orders/{id}/complete": {
      post: {
        tags: ["Orders"],
        summary: "Complete order (requires paid + served)",
        parameters: [{ $ref: "#/components/parameters/OrderId" }],
        responses: {
          "200": { description: "completed" },
          "400": { description: "balance or not served" },
        },
      },
    },
    "/api/orders/{id}/cancel": {
      post: {
        tags: ["Orders"],
        summary: "Cancel order (past PREPARING requires authorizer)",
        parameters: [{ $ref: "#/components/parameters/OrderId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { reason: { type: "string" }, by: { type: "string" } },
                required: ["reason"],
              },
            },
          },
        },
        responses: { "200": { description: "cancelled" } },
      },
    },
    "/api/orders/{id}/billing": {
      get: {
        tags: ["Orders"],
        summary: "Get billing derivation",
        parameters: [{ $ref: "#/components/parameters/OrderId" }],
        responses: { "200": { description: "ok" } },
      },
    },
    "/api/orders/{id}/discount": {
      put: {
        tags: ["Orders"],
        summary: "Set bill discount (until COMPLETED/CANCELLED)",
        parameters: [{ $ref: "#/components/parameters/OrderId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["percent", "amount"] },
                  value: { type: "number" },
                },
              },
            },
          },
        },
        responses: { "200": { description: "ok" } },
      },
    },
    "/api/orders/{id}/split": {
      post: {
        tags: ["Orders"],
        summary: "Compute equal splits",
        parameters: [{ $ref: "#/components/parameters/OrderId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { parts: { type: "integer", minimum: 2 } },
                required: ["parts"],
              },
            },
          },
        },
        responses: { "200": { description: "ok" } },
      },
      delete: {
        tags: ["Orders"],
        summary: "Clear split",
        parameters: [{ $ref: "#/components/parameters/OrderId" }],
        responses: { "200": { description: "cleared" } },
      },
    },
    "/api/kots": {
      get: {
        tags: ["KOT"],
        summary: "List KOTs (outlet-scoped)",
        parameters: [{ name: "outlet_id", in: "query", schema: { type: "string" } }],
        responses: { "200": { description: "ok" } },
      },
    },
    "/api/kots/{id}": {
      get: {
        tags: ["KOT"],
        summary: "Get KOT",
        parameters: [{ $ref: "#/components/parameters/KotId" }],
        responses: { "200": { description: "ok" } },
      },
      patch: {
        tags: ["KOT"],
        summary: "KOT actions (accept, start, ready, serve, void-line, return)",
        parameters: [{ $ref: "#/components/parameters/KotId" }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  action: {
                    type: "string",
                    enum: [
                      "accept",
                      "start",
                      "accept-line",
                      "start-line",
                      "ready-line",
                      "serve",
                      "void-line",
                      "return-line",
                    ],
                  },
                  line_id: { type: "string" },
                  reason: { type: "string" },
                  qty: { type: "integer" },
                },
                required: ["action"],
              },
            },
          },
        },
        responses: { "200": { description: "ok" } },
      },
    },
    "/api/kots/by-order/{orderId}": {
      get: {
        tags: ["KOT"],
        summary: "KOTs by order",
        parameters: [{ name: "orderId", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "ok" } },
      },
    },
    "/api/payments": {
      get: {
        tags: ["Payments"],
        summary: "List payments or refunds (kind=refund)",
        parameters: [
          {
            name: "kind",
            in: "query",
            required: false,
            schema: { type: "string", enum: ["refund"] },
          },
          { name: "order_id", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "ok" } },
      },
    },
    "/api/floors": {
      get: {
        tags: ["Tables"],
        summary: "List floors",
        responses: { "200": { description: "ok" } },
      },
      post: {
        tags: ["Tables"],
        summary: "Create floor",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { type: "object", additionalProperties: true } },
          },
        },
        responses: { "201": { description: "created" } },
      },
    },
    "/api/tables": {
      get: {
        tags: ["Tables"],
        summary: "List tables",
        parameters: [{ name: "floor_id", in: "query", schema: { type: "string" } }],
        responses: { "200": { description: "ok" } },
      },
      post: {
        tags: ["Tables"],
        summary: "Create table",
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { type: "object", additionalProperties: true } },
          },
        },
        responses: { "201": { description: "created" } },
      },
    },
    "/api/reports/item-sales": {
      get: {
        tags: ["Reports"],
        summary: "Item sales (outlet-scoped)",
        parameters: [
          { name: "outlet_id", in: "query", schema: { type: "string" } },
          { name: "from", in: "query", schema: { type: "string" } },
          { name: "to", in: "query", schema: { type: "string" } },
        ],
        responses: { "200": { description: "ok" } },
      },
    },
  },
} as const;
