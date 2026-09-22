import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react'
import { LoaderCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { ThreeDModelViewer } from '../components/ThreeDModelViewer'
import part2ModelText from '../assets/3D/20810_part2.obj?raw'
import c1ModelDataUrl from '../assets/3D/C1_precision_turned_component_parametric_concept.stl?url'
import c3ModelDataUrl from '../assets/3D/C3_linkage_reconstructed_v3_single_solid.stl?url'
import c5ModelDataUrl from '../assets/3D/C5_Differential_Cylinder_Block_LH_concept.stl?url'
import cf3ra010ModelDataUrl from '../assets/3D/CF3RA010_S2_21_structural_platform_concept.stl?url'
import plh2ModelDataUrl from '../assets/3D/PLH2_column_C1_engineering_review.stl?url'
import fileAttachIcon from '../assets/icons/file-plus.svg'
import bomXlsxFileUrl from '../assets/PLH2-420-EM134-11001_0-BOM.xlsx?url'

export type QuoteDrawingTab = 'bom' | 'settings' | 'change'

type QuotationDrawingPageProps = {
  activeTab: QuoteDrawingTab
  onTabChange: (tab: QuoteDrawingTab) => void
}

type QuotationPreviewFile = {
  name: string
  type: 'pdf' | 'image' | 'unknown'
  objectUrl: string
}

type ImageView = {
  scale: number
  x: number
  y: number
}

const INITIAL_IMAGE_VIEW: ImageView = { scale: 1, x: 0, y: 0 }
const MIN_IMAGE_SCALE = 1
const MAX_IMAGE_SCALE = 4

type BomRow = {
  mark: string
  profile: string
  qty: number
  weight: number
  grade: string
  stock: number | null
}

type ThreeDModel = {
  content: string
  format: 'obj' | 'stl'
  label: string
}

type ThreeDModelSelection = {
  downloadUrl: string
  fileName: string
  model: ThreeDModel
}

const quoteDrawingTabs: { value: QuoteDrawingTab; labelKey: string }[] = [
  { value: 'bom', labelKey: 'quotation.generateBom' },
  { value: 'settings', labelKey: 'quotation.detailedSettings' },
]

const threeDModelsByPdfName: { keyword: string; model: ThreeDModel }[] = [
  {
    keyword: 'part2',
    model: {
      content: part2ModelText,
      format: 'obj',
      label: '20810_part2.obj',
    },
  },
  {
    keyword: 'plh2-420-em134-11001_0',
    model: {
      content: plh2ModelDataUrl,
      format: 'stl',
      label: 'PLH2_column_C1_engineering_review.stl',
    },
  },
  {
    keyword: 'c1.png',
    model: {
      content: c1ModelDataUrl,
      format: 'stl',
      label: 'C1_precision_turned_component_parametric_concept.stl',
    },
  },
  {
    keyword: 'c3.png',
    model: {
      content: c3ModelDataUrl,
      format: 'stl',
      label: 'C3_linkage_reconstructed_v3_single_solid.stl',
    },
  },
  {
    keyword: 'c5.png',
    model: {
      content: c5ModelDataUrl,
      format: 'stl',
      label: 'C5_Differential_Cylinder_Block_LH_concept.stl',
    },
  },
  {
    keyword: 'cf3ra010-s2-21',
    model: {
      content: cf3ra010ModelDataUrl,
      format: 'stl',
      label: 'CF3RA010_S2_21_structural_platform_concept.stl',
    },
  },
]

const demoBomRows: BomRow[] = [
  {
    mark: 'MC4',
    profile: 'H300*300*10*15',
    qty: 1,
    weight: 439.65,
    grade: 'SM355',
    stock: 3,
  },
  {
    mark: 'BK1',
    profile: 'H200*200*8*12',
    qty: 1,
    weight: 53.08,
    grade: 'SS275',
    stock: 12,
  },
  {
    mark: 'BK28',
    profile: 'H350*175*7*11',
    qty: 2,
    weight: 54.52,
    grade: 'SS275',
    stock: 6,
  },
  {
    mark: 'BK48',
    profile: 'H400*200*8*13',
    qty: 1,
    weight: 32.69,
    grade: 'SS275',
    stock: null,
  },
  {
    mark: 'BP5',
    profile: 'PL25*600',
    qty: 1,
    weight: 70.65,
    grade: 'SM355',
    stock: 8,
  },
  {
    mark: 'RP1',
    profile: 'PL12*140',
    qty: 4,
    weight: 13.19,
    grade: 'SM355',
    stock: 24,
  },
  {
    mark: 'RP2',
    profile: 'PL12*140',
    qty: 2,
    weight: 6.59,
    grade: 'SM355',
    stock: 18,
  },
  {
    mark: 'RP3',
    profile: 'PL12*140',
    qty: 2,
    weight: 6.59,
    grade: 'SM355',
    stock: null,
  },
  {
    mark: 'SF2',
    profile: 'PL12*145',
    qty: 4,
    weight: 14.75,
    grade: 'SS275',
    stock: 10,
  },
  {
    mark: 'SF17',
    profile: 'PL14*145',
    qty: 2,
    weight: 8.61,
    grade: 'SS275',
    stock: 5,
  },
  {
    mark: 'SF19',
    profile: 'PL14*145',
    qty: 2,
    weight: 8.61,
    grade: 'SS275',
    stock: null,
  },
]
function getPreviewType(file: File): QuotationPreviewFile['type'] {
  const extension = file.name.split('.').pop()?.toLowerCase()

  if (file.type === 'application/pdf' || extension === 'pdf') {
    return 'pdf'
  }

  if (file.type.startsWith('image/')) {
    return 'image'
  }

  return 'unknown'
}
function getDisplayFileName(fileName?: string): string {
  if (!fileName) {
    return '-'
  }

  return fileName.replace(/\.png$/i, '')
}

function getThreeDModelForFile(fileName: string): ThreeDModel | null {
  const normalizedFileName = fileName.toLowerCase()

  return (
    threeDModelsByPdfName.find(({ keyword }) =>
      normalizedFileName.includes(keyword),
    )?.model ?? null
  )
}

export function QuotationDrawingPage({
  activeTab,
  onTabChange,
}: QuotationDrawingPageProps) {
  const { t } = useTranslation('main')
  const [previewFile, setPreviewFile] = useState<QuotationPreviewFile | null>(
    null,
  )
  const [imageView, setImageView] = useState<ImageView>(INITIAL_IMAGE_VIEW)
  const [isThreeDView, setIsThreeDView] = useState(false)
  const [isAutoEstimateEnabled, setIsAutoEstimateEnabled] = useState(true)
  const [isDefaultThreeDView, setIsDefaultThreeDView] = useState(false)
  const [isImageDragging, setIsImageDragging] = useState(false)
  const imageDragRef = useRef({ pointerId: -1, x: 0, y: 0 })
  const quotationFileInputRef = useRef<HTMLInputElement | null>(null)
  const [threeDModelSelection, setThreeDModelSelection] =
    useState<ThreeDModelSelection | null>(null)
  const [threeDFileError, setThreeDFileError] = useState<string | null>(null)
  const [isThreeDLoading, setIsThreeDLoading] = useState(false)
  const [isBomMenuOpen, setIsBomMenuOpen] = useState(false)
  const bomMenuRef = useRef<HTMLDivElement | null>(null)
  const threeDLoadingTimerRef = useRef<number | null>(null)

  const hasPreviewFile = previewFile !== null
  const selectedThreeDModel = previewFile
    ? getThreeDModelForFile(previewFile.name)
    : null

  useEffect(() => {
    return () => {
      if (previewFile?.objectUrl) {
        URL.revokeObjectURL(previewFile.objectUrl)
      }
    }
  }, [previewFile])

  useEffect(() => {
    return () => {
      if (threeDModelSelection?.downloadUrl) {
        URL.revokeObjectURL(threeDModelSelection.downloadUrl)
      }
    }
  }, [threeDModelSelection])

  useEffect(() => {
    return () => {
      if (threeDLoadingTimerRef.current !== null) {
        window.clearTimeout(threeDLoadingTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isBomMenuOpen) {
      return
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (
        bomMenuRef.current &&
        !bomMenuRef.current.contains(event.target as Node)
      ) {
        setIsBomMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', handleMouseDown)

    return () => {
      window.removeEventListener('mousedown', handleMouseDown)
    }
  }, [isBomMenuOpen])
  const handleQuotationFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const type = getPreviewType(file)

    setImageView(INITIAL_IMAGE_VIEW)
    setIsImageDragging(false)
    setIsThreeDView(false)

    setPreviewFile({
      name: file.name,
      type,
      objectUrl: URL.createObjectURL(file),
    })

    event.target.value = ''
  }

  const handleImageWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    event.preventDefault()

    const bounds = event.currentTarget.getBoundingClientRect()
    const cursorX = event.clientX - bounds.left - bounds.width / 2
    const cursorY = event.clientY - bounds.top - bounds.height / 2
    const zoomFactor = event.deltaY < 0 ? 1.15 : 1 / 1.15

    setImageView((current) => {
      const scale = Math.min(
        MAX_IMAGE_SCALE,
        Math.max(MIN_IMAGE_SCALE, current.scale * zoomFactor),
      )

      if (scale === MIN_IMAGE_SCALE) {
        return INITIAL_IMAGE_VIEW
      }

      const ratio = scale / current.scale
      return {
        scale,
        x: cursorX - (cursorX - current.x) * ratio,
        y: cursorY - (cursorY - current.y) * ratio,
      }
    })
  }

  const handleImagePointerDown = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault()
    if (imageView.scale <= MIN_IMAGE_SCALE) return

    event.currentTarget.setPointerCapture(event.pointerId)
    imageDragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    }
    setIsImageDragging(true)
  }

  const handleImagePointerMove = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (imageDragRef.current.pointerId !== event.pointerId) return

    const deltaX = event.clientX - imageDragRef.current.x
    const deltaY = event.clientY - imageDragRef.current.y
    imageDragRef.current.x = event.clientX
    imageDragRef.current.y = event.clientY
    setImageView((current) => ({
      ...current,
      x: current.x + deltaX,
      y: current.y + deltaY,
    }))
  }

  const handleImagePointerUp = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (imageDragRef.current.pointerId !== event.pointerId) return

    imageDragRef.current.pointerId = -1
    setIsImageDragging(false)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const handleThreeDFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]

    if (!file) {
      return
    }

    const model = getThreeDModelForFile(file.name)

    if (!model) {
      if (threeDLoadingTimerRef.current !== null) {
        window.clearTimeout(threeDLoadingTimerRef.current)
        threeDLoadingTimerRef.current = null
      }

      setIsThreeDLoading(false)
      setThreeDModelSelection(null)
      setThreeDFileError(
        t('quotation.supportedFilesOnly'),
      )
      input.value = ''
      return
    }

    if (threeDLoadingTimerRef.current !== null) {
      window.clearTimeout(threeDLoadingTimerRef.current)
    }

    setIsThreeDLoading(true)
    threeDLoadingTimerRef.current = window.setTimeout(() => {
      setIsThreeDLoading(false)
      threeDLoadingTimerRef.current = null
    }, 6000)

    const modelBlob =
      model.format === 'obj'
        ? new Blob([model.content], { type: 'text/plain;charset=utf-8' })
        : await fetch(model.content).then((response) => response.blob())
    const downloadUrl = URL.createObjectURL(modelBlob)

    setThreeDModelSelection({ downloadUrl, fileName: file.name, model })
    setThreeDFileError(null)

    input.value = ''
  }
  const handleDownloadBomXlsx = () => {
    const link = document.createElement('a')

    link.href = bomXlsxFileUrl
    link.download = 'PLH2-420-EM134-11001_0-BOM.xlsx'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setIsBomMenuOpen(false)
  }

  return (
    <section
      className="order-page quotation-drawing-page"
      aria-label={t('quotation.pageLabel')}
    >
      <nav
        className="tabs order-tabs quotation-drawing-tabs"
        aria-label={t('quotation.tabsLabel')}
      >
        {quoteDrawingTabs.map((tab) => (
          <button
            className={activeTab === tab.value ? 'active' : ''}
            type="button"
            key={tab.value}
            onClick={() => onTabChange(tab.value)}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </nav>

      <div className="order-table-section quotation-drawing-section">
        {activeTab === 'settings' ? (
          <div className="quotation-settings-panel">
            <h2>{t('quotation.basicSettings')}</h2>
            <div className="quotation-settings-list">
              <div className="quotation-settings-row">
                <span>{t('quotation.automaticDecision')}</span>
                <button
                  className="quotation-settings-switch"
                  type="button"
                  role="switch"
                  aria-checked={isAutoEstimateEnabled}
                  onClick={() => setIsAutoEstimateEnabled((current) => !current)}
                >
                  <span />
                </button>
              </div>
              <div className="quotation-settings-row">
                <span>{t('quotation.marginRate')}</span>
                <strong>20%</strong>
              </div>
              <div className="quotation-settings-row">
                <span>{t('quotation.laborCost')}</span>
                <strong>20,000 KRW/h</strong>
              </div>
              <div className="quotation-settings-row">
                <span>{t('quotation.requiredPersonnel')}</span>
                <strong>{t('quotation.peopleCount', { count: 5 })}</strong>
              </div>
              <div className="quotation-settings-row">
                <span>{t('quotation.manufacturingLeadTime')}</span>
                <strong>{t('quotation.dayCount', { count: 15 })}</strong>
              </div>
              <div className="quotation-settings-row">
                <span>{t('quotation.defaultViewOnCompletion')}</span>
                <div className="quotation-settings-view-toggle">
                  <strong className={!isDefaultThreeDView ? 'active' : ''}>2D</strong>
                  <button
                    className="quotation-settings-switch"
                    type="button"
                    role="switch"
                    aria-checked={isDefaultThreeDView}
                    onClick={() => setIsDefaultThreeDView((current) => !current)}
                  >
                    <span />
                  </button>
                  <strong className={isDefaultThreeDView ? 'active' : ''}>3D</strong>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'change' ? (
          <div className="quotation-three-d-content">
            {threeDModelSelection ? (
              <div className="quotation-three-d-model-panel">
                <div className="quotation-three-d-model-header">
                  <div className="quotation-three-d-model-details">
                    <strong>{threeDModelSelection.fileName}</strong>
                    <span>{threeDModelSelection.model.label}</span>
                  </div>
                  <div className="quotation-three-d-model-actions">
                    <label className="quotation-three-d-reselect-button">
                      <input
                        type="file"
                        accept="application/pdf,.pdf,image/png,.png"
                        aria-label={t('quotation.selectAnother2DDrawing')}
                        onChange={handleThreeDFileChange}
                      />
                      {t('quotation.selectAnotherDrawing')}
                    </label>
                    <a
                      className="quotation-three-d-download-button"
                      href={threeDModelSelection.downloadUrl}
                      download={threeDModelSelection.model.label}
                    >
                      {t('quotation.download')}
                    </a>
                  </div>
                </div>
                {isThreeDLoading ? (
                  <div className="quotation-three-d-loading" role="status">
                    <LoaderCircle aria-hidden="true" />
                    <strong>{t('quotation.generating3DModel')}</strong>
                    <span>{t('quotation.pleaseWait')}</span>
                  </div>
                ) : (
                  <ThreeDModelViewer
                    modelContent={threeDModelSelection.model.content}
                    modelFormat={threeDModelSelection.model.format}
                    modelName={threeDModelSelection.model.label}
                  />
                )}
              </div>
            ) : (
              <label className="quotation-file-dropzone">
                <input
                  type="file"
                  accept="application/pdf,.pdf,image/png,.png"
                  aria-label={t('quotation.attach2DDrawingFor3D')}
                  onChange={handleThreeDFileChange}
                />
                <img src={fileAttachIcon} alt="" />
                <span>{t('quotation.upload2DDrawing')}</span>
                {threeDFileError ? (
                  <small className="quotation-three-d-file-error">
                    {threeDFileError}
                  </small>
                ) : null}
              </label>
            )}
          </div>
        ) : (
          <div className="quotation-drawing-content">
          <div className="quotation-source-panel">
          <label
            className={`quotation-file-dropzone${
              hasPreviewFile ? ' has-preview' : ''
            }`}
            onClick={(event) => {
              if (
                hasPreviewFile &&
                event.target !== quotationFileInputRef.current
              ) {
                event.preventDefault()
              }
            }}
          >
            <input
              ref={quotationFileInputRef}
              type="file"
              accept=".pdf,image/*"
              aria-label={t('quotation.attachQuotation')}
              onChange={handleQuotationFileChange}
            />

            {previewFile ? (
              <div className="quotation-file-preview">
                {isThreeDView && selectedThreeDModel ? (
                  <div className="quotation-inline-three-d-viewer">
                    <ThreeDModelViewer
                      modelContent={selectedThreeDModel.content}
                      modelFormat={selectedThreeDModel.format}
                      modelName={selectedThreeDModel.label}
                    />
                  </div>
                ) : isThreeDView ? (
                  <div className="quotation-inline-three-d-empty">
                    {t('quotation.modelNotFound')}
                  </div>
                ) : previewFile.type === 'pdf' ? (
                  <object
                    data={previewFile.objectUrl}
                    type="application/pdf"
                    aria-label={previewFile.name}
                  >
                    <span>{t('quotation.pdfPreviewUnavailable')}</span>
                  </object>
                ) : previewFile.type === 'image' ? (
                  <div
                    className={`quotation-image-viewport${
                      imageView.scale > MIN_IMAGE_SCALE ? ' is-zoomed' : ''
                    }${isImageDragging ? ' is-dragging' : ''}`}
                    onWheel={handleImageWheel}
                    onPointerDown={handleImagePointerDown}
                    onPointerMove={handleImagePointerMove}
                    onPointerUp={handleImagePointerUp}
                    onPointerCancel={handleImagePointerUp}
                    onDoubleClick={(event) => {
                      event.preventDefault()
                      setImageView(INITIAL_IMAGE_VIEW)
                    }}
                  >
                    <img
                      src={previewFile.objectUrl}
                      alt={previewFile.name}
                      draggable={false}
                      style={{
                        transform: `translate3d(${imageView.x}px, ${imageView.y}px, 0) scale(${imageView.scale})`,
                      }}
                    />
                  </div>
                ) : (
                  <div className="quotation-preview-unsupported">
                    {t('quotation.previewUnsupported')}
                  </div>
                )}

              </div>
            ) : (
              <>
                <img src={fileAttachIcon} alt="" />
                <span>{t('quotation.attachQuotationHere')}</span>
              </>
            )}
          </label>

          <div
            className="quotation-preview-toolbar"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="quotation-view-toggle" aria-label={t('quotation.viewToggle')}>
              <span className={!isThreeDView && hasPreviewFile ? 'active' : ''}>
                2D
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isThreeDView}
                aria-label={t('quotation.switchTo3D')}
                disabled={!hasPreviewFile}
                onClick={() => setIsThreeDView((current) => !current)}
              >
                <span />
              </button>
              <span className={isThreeDView && hasPreviewFile ? 'active' : ''}>
                3D
              </span>
            </div>

            <button
              className="quotation-open-another-file"
              type="button"
              disabled={!hasPreviewFile}
              onClick={() => quotationFileInputRef.current?.click()}
            >
              {t('quotation.openAnotherFile')}
            </button>
          </div>
          </div>

          <aside className="quotation-result-panel" aria-label={t('quotation.expectedBom')}>
            <div className="quotation-result-header">
              <div className="quotation-result-title">
                <div className="quotation-file-name-row">
                  <strong>{t('quotation.quotationName')} :</strong>
                  <span>{getDisplayFileName(previewFile?.name)}</span>
                </div>

                <p>{t('quotation.expectedBom')}</p>
              </div>

              <div className="quotation-more-menu-wrap" ref={bomMenuRef}>
                <button
                  className="quotation-more-button"
                  type="button"
                  aria-label={t('quotation.openBomMenu')}
                  aria-haspopup="menu"
                  aria-expanded={isBomMenuOpen}
                  onClick={() => setIsBomMenuOpen((prev) => !prev)}
                >
                  <span>...</span>
                </button>

                {isBomMenuOpen ? (
                  <div className="quotation-more-menu" role="menu">
                    <button type="button" role="menuitem" onClick={handleDownloadBomXlsx}>
                      {t('quotation.download')}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div
              className={`quotation-bom-lines${
                hasPreviewFile ? ' has-data' : ' is-empty'
              }`}
            >
              {hasPreviewFile ? (
                <table className="quotation-bom-table">
                <thead>
                  <tr>
                    <th>Mark</th>
                    <th>Profile</th>
                    <th>Qty</th>
                    <th>Weight</th>
                    <th>Grade</th>
                    <th>Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {demoBomRows.map((row) => (
                    <tr key={row.mark}>
                      <td>{row.mark}</td>
                      <td>{row.profile}</td>
                      <td>{row.qty}</td>
                      <td>{row.weight}</td>
                      <td>{row.grade}</td>
                      <td>
                        <span
                          className={
                            row.stock === null
                              ? 'quotation-stock-badge is-empty'
                              : 'quotation-stock-badge'
                          }
                        >
            {row.stock === null
              ? t('quotation.shortageCount', { count: row.qty })
              : t('quotation.stockCount', { count: row.stock })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                </table>
              ) : (
                Array.from({ length: 8 }).map((_, index) => (
                  <div className="quotation-bom-line-row" key={index} />
                ))
              )}
            </div>

            <div className="quotation-estimate-metrics" aria-label={t('quotation.estimateConditions')}>
              <div>
                <span>{t('quotation.marginRate')}</span>
                <strong>20%</strong>
              </div>
              <div>
                <span>{t('quotation.laborCost')}</span>
                <strong>20,000KRW/h</strong>
              </div>
              <div>
                <span>{t('quotation.personnel')}</span>
                <strong>{t('quotation.peopleCount', { count: 5 })}</strong>
              </div>
            </div>

            <div className="quotation-total-price">
              <strong>{t('quotation.estimatedPrice')} :</strong>
              <span>{hasPreviewFile ? '7,420,000 KRW' : 'KRW'}</span>
            </div>
            <div className="quotation-result-actions">
              <button
                className="quotation-export-pdf-button"
                type="button"
              >
                {t('quotation.exportPdf')}
              </button>
            </div>
          </aside>
          </div>
        )}
      </div>
    </section>
  )
}
