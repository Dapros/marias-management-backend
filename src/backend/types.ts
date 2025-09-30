// types ahora en su unica ubicacion
export type LunchType = {
  id: string;
  title: string;
  imagen: string;
  price: number;
  tags: string[];
}

export type PayMethod = {
  id: string;
  label: string;
  image: string;
}

export type OrderState = "pendiente" | "pagado";

export type OrderType = {
  id: string;
  towerNum: string;
  apto: number;
  customer: string;
  phoneNum: number;
  payMethod: PayMethod;
  lunch: LunchType[] & { quantity?: number }[]; // cada item puede llevar quantity
  details: string;
  time: string;
  date: string | Date;
  orderState: OrderState;
  total?: number;
}