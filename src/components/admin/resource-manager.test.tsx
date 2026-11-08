import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/api/errors'
import { Providers } from '@/components/providers'
import type { FieldDef } from './field-defs'
import { ResourceManager, type ResourceManagerProps } from './resource-manager'

interface Kit {
  id: number
  name: string
  category: string
  stock: number
  price_idr: number
  description: string | null
  is_active: boolean
  meta: { tag: string }
}

const FIELDS: readonly FieldDef[] = [
  { name: 'name', label: 'Nama kit', type: 'text', required: true, minLength: 2 },
  {
    name: 'category',
    label: 'Kategori',
    type: 'select',
    required: true,
    options: [
      { value: 'MATH', label: 'Matematika' },
      { value: 'LANGUAGE', label: 'Bahasa' },
    ],
  },
  { name: 'stock', label: 'Stok', type: 'number', required: true, min: 0 },
  { name: 'price_idr', label: 'Harga', type: 'money', required: true, min: 0 },
  { name: 'description', label: 'Deskripsi', type: 'textarea' },
  { name: 'is_active', label: 'Tampilkan di toko', type: 'checkbox', defaultValue: true },
  { name: 'meta', label: 'Meta', type: 'json', createOnly: true },
]

const KIT: Kit = {
  id: 1,
  name: 'Taman Berhitung',
  category: 'MATH',
  stock: 16,
  price_idr: 150000,
  description: null,
  is_active: true,
  meta: { tag: 'a' },
}

function setup(over: Partial<ResourceManagerProps<Kit>> = {}) {
  const props: ResourceManagerProps<Kit> = {
    title: 'Kit edukasi',
    description: 'Katalog kit.',
    singular: 'kit',
    columns: [
      { key: 'name', header: 'Kit', render: (k) => k.name },
      { key: 'stock', header: 'Stok', render: (k) => String(k.stock) },
    ],
    fields: FIELDS,
    itemLabel: (k) => k.name,
    load: vi.fn().mockResolvedValue([KIT]),
    create: vi.fn().mockImplementation(async (p) => ({ ...KIT, ...p, id: 2 })),
    update: vi.fn().mockImplementation(async (id, p) => ({ ...KIT, ...p, id })),
    remove: vi.fn().mockResolvedValue(null),
    ...over,
  }
  render(
    <Providers>
      <ResourceManager {...props} />
    </Providers>,
  )
  return props
}

describe('ResourceManager', () => {
  it('lists records with configured columns and row actions', async () => {
    const props = setup()
    expect(screen.getByRole('heading', { level: 2, name: 'Kit edukasi' })).toBeInTheDocument()
    const table = await screen.findByRole('table', { name: 'Daftar kit' })
    expect(within(table).getByRole('columnheader', { name: 'Kit' })).toBeInTheDocument()
    expect(within(table).getByRole('cell', { name: 'Taman Berhitung' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ubah Taman Berhitung' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hapus Taman Berhitung' })).toBeInTheDocument()
    expect(props.load).toHaveBeenCalledOnce()
  })

  it('generates the form from FieldDefs, validates, then creates', async () => {
    const user = userEvent.setup()
    const props = setup()
    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Tambah kit' }))
    const dialog = screen.getByRole('dialog', { name: 'Tambah kit' })

    // One control per field type.
    expect(within(dialog).getByRole('textbox', { name: /Nama kit/ })).toBeInTheDocument()
    expect(within(dialog).getByRole('combobox', { name: /Kategori/ })).toBeInTheDocument()
    expect(within(dialog).getByRole('checkbox', { name: 'Tampilkan di toko' })).toBeChecked()
    expect(within(dialog).getByRole('textbox', { name: /Meta/ })).toBeEnabled()

    await user.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Periksa kembali isian yang ditandai.',
    )
    const name = within(dialog).getByRole('textbox', { name: /Nama kit/ })
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(props.create).not.toHaveBeenCalled()

    await user.type(name, 'Kit Uji')
    await user.selectOptions(within(dialog).getByRole('combobox', { name: /Kategori/ }), 'LANGUAGE')
    await user.type(within(dialog).getByRole('textbox', { name: /Stok/ }), '5')
    await user.type(within(dialog).getByRole('textbox', { name: /Harga/ }), '99.000')
    expect(within(dialog).getByText('Tampil sebagai Rp 99.000')).toBeInTheDocument()
    await user.type(within(dialog).getByRole('textbox', { name: /Meta/ }), '{{"tag":"b"}')
    await user.click(within(dialog).getByRole('button', { name: 'Simpan' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(props.create).toHaveBeenCalledWith({
      name: 'Kit Uji',
      category: 'LANGUAGE',
      stock: 5,
      price_idr: 99000,
      description: null,
      is_active: true,
      meta: { tag: 'b' },
    })
    expect(await screen.findByText('Kit Uji berhasil ditambahkan.')).toBeInTheDocument()
    expect(props.load).toHaveBeenCalledTimes(2)
  })

  it('edits with only the changed fields and locks createOnly fields', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.click(await screen.findByRole('button', { name: 'Ubah Taman Berhitung' }))
    const dialog = screen.getByRole('dialog', { name: 'Ubah Taman Berhitung' })
    expect(within(dialog).getByRole('textbox', { name: /Meta/ })).toBeDisabled()
    expect(within(dialog).getByText('Tidak dapat diubah setelah dibuat.')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Tidak ada perubahan.')
    expect(props.update).not.toHaveBeenCalled()

    const stock = within(dialog).getByRole('textbox', { name: /Stok/ })
    await user.clear(stock)
    await user.type(stock, '9')
    await user.click(within(dialog).getByRole('checkbox', { name: 'Tampilkan di toko' }))
    await user.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    await waitFor(() =>
      expect(props.update).toHaveBeenCalledWith(1, { stock: 9, is_active: false }),
    )
    expect(await screen.findByText('Taman Berhitung berhasil diperbarui.')).toBeInTheDocument()
  })

  it('puts server field errors next to their control and keeps the dialog open', async () => {
    const user = userEvent.setup()
    setup({
      update: vi.fn().mockRejectedValue(
        new ApiError('validation_error', 'Data tidak valid.', 422, {
          fields: { name: 'Nama sudah dipakai.', other: 'Kolom lain bermasalah.' },
        }),
      ),
    })
    await user.click(await screen.findByRole('button', { name: 'Ubah Taman Berhitung' }))
    const dialog = screen.getByRole('dialog')
    const name = within(dialog).getByRole('textbox', { name: /Nama kit/ })
    await user.clear(name)
    await user.type(name, 'Kit Baru')
    await user.click(within(dialog).getByRole('button', { name: 'Simpan' }))
    expect(await within(dialog).findByText('Nama sudah dipakai.')).toBeInTheDocument()
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Data tidak valid. Kolom lain bermasalah.',
    )
    expect(name).toHaveAttribute('aria-invalid', 'true')
    await user.type(name, 'x')
    expect(name).not.toHaveAttribute('aria-invalid')
  })

  it('soft-deletes after confirmation and reloads', async () => {
    const user = userEvent.setup()
    const props = setup()
    await user.click(await screen.findByRole('button', { name: 'Hapus Taman Berhitung' }))
    const dialog = screen.getByRole('dialog', { name: 'Hapus Taman Berhitung?' })
    await user.click(within(dialog).getByRole('button', { name: 'Ya, hapus' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(props.remove).toHaveBeenCalledWith(1)
    expect(await screen.findByText('Taman Berhitung sudah dihapus.')).toBeInTheDocument()
    expect(props.load).toHaveBeenCalledTimes(2)
  })

  it('surfaces a 409 conflict on delete inside the open confirm dialog', async () => {
    const user = userEvent.setup()
    const props = setup({
      remove: vi
        .fn()
        .mockRejectedValue(new ApiError('conflict', 'Kelas masih memiliki peserta aktif.', 409)),
    })
    await user.click(await screen.findByRole('button', { name: 'Hapus Taman Berhitung' }))
    const dialog = screen.getByRole('dialog', { name: 'Hapus Taman Berhitung?' })
    await user.click(within(dialog).getByRole('button', { name: 'Ya, hapus' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Kelas masih memiliki peserta aktif.',
    )
    expect(screen.getByRole('dialog', { name: 'Hapus Taman Berhitung?' })).toBeInTheDocument()
    expect(props.load).toHaveBeenCalledOnce()
  })

  it('shows an empty state', async () => {
    setup({ load: vi.fn().mockResolvedValue([]) })
    expect(await screen.findByRole('heading', { name: 'Belum ada kit' })).toBeInTheDocument()
  })

  it('retries after a load failure', async () => {
    const user = userEvent.setup()
    const load = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('unavailable', 'Layanan sedang sibuk.', 503))
      .mockResolvedValue([KIT])
    setup({ load })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Daftar kit belum bisa dimuat.')
    await user.click(within(alert).getByRole('button', { name: 'Coba lagi' }))
    expect(await screen.findByRole('table')).toBeInTheDocument()
  })
})
