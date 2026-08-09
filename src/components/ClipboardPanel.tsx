import { useCallback, useEffect, useState } from 'react'
import { Icon } from './Icon'
import { useDialog } from './DialogProvider'
import type { ClipboardImage } from '../types'

interface ClipboardPanelProps {
  open: boolean
  onClose: () => void
}

/** Payload used when dragging a captured image onto a terminal pane. */
export const CLIP_DRAG_TYPE = 'application/x-buyruk-clip'

function relativeTime(at: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000))
  if (seconds < 60) return 'az önce'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} dk önce`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} sa önce`
  return `${Math.round(hours / 24)} gün önce`
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

export function ClipboardPanel({ open, onClose }: ClipboardPanelProps) {
  const dialog = useDialog()
  const [images, setImages] = useState<ClipboardImage[]>([])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    window.api.clipImages
      .list()
      .then((list) => {
        if (!cancelled) setImages(list)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open])

  // Stay subscribed while closed so the badge count is right when you open it.
  useEffect(
    () =>
      window.api.clipImages.onAdded((image) =>
        setImages((prev) => [image, ...prev.filter((item) => item.id !== image.id)])
      ),
    []
  )

  const handleRemove = useCallback(
    (id: string) => {
      window.api.clipImages
        .remove(id)
        .then(setImages)
        .catch(() => {})
    },
    []
  )

  const handleClear = useCallback(async () => {
    const ok = await dialog.confirm({
      title: 'Panoyu Temizle',
      message: 'Kaydedilmiş tüm görseller silinsin mi?',
      danger: true,
      confirmText: 'Temizle'
    })
    if (!ok) return
    window.api.clipImages
      .clear()
      .then(setImages)
      .catch(() => {})
  }, [dialog])

  const handleCopyBack = useCallback(
    (image: ClipboardImage) => {
      window.api.clipImages
        .copyBack(image.id)
        .then(() => dialog.notify('Görsel panoya kopyalandı', 'success'))
        .catch((err: unknown) =>
          dialog.notify(
            `Kopyalanamadı: ${err instanceof Error ? err.message : String(err)}`,
            'error'
          )
        )
    },
    [dialog]
  )

  if (!open) return null

  return (
    <div className="clip-panel">
      <div className="panel-head">
        <span className="panel-label">
          Pano
          {images.length > 0 && <span className="toolbar-count">{images.length}</span>}
        </span>
        <div className="explorer-actions">
          <button
            type="button"
            className="icon-btn"
            title="Panoyu temizle"
            disabled={images.length === 0}
            onClick={handleClear}
          >
            <Icon name="trash" />
          </button>
          <button type="button" className="icon-btn" title="Kapat" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
      </div>

      {images.length === 0 ? (
        <div className="placeholder">
          <div className="placeholder-icon">
            <Icon name="image" size={22} />
          </div>
          <div className="placeholder-text">
            Kopyaladığın görseller burada birikir. Bir terminale sürükleyip bırakınca yolu
            oraya yazılır.
          </div>
        </div>
      ) : (
        <div className="clip-grid">
          {images.map((image) => (
            <figure
              key={image.id}
              className="clip-item"
              draggable
              title={`${image.width}×${image.height} · ${formatSize(image.bytes)}`}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'copy'
                e.dataTransfer.setData(CLIP_DRAG_TYPE, image.path)
                e.dataTransfer.setData('text/plain', image.path)
              }}
            >
              <img className="clip-thumb" src={image.thumbnail} alt="" draggable={false} />
              <figcaption className="clip-meta">
                <span>{relativeTime(image.createdAt)}</span>
                <span className="clip-dims">
                  {image.width}×{image.height}
                </span>
              </figcaption>
              <div className="clip-actions">
                <button
                  type="button"
                  className="icon-btn"
                  title="Panoya kopyala"
                  onClick={() => handleCopyBack(image)}
                >
                  <Icon name="copy" size={13} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Yolu kopyala"
                  onClick={() => void window.api.copyText(image.path)}
                >
                  <Icon name="file" size={13} />
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  title="Sil"
                  onClick={() => handleRemove(image.id)}
                >
                  <Icon name="trash" size={13} />
                </button>
              </div>
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}
