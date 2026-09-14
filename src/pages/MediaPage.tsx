import { FileVideo, ImageIcon, ImagePlus, Trash2 } from 'lucide-react'
import type { MediaAsset } from '../types'
import { MediaPreview } from '../components/MediaPreview'

export function MediaPage({ media, onImport, onRemove }: {
  media: MediaAsset[]
  onImport: () => void
  onRemove: (asset: MediaAsset) => void
}) {
  return (
    <div className="page media-page">
      <header className="page-header">
        <div><h1>Медиатека</h1><p>Все картинки, анимации и видео для эффектов.</p></div>
        <button className="button primary" onClick={onImport}><ImagePlus />Добавить файлы</button>
      </header>
      {media.length === 0 ? (
        <section className="full-empty">
          <div className="empty-stack" aria-hidden="true"><ImageIcon /><FileVideo /></div>
          <h2>Закидывай мемы</h2>
          <p>Добавь PNG, JPG, JPEG, GIF, WebP, WebM, MP4 или MOV. Файлы копируются в личную папку SlayCam.</p>
          <button className="button primary" onClick={onImport}><ImagePlus />Выбрать файлы</button>
        </section>
      ) : (
        <div className="media-grid">
          {media.map((asset) => (
            <article className="media-item" key={asset.id}>
              <div className="media-preview">
                <MediaPreview asset={asset} />
                <span className="media-type">{asset.extension.replace('.', '').toUpperCase()}</span>
              </div>
              <div className="media-meta">
                <div><strong title={asset.name}>{asset.name}</strong><small>{asset.pack ? `${asset.pack} · ` : ''}{asset.extension === '.gif' ? 'Анимированный GIF' : asset.type === 'video' ? 'Видео' : 'Изображение'}</small></div>
                <button className="icon-button danger" aria-label={`Удалить ${asset.name}`} onClick={() => onRemove(asset)}><Trash2 /></button>
              </div>
            </article>
          ))}
          <button className="media-add-tile" onClick={onImport}><ImagePlus /><span>Добавить ещё</span></button>
        </div>
      )}
    </div>
  )
}
