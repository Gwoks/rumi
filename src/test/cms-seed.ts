/**
 * The PRD §5.11.3 CMS seed bodies (verbatim), keyed by page and section, with
 * the §5.7 seed titles. Used by the factories and the e2e mock backend.
 */
import type {
  DomainsBody,
  EducatorsBody,
  FounderMessageBody,
  HeroBody,
  MissionBody,
  ProseBody,
  RumiWayBody,
  ValuesBody,
} from '@/api/schemas'

interface Seed<T> {
  id: number
  title: string
  body: T
}

const hero: HeroBody = {
  eyebrow: 'Belajar akhir pekan untuk usia 3–6 tahun',
  heading: 'Ruang kecil untuk',
  heading_highlight: 'bertanya & bertumbuh.',
  subheading:
    'RUMI adalah pop-up Montessori yang hangat, tempat anak-anak menjelajahi iman, kemandirian, dan kegembiraan belajar — dengan sepenuh hati.',
  art_badge: 'Sabtu pagi',
  art_caption: 'Material indah. Pertanyaan besar.',
  art_motto: 'tumbuh dengan takjub',
  social_proof: 'Kelas kecil, maksimal 12 anak per sesi',
}

const rumiWay: RumiWayBody = {
  eyebrow: 'Cara RUMI',
  heading: 'Ruang yang disiapkan untuk hati yang penuh rasa ingin tahu.',
  intro:
    'Setiap pop-up dirancang agar terasa tenang, bermakna, dan menggembirakan — tempat anak memilih kegiatan yang berarti dan menemukan ritmenya sendiri.',
  cards: [
    {
      icon: 'heart',
      tone: 'teal',
      title: 'Berakar pada adab',
      text: 'Nilai iman dirajut dengan lembut melalui cerita, lagu, dan cara kita saling peduli.',
    },
    {
      icon: 'hands',
      tone: 'orange',
      title: 'Tangan sebelum layar',
      text: 'Anak belajar lewat material nyata, gerak tubuh, dan rasa puas saat berhasil melakukannya sendiri.',
    },
    {
      icon: 'sparkles',
      tone: 'yellow',
      title: 'Rasa takjub disambut',
      text: 'Kami memberi ruang untuk pertanyaan, konsentrasi, kesalahan, dan kegembiraan.',
    },
  ],
}

const founderMessage: FounderMessageBody = {
  eyebrow: 'Pesan pendiri',
  heading: 'Tangan-tangan kecil, didampingi kampung yang peduli.',
  paragraphs: [
    'RUMI berawal dari satu keyakinan sederhana: anak-anak layak mendapat tempat di mana iman dan rasa ingin tahu tumbuh berdampingan.',
    'Sebagai ibu dan pemandu Montessori, saya ingin menghadirkan ruang yang tenang dan tertata — tempat anak boleh memilih, mencoba, dan menemukan makna dengan caranya sendiri.',
  ],
  signature_name: 'Nadia Rahman',
  signature_role: 'Pendiri & Pemandu Belajar',
}

const philosophy: ProseBody = {
  eyebrow: 'Filosofi kami',
  heading: 'Ikuti anak, rawat fitrahnya.',
  paragraphs: [
    'Kami percaya setiap anak lahir dengan fitrah: rasa ingin tahu, keinginan untuk mandiri, dan hati yang terbuka. Pendekatan Montessori memberi kami cara untuk menghormati fitrah itu — mengamati, menyiapkan lingkungan, lalu mundur selangkah.',
    'Nilai-nilai Islam tidak kami ajarkan sebagai pelajaran terpisah, tetapi kami rajut ke dalam keseharian: salam saat datang, doa sebelum makan, dan cara kita memperlakukan teman serta material.',
  ],
}

const mission: MissionBody = {
  eyebrow: 'Misi',
  heading: 'Menumbuhkan anak yang mandiri, penuh takjub, dan beradab.',
  statement:
    'Menghadirkan ruang belajar akhir pekan yang tenang dan bermakna, tempat iman dan rasa ingin tahu anak usia 3–6 tahun tumbuh berdampingan.',
  points: [
    'Kelas kecil dengan pendamping terlatih, maksimal 12 anak per sesi.',
    'Material Montessori nyata — tangan dulu, layar belakangan.',
    'Bermitra dengan orang tua lewat catatan perkembangan yang jujur dan hangat.',
  ],
}

const educators: EducatorsBody = {
  eyebrow: 'Orang-orang di balik RUMI',
  heading: 'Para pendamping kami',
  intro:
    'Tim kecil kami menyiapkan ruang yang tenang dan tertata, agar setiap anak bisa tumbuh dengan ritmenya sendiri.',
  people: [
    {
      name: 'Nadia Rahman',
      role: 'Pendiri & Pemandu Belajar',
      bio: 'Seorang ibu, pemandu Montessori, dan pembelajar sepanjang hayat tentang cara anak-anak memaknai dunia.',
      initials: 'NR',
      tone: 'teal',
    },
    {
      name: 'Ustazah Mariam Yusuf',
      role: 'Guru Utama Montessori',
      bio: 'Membawa 12 tahun pengalaman pendidikan anak usia dini dan kecintaan yang lembut pada cerita.',
      initials: 'MY',
      tone: 'orange',
    },
    {
      name: 'Hana Karim',
      role: 'Pemandu Studi Islam',
      bio: 'Membantu anak-anak mengenal adab, rasa syukur, dan rasa takjub melalui momen sehari-hari.',
      initials: 'HK',
      tone: 'yellow',
    },
  ],
}

const intro: ProseBody = {
  eyebrow: 'Pendekatan kami',
  heading: 'Montessori yang berakar pada nilai-nilai Islam.',
  paragraphs: [
    'Setiap sesi RUMI mengikuti ritme anak: lingkaran pembuka dengan salam dan doa, waktu kerja bebas dengan material yang telah disiapkan, lalu penutup dengan cerita dan refleksi.',
    'Kami mengamati, bukan menghakimi. Catatan perkembangan membantu orang tua melihat apa yang sedang tumbuh — dan undangan apa yang bisa diberikan selanjutnya.',
  ],
}

const domains: DomainsBody = {
  eyebrow: 'Lima ranah belajar',
  heading: 'Apa saja yang anak jelajahi di RUMI',
  intro: 'Pilih setiap ranah untuk melihat contoh kegiatan yang biasa kami siapkan.',
  items: [
    {
      domain: 'PRACTICAL_LIFE',
      title: 'Kehidupan Praktis',
      summary: 'Menumbuhkan kemandirian lewat pekerjaan sehari-hari.',
      activities: [
        'Menuang air dan biji-bijian',
        'Melipat kain dan merapikan alas kerja',
        'Menyiapkan camilan sederhana',
      ],
    },
    {
      domain: 'SENSORIAL',
      title: 'Sensorial',
      summary: 'Mengasah indra lewat material yang indah dan teratur.',
      activities: [
        'Mengurutkan silinder berdasarkan ukuran',
        'Mencocokkan bunyi dan tekstur',
        'Mengenali warna dan gradasinya',
      ],
    },
    {
      domain: 'LANGUAGE',
      title: 'Bahasa',
      summary: 'Menemukan rasa percaya diri lewat cerita dan bunyi baru.',
      activities: [
        'Kartu huruf amplas',
        'Mendongeng dan bercakap-cakap',
        'Bermain bunyi awal kata',
      ],
    },
    {
      domain: 'MATH',
      title: 'Matematika',
      summary: 'Membangun kepekaan bilangan, satu manik demi satu manik.',
      activities: [
        'Menghitung dengan tangga manik-manik',
        'Mencocokkan angka dan jumlah benda',
        'Mengenal bentuk geometri',
      ],
    },
    {
      domain: 'ISLAMIC_STUDIES',
      title: 'Studi Islam',
      summary: 'Menumbuhkan hati yang berakar pada rasa takjub dan adab.',
      activities: [
        'Kisah para nabi yang lembut',
        'Doa harian dan basmalah',
        'Mengenal huruf hijaiyah',
      ],
    },
  ],
}

const values: ValuesBody = {
  eyebrow: 'Nilai-nilai Islami',
  heading: 'Lima nilai yang kami rawat setiap pekan',
  intro: 'Nilai-nilai ini hadir dalam cerita, lagu, dan kebiasaan kecil di setiap sesi.',
  items: [
    {
      icon: 'heart',
      title: 'Adab',
      arabic: 'أدب',
      text: 'Santun kepada Allah, sesama, dan alam — dimulai dari salam, senyum, dan antre dengan sabar.',
    },
    {
      icon: 'sun',
      title: 'Syukur',
      arabic: 'شكر',
      text: 'Belajar berterima kasih atas hal-hal kecil: air, teman, dan kesempatan untuk mencoba.',
    },
    {
      icon: 'hands',
      title: 'Rahmah',
      arabic: 'رحمة',
      text: 'Kasih sayang yang tampak dari cara kita merawat material, teman, dan diri sendiri.',
    },
    {
      icon: 'star',
      title: 'Amanah',
      arabic: 'أمانة',
      text: 'Tanggung jawab sederhana: mengembalikan material ke tempatnya dan menuntaskan pekerjaan yang dipilih.',
    },
    {
      icon: 'leaf',
      title: 'Sabar',
      arabic: 'صبر',
      text: 'Memberi waktu untuk mencoba lagi, menunggu giliran, dan tumbuh perlahan.',
    },
  ],
}

export const CMS_SEED = {
  home: {
    hero: { id: 1, title: 'Hero Beranda', body: hero },
    rumi_way: { id: 2, title: 'Cara RUMI', body: rumiWay },
  },
  'who-we-are': {
    founder_message: { id: 3, title: 'Pesan Pendiri', body: founderMessage },
    philosophy: { id: 4, title: 'Filosofi', body: philosophy },
    mission: { id: 5, title: 'Misi', body: mission },
    educators: { id: 6, title: 'Para Pendamping', body: educators },
  },
  'our-approach': {
    intro: { id: 7, title: 'Pengantar Pendekatan', body: intro },
    domains: { id: 8, title: 'Lima Ranah', body: domains },
    values: { id: 9, title: 'Nilai Islami', body: values },
  },
} as const satisfies Record<string, Record<string, Seed<object>>>
