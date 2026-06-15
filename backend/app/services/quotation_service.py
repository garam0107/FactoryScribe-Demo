import json
import os

from sqlmodel import Session

from app.config import settings
from app.models.quotation import QuotationDraft
from app.models.generated_file import GeneratedFile
from app.schemas.quotation import QuotationCreateRequest
from app.generators.xlsx_quotation_generator import generate_quotation_xlsx
from app.utils.ids import new_id
from app.utils.time import now_utc


def create_and_generate_quotation(session: Session, req: QuotationCreateRequest):
    now = now_utc()

    data = req.model_dump()
    total_amount = sum(item["amount"] for item in data["items"])
    data["total_amount"] = total_amount

    draft = QuotationDraft(
        id=new_id("quote"),
        conversation_id=req.conversation_id,
        status="draft",
        customer_name=req.customer_name,
        project_name=req.project_name,
        draft_json=json.dumps(data, ensure_ascii=False),
        created_at=now,
        updated_at=now,
    )

    session.add(draft)
    session.commit()
    session.refresh(draft)

    template_path = os.path.join(settings.template_dir, "quotation_template.xlsx")
    output_path = os.path.join(settings.output_dir, f"quotation_{draft.id}.xlsx")

    generate_quotation_xlsx(
        template_path=template_path,
        output_path=output_path,
        data=data,
    )

    draft.status = "generated"
    draft.updated_at = now_utc()

    generated = GeneratedFile(
        id=new_id("file"),
        quotation_draft_id=draft.id,
        file_type="xlsx",
        template_path=template_path,
        output_path=output_path,
        created_at=now_utc(),
    )

    session.add(generated)
    session.commit()

    return {
        "quotation_draft_id": draft.id,
        "generated_file_id": generated.id,
        "output_path": output_path,
    }