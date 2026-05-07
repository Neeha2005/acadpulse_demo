function normalizeAttachments(items) {
  if (!Array.isArray(items)) return []
  return items.filter((item) => item && (item.url || item.file_path || item.file_name))
}

export default function AttachmentList({ attachments, compact = false }) {
  const safeAttachments = normalizeAttachments(attachments)

  if (!safeAttachments.length) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 8, marginTop: compact ? 8 : 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
        <i className="fa-solid fa-paperclip" style={{ marginRight: 6 }}></i>
        {safeAttachments.length} attachment{safeAttachments.length === 1 ? '' : 's'}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {safeAttachments.map((attachment) => {
          const href = attachment.url || attachment.file_path || '#'
          const label = attachment.file_name || 'Attachment'
          return (
            <a
              key={attachment.id || `${label}-${href}`}
              href={href}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: compact ? '6px 10px' : '7px 11px',
                borderRadius: 999,
                border: '1px solid var(--border)',
                background: 'var(--surface-hover)',
                color: 'var(--text)',
                textDecoration: 'none',
                fontSize: 12,
                maxWidth: '100%',
              }}
              title={label}
            >
              <i className="fa-solid fa-link"></i>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: compact ? 180 : 240 }}>
                {label}
              </span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
