import logging
import smtplib
from email.message import EmailMessage

from api.settings import get_settings

logger = logging.getLogger(__name__)


def build_app_url(path: str) -> str:
    return f"{get_settings().app_base_url}{path}"


def send_email(recipient: str, subject: str, text: str) -> bool:
    settings = get_settings()

    if not settings.smtp_host:
        logger.warning(
            "SMTP not configured. Intended email to %s with subject %r:\n%s",
            recipient,
            subject,
            text,
        )
        return False

    message = EmailMessage()
    message["From"] = settings.resolved_smtp_from
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(text)

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            if settings.smtp_starttls:
                server.starttls()
            if settings.smtp_username and settings.smtp_password:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(message)
        return True
    except Exception:
        logger.exception("Failed to send email to %s with subject %r", recipient, subject)
        return False
