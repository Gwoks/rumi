/**
 * Shared copy (Bahasa Indonesia): brand, navigation, footer, generic UI,
 * errors, validation and the PRD §5.5 enum labels. Owned by the foundation;
 * page agents add area keys in their own file (public/auth/parent/admin.ts).
 * Every key here starts with `common.`.
 */
export const commonCopy = {
  // ── Brand ──
  'common.brand.name': 'RUMI',
  'common.brand.full': 'Rumah Main Islami',
  'common.brand.logoAlt': 'RUMI — Rumah Main Islami',
  'common.brand.tagline': 'Ruang akhir pekan untuk rasa takjub, iman, dan kemandirian yang tumbuh.',

  // ── Shell & navigation ──
  'common.skipLink': 'Lewati ke konten utama',
  'common.nav.label': 'Navigasi utama',
  'common.nav.mobileLabel': 'Navigasi seluler',
  'common.nav.home': 'Beranda',
  'common.nav.whoWeAre': 'Tentang Kami',
  'common.nav.ourApproach': 'Pendekatan Kami',
  'common.nav.weekendClasses': 'Kelas Akhir Pekan',
  'common.nav.playKits': 'Kit Edukasi',
  'common.nav.login': 'Masuk',
  'common.nav.register': 'Daftar',
  'common.nav.dashboard': 'Dasbor',
  'common.nav.adminDashboard': 'Dasbor Admin',
  'common.nav.openMenu': 'Buka menu navigasi',
  'common.nav.closeMenu': 'Tutup menu navigasi',

  // ── Cart entry points (the drawer itself is owned by the public lane) ──
  'common.cart.open.aria': 'Lihat keranjang, {count} item',
  'common.cart.countAnnouncement': 'Keranjang berisi {count} item',
  'common.cart.title': 'Keranjang',
  'common.cart.remove': 'Hapus {name} dari keranjang',
  'common.cart.empty.title': 'Keranjang masih kosong',
  'common.cart.empty.body': 'Pilih kelas akhir pekan atau kit edukasi untuk mulai.',

  // ── Footer ──
  'common.footer.visit.title': 'Kunjungi RUMI',
  'common.footer.visit.venue': 'Rumah Teduh Community Space',
  'common.footer.visit.address': 'Jl. Kemang Raya 12, Jakarta Selatan',
  'common.footer.visit.schedule': 'Sabtu & Minggu · 09.30–16.00 WIB',
  'common.footer.contact.title': 'Hubungi kami',
  'common.footer.contact.body': 'Ada pertanyaan tentang kelas atau kunjungan pertama anak Anda?',
  'common.footer.contact.email': 'hello@rumi.id',
  'common.footer.contact.whatsapp': '+62 812 3456 7890',
  'common.footer.designKit': 'Design kit',
  'common.footer.copyright': '© {year} RUMI · Rumah Main Islami',

  // ── Generic UI ──
  'common.loading': 'Memuat…',
  'common.close': 'Tutup',
  'common.cancel': 'Batal',
  'common.confirm': 'Konfirmasi',
  'common.save': 'Simpan',
  'common.retry': 'Coba lagi',
  'common.back': 'Kembali',
  'common.next': 'Lanjut',
  'common.required': 'wajib',
  'common.optional': '(opsional)',
  'common.search': 'Cari',
  'common.logout': 'Keluar',
  'common.viewSite': 'Lihat situs',
  'common.quantity.label': 'Jumlah',
  'common.quantity.decrease': 'Kurangi jumlah',
  'common.quantity.increase': 'Tambah jumlah',
  'common.stepper.label': 'Langkah',
  'common.stepper.progress': 'Langkah {current} dari {total}',
  'common.stepper.done': 'selesai',
  'common.toast.region': 'Notifikasi',
  'common.toast.viewport': 'Notifikasi ({hotkey})',
  'common.placeholder.body': 'Halaman ini sedang disiapkan.',
  'common.routeError.title': 'Terjadi kesalahan',
  'common.routeError.body': 'Halaman ini gagal dimuat. Muat ulang halaman atau kembali ke Beranda.',
  'common.routeError.reload': 'Muat ulang',

  // ── Errors (the UI branches on `code`; these cover client-side codes) ──
  'common.error.network': 'Tidak dapat terhubung ke server. Periksa koneksi Anda lalu coba lagi.',
  'common.error.contract': 'Respons server tidak sesuai. Muat ulang halaman lalu coba lagi.',
  'common.error.generic': 'Terjadi kesalahan. Coba lagi.',
  'common.error.loadFailed': 'Gagal memuat data.',
  'common.error.sessionExpired': 'Sesi Anda berakhir. Silakan masuk kembali.',
  'common.error.rateLimited': 'Terlalu banyak percobaan. Coba lagi dalam {seconds} detik.',

  // ── Not found ──
  'common.notFound.eyebrow': 'Galat 404',
  'common.notFound.title': 'Halaman tidak ditemukan',
  'common.notFound.body': 'Halaman yang Anda cari tidak ada atau sudah dipindahkan.',
  'common.notFound.home': 'Kembali ke Beranda',
  'common.notFound.classes': 'Lihat kelas akhir pekan',

  // ── Auth gate (RequireRole) ──
  'common.auth.checking': 'Memeriksa sesi…',
  'common.auth.bootstrapError': 'Kami belum bisa memeriksa sesi Anda.',

  // ── Dashboard shell ──
  'common.dashboard.navLabel': 'Menu dasbor',
  'common.dashboard.greeting': 'Selamat datang, {name}',
  'common.dashboard.account': 'Akun {name}',

  // ── PRD §5.5 enum labels ──
  'common.role.PARENT': 'Orang Tua',
  'common.role.ADMIN': 'Admin',
  'common.domain.PRACTICAL_LIFE': 'Kehidupan Praktis',
  'common.domain.SENSORIAL': 'Sensorial',
  'common.domain.LANGUAGE': 'Bahasa',
  'common.domain.MATH': 'Matematika',
  'common.domain.ISLAMIC_STUDIES': 'Studi Islam',
  'common.level.1': 'Mulai Mengenal',
  'common.level.2': 'Berkembang',
  'common.level.3': 'Berlatih Mandiri',
  'common.level.4': 'Menguasai',
  'common.level.none': 'Belum ada catatan',
  'common.orderStatus.PENDING_WA': 'Menunggu Konfirmasi',
  'common.orderStatus.PAID': 'Lunas',
  'common.orderStatus.CANCELLED': 'Dibatalkan',
  'common.classStatus.DRAFT': 'Draf',
  'common.classStatus.OPEN': 'Dibuka',
  'common.classStatus.CLOSED': 'Ditutup',
  'common.classStatus.CANCELLED': 'Dibatalkan',
  'common.enrollmentStatus.RESERVED': 'Dipesan',
  'common.enrollmentStatus.CONFIRMED': 'Terkonfirmasi',
  'common.enrollmentStatus.ATTENDED': 'Hadir',
  'common.enrollmentStatus.ABSENT': 'Tidak Hadir',
  'common.enrollmentStatus.CANCELLED': 'Dibatalkan',
  'common.itemType.KIT': 'Kit',
  'common.itemType.CLASS': 'Kelas',

  // ── Seat / stock indicators (DESIGN.md "Domain, tone and status mapping") ──
  'common.seats.full': 'Penuh',
  'common.seats.few': 'Sisa {n} kursi',
  'common.seats.available': '{n} kursi tersedia',
  'common.stock.out': 'Stok habis',
  'common.stock.low': 'Sisa {n}',
  'common.stock.available': 'Stok tersedia',

  // ── Formatting fragments ──
  'common.time.wib': '{time} WIB',
  'common.age.range': 'Usia {range} tahun',
  'common.age.years': '{n} tahun',

  // ── Form validation (lib/validation.ts) ──
  'common.validation.required': 'Wajib diisi.',
  'common.validation.email': 'Masukkan alamat email yang valid.',
  'common.validation.passwordMin': 'Kata sandi minimal 8 karakter.',
  'common.validation.passwordMax': 'Kata sandi maksimal 128 karakter.',
  'common.validation.passwordMismatch': 'Konfirmasi kata sandi tidak sama.',
  'common.validation.phone': 'Masukkan nomor WhatsApp yang valid, misalnya 0812-3456-7890.',
  'common.validation.minChars': 'Minimal {n} karakter.',
  'common.validation.maxChars': 'Maksimal {n} karakter.',
  'common.validation.date': 'Masukkan tanggal yang valid.',
  'common.validation.dobFuture': 'Tanggal lahir tidak boleh di masa depan.',
  'common.validation.dobTooOld': 'Usia anak maksimal 12 tahun.',
} as const
