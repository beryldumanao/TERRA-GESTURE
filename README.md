# TERRA_GESTURE

A responsive cyberpunk 3D Earth experience using NASA Blue Marble satellite-composite imagery on a Three.js sphere, a tilted orbital dust belt, atmospheric glow, animated stars, and MediaPipe webcam hand tracking. Inspired by interactive 3D particle-planet experiences; this is an original implementation, not a copy of the reference source. The NASA texture loads from NASA Science assets when internet access is available; a procedural fallback map is used if it cannot load.

## Features

- Realistic Earth globe using NASA Blue Marble Next Generation January global base map (5400 × 2700 JPEG), with a procedural fallback if the external texture is unavailable.
- Source: NASA Earth Observatory, Blue Marble: Next Generation Base Map — https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/
- NASA texture asset: https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/january/world.200401.3x5400x2700.jpg
- Cyan/purple orbital rings, an animated tilted dust belt, floating particles, starfield, atmospheric shells, sci-fi telemetry and responsive interface.
- MediaPipe hand tracking via webcam.
- Gestures:
  - Open palm: wake/activate status.
  - Move hand: rotate the Earth globe.
  - Pinch thumb + index finger: scale the Earth globe.
  - Fist: energy mode, brighter atmosphere and particles.
- Mouse fallback: drag to rotate, mouse wheel to zoom.
- Reset button, gesture guide, tracking confidence indicator.

## Requirements

- Windows 10/11
- Node.js 20 LTS or newer (recommended)
- Modern Chrome or Edge
- Webcam and internet connection for the first run (Vite packages and MediaPipe model/WASM are downloaded)

## Run on Windows

1. Install Node.js from https://nodejs.org/ (choose the LTS version). Restart the terminal after installation.
2. Extract `TERRA_GESTURE.zip`.
3. Open the extracted `TERRA_GESTURE` folder.
4. Click the address bar in File Explorer, type `cmd`, and press Enter.
5. Run:

   ```bat
   npm install
   npm run dev
   ```

6. Open the local URL printed in the terminal, usually `http://localhost:5173`.
7. Click **ACTIVATE HAND TRACKING** and allow camera access.
8. Put one hand in view. Use the mouse as a fallback if you don't want to activate the camera.

Keep the terminal running while using the website. Press `Ctrl+C` in the terminal to stop it.

## Important notes

- Camera access generally requires `localhost` or HTTPS. Do not open `index.html` directly with a double-click.
- The first activation needs internet access to load the MediaPipe model and runtime.
- If GPU delegate initialization fails on a particular device, change `delegate:'GPU'` in `src/main.js` to `delegate:'CPU'`, then restart Vite.
- Camera permission can be reset from the browser address bar/site settings.
- If the webcam is already being used by another app, close that app and retry.

## Production build

```bat
npm run build
npm run preview
```

Vite outputs the optimized website into `dist/`.

## Folder structure

```text
TERRA_GESTURE/
├── index.html
├── package.json
├── README.md
└── src/
    ├── main.js
    └── style.css
```

## Troubleshooting

- **`npm` is not recognized:** install Node.js LTS, then close and reopen CMD.
- **Blank page:** open browser DevTools with `F12`, inspect Console, and check internet access for CDN resources.
- **Camera button fails:** use Chrome/Edge at `http://localhost:5173`, allow camera permission, and make sure another application is not using the webcam.
- **Hand is not detected:** use bright, even lighting; show your full hand; keep it roughly 30–80 cm from the camera.
- **Low FPS:** close other heavy apps or reduce browser zoom/render load.

This is a browser-based interaction demo, not a medical, safety, or industrial control system.


## Automatic camera permission

When the page opens, the app automatically requests webcam access and starts hand tracking after permission is granted. The browser will still show its own permission prompt when needed; a website cannot grant camera access without the user's approval. Use `http://localhost:5173` or HTTPS. If camera access was previously blocked, allow it from the browser's site settings and reload.


### Kontrol gerakan tangan (versi ini)
- Geser telapak tangan ke kiri/kanan untuk memutar Bumi secara horizontal.
- Geser tangan ke atas/bawah untuk mengubah kemiringan Bumi.
- Cubit ibu jari dan telunjuk untuk zoom; kepalkan tangan untuk mode energi.
- Gerakan rotasi memakai pusat telapak dan sensitivitas yang ditingkatkan agar lebih terasa.


### Rotasi memakai ujung jari telunjuk
- Tahan tangan relatif stabil dan luruskan hanya jari telunjuk (jari lain ditekuk).
- Geser ujung telunjuk ke kiri/kanan untuk memutar globe secara horizontal.
- Geser ujung telunjuk ke atas/bawah untuk mengubah kemiringan globe.
- Rotasi sengaja hanya aktif saat pose telunjuk menunjuk terdeteksi; gerakan telapak tidak lagi menjadi sumber utama rotasi.


### Perbaikan kontrol telunjuk
- Rotasi Bumi memakai ujung telunjuk MediaPipe (landmark 8), bukan posisi telapak.
- Untuk memutar, luruskan telunjuk dan tekuk jari tengah, manis, serta kelingking; lalu gerakkan ujung telunjuk ke kiri/kanan atau atas/bawah.
- Status `INDEX FINGER ROTATE` menandakan pose telunjuk dikenali. Jika status tidak muncul, kamera belum mengenali pose menunjuk dengan jelas.


### Kontrol swipe telunjuk (versi terbaru)
- Luruskan telunjuk dan gerakkan ujungnya ke kiri/kanan untuk memutar Bumi.
- Gerakkan ujung telunjuk ke atas/bawah untuk mengubah kemiringan Bumi.
- Pose open palm penuh menjadi pose netral; pose telunjuk menunjuk atau sebagian jari tertekuk mengaktifkan rotasi.
- Deteksi jari memakai jarak relatif terhadap pergelangan tangan, sehingga tidak bergantung pada arah atas/bawah saja.


### Pinch-to-zoom
- Dekatkan ibu jari dan telunjuk untuk memulai gesture zoom.
- Renggangkan kedua ujung jari untuk memperbesar Bumi.
- Dekatkan kembali untuk memperkecil Bumi.
- Saat mode zoom aktif, rotasi telunjuk sementara dijeda agar kedua kontrol tidak saling mengganggu.


### Ring removal correction
All decorative torus/orbit rings and the lower circular pedestal have been removed from the scene construction and animation loop. The Earth globe, starfield, particle effects, index swipe, and pinch zoom remain.


### Deteksi dua tangan
- MediaPipe mendeteksi hingga dua tangan sekaligus.
- Kerangka tangan kiri ditampilkan cyan, tangan kanan ungu.
- Tangan kiri hanya divisualisasikan dan tidak mengontrol globe.
- Tangan kanan tetap mengontrol swipe telunjuk dan pinch-to-zoom.


### Perbaikan Bumi diam
- Rotasi otomatis pada mesh Bumi dimatikan.
- Bumi sekarang tetap diam ketika tidak ada gerakan kontrol yang disengaja.
- Rotasi tetap dapat dilakukan lewat kontrol gesture yang tersedia atau drag mouse.
- Animasi partikel dan bintang latar tetap berjalan sebagai efek visual.


### Strict pinch detection v2
- Mode zoom baru aktif saat ujung ibu jari dan telunjuk sangat berdekatan (jarak landmark < 0.038).
- Mode zoom dilepas saat jarak melewati 0.060 agar tidak tertahan saat swipe vertikal.
- Perubahan zoom dibatasi per frame relatif terhadap jarak awal untuk menghindari lonjakan skala.


### Open palm zoom guard
- Telapak tangan terbuka tidak lagi dapat mengaktifkan zoom.
- Zoom memerlukan pinch ibu jari dan telunjuk yang jelas serta minimal satu dari jari tengah/manis/kelingking tertekuk.
- Saat telapak terbuka, state zoom dibersihkan langsung.


### Rotasi kontinu dengan swipe tangan kanan
- Swipe telunjuk tangan kanan ke kiri memulai rotasi Bumi terus-menerus ke kiri.
- Swipe telunjuk tangan kanan ke kanan menghentikan rotasi kontinu.
- Rotasi otomatis Bumi dinonaktifkan; Bumi diam sampai gesture kiri dilakukan.
- Pinch-to-zoom tetap aktif hanya untuk gesture pinch yang disengaja, bukan telapak terbuka.


### Swipe kiri tangan kanan - perbaikan deteksi
- Swipe dideteksi dari akumulasi perpindahan ujung telunjuk lintas beberapa frame, bukan delta satu frame yang terlalu kecil.
- Telunjuk yang lurus tetap dideteksi walau jari lain ikut terbuka.
- Swipe ke kiri memulai rotasi terus-menerus; swipe ke kanan menghentikannya.


### Kontrol swipe jari tengah
- Selain telunjuk, swipe jari tengah tangan kanan juga dapat mengontrol rotasi kontinu.
- Untuk memilih jari tengah, luruskan jari tengah dan tekuk telunjuk, jari manis, serta kelingking.
- Swipe ke kiri memulai rotasi Bumi ke kiri; swipe ke kanan menghentikan rotasi.


### Kontrol swipe lebih mudah
- Ambang swipe horizontal diturunkan agar gerakan kecil yang jelas lebih mudah dikenali.
- Bisa memakai telunjuk atau jari tengah; jari tengah dipilih saat pose jari tengah terisolasi.
- Pelacakan direset ketika jari kontrol berubah atau pose menunjuk hilang, untuk mengurangi salah deteksi.


### Background dots removed
- Partikel titik dekoratif di latar dan partikel orbit dinonaktifkan.
- Bumi, pencahayaan, kerangka tangan MediaPipe, dan kontrol gesture tetap dipertahankan.


### Zoom satu langkah per gesture
- Setiap pinch yang terdeteksi memperbesar Bumi satu langkah (12%).
- Menahan pinch tidak terus mengubah zoom.
- Untuk zoom satu langkah lagi, lepaskan pinch sepenuhnya lalu lakukan pinch baru.


### Arah zoom dibalik
- Satu gesture pinch sekarang membuat Bumi menjauh/mengecil sekitar 10.7% per langkah.
- Lepaskan pinch lalu ulangi untuk mengecilkan satu langkah lagi.


### Ghost hand fix
- Cache kerangka tangan dihapus langsung saat MediaPipe tidak mendeteksi tangan.
- Landmark lama tidak lagi dirender sebagai tangan yang tertinggal setelah tangan keluar dari kamera.


### Kontrol rotasi dua arah + stop tangan kiri
- Swipe tangan kanan ke kiri: Bumi terus berputar ke kiri.
- Swipe tangan kanan ke kanan: Bumi terus berputar ke kanan.
- Untuk menghentikan putaran, tampilkan tangan kiri dengan hanya jari telunjuk terbuka (jari tengah, manis, dan kelingking ditekuk).
- Rotasi terus berjalan setelah swipe sampai gesture telunjuk kiri terdeteksi.


### Zoom mendekat diperbaiki
- Gesture pinch sekarang memperbesar/mendekatkan Bumi satu langkah sekitar 12%.
- Menahan pinch tidak terus menambah zoom; lepaskan gesture sebelum memicu langkah berikutnya.


### Gesture zoom-in dan zoom-out
- Pinch ibu jari + telunjuk dengan telunjuk terbuka: Bumi mendekat/membesar satu langkah.
- Kepalkan tangan (semua empat jari terlipat): Bumi menjauh/mengecil satu langkah.
- Menahan pose tidak mengulang zoom; buka pose lalu lakukan lagi untuk langkah berikutnya.


### Zoom gesture detection improvement
- Finger extension is now measured against each finger's own MCP joint, not the wrist, to improve detection across hand angles.
- Pinch threshold is more forgiving (enter < 0.055, maintain < 0.078 normalized landmark distance).
- Each pinch increases Earth scale by 18%; a fist decreases it by 1/1.18. One step per gesture, then release/reopen before repeating.


### Pinch zoom detection fix
- Deteksi zoom tidak lagi mensyaratkan telunjuk harus diklasifikasikan terbuka oleh heuristik jari.
- Zoom dipicu dari jarak ibu jari ke ujung telunjuk (< 0.085 jarak landmark ternormalisasi), lebih toleran terhadap sudut tangan.
- Satu pinch = satu langkah zoom-in; buka jari hingga jarak melewati ambang untuk reset sebelum gesture berikutnya.


### Final pinch zoom sensitivity fix
- Zoom-in detects the normalized distance between thumb tip and index fingertip directly, without requiring other fingers to be folded or the index-extension classifier to pass.
- Pinch enters at distance < 0.075 and releases at > 0.105 to reduce flicker.
- Each new pinch zooms in by 22%; a fist zooms out by the reciprocal factor. Release the pinch fully before repeating.


### Arah zoom dibalik
- Gesture pinch ibu jari + telunjuk sekarang mengecilkan/menjauhkan Bumi satu langkah.
- Gesture tangan mengepal sekarang memperbesar/mendekatkan Bumi satu langkah.
- Lepaskan pose sebelum mengulang agar satu gesture hanya memicu satu langkah.


### Gesture zoom-in: thumb + index open
- Buka/jauhkan ibu jari dan telunjuk sementara jari tengah, manis, dan kelingking tetap tertekuk: Bumi mendekat/membesar satu langkah.
- Gesture pinch (ibu jari dan telunjuk rapat) tetap membuat Bumi menjauh/mengecil satu langkah.
- Tangan mengepal tetap membuat Bumi mendekat satu langkah.
- Pose yang ditahan hanya memicu satu langkah; lepaskan pose lalu ulangi untuk langkah berikutnya.


### Zoom gesture detection made easier
- Thumb + index zoom-in now needs the index finger to be recognized as extended and thumb-index distance > 0.11; the other three fingers no longer need to be folded.
- Finger extension threshold relaxed from 1.12 to 1.03 to tolerate different hand angles.
- Kept the confirmed mapping: pinch = zoom out; fist = zoom in; thumb + index opened = zoom in.


### Pinch zoom kontinu (versi terbaru)
- Ibu jari + telunjuk **mendekat** = zoom in; **merenggang** = zoom out (sesuai gambar referensi).
- Zoom mengikuti perubahan jarak jari secara halus, bukan satu langkah per gesture; menahan pose tidak mengubah zoom.
- Berfungsi dengan tangan mana pun yang terdeteksi (tidak lagi bergantung pada label Left/Right MediaPipe).
- Rotasi telunjuk dijeda sebentar saat zoom aktif. Rentang zoom 0.4x - 2.6x.
- Mouse wheel, trackpad pinch, dan pinch dua jari di layar sentuh juga zoom.

### Zoom tahan-pose (lebih mudah)
- Tahan ibu jari + telunjuk **rapat** = Bumi terus membesar sampai dilepas.
- Tahan ibu jari + telunjuk **renggang lebar** (seperti huruf L) = Bumi terus mengecil.
- Gerakan cepat mendekat/menjauh juga tetap zoom proporsional.
- Atur di `src/main.js`: `ZOOM_HOLD_CLOSE`, `ZOOM_HOLD_SPREAD`, `ZOOM_HOLD_RATE`, `ZOOM_GAIN`.

### Zoom hanya ibu jari + telunjuk
- Zoom hanya aktif saat jari tengah, manis, dan kelingking tertekuk (minimal 2 dari 3) dan ibu jari terbuka.
- Telapak terbuka, telunjuk menunjuk dengan jempol terlipat, atau pose lain tidak akan men-zoom.
- Atur `ZOOM_THUMB_OUT` di `src/main.js` jika deteksi jempol terlalu ketat/longgar.

### Rotasi langsung dengan telunjuk (tanpa tangan kiri)
- Luruskan telunjuk tangan kanan (jari tengah/manis/kelingking tertekuk), lalu geser ujung telunjuk: kiri/kanan memutar Bumi horizontal, atas/bawah memiringkannya.
- Bumi mengikuti gerakan jari dan berhenti saat jari berhenti; tidak ada lagi putaran terus-menerus dan tangan kiri tidak diperlukan.
- Atur kecepatan dengan `ROTATE_GAIN_Y` (horizontal) dan `ROTATE_GAIN_X` (vertikal) di `src/main.js`.


### Mode cahaya rendah (ruangan / latar gelap)
- Saat gambar webcam gelap (rata-rata kecerahan di bawah ~75/255), mode cahaya rendah aktif otomatis dan label kamera berubah menjadi `LOW-LIGHT BOOST`.
- Frame dicerahkan (contrast stretch + gamma) sebelum dikirim ke MediaPipe, ambang deteksi diturunkan, dan webcam diminta menaikkan eksposur (jika didukung).
- Di ruangan terang tidak ada yang berubah: video mentah langsung dipakai.
- Atur di `src/main.js`: `LL_ON_LUMA` / `LL_OFF_LUMA` (kapan aktif), `LL_GAMMA` (lebih kecil = lebih terang), `LOWLIGHT_CONF` (ambang deteksi).
- Tips: arahkan sedikit cahaya (layar monitor/lampu meja) ke tangan; deteksi jauh lebih stabil jika tangan terang dan latar gelap.


### Label nama negara
- Nama negara (±140 negara) dilukis langsung di permukaan Bumi (lapisan transparan di atas peta), jadi selalu berada di dalam wilayah Bumi dan ikut melengkung saat berputar.
- Negara besar tampil dulu; negara kecil muncul saat di-zoom. Label yang bertabrakan disembunyikan otomatis.
- Tekan `N` untuk menyalakan/mematikan label. Atur ukuran di `LABEL_FONT_PX`, ambang zoom di `LABEL_TIER2_ZOOM` / `LABEL_TIER3_ZOOM`.


### Popup panduan (cara memakai)
- Saat website dibuka, muncul popup vertikal 9:16 berisi cara memakai.
- Tutup dengan tombol MULAI, tombol ×, klik area gelap, atau `Esc`. Buka lagi dengan tombol `?` (kanan bawah) atau tombol `H`.
#   T E R R A - G E S T U R E 
 
 