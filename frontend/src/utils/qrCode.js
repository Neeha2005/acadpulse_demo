import QRCode from 'qrcode'

export async function buildQrCodeDataUrl(value, options = {}) {
  const content = String(value || '').trim()
  if (!content) return ''

  return QRCode.toDataURL(content, {
    margin: 1,
    width: 240,
    errorCorrectionLevel: 'M',
    ...options,
  })
}
