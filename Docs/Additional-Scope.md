# Additional Scope
## Receptionist & Guest Welcome Personalization — MVP

**Version:** 1.0  
**Type:** Additional Scope Only  
**Purpose:** Menambahkan role Receptionist untuk melakukan assignment guest ke kamar dan menampilkan personalized welcome message pada Smart TV kamar.

---

# 1. New User Role

Tambahan role baru:

- **Receptionist**

Role Receptionist digunakan untuk:

- Memilih kamar.
- Menginput nama guest.
- Menghubungkan guest dengan kamar.
- Mengubah nama guest jika diperlukan.
- Mengakhiri assignment guest saat checkout.
- Memastikan Smart TV kamar menampilkan personalized welcome message yang sesuai.

Receptionist tidak digunakan untuk menangani operational request dari SPA, F&B, Housekeeping, Beauty & Salon, atau Cafe.

---

# 2. Receptionist Dashboard

Receptionist mendapatkan dashboard khusus untuk mengelola guest-room assignment.

Minimum informasi yang ditampilkan:

- Room Number
- Guest Name
- Room Status
- Last Updated
- Available Action

Contoh:

| Room | Guest Name | Status | Action |
|---|---|---|---|
| 301 | Ahmad Fauzan | Occupied | Edit / Checkout |
| 302 | — | Vacant | Assign Guest |
| 303 | Sarah Kim | Occupied | Edit / Checkout |

---

# 3. Room Status

Minimum room status untuk scope ini:

- `VACANT`
- `OCCUPIED`

Mapping:

```text
Tidak ada active guest assignment
→ VACANT

Ada active guest assignment
→ OCCUPIED
```

Room status pada scope ini hanya digunakan untuk kebutuhan guest assignment aplikasi.

Room status ini bukan pengganti status kamar pada PMS.

---

# 4. Assign Guest Flow

Flow utama:

```text
Receptionist Login
        ↓
Select Room
        ↓
Input Guest Name
        ↓
Save / Assign Guest
        ↓
Backend stores Guest ↔ Room Assignment
        ↓
TV Room receives updated guest data
        ↓
Personalized Welcome Message appears
```

Contoh:

```text
Room 302
Guest Name: Ahmad Fauzan
```

Smart TV:

```text
Welcome, Ahmad Fauzan
```

---

# 5. Receptionist Actions

Minimum action:

## 5.1 Assign Guest

Receptionist dapat:

1. Memilih room yang vacant.
2. Menginput guest name.
3. Save assignment.
4. Room berubah menjadi `OCCUPIED`.
5. Smart TV menampilkan guest name.

---

## 5.2 Edit Guest Name

Receptionist dapat memperbaiki guest name jika terdapat kesalahan input.

Contoh:

```text
Ahmad Fauzan
→ Ahmad F. Fauzan
```

Perubahan harus ter-update pada Smart TV kamar terkait.

---

## 5.3 Checkout / Clear Guest

Saat guest checkout:

```text
Receptionist
    ↓
Select Occupied Room
    ↓
Click Checkout / Clear Guest
    ↓
Active Guest Assignment Ends
    ↓
Room Status → VACANT
    ↓
TV Guest Name Removed
```

Setelah checkout, TV kembali ke default welcome screen.

Contoh:

```text
Welcome to [Hotel Name]
```

Nama guest sebelumnya tidak boleh tetap muncul.

---

# 6. Smart TV Welcome Personalization

Smart TV harus dapat menerima guest information berdasarkan room assignment.

Minimum welcome state:

## Occupied Room

```text
Welcome, [Guest Name]
```

Contoh:

```text
Welcome, Ahmad Fauzan
```

## Vacant Room / No Active Guest

```text
Welcome to [Hotel Name]
```

Guest name hanya ditampilkan jika room mempunyai active guest assignment.

---

# 7. Guest-to-Room Relationship

Conceptual relationship:

```text
Guest
  ↓
Active Room Assignment
  ↓
Room
  ↓
Mapped Smart TV
```

Contoh:

```text
Ahmad Fauzan
→ Room 302
→ TV Device Room 302
```

Karena TV sebelumnya sudah di-mapping ke room, backend hanya perlu menentukan active guest untuk room tersebut.

---

# 8. Data Requirements

Minimum guest assignment data:

```text
id
room_id
guest_name
status
assigned_at
updated_at
checked_out_at
assigned_by
```

Minimum active state:

```text
ACTIVE
CHECKED_OUT
```

Nama field final dapat disesuaikan pada technical design.

---

# 9. Realtime / Update Behavior

Setelah Receptionist melakukan Assign, Edit, atau Checkout:

- Backend menyimpan perubahan.
- Smart TV kamar terkait mendapatkan data terbaru.
- Welcome screen berubah tanpa perlu reinstall aplikasi.
- Native TV menerima `guest.assignment.updated` melalui `/realtime` sebagai
  refresh hint; REST `/tv/context` tetap authoritative.
- Guest tidak bergantung pada Socket.IO untuk status request dan melakukan
  refresh REST saat membuka, kembali ke halaman, atau mendapatkan focus.

Contoh:

```text
Receptionist Assign Guest
        ↓
Backend Updated
        ↓
TV Room 302 Updated
        ↓
Welcome, Ahmad Fauzan
```

---

# 10. RBAC Update

Tambahan RBAC:

```text
Receptionist
```

Receptionist dapat:

- View room list.
- View room status.
- View active guest name.
- Assign guest.
- Edit guest name.
- Checkout / clear guest.

Receptionist tidak dapat:

- Confirm operational request.
- Done operational request.
- Mengakses SPA operational dashboard.
- Mengakses Restaurant operational dashboard.
- Mengakses Lounge operational dashboard.
- Mengakses Housekeeping operational dashboard.
- Mengakses Beauty & Salon operational dashboard.
- Mengakses Cafe operational dashboard.
- Mengakses Room Manager monitoring dashboard, kecuali nantinya diberikan permission tambahan secara eksplisit.

---

# 11. Updated Role List

Dengan additional scope ini, role aplikasi menjadi:

```text
Room Manager
Receptionist
SPA
Restaurant
Lounge
Housekeeping
Beauty & Salon
Cafe
```

---

# 12. MVP Acceptance Criteria

## Scenario 1 — Assign Guest

1. Receptionist login.
2. Receptionist memilih Room 302.
3. Receptionist input `Ahmad Fauzan`.
4. Receptionist save.
5. Room 302 menjadi Occupied.
6. Backend menyimpan active guest assignment.
7. Smart TV Room 302 menampilkan:

```text
Welcome, Ahmad Fauzan
```

---

## Scenario 2 — Edit Guest Name

1. Receptionist membuka Room 302.
2. Receptionist mengubah guest name.
3. Save.
4. Smart TV Room 302 menampilkan nama terbaru.

---

## Scenario 3 — Checkout

1. Receptionist membuka Room 302.
2. Receptionist klik Checkout / Clear Guest.
3. Active guest assignment diakhiri.
4. Room berubah menjadi Vacant.
5. Nama guest dihapus dari active room state.
6. Smart TV kembali menampilkan:

```text
Welcome to [Hotel Name]
```

---

# 13. Out of Scope for This Addition

Additional scope ini tidak mencakup:

- PMS integration.
- OPERA integration.
- Exely integration.
- Automatic reservation sync.
- Automatic check-in dari PMS.
- Automatic checkout dari PMS.
- Passport data.
- Guest profile lengkap.
- Guest email.
- Guest phone number.
- Guest loyalty data.
- Payment/folio information.
- Reservation history.
- Multiple guest management per room.
- Automated salutation berdasarkan gender.
- Guest preference management.
- Digital registration card.
- ID/passport scanning.
- OCR.
- Electronic signature.
- Front-office billing.

Untuk MVP, Receptionist hanya melakukan:

```text
Select Room
→ Input Guest Name
→ Assign
→ TV Welcome Updated
→ Checkout / Clear
```

---

# 14. Future Integration Note

Jika di masa depan aplikasi diintegrasikan dengan PMS, manual input Receptionist dapat digantikan oleh:

```text
PMS Check-in
    ↓
Guest Name + Room
    ↓
Backend
    ↓
Smart TV Welcome
```

Pada MVP saat ini, proses tetap manual melalui Receptionist Dashboard.

---

# 15. Additional Scope Summary

```text
RECEPTIONIST
    ↓
Room List
    ↓
Select Room
    ↓
Input Guest Name
    ↓
Assign Guest
    ↓
Backend
    ↓
Smart TV
    ↓
"Welcome, [Guest Name]"
```

Checkout:

```text
Receptionist
    ↓
Checkout / Clear Guest
    ↓
Room → Vacant
    ↓
Guest Name Removed
    ↓
Smart TV
    ↓
"Welcome to [Hotel Name]"
```
