// src/lib/irs-forms.ts
// Fills official IRS AcroForms (W-9 / W-8BEN / W-8BEN-E), splits the TIN into
// the correct boxes, embeds a drawn signature image + date, appends a
// signature certificate page, and flattens. Pure: bytes in, bytes out.

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
  tax_id_type?: string
  signature_name?: string
  signature_image?: string   // data:image/png;base64,...
  signed_at?: string
  ip?: string
}

const P = 'topmostSubform[0].Page1[0]'
const MAPS: Record<IrsFormType, Record<string, keyof IrsData | 'city_state_zip'>> = {
  'W-9': {
    [`${P}.f1_01[0]`]: 'name',
    [`${P}.f1_02[0]`]: 'entity_name',
    [`${P}.Address_ReadOrder[0].f1_07[0]`]: 'address',
    [`${P}.Address_ReadOrder[0].f1_08[0]`]: 'city_state_zip',
  },
  'W-8BEN': {
    [`${P}.f_1[0]`]: 'name',
    [`${P}.f_2[0]`]: 'country',
    [`${P}.f_3[0]`]: 'address',
    [`${P}.f_4[0]`]: 'city_state_zip',
    [`${P}.f_6[0]`]: 'tax_id',
    [`${P}.f_21[0]`]: 'name',
  },
  'W-8BEN-E': {
    [`${P}.f1_1[0]`]: 'entity_name',
    [`${P}.f1_2[0]`]: 'country',
    [`${P}.f1_6[0]`]: 'address',
    [`${P}.f1_7[0]`]: 'city_state_zip',
  },
}

// signature image placement (estimates for W-9 / W-8BEN-E; exact for W-8BEN)
const SIG: Record<IrsFormType, { page: number; x: number; y: number; date?: { x: number; y: number } }> = {
  'W-9': { page: 0, x: 78, y: 182, date: { x: 445, y: 186 } },
  'W-8BEN': { page: 0, x: 112, y: 70 },
  'W-8BEN-E': { page: 7, x: 120, y: 108, date: { x: 400, y: 108 } },
}

function val(data: IrsData, key: string): string {
  if (key === 'city_state_zip') return [data.city, data.state, data.zip].filter(Boolean).join(', ')
  return (data as any)[key] || ''
}

export async function fillIrsForm(templateBytes: ArrayBuffer | Uint8Array, formType: IrsFormType, data: IrsData): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(templateBytes)
  const form = pdf.getForm()
  const setText = (field: string, v: string) => { try { form.getTextField(field).setText(v) } catch { /* skip */ } }

  for (const [field, key] of Object.entries(MAPS[formType])) {
    const v = val(data, key as string)
    if (v) setText(field, v)
  }

  // W-9 TIN goes into split boxes (SSN 3-2-4, EIN 2-7)
  if (formType === 'W-9' && data.tax_id) {
    const d = data.tax_id.replace(/\D/g, '')
    if (data.tax_id_type === 'EIN') {
      setText(`${P}.f1_14[0]`, d.slice(0, 2)); setText(`${P}.f1_15[0]`, d.slice(2, 9))
    } else {
      setText(`${P}.f1_11[0]`, d.slice(0, 3)); setText(`${P}.f1_12[0]`, d.slice(3, 5)); setText(`${P}.f1_13[0]`, d.slice(5, 9))
    }
  }

  const signedDate = data.signed_at ? new Date(data.signed_at) : new Date()
  const dateStr = `${String(signedDate.getMonth() + 1).padStart(2, '0')}-${String(signedDate.getDate()).padStart(2, '0')}-${signedDate.getFullYear()}`
  setText(`${P}.Date[0]`, dateStr) // W-8BEN date field

  // Flatten the official form first (so overlays sit on top, not inside fields)
  try { form.flatten() } catch { /* leave fillable if unsupported */ }

  // Embed the drawn signature + date onto the signature line
  const sig = SIG[formType]
  if (data.signature_image && data.signature_image.startsWith('data:image/png')) {
    try {
      const b64 = data.signature_image.split(',')[1]
      const png = await pdf.embedPng(Uint8Array.from(Buffer.from(b64, 'base64')))
      const page = pdf.getPage(sig.page)
      page.drawImage(png, { x: sig.x, y: sig.y, width: 120, height: 30 })
    } catch { /* skip image */ }
  }
  const helv = await pdf.embedFont(StandardFonts.Helvetica)
  if (sig.date) {
    try { pdf.getPage(sig.page).drawText(dateStr, { x: sig.date.x, y: sig.date.y, size: 10, font: helv, color: rgb(0.1, 0.1, 0.1) }) } catch { /* skip */ }
  }

  // Append an e-signature certificate page
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const page = pdf.addPage([612, 792])
  let y = 720
  const write = (t: string, f = helv, s = 11, c = rgb(0.1, 0.1, 0.1)) => { page.drawText(t, { x: 60, y, size: s, font: f, color: c }); y -= s + 9 }
  write('Electronic Signature Certificate', bold, 18); y -= 8
  write(`Form: ${formType}`, bold, 12); y -= 2
  write(`Signed by: ${data.signature_name || data.name || ''}`)
  write(`Entity: ${data.entity_name || '—'}`)
  write(`Date signed: ${dateStr}`)
  write(`Timestamp: ${data.signed_at || signedDate.toISOString()}`)
  write(`IP address: ${data.ip || 'recorded at submission'}`)
  y -= 10
  write('Certification', bold, 12); y -= 2
  write('Under penalties of perjury, the signer certifies the information provided is', helv, 10)
  write('true, correct, and complete, and that they are the person named above. This', helv, 10)
  write('form was completed and signed electronically through the VantageFP portal.', helv, 10)

  return await pdf.save()
}
