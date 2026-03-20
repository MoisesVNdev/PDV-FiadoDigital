<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { formatCents, type Brand, type Product, type ProductType } from "@pdv/shared";
import AppHeader from "@/components/layout/app-header.vue";
import AppSidebar from "@/components/layout/app-sidebar.vue";
import ConfirmDialog from "@/components/layout/confirm-dialog.vue";
import { useApi } from "@/composables/use-api.js";
import { useConfirm } from "@/composables/use-confirm.js";
import { useFormatting } from "@/composables/use-formatting.js";
import { useToast } from "@/composables/use-toast.js";
import { useAuthStore } from "@/stores/auth.store.js";
import { useProductStore } from "@/stores/product.store.js";

type TabKey = "products" | "product-types" | "prices";
type WeightUnit = "kg" | "g" | "L" | "ml" | "un";

interface ProductFormData {
  name: string;
  brand_id: string;
  description: string;
  barcode: string;
  weight_unit: WeightUnit | "";
  weight_value: string;
  product_type_id: string;
  price_input: string;
  cost_price_input: string;
  stock_quantity: string;
  min_stock_alert: string;
  is_bulk: boolean;
}

interface ProductFormErrors {
  name?: string[];
  brand_id?: string[];
  description?: string[];
  barcode?: string[];
  weight_value?: string[];
  weight_unit?: string[];
  product_type_id?: string[];
  price_cents?: string[];
  cost_price_cents?: string[];
  stock_quantity?: string[];
  min_stock_alert?: string[];
  submit?: string;
}

interface ProductTypeFormErrors {
  name?: string[];
  profit_margin?: string[];
  submit?: string;
}

type ProductSortKey = "name" | "brand" | "type" | "price" | "stock";
type ProductTypeSortKey = "name" | "profit_margin";
type PriceSortKey = "name" | "type" | "brand" | "cost" | "margin" | "sale" | "stock";
type SortDirection = "asc" | "desc";

type SortState<K extends string> = {
  key: K;
  direction: SortDirection;
};

interface BrandFormErrors {
  name?: string[];
  submit?: string;
}

interface BulkPriceFormData {
  product_type_id: string;
  brand_id: string;
  margin_percentage: string;
}

const { authenticatedFetch } = useApi();
const authStore = useAuthStore();
const productStore = useProductStore();

const activeTab = ref<TabKey>("products");

const products = ref<Product[]>([]);
const loadingProducts = ref(false);
const productsError = ref<string | null>(null);
const productsCurrentPage = ref(1);
const productsItemsPerPage = ref(10);

const productTypes = ref<ProductType[]>([]);
const loadingProductTypes = ref(false);
const productTypesError = ref<string | null>(null);
const productTypesCurrentPage = ref(1);
const productTypesItemsPerPage = ref(10);
const pricesCurrentPage = ref(1);
const pricesItemsPerPage = ref(10);

const brands = ref<Brand[]>([]);
const loadingBrands = ref(false);
const brandsError = ref<string | null>(null);

const showProductModal = ref(false);
const isProductEditMode = ref(false);
const editingProduct = ref<Product | null>(null);
const loadingProductSubmit = ref(false);
const productModalScrollableRef = ref<HTMLDivElement | null>(null);

const productFormData = ref<ProductFormData>({
  name: "",
  brand_id: "",
  description: "",
  barcode: "",
  weight_unit: "",
  weight_value: "",
  product_type_id: "",
  price_input: "",
  cost_price_input: "",
  stock_quantity: "0",
  min_stock_alert: "5",
  is_bulk: false,
});
const productFormErrors = ref<ProductFormErrors>({});

const showInlineBrandCreate = ref(false);
const brandFormName = ref("");
const loadingBrandSubmit = ref(false);
const brandFormErrors = ref<BrandFormErrors>({});

const showStockModal = ref(false);
const stockSearchBarcode = ref("");
const stockSearchLoading = ref(false);
const stockSearchError = ref<string | null>(null);
const foundStockProduct = ref<Product | null>(null);
const stockAdditionAmount = ref("");
const stockAdditionType = ref<"unit" | "kg">("unit");
const stockEntryUnitCostInput = ref("");
const stockEntryDescription = ref("Entrada de estoque");
const stockSubmitLoading = ref(false);
const stockSubmitError = ref<string | null>(null);

const showProductTypeModal = ref(false);
const isProductTypeEditMode = ref(false);
const editingProductTypeId = ref<string | null>(null);
const productTypeName = ref("");
const productTypeProfitMarginInput = ref("");
const loadingProductTypeSubmit = ref(false);
const productTypeFormErrors = ref<ProductTypeFormErrors>({});

const showBulkPriceModal = ref(false);
const bulkPriceLoading = ref(false);
const bulkPriceError = ref<string | null>(null);
const bulkPriceFormData = ref<BulkPriceFormData>({
  product_type_id: "",
  brand_id: "",
  margin_percentage: "",
});
const bulkBrands = ref<Brand[]>([]);
const loadingBulkBrands = ref(false);

const productSort = ref<SortState<ProductSortKey>>({ key: "name", direction: "asc" });
const productTypeSort = ref<SortState<ProductTypeSortKey>>({ key: "name", direction: "asc" });
const priceSort = ref<SortState<PriceSortKey>>({ key: "name", direction: "asc" });

const showSinglePriceModal = ref(false);
const singlePriceLoading = ref(false);
const singlePriceError = ref<string | null>(null);
const singlePriceProduct = ref<Product | null>(null);
const singleCostInput = ref("");
const singleMarginInput = ref("");
const singleSaleInput = ref("");
const singlePriceLastEdited = ref<"margin" | "sale">("margin");

const { showToast, toastMessage, toastType, toast } = useToast();
const { showConfirm, confirmTitle, confirmMessage, confirmLabel, confirm, onConfirm, onCancel } = useConfirm();
const {
  formatCurrencyInput,
  parseCurrencyInputToNullableCents: parseCurrencyInputToCents,
  formatStockQuantity,
} = useFormatting();

const isAdmin = computed(() => authStore.user?.role === "admin");
const isStockist = computed(() => authStore.user?.role === "stockist");

const canManageProductTypes = computed(() => {
  const role = authStore.user?.role;
  return role === "admin" || role === "manager";
});

const canViewCostPrice = computed(() => {
  if (!isStockist.value) {
    return true;
  }

  return authStore.user?.can_view_cost_price === true;
});

const canViewSalePriceField = computed(() => !isStockist.value);
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const selectedProductType = computed(() => {
  if (!productFormData.value.product_type_id) {
    return null;
  }

  return productTypes.value.find((item) => item.id === productFormData.value.product_type_id) ?? null;
});

const selectedProductTypeProfitMargin = computed(() => selectedProductType.value?.profit_margin ?? null);

const autoCalculatedSalePriceCents = computed(() => {
  const costPriceCents = parseCurrencyInputToCents(productFormData.value.cost_price_input);
  const margin = selectedProductTypeProfitMargin.value;

  if (margin === null || margin <= 0 || margin >= 1) {
    return null;
  }

  if (costPriceCents === null || costPriceCents <= 0) {
    return null;
  }

  return Math.round(costPriceCents / (1 - margin));
});

const isSalePriceAutoCalculated = computed(() => autoCalculatedSalePriceCents.value !== null);

const displayedSalePriceInput = computed(() => {
  if (isSalePriceAutoCalculated.value && autoCalculatedSalePriceCents.value !== null) {
    return formatCents(autoCalculatedSalePriceCents.value);
  }

  return productFormData.value.price_input;
});

const sortedProducts = computed(() => {
  const direction = productSort.value.direction === "asc" ? 1 : -1;

  return [...products.value].sort((left, right) => {
    switch (productSort.value.key) {
      case "name":
        return direction * left.name.localeCompare(right.name, "pt-BR");
      case "brand": {
        const leftValue = left.brand?.name ?? "";
        const rightValue = right.brand?.name ?? "";
        return direction * leftValue.localeCompare(rightValue, "pt-BR");
      }
      case "type": {
        const leftValue = left.product_type?.name ?? "";
        const rightValue = right.product_type?.name ?? "";
        return direction * leftValue.localeCompare(rightValue, "pt-BR");
      }
      case "price":
        return direction * (left.price_cents - right.price_cents);
      case "stock":
        return direction * (left.stock_quantity - right.stock_quantity);
    }
  });
});

const sortedProductTypes = computed(() => {
  const direction = productTypeSort.value.direction === "asc" ? 1 : -1;

  return [...productTypes.value].sort((left, right) => {
    if (productTypeSort.value.key === "name") {
      return direction * left.name.localeCompare(right.name, "pt-BR");
    }

    const leftMargin = left.profit_margin ?? -1;
    const rightMargin = right.profit_margin ?? -1;
    return direction * (leftMargin - rightMargin);
  });
});

const paginatedProductTypes = computed(() => {
  const start = (productTypesCurrentPage.value - 1) * productTypesItemsPerPage.value;
  const end = start + productTypesItemsPerPage.value;
  return sortedProductTypes.value.slice(start, end);
});

const sortedProductsForPrices = computed(() => {
  const direction = priceSort.value.direction === "asc" ? 1 : -1;

  return [...products.value].sort((left, right) => {
    switch (priceSort.value.key) {
      case "name":
        return direction * left.name.localeCompare(right.name, "pt-BR");
      case "type": {
        const leftValue = left.product_type?.name ?? "";
        const rightValue = right.product_type?.name ?? "";
        return direction * leftValue.localeCompare(rightValue, "pt-BR");
      }
      case "brand": {
        const leftValue = left.brand?.name ?? "";
        const rightValue = right.brand?.name ?? "";
        return direction * leftValue.localeCompare(rightValue, "pt-BR");
      }
      case "cost":
        return direction * (left.cost_price_cents - right.cost_price_cents);
      case "margin": {
        const leftMargin = left.profit_margin !== null ? left.profit_margin : (left.product_type?.profit_margin ?? -1);
        const rightMargin = right.profit_margin !== null ? right.profit_margin : (right.product_type?.profit_margin ?? -1);
        return direction * (leftMargin - rightMargin);
      }
      case "sale":
        return direction * (left.price_cents - right.price_cents);
      case "stock":
        return direction * (left.stock_quantity - right.stock_quantity);
    }
  });
});

const paginatedProducts = computed(() => {
  const start = (productsCurrentPage.value - 1) * productsItemsPerPage.value;
  const end = start + productsItemsPerPage.value;
  return sortedProducts.value.slice(start, end);
});

const paginatedProductsForPrices = computed(() => {
  const start = (pricesCurrentPage.value - 1) * pricesItemsPerPage.value;
  const end = start + pricesItemsPerPage.value;
  return sortedProductsForPrices.value.slice(start, end);
});

const normalizedStockAddition = computed(() => {
  const parsed = Number.parseInt(stockAdditionAmount.value, 10);

  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
});

const updatedStockQuantity = computed(() => {
  if (!foundStockProduct.value) {
    return 0;
  }

  return foundStockProduct.value.stock_quantity + normalizedStockAddition.value;
});

const filteredProductsForBulk = computed(() => {
  if (!bulkPriceFormData.value.product_type_id) {
    return [];
  }

  return products.value.filter((product) => {
    const matchesType = product.product_type_id === bulkPriceFormData.value.product_type_id;
    const matchesBrand = bulkPriceFormData.value.brand_id
      ? product.brand_id === bulkPriceFormData.value.brand_id
      : true;

    return matchesType && matchesBrand;
  });
});

const bulkAverageCostCents = computed(() => {
  if (filteredProductsForBulk.value.length === 0) {
    return 0;
  }

  const total = filteredProductsForBulk.value.reduce((acc, item) => acc + item.cost_price_cents, 0);
  return Math.round(total / filteredProductsForBulk.value.length);
});

const bulkCalculatedPriceCents = computed(() => {
  const margin = Number.parseFloat(bulkPriceFormData.value.margin_percentage.replace(",", "."));

  if (Number.isNaN(margin) || margin <= 0 || margin >= 100 || bulkAverageCostCents.value <= 0) {
    return 0;
  }

  return Math.round(bulkAverageCostCents.value / (1 - margin / 100));
});

const sortedProductTypesForBulk = computed(() => {
  return [...productTypes.value].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
});

const sortedBulkBrands = computed(() => {
  return [...bulkBrands.value].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
});

const weightUnitOptions: Array<{ label: string; value: WeightUnit }> = [
  { label: "Quilograma (kg)", value: "kg" },
  { label: "Grama (g)", value: "g" },
  { label: "Litro (L)", value: "L" },
  { label: "Mililitro (ml)", value: "ml" },
  { label: "Unidade (un)", value: "un" },
];

onMounted(async () => {
  await Promise.all([loadProducts(), loadProductTypes(), loadBrands()]);

  if (!isAdmin.value && activeTab.value === "prices") {
    activeTab.value = "products";
  }

  window.addEventListener("keydown", handleEscapeKey);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleEscapeKey);
});

watch(productsItemsPerPage, () => {
  productsCurrentPage.value = 1;
});

watch(productTypesItemsPerPage, () => {
  productTypesCurrentPage.value = 1;
});

watch(pricesItemsPerPage, () => {
  pricesCurrentPage.value = 1;
});

watch(
  () => bulkPriceFormData.value.product_type_id,
  async (nextProductTypeId, previousProductTypeId) => {
    if (nextProductTypeId === previousProductTypeId) {
      return;
    }

    bulkPriceFormData.value.brand_id = "";

    if (!nextProductTypeId) {
      bulkBrands.value = [];
      return;
    }

    await loadBrandsForBulkModal(nextProductTypeId);
  },
);

function handleEscapeKey(event: KeyboardEvent): void {
  if (event.key !== "Escape") {
    return;
  }

  if (showSinglePriceModal.value) {
    closeSinglePriceModal();
    return;
  }

  if (showBulkPriceModal.value) {
    closeBulkPriceModal();
    return;
  }

  if (showProductModal.value) {
    closeProductModal();
    return;
  }

  if (showStockModal.value) {
    closeStockModal();
    return;
  }

  if (showProductTypeModal.value) {
    closeProductTypeModal();
  }
}

function showSuccessToast(message: string): void {
  toast(message);
}

function formatWeight(product: Product): string {
  if (product.is_bulk) {
    return "A granel (kg)";
  }

  if (product.weight_unit === "un") {
    return "un";
  }

  if (product.weight_value === null || product.weight_unit === null) {
    return "-";
  }

  return `${product.weight_value} ${product.weight_unit}`;
}

function formatMargin(product: Product): string {
  const margin = product.profit_margin !== null ? product.profit_margin : (product.product_type?.profit_margin ?? null);
  return formatProfitMargin(margin);
}

function formatStock(quantity: number, isBulk: boolean): string {
  return formatStockQuantity(quantity, isBulk);
}

function formatProfitMargin(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return `${percentFormatter.format(value * 100)}%`;
}

function toggleProductSort(key: ProductSortKey): void {
  if (productSort.value.key !== key) {
    productSort.value = { key, direction: "asc" };
    return;
  }

  productSort.value.direction = productSort.value.direction === "asc" ? "desc" : "asc";
}

function toggleProductTypeSort(key: ProductTypeSortKey): void {
  if (productTypeSort.value.key !== key) {
    productTypeSort.value = { key, direction: "asc" };
    return;
  }

  productTypeSort.value.direction = productTypeSort.value.direction === "asc" ? "desc" : "asc";
}

function togglePriceSort(key: PriceSortKey): void {
  if (priceSort.value.key !== key) {
    priceSort.value = { key, direction: "asc" };
    return;
  }

  priceSort.value.direction = priceSort.value.direction === "asc" ? "desc" : "asc";
}

function getSortIndicator<K extends string>(sort: SortState<K>, key: K): string {
  if (sort.key !== key) {
    return "↕";
  }

  return sort.direction === "asc" ? "↑" : "↓";
}

async function loadProducts(force = false): Promise<void> {
  loadingProducts.value = true;
  productsError.value = null;

  try {
    await productStore.fetchIfStale(authenticatedFetch, force);

    if (productStore.error) {
      productsError.value = productStore.error;
      return;
    }

    products.value = productStore.products;
  } catch (error) {
    console.error("Erro ao carregar produtos:", error);
    productsError.value = "Erro de conexão ao carregar produtos.";
  } finally {
    loadingProducts.value = false;
  }
}

function reloadProducts(): void {
  void loadProducts(true);
}

async function loadProductTypes(): Promise<void> {
  loadingProductTypes.value = true;
  productTypesError.value = null;

  try {
    const response = await authenticatedFetch("/api/product-types");
    const data = await response.json();

    if (!response.ok) {
      productTypesError.value = data.message || "Não foi possível carregar os tipos de produto.";
      return;
    }

    productTypes.value = data.data as ProductType[];
  } catch (error) {
    console.error("Erro ao carregar tipos de produto:", error);
    productTypesError.value = "Erro de conexão ao carregar tipos de produto.";
  } finally {
    loadingProductTypes.value = false;
  }
}

async function loadBrands(): Promise<void> {
  loadingBrands.value = true;
  brandsError.value = null;

  try {
    const response = await authenticatedFetch("/api/brands");
    const data = await response.json();

    if (!response.ok) {
      brandsError.value = data.message || "Não foi possível carregar as marcas.";
      return;
    }

    brands.value = data.data as Brand[];
  } catch (error) {
    console.error("Erro ao carregar marcas:", error);
    brandsError.value = "Erro de conexão ao carregar marcas.";
  } finally {
    loadingBrands.value = false;
  }
}

function openCreateProductModal(): void {
  isProductEditMode.value = false;
  editingProduct.value = null;
  productFormData.value = {
    name: "",
    brand_id: "",
    description: "",
    barcode: "",
    weight_unit: "",
    weight_value: "",
    product_type_id: "",
    price_input: "",
    cost_price_input: "",
    stock_quantity: "0",
    min_stock_alert: "5",
    is_bulk: false,
  };
  productFormErrors.value = {};
  closeInlineBrandCreate();
  showProductModal.value = true;
}

function openEditProductModal(product: Product): void {
  isProductEditMode.value = true;
  editingProduct.value = product;
  productFormData.value = {
    name: product.name,
    brand_id: product.brand_id ?? "",
    description: product.description ?? "",
    barcode: product.barcode ?? "",
    weight_unit: product.is_bulk ? "kg" : (product.weight_unit as WeightUnit | null) ?? "",
    weight_value: product.weight_value !== null ? String(product.weight_value) : "",
    product_type_id: product.product_type_id ?? "",
    price_input: formatCents(product.price_cents),
    cost_price_input: formatCents(product.cost_price_cents),
    stock_quantity: String(product.stock_quantity),
    min_stock_alert: String(product.min_stock_alert),
    is_bulk: product.is_bulk,
  };
  productFormErrors.value = {};
  closeInlineBrandCreate();
  showProductModal.value = true;
}

function closeProductModal(): void {
  showProductModal.value = false;
  productFormErrors.value = {};
  loadingProductSubmit.value = false;
  closeInlineBrandCreate();
}

function scrollProductModalToTop(): void {
  if (!productModalScrollableRef.value) {
    return;
  }

  productModalScrollableRef.value.scrollTo({ top: 0, behavior: "smooth" });
}

function handlePriceInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  productFormData.value.price_input = formatCurrencyInput(target.value);
}

function handleCostPriceInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  productFormData.value.cost_price_input = formatCurrencyInput(target.value);
}

function handleBarcodeInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  productFormData.value.barcode = target.value.replace(/\D/g, "").slice(0, 13);
}

function handleWeightUnitChange(event: Event): void {
  const target = event.target as HTMLSelectElement;
  const nextUnit = target.value as WeightUnit | "";
  productFormData.value.weight_unit = nextUnit;

  if (nextUnit === "un") {
    productFormData.value.weight_value = "0";
    return;
  }

  if (productFormData.value.weight_value === "0") {
    productFormData.value.weight_value = "";
  }
}

function handleBulkFlagChange(event: Event): void {
  const target = event.target as HTMLInputElement;
  productFormData.value.is_bulk = target.checked;

  if (!target.checked) {
    return;
  }

  productFormData.value.weight_unit = "kg";
  productFormData.value.weight_value = "";
}

function handleWeightValueInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  const normalized = target.value.replace(/,/g, ".");

  if (productFormData.value.weight_unit === "un") {
    productFormData.value.weight_value = normalized.replace(/\D/g, "");
    return;
  }

  if (!/^\d*(\.\d*)?$/.test(normalized)) {
    return;
  }

  productFormData.value.weight_value = normalized;
}

function openInlineBrandCreate(): void {
  showInlineBrandCreate.value = true;
  brandFormName.value = "";
  brandFormErrors.value = {};
}

function closeInlineBrandCreate(): void {
  showInlineBrandCreate.value = false;
  loadingBrandSubmit.value = false;
  brandFormName.value = "";
  brandFormErrors.value = {};
}

async function submitInlineBrandCreate(): Promise<void> {
  brandFormErrors.value = {};

  const normalizedName = brandFormName.value.trim();

  if (!normalizedName) {
    brandFormErrors.value.name = ["Nome é obrigatório"];
    return;
  }

  loadingBrandSubmit.value = true;

  try {
    const response = await authenticatedFetch("/api/brands", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: normalizedName }),
    });
    const data = await response.json();

    if (!response.ok) {
      if (data.errors) {
        brandFormErrors.value = { ...brandFormErrors.value, ...data.errors };
      } else {
        brandFormErrors.value.submit = data.message || "Não foi possível criar a marca.";
      }
      return;
    }

    await loadBrands();
    productFormData.value.brand_id = (data.data as Brand).id;
    closeInlineBrandCreate();
  } catch (error) {
    console.error("Erro ao criar marca:", error);
    brandFormErrors.value.submit = "Erro de conexão com o servidor";
  } finally {
    loadingBrandSubmit.value = false;
  }
}

function validateProductForm(): boolean {
  productFormErrors.value = {};
  const data = productFormData.value;

  if (!data.name.trim()) {
    productFormErrors.value.name = ["Nome é obrigatório"];
  } else if (data.name.trim().length < 2 || data.name.trim().length > 100) {
    productFormErrors.value.name = ["Nome deve ter entre 2 e 100 caracteres"];
  }

  if (data.description.trim().length > 255) {
    productFormErrors.value.description = ["Descrição deve ter no máximo 255 caracteres"];
  }

  if (data.barcode && !/^(\d{8}|\d{13})$/.test(data.barcode)) {
    productFormErrors.value.barcode = ["Código de barras deve ter 8 ou 13 dígitos numéricos"];
  }

  if (data.weight_unit && data.weight_unit !== "un" && !data.weight_value) {
    if (!data.is_bulk) {
      productFormErrors.value.weight_value = ["Gramagem é obrigatória para esta unidade"];
    }
  }

  if (data.weight_value && !data.is_bulk) {
    const parsedWeight = Number.parseFloat(data.weight_value);

    if (Number.isNaN(parsedWeight)) {
      productFormErrors.value.weight_value = ["Gramagem inválida"];
    }

    if (!data.weight_unit) {
      productFormErrors.value.weight_unit = ["Selecione a unidade da gramagem"];
    }

    if (data.weight_unit === "un" && (!Number.isInteger(parsedWeight) || parsedWeight < 0)) {
      productFormErrors.value.weight_value = ["Quando unidade for 'un', use inteiro não-negativo"];
    }

    if (data.weight_unit && data.weight_unit !== "un" && parsedWeight <= 0) {
      productFormErrors.value.weight_value = ["Gramagem deve ser um número positivo"];
    }
  }

  if (canViewSalePriceField.value && !isSalePriceAutoCalculated.value) {
    const salePriceCents = parseCurrencyInputToCents(data.price_input);
    if (salePriceCents === null || salePriceCents <= 0) {
      productFormErrors.value.price_cents = ["Preço de venda deve ser maior que zero"];
    }
  }

  if (canViewCostPrice.value) {
    const costPriceCents = parseCurrencyInputToCents(data.cost_price_input);
    if (costPriceCents === null || costPriceCents < 0) {
      productFormErrors.value.cost_price_cents = ["Preço de custo deve ser não-negativo"];
    }
  }

  if (!isProductEditMode.value) {
    const initialQuantity = Number.parseFloat(String(data.stock_quantity).replace(",", "."));

    if (Number.isNaN(initialQuantity) || initialQuantity < 0) {
      productFormErrors.value.stock_quantity = ["Quantidade inicial deve ser não-negativa"];
    }

    if (!data.is_bulk && !Number.isInteger(initialQuantity)) {
      productFormErrors.value.stock_quantity = ["Para produto unitário, a quantidade inicial deve ser inteira"];
    }
  }

  const minStock = Number.parseInt(data.min_stock_alert, 10);
  if (Number.isNaN(minStock) || minStock < 0) {
    productFormErrors.value.min_stock_alert = ["Estoque mínimo deve ser inteiro não-negativo"];
  }

  return Object.keys(productFormErrors.value).length === 0;
}

async function submitProductForm(): Promise<void> {
  if (!validateProductForm()) {
    productFormErrors.value.submit = "Revise os campos destacados para continuar.";
    toast("Revise os campos destacados para continuar.", "error");
    scrollProductModalToTop();
    return;
  }

  loadingProductSubmit.value = true;
  productFormErrors.value.submit = undefined;

  const parsedSalePrice = parseCurrencyInputToCents(productFormData.value.price_input);
  const parsedCostPrice = parseCurrencyInputToCents(productFormData.value.cost_price_input);

  const payload: Record<string, unknown> = {
    name: productFormData.value.name.trim(),
    brand_id: productFormData.value.brand_id || undefined,
    barcode: productFormData.value.barcode || undefined,
    description: productFormData.value.description.trim() || undefined,
    weight_unit: productFormData.value.is_bulk ? "kg" : productFormData.value.weight_unit || undefined,
    weight_value: productFormData.value.is_bulk
      ? undefined
      : productFormData.value.weight_unit
      ? productFormData.value.weight_unit === "un"
        ? 0
        : productFormData.value.weight_value
          ? Number.parseFloat(productFormData.value.weight_value)
          : undefined
      : undefined,
    product_type_id: productFormData.value.product_type_id || undefined,
    min_stock_alert: Number.parseInt(productFormData.value.min_stock_alert, 10),
    is_bulk: productFormData.value.is_bulk,
  };

  if (canViewSalePriceField.value) {
    if (isSalePriceAutoCalculated.value && autoCalculatedSalePriceCents.value !== null) {
      payload.price_cents = autoCalculatedSalePriceCents.value;
    } else {
      payload.price_cents = parsedSalePrice ?? 0;
    }
  } else {
    payload.price_cents = isProductEditMode.value && editingProduct.value ? editingProduct.value.price_cents : 0;
  }

  if (canViewCostPrice.value) {
    payload.cost_price_cents = parsedCostPrice ?? 0;
  } else {
    payload.cost_price_cents = isProductEditMode.value && editingProduct.value
      ? editingProduct.value.cost_price_cents
      : 0;
  }

  if (!isProductEditMode.value) {
    payload.stock_quantity = Number.parseFloat(String(productFormData.value.stock_quantity).replace(",", "."));
  }

  try {
    const url = isProductEditMode.value && editingProduct.value
      ? `/api/products/${editingProduct.value.id}`
      : "/api/products";
    const method = isProductEditMode.value ? "PUT" : "POST";

    const response = await authenticatedFetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();

    if (!response.ok) {
      if (data.errors) {
        productFormErrors.value = { ...productFormErrors.value, ...data.errors };
      } else {
        productFormErrors.value.submit = data.message || "Erro ao salvar produto.";
      }

      toast(productFormErrors.value.submit || "Erro ao salvar produto.", "error");
      scrollProductModalToTop();
      return;
    }

    closeProductModal();
    productStore.invalidate();
    await loadProducts(true);
    showSuccessToast(
      isProductEditMode.value
        ? "Produto atualizado com sucesso!"
        : "Produto cadastrado com sucesso!",
    );
  } catch (error) {
    console.error("Erro ao salvar produto:", error);
    productFormErrors.value.submit = "Erro de conexão com o servidor";
    toast("Erro de conexão com o servidor", "error");
    scrollProductModalToTop();
  } finally {
    loadingProductSubmit.value = false;
  }
}

function openStockModal(): void {
  showStockModal.value = true;
  stockSearchBarcode.value = "";
  stockSearchError.value = null;
  foundStockProduct.value = null;
  stockAdditionAmount.value = "";
  stockAdditionType.value = "unit";
  stockEntryUnitCostInput.value = "";
  stockEntryDescription.value = "Entrada de estoque";
  stockSubmitError.value = null;
}

function closeStockModal(): void {
  showStockModal.value = false;
  stockSearchLoading.value = false;
  stockSubmitLoading.value = false;
  stockSearchError.value = null;
  stockSubmitError.value = null;
  stockEntryUnitCostInput.value = "";
  stockEntryDescription.value = "Entrada de estoque";
}

function handleStockSearchBarcodeInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  stockSearchBarcode.value = target.value.replace(/\D/g, "").slice(0, 13);
}

function handleStockAdditionInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  stockAdditionAmount.value = target.value.replace(/\D/g, "");
}

function handleStockEntryUnitCostInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  stockEntryUnitCostInput.value = formatCurrencyInput(target.value);
}

async function reloadProductById(productId: string): Promise<void> {
  const response = await authenticatedFetch(`/api/products/${productId}`);

  if (!response.ok) {
    throw new Error("Não foi possível recarregar o produto atualizado.");
  }

  const data = await response.json();
  const updatedProduct = data.data as Product;
  products.value = products.value.map((item) =>
    item.id === updatedProduct.id ? updatedProduct : item,
  );
  foundStockProduct.value = updatedProduct;
}

async function searchProductByBarcode(): Promise<void> {
  const barcode = stockSearchBarcode.value.trim();
  stockSearchError.value = null;
  foundStockProduct.value = null;

  if (!/^(\d{8}|\d{13})$/.test(barcode)) {
    stockSearchError.value = "Informe um código de barras válido com 8 ou 13 dígitos.";
    return;
  }

  stockSearchLoading.value = true;

  try {
    const response = await authenticatedFetch(`/api/products?barcode=${encodeURIComponent(barcode)}`);
    const data = await response.json();

    if (!response.ok) {
      stockSearchError.value = data.message || "Não foi possível buscar o produto.";
      return;
    }

    const foundProducts = data.data as Product[];

    if (foundProducts.length === 0) {
      stockSearchError.value = "Produto não encontrado.";
      return;
    }

    foundStockProduct.value = foundProducts[0] ?? null;
  } catch (error) {
    console.error("Erro ao buscar produto por código de barras:", error);
    stockSearchError.value = "Erro de conexão ao buscar produto.";
  } finally {
    stockSearchLoading.value = false;
  }
}

async function submitStockEntry(): Promise<void> {
  stockSubmitError.value = null;

  if (!foundStockProduct.value) {
    stockSubmitError.value = "Busque um produto antes de salvar.";
    return;
  }

  if (normalizedStockAddition.value <= 0) {
    stockSubmitError.value = "Informe uma quantidade válida para adicionar.";
    return;
  }

  const unitCostCents = parseCurrencyInputToCents(stockEntryUnitCostInput.value);

  if (unitCostCents === null || unitCostCents < 0) {
    stockSubmitError.value = "Informe um custo unitário válido.";
    return;
  }

  const description = stockEntryDescription.value.trim();

  if (description.length < 3) {
    stockSubmitError.value = "Informe uma descrição com ao menos 3 caracteres.";
    return;
  }

  stockSubmitLoading.value = true;

  try {
    const response = await authenticatedFetch("/api/stock-movements/adjustment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_id: foundStockProduct.value.id,
        quantity: normalizedStockAddition.value,
        unit_cost_cents: unitCostCents,
        description,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      stockSubmitError.value = data.message || "Não foi possível registrar a movimentação de estoque.";
      return;
    }

    await reloadProductById(foundStockProduct.value.id);
    closeStockModal();
    showSuccessToast("Entrada de estoque registrada com sucesso!");
  } catch (error) {
    console.error("Erro ao registrar movimentação de estoque:", error);
    stockSubmitError.value = "Erro de conexão ao registrar movimentação de estoque.";
  } finally {
    stockSubmitLoading.value = false;
  }
}

function openCreateProductTypeModal(): void {
  isProductTypeEditMode.value = false;
  editingProductTypeId.value = null;
  productTypeName.value = "";
  productTypeProfitMarginInput.value = "";
  productTypeFormErrors.value = {};
  showProductTypeModal.value = true;
}

function openEditProductTypeModal(item: ProductType): void {
  isProductTypeEditMode.value = true;
  editingProductTypeId.value = item.id;
  productTypeName.value = item.name;
  productTypeProfitMarginInput.value = item.profit_margin !== null
    ? percentFormatter.format(item.profit_margin * 100)
    : "";
  productTypeFormErrors.value = {};
  showProductTypeModal.value = true;
}

function closeProductTypeModal(): void {
  showProductTypeModal.value = false;
  loadingProductTypeSubmit.value = false;
  productTypeFormErrors.value = {};
}

function validateProductTypeForm(): boolean {
  productTypeFormErrors.value = {};
  const name = productTypeName.value.trim();

  if (!name) {
    productTypeFormErrors.value.name = ["Nome é obrigatório"];
  } else if (name.length > 50) {
    productTypeFormErrors.value.name = ["Nome deve ter no máximo 50 caracteres"];
  }

  if (productTypeProfitMarginInput.value.trim()) {
    const normalized = productTypeProfitMarginInput.value.replace(",", ".");
    const hasValidFormat = /^\d+(\.\d{1,2})?$/.test(normalized);
    const margin = Number.parseFloat(normalized);

    if (!hasValidFormat || Number.isNaN(margin) || margin < 0.01 || margin > 99.99) {
      productTypeFormErrors.value.profit_margin = ["Margem deve estar entre 0,01% e 99,99%."];
    }
  }

  return Object.keys(productTypeFormErrors.value).length === 0;
}

function handleProductTypeProfitMarginInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  const normalized = target.value.replace(/,/g, ".");

  if (!/^\d*(\.\d{0,2})?$/.test(normalized)) {
    return;
  }

  productTypeProfitMarginInput.value = normalized;
}

async function submitProductTypeForm(): Promise<void> {
  if (!validateProductTypeForm()) {
    productTypeFormErrors.value.submit = "Revise os campos destacados para continuar.";
    return;
  }

  loadingProductTypeSubmit.value = true;
  productTypeFormErrors.value.submit = undefined;

  try {
    const url = isProductTypeEditMode.value
      ? `/api/product-types/${editingProductTypeId.value}`
      : "/api/product-types";
    const method = isProductTypeEditMode.value ? "PUT" : "POST";

    const parsedMargin = productTypeProfitMarginInput.value.trim()
      ? Number.parseFloat(productTypeProfitMarginInput.value.replace(",", "."))
      : null;

    const response = await authenticatedFetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: productTypeName.value.trim(),
        profit_margin: parsedMargin,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      if (data.errors) {
        productTypeFormErrors.value = { ...productTypeFormErrors.value, ...data.errors };
      } else {
        productTypeFormErrors.value.submit = data.message || "Erro ao salvar tipo de produto.";
      }
      return;
    }

    closeProductTypeModal();
    await loadProductTypes();
    showSuccessToast(
      isProductTypeEditMode.value
        ? "Tipo de produto atualizado com sucesso!"
        : "Tipo de produto cadastrado com sucesso!",
    );
  } catch (error) {
    console.error("Erro ao salvar tipo de produto:", error);
    productTypeFormErrors.value.submit = "Erro de conexão com o servidor";
  } finally {
    loadingProductTypeSubmit.value = false;
  }
}

async function deactivateProductType(productTypeId: string): Promise<void> {
  const typeName = productTypes.value.find((t) => t.id === productTypeId)?.name ?? "este tipo";
  const ok = await confirm({
    title: "Desativar tipo de produto",
    message: `Tem certeza que deseja desativar "${typeName}"?`,
    confirmLabel: "Desativar",
  });

  if (!ok) {
    return;
  }

  try {
    const response = await authenticatedFetch(`/api/product-types/${productTypeId}`, {
      method: "DELETE",
    });
    const data = await response.json();

    if (!response.ok) {
      productTypesError.value = data.message || "Não foi possível desativar o tipo de produto.";
      return;
    }

    await loadProductTypes();
    showSuccessToast("Tipo de produto desativado com sucesso!");
  } catch (error) {
    console.error("Erro ao desativar tipo de produto:", error);
    productTypesError.value = "Erro de conexão ao desativar tipo de produto.";
  }
}

function openBulkPriceModal(): void {
  bulkPriceFormData.value = {
    product_type_id: "",
    brand_id: "",
    margin_percentage: "",
  };
  bulkPriceError.value = null;
  bulkBrands.value = [];
  showBulkPriceModal.value = true;
}

function closeBulkPriceModal(): void {
  showBulkPriceModal.value = false;
  bulkPriceLoading.value = false;
  bulkPriceError.value = null;
}

async function loadBrandsForBulkModal(productTypeId: string): Promise<void> {
  loadingBulkBrands.value = true;
  bulkPriceError.value = null;

  try {
    const response = await authenticatedFetch(`/api/brands?product_type_id=${encodeURIComponent(productTypeId)}`);
    const data = await response.json();

    if (!response.ok) {
      bulkPriceError.value = data.message || "Não foi possível carregar as marcas para o tipo selecionado.";
      bulkBrands.value = [];
      return;
    }

    bulkBrands.value = data.data as Brand[];
  } catch (error) {
    console.error("Erro ao carregar marcas por tipo:", error);
    bulkPriceError.value = "Erro de conexão ao carregar marcas.";
    bulkBrands.value = [];
  } finally {
    loadingBulkBrands.value = false;
  }
}

function handleBulkMarginInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  const normalized = target.value.replace(/,/g, ".");

  if (!/^\d*(\.\d{0,2})?$/.test(normalized)) {
    return;
  }

  if (normalized !== "" && Number.parseFloat(normalized) > 100) {
    return;
  }

  bulkPriceFormData.value.margin_percentage = normalized;
}

async function submitBulkPrice(): Promise<void> {
  bulkPriceError.value = null;

  const margin = Number.parseFloat(bulkPriceFormData.value.margin_percentage.replace(",", "."));

  if (!bulkPriceFormData.value.product_type_id) {
    bulkPriceError.value = "Tipo de produto é obrigatório.";
    return;
  }

  if (Number.isNaN(margin) || margin < 0 || margin > 100) {
    bulkPriceError.value = "Margem deve estar entre 0 e 100.";
    return;
  }

  bulkPriceLoading.value = true;

  try {
    const response = await authenticatedFetch("/api/products/bulk-price", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        product_type_id: bulkPriceFormData.value.product_type_id,
        brand_id: bulkPriceFormData.value.brand_id || undefined,
        profit_margin_percentage: Math.round(margin),
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      bulkPriceError.value = data.message || "Não foi possível atualizar os preços.";
      return;
    }

    closeBulkPriceModal();
    productStore.invalidate();
    await loadProducts(true);
    showSuccessToast(`Preços atualizados em ${(data.data?.updated_count as number) ?? 0} produtos.`);
  } catch (error) {
    console.error("Erro ao atualizar preços em lote:", error);
    bulkPriceError.value = "Erro de conexão ao atualizar preços em lote.";
  } finally {
    bulkPriceLoading.value = false;
  }
}

function openSinglePriceModal(product: Product): void {
  singlePriceProduct.value = product;
  singleCostInput.value = formatCents(product.cost_price_cents);
  singleSaleInput.value = formatCents(product.price_cents);
  singleMarginInput.value = product.profit_margin !== null
    ? String(Math.round(product.profit_margin * 100))
    : "";
  singlePriceLastEdited.value = "margin";
  singlePriceError.value = null;
  showSinglePriceModal.value = true;
}

function closeSinglePriceModal(): void {
  showSinglePriceModal.value = false;
  singlePriceLoading.value = false;
  singlePriceError.value = null;
  singlePriceProduct.value = null;
}

function recalculateSaleFromMargin(): void {
  const costCents = parseCurrencyInputToCents(singleCostInput.value);
  const margin = Number.parseFloat(singleMarginInput.value.replace(",", "."));

  if (costCents === null || Number.isNaN(margin) || margin <= 0 || margin >= 100) {
    return;
  }

  const calculated = Math.round(costCents / (1 - margin / 100));
  singleSaleInput.value = formatCents(calculated);
}

function recalculateMarginFromSale(): void {
  const costCents = parseCurrencyInputToCents(singleCostInput.value);
  const saleCents = parseCurrencyInputToCents(singleSaleInput.value);

  if (costCents === null || saleCents === null || saleCents <= 0) {
    return;
  }

  const margin = (1 - costCents / saleCents) * 100;

  if (Number.isNaN(margin)) {
    return;
  }

  const normalizedMargin = Math.max(0, Math.min(99.99, margin));
  singleMarginInput.value = normalizedMargin.toFixed(2).replace(/\.00$/, "");
}

function handleSingleCostInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  singleCostInput.value = formatCurrencyInput(target.value);

  if (singlePriceLastEdited.value === "sale") {
    recalculateMarginFromSale();
    return;
  }

  recalculateSaleFromMargin();
}

function handleSingleMarginInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  const normalized = target.value.replace(/,/g, ".");

  if (!/^\d*(\.\d{0,2})?$/.test(normalized)) {
    return;
  }

  singlePriceLastEdited.value = "margin";
  singleMarginInput.value = normalized;
  recalculateSaleFromMargin();
}

function handleSingleSaleInput(event: Event): void {
  const target = event.target as HTMLInputElement;
  singlePriceLastEdited.value = "sale";
  singleSaleInput.value = formatCurrencyInput(target.value);
  recalculateMarginFromSale();
}

async function submitSinglePrice(): Promise<void> {
  if (!singlePriceProduct.value) {
    return;
  }

  const costCents = parseCurrencyInputToCents(singleCostInput.value);
  const saleCents = parseCurrencyInputToCents(singleSaleInput.value);
  const margin = Number.parseFloat(singleMarginInput.value.replace(",", "."));

  if (costCents === null || costCents < 0) {
    singlePriceError.value = "Preço de custo inválido.";
    return;
  }

  if (saleCents === null || saleCents < 0) {
    singlePriceError.value = "Preço de venda inválido.";
    return;
  }

  if (Number.isNaN(margin) || margin < 1 || margin > 99) {
    singlePriceError.value = "Margem de lucro deve estar entre 1 e 99.";
    return;
  }

  singlePriceLoading.value = true;
  singlePriceError.value = null;

  try {
    const response = await authenticatedFetch(`/api/products/${singlePriceProduct.value.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cost_price_cents: costCents,
        price_cents: saleCents,
        profit_margin: margin / 100,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      singlePriceError.value = data.message || "Não foi possível salvar o preço.";
      return;
    }

    closeSinglePriceModal();
    productStore.invalidate();
    await loadProducts(true);
    showSuccessToast("Preço do produto atualizado com sucesso!");
  } catch (error) {
    console.error("Erro ao salvar preço individual:", error);
    singlePriceError.value = "Erro de conexão ao salvar preço.";
  } finally {
    singlePriceLoading.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-screen bg-surface">
    <AppSidebar />
    <div class="flex flex-1 flex-col">
      <AppHeader />
      <main class="flex-1 p-6">


        <div class="mt-6 -mx-3 overflow-x-auto px-3 md:mx-0 md:px-0">
          <div class="mb-6 flex min-w-max gap-1 border-b border-gray-200">
            <button
              type="button"
              class="-mb-px min-h-11 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors"
              :class="activeTab === 'products'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'"
              @click="activeTab = 'products'"
            >
              Produtos
            </button>
            <button
              v-if="canManageProductTypes"
              type="button"
              class="-mb-px min-h-11 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors"
              :class="activeTab === 'product-types'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'"
              @click="activeTab = 'product-types'"
            >
              Tipos de Produto
            </button>
            <button
              v-if="isAdmin || canManageProductTypes"
              type="button"
              class="-mb-px min-h-11 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors"
              :class="activeTab === 'prices'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'"
              @click="activeTab = 'prices'"
            >
              Preços
            </button>
          </div>
        </div>

        <section v-if="activeTab === 'products'" class="mt-6">
          <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div class="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
              <button
                type="button"
                class="min-h-11 rounded bg-primary px-4 text-sm font-medium text-white transition hover:bg-primary-dark"
                @click="openCreateProductModal"
              >
                + Novo Produto
              </button>
              <button
                type="button"
                class="min-h-11 rounded border border-primary px-4 text-sm font-medium text-primary transition hover:bg-primary/10"
                @click="openStockModal"
              >
                + Entrada de Estoque
              </button>
            </div>
          </div>

          <div v-if="loadingProducts" class="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <div v-for="index in 6" :key="index" class="h-12 animate-pulse rounded bg-gray-100"></div>
          </div>

          <div
            v-else-if="productsError"
            class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-danger"
            role="alert"
          >
            <p>{{ productsError }}</p>
            <button
              type="button"
              class="mt-3 min-h-11 inline-flex items-center justify-center rounded bg-primary px-3 py-1.5 text-white transition hover:bg-primary-dark"
              @click="reloadProducts"
            >
              Tentar novamente
            </button>
          </div>

          <div
            v-else-if="products.length === 0"
            class="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-600"
          >
            Nenhum produto cadastrado ainda.
          </div>

          <div v-else>
            <!-- Controles Superiores: Itens por Página -->
            <div
              v-if="sortedProducts.length > 0"
              class="mb-4 flex items-center justify-end gap-2 px-2 md:px-0"
            >
              <label for="productsItemsPerPage" class="text-sm text-gray-700">Itens por página:</label>
              <select
                id="productsItemsPerPage"
                v-model="productsItemsPerPage"
                class="rounded-md border border-gray-300 bg-white py-1 px-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option :value="5">5</option>
                <option :value="10">10</option>
                <option :value="20">20</option>
                <option :value="50">50</option>
              </select>
            </div>

            <div class="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white md:block">
              <table class="w-full min-w-[1180px]">
                <caption class="sr-only">Lista de produtos cadastrados</caption>
                <thead class="bg-gray-50">
                  <tr>
                    <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Código de Barras</th>
                    <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      <button type="button" class="inline-flex items-center gap-1" @click="toggleProductSort('name')">
                        Nome
                        <span>{{ getSortIndicator(productSort, 'name') }}</span>
                      </button>
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      <button type="button" class="inline-flex items-center gap-1" @click="toggleProductSort('brand')">
                        Marca
                        <span>{{ getSortIndicator(productSort, 'brand') }}</span>
                      </button>
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">Gramagem</th>
                    <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      <button type="button" class="inline-flex items-center gap-1" @click="toggleProductSort('type')">
                        Tipo
                        <span>{{ getSortIndicator(productSort, 'type') }}</span>
                      </button>
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      <button type="button" class="inline-flex items-center gap-1" @click="toggleProductSort('price')">
                        Preço
                        <span>{{ getSortIndicator(productSort, 'price') }}</span>
                      </button>
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      <button type="button" class="inline-flex items-center gap-1" @click="toggleProductSort('stock')">
                        Estoque
                        <span>{{ getSortIndicator(productSort, 'stock') }}</span>
                      </button>
                    </th>
                    <th scope="col" class="px-6 py-3 text-center text-sm font-semibold text-gray-700">Ações</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="product in paginatedProducts" :key="product.id" class="hover:bg-gray-50">
                    <td class="px-6 py-4 text-sm text-gray-700">{{ product.barcode ?? "-" }}</td>
                    <td class="px-6 py-4 text-sm text-gray-900">{{ product.name }}</td>
                    <td class="px-6 py-4 text-sm text-gray-600">{{ product.brand?.name ?? "—" }}</td>
                    <td class="px-6 py-4 text-sm text-gray-600">{{ formatWeight(product) }}</td>
                    <td class="px-6 py-4 text-sm text-gray-600">{{ product.product_type?.name ?? "-" }}</td>
                    <td class="px-6 py-4 text-sm text-gray-600">{{ formatCents(product.price_cents) }}</td>
                    <td class="px-6 py-4 text-sm">
                      <span
                        :class="[
                          'font-semibold',
                          product.stock_quantity < product.min_stock_alert ? 'text-danger' : 'text-gray-700',
                        ]"
                      >
                        {{ formatStock(product.stock_quantity, product.is_bulk) }}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-center">
                      <button
                        type="button"
                        aria-label="Editar produto"
                        class="rounded p-2 text-primary transition hover:bg-gray-100"
                        @click="openEditProductModal(product)"
                      >
                        ⚙️
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <ul class="space-y-2 md:hidden">
              <li
                v-for="product in paginatedProducts"
                :key="product.id"
                class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div class="mb-2 flex items-start justify-between gap-2">
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-base font-semibold text-gray-900">
                      {{ product.name }}
                    </p>
                    <p class="mt-0.5 text-xs text-gray-400">
                      {{ product.barcode ?? "Sem código" }}
                      {{ product.brand?.name ? `· ${product.brand.name}` : "" }}
                    </p>
                  </div>
                  <span
                    v-if="product.stock_quantity < product.min_stock_alert"
                    class="shrink-0 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger"
                  >
                    ⚠️ Baixo
                  </span>
                </div>

                <div class="mb-3 grid grid-cols-3 gap-2 text-center">
                  <div class="rounded-lg bg-surface px-2 py-1.5">
                    <p class="text-xs text-gray-400">Preço</p>
                    <p class="text-sm font-bold text-gray-800">
                      {{ formatCents(product.price_cents) }}
                    </p>
                  </div>
                  <div class="rounded-lg bg-surface px-2 py-1.5">
                    <p class="text-xs text-gray-400">Estoque</p>
                    <p
                      class="text-sm font-bold"
                      :class="product.stock_quantity < product.min_stock_alert ? 'text-danger' : 'text-gray-800'"
                    >
                      {{ formatStock(product.stock_quantity, product.is_bulk) }}
                    </p>
                  </div>
                  <div class="rounded-lg bg-surface px-2 py-1.5">
                    <p class="text-xs text-gray-400">Tipo</p>
                    <p class="truncate text-xs font-medium text-gray-700">
                      {{ product.product_type?.name ?? "—" }}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  class="min-h-11 w-full rounded-lg border border-gray-200 text-sm font-medium text-primary transition hover:bg-primary/5 active:bg-primary/10"
                  :aria-label="`Editar produto ${product.name}`"
                  @click="openEditProductModal(product)"
                >
                  ⚙️ Editar produto
                </button>
              </li>

              <li
                v-if="!sortedProducts.length"
                class="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-400"
              >
                Nenhum produto encontrado.
              </li>
            </ul>

            <!-- Controles de Paginação -->
            <div
              v-if="sortedProducts.length > 0"
              class="mt-4 flex items-center justify-center border-t border-gray-200 pt-4 sm:justify-end"
            >
              <div class="flex items-center gap-4">
                <button
                  type="button"
                  class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="productsCurrentPage === 1"
                  @click="productsCurrentPage--"
                >
                  Anterior
                </button>
                <span class="text-sm text-gray-700">
                  Página <span class="font-medium">{{ productsCurrentPage }}</span> de
                  <span class="font-medium">{{ Math.ceil(sortedProducts.length / productsItemsPerPage) || 1 }}</span>
                </span>
                <button
                  type="button"
                  class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="productsCurrentPage >= Math.ceil(sortedProducts.length / productsItemsPerPage) || sortedProducts.length === 0"
                  @click="productsCurrentPage++"
                >
                  Próximo
                </button>
              </div>
            </div>
          </div>
        </section>

        <section v-if="activeTab === 'product-types' && canManageProductTypes" class="mt-6">
          <div class="mb-4 flex items-center justify-end">
            <button
              type="button"
              class="rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark"
              @click="openCreateProductTypeModal"
            >
              + Novo Tipo
            </button>
          </div>

          <div v-if="loadingProductTypes" class="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <div v-for="index in 5" :key="index" class="h-10 animate-pulse rounded bg-gray-100"></div>
          </div>

          <div
            v-else-if="productTypesError"
            class="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-danger"
            role="alert"
          >
            <p>{{ productTypesError }}</p>
            <button
              type="button"
              class="mt-3 min-h-11 inline-flex items-center justify-center rounded bg-primary px-3 py-1.5 text-white transition hover:bg-primary-dark"
              @click="loadProductTypes"
            >
              Tentar novamente
            </button>
          </div>

          <div
            v-else-if="productTypes.length === 0"
            class="rounded-lg border border-gray-200 bg-white p-6 text-center text-gray-600"
          >
            Nenhum tipo de produto cadastrado ainda.
          </div>

          <div v-else>
            <!-- Controles Superiores: Itens por Página -->
            <div
              v-if="sortedProductTypes.length > 0"
              class="mb-4 flex items-center justify-end gap-2 px-2 md:px-0"
            >
              <label for="productTypesItemsPerPage" class="text-sm text-gray-700">Itens por página:</label>
              <select
                id="productTypesItemsPerPage"
                v-model="productTypesItemsPerPage"
                class="rounded-md border border-gray-300 bg-white py-1 px-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option :value="5">5</option>
                <option :value="10">10</option>
                <option :value="20">20</option>
                <option :value="50">50</option>
              </select>
            </div>

            <div class="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white md:block">
              <table class="w-full min-w-[640px]">
                <caption class="sr-only">Lista de tipos de produto cadastrados</caption>
                <thead class="bg-gray-50">
                  <tr>
                    <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      <button type="button" class="inline-flex items-center gap-1" @click="toggleProductTypeSort('name')">
                        Nome
                        <span>{{ getSortIndicator(productTypeSort, 'name') }}</span>
                      </button>
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      <button
                        type="button"
                        class="inline-flex items-center gap-1"
                        @click="toggleProductTypeSort('profit_margin')"
                      >
                        Margem %
                        <span>{{ getSortIndicator(productTypeSort, 'profit_margin') }}</span>
                      </button>
                    </th>
                    <th scope="col" class="px-6 py-3 text-center text-sm font-semibold text-gray-700">Ações</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="item in paginatedProductTypes" :key="item.id" class="hover:bg-gray-50">
                    <td class="px-6 py-4 text-sm text-gray-900">{{ item.name }}</td>
                    <td class="px-6 py-4 text-sm text-gray-700">{{ formatProfitMargin(item.profit_margin) }}</td>
                    <td class="px-6 py-4">
                      <div class="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          aria-label="Editar tipo"
                          class="rounded p-2 text-primary transition hover:bg-gray-100"
                          @click="openEditProductTypeModal(item)"
                        >
                          ✏️
                        </button>
                        <button
                          type="button"
                          aria-label="Desativar tipo"
                          class="rounded p-2 text-danger transition hover:bg-red-50"
                          @click="deactivateProductType(item.id)"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <ul class="space-y-2 md:hidden">
              <li
                v-for="item in paginatedProductTypes"
                :key="item.id"
                class="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
              >
                <div>
                  <p class="text-sm font-semibold text-gray-900">{{ item.name }}</p>
                  <p class="mt-0.5 text-xs text-gray-400">
                    Margem:
                    <span class="font-medium text-gray-700">
                      {{ formatProfitMargin(item.profit_margin) }}
                    </span>
                  </p>
                </div>

                <div class="flex gap-2">
                  <button
                    type="button"
                    class="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-gray-200 text-primary transition hover:bg-primary/5"
                    :aria-label="`Editar tipo ${item.name}`"
                    @click="openEditProductTypeModal(item)"
                  >
                    ✏️
                  </button>
                  <button
                    type="button"
                    class="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-red-100 text-danger transition hover:bg-danger/5"
                    :aria-label="`Desativar tipo ${item.name}`"
                    @click="deactivateProductType(item.id)"
                  >
                    🗑️
                  </button>
                </div>
              </li>
            </ul>

            <!-- Controles de Paginação -->
            <div
              v-if="sortedProductTypes.length > 0"
              class="mt-4 flex items-center justify-center border-t border-gray-200 pt-4 sm:justify-end"
            >
              <div class="flex items-center gap-4">
                <button
                  type="button"
                  class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="productTypesCurrentPage === 1"
                  @click="productTypesCurrentPage--"
                >
                  Anterior
                </button>
                <span class="text-sm text-gray-700">
                  Página <span class="font-medium">{{ productTypesCurrentPage }}</span> de
                  <span class="font-medium">{{ Math.ceil(sortedProductTypes.length / productTypesItemsPerPage) || 1 }}</span>
                </span>
                <button
                  type="button"
                  class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="productTypesCurrentPage >= Math.ceil(sortedProductTypes.length / productTypesItemsPerPage) || sortedProductTypes.length === 0"
                  @click="productTypesCurrentPage++"
                >
                  Próximo
                </button>
              </div>
            </div>
          </div>
        </section>

        <section v-if="activeTab === 'prices' && (isAdmin || canManageProductTypes)" class="mt-6">
          <div class="mb-4 flex justify-end">
            <button
              type="button"
              class="rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark"
              @click="openBulkPriceModal"
            >
              Definir Margem de Lucro
            </button>
          </div>

          <div v-if="loadingProducts" class="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
            <div v-for="index in 6" :key="index" class="h-12 animate-pulse rounded bg-gray-100"></div>
          </div>

          <div v-else>
            <!-- Controles Superiores: Itens por Página -->
            <div
              v-if="sortedProductsForPrices.length > 0"
              class="mb-4 flex items-center justify-end gap-2 px-2 md:px-0"
            >
              <label for="pricesItemsPerPage" class="text-sm text-gray-700">Itens por página:</label>
              <select
                id="pricesItemsPerPage"
                v-model="pricesItemsPerPage"
                class="rounded-md border border-gray-300 bg-white py-1 px-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option :value="5">5</option>
                <option :value="10">10</option>
                <option :value="20">20</option>
                <option :value="50">50</option>
              </select>
            </div>

            <div class="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white md:block">
              <table class="w-full min-w-[1120px]">
                <caption class="sr-only">Tabela de precos e margens dos produtos</caption>
                <thead class="bg-gray-50">
                  <tr>
                    <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      <button type="button" class="inline-flex items-center gap-1" @click="togglePriceSort('name')">
                        Nome
                        <span>{{ getSortIndicator(priceSort, 'name') }}</span>
                      </button>
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      <button type="button" class="inline-flex items-center gap-1" @click="togglePriceSort('type')">
                        Tipo
                        <span>{{ getSortIndicator(priceSort, 'type') }}</span>
                      </button>
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      <button type="button" class="inline-flex items-center gap-1" @click="togglePriceSort('brand')">
                        Marca
                        <span>{{ getSortIndicator(priceSort, 'brand') }}</span>
                      </button>
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      <button type="button" class="inline-flex items-center gap-1" @click="togglePriceSort('cost')">
                        Custo
                        <span>{{ getSortIndicator(priceSort, 'cost') }}</span>
                      </button>
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      <button type="button" class="inline-flex items-center gap-1" @click="togglePriceSort('margin')">
                        Margem %
                        <span>{{ getSortIndicator(priceSort, 'margin') }}</span>
                      </button>
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      <button type="button" class="inline-flex items-center gap-1" @click="togglePriceSort('sale')">
                        Preço de Venda
                        <span>{{ getSortIndicator(priceSort, 'sale') }}</span>
                      </button>
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-sm font-semibold text-gray-700">
                      <button type="button" class="inline-flex items-center gap-1" @click="togglePriceSort('stock')">
                        Estoque
                        <span>{{ getSortIndicator(priceSort, 'stock') }}</span>
                      </button>
                    </th>
                    <th scope="col" class="px-6 py-3 text-center text-sm font-semibold text-gray-700">Ações</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="product in paginatedProductsForPrices" :key="product.id" class="hover:bg-gray-50">
                    <td class="px-6 py-4 text-sm text-gray-700">{{ product.name }}</td>
                    <td class="px-6 py-4 text-sm text-gray-700">{{ product.product_type?.name ?? "-" }}</td>
                    <td class="px-6 py-4 text-sm text-gray-700">{{ product.brand?.name ?? "—" }}</td>
                    <td class="px-6 py-4 text-sm text-gray-700">{{ formatCents(product.cost_price_cents) }}</td>
                    <td class="px-6 py-4 text-sm text-gray-700">{{ formatMargin(product) }}</td>
                    <td class="px-6 py-4 text-sm text-gray-700">{{ formatCents(product.price_cents) }}</td>
                    <td class="px-6 py-4 text-sm">
                      <span
                        :class="[
                          'font-semibold',
                          product.stock_quantity < product.min_stock_alert ? 'text-danger' : 'text-gray-700',
                        ]"
                      >
                        {{ formatStock(product.stock_quantity, product.is_bulk) }}
                      </span>
                    </td>
                    <td class="px-6 py-4 text-center">
                      <button
                        type="button"
                        aria-label="Editar preço"
                        class="rounded p-2 text-primary transition hover:bg-gray-100"
                        @click="openSinglePriceModal(product)"
                      >
                        ⚙️
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <ul class="space-y-2 md:hidden">
              <li
                v-for="product in paginatedProductsForPrices"
                :key="product.id"
                class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div class="mb-3 flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-gray-900">{{ product.name }}</p>
                    <p class="truncate text-xs text-gray-400">{{ product.product_type?.name ?? "—" }}</p>
                  </div>
                  <span class="shrink-0 text-xs text-gray-400">
                    {{ formatStock(product.stock_quantity, product.is_bulk) }}
                  </span>
                </div>

                <div class="grid grid-cols-3 gap-2 text-center">
                  <div class="rounded-lg bg-surface px-2 py-1.5">
                    <p class="text-xs text-gray-400">Custo</p>
                    <p class="text-sm font-bold text-gray-800">
                      {{ formatCents(product.cost_price_cents) }}
                    </p>
                  </div>
                  <div class="rounded-lg bg-surface px-2 py-1.5">
                    <p class="text-xs text-gray-400">Margem</p>
                    <p class="text-sm font-bold text-primary">
                      {{ formatMargin(product) }}
                    </p>
                  </div>
                  <div class="rounded-lg bg-surface px-2 py-1.5">
                    <p class="text-xs text-gray-400">Venda</p>
                    <p class="text-sm font-bold text-success">
                      {{ formatCents(product.price_cents) }}
                    </p>
                  </div>
                </div>
              </li>
            </ul>

            <!-- Controles de Paginação -->
            <div
              v-if="sortedProductsForPrices.length > 0"
              class="mt-4 flex items-center justify-center border-t border-gray-200 pt-4 sm:justify-end"
            >
              <div class="flex items-center gap-4">
                <button
                  type="button"
                  class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="pricesCurrentPage === 1"
                  @click="pricesCurrentPage--"
                >
                  Anterior
                </button>
                <span class="text-sm text-gray-700">
                  Página <span class="font-medium">{{ pricesCurrentPage }}</span> de
                  <span class="font-medium">{{ Math.ceil(sortedProductsForPrices.length / pricesItemsPerPage) || 1 }}</span>
                </span>
                <button
                  type="button"
                  class="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="pricesCurrentPage >= Math.ceil(sortedProductsForPrices.length / pricesItemsPerPage) || sortedProductsForPrices.length === 0"
                  @click="pricesCurrentPage++"
                >
                  Próximo
                </button>
              </div>
            </div>
          </div>
        </section>

        <div
          v-if="showProductModal"
          class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-form-modal-title"
        >
          <div class="absolute inset-0 bg-black/50" @click="closeProductModal" />
          <div
            ref="productModalScrollableRef"
            class="relative z-10 w-full max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-w-2xl sm:rounded-2xl"
          >
            <div class="mx-auto mt-3 h-1 w-12 rounded-full bg-gray-200 sm:hidden" />
            <div class="p-4 sm:p-6">
            <div class="mb-4 flex items-center justify-between">
              <h2 id="product-form-modal-title" class="text-xl font-bold text-gray-900">
                {{ isProductEditMode ? "Editar Produto" : "Novo Produto" }}
              </h2>
              <button
                type="button"
                class="rounded-lg p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fechar modal"
                @click="closeProductModal"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div
              v-if="productFormErrors.submit"
              class="mb-4 rounded bg-red-100 p-3 text-sm text-danger"
              role="alert"
            >
              {{ productFormErrors.submit }}
            </div>

            <form
              id="product-form"
              class="grid grid-cols-1 gap-4 md:grid-cols-2"
              novalidate
              @submit.prevent="submitProductForm"
            >
              <div class="md:col-span-2">
                <label for="product_name" class="mb-1 block text-sm font-medium text-gray-700">Nome *</label>
                <input
                  id="product_name"
                  v-model="productFormData.name"
                  type="text"
                  autofocus
                  maxlength="100"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p v-if="productFormErrors.name" class="mt-1 text-xs text-danger">{{ productFormErrors.name[0] }}</p>
              </div>

              <div>
                <label for="product_brand" class="mb-1 block text-sm font-medium text-gray-700">Marca</label>
                <div class="flex gap-2">
                  <select
                    id="product_brand"
                    v-model="productFormData.brand_id"
                    class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">Sem marca</option>
                    <option v-for="item in brands" :key="item.id" :value="item.id">
                      {{ item.name }}
                    </option>
                  </select>
                  <button
                    type="button"
                    aria-label="Cadastrar nova marca"
                    class="rounded border border-primary px-3 py-2 text-sm font-semibold text-primary transition hover:bg-primary/10"
                    @click="openInlineBrandCreate"
                  >
                    +
                  </button>
                </div>
                <p v-if="brandsError" class="mt-1 text-xs text-danger">{{ brandsError }}</p>
                <p v-if="productFormErrors.brand_id" class="mt-1 text-xs text-danger">{{ productFormErrors.brand_id[0] }}</p>

                <div v-if="showInlineBrandCreate" class="mt-2 rounded border border-gray-200 bg-surface p-3">
                  <label for="inline_brand_name" class="mb-1 block text-xs font-medium text-gray-700">Nova Marca</label>
                  <input
                    id="inline_brand_name"
                    v-model="brandFormName"
                    type="text"
                    maxlength="100"
                    class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <p v-if="brandFormErrors.name" class="mt-1 text-xs text-danger">{{ brandFormErrors.name[0] }}</p>
                  <p v-if="brandFormErrors.submit" class="mt-1 text-xs text-danger">{{ brandFormErrors.submit }}</p>
                  <div class="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      class="min-h-11 inline-flex items-center justify-center rounded border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                      @click="closeInlineBrandCreate"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      :disabled="loadingBrandSubmit"
                      class="min-h-11 inline-flex items-center justify-center rounded bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                      @click="submitInlineBrandCreate"
                    >
                      {{ loadingBrandSubmit ? "Salvando..." : "Salvar" }}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label for="product_barcode" class="mb-1 block text-sm font-medium text-gray-700">Código de Barras</label>
                <input
                  id="product_barcode"
                  :value="productFormData.barcode"
                  type="text"
                  inputmode="numeric"
                  maxlength="13"
                  placeholder="EAN-8 ou EAN-13"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  @input="handleBarcodeInput"
                />
                <p v-if="productFormErrors.barcode" class="mt-1 text-xs text-danger">{{ productFormErrors.barcode[0] }}</p>
              </div>

              <div class="md:col-span-2">
                <label for="product_description" class="mb-1 block text-sm font-medium text-gray-700">Descrição</label>
                <textarea
                  id="product_description"
                  v-model="productFormData.description"
                  maxlength="255"
                  rows="2"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                ></textarea>
                <p v-if="productFormErrors.description" class="mt-1 text-xs text-danger">{{ productFormErrors.description[0] }}</p>
              </div>

              <div>
                <label for="product_weight_unit" class="mb-1 block text-sm font-medium text-gray-700">Unidade de Gramagem</label>
                <select
                  id="product_weight_unit"
                  :value="productFormData.weight_unit"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  @change="handleWeightUnitChange"
                >
                  <option value="">Selecione</option>
                  <option v-for="item in weightUnitOptions" :key="item.value" :value="item.value">
                    {{ item.label }}
                  </option>
                </select>
                <p v-if="productFormErrors.weight_unit" class="mt-1 text-xs text-danger">{{ productFormErrors.weight_unit[0] }}</p>
              </div>

              <div>
                <label for="product_weight_value" class="mb-1 block text-sm font-medium text-gray-700">Gramagem</label>
                <input
                  id="product_weight_value"
                  :value="productFormData.weight_value"
                  type="text"
                  inputmode="decimal"
                  placeholder="Ex.: 500 ou 1.5"
                  :disabled="productFormData.weight_unit === 'un' || productFormData.is_bulk"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-gray-100"
                  @input="handleWeightValueInput"
                />
                <p v-if="productFormErrors.weight_value" class="mt-1 text-xs text-danger">{{ productFormErrors.weight_value[0] }}</p>
              </div>

              <div class="md:col-span-2 rounded border border-gray-200 bg-surface px-4 py-3">
                <label class="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    :checked="productFormData.is_bulk"
                    class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    @change="handleBulkFlagChange"
                  />
                  Produto a Granel
                </label>
                <p class="mt-1 text-xs text-gray-600">
                  Marque se este produto é vendido por peso (ex.: carnes, queijos, frios).
                </p>
              </div>

              <div>
                <label for="product_type" class="mb-1 block text-sm font-medium text-gray-700">Tipo de Produto</label>
                <select
                  id="product_type"
                  v-model="productFormData.product_type_id"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Sem tipo</option>
                  <option v-for="item in productTypes" :key="item.id" :value="item.id">
                    {{ item.name }}
                  </option>
                </select>
              </div>

              <div v-if="canViewSalePriceField">
                <label for="product_price" class="mb-1 block text-sm font-medium text-gray-700">Preço de Venda</label>
                <input
                  id="product_price"
                  :value="displayedSalePriceInput"
                  type="text"
                  inputmode="numeric"
                  placeholder="R$ 0,00"
                  :readonly="isSalePriceAutoCalculated"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 read-only:cursor-not-allowed read-only:bg-gray-100"
                  @input="handlePriceInput"
                />
                <p v-if="isSalePriceAutoCalculated" class="mt-1 text-xs text-gray-600">
                  Valor calculado automaticamente pela margem do tipo selecionado.
                </p>
                <p v-if="productFormErrors.price_cents" class="mt-1 text-xs text-danger">{{ productFormErrors.price_cents[0] }}</p>
              </div>

              <div v-if="canViewCostPrice">
                <label for="product_cost_price" class="mb-1 block text-sm font-medium text-gray-700">Preço de Custo *</label>
                <input
                  id="product_cost_price"
                  :value="productFormData.cost_price_input"
                  type="text"
                  inputmode="numeric"
                  placeholder="R$ 0,00"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  @input="handleCostPriceInput"
                />
                <p v-if="productFormErrors.cost_price_cents" class="mt-1 text-xs text-danger">{{ productFormErrors.cost_price_cents[0] }}</p>
              </div>

              <div>
                <label for="product_stock" class="mb-1 block text-sm font-medium text-gray-700">Quantidade Inicial *</label>
                <input
                  id="product_stock"
                  v-model="productFormData.stock_quantity"
                  type="number"
                  min="0"
                  inputmode="numeric"
                  :disabled="isProductEditMode"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-gray-100"
                />
                <p v-if="productFormErrors.stock_quantity" class="mt-1 text-xs text-danger">{{ productFormErrors.stock_quantity[0] }}</p>
              </div>

              <div>
                <label for="product_min_stock" class="mb-1 block text-sm font-medium text-gray-700">Estoque Mínimo *</label>
                <input
                  id="product_min_stock"
                  v-model="productFormData.min_stock_alert"
                  type="number"
                  min="0"
                  inputmode="numeric"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p v-if="productFormErrors.min_stock_alert" class="mt-1 text-xs text-danger">{{ productFormErrors.min_stock_alert[0] }}</p>
              </div>

              <div class="md:col-span-2 flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  class="rounded border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
                  @click="closeProductModal"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  :disabled="loadingProductSubmit"
                  class="flex items-center gap-2 rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                  @click="submitProductForm"
                >
                  <svg
                    v-if="loadingProductSubmit"
                    class="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  <span>{{ loadingProductSubmit ? "Salvando..." : "Salvar" }}</span>
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>

        <div
          v-if="showStockModal"
          class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-stock-modal-title"
        >
          <div class="absolute inset-0 bg-black/50" @click="closeStockModal" />
          <div class="relative z-10 w-full max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-w-xl sm:rounded-2xl">
            <div class="mx-auto mt-3 h-1 w-12 rounded-full bg-gray-200 sm:hidden" />
            <div class="p-4 sm:p-6">
            <div class="mb-4 flex items-center justify-between">
              <h2 id="product-stock-modal-title" class="text-xl font-bold text-gray-900">Entrada de Estoque</h2>
              <button
                type="button"
                class="rounded-lg p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fechar popup"
                @click="closeStockModal"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="space-y-4">
              <div>
                <label for="stock_barcode" class="mb-1 block text-sm font-medium text-gray-700">
                  Código de Barras
                </label>
                <div class="flex gap-2">
                  <div class="relative flex-1">
                    <input
                      id="stock_barcode"
                      :value="stockSearchBarcode"
                      type="text"
                      autofocus
                      maxlength="13"
                      inputmode="numeric"
                      placeholder="Digite ou escaneie"
                      class="w-full rounded border border-gray-300 px-3 py-2 pr-9 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      @input="handleStockSearchBarcodeInput"
                      @keyup.enter="searchProductByBarcode"
                    />
                    <svg
                      v-if="stockSearchLoading"
                      class="absolute right-3 top-2.5 h-4 w-4 animate-spin text-primary"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                  </div>
                  <button
                    type="button"
                    :disabled="stockSearchLoading"
                    class="rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                    @click="searchProductByBarcode"
                  >
                    Buscar
                  </button>
                </div>
                <p v-if="stockSearchError" class="mt-1 text-xs text-danger">{{ stockSearchError }}</p>
              </div>

              <div v-if="foundStockProduct" class="rounded-lg border border-gray-200 bg-surface p-4">
                <dl class="grid grid-cols-1 gap-2 text-sm md:grid-cols-2">
                  <div>
                    <dt class="text-gray-500">Código de barras</dt>
                    <dd class="font-medium text-gray-900">{{ foundStockProduct.barcode }}</dd>
                  </div>
                  <div>
                    <dt class="text-gray-500">Nome</dt>
                    <dd class="font-medium text-gray-900">{{ foundStockProduct.name }}</dd>
                  </div>
                  <div>
                    <dt class="text-gray-500">Quantidade atual</dt>
                    <dd class="font-medium text-gray-900">{{ foundStockProduct.stock_quantity }}</dd>
                  </div>
                </dl>

                <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
                  <div>
                    <label for="stock_add_amount" class="mb-1 block text-sm font-medium text-gray-700">Adicionar</label>
                    <input
                      id="stock_add_amount"
                      :value="stockAdditionAmount"
                      type="text"
                      inputmode="numeric"
                      class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      @input="handleStockAdditionInput"
                    />
                  </div>
                  <div>
                    <label for="stock_add_type" class="mb-1 block text-sm font-medium text-gray-700">Tipo</label>
                    <select
                      id="stock_add_type"
                      v-model="stockAdditionType"
                      class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="unit">Unidade</option>
                      <option value="kg">kg</option>
                    </select>
                  </div>
                </div>

                <div class="mt-3 grid grid-cols-1 gap-3">
                  <div>
                    <label for="stock_entry_unit_cost" class="mb-1 block text-sm font-medium text-gray-700">
                      Custo unitário da entrada
                    </label>
                    <input
                      id="stock_entry_unit_cost"
                      :value="stockEntryUnitCostInput"
                      type="text"
                      inputmode="numeric"
                      placeholder="R$ 0,00"
                      class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      @input="handleStockEntryUnitCostInput"
                    />
                  </div>

                  <div>
                    <label for="stock_entry_description" class="mb-1 block text-sm font-medium text-gray-700">
                      Descrição da movimentação
                    </label>
                    <input
                      id="stock_entry_description"
                      v-model="stockEntryDescription"
                      type="text"
                      maxlength="255"
                      class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <p class="mt-3 text-sm text-gray-700">
                  Quantidade atualizada:
                  <span class="font-semibold text-primary">{{ updatedStockQuantity }}</span>
                </p>
              </div>

              <div v-if="stockSubmitError" class="rounded bg-red-100 p-3 text-sm text-danger" role="alert">
                {{ stockSubmitError }}
              </div>

              <div class="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  class="rounded border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
                  @click="closeStockModal"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  :disabled="stockSubmitLoading"
                  class="flex items-center gap-2 rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                  @click="submitStockEntry"
                >
                  <svg
                    v-if="stockSubmitLoading"
                    class="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  <span>{{ stockSubmitLoading ? "Salvando..." : "Salvar" }}</span>
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>

        <div
          v-if="showProductTypeModal"
          class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-type-modal-title"
        >
          <div class="absolute inset-0 bg-black/50" @click="closeProductTypeModal" />
          <div class="relative z-10 w-full max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl">
            <div class="mx-auto mt-3 h-1 w-12 rounded-full bg-gray-200 sm:hidden" />
            <div class="p-4 sm:p-6">
            <div class="mb-4 flex items-center justify-between">
              <h2 id="product-type-modal-title" class="text-xl font-bold text-gray-900">
                {{ isProductTypeEditMode ? "Editar Tipo de Produto" : "Novo Tipo de Produto" }}
              </h2>
              <button
                type="button"
                class="rounded-lg p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fechar modal"
                @click="closeProductTypeModal"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div
              v-if="productTypeFormErrors.submit"
              class="mb-4 rounded bg-red-100 p-3 text-sm text-danger"
              role="alert"
            >
              {{ productTypeFormErrors.submit }}
            </div>

            <form class="space-y-4" novalidate @submit.prevent="submitProductTypeForm">
              <div>
                <label for="product_type_name" class="mb-1 block text-sm font-medium text-gray-700">Nome *</label>
                <input
                  id="product_type_name"
                  v-model="productTypeName"
                  type="text"
                  autofocus
                  maxlength="50"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <p v-if="productTypeFormErrors.name" class="mt-1 text-xs text-danger">{{ productTypeFormErrors.name[0] }}</p>
              </div>

              <div>
                <label for="product_type_profit_margin" class="mb-1 block text-sm font-medium text-gray-700">
                  Margem de Lucro (%)
                </label>
                <input
                  id="product_type_profit_margin"
                  :value="productTypeProfitMarginInput"
                  type="text"
                  inputmode="decimal"
                  placeholder="Ex.: 35 ou 10,50"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  @input="handleProductTypeProfitMarginInput"
                />
                <p v-if="productTypeFormErrors.profit_margin" class="mt-1 text-xs text-danger">
                  {{ productTypeFormErrors.profit_margin[0] }}
                </p>
              </div>

              <div class="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  class="rounded border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
                  @click="closeProductTypeModal"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  :disabled="loadingProductTypeSubmit"
                  class="flex items-center gap-2 rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg
                    v-if="loadingProductTypeSubmit"
                    class="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  <span>{{ loadingProductTypeSubmit ? "Salvando..." : "Salvar" }}</span>
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>

        <div
          v-if="showBulkPriceModal"
          class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-bulk-price-modal-title"
        >
          <div class="absolute inset-0 bg-black/50" @click="closeBulkPriceModal" />
          <div class="relative z-10 w-full max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-w-xl sm:rounded-2xl">
            <div class="mx-auto mt-3 h-1 w-12 rounded-full bg-gray-200 sm:hidden" />
            <div class="p-4 sm:p-6">
            <div class="mb-4 flex items-center justify-between">
              <h2 id="product-bulk-price-modal-title" class="text-xl font-bold text-gray-900">Definir Margem de Lucro</h2>
              <button
                type="button"
                class="rounded-lg p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fechar modal"
                @click="closeBulkPriceModal"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="space-y-4">
              <div>
                <label for="bulk_product_type" class="mb-1 block text-sm font-medium text-gray-700">Tipo de Produto *</label>
                <select
                  id="bulk_product_type"
                  v-model="bulkPriceFormData.product_type_id"
                  autofocus
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Selecione</option>
                  <option v-for="item in sortedProductTypesForBulk" :key="item.id" :value="item.id">
                    {{ item.name }}
                  </option>
                </select>
              </div>

              <div>
                <label for="bulk_brand" class="mb-1 block text-sm font-medium text-gray-700">Marca</label>
                <select
                  id="bulk_brand"
                  v-model="bulkPriceFormData.brand_id"
                  :disabled="!bulkPriceFormData.product_type_id || loadingBulkBrands"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option v-if="!bulkPriceFormData.product_type_id" value="">Selecione um tipo primeiro</option>
                  <option v-else value="">Todas</option>
                  <option v-for="item in sortedBulkBrands" :key="item.id" :value="item.id">
                    {{ item.name }}
                  </option>
                </select>
              </div>

              <div>
                <label class="mb-1 block text-sm font-medium text-gray-700">Custo Médio</label>
                <input
                  :value="formatCents(bulkAverageCostCents)"
                  type="text"
                  readonly
                  class="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
                />
              </div>

              <div>
                <label for="bulk_margin" class="mb-1 block text-sm font-medium text-gray-700">Margem de Lucro (%) *</label>
                <input
                  id="bulk_margin"
                  :value="bulkPriceFormData.margin_percentage"
                  type="text"
                  inputmode="decimal"
                  placeholder="Ex.: 30"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  @input="handleBulkMarginInput"
                />
              </div>

              <div>
                <label class="mb-1 block text-sm font-medium text-gray-700">Preço de Venda calculado</label>
                <input
                  :value="formatCents(bulkCalculatedPriceCents)"
                  type="text"
                  readonly
                  class="w-full rounded border border-gray-200 bg-gray-50 px-3 py-2 text-gray-700"
                />
              </div>

              <div v-if="bulkPriceError" class="rounded bg-red-100 p-3 text-sm text-danger" role="alert">
                {{ bulkPriceError }}
              </div>

              <div class="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  class="rounded border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
                  @click="closeBulkPriceModal"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  :disabled="bulkPriceLoading"
                  class="flex items-center gap-2 rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                  @click="submitBulkPrice"
                >
                  <svg
                    v-if="bulkPriceLoading"
                    class="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  <span>{{ bulkPriceLoading ? "Aplicando..." : "Aplicar" }}</span>
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>

        <div
          v-if="showSinglePriceModal"
          class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-single-price-modal-title"
        >
          <div class="absolute inset-0 bg-black/50" @click="closeSinglePriceModal" />
          <div class="relative z-10 w-full max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl">
            <div class="mx-auto mt-3 h-1 w-12 rounded-full bg-gray-200 sm:hidden" />
            <div class="p-4 sm:p-6">
            <div class="mb-4 flex items-center justify-between">
              <h2 id="product-single-price-modal-title" class="text-xl font-bold text-gray-900">Editar Preço</h2>
              <button
                type="button"
                class="rounded-lg p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-600"
                aria-label="Fechar modal"
                @click="closeSinglePriceModal"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="space-y-4">
              <div>
                <label for="single_cost" class="mb-1 block text-sm font-medium text-gray-700">Preço de Custo</label>
                <input
                  id="single_cost"
                  :value="singleCostInput"
                  type="text"
                  inputmode="numeric"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  @input="handleSingleCostInput"
                />
              </div>

              <div>
                <label for="single_margin" class="mb-1 block text-sm font-medium text-gray-700">Margem de Lucro (%)</label>
                <input
                  id="single_margin"
                  :value="singleMarginInput"
                  type="text"
                  inputmode="decimal"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  @input="handleSingleMarginInput"
                />
              </div>

              <div>
                <label for="single_sale" class="mb-1 block text-sm font-medium text-gray-700">Preço de Venda</label>
                <input
                  id="single_sale"
                  :value="singleSaleInput"
                  type="text"
                  inputmode="numeric"
                  class="w-full rounded border border-gray-300 px-3 py-2 text-base md:text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  @input="handleSingleSaleInput"
                />
              </div>

              <div v-if="singlePriceError" class="rounded bg-red-100 p-3 text-sm text-danger" role="alert">
                {{ singlePriceError }}
              </div>

              <div class="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  class="rounded border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
                  @click="closeSinglePriceModal"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  :disabled="singlePriceLoading"
                  class="flex items-center gap-2 rounded bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
                  @click="submitSinglePrice"
                >
                  <svg
                    v-if="singlePriceLoading"
                    class="h-4 w-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  <span>{{ singlePriceLoading ? "Salvando..." : "Salvar" }}</span>
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>

        <div
          v-if="showToast"
          :role="toastType === 'error' ? 'alert' : 'status'"
          :aria-live="toastType === 'error' ? 'assertive' : 'polite'"
          aria-atomic="true"
          :class="[
            'fixed bottom-4 right-4 z-50 rounded-lg px-6 py-3 text-white shadow-lg',
            toastType === 'error' ? 'bg-danger' : toastType === 'warning' ? 'bg-warning' : 'bg-success',
          ]"
        >
          {{ toastMessage }}
        </div>
      </main>
    </div>
  </div>

  <ConfirmDialog
    :open="showConfirm"
    :title="confirmTitle"
    :message="confirmMessage"
    :confirm-label="confirmLabel"
    @confirm="onConfirm"
    @cancel="onCancel"
  />
</template>
