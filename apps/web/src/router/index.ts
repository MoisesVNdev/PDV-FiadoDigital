import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";
import { setupGuards } from "./guards.js";

const routes: RouteRecordRaw[] = [
  {
    path: "/login",
    name: "login",
    component: () => import("@/pages/login-page.vue"),
    meta: { requiresAuth: false },
  },
  {
    path: "/",
    name: "dashboard",
    component: () => import("@/pages/dashboard-page.vue"),
    meta: { requiresAuth: true, roles: ["admin", "manager"] },
  },
  {
    path: "/sales",
    name: "sales",
    component: () => import("@/pages/sales-page.vue"),
    meta: { requiresAuth: true, roles: ["admin", "manager", "operator"] },
  },
  {
    path: "/products",
    name: "products",
    component: () => import("@/pages/products-page.vue"),
    meta: {
      requiresAuth: true,
      roles: ["admin", "manager", "stockist"],
    },
  },
  {
    path: "/customers",
    name: "customers",
    component: () => import("@/pages/customers-page.vue"),
    meta: { requiresAuth: true, roles: ["admin", "manager"] },
  },
  {
    path: "/employees",
    name: "employees",
    component: () => import("@/pages/employees-page.vue"),
    meta: { requiresAuth: true, roles: ["admin", "manager"] },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

setupGuards(router);
