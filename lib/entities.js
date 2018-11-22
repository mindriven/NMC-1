// @flow

export type User = {|
    +id: string,
    +createdAt: Date,
    +email: string,
    +password: string,
    +firstName: string,
    +lastName: string,
    +tosAgreement: boolean
|};

export type Token = {
    expires: number,
    token: string,
    userId: string
}

export type OrderPosition = {
    itemId:number,
    itemName: string,
    qty:number,
    grossPrice: number,
    netPrice: number,
    tax:number
};

export type OrderTotals = {
    netPrice: number, 
    grossPrice: number,
    tax: number
};

type OrderStatus = 'created' | 'paid' | 'invoiceMailed' | 'errorMailingInvoice';
export type Order = {
    +id: string,
    +createdAt: Date,
    +positions: OrderPosition[],
    +totals: OrderTotals,
    +userId: string,
    +status: OrderStatus,
    +chargeId?: string
}

export type MenuItem = {id: number, name: string, description: string, category: string, price: number};

export type Cart = number[];