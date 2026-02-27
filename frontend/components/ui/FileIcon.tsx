import { FileText, Image, Video, File, Download } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileIconProps {
  fileType: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  showDownload?: boolean
  onDownload?: () => void
}

export function FileIcon({ 
  fileType, 
  className, 
  size = 'md',
  showDownload = false,
  onDownload 
}: FileIconProps) {
  
  const getIcon = () => {
    const iconProps = {
      className: "h-full w-full",
      style: { color: 'inherit' }
    }

    switch (fileType.toUpperCase()) {
      case 'PDF':
        return <FileText {...iconProps} style={{ color: 'var(--color-error)' }} />
      case 'IMAGE':
      case 'JPG':
      case 'JPEG':
      case 'PNG':
      case 'GIF':
      case 'WEBP':
        return <Image {...iconProps} style={{ color: 'var(--color-primary)' }} />
      case 'VIDEO':
      case 'MP4':
      case 'MOV':
      case 'AVI':
      case 'WMV':
        return <Video {...iconProps} style={{ color: 'var(--color-purple-500)' }} />
      case 'AUDIO':
      case 'MP3':
      case 'WAV':
      case 'OGG':
        return <FileText {...iconProps} style={{ color: 'var(--color-success)' }} />
      case 'DOCUMENT':
      case 'DOC':
      case 'DOCX':
        return <FileText {...iconProps} style={{ color: 'var(--color-primary)' }} />
      default:
        return <File {...iconProps} style={{ color: 'var(--color-text-secondary)' }} />
    }
  }

  const getSizeClass = () => {
    switch (size) {
      case 'sm':
        return 'w-4 h-4'
      case 'lg':
        return 'w-8 h-8'
      case 'md':
      default:
        return 'w-6 h-6'
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className={cn('flex items-center justify-center', getSizeClass(), className)}>
        {getIcon()}
      </div>
      {showDownload && onDownload && (
        <button
          onClick={onDownload}
          className="p-1 rounded-md transition-colors"
          style={{
            color: 'var(--color-text-secondary)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'
            e.currentTarget.style.color = 'var(--color-primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
            e.currentTarget.style.color = 'var(--color-text-secondary)'
          }}
          aria-label="Download file"
        >
          <Download className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

// Also export a helper function to get file color for use in other components
export function getFileColor(fileType: string): string {
  switch (fileType.toUpperCase()) {
    case 'PDF':
      return 'var(--color-error)'
    case 'IMAGE':
    case 'JPG':
    case 'JPEG':
    case 'PNG':
    case 'GIF':
    case 'WEBP':
      return 'var(--color-primary)'
    case 'VIDEO':
    case 'MP4':
    case 'MOV':
    case 'AVI':
    case 'WMV':
      return 'var(--color-purple-500)'
    case 'AUDIO':
    case 'MP3':
    case 'WAV':
    case 'OGG':
      return 'var(--color-success)'
    case 'DOCUMENT':
    case 'DOC':
    case 'DOCX':
      return 'var(--color-primary)'
    default:
      return 'var(--color-text-secondary)'
  }
}

// Export a helper function to get file display name
export function getFileDisplayName(fileType: string): string {
  switch (fileType.toUpperCase()) {
    case 'PDF':
      return 'PDF Document'
    case 'IMAGE':
    case 'JPG':
    case 'JPEG':
    case 'PNG':
    case 'GIF':
    case 'WEBP':
      return 'Image'
    case 'VIDEO':
    case 'MP4':
    case 'MOV':
    case 'AVI':
    case 'WMV':
      return 'Video'
    case 'AUDIO':
    case 'MP3':
    case 'WAV':
    case 'OGG':
      return 'Audio'
    case 'DOCUMENT':
    case 'DOC':
    case 'DOCX':
      return 'Document'
    default:
      return 'File'
  }
}
