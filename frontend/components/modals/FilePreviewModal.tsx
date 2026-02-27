'use client'

import { Modal } from '../ui/Modal'
import { api } from '@/lib/api'
import { FileIcon } from '../ui/FileIcon'
import { Download, X, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '../ui/button'
import { useState, useEffect, useRef } from 'react'

interface FilePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  resource: any
}

export function FilePreviewModal({ isOpen, onClose, resource }: FilePreviewModalProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [windowSize, setWindowSize] = useState({
    width: 0,
    height: 0
  })
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Initialize window size after component mounts
  useEffect(() => {
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight
    })
  }, [])

  // Handle window resize
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Load PDF when modal opens and resource is a PDF
  useEffect(() => {
    if (isOpen && resource?.fileType?.toUpperCase() === 'PDF') {
      loadPdfForPreview()
    } else if (isOpen) {
      // For non-PDF files, reset loading state
      setIsLoading(false)
    }
  }, [isOpen, resource]);

  // Clean up the PDF blob URL when component unmounts or modal closes
  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
        setPdfUrl(null)
      }
    }
  }, [pdfUrl])

  const handleDownload = async () => {
    try {
      const response = await api.downloadResource(resource._id)
      
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = resource.originalName
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading resource:', error)
      setError('Failed to download resource')
    }
  }

  // Load PDF with authentication for preview
  const loadPdfForPreview = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await api.previewResource(resource.id || resource._id)
      const data = await response.json();

      // Convert base64 back to blob for preview
      const byteCharacters = atob(data.data.fileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: data.data.metadata.mimeType });
      const url = URL.createObjectURL(blob)
      setPdfUrl(url)
    } catch (error) {
      console.error('Error loading PDF:', error)
      setError('Failed to load PDF preview')
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate responsive dimensions
  const getResponsiveDimensions = () => {
    // For mobile devices
    if (windowSize.width < 640) {
      return {
        width: '95vw',
        height: '70vh', // Reduced height for mobile to ensure it fits
        modalMaxWidth: '95vw'
      }
    }
    // For tablets
    if (windowSize.width < 1024) {
      return {
        width: '90vw',
        height: '80vh',
        modalMaxWidth: '90vw'
      }
    }
    // For desktop
    return {
      width: '85vw',
      height: '85vh',
      modalMaxWidth: '85vw'
    }
  }

  const responsiveDims = getResponsiveDimensions()

  // Alternative PDF viewer for mobile devices
  const renderPdfMobileFallback = () => {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full p-4">
        <FileIcon fileType={resource.fileType} className="h-16 w-16 mb-4" />
        <p className="text-lg font-medium mb-2" style={{ color: 'var(--color-text)' }}>PDF Preview</p>
        <p className="text-center mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          For the best experience viewing PDFs on mobile, please download the file.
        </p>
        <Button onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
      </div>
    )
  }

  // Base64 Image Preview component
  const Base64ImagePreview = ({ resource, onLoad, onError }: { resource: any; onLoad: () => void; onError: () => void }) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);

    useEffect(() => {
      // First try to load from regular URL
      const regularUrl = `${process.env.NEXT_PUBLIC_API_URL}${resource.fileUrl}`;
      
      // Check if we should try base64 first (for small images or known issues)
      const loadBase64Directly = () => {
        api.previewResource(resource.id || resource._id)
          .then(response => {
            if (response.ok) return response.json()
            throw new Error('Failed to load image preview')
          })
          .then(data => {
            const mimeType = data.data.metadata.mimeType || 'image/jpeg';
            let base64Data = data.data.fileData;
            
            if (!base64Data.startsWith('data:')) {
              base64Data = `data:${mimeType};base64,${base64Data}`;
            }
            
            setImageUrl(base64Data);
            onLoad();
          })
          .catch(error => {
            console.error('Error loading base64 image:', error);
            // Fallback to regular URL
            setImageUrl(regularUrl);
            onError();
          });
      };

      // For small images or when we know the regular URL might fail, load base64 directly
      loadBase64Directly();
      
    }, [resource.id, resource._id, resource.fileUrl]);

    return (
      <div className="w-full h-full flex items-center justify-center p-2 sm:p-4" style={{ backgroundColor: 'var(--color-surface-muted)' }}>
        {imageUrl && (
          <img
            src={imageUrl}
            alt={resource.title}
            className="max-w-full max-h-full object-contain"
            onLoad={() => onLoad()}
            onError={() => onError()}
          />
        )}
      </div>
    );
  };

  const renderPreview = () => {
    const fileType = resource.fileType?.toUpperCase()
    const isMobile = windowSize.width < 768
    
    if (fileType === 'PDF') {
      if (error) {
        return (
          <div className="flex flex-col items-center justify-center h-full w-full p-4">
            <AlertCircle className="h-12 w-12 sm:h-16 sm:w-16 mb-3 sm:mb-4" style={{ color: 'var(--color-error)' }} />
            <p className="text-base sm:text-lg font-medium mb-2 text-center" style={{ color: 'var(--color-error)' }}>Error loading PDF</p>
            <p className="text-center mb-3 sm:mb-4 text-sm sm:text-base" style={{ color: 'var(--color-text-secondary)' }}>{error}</p>
            <Button onClick={loadPdfForPreview} size={isMobile ? "sm" : "default"}>
              Try Again
            </Button>
          </div>
        )
      }

      if (isLoading || !pdfUrl) {
        return (
          <div className="flex items-center justify-center h-full w-full">
            <Loader2 className="h-8 w-8 sm:h-12 sm:w-12 animate-spin" style={{ color: 'var(--color-primary)' }} />
          </div>
        )
      }
      
      // Use mobile fallback for PDFs on mobile devices
      if (isMobile) {
        return renderPdfMobileFallback()
      }
      
      return (
        <div className="w-full h-full">
          <iframe
            ref={iframeRef}
            src={pdfUrl}
            className="w-full h-full border-0"
            onLoad={() => setIsLoading(false)}
            title={`PDF Preview - ${resource.title}`}
            style={{ minHeight: '400px' }} // Ensure minimum height
          />
        </div>
      )
    }
    
    if (fileType === 'IMAGE') {
      return (
        <Base64ImagePreview
          resource={resource}
          onLoad={() => setIsLoading(false)}
          onError={() => setError('Failed to load image')}
        />
      )
    }
    
    if (fileType === 'VIDEO') {
      return (
        <div className="w-full h-full flex items-center justify-center p-2 sm:p-4" style={{ backgroundColor: 'var(--color-surface-muted)' }}>
          <video
            controls
            className="w-full h-full object-contain"
            onCanPlay={() => setIsLoading(false)}
            onError={() => {
              api.downloadResource(resource._id)
                .then(response => response.blob())
                .then(blob => {
                  const url = URL.createObjectURL(blob)
                  const video = document.querySelector('video')
                  if (video) {
                    const source = document.createElement('source')
                    source.src = url
                    source.type = resource.mimeType
                    video.appendChild(source)
                    video.load()
                  }
                })
                .catch(error => {
                  console.error('Error loading video:', error)
                  setIsLoading(false)
                  setError('Failed to load video')
                })
            }}
          >
            <source src={`${process.env.NEXT_PUBLIC_API_URL}${resource.fileUrl}`} type={resource.mimeType} />
            Your browser does not support the video tag.
          </video>
        </div>
      )
    }
    
    if (fileType === 'AUDIO') {
      return (
        <div className="w-full h-full flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-surface-muted)' }}>
          <div className="w-full max-w-md p-6 rounded-lg shadow-md" style={{ backgroundColor: 'var(--color-surface)' }}>
            <audio
              controls
              className="w-full"
              onCanPlay={() => setIsLoading(false)}
              onError={() => {
                api.downloadResource(resource._id)
                  .then(response => response.blob())
                  .then(blob => {
                    const url = URL.createObjectURL(blob)
                    const audio = document.querySelector('audio')
                    if (audio) {
                      const source = document.createElement('source')
                      source.src = url
                      source.type = resource.mimeType
                      audio.appendChild(source)
                      audio.load()
                    }
                  })
                  .catch(error => {
                    console.error('Error loading audio:', error)
                    setIsLoading(false)
                    setError('Failed to load audio')
                  })
              }}
            >
              <source src={`${process.env.NEXT_PUBLIC_API_URL}${resource.fileUrl}`} type={resource.mimeType} />
              Your browser does not support the audio tag.
            </audio>
          </div>
        </div>
      )
    }
    
    // For unsupported file types
    return (
      <div className="flex flex-col items-center justify-center h-full w-full p-4">
        <FileIcon fileType={resource.fileType} className="h-12 w-12 sm:h-16 sm:w-16 mb-3 sm:mb-4" />
        <p className="text-base sm:text-lg font-medium mb-2 text-center" style={{ color: 'var(--color-text)' }}>
          Preview not available
        </p>
        <p className="text-center mb-3 sm:mb-4 text-sm sm:text-base" style={{ color: 'var(--color-text-secondary)' }}>
          This file type cannot be previewed in the browser.
        </p>
        <Button onClick={handleDownload} size={isMobile ? "sm" : "default"}>
          <Download className="h-4 w-4 mr-2" />
          Download File
        </Button>
      </div>
    )
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={resource?.title || 'File Preview'}
      size="xl"
    >
      <div className="relative flex flex-col rounded-lg" style={{ 
        width: responsiveDims.width, 
        height: responsiveDims.height, 
        maxHeight: '95vh',
        backgroundColor: 'var(--color-surface)'
      }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ 
            backgroundColor: 'var(--color-surface)',
            opacity: 0.8
          }}>
            <Loader2 className="h-8 w-8 sm:h-12 sm:w-12 animate-spin" style={{ color: 'var(--color-primary)' }} />
          </div>
        )}
        
        {/* Preview container */}
        <div className="flex-1 min-h-0 overflow-auto">
          {renderPreview()}
        </div>
        
        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row justify-end gap-2 p-3 sm:p-4 border-t shrink-0" style={{ 
          borderColor: 'var(--color-border)',
          backgroundColor: 'var(--color-surface-muted)'
        }}>
          <div className="flex flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={onClose} size={windowSize.width < 640 ? "sm" : "default"} className="flex-1 sm:flex-initial">
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
            <Button onClick={handleDownload} size={windowSize.width < 640 ? "sm" : "default"} className="flex-1 sm:flex-initial">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

