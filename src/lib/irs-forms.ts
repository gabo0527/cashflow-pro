// src/lib/irs-forms.ts
// Fills the official IRS AcroForms (W-9 / W-8BEN / W-8BEN-E) from onboarding
// data, stamps the e-signature, appends a signature certificate page, and
// flattens. Pure function: template bytes in, filled PDF bytes out.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export type IrsFormType = 'W-9' | 'W-8BEN' | 'W-8BEN-E'

export interface IrsData {
  name?: string
  entity_name?: string
  address?: string
  city?: string
  state?: string
  zip?: string
  country?: string
  tax_id?: string
  signature_name?: string
  signed_at?: string
  ip?: string
}

// field name -> data key
const MAPS: Record<IrsFormType, Record<string, keyof IrsData | 'city_state_zip'>> = {
  'W-9': {
    'topmostSubform[0].Page1[0].f1_01[0]': 'name',
    'topmostSubform[0].Page1[0].f1_02[0]': 'entity_name',
    'topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_07[0]': 'address',
    'topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_08[0]': 'city_state_zip',
    'topmostSubform[0].Page1[0].f1_11[0]': 'tax_id',
  },
  'W-8BEN': {
    'topmostSubform[0].Page1[0].f_1[0]': 'name',
    'topmostSubform[0].Page1[0].f_2[0]': 'country',
    'topmostSubform[0].Page1[0].f_3[0]': 'address',
    'topmostSubform[0].Page1[0].f_4[0]': 'city_state_zip',
    'topmostSubform[0].Page1[0].f_6[0]': 'tax_id',
    'topmostSubform[0].Page1[0].f_21[0]': 'name',
  },
  'W-8BEN-E': {
    'topmostSubform[0].Page1[0].f1_1[0]': 'entity_name',
    'topmostSubform[0].Page1[0].f1_2[0]': 'country',
    'topmostSubform[0].Page1[0].f1_6[0]': 'address',
    'topmostSubform[0].Page1[0].f1_7[0]': 'city_state_zip',
  },
}

function val(data: IrsData, key: string): string {
  if (key === 'city_state_zip') {
    return [data.city, data.state, data.zip].filter(Boolean).join(', ')
  }
  return (data as any)[key] || ''
}

export async function fillIrsForm(templateBytes: ArrayBuffer | Uint8Array, formType: IrsFormType, data: IrsData): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(templateBytes)
  const form = pdf.getForm()
  const map = MAPS[formType]

  for (const [field, key] of Object.entries(map)) {
    const v = val(data, key as string)
    if (!v) continue
    try { form.getTextField(field).setText(v) } catch { /* field absent/other type */ }
  }

  // Date (MM-DD-YYYY) into the form's date field where present
  const signedDate = data.signed_at ? new Date(data.signed_at) : new Date()
  const dateStr = `${String(signedDate.getMonth() + 1).padStart(2, '0')}-${String(signedDate.getDate()).padStart(2, '0')}-${signedDate.getFullYear()}`
  try { form.getTextField('topmostSubform[0].Page1[0].Date[0]').setText(dateStr) } catch { /* no date field */ }

  const oblique = await pdf.embedFont(StandardFonts.HelveticaOblique)

  // Stamp typed signature on the signature line (W-8BEN has a known position)
  if (data.signature_name && formType === 'W-8BEN') {
    pdf.getPage(0).drawText(data.signature_name, { x: 112, y: 75, size: 11, font: oblique, color: rgb(0.12, 0.12, 0.4) })
  }

  // Flatten the official form (best effort; complex forms may skip)
  try { form.flatten() } catch { /* leave fillable if flatten unsupported */ }

  // Append an e-signature certificate page (always reliable)
  const reg = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([612, 792])
  let y = 720
  const write = (t: string, f = reg, s = 11, c = rgb(0.1, 0.1, 0.1)) => { page.drawText(t, { x: 60, y, size: s, font: f, color: c }); y -= s + 9 }
  write('Electronic Signature Certificate', bold, 18); y -= 8
  write(`Form: ${formType}`, bold, 12); y -= 2
  write(`Signed by: ${data.signature_name || data.name || ''}`)
  write(`Entity: ${data.entity_name || '—'}`)
  write(`Date signed: ${dateStr}`)
  write(`Timestamp: ${data.signed_at || signedDate.toISOString()}`)
  write(`IP address: ${data.ip || 'recorded at submission'}`)
  y -= 10
  write('Certification', bold, 12); y -= 2
  write('Under penalties of perjury, the signer certifies that the information provided', reg, 10)
  write('is true, correct, and complete, and that they are the person named above. This', reg, 10)
  write('form was completed and signed electronically through the VantageFP portal.', reg, 10)

  return await pdf.save()
}
