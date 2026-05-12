# Afresto HUB — Store Listing Assets

Material untuk submit ke Google Play Store + Apple App Store.
Update di sini → copy-paste ke Play Console / App Store Connect saat submission.

---

## 📌 Nama App

- **Title** (max 30 char): `Afresto HUB`
- **Subtitle iOS** (max 30 char): `Aplikasi internal karyawan`
- **Short title Android** (max 50 char): `Afresto HUB - Internal Karyawan`

---

## 📝 Short Description

### Indonesian (Bahasa Indonesia) — 80 char max

```
Aplikasi internal karyawan untuk komunikasi, kolaborasi, dan manajemen pekerjaan.
```

### English (untuk store listing)

```
Internal company app for employee communication, collaboration, and work management.
```

---

## 📝 Full Description

### Indonesian

```
Afresto HUB adalah aplikasi internal untuk karyawan PT. Afresto Sistem Indonesia.
Akses dibatasi hanya untuk karyawan terdaftar dengan akun login resmi.

🚀 FITUR UTAMA

💬 Chat & Komunikasi
• Chat private antar karyawan
• Chat grup per departemen
• Kirim foto, video, dan GIF
• Notifikasi real-time

📰 Feed Internal
• Berbagi update kegiatan tim
• Foto, video, lokasi
• Komentar & reaksi
• Tag rekan dengan @mention

📅 Kalender & Reminder
• Jadwal pertemuan & deadline
• Sinkronisasi Google Calendar
• Pengingat otomatis di HP

✅ Task Management
• Assignment & tracking task
• Notifikasi saat di-assign
• Deadline & status update

📋 Prospek & Klien
• Pencatatan calon klien
• Riwayat pertemuan
• Konversi prospek ke kontrak

🐞 Error Log
• Lapor error sistem klien
• Foto/video screen rekam
• Auto-assign ke handler IT

📊 Performance
• Catatan appointment & kontrak
• Grafik bulanan
• Goal tracking per PIC

📁 Dokumen & Invoice
• Manajemen dokumen kategori
• Invoice & kontrak klien
• Pajak & cashback otomatis

🔒 KEAMANAN
• Login wajib (akun karyawan terdaftar)
• Data terenkripsi (HTTPS)
• Backup harian otomatis
• Audit log untuk akuntabilitas

📱 TENTANG
Aplikasi ini bersifat private/internal. Untuk akses, hubungi administrator HR
di perusahaan PT. Afresto Sistem Indonesia.

Privacy Policy: https://hub.afresto.id/privacy-policy
Website: https://afresto.id
```

### English (for reviewers who don't read Indonesian)

```
Afresto HUB is the internal employee app for PT. Afresto Sistem Indonesia.
Access restricted to registered employees with official login credentials.

🚀 FEATURES

💬 Chat & Communication — private & group messaging, photo/video/GIF sharing,
real-time notifications.

📰 Internal Feed — share team updates with photos, videos, location tags.
Comments, reactions, @mentions.

📅 Calendar & Reminders — meeting schedules, deadlines, Google Calendar sync,
automatic phone reminders.

✅ Task Management — assignment & tracking, notifications when assigned,
deadline & status updates.

📋 Prospect & Client — track potential clients, meeting history, convert
prospects to contracts.

🐞 Error Log — report client system errors with screen recordings,
auto-assign to IT handler.

📊 Performance — appointment & contract records, monthly charts,
per-PIC goal tracking.

📁 Documents & Invoice — categorized document management, client invoices &
contracts, automatic tax & cashback.

🔒 SECURITY
Mandatory login (registered employees only), HTTPS encryption, daily
automatic backups, audit logs for accountability.

📱 ABOUT
This is a private/internal application. To request access, contact your HR
administrator at PT. Afresto Sistem Indonesia.

Privacy Policy: https://hub.afresto.id/privacy-policy
Website: https://afresto.id
```

---

## 🏷️ Keywords (App Store)

```
business, internal, employee, hr, chat, calendar, task, crm, productivity, indonesia
```

(comma separated, max 100 chars total iOS)

---

## 📂 Category

- **Primary**: Business
- **Secondary**: Productivity

---

## 🎨 Required Assets

### App Icon
| Platform | Size | Format | File |
|---|---|---|---|
| iOS | 1024x1024 | PNG no transparency, sRGB | `assets/icon.png` ✅ |
| Android | 512x512 | PNG (Play Store listing) | Need to export from icon.png |
| Adaptive icon Android | 1024x1024 foreground + bg | PNG | `assets/adaptive-icon.png` ✅ |

### Screenshots — iOS (REQUIRED)

| Device | Resolution | Min count |
|---|---|---|
| iPhone 6.7" (Pro Max) | 1290 × 2796 px | 3+ |
| iPhone 6.5" (Plus) | 1284 × 2778 px or 1242 × 2688 | optional but recommended |
| iPhone 5.5" (legacy) | 1242 × 2208 px | optional |
| iPad 12.9" | 2048 × 2732 px | only if app supports iPad |

### Screenshots — Android

| Type | Size | Count |
|---|---|---|
| Phone | min 320px, ratio 16:9 or 9:16 | 2-8 |
| Tablet 7" | min 320px | optional |
| Tablet 10" | min 320px | optional |
| **Feature graphic** | 1024 × 500 px | 1 (required Play Store) |

---

## 📸 Screenshot Plan

Rekomendasi 5 screenshot per platform untuk showcase fitur utama:

1. **Home / Beranda** — greeting + stats hari ini + quick actions
2. **Feed** — list posting dengan foto, like/komentar
3. **Chat room** — pesan masuk dengan custom sound notif
4. **Kalender** — list jadwal hari ini + grid month view
5. **Profile sheet** — slide-down profile dengan glass theme

**Cara generate:**

### Pakai iPhone Simulator (Xcode di Mac) — kalau punya akses
```bash
# Jalankan dev client di simulator
# Buka tiap screen → File > New Screenshot atau Cmd+S
# Output di Desktop
```

### Pakai HP fisik — paling akurat
- iPhone: Tombol Volume Up + Power
- Android: Tombol Volume Down + Power
- File auto-saved di Photos / Galeri
- Transfer ke laptop → upload ke Play Console / App Store Connect

### Tips visual screenshot:
- Pakai akun demo dengan data realistic (bukan "lorem ipsum")
- Foto profile karyawan terlihat (bukan default avatar)
- Lihat ada konten di feed/chat (jangan empty state)
- Status bar bersih: WiFi full, baterai 100%, jam 09:41 (Apple convention)

### Bonus — Tools generate marketing screenshot:
- **Figma + screenshot template**: tambah frame device + text overlay
- **Screenshots.pro / Previewed**: drag screenshot, auto-frame ke device mockup
- **Shotbot.app**: Android & iOS frames generator

---

## 🎬 Feature Graphic Android (1024×500)

Required oleh Play Store. Design idea:

```
┌──────────────────────────────────────────────────────┐
│                                                       │
│   [Logo Afresto]    AFRESTO HUB                      │
│                                                       │
│   Komunikasi · Kolaborasi · Kontrol                  │
│                                                       │
│   [Mockup HP showing Feed screen]                    │
│                                                       │
└──────────────────────────────────────────────────────┘
```

Tools rekomendasi:
- **Canva** — search "Play Store Feature Graphic" templates
- **Figma** — bikin frame 1024×500
- **Adobe Express** — gratis untuk graphic simple

---

## 🌍 Listed Countries / Regions

Karena ini app internal Afresto:

**Opsi A — Limited ke Indonesia saja**
- Play Store: Country availability → Indonesia
- App Store: Pricing & Availability → Indonesia only

**Opsi B — Worldwide (lebih luas)**
- All countries available
- Tetap user yang bukan karyawan tidak bisa login (auth gating)

Saran: Opsi A — sesuai target user.

---

## 📊 Age Rating

### App Store Content Rating
- 4+ (suitable for all ages)
- No: violence, gambling, alcohol, mature themes
- Yes: user-generated content (chat, feed) — moderation by company admin

### Google Play Content Rating Questionnaire
Pilih jawaban honest:
- Violence: None
- Sexual content: None
- Profanity: None
- Controlled substances: None
- Gambling: None
- User communication: Yes (chat)
- Shares user location: User-controlled (opt-in di feed)
- Personal/sensitive info: Yes (data karyawan, encrypted, not for ads)

Hasil rating: **PEGI 3 / ESRB Everyone**

---

## 🔐 Privacy & Data Safety (Play Store)

### Data Types Collected
- ✅ Personal info: name, email, phone, address
- ✅ Photos & videos (user-generated content)
- ✅ Audio (video with sound)
- ✅ Location (opt-in di feed)
- ✅ App activity (logs)
- ✅ App info: device ID for push notif

### Data Usage
- All data: App functionality
- None for: Advertising, Analytics tracking (publik), Fraud prevention (publik)

### Sharing
- None (Firebase FCM hanya untuk push delivery, bukan share data)

### Security Practices
- ✅ Data encrypted in transit (HTTPS)
- ✅ User can request data deletion (lewat admin HR)
- ✅ Independent security review: N/A (internal app)

---

## 🍎 App Store Connect — Privacy Nutrition Labels

| Kategori | Data | Linked to User? | Tracking? |
|---|---|---|---|
| Contact Info | Name, Email, Phone | ✅ Yes | ❌ No |
| User Content | Photos/Videos, Audio, Customer Support | ✅ Yes | ❌ No |
| Identifiers | User ID, Device ID | ✅ Yes | ❌ No |
| Usage Data | Product Interaction | ✅ Yes | ❌ No |
| Location | Coarse + Precise (opt-in) | ✅ Yes | ❌ No |

**Used for:** App Functionality only.
**Tracking:** None (no third-party advertising or cross-app tracking).

---

## 🚦 Submission Checklist

### Pre-submission
- [ ] App tested on real device (iPhone + Android fisik)
- [ ] Production build sukses (`eas build --profile production`)
- [ ] Privacy Policy public accessible (`https://hub.afresto.id/privacy-policy`)
- [ ] App icon final (no transparency for iOS)
- [ ] Screenshots prepared (min 3 per device size)
- [ ] Feature graphic ready (Android)
- [ ] Short description finalized
- [ ] Long description finalized
- [ ] Keywords (iOS)

### Play Store specific
- [ ] Google Play Console account ($25 paid once)
- [ ] App created in Play Console (package name `id.afresto.hub`)
- [ ] Content rating questionnaire filled
- [ ] Data safety form filled
- [ ] Service account JSON for `eas submit -p android`
- [ ] Internal testing track (optional) for staged rollout

### App Store specific
- [ ] App Store Connect entry created (Bundle ID matches)
- [ ] Apple Developer Program active ($99/year)
- [ ] App icon 1024×1024 (no alpha channel)
- [ ] App Privacy nutrition labels filled
- [ ] Sign-In with Apple — N/A (custom Sanctum auth, not 3rd party login)
- [ ] TestFlight beta testing (recommended sebelum submit)
- [ ] App Review Information: provide demo account credentials for reviewer

---

## 🧪 Demo Account for Reviewers

App Store Connect & Play Console review need a way to test the app. Karena
Afresto HUB butuh login, provide demo account di "Review Information":

```
Username: reviewer@afresto.id
Password: <SET-A-STRONG-RANDOM-PASSWORD-HERE-DO-NOT-COMMIT>
Notes: Demo account dengan data dummy. Tidak ada interaksi real. Reviewer
boleh post di feed (akan di-cleanup berkala). Untuk test chat, kirim ke user
"Demo Bot" yang sudah ada di kontak.
```

**TODO:**
1. Create demo account `reviewer@afresto.id` di production DB sebelum submission
2. Generate password kuat secara LOKAL (mis. via `php artisan tinker` → `Str::random(16)`)
3. **JANGAN commit password ke git** — kirim langsung ke Apple/Google reviewer via App Store Connect / Play Console "Review Information" field (field tersebut private, hanya reviewer yg lihat)

---

## 📞 Support Contact

Set ini di store listing:
- **Support URL**: `https://hub.afresto.id` (atau buat `/support` page khusus)
- **Marketing URL**: `https://afresto.id`
- **Email**: `support@afresto.id`

---

## 🎯 Recommended Submission Order

1. **Internal testing dulu** — distribusi APK/IPA via EAS update ke ~5 karyawan tester
2. **TestFlight (iOS) / Internal Testing (Android)** — beta dengan 20-50 user
3. **Soft launch** ke 1 country (Indonesia only) — kalau ada bug spotted oleh real users
4. **Full release** ke semua negara target

Total timeline realistic: 2-4 minggu dari production build pertama sampai go-live publik.
