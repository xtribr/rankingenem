"""Contact form endpoint"""
import html
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
import resend

router = APIRouter(prefix="/api/contact", tags=["Contact"])

# Configure Resend
resend.api_key = os.getenv("RESEND_API_KEY")

class ContactForm(BaseModel):
    nome: str
    telefone: str
    nome_escola: str
    cargo: str
    conhecia_xtri: bool
    comentarios: str = ""


@router.post("")
async def send_contact(form: ContactForm):
    """Send contact form via email"""
    if not resend.api_key:
        raise HTTPException(status_code=500, detail="Email service not configured")

    try:
        nome = html.escape(form.nome)
        telefone = html.escape(form.telefone)
        nome_escola = html.escape(form.nome_escola)
        cargo = html.escape(form.cargo)
        comentarios = html.escape(form.comentarios) if form.comentarios else "Nenhum comentário"

        html_content = f"""
        <h2>Novo Contato - X-TRI Escolas</h2>
        <table style="border-collapse: collapse; width: 100%;">
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Nome</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">{nome}</td>
            </tr>
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Telefone/WhatsApp</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">{telefone}</td>
            </tr>
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Escola</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">{nome_escola}</td>
            </tr>
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Cargo</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">{cargo}</td>
            </tr>
            <tr>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>Conhecia a XTRI?</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">{"Sim" if form.conhecia_xtri else "Não"}</td>
            </tr>
        </table>

        <h3>Comentários</h3>
        <p style="background: #f5f5f5; padding: 12px; border-radius: 8px;">
            {comentarios}
        </p>
        """

        params = {
            "from": "X-TRI Escolas <contato@xtri.online>",
            "to": ["contato@xtri.online"],
            "subject": f"Novo Contato - {nome_escola}",
            "html": html_content,
        }

        resend.Emails.send(params)

        return {"success": True, "message": "Mensagem enviada com sucesso"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao enviar email: {str(e)}")
