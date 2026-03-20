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
    meta: { requiresAuth: false, title: "Login" },
  },
  {
    path: "/",
    name: "dashboard",
    component: () => import("@/pages/dashboard-page.vue"),
    meta: { requiresAuth: true, roles: ["admin", "manager"], title: "Visão Geral" },
  },
  {
    path: "/sales",
    name: "sales",
    component: () => import("@/pages/sales-page.vue"),
    meta: { requiresAuth: true, roles: ["admin", "manager", "operator"], title: "Vendas" },
  },
  {
    path: "/products",
    name: "products",
    component: () => import("@/pages/products-page.vue"),
    meta: {
      requiresAuth: true,
      roles: ["admin", "manager", "stockist"],
      title: "Gerenciamento de Produtos",
    },
  },
  {
    path: "/customers",
    name: "customers",
    component: () => import("@/pages/customers-page.vue"),
    meta: { requiresAuth: true, roles: ["admin", "manager"], title: "Clientes" },
  },
  {
    path: "/employees",
    name: "employees",
    component: () => import("@/pages/employees-page.vue"),
    meta: { requiresAuth: true, roles: ["admin", "manager"], title: "Funcionários" },
  },
  {
    path: "/settings",
    name: "settings",
    component: () => import("@/pages/settings-page.vue"),
    meta: { requiresAuth: true, roles: ["admin"], title: "Configurações" },
  },
  {
    path: "/control",
    name: "control",
    component: () => import("@/pages/control-page.vue"),
    meta: { requiresAuth: true, roles: ["admin"], title: "Controle" },
  },
  {
    path: "/notifications",
    name: "notifications",
    component: () => import("@/pages/notifications-page.vue"),
    meta: { requiresAuth: true, roles: ["admin", "manager", "operator"], title: "Notificações" },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

setupGuards(router);
