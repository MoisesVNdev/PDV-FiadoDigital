export type ProductType = {
  id: string;
  name: string;
  profit_margin: number | null;
  created_at: string;
  updated_at: string;
};

export type CreateProductTypePayload = {
  name: string;
  profit_margin?: number | null;
};

export type UpdateProductTypePayload = Partial<CreateProductTypePayload>;
