# Hotel Guest Service Platform
## Service & Menu List — MVP

**Version:** 1.0  
**Scope:** Current service/menu reference

---

# 1. SPA

- Traditional Massage
- Relaxation Massage
- Aromatherapy Massage
- Deep Tissue Massage
- Foot Massage
- Head & Shoulder Massage
- Body Scrub
- Body Treatment
- Facial Treatment
- Couple Treatment
- Other SPA Request

---

# 2. Food & Beverages

## 2.1 Restaurant — Saji Nusantara

### Signature
- Nasi Goreng
- Sate Kambing
- Soto Ayam

### Main Course
- Beef Rendang
- Ayam Bakar
- Mie Goreng
- Gado-Gado
- Bakso
- Nyuknyang Makassar

### Snacks
- Lumpia
- Martabak Telur
- Tempe Mendoan

### Desserts
- Pisang Goreng
- Es Cendol

### Beverages
- Teh Poci
- Es Jeruk
- Kopi Tubruk
- Wedang Jahe

---

## 2.2 Lounge

**Menu Lounge belum diberikan.**

---

# 3. Housekeeping

- Room Cleaning
- Laundry Service
- Ironing Service
- Extra Towel
- Extra Pillow
- Extra Blanket
- Toiletries Request
- Drinking Water Request
- Trash Collection
- Room Amenity Request
- Other Housekeeping Request

---

# 4. Beauty & Salon

- Hair Cut
- Hair Styling
- Hair Wash & Blow
- Hair Coloring
- Hair Treatment
- Manicure
- Pedicure
- Nail Treatment
- Facial Treatment
- Makeup Service
- Other Beauty & Salon Request

---

# 5. Cafe — 7oz Espresso

## 5.1 Cold Coffee
- Iced Americano
- Iced Latte
- Frappe
- Bumble Orange
- Iced Chocolate
- Iced Cappucino
- Berry Presso
- Spanish Latte

## 5.2 Hot Coffee
- Espresso
- Americano
- Latte
- Cappuccino
- Flat White
- Raf Coffe
- Raspberry Raf
- Mocha
- Ginger Latte

## 5.3 Tea
- Classic (Black/Green/Lemon/Jasmine)
- Berry Tea (Tea Pot)
- Ginger & Sea Buckthorn Tea
- Mango Passion Fruit Tea (Tea Pot)
- Morrocan Tea (Tea Pot)
- Citrus Tea (Tea Pot)
- Green Lemon Tea (Tea Pot)
- Black Lemon Tea (Tea Pot)

## 5.4 Add-ons & Customizations
- Coconut Milk
- Oat Milk
- Almond Milk
- Lactose Free Milk

## 5.5 Cold Drink / Signature Creations
- Strawberry Jasmine Iced Tea
- Mango Passion Fruit Lemonade
- Mixed Berry Lemonade
- Classic Mojito
- Tarragon Drink
- Citrus Drink
- Matcha Mango
- Matcha Strawberry
- Matcha Passion Fruit
- Matcha Latte
- Lemonade (Green/Pink)
- Mango Latte

## 5.6 Milkshakes
- Berry Milkshakes
- Vanilla Milkshake
- Chocolate Milkshake

## 5.7 Fresh & Detox Juice
- Orange Fresh Juice
- Apple Fresh Juice
- Carrot Fresh Juice
- Apple & Carrot Juice
- Apple & Celery Detox

## 5.8 Pastry — Bomboloni
- Chocolate Bomboloni
- Jam & Manila Bomboloni
- Nutella Donuts
- Bomboloni Raspberry

## 5.9 Pastry — Croissant
- Rafaello Croissant
- New York Roll Rafaello
- Chocolate Croissant
- Fistachio Croissant
- Cruffin Caramel Vanilla
- Chocolate Cruffin
- Cruffin Raspberry

## 5.10 Pastry — Danish
- Nutella Danish
- Fruit Danish
- Izum Danish
- Danish with Jam

---

# 6. Current Service Structure

The headings in this document are for source readability only. They are not
catalog categories and must not be persisted or rendered as a category filter
in the application.

```text
Hotel Guest Services
├── SPA
├── Food & Beverages
│   ├── Restaurant — Saji Nusantara
│   └── Lounge
├── Housekeeping
├── Beauty & Salon
└── Cafe — 7oz Espresso
```

---

# 7. Notes

- Seed final MVP berisi 64 item Cafe, 18 item Restaurant, 11 service SPA,
  11 service Housekeeping, dan 11 service Beauty & Salon.
- Setiap nama menu/service disimpan dalam Uzbek, Rusia, dan Inggris. Deskripsi
  boleh kosong, tetapi jika diisi harus tersedia dalam ketiga bahasa.
- Harga tetap nullable sampai diisi melalui CMS. Jika harga diisi, currency
  wajib ada. Guest tidak menerima data pembayaran atau total tagihan.
- Menu Lounge belum tersedia. Lounge tetap dikembalikan sebagai unit disabled
  dengan alasan `MENU_NOT_CONFIGURED` dan tidak dapat dibuka atau dipesan.
- Perubahan menu, harga, availability, dan status dari CMS menjadi sumber data
  Guest pada fetch REST berikutnya; tidak ada hardcode menu di Guest frontend.
