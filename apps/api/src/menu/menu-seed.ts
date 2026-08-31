import type { UnitCode } from '../rbac/rbac.types';
import { localizedMenuName } from './menu-localization';
import type { MenuItemKind } from './menu.types';

export interface MenuSeedItem {
  kind: MenuItemKind;
  name: string;
  localizedName: ReturnType<typeof localizedMenuName>;
}

interface MenuSeedDefinition {
  kind: MenuItemKind;
  name: string;
}

function localizeSeed(items: readonly MenuSeedDefinition[]): readonly MenuSeedItem[] {
  return items.map((item) => ({ ...item, localizedName: localizedMenuName(item.name) }));
}

// The initial catalogs mirror Docs/menu.md. Section headings are source-only
// organization; categories are intentionally not persisted in the API.
export const CAFE_MENU_SEED: readonly MenuSeedDefinition[] = [
  { kind: 'PRODUCT', name: 'Iced Americano' },
  { kind: 'PRODUCT', name: 'Iced Latte' },
  { kind: 'PRODUCT', name: 'Frappe' },
  { kind: 'PRODUCT', name: 'Bumble Orange' },
  { kind: 'PRODUCT', name: 'Iced Chocolate' },
  { kind: 'PRODUCT', name: 'Iced Cappucino' },
  { kind: 'PRODUCT', name: 'Berry Presso' },
  { kind: 'PRODUCT', name: 'Spanish Latte' },
  { kind: 'PRODUCT', name: 'Espresso' },
  { kind: 'PRODUCT', name: 'Americano' },
  { kind: 'PRODUCT', name: 'Latte' },
  { kind: 'PRODUCT', name: 'Cappuccino' },
  { kind: 'PRODUCT', name: 'Flat White' },
  { kind: 'PRODUCT', name: 'Raf Coffe' },
  { kind: 'PRODUCT', name: 'Raspberry Raf' },
  { kind: 'PRODUCT', name: 'Mocha' },
  { kind: 'PRODUCT', name: 'Ginger Latte' },
  { kind: 'PRODUCT', name: 'Classic (Black/Green/Lemon/Jasmine)' },
  { kind: 'PRODUCT', name: 'Berry Tea (Tea Pot)' },
  { kind: 'PRODUCT', name: 'Ginger & Sea Buckthorn Tea' },
  { kind: 'PRODUCT', name: 'Mango Passion Fruit Tea (Tea Pot)' },
  { kind: 'PRODUCT', name: 'Morrocan Tea (Tea Pot)' },
  { kind: 'PRODUCT', name: 'Citrus Tea (Tea Pot)' },
  { kind: 'PRODUCT', name: 'Green Lemon Tea (Tea Pot)' },
  { kind: 'PRODUCT', name: 'Black Lemon Tea (Tea Pot)' },
  { kind: 'PRODUCT', name: 'Coconut Milk' },
  { kind: 'PRODUCT', name: 'Oat Milk' },
  { kind: 'PRODUCT', name: 'Almond Milk' },
  { kind: 'PRODUCT', name: 'Lactose Free Milk' },
  { kind: 'PRODUCT', name: 'Strawberry Jasmine Iced Tea' },
  { kind: 'PRODUCT', name: 'Mango Passion Fruit Lemonade' },
  { kind: 'PRODUCT', name: 'Mixed Berry Lemonade' },
  { kind: 'PRODUCT', name: 'Classic Mojito' },
  { kind: 'PRODUCT', name: 'Tarragon Drink' },
  { kind: 'PRODUCT', name: 'Citrus Drink' },
  { kind: 'PRODUCT', name: 'Matcha Mango' },
  { kind: 'PRODUCT', name: 'Matcha Strawberry' },
  { kind: 'PRODUCT', name: 'Matcha Passion Fruit' },
  { kind: 'PRODUCT', name: 'Matcha Latte' },
  { kind: 'PRODUCT', name: 'Lemonade (Green/Pink)' },
  { kind: 'PRODUCT', name: 'Mango Latte' },
  { kind: 'PRODUCT', name: 'Berry Milkshakes' },
  { kind: 'PRODUCT', name: 'Vanilla Milkshake' },
  { kind: 'PRODUCT', name: 'Chocolate Milkshake' },
  { kind: 'PRODUCT', name: 'Orange Fresh Juice' },
  { kind: 'PRODUCT', name: 'Apple Fresh Juice' },
  { kind: 'PRODUCT', name: 'Carrot Fresh Juice' },
  { kind: 'PRODUCT', name: 'Apple & Carrot Juice' },
  { kind: 'PRODUCT', name: 'Apple & Celery Detox' },
  { kind: 'PRODUCT', name: 'Chocolate Bomboloni' },
  { kind: 'PRODUCT', name: 'Jam & Manila Bomboloni' },
  { kind: 'PRODUCT', name: 'Nutella Donuts' },
  { kind: 'PRODUCT', name: 'Bomboloni Raspberry' },
  { kind: 'PRODUCT', name: 'Rafaello Croissant' },
  { kind: 'PRODUCT', name: 'New York Roll Rafaello' },
  { kind: 'PRODUCT', name: 'Chocolate Croissant' },
  { kind: 'PRODUCT', name: 'Fistachio Croissant' },
  { kind: 'PRODUCT', name: 'Cruffin Caramel Vanilla' },
  { kind: 'PRODUCT', name: 'Chocolate Cruffin' },
  { kind: 'PRODUCT', name: 'Cruffin Raspberry' },
  { kind: 'PRODUCT', name: 'Nutella Danish' },
  { kind: 'PRODUCT', name: 'Fruit Danish' },
  { kind: 'PRODUCT', name: 'Izum Danish' },
  { kind: 'PRODUCT', name: 'Danish with Jam' },
];

export const RESTAURANT_MENU_SEED: readonly MenuSeedDefinition[] = [
  { kind: 'PRODUCT', name: 'Nasi Goreng' },
  { kind: 'PRODUCT', name: 'Sate Kambing' },
  { kind: 'PRODUCT', name: 'Soto Ayam' },
  { kind: 'PRODUCT', name: 'Beef Rendang' },
  { kind: 'PRODUCT', name: 'Ayam Bakar' },
  { kind: 'PRODUCT', name: 'Mie Goreng' },
  { kind: 'PRODUCT', name: 'Gado-Gado' },
  { kind: 'PRODUCT', name: 'Bakso' },
  { kind: 'PRODUCT', name: 'Nyuknyang Makassar' },
  { kind: 'PRODUCT', name: 'Lumpia' },
  { kind: 'PRODUCT', name: 'Martabak Telur' },
  { kind: 'PRODUCT', name: 'Tempe Mendoan' },
  { kind: 'PRODUCT', name: 'Pisang Goreng' },
  { kind: 'PRODUCT', name: 'Es Cendol' },
  { kind: 'PRODUCT', name: 'Teh Poci' },
  { kind: 'PRODUCT', name: 'Es Jeruk' },
  { kind: 'PRODUCT', name: 'Kopi Tubruk' },
  { kind: 'PRODUCT', name: 'Wedang Jahe' },
];

export const SPA_SERVICE_SEED: readonly MenuSeedDefinition[] = [
  { kind: 'SERVICE', name: 'Traditional Massage' },
  { kind: 'SERVICE', name: 'Relaxation Massage' },
  { kind: 'SERVICE', name: 'Aromatherapy Massage' },
  { kind: 'SERVICE', name: 'Deep Tissue Massage' },
  { kind: 'SERVICE', name: 'Foot Massage' },
  { kind: 'SERVICE', name: 'Head & Shoulder Massage' },
  { kind: 'SERVICE', name: 'Body Scrub' },
  { kind: 'SERVICE', name: 'Body Treatment' },
  { kind: 'SERVICE', name: 'Facial Treatment' },
  { kind: 'SERVICE', name: 'Couple Treatment' },
  { kind: 'SERVICE', name: 'Other SPA Request' },
];

export const BEAUTY_AND_SALON_SERVICE_SEED: readonly MenuSeedDefinition[] = [
  { kind: 'SERVICE', name: 'Hair Cut' },
  { kind: 'SERVICE', name: 'Hair Styling' },
  { kind: 'SERVICE', name: 'Hair Wash & Blow' },
  { kind: 'SERVICE', name: 'Hair Coloring' },
  { kind: 'SERVICE', name: 'Hair Treatment' },
  { kind: 'SERVICE', name: 'Manicure' },
  { kind: 'SERVICE', name: 'Pedicure' },
  { kind: 'SERVICE', name: 'Nail Treatment' },
  { kind: 'SERVICE', name: 'Facial Treatment' },
  { kind: 'SERVICE', name: 'Makeup Service' },
  { kind: 'SERVICE', name: 'Other Beauty & Salon Request' },
];

export const INITIAL_MENU_SEEDS: Readonly<Record<UnitCode, readonly MenuSeedItem[]>> = {
  SPA: localizeSeed(SPA_SERVICE_SEED),
  RESTAURANT: localizeSeed(RESTAURANT_MENU_SEED),
  LOUNGE: [],
  HOUSEKEEPING: localizeSeed([
    { kind: 'SERVICE', name: 'Room Cleaning' },
    { kind: 'SERVICE', name: 'Laundry Service' },
    { kind: 'SERVICE', name: 'Ironing Service' },
    { kind: 'SERVICE', name: 'Extra Towel' },
    { kind: 'SERVICE', name: 'Extra Pillow' },
    { kind: 'SERVICE', name: 'Extra Blanket' },
    { kind: 'SERVICE', name: 'Toiletries Request' },
    { kind: 'SERVICE', name: 'Drinking Water Request' },
    { kind: 'SERVICE', name: 'Trash Collection' },
    { kind: 'SERVICE', name: 'Room Amenity Request' },
    { kind: 'SERVICE', name: 'Other Housekeeping Request' },
  ]),
  BEAUTY_AND_SALON: localizeSeed(BEAUTY_AND_SALON_SERVICE_SEED),
  CAFE: localizeSeed(CAFE_MENU_SEED),
};
