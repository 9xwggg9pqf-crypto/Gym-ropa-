// Productos destacados. Añade, edita o elimina objetos de esta lista.
// La imagen es solo un marcador de posición hasta que subas fotos reales.

export type Product = {
  name: string;
  category: string;
  price: string;
  tag?: "NUEVO" | "MÁS VENDIDO" | "LIMITADO";
};

export const products: Product[] = [
  {
    name: "Camiseta Performance",
    category: "Camisetas",
    price: "29,90 €",
    tag: "MÁS VENDIDO",
  },
  {
    name: "Sudadera Oversize Pro",
    category: "Sudaderas",
    price: "54,90 €",
    tag: "NUEVO",
  },
  {
    name: "Jogger Técnico",
    category: "Pantalones",
    price: "49,90 €",
  },
  {
    name: "Top Compresión",
    category: "Camisetas",
    price: "27,90 €",
  },
  {
    name: "Chaqueta Cortavientos",
    category: "Outerwear",
    price: "69,90 €",
    tag: "LIMITADO",
  },
  {
    name: "Gorra Pro Play",
    category: "Accesorios",
    price: "19,90 €",
  },
];
