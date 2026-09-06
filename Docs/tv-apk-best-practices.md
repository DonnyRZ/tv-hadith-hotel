# EGI TV APK — Best Practices Operasional

Dokumen ini adalah acuan wajib untuk membuat, memverifikasi, memasang, dan
memperbarui aplikasi EGI TV pada Google TV/Android TV hotel.

## Keputusan yang tidak boleh berubah

- APK operasional selalu memakai package `com.roomservice.tv`.
- APK debug hanya untuk development atau test. APK debug tidak boleh dipasang
  pada TV pilot atau TV hotel.
- Setiap update harus memakai signing key produksi yang sama. Fingerprint
  sertifikat produksi yang harus dipertahankan adalah:
  `50dff6906e42e0ea5ee933225fadf4a55cb9a2050baaeafa3bff8b6d90820904`.
- `versionCode` harus meningkat pada setiap update; Android menolak downgrade.
- APK release hanya boleh memakai API production HTTPS yang sama dengan Staff
  Web. Tidak boleh ada `localhost`, `127.0.0.1`, `10.0.2.2`, IP laptop, atau
  host `.local`.
- Satu APK dipakai untuk seluruh kamar. Room number dan credential TV berasal
  dari proses pairing backend, bukan dari build APK per kamar.

## Debug dan release

| Aspek | Debug | Release operasional |
|---|---|---|
| Package | `com.roomservice.tv.debug` | `com.roomservice.tv` |
| Tujuan | Development, emulator, dan test | Pilot dan seluruh TV hotel |
| Signing | Debug signing | Signing key produksi yang sama untuk semua update |
| API | Local/staging sesuai target test | HTTPS API production |
| Debuggable | Aktif | Non-debuggable |
| Distribusi | Tidak dibagikan ke operator | Artifact resmi dengan checksum |

Perbedaan package membuat debug dan release menjadi dua aplikasi berbeda di
TV. Release dengan package dan key yang sama akan dipasang sebagai update,
bukan membuat aplikasi kedua. Jangan menghapus aplikasi production hanya untuk
mengatasi masalah update.

## Custody signing key

Keystore produksi adalah aset pemulihan aplikasi. Simpan di password manager
atau storage terenkripsi yang memiliki backup teruji dan akses terbatas.

- Jangan commit keystore, `signing.properties`, password, atau key ke Git.
- Jangan membuat key baru karena build gagal. Key baru tidak dapat meng-update
  `com.roomservice.tv` yang sudah terpasang.
- Simpan fingerprint publik dan lokasi pemulihan, bukan password di dokumen
  repository.
- Sebelum build fleet, cocokkan fingerprint key dengan fingerprint di atas.
- Setelah pemulihan, lakukan satu update pada TV pilot sebelum rollout.

Konfigurasi lokal memakai `apps/tv-shell/signing.properties` atau environment
`TV_SIGNING_STORE_FILE`, `TV_SIGNING_STORE_PASSWORD`, `TV_SIGNING_KEY_ALIAS`,
dan `TV_SIGNING_KEY_PASSWORD`. File tersebut harus tetap ignored oleh Git.

Pada mesin release EGI, custody key yang sudah dipulihkan berada di luar
repository:

- Keystore: `C:\IT\hadith-hotel-secrets\tv-release\room-service-tv-release.p12`
- Password terenkripsi DPAPI: `C:\IT\hadith-hotel-secrets\tv-release\room-service-tv-release.password.dpapi`

Password DPAPI hanya dapat dibuka oleh akun Windows pemiliknya. Jangan menyalin
password ke chat, source code, `signing.properties`, atau log. Gunakan wrapper
`tools/tv/package-tv-from-custody.ps1`; wrapper membaca password hanya di memori,
menemukan alias secara lokal, lalu menjalankan release gate yang sama.

## Konfigurasi build release

Contoh command dari root repository:

```powershell
.\tools\tv\package-tv.ps1 `
  -ApiBaseUrl https://api-production-505c.up.railway.app/api/v1/ `
  -VersionCode <next-version-code> `
  -PreviousVersionCode <installed-production-version-code> `
  -VersionName <release-version>
```

Script packaging wajib menggagalkan build jika API bukan HTTPS production,
keystore tidak ada, package/variant salah, signature tidak valid, atau
fingerprint berbeda. Jangan bypass gate dengan mengganti package atau memakai
debug APK.

Command release yang direkomendasikan dari root repository:

```powershell
.\tools\tv\package-tv-from-custody.ps1 `
  -VersionCode 10 `
  -PreviousVersionCode 9 `
  -VersionName 0.4.6
```

Untuk release berikutnya, `VersionCode` harus lebih tinggi dari versi yang
terpasang di TV, sedangkan `PreviousVersionCode` harus diisi dengan versi
production terakhir. Jika lokasi custody berbeda, gunakan parameter
`-SigningCustodyDirectory` atau environment `TV_SIGNING_CUSTODY_DIR`.

Setiap release harus memiliki:

- APK `app-release.apk`.
- SHA-256 APK.
- `app-release.apk.manifest.json` yang mencatat package, variant, version,
  API base URL, checksum, fingerprint, dan waktu build.
- Catatan release ID API/Staff Web yang kompatibel.
- Hasil `apksigner verify --verbose --print-certs`.

## Preflight sebelum instalasi

Release owner harus memastikan seluruh item ini lulus:

1. API production dan Staff Web mengarah ke environment serta release ID yang
   sama.
2. Health API mengembalikan JSON dan database production sehat.
3. APK memiliki package `com.roomservice.tv` dan variant `release`.
4. `versionCode` APK lebih besar dari versi yang ada di TV.
5. APK signed dan fingerprint tepat sama dengan fingerprint produksi.
6. API URL APK adalah HTTPS production; tidak ada alamat laptop/emulator.
7. Checksum file yang akan disalin ke USB cocok dengan manifest.
8. APK sudah diuji pada satu TV pilot dengan model dan Android TV OS yang sama.
9. Tidak ada `com.roomservice.tv.debug` yang akan dipakai sebagai artifact
   operasional.

Contoh pemeriksaan lokal:

```powershell
Get-FileHash .\apps\tv-shell\app\build\outputs\apk\release\app-release.apk -Algorithm SHA256
Get-Content .\apps\tv-shell\app\build\outputs\apk\release\app-release.apk.manifest.json
```

## Instalasi dan update di TV

Untuk pilot atau fleet kecil, USB/flashdisk adalah cara yang sah selama file
dan checksum dikontrol. Wireless Debugging/ADB juga dapat digunakan dari
jaringan admin yang terisolasi.

- Salin hanya APK release yang sudah diverifikasi ke media instalasi.
- Jangan uninstall `com.roomservice.tv` sebelum mencoba update.
- Android akan mempertahankan data aplikasi, credential TV, dan konfigurasi
  ketika package serta signing key cocok.
- Jika package debug masih ada, hapus hanya `com.roomservice.tv.debug` setelah
  release berhasil diuji. Jangan menghapus production sebagai langkah biasa.
- Setelah update, buka aplikasi dan pastikan pairing/room context, welcome
  guest, katalog, order, dan My Requests berjalan.
- Jika Android menolak update karena signature, hentikan rollout. Itu berarti
  key salah atau artifact bukan release yang benar.

## Rollout 114 TV

Gunakan rollout bertahap agar satu artifact yang sama tervalidasi sebelum
dipasang ke semua kamar:

1. Catat model TV, OS/API, room, versi aplikasi, package, dan checksum.
2. Pasang pada satu TV pilot dan jalankan smoke test lengkap.
3. Pasang pada batch kecil, misalnya 5–10 TV, lalu cek pairing dan request.
4. Lanjutkan batch berikutnya hanya jika tidak ada mismatch signature/API.
5. Simpan daftar TV yang berhasil dan gagal; jangan membuat APK berbeda per
   kamar.
6. Setelah selesai, nonaktifkan Wireless Debugging bila kebijakan perangkat
   mengizinkan.

## Recovery dan rollback

- Simpan artifact release sebelumnya, checksum, manifest, dan version code.
- Rollback Android berarti memasang artifact lama hanya bila version code
  memungkinkan dan kebijakan data sudah dipahami; jangan menghapus data secara
  spontan.
- Jika versi baru memakai version code lebih tinggi, siapkan hotfix baru dengan
  version code yang lebih tinggi, bukan downgrade.
- Jika key produksi hilang, jangan membuat key pengganti. Hentikan update dan
  pulihkan dari backup key resmi.
- Jika API bermasalah, perbaiki atau rollback API production; jangan membangun
  APK baru dengan IP laptop untuk TV hotel.

## Security dan observability

- Jangan menanam password staff, credential pairing, token tamu, atau secret
  backend di APK.
- Jangan mencatat pairing code atau credential TV ke log produksi.
- Gunakan HTTPS dan validasi certificate/hostname dari konfigurasi production.
- Simpan checksum dan fingerprint di deployment record yang dapat diaudit.
- Catat siapa yang menyetujui release, kapan dipasang, pada TV mana, dan hasil
  smoke test-nya.

## Referensi wajib

- [`runtime-environment-contract.md`](runtime-environment-contract.md)
- [`tv-release-checklist.md`](tv-release-checklist.md)
- [`tv-pairing-runbook.md`](tv-pairing-runbook.md)
- [`tv-pairing-troubleshooting.md`](tv-pairing-troubleshooting.md)
- [`google-tv-distribution.md`](google-tv-distribution.md)
- [`tv-self-update-research.md`](tv-self-update-research.md)
- [`tv-self-update-runbook.md`](tv-self-update-runbook.md)

Dokumen ini tidak menggantikan release checklist. Jika ada perbedaan, release
harus dihentikan sampai owner menyelesaikan konflik konfigurasi dan keamanan.
