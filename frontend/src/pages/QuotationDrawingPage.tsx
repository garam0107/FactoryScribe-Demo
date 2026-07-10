import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { LoaderCircle } from 'lucide-react'

import { ThreeDModelViewer } from '../components/ThreeDModelViewer'
import part2ModelText from '../assets/3D/20810_part2.obj?raw'
import c1ModelDataUrl from '../assets/3D/C1_precision_turned_component_parametric_concept.stl?url'
import c3ModelDataUrl from '../assets/3D/C3_linkage_reconstructed_v3_single_solid.stl?url'
import c5ModelDataUrl from '../assets/3D/C5_Differential_Cylinder_Block_LH_concept.stl?url'
import cf3ra010ModelDataUrl from '../assets/3D/CF3RA010_S2_21_structural_platform_concept.stl?url'
import plh2ModelDataUrl from '../assets/3D/PLH2_column_C1_engineering_review.stl?url'
import fileAttachIcon from '../assets/icons/file-plus.svg'
import bomXlsxFileUrl from '../assets/PLH2-420-EM134-11001_0-BOM.xlsx?url'

type QuoteDrawingTab = 'bom' | 'settings' | 'change'

type QuotationPreviewFile = {
  name: string
  type: 'pdf' | 'image' | 'unknown'
  objectUrl: string
}

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

const quoteDrawingTabs: { value: QuoteDrawingTab; label: string }[] = [
  { value: 'bom', label: 'BOM 생성' },
  { value: 'change', label: '3D 도면 생성' },
  { value: 'settings', label: '세부 설정' },
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

export function QuotationDrawingPage() {
  const [activeTab, setActiveTab] = useState<QuoteDrawingTab>('bom')
  const [previewFile, setPreviewFile] = useState<QuotationPreviewFile | null>(
    null,
  )
  const [threeDModelSelection, setThreeDModelSelection] =
    useState<ThreeDModelSelection | null>(null)
  const [threeDFileError, setThreeDFileError] = useState<string | null>(null)
  const [isThreeDLoading, setIsThreeDLoading] = useState(false)
  const [isBomMenuOpen, setIsBomMenuOpen] = useState(false)
  const bomMenuRef = useRef<HTMLDivElement | null>(null)
  const threeDLoadingTimerRef = useRef<number | null>(null)

  const hasPreviewFile = previewFile !== null

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

    setPreviewFile({
      name: file.name,
      type,
      objectUrl: URL.createObjectURL(file),
    })

    event.target.value = ''
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
        'part2/PLH2/CF3RA010-S2-21 PDF 또는 C1/C3/C5 PNG 파일만 지원합니다.',
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
      aria-label="견적 계산 도면"
    >
      <nav
        className="tabs order-tabs quotation-drawing-tabs"
        aria-label="견적 계산 도면 탭"
      >
        {quoteDrawingTabs.map((tab) => (
          <button
            className={activeTab === tab.value ? 'active' : ''}
            type="button"
            key={tab.value}
            onClick={() => {
              if (tab.value !== 'settings') {
                setActiveTab(tab.value)
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="order-table-section quotation-drawing-section">
        {activeTab === 'change' ? (
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
                        aria-label="다른 2D 도면 선택"
                        onChange={handleThreeDFileChange}
                      />
                      다른 도면 선택
                    </label>
                    <a
                      className="quotation-three-d-download-button"
                      href={threeDModelSelection.downloadUrl}
                      download={threeDModelSelection.model.label}
                    >
                      다운로드
                    </a>
                  </div>
                </div>
                {isThreeDLoading ? (
                  <div className="quotation-three-d-loading" role="status">
                    <LoaderCircle aria-hidden="true" />
                    <strong>3D 모델을 생성하고 있습니다.</strong>
                    <span>잠시만 기다려주세요.</span>
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
                  aria-label="3D 도면 생성용 2D 도면 첨부"
                  onChange={handleThreeDFileChange}
                />
                <img src={fileAttachIcon} alt="" />
                <span>2D 도면 업로드</span>
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
          <label
            className={`quotation-file-dropzone${
              hasPreviewFile ? ' has-preview' : ''
            }`}
          >
            <input
              type="file"
              accept=".pdf,image/*"
              aria-label="견적서 첨부"
              onChange={handleQuotationFileChange}
            />

            {previewFile ? (
              <div className="quotation-file-preview">
                {previewFile.type === 'pdf' ? (
                  <object
                    data={previewFile.objectUrl}
                    type="application/pdf"
                    aria-label={previewFile.name}
                  >
                    <span>PDF 미리보기를 표시할 수 없습니다.</span>
                  </object>
                ) : previewFile.type === 'image' ? (
                  <img src={previewFile.objectUrl} alt={previewFile.name} />
                ) : (
                  <div className="quotation-preview-unsupported">
                    미리보기를 지원하지 않는 파일입니다.
                  </div>
                )}
              </div>
            ) : (
              <>
                <img src={fileAttachIcon} alt="" />
                <span>여기에 견적서 첨부</span>
              </>
            )}
          </label>

          <aside className="quotation-result-panel" aria-label="예상 BOM">
            <div className="quotation-result-header">
              <div className="quotation-result-title">
                <div className="quotation-file-name-row">
                  <strong>견적서명 :</strong>
                  <span>{getDisplayFileName(previewFile?.name)}</span>
                </div>

                <p>예상 BOM</p>
              </div>

              <div className="quotation-more-menu-wrap" ref={bomMenuRef}>
                <button
                  className="quotation-more-button"
                  type="button"
                  aria-label="BOM 메뉴 열기"
                  aria-haspopup="menu"
                  aria-expanded={isBomMenuOpen}
                  onClick={() => setIsBomMenuOpen((prev) => !prev)}
                >
                  <span>...</span>
                </button>

                {isBomMenuOpen ? (
                  <div className="quotation-more-menu" role="menu">
                    <button type="button" role="menuitem" onClick={handleDownloadBomXlsx}>
                      다운로드
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
            {row.stock === null ? `${row.qty}개 부족` : `재고 ${row.stock}개`}
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

            <div className="quotation-total-price">
              <strong>예상 견적 가격 :</strong>
              <span>{hasPreviewFile ? '7,420,000 KRW' : 'KRW'}</span>
            </div>
          </aside>
          </div>
        )}
      </div>
    </section>
  )
}
