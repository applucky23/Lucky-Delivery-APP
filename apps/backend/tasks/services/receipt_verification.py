import logging
import os
import re
import requests
import pytesseract
from PIL import Image
from io import BytesIO
from decimal import Decimal
from urllib.parse import urlparse
from django.conf import settings
from customers.models import TaskProof


# Windows local dev only — Linux production finds it automatically
if os.name == 'nt':
    pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

logger = logging.getLogger(__name__)

FLAG_THRESHOLD_PERCENTAGE = Decimal('0.10')

# Whitelist of allowed image hosts — only your Supabase storage bucket
ALLOWED_IMAGE_HOSTS = {
    settings.SUPABASE_STORAGE_HOST,
}


def is_safe_image_url(url: str) -> bool:
    """
    Ensure the image URL belongs to an allowed host before fetching.
    Prevents SSRF attacks where a malicious driver could point the URL
    at internal services (e.g. AWS metadata endpoint).
    """
    try:
        parsed = urlparse(url)
        return parsed.scheme in ('http', 'https') and parsed.hostname in ALLOWED_IMAGE_HOSTS
    except Exception:
        return False


def _extract_amounts(text: str, patterns: list) -> list:
    found = []
    for pattern in patterns:
        for match in re.findall(pattern, text, re.IGNORECASE | re.MULTILINE):
            try:
                val = float(match.replace(',', ''))
                if val > 0:
                    found.append(val)
            except ValueError:
                continue
    return found


def parse_sms_amount(text: str) -> float | None:
    """
    Extract the debited/paid amount from an Ethiopian bank or Telebirr SMS.
    Returns the first match from the most specific pattern — never the
    available-balance figure that trails every bank SMS.
    """
    # Telebirr checked first — its keyword "paid" is unambiguous
    telebirr_patterns = [
        r'you\s+have\s+paid\s+(?:ETB|birr|br|ብር)?\s*([\d,]+\.?\d*)',
        r'(?:ETB|birr|br|ብር)\s*([\d,]+\.?\d*)\s+has\s+been\s+paid',
        r'paid\s+(?:ETB|birr|br|ብር)\s*([\d,]+\.?\d*)',
        r'ብር\s*([\d,]+\.?\d*)\s*ተከፍሏል',
        r'([\d,]+\.?\d*)\s*ብር\s*ተከፍሏል',
    ]
    results = _extract_amounts(text, telebirr_patterns)
    if results:
        return results[0]

    # Ethiopian bank SMS: CBE, Awash, Dashen, Abyssinia, BOA, Wegagen, Berhan
    # All of these include a trailing "available balance" — we anchor strictly
    # to debit/transfer/payment keywords so that figure is never captured.
    bank_patterns = [
        r'debited\s+(?:by\s+)?(?:ETB|birr|br|ብር)?\s*([\d,]+\.?\d*)',
        r'debited\s+with\s+(?:ETB|birr|br|ብር)?\s*([\d,]+\.?\d*)',
        r'transfer(?:red|\s+of)?\s+(?:ETB|birr|br|ብር)?\s*([\d,]+\.?\d*)',
        r'payment\s+of\s+(?:ETB|birr|br|ብር)?\s*([\d,]+\.?\d*)',
        r'sent\s+(?:ETB|birr|br|ብር)?\s*([\d,]+\.?\d*)',
        r'charged\s+(?:ETB|birr|br|ብር)?\s*([\d,]+\.?\d*)',
        # "Amount: ETB 450.00" — only when NOT followed by a balance label
        r'(?:^|\b)amount\s*:?\s*(?:ETB|birr|br|ብር)?\s*([\d,]+\.?\d*)(?!.*(?:available|balance))',
    ]
    results = _extract_amounts(text, bank_patterns)
    return results[0] if results else None


def parse_receipt_amount(text: str) -> float | None:
    """
    Extract the total amount from a physical receipt via OCR.
    Takes the maximum found value since receipts list line items
    and the grand total is typically the largest number.
    """
    patterns = [
        r'(?:total|grand\s+total|ጠቅላላ)\s*:?\s*(?:ETB|birr|br|ብር)?\s*([\d,]+\.?\d*)',
        r'(?:amount|subtotal)\s*:?\s*(?:ETB|birr|br|ብር)?\s*([\d,]+\.?\d*)',
        r'(?:ETB|birr|br|ብር)\s*:?\s*([\d,]+\.?\d*)',
        r'([\d,]+\.?\d*)\s*(?:ETB|birr|br|ብር)',
        r'([\d,]+\.\d{2})',
    ]
    results = _extract_amounts(text, patterns)
    return max(results) if results else None


def parse_amount_from_text(text: str, receipt_type: str = 'RECEIPT') -> float | None:
    """Route to the correct parser based on what the driver submitted."""
    if receipt_type == 'SMS':
        return parse_sms_amount(text)
    return parse_receipt_amount(text)


def extract_amount_from_image(image_url: str, receipt_type: str = 'RECEIPT') -> float | None:
    """
    Fetch image from a validated URL and extract a monetary amount via OCR.
    OCR failure is logged but never blocks the flow.
    """
    try:
        response = requests.get(image_url, timeout=10, stream=True)
        response.raise_for_status()
        image = Image.open(BytesIO(response.content))
        text = pytesseract.image_to_string(image)
        return parse_amount_from_text(text, receipt_type)
    except Exception as exc:
        logger.warning("OCR extraction failed for %s: %s", image_url, exc)
        return None



def verify_receipt(task, driver_profile, image_url: str, receipt_type: str) -> None:
    """
    Verify receipt/SMS proof and advance a SHOPPING task to DELIVERING.

    Raises ValueError for any invalid precondition so callers can surface a
    clean error message without leaking internal details.
    """
    # --- Precondition checks ---
    if task.status != 'PURCHASED':
        raise ValueError(f"Cannot verify receipt from status '{task.status}'")

    if task.type != 'SHOPPING':
        raise ValueError("Receipt verification is only for SHOPPING tasks")

    if receipt_type not in ('RECEIPT', 'SMS'):
        raise ValueError("Receipt type must be 'RECEIPT' or 'SMS'")

    # --- Authorization (defence-in-depth; view also checks this) ---
    if task.driver != driver_profile:
        raise ValueError("You are not assigned to this task")

    # --- SSRF guard ---
    if not is_safe_image_url(image_url):
        raise ValueError("Invalid or disallowed image URL")

    if len(image_url) > 2000:
        raise ValueError("image_url is too long")

    item_cost = Decimal(str(task.item_cost))

    # TODO: move OCR to an async Celery task so the driver gets an immediate
    #       response and flagging happens in the background.
    extracted = extract_amount_from_image(image_url, receipt_type)

    is_flagged = False
    if extracted is not None:
        difference = abs(Decimal(str(extracted)) - item_cost)
        threshold = item_cost * FLAG_THRESHOLD_PERCENTAGE
        is_flagged = difference > threshold

    TaskProof.objects.create(
        task=task,
        image_url=image_url,
        type=receipt_type,
        driver_reported_amount=item_cost,
        extracted_amount=Decimal(str(extracted)) if extracted is not None else None,
        is_flagged=is_flagged,
    )

    if is_flagged:
        # TODO: trigger admin notification (email / internal alert) here
        logger.warning(
            "Receipt flagged for task %s — extracted %.2f vs reported %.2f",
            task.id,
            extracted,
            item_cost,
        )

    # Always advance regardless of flag status; admins review after the fact
    try:
        task.start_delivery()
        task.save()
    except Exception as exc:
        raise ValueError(f"Failed to start delivery: {exc}") from exc
