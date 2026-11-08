/** /design-kit 05: every form control, Field wiring (hint + error), quantity stepper. */
import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Checkbox, Field, Input, SearchInput, Select, Textarea } from '@/components/ui/input'
import { QuantityStepper } from '@/components/ui/quantity-stepper'
import { t } from '@/lib/copy'
import { normalizePhoneWa } from '@/lib/validation'
import { DemoLabel, KitSection } from './kit-section'

const LOCATIONS = [
  'Rumah Teduh, Kemang (Jakarta Selatan)',
  'Ruang Kenari, Bintaro (Tangerang Selatan)',
  'Studio Bambu, BSD City (Tangerang Selatan)',
]

export function FormsSection() {
  const [phone, setPhone] = useState('0812-34')
  const [quantity, setQuantity] = useState(1)
  const phoneError = normalizePhoneWa(phone) ? null : t('common.validation.phone')

  return (
    <KitSection
      id="formulir"
      eyebrow={t('designKit.forms.eyebrow')}
      title={t('designKit.forms.title')}
      intro={t('designKit.forms.intro')}
    >
      <Card padding="standard">
        <form
          className="grid gap-5 md:grid-cols-2"
          onSubmit={(event) => event.preventDefault()}
          noValidate
        >
          <Field label={t('designKit.form.name.label')} required>
            {(control) => (
              <Input
                {...control}
                autoComplete="name"
                placeholder={t('designKit.form.name.placeholder')}
              />
            )}
          </Field>
          <Field
            label={t('designKit.form.email.label')}
            hint={t('designKit.form.email.hint')}
            required
          >
            {(control) => (
              <Input
                {...control}
                type="email"
                autoComplete="email"
                placeholder={t('designKit.form.email.placeholder')}
              />
            )}
          </Field>
          <Field label={t('designKit.form.phone.label')} error={phoneError} required>
            {(control) => (
              <Input
                {...control}
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder={t('designKit.form.phone.placeholder')}
              />
            )}
          </Field>
          <Field label={t('designKit.form.location.label')}>
            {(control) => (
              <Select {...control} defaultValue="">
                <option value="">{t('designKit.form.location.all')}</option>
                {LOCATIONS.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label={t('designKit.form.search.label')}>
            {(control) => (
              <SearchInput {...control} placeholder={t('designKit.form.search.placeholder')} />
            )}
          </Field>
          <Field label={t('designKit.form.disabled.label')}>
            {(control) => <Input {...control} value="RUMI-2026-0001" disabled readOnly />}
          </Field>
          <Field label={t('designKit.form.notes.label')} optional className="md:col-span-2">
            {(control) => (
              <Textarea {...control} placeholder={t('designKit.form.notes.placeholder')} />
            )}
          </Field>
          <Checkbox
            label={t('designKit.form.checkbox.label')}
            description={t('designKit.form.checkbox.description')}
            defaultChecked
          />
          <div>
            <DemoLabel>{t('designKit.form.quantity.label')}</DemoLabel>
            <QuantityStepper
              value={quantity}
              onChange={setQuantity}
              max={10}
              label={t('designKit.form.quantity.label')}
            />
          </div>
        </form>
      </Card>
    </KitSection>
  )
}
