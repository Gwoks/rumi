/**
 * Auth-screen copy (masuk, daftar 3 langkah, lupa & atur ulang kata sandi).
 * OWNED BY THE PUBLIC LANE (Agent A). Every key here starts with `auth.`.
 */
export const authCopy = {
  // ── Shared fields ──
  'auth.field.email': 'Email',
  'auth.field.emailPlaceholder': 'nama@contoh.com',
  'auth.field.password': 'Kata sandi',
  'auth.field.passwordHint': 'Minimal 8 karakter.',
  'auth.field.passwordConfirm': 'Ulangi kata sandi',
  'auth.field.fullName': 'Nama lengkap',
  'auth.field.phone': 'Nomor WhatsApp',
  'auth.field.phonePlaceholder': '0812-3456-7890',
  'auth.field.phoneHint': 'Admin RUMI menghubungi Anda lewat nomor ini.',
  'auth.formError': 'Periksa kembali isian yang ditandai.',

  // ── Masuk ──
  'auth.login.title': 'Masuk',
  'auth.login.eyebrow': 'Selamat datang kembali',
  'auth.login.intro':
    'Masuk untuk memesan kelas, memantau perkembangan anak, dan melihat riwayat pesanan.',
  'auth.login.submit': 'Masuk',
  'auth.login.forgot': 'Lupa kata sandi?',
  'auth.login.noAccount': 'Belum punya akun?',
  'auth.login.register': 'Daftar sekarang',
  'auth.login.invalid': 'Email atau kata sandi salah.',
  'auth.login.cartNote':
    'Keranjang Anda tetap tersimpan. Setelah masuk, Anda bisa langsung melanjutkan pesanan.',

  // ── Daftar (3 langkah) ──
  'auth.register.title': 'Daftar',
  'auth.register.eyebrow': 'Bergabung dengan RUMI',
  'auth.register.intro':
    'Buat akun orang tua dan daftarkan anak pertama Anda. Hanya butuh beberapa menit.',
  'auth.register.steps.parent': 'Orang tua',
  'auth.register.steps.child': 'Anak',
  'auth.register.steps.confirm': 'Konfirmasi',
  'auth.register.parent.title': 'Data orang tua',
  'auth.register.child.title': 'Data anak',
  'auth.register.child.name': 'Nama anak',
  'auth.register.child.dob': 'Tanggal lahir',
  'auth.register.child.notes': 'Catatan untuk pendamping',
  'auth.register.child.notesHint':
    'Misalnya alergi, kebutuhan khusus, atau hal yang membuatnya nyaman.',
  'auth.register.confirm.title': 'Periksa kembali',
  'auth.register.confirm.parent': 'Orang tua',
  'auth.register.confirm.child': 'Anak',
  'auth.register.confirm.edit': 'Ubah',
  'auth.register.confirm.editParent': 'Ubah data orang tua',
  'auth.register.confirm.editChild': 'Ubah data anak',
  'auth.register.confirm.age': '{n} tahun',
  'auth.register.submit': 'Buat akun',
  'auth.register.haveAccount': 'Sudah punya akun?',
  'auth.register.login': 'Masuk',
  'auth.register.success.title': 'Ahlan wa sahlan, {name}!',
  'auth.register.success.body':
    'Akun Anda dan data {child} sudah tersimpan. Sekarang Anda bisa memesan kelas akhir pekan dan memantau perkembangannya.',
  'auth.register.success.cta': 'Buka dasbor orang tua',
  'auth.register.success.classes': 'Lihat jadwal kelas',
  'auth.register.toast': 'Ahlan wa sahlan! Akun Anda sudah aktif.',

  // ── Lupa kata sandi ──
  'auth.forgot.title': 'Lupa kata sandi',
  'auth.forgot.intro':
    'Masukkan email akun Anda. Jika terdaftar, kami kirimkan tautan untuk mengatur ulang kata sandi.',
  'auth.forgot.submit': 'Kirim tautan reset',
  'auth.forgot.sent.title': 'Periksa email Anda',
  'auth.forgot.sent.body':
    'Jika {email} terdaftar di RUMI, tautan untuk mengatur ulang kata sandi sudah kami kirim. Tautan berlaku 60 menit.',
  'auth.forgot.back': 'Kembali ke halaman masuk',

  // ── Atur ulang kata sandi ──
  'auth.reset.title': 'Atur ulang kata sandi',
  'auth.reset.intro': 'Buat kata sandi baru untuk akun RUMI Anda.',
  'auth.reset.password': 'Kata sandi baru',
  'auth.reset.submit': 'Simpan kata sandi baru',
  'auth.reset.success.title': 'Kata sandi berhasil diubah',
  'auth.reset.success.body':
    'Demi keamanan, semua sesi lama sudah kami akhiri. Silakan masuk dengan kata sandi baru Anda.',
  'auth.reset.success.login': 'Masuk sekarang',
  'auth.reset.invalid.title': 'Tautan tidak valid',
  'auth.reset.invalid.body':
    'Tautan reset tidak valid atau sudah kedaluwarsa. Minta tautan baru untuk melanjutkan.',
  'auth.reset.invalid.request': 'Minta tautan baru',
} as const
