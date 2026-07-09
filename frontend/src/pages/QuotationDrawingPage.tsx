import { useEffect, useState, type ChangeEvent } from 'react'


import fileAttachIcon from '../assets/icons/file-plus.svg'

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
  length: number
  weight: number
  grade: string
}

const quoteDrawingTabs: { value: QuoteDrawingTab; label: string }[] = [
  { value: 'bom', label: 'BOM 생성' },
  { value: 'change', label: '3D 도면 생성' },
  { value: 'settings', label: '세부 설정' },
]

const demoBomRows: BomRow[] = [
  {
    mark: 'MC4',
    profile: 'H300*300*10*15',
    qty: 1,
    length: 4675,
    weight: 439.65,
    grade: 'SM355',
  },
  {
    mark: 'BK1',
    profile: 'H200*200*8*12',
    qty: 1,
    length: 1064,
    weight: 53.08,
    grade: 'SS275',
  },
  {
    mark: 'BK28',
    profile: 'H350*175*7*11',
    qty: 2,
    length: 550,
    weight: 54.52,
    grade: 'SS275',
  },
  {
    mark: 'BK48',
    profile: 'H400*200*8*13',
    qty: 1,
    length: 495,
    weight: 32.69,
    grade: 'SS275',
  },
  {
    mark: 'BP5',
    profile: 'PL25*600',
    qty: 1,
    length: 600,
    weight: 70.65,
    grade: 'SM355',
  },
  {
    mark: 'RP1',
    profile: 'PL12*140',
    qty: 4,
    length: 250,
    weight: 13.19,
    grade: 'SM355',
  },
  {
    mark: 'RP2',
    profile: 'PL12*140',
    qty: 2,
    length: 250,
    weight: 6.59,
    grade: 'SM355',
  },
  {
    mark: 'RP3',
    profile: 'PL12*140',
    qty: 2,
    length: 250,
    weight: 6.59,
    grade: 'SM355',
  },
  {
    mark: 'SF2',
    profile: 'PL12*145',
    qty: 4,
    length: 270,
    weight: 14.75,
    grade: 'SS275',
  },
  {
    mark: 'SF17',
    profile: 'PL14*145',
    qty: 2,
    length: 270,
    weight: 8.61,
    grade: 'SS275',
  },
  {
    mark: 'SF19',
    profile: 'PL14*145',
    qty: 2,
    length: 270,
    weight: 8.61,
    grade: 'SS275',
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

export function QuotationDrawingPage() {
  const activeTab: QuoteDrawingTab = 'bom'
  const [previewFile, setPreviewFile] = useState<QuotationPreviewFile | null>(
    null,
  )

  const hasPreviewFile = previewFile !== null

  useEffect(() => {
    return () => {
      if (previewFile?.objectUrl) {
        URL.revokeObjectURL(previewFile.objectUrl)
      }
    }
  }, [previewFile])

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
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className="order-table-section quotation-drawing-section">
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
                  <span>{previewFile?.name ?? '-'}</span>
                </div>

                <p>예상 BOM</p>
              </div>

              <button
                className="quotation-more-button"
                type="button"
                aria-label="견적서 더보기"
              >
                <span>...</span>
              </button>
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
                      <th>Length</th>
                      <th>Weight</th>
                      <th>Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demoBomRows.map((row) => (
                      <tr key={row.mark}>
                        <td>{row.mark}</td>
                        <td>{row.profile}</td>
                        <td>{row.qty}</td>
                        <td>{row.length}</td>
                        <td>{row.weight}</td>
                        <td>{row.grade}</td>
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
              <span>{hasPreviewFile ? '1,420,000 KRW' : 'KRW'}</span>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}