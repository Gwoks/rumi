import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { api } from '@/api/client'
import { makeChild } from '@/test/factories'
import { renderWithRouter } from '@/test/render'
import { ChildFormDialog } from './child-dialogs'

/** A child who has since turned 13 (dob far enough in the past). */
const OLDER = makeChild({ id: 5, name: 'Kakak', dob: '2010-01-01', age_years: 16 })

function setup(onSaved = vi.fn()) {
  const user = userEvent.setup()
  renderWithRouter(<ChildFormDialog open onOpenChange={() => {}} child={OLDER} onSaved={onSaved} />)
  return { user, onSaved }
}

describe('ChildFormDialog (edit)', () => {
  it('renames a child older than 12 without touching the unchanged dob', async () => {
    const update = vi
      .spyOn(api, 'updateChild')
      .mockResolvedValue({ ...OLDER, name: 'Kakak Sulung' })
    const { user, onSaved } = setup()
    const name = screen.getByLabelText(/Nama anak/)
    await user.clear(name)
    await user.type(name, 'Kakak Sulung')
    await user.click(screen.getByRole('button', { name: 'Simpan data anak' }))
    await waitFor(() => expect(update).toHaveBeenCalledWith(5, { name: 'Kakak Sulung' }))
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ name: 'Kakak Sulung' }))
  })

  it('still applies the age rule to a changed dob', async () => {
    const update = vi.spyOn(api, 'updateChild')
    const { user } = setup()
    const dob = screen.getByLabelText(/Tanggal lahir/)
    await user.clear(dob)
    await user.type(dob, '2000-01-01')
    await user.click(screen.getByRole('button', { name: 'Simpan data anak' }))
    expect(await screen.findByText('Usia anak maksimal 12 tahun.')).toBeInTheDocument()
    expect(update).not.toHaveBeenCalled()
  })
})
